// content-scripts/parsers/parserRouter.ts
// URLパターンからどのparser系統を使うか判定するだけの薄いルーター
import { SourceSite } from "../../storage/schema";

export function detectSite(url: string): SourceSite {
  try {
    const host = new URL(url).hostname;
    if (/(^|\.)wantedly\.com$/.test(host)) return "wantedly";
    if (/(^|\.)onecareer\.jp$/.test(host)) return "onecareer";
    if (/(^|\.)(openwork\.jp|vorkers\.com)$/.test(host)) return "openwork";
    if (/(^|\.)offerbox\.jp$/.test(host)) return "offerbox"; // 予約枠（parser未実装）
    if (/(^|\.)mynavi\./.test(host)) return "mynavi";
  } catch {
    /* URLパース失敗はunknown扱い */
  }
  return "unknown";
}

/** OS⓪（一覧スコアリング）の起点にできるサイトか */
export function isListSource(site: SourceSite): boolean {
  return site === "wantedly" || site === "onecareer" || site === "mynavi";
}
