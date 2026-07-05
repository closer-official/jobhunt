// content-scripts/entryPage.ts — 「このタブをキャプチャ」の注入エントリ（dist/content/page.js）
// OpenWork / ONE CAREER は専用パーサーで構造化キャプチャ、それ以外は汎用抽出。
import { detectSite } from "./parsers/parserRouter";
import { parseOpenwork } from "./parsers/openworkParser";
import { parseOnecareerExperience } from "./parsers/onecareerExperienceParser";
import { parseGenericPage } from "./parsers/genericParser";
import { runCapture } from "./capture/captureController";

runCapture(() => {
  const site = detectSite(location.href);
  let text: string;
  let title = document.title;
  if (site === "openwork") {
    text = parseOpenwork();
    title = `OpenWork口コミ: ${document.title}`;
  } else if (site === "onecareer") {
    text = parseOnecareerExperience();
    title = `ONE CAREER選考情報: ${document.title}`;
  } else {
    const g = parseGenericPage();
    text = g.text;
    title = g.title || title;
  }
  return {
    type: "CS_PAGE_RESULT",
    ok: text.trim().length > 0,
    text,
    title,
    url: location.href,
    error: text.trim().length > 0 ? undefined : "本文を抽出できませんでした",
  };
});
