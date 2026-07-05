// background/tabOrchestrator.ts
// バックグラウンドタブの自動オープン・注入・結果回収・クローズの順次処理制御。
// ブラウザ負荷を抑えるため同時1タブの逐次処理とし、失敗時は1回リトライする。
import { CsMessage, JobCard } from "../storage/schema";

const PAGE_LOAD_TIMEOUT_MS = 25000;
const RESULT_TIMEOUT_MS = 15000;
const RETRY_COUNT = 1;
const WAIT_BETWEEN_TABS_MS = 1500; // 連続アクセスでサイトに負荷をかけないための間隔

// tabId -> 結果待ちresolver
const pendingResults = new Map<number, (msg: CsMessage) => void>();

/** content scriptから届いた結果を待機中のPromiseへ配送する（index.tsから呼ばれる） */
export function deliverCsResult(tabId: number, msg: CsMessage): boolean {
  const resolver = pendingResults.get(tabId);
  if (!resolver) return false;
  pendingResults.delete(tabId);
  resolver(msg);
  return true;
}

function waitForTabComplete(tabId: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("ページ読み込みがタイムアウトしました"));
    }, PAGE_LOAD_TIMEOUT_MS);

    const onUpdated = (id: number, info: chrome.tabs.OnUpdatedInfo) => {
      if (id === tabId && info.status === "complete") {
        cleanup();
        // SPA等の描画待ちで少し余裕を持たせる
        setTimeout(resolve, 1200);
      }
    };
    const onRemoved = (id: number) => {
      if (id === tabId) {
        cleanup();
        reject(new Error("タブが閉じられました"));
      }
    };
    const cleanup = () => {
      clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(onUpdated);
      chrome.tabs.onRemoved.removeListener(onRemoved);
    };
    chrome.tabs.onUpdated.addListener(onUpdated);
    chrome.tabs.onRemoved.addListener(onRemoved);

    // 既にcompleteの場合を取りこぼさない
    chrome.tabs.get(tabId).then((tab) => {
      if (tab.status === "complete") {
        cleanup();
        setTimeout(resolve, 1200);
      }
    }).catch(() => {/* onRemovedで拾う */});
  });
}

function waitForResult(tabId: number): Promise<CsMessage> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingResults.delete(tabId);
      reject(new Error("抽出結果の受信がタイムアウトしました"));
    }, RESULT_TIMEOUT_MS);
    pendingResults.set(tabId, (msg) => {
      clearTimeout(timer);
      resolve(msg);
    });
  });
}

async function injectAndCollect(tabId: number, scriptFile: string): Promise<CsMessage> {
  const resultPromise = waitForResult(tabId);
  await chrome.scripting.executeScript({ target: { tabId }, files: [scriptFile] });
  return resultPromise;
}

/** 既存タブ（ユーザーが開いているタブ）にスクリプトを注入して結果を得る */
export async function captureExistingTab(tabId: number, scriptFile: string): Promise<CsMessage> {
  return injectAndCollect(tabId, scriptFile);
}

/** URLをバックグラウンドタブで開いて詳細を抽出し、タブを閉じて結果を返す */
async function fetchDetailOnce(url: string): Promise<CsMessage> {
  const tab = await chrome.tabs.create({ url, active: false });
  const tabId = tab.id;
  if (tabId == null) throw new Error("タブの作成に失敗しました");
  try {
    await waitForTabComplete(tabId);
    return await injectAndCollect(tabId, "content/detail.js");
  } finally {
    pendingResults.delete(tabId);
    chrome.tabs.remove(tabId).catch(() => {/* 既に閉じている */});
  }
}

export interface DetailFetchResult {
  card: JobCard;
  ok: boolean;
  text: string;
  error?: string;
}

/**
 * 上位候補の求人詳細ページを1件ずつバックグラウンドで開いて本文を取得する。
 * onProgress で1件完了ごとに呼び出し元（保存処理・UI更新）へ通知する。
 */
export async function fetchDetailsSequentially(
  cards: JobCard[],
  onProgress: (result: DetailFetchResult, index: number, total: number) => Promise<void>
): Promise<void> {
  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    let result: DetailFetchResult = { card, ok: false, text: "", error: "未実行" };

    for (let attempt = 0; attempt <= RETRY_COUNT; attempt++) {
      try {
        const msg = await fetchDetailOnce(card.detailUrl);
        if (msg.type === "CS_DETAIL_RESULT" && msg.ok) {
          result = { card, ok: true, text: msg.text };
          break;
        }
        result = {
          card, ok: false, text: "",
          error: msg.type === "CS_DETAIL_RESULT" ? msg.error : "想定外の応答",
        };
      } catch (e) {
        result = { card, ok: false, text: "", error: e instanceof Error ? e.message : String(e) };
      }
      if (attempt < RETRY_COUNT) await new Promise((r) => setTimeout(r, 2000));
    }

    await onProgress(result, i, cards.length);
    if (i < cards.length - 1) await new Promise((r) => setTimeout(r, WAIT_BETWEEN_TABS_MS));
  }
}
