// content-scripts/entryDetail.ts — 詳細ページ抽出の注入エントリ（dist/content/detail.js）
import { detectSite } from "./parsers/parserRouter";
import { parseMynaviDetail } from "./parsers/mynaviDetailParser";
import { parseOpenwork } from "./parsers/openworkParser";
import { parseOnecareerExperience } from "./parsers/onecareerExperienceParser";
import { parseGenericPage } from "./parsers/genericParser";
import { sendResult } from "./capture/captureController";

(() => {
  try {
    const site = detectSite(location.href);
    let text: string;
    switch (site) {
      case "onecareer":
        text = parseOnecareerExperience();
        break;
      case "openwork":
        text = parseOpenwork();
        break;
      case "mynavi":
        text = parseMynaviDetail();
        break;
      default: {
        // Wantedly募集詳細を含む汎用: タイトル+本文
        const { title, text: body } = parseGenericPage();
        text = title ? `【ページタイトル】${title}\n\n${body}` : body;
      }
    }

    sendResult({
      type: "CS_DETAIL_RESULT",
      ok: text.trim().length > 50,
      text,
      url: location.href,
      error: text.trim().length > 50 ? undefined : "本文をほとんど抽出できませんでした",
    });
  } catch (e) {
    sendResult({
      type: "CS_DETAIL_RESULT",
      ok: false,
      text: "",
      url: location.href,
      error: e instanceof Error ? e.message : String(e),
    });
  }
})();
