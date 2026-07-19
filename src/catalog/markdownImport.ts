// catalog/markdownImport.ts — 手動作成Markdownのローカル検証・プレビュー
import type {
  CatalogCompanyInput,
  CatalogSourceInput,
  CompanyCatalogDocument,
  CompanySourceDocument,
  DuplicateDecision,
  ResearchImportMetadata,
} from "./firestoreModel";
import { evaluateSourceGate } from "./sourceGate";

const METADATA_FENCE = "```company-research-json";
const REQUIRED_SECTIONS = ["AI要約", "推測・未確認", "広告・PR"] as const;

export interface ImportValidationResult {
  metadata: ResearchImportMetadata | null;
  sections: Record<(typeof REQUIRED_SECTIONS)[number], string>;
  errors: string[];
}

export interface ImportPreview {
  validation: ImportValidationResult;
  duplicateDecision: DuplicateDecision | null;
  company: CompanyCatalogDocument | null;
  sources: CompanySourceDocument[];
}

function sectionText(markdown: string, heading: string): string {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`^## ${escaped}\\s*$`, "m").exec(markdown);
  if (!match || match.index === undefined) return "";
  const body = markdown.slice(match.index + match[0].length).replace(/^\r?\n/, "");
  return body.split(/\r?\n##\s+/)[0]?.trim() ?? "";
}

function normalizeText(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}

export function normalizeUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_|fbclid$|gclid$)/i.test(key)) url.searchParams.delete(key);
    }
    url.hostname = url.hostname.toLowerCase();
    if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/+$/, "");
    return url.toString();
  } catch {
    return null;
  }
}

export function companyIdFrom(input: CatalogCompanyInput): string {
  const name = normalizeText(input.name).replace(/[^a-z0-9\u3040-\u30ff\u3400-\u9fff]+/g, "-").replace(/^-|-$/g, "");
  const host = normalizeUrl(input.canonicalUrl)?.replace(/^https?:\/\//, "").split("/")[0].replace(/[^a-z0-9]+/g, "-") ?? "unknown";
  return `cmp_${(name || "unknown").slice(0, 48)}_${host.slice(0, 32)}`;
}

function sourceDocumentId(companyId: string, sourceKey: string): string {
  const safeKey = sourceKey.normalize("NFKC").toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-|-$/g, "");
  return `src_${companyId.slice(4)}_${(safeKey || "source").slice(0, 48)}`;
}

