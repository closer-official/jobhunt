// content-scripts/parsers/onecareerListParser.ts
// ONE CAREER 企業一覧ページの企業カード抽出。
//
// 実DOMサンプル（2026-07取得）からの確定事項:
//   - 1カード = .company-list__content（内部に label=業界 / h3.oc-heading=企業名 / rating）
//   - カード内に<a>は存在しない（VueのJSナビゲーション）
//   - 企業ページIDはロゴ画像パス uploads/company/square_logo/{id}/ に埋まっており、
//     ページ内リンクとの照合で 29/29 完全一致を確認済み
//     → https://www.onecareer.jp/companies/{id} を構築できる
import { JobCard } from "../../storage/schema";

const CARD_SELECTORS = [".company-list__content", ".company-list__list-item"];

function cleanUrl(href: string): string {
  try {
    const u = new URL(href, location.origin);
    return `${u.origin}${u.pathname}`;
  } catch {
    return href;
  }
}

/** カードから企業ページURLを解決する（リンク→ロゴID構築の順） */
function resolveCompanyUrl(card: Element): string {
  // 1. カード内/近傍に素直なリンクがあれば最優先（将来DOMが変わった場合の保険）
  const anchor =
    card.querySelector<HTMLAnchorElement>("a[href*='/companies/']") ??
    card.closest<HTMLAnchorElement>("a[href*='/companies/']");
  if (anchor) {
    const href = anchor.href || anchor.getAttribute("href") || "";
    if (href) return cleanUrl(href);
  }
  // 2. ロゴ画像パスからIDを復元（実データで29/29一致を確認済みの方式）
  const logo = card.querySelector<HTMLImageElement>("img[src*='square_logo']");
  const id = logo?.getAttribute("src")?.match(/square_logo\/(\d+)\//)?.[1];
  if (id) return `https://www.onecareer.jp/companies/${id}`;
  return "";
}

export function parseOnecareerList(doc: Document = document): JobCard[] {
  let nodes: Element[] = [];
  for (const sel of CARD_SELECTORS) {
    nodes = Array.from(doc.querySelectorAll(sel));
    // h3を持つカードだけを対象にする（list-itemは画像のみのことがある）
    nodes = nodes.filter((n) => n.querySelector("h3"));
    if (nodes.length > 0) break;
  }

  const cards: JobCard[] = [];
  const seen = new Set<string>();
  for (const node of nodes) {
    const name =
      node.querySelector("h3.oc-heading, h3[role='heading'], h3")?.textContent?.trim() ?? "";
    const detailUrl = resolveCompanyUrl(node);
    if (!name || !detailUrl || seen.has(detailUrl)) continue;
    seen.add(detailUrl);

    const category =
      node.querySelector(".company-list__category, label[class*='oc-label']")?.textContent?.trim() ?? "";
    const rating =
      node.querySelector(".company-list__rating")?.textContent?.replace(/\s+/g, " ").trim() ?? "";

    cards.push({
      companyName: name,
      jobTitle: name, // 企業一覧のため職種は無い。企業名をタイトル扱いにする
      location: "",
      salary: "",
      detailUrl,
      snippet: `${category} 評価${rating} ${(node.textContent ?? "").replace(/\s+/g, " ")}`
        .trim()
        .slice(0, 1000),
    });
  }

  // カード検出ゼロの最終フォールバック: /companies/ リンクから直接収集
  if (cards.length === 0) {
    for (const a of Array.from(doc.querySelectorAll<HTMLAnchorElement>("a[href*='/companies/']"))) {
      const url = cleanUrl(a.href || a.getAttribute("href") || "");
      // リンク周辺のh3があれば企業名として優先する
      const block = a.closest("li,article,div");
      const name =
        block?.querySelector("h3")?.textContent?.trim() || a.textContent?.trim() || "";
      if (!name || name.length < 2 || !url || seen.has(url)) continue;
      seen.add(url);
      cards.push({
        companyName: name, jobTitle: name, location: "", salary: "",
        detailUrl: url,
        snippet: (block?.textContent ?? name).replace(/\s+/g, " ").slice(0, 1000),
      });
    }
  }
  return cards;
}
