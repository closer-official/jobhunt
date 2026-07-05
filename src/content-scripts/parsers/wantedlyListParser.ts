// content-scripts/parsers/wantedlyListParser.ts
// Wantedly 募集一覧（/projects 検索結果）の求人カード抽出。
// セレクタは実DOMサンプル（2026-07取得）から確定。
// Wantedlyはstyled-componentsのため後半ハッシュ（.gBeMsG等）は変わる。
// 前半の意味名（ProjectListJobPostItem__〜）は安定しているので部分一致で拾う。
import { JobCard } from "../../storage/schema";

const CARD_SELECTORS = [
  "section.projects-index-single",                       // 一番安定している素のクラス
  "section[class*='ProjectListJobPostItem__Base']",
  "[class*='ProjectListJobPostsMobile__ProjectListItem'] section",
];

const TITLE_SELECTORS = [
  "[class*='ProjectListJobPostItem__TitleText']",        // Mobile/Desktop両対応の部分一致
  "h2",
];
const COMPANY_SELECTORS = [
  "[class*='CompanyNameText']",                          // JobPostCompanyWithWorkingConnectedUser__CompanyNameText
  "a[href^='/companies/']",
];
const DESC_SELECTORS = ["[class*='ProjectListJobPostItem__DescriptionText']"];
const LINK_SELECTORS = [
  "a[class*='ProjectListJobPostItem__ProjectLink']",
  "a[href^='/projects/']",
];

function pickText(root: Element, selectors: string[]): string {
  for (const sel of selectors) {
    const t = root.querySelector(sel)?.textContent?.trim();
    if (t) return t;
  }
  return "";
}

function pickHref(root: Element, selectors: string[]): string {
  for (const sel of selectors) {
    const el = root.querySelector<HTMLAnchorElement>(sel);
    if (el?.href) return el.href;
    const rel = el?.getAttribute("href");
    if (rel) return new URL(rel, location.origin).toString();
  }
  return "";
}

export function parseWantedlyList(doc: Document = document): JobCard[] {
  let nodes: Element[] = [];
  for (const sel of CARD_SELECTORS) {
    nodes = Array.from(doc.querySelectorAll(sel));
    if (nodes.length > 0) break;
  }

  const cards: JobCard[] = [];
  for (const node of nodes) {
    const jobTitle = pickText(node, TITLE_SELECTORS);
    const detailUrl = pickHref(node, LINK_SELECTORS);
    if (!jobTitle || !detailUrl) continue;

    // タグ（「SNS運用代行／企画・撮影・中途」等）もスコアリング材料としてsnippetに含める
    const tags = Array.from(node.querySelectorAll("[class*='FeatureTagList__TagLabel']"))
      .map((el) => el.textContent?.trim() ?? "")
      .filter(Boolean)
      .join(" / ");
    const desc = pickText(node, DESC_SELECTORS);

    cards.push({
      jobTitle,
      detailUrl,
      companyName: pickText(node, COMPANY_SELECTORS) || "（企業名不明）",
      location: "", // Wantedly一覧カードには勤務地表記がない（詳細取得時に補完される）
      salary: "",   // Wantedlyは給与非掲載ポリシー
      snippet: `${tags} ${desc} ${(node.textContent ?? "").replace(/\s+/g, " ")}`.trim().slice(0, 1200),
    });
  }
  return cards;
}
