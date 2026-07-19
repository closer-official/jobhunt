// catalog/sourceGate.ts — 取得と再配布を分離したローカル判定

export type AcquisitionMethod =
  | "operator_manual"
  | "user_initiated"
  | "automated";
export type AutomationStatus =
  | "allowed"
  | "not_explicitly_prohibited"
  | "explicitly_prohibited";
export type AccessMethod =
  | "public"
  | "login_required"
  | "technical_bypass";
export type RedistributionStatus =
  | "allowed"
  | "structured_facts_only"
  | "prohibited"
  | "unknown";

export interface SourceGateInput {
  sourceName: string;
  url: string;
  acquisitionMethod: AcquisitionMethod;
  automationStatus: AutomationStatus;
  accessMethod: AccessMethod;
  redistributionStatus: RedistributionStatus;
  contentKind:
    | "structured_facts_and_self_authored_summary"
    | "raw_text"
    | "image"
    | "review_body";
}

export interface SourceGateDecision {
  acquisition: "allow_candidate" | "block";
  redistribution: "allow" | "needs_review" | "block";
  reasons: string[];
}

function isWantedly(input: SourceGateInput): boolean {
  try {
    return new URL(input.url).hostname.toLowerCase().endsWith("wantedly.com")
      || input.sourceName.toLowerCase().includes("wantedly");
  } catch {
    return input.sourceName.toLowerCase().includes("wantedly");
  }
}

export function evaluateSourceGate(
  input: SourceGateInput
): SourceGateDecision {
  const reasons: string[] = [];
  let acquisition: SourceGateDecision["acquisition"] = "allow_candidate";
  if (isWantedly(input)) {
    acquisition = "block";
    reasons.push("Wantedlyは対象外です。");
  }
  if (
    input.accessMethod === "login_required"
    || input.accessMethod === "technical_bypass"
  ) {
    acquisition = "block";
    reasons.push("ログイン突破又は技術的回避を伴う取得は禁止です。");
  }
  if (
    input.acquisitionMethod === "automated"
    && input.automationStatus === "explicitly_prohibited"
  ) {
    acquisition = "block";
    reasons.push("明示的に禁止された自動取得は行いません。");
  }

  let redistribution: SourceGateDecision["redistribution"] = "allow";
  if (
    input.contentKind !== "structured_facts_and_self_authored_summary"
  ) {
    redistribution = "block";
    reasons.push("原文、画像、口コミ本文は再配布しません。");
  } else if (input.redistributionStatus === "prohibited") {
    redistribution = "block";
    reasons.push("再配布禁止の情報源は公開カタログへ載せません。");
  } else if (input.redistributionStatus === "unknown") {
    redistribution = "needs_review";
    reasons.push("再配布条件を運営確認する必要があります。");
  }
  return { acquisition, redistribution, reasons };
}
