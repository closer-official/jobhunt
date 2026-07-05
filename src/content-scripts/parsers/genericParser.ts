// content-scripts/parsers/genericParser.ts
// 公式HP / note等、任意ページ向けの汎用innerText抽出ラッパー
import { extractPageText } from "../capture/extractPageText";

export function parseGenericPage(doc: Document = document): { title: string; text: string } {
  // note記事は article 要素に本文が入っているため優先して見る
  const article = doc.querySelector<HTMLElement>("article");
  const articleText = article?.innerText?.trim();
  const text =
    articleText && articleText.length > 200
      ? articleText.slice(0, 20000)
      : extractPageText(doc);
  return { title: doc.title ?? "", text };
}