function dateIsValid(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function nonBlank(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function readMetadata(markdown: string, errors: string[]): ResearchImportMetadata | null {
  const start = markdown.indexOf(METADATA_FENCE);
  if (start < 0) {
    errors.push("`company-research-json` メタデータブロックがありません。");
    return null;
  }
  const jsonStart = start + METADATA_FENCE.length;
  const end = markdown.indexOf("```", jsonStart);
  if (end < 0) {
    errors.push("メタデータブロックが閉じられていません。");
    return null;
  }
  try {
    return JSON.parse(markdown.slice(jsonStart, end).trim()) as ResearchImportMetadata;
  } catch {
    errors.push("メタデータブロックは有効なJSONではありません。");
    return null;
  }
}

function validateMetadata(metadata: ResearchImportMetadata, errors: string[]): void {
  if (metadata.schemaVersion !== 1) errors.push("schemaVersion は 1 である必要があります。");
  if (!metadata.company || !nonBlank(metadata.company.name)) errors.push("company.name は必須です。");
  if (!metadata.company || !normalizeUrl(metadata.company.canonicalUrl)) errors.push("company.canonicalUrl は http(s) URL である必要があります。");
  if (!dateIsValid(metadata.researchedOn)) errors.push("researchedOn は YYYY-MM-DD 形式の有効な日付である必要があります。");
  if (metadata.reviewStatus !== "reviewed") errors.push("reviewStatus は reviewed である必要があります。");
  if (!Array.isArray(metadata.sources) || metadata.sources.length === 0) {
    errors.push("sources は1件以上必要です。");
  } else {
    const ids = new Set<string>();
    metadata.sources.forEach((source, index) => {
      const label = `sources[${index}]`;
      if (!nonBlank(source.sourceId) || ids.has(source.sourceId)) errors.push(`${label}.sourceId は重複しない必須項目です。`);
      ids.add(source.sourceId);
      if (!nonBlank(source.sourceName)) errors.push(`${label}.sourceName は必須です。`);
      if (!normalizeUrl(source.url)) errors.push(`${label}.url は http(s) URL である必要があります。`);
      if (!dateIsValid(source.capturedOn)) errors.push(`${label}.capturedOn は有効な日付である必要があります。`);
      if (!dateIsValid(source.termsCheckedOn)) errors.push(`${label}.termsCheckedOn は有効な日付である必要があります。`);
      if (!nonBlank(source.extractionScope)) errors.push(`${label}.extractionScope は必須です。`);
      if (!nonBlank(source.evidence)) errors.push(`${label}.evidence は本文転載でない短い根拠メモとして必須です。`);
      if (source.evidence?.length > 280) errors.push(`${label}.evidence は280字以内の自作要約にしてください。`);
      if (!["operator_manual", "user_initiated", "automated"].includes(source.acquisitionMethod)) {
        errors.push(`${label}.acquisitionMethod が不正です。`);
      }
      if (!["allowed", "not_explicitly_prohibited", "explicitly_prohibited"].includes(source.automationStatus)) {
        errors.push(`${label}.automationStatus が不正です。`);
      }
      if (!["public", "login_required", "technical_bypass"].includes(source.accessMethod)) {
        errors.push(`${label}.accessMethod が不正です。`);
      }
      if (!["allowed", "structured_facts_only", "prohibited", "unknown"].includes(source.redistributionStatus)) {
        errors.push(`${label}.redistributionStatus が不正です。`);
      }
      const gate = evaluateSourceGate({
        sourceName: source.sourceName,
        url: source.url,
        acquisitionMethod: source.acquisitionMethod,
        automationStatus: source.automationStatus,
        accessMethod: source.accessMethod,
        redistributionStatus: source.redistributionStatus,
        contentKind: "structured_facts_and_self_authored_summary",
      });
      if (gate.acquisition === "block") {
        errors.push(`${label} は取得ゲートを通過しません。 ${gate.reasons.join(" ")}`);
      }
      if (gate.redistribution !== "allow") {
        errors.push(`${label} は再配布ゲートを通過しません。 ${gate.reasons.join(" ")}`);
      }
    });
  }
  if (!Array.isArray(metadata.facts) || metadata.facts.length === 0) {
    errors.push("facts は1件以上必要です。");
  } else {
    const sourceIds = new Set(metadata.sources?.map((source) => source.sourceId) ?? []);
    metadata.facts.forEach((fact, index) => {
      const label = `facts[${index}]`;
      if (!nonBlank(fact.field) || !nonBlank(fact.value)) errors.push(`${label}.field と value は必須です。`);
      if (!sourceIds.has(fact.sourceId)) errors.push(`${label}.sourceId は sources 内のIDである必要があります。`);
      if (!dateIsValid(fact.verifiedOn)) errors.push(`${label}.verifiedOn は有効な日付である必要があります。`);
    });
  }
}

export function validateResearchMarkdown(markdown: string): ImportValidationResult {
  const errors: string[] = [];
  const metadata = readMetadata(markdown, errors);
  const sections = Object.fromEntries(REQUIRED_SECTIONS.map((heading) => [heading, sectionText(markdown, heading)])) as ImportValidationResult["sections"];
  if (metadata) validateMetadata(metadata, errors);
  if (!/^#\s+企業リサーチ:\s*\S+/m.test(markdown)) errors.push("先頭見出しは `# 企業リサーチ: 会社名` 形式で必要です。");
  if (!sections["AI要約"]) errors.push("`## AI要約` は必須です。");
  // 推測・PRは「なし」と明示することで、事実と混在させない。
  for (const heading of ["推測・未確認", "広告・PR"] as const) {
    if (!sections[heading]) errors.push(`\`## ${heading}\` は、内容がない場合も「なし」と明記してください。`);
  }
  return { metadata, sections, errors };
}

function stableHash(value: string): string {
  // 暗号学的ハッシュは、実接続時の取込み境界でWeb Cryptoに差し替える。
  // ここではローカルのプレビュー/重複候補表示だけに使う安定した識別子を作る。
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
  return `local-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function findDuplicateDecision(
  incoming: ResearchImportMetadata,
  existing: (Pick<CompanyCatalogDocument, "companyId" | "canonicalUrl" | "normalizedName" | "sourceIds"> & { sourceUrls?: string[] })[]
): DuplicateDecision {
  if (incoming.company.targetCompanyId) return { kind: "update_target", companyId: incoming.company.targetCompanyId };
  const canonicalUrl = normalizeUrl(incoming.company.canonicalUrl);
  const exactUrl = existing.filter((company) => normalizeUrl(company.canonicalUrl) === canonicalUrl).map((company) => company.companyId);
  if (exactUrl.length) return { kind: "review_exact_url", companyIds: exactUrl };
  const name = normalizeText(incoming.company.name);
  const nameMatches = existing.filter((company) => company.normalizedName === name).map((company) => company.companyId);
  if (nameMatches.length) return { kind: "review_name_match", companyIds: nameMatches };
  const incomingSourceUrls = new Set(incoming.sources.map((source) => normalizeUrl(source.url)).filter(Boolean));
  const overlap = existing
    .filter((company) => company.sourceUrls?.some((url) => incomingSourceUrls.has(normalizeUrl(url))))
    .map((company) => company.companyId);
  if (overlap.length) return { kind: "review_source_overlap", companyIds: overlap };
  return { kind: "create" };
}

export function previewResearchImport(
  markdown: string,
  existing: (Pick<CompanyCatalogDocument, "companyId" | "canonicalUrl" | "normalizedName" | "sourceIds"> & { sourceUrls?: string[] })[] = [],
  now = new Date().toISOString()
): ImportPreview {
  const validation = validateResearchMarkdown(markdown);
  if (!validation.metadata || validation.errors.length) return { validation, duplicateDecision: null, company: null, sources: [] };
  const metadata = validation.metadata;
  const companyId = metadata.company.targetCompanyId ?? companyIdFrom(metadata.company);
  const sourceIds = new Map(metadata.sources.map((source) => [source.sourceId, sourceDocumentId(companyId, source.sourceId)]));
  const sources = metadata.sources.map((source): CompanySourceDocument => ({
    ...source,
    schemaVersion: 1,
    sourceKey: source.sourceId,
    sourceId: sourceIds.get(source.sourceId)!,
    companyId,
    normalizedUrl: normalizeUrl(source.url)!,
    evidenceHash: stableHash(JSON.stringify({ url: normalizeUrl(source.url), scope: source.extractionScope, capturedOn: source.capturedOn, evidence: source.evidence })),
    createdAt: now,
  }));
  const company: CompanyCatalogDocument = {
    schemaVersion: 1,
    companyId,
    name: metadata.company.name.trim(),
    normalizedName: normalizeText(metadata.company.name),
    canonicalUrl: normalizeUrl(metadata.company.canonicalUrl)!,
    aliases: metadata.company.aliases?.map((alias) => alias.trim()).filter(Boolean) ?? [],
    ...(metadata.company.corporateNumber ? { corporateNumber: metadata.company.corporateNumber } : {}),
    facts: metadata.facts.map((fact) => ({ ...fact, sourceId: sourceIds.get(fact.sourceId)! })),
    aiSummary: validation.sections["AI要約"],
    inferences: validation.sections["推測・未確認"],
    sponsoredOrPr: validation.sections["広告・PR"],
    reviewStatus: "reviewed",
    sourceIds: sources.map((source) => source.sourceId),
    researchedOn: metadata.researchedOn,
    updatedAt: now,
  };
  return { validation, duplicateDecision: findDuplicateDecision(metadata, existing), company, sources };
}
