// content-scripts/capture/captureController.ts
// 注入スクリプト共通: 実行結果を background へ返すユーティリティ
import { CsMessage } from "../../storage/schema";

export function sendResult(msg: CsMessage): void {
  try {
    chrome.runtime.sendMessage(msg);
  } catch {
    // 拡張がリロードされた直後などは失敗しうるが、リトライは background 側で行う
  }
}

/** 注入スクリプトの実行を安全にラップする */
export function runCapture(fn: () => CsMessage): void {
  try {
    sendResult(fn());
  } catch (e) {
    sendResult({
      type: "CS_PAGE_RESULT",
      ok: false,
      text: "",
      title: document.title,
      url: location.href,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}
