// content-scripts/parsers/mynaviDetailParser.ts
// マイナビ求人詳細/企業ページの構造化抽出。
// dt/dd・テーブル・見出しキーワードを拾い、なければ汎用抽出にフォールバック。
import { extractPageText } from "../capture/extractPageText";

const SECTION_KEYWORDS = [
  "仕事内容", "業務内容", "事業内容", "募集要項", "応募資格", "求める人物像",
  "求める人材", "対象となる方", "勤務地", "給与", "選考", "福利厚生", "企業情報",
];

function extractDefinitionPairs(doc: Document): string[] {
  const out: string[] = [];
  // dt/dd 形式
  doc.querySelectorAll("dl").forEach((dl) => {
    const dts = dl.querySelectorAll("dt");
    const dds = dl.querySelectorAll("dd");
    dts.forEach((dt, i) => {
      const key = dt.textContent?.trim() ?? "";
      const val = dds[i]?.textContent?.trim() ?? "";
      if (key && val && SECTION_KEYWORDS.some((k) => key.includes(k))) {
        out.push(`【${key}】\n${val}`);
      }
    });
  });
  // th/td 形式
  doc.querySelectorAll("table tr").forEach((tr) => {
    const key = tr.querySelector("th")?.textContent?.trim() ?? "";
    const val = tr.querySelector("td")?.textContent?.trim() ?? "";
    if (key && val && SECTION_KEYWORDS.some((k) => key.includes(k))) {
      out.push(`【${key}】\n${val}`);
    }
  });
  return out;
}

export function parseMynaviDetail(doc: Document = document): string {
  const parts: string[] = [];
  const title = doc.querySelector("h1")?.textContent?.trim();
  if (title) parts.push(`【ページタイトル】${title}`);

  const sections = extractDefinitionPairs(doc);
  if (sections.length >= 2) {
    parts.push(...sections);
  } else {
    parts.push(`【ページ本文(汎用抽出)】\n${extractPageText(doc)}`);
  }
  return parts.join("\n\n").slice(0, 20000);
}
