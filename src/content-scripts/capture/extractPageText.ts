// content-scripts/capture/extractPageText.ts
// innerTextベースの汎用本文抽出。nav/footer/header等のノイズを除去する。

const NOISE_SELECTORS = [
  "nav", "footer", "header", "aside", "script", "style", "noscript",
  "iframe", "svg", "form[role='search']",
  "[role='navigation']", "[role='banner']", "[role='contentinfo']",
  "[aria-hidden='true']",
  ".global-nav", ".breadcrumb", ".cookie", "#cookie-banner",
].join(",");

export const MAX_CAPTURE_CHARS = 20000;

export function extractPageText(doc: Document = document): string {
  const clone = doc.body.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(NOISE_SELECTORS).forEach((el) => el.remove());

  // cloneはDOMツリー外なのでinnerTextが効かない環境がある。
  // 一時的にドキュメントへ非表示で接続してinnerTextの整形を利用する。
  clone.style.position = "fixed";
  clone.style.left = "-99999px";
  clone.style.top = "0";
  doc.body.appendChild(clone);
  let text = "";
  try {
    text = clone.innerText || clone.textContent || "";
  } finally {
    clone.remove();
  }

  text = text
    .replace(/[ \t\u3000]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (text.length > MAX_CAPTURE_CHARS) {
    text = text.slice(0, MAX_CAPTURE_CHARS) + "\n…（以降省略）";
  }
  return text;
}
