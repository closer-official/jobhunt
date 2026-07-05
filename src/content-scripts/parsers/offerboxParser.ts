// content-scripts/parsers/offerboxParser.ts
// OfferBox 用の予約枠。現時点では未対応（ユーザー環境で閲覧不可のため）。
// 対応時の想定:
//   - スカウト一覧 → JobCard[] へ変換して OS⓪ に流す（parseOfferboxList）
//   - スカウト詳細/企業ページ → キャプチャ用テキスト抽出（parseOfferboxDetail）
// 実装したら parserRouter の isListSource / entryList / entryPage に配線するだけで組み込める。
import { JobCard } from "../../storage/schema";
import { extractPageText } from "../capture/extractPageText";

export function parseOfferboxList(_doc: Document = document): JobCard[] {
  return []; // TODO: OfferBox対応時に実装（実DOMサンプル入手後）
}

export function parseOfferboxDetail(doc: Document = document): string {
  // 暫定: 汎用抽出でしのぐ（キャプチャボタン経由なら現時点でも使える）
  return extractPageText(doc);
}
