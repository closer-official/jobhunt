// content-scripts/parsers/openworkParser.ts
// OpenWork 企業ページ/クチコミページのキャプチャ用パーサー。
// 役割: 「この会社本当に大丈夫？」の判断材料（総合評価・残業・有給・年収・クチコミ）を
//       ラベルキーワード近傍から構造化して抜き、拾えない場合は汎用抽出に落とす。
// 注: DOMサンプルはホーム画面のみ入手済みのため、企業ページはキーワード方式で防御的に実装。
import { extractPageText } from "../capture/extractPageText";

const METRIC_KEYWORDS = [
  "総合評価", "残業時間", "有給休暇消化率", "有給消化率", "平均年収", "回答者の平均年収",
  "社員クチコミ", "待遇面の満足度", "社員の士気", "風通しの良さ", "社員の相互尊重",
  "20代成長環境", "人材の長期育成", "法令順守意識", "人事評価の適正感",
];

const REVIEW_CATEGORY_KEYWORDS = [
  "組織体制・企業文化", "入社理由と入社後ギャップ", "働きがい・成長", "女性の働きやすさ",
  "ワーク・ライフ・バランス", "退職検討理由", "企業分析", "経営者への提言", "年収・給与",
];

/** ラベル要素の近傍から数値・スコアを拾う */
function extractMetrics(doc: Document): string[] {
  const out: string[] = [];
  const all = Array.from(doc.querySelectorAll("dt, th, dd, td, span, p, h3, h4, div"));
  const found = new Set<string>();
  for (const el of all) {
    const own = (el.childNodes.length <= 3 ? el.textContent : "")?.trim() ?? "";
    for (const kw of METRIC_KEYWORDS) {
      if (found.has(kw) || !own.includes(kw) || own.length > kw.length + 25) continue;
      // 同じ行/親ブロック内の短いテキストを値として拾う
      const block = el.closest("dl, tr, li, div") ?? el.parentElement;
      const blockText = block?.textContent?.replace(/\s+/g, " ").trim() ?? "";
      if (blockText && blockText.length < 200) {
        out.push(blockText);
        found.add(kw);
      }
    }
  }
  return out;
}

/** クチコミ本文の抽出（カテゴリ見出し + 回答文） */
function extractReviews(doc: Document): string[] {
  const out: string[] = [];
  // OpenWorkのクチコミはdt(カテゴリ)/dd(本文)構造が続いてきた
  doc.querySelectorAll("dl").forEach((dl) => {
    const dt = dl.querySelector("dt")?.textContent?.trim() ?? "";
    if (!REVIEW_CATEGORY_KEYWORDS.some((k) => dt.includes(k))) return;
    const dd = dl.querySelector("dd")?.textContent?.replace(/\s+/g, " ").trim() ?? "";
    if (dd.length > 30) out.push(`【${dt}】\n${dd.slice(0, 1500)}`);
  });
  // article要素ベースのフォールバック
  if (out.length === 0) {
    doc.querySelectorAll("article").forEach((a) => {
      const t = a.textContent?.replace(/\s+/g, " ").trim() ?? "";
      if (t.length > 80) out.push(t.slice(0, 1500));
    });
  }
  return out.slice(0, 12);
}

export function parseOpenwork(doc: Document = document): string {
  const parts: string[] = [];
  const title = doc.querySelector("h1")?.textContent?.trim() || doc.title;
  if (title) parts.push(`【OpenWorkページ】${title}`);

  const metrics = extractMetrics(doc);
  if (metrics.length > 0) {
    parts.push(`【評価スコア・待遇データ】\n${metrics.join("\n")}`);
  }

  const reviews = extractReviews(doc);
  if (reviews.length > 0) {
    parts.push(`【社員クチコミ】\n${reviews.join("\n\n")}`);
  }

  // 構造化でほとんど拾えなかった場合は汎用抽出で全体を確保
  if (metrics.length + reviews.length < 2) {
    parts.push(`【ページ本文（汎用抽出）】\n${extractPageText(doc)}`);
  }
  return parts.join("\n\n").slice(0, 20000);
}
