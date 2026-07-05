// content-scripts/entryList.ts — 一覧ページ抽出の注入エントリ（dist/content/list.js）
import { detectSite, isListSource } from "./parsers/parserRouter";
import { parseWantedlyList } from "./parsers/wantedlyListParser";
import { parseOnecareerList } from "./parsers/onecareerListParser";
import { parseMynaviList } from "./parsers/mynaviListParser";
import { sendResult } from "./capture/captureController";
import { JobCard } from "../storage/schema";

(() => {
  try {
    const site = detectSite(location.href);
    let cards: JobCard[] = [];
    if (site === "wantedly") cards = parseWantedlyList();
    else if (site === "onecareer") cards = parseOnecareerList();
    else if (site === "mynavi") cards = parseMynaviList();

    sendResult({
      type: "CS_LIST_RESULT",
      ok: cards.length > 0,
      cards,
      url: location.href,
      error:
        cards.length > 0
          ? undefined
          : !isListSource(site)
            ? "このページは一覧の起点にできません。Wantedlyの募集一覧 か ONE CAREERの企業一覧 を開いてください"
            : "カードを検出できませんでした（ページ構造が変わった可能性があります）",
    });
  } catch (e) {
    sendResult({
      type: "CS_LIST_RESULT",
      ok: false,
      cards: [],
      url: location.href,
      error: e instanceof Error ? e.message : String(e),
    });
  }
})();
