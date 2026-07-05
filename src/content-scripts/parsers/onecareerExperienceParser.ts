// content-scripts/parsers/onecareerExperienceParser.ts
// ONE CAREER 選考体験記・ES・企業ページのキャプチャ用パーサー。
// 役割: ES設問・面接で聞かれたこと・選考フローを見出しキーワードで区切って構造化する。
import { extractPageText } from "../capture/extractPageText";

const SECTION_KEYWORDS = [
  "エントリーシート", "ES", "設問", "面接", "一次面接", "二次面接", "最終面接",
  "グループディスカッション", "GD", "Webテスト", "テスト形式", "選考フロー", "選考ステップ",
  "インターン", "内定", "志望動機", "ガクチカ", "自己PR", "聞かれた質問", "対策",
];

export function parseOnecareerExperience(doc: Document = document): string {
  const parts: string[] = [];
  const title = doc.querySelector("h1")?.textContent?.trim() || doc.title;
  if (title) parts.push(`【ONE CAREERページ】${title}`);

  // 見出し（h2/h3/h4）のうち選考関連キーワードを含むものと、その直後の本文を対で拾う
  const headings = Array.from(doc.querySelectorAll<HTMLElement>("h2, h3, h4"));
  let structured = 0;
  for (const h of headings) {
    const ht = h.textContent?.trim() ?? "";
    if (!ht || !SECTION_KEYWORDS.some((k) => ht.includes(k))) continue;

    // 見出しの次の兄弟〜次の見出しまでのテキストを本文とする
    const bodyParts: string[] = [];
    let node: Element | null = h.nextElementSibling;
    let hops = 0;
    while (node && hops < 6 && !/^H[2-4]$/.test(node.tagName)) {
      const t = node.textContent?.replace(/\s+/g, " ").trim() ?? "";
      if (t) bodyParts.push(t);
      node = node.nextElementSibling;
      hops++;
    }
    const body = bodyParts.join("\n").slice(0, 2000);
    if (body.length > 20) {
      parts.push(`【${ht.slice(0, 60)}】\n${body}`);
      structured++;
    }
    if (structured >= 15) break;
  }

  // 構造化できなければ汎用抽出（Vue SPAで見出し構造が変わっても本文は確保する）
  if (structured < 2) {
    parts.push(`【ページ本文（汎用抽出）】\n${extractPageText(doc)}`);
  }
  return parts.join("\n\n").slice(0, 20000);
}
