// content-scripts/parsers/mynaviListParser.ts
// マイナビ（新卒/転職）検索結果一覧の抽出。
// サイト・年度によりDOMが大きく異なるため、既知セレクタ→汎用ヒューリスティックの
// 2段構えで抽出する。
import { JobCard } from "../../storage/schema";

interface SelectorSet {
  card: string;
  title: string[];
  company: string[];
  location: string[];
  salary: string[];
  link: string[];
}

// 既知のパターン（マイナビ転職 / マイナビ新卒）
const KNOWN_SETS: SelectorSet[] = [
  {
    // マイナビ転職
    card: ".recruit",
    title: [".occName", "h3 a", ".recruit__name a"],
    company: [".companyName", ".recruit__company"],
    location: [".tableCondition .place", ".jobPointArea"],
    salary: [".tableCondition .salary"],
    link: ["h3 a", ".occName a", "a.js__linkArea"],
  },
  {
    // マイナビ新卒（20XX）
    card: ".boxSearchresultEach, .js-add-examination-list-header",
    title: [".heading3 a", "h3 a"],
    company: [".heading3 a", ".corpNameLink"],
    location: [".addressArea", ".area"],
    salary: [".salary"],
    link: [".heading3 a", "h3 a"],
  },
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

/** 汎用フォールバック: 詳細ページらしきリンクを含む繰り返しブロックを推定する */
function heuristicParse(doc: Document): JobCard[] {
  const anchors = Array.from(
    doc.querySelectorAll<HTMLAnchorElement>("a[href*='/jobinfo'], a[href*='corpInfo'], a[href*='/shukatsu/corp']")
  );
  const cards: JobCard[] = [];
  const seen = new Set<string>();
  for (const a of anchors) {
    const url = a.href;
    const title = a.textContent?.trim() ?? "";
    if (!url || !title || title.length < 2 || seen.has(url)) continue;
    seen.add(url);
    const block = a.closest("li, article, section, div");
    const snippet = (block?.textContent ?? title).replace(/\s+/g, " ").trim().slice(0, 1000);
    cards.push({
      companyName: title,
      jobTitle: title,
      location: "",
      salary: "",
      detailUrl: url,
      snippet,
    });
  }
  return cards;
}

export function parseMynaviList(doc: Document = document): JobCard[] {
  for (const set of KNOWN_SETS) {
    const nodes = Array.from(doc.querySelectorAll(set.card));
    if (nodes.length === 0) continue;
    const cards: JobCard[] = [];
    for (const node of nodes) {
      const detailUrl = pickHref(node, set.link);
      const jobTitle = pickText(node, set.title);
      if (!detailUrl || !jobTitle) continue;
      cards.push({
        jobTitle,
        detailUrl,
        companyName: pickText(node, set.company) || jobTitle,
        location: pickText(node, set.location),
        salary: pickText(node, set.salary),
        snippet: (node.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 1000),
      });
    }
    if (cards.length > 0) return cards;
  }
  return heuristicParse(doc);
}
