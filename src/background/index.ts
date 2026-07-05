// background/index.ts — Service Worker エントリポイント
// ここはルーティングのみを担当し、ロジックは各モジュールに委譲する。
import { DAILY_ALARM_NAME, scheduleDailyAlarm } from "./alarmScheduler";
import { notifyDailyResearch } from "./notification";
import {
  captureExistingTab,
  deliverCsResult,
  fetchDetailsSequentially,
} from "./tabOrchestrator";
import { selectTopCandidates } from "../scoring/scoringEngine";
import {
  newCompanyId,
  pruneOldRecords,
  saveCompany,
  updateCompany,
} from "../storage/companyRepository";
import { getSettings } from "../storage/settingsRepository";
import { detectSite, isListSource } from "../content-scripts/parsers/parserRouter";
import { BgMessage, BgResponse, CompanyRecord, CsMessage } from "../storage/schema";

// ---- 初期化 ----
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
  scheduleDailyAlarm();
  pruneOldRecords().catch(() => {});
});
chrome.runtime.onStartup.addListener(() => {
  scheduleDailyAlarm();
});

// ---- アラーム ----
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === DAILY_ALARM_NAME) notifyDailyResearch();
});

// ---- メッセージルーティング ----
chrome.runtime.onMessage.addListener((msg: BgMessage | CsMessage, sender, sendResponse) => {
  // content scriptからの抽出結果 → orchestratorへ配送
  const tabId = sender.tab?.id;
  if (tabId != null && "type" in msg && msg.type.startsWith("CS_")) {
    deliverCsResult(tabId, msg as CsMessage);
    return false;
  }

  if (msg.type === "START_DAILY_RESEARCH") {
    handleStartResearch().then(sendResponse);
    return true; // 非同期応答
  }
  if (msg.type === "CAPTURE_ACTIVE_TAB") {
    handleCaptureActiveTab(msg.companyId, msg.label).then(sendResponse);
    return true;
  }
  if (msg.type === "RESCHEDULE_ALARM") {
    scheduleDailyAlarm().then(() => sendResponse({ ok: true, message: "リマインド時刻を更新しました" }));
    return true;
  }
  return false;
});

// ---- OS⓪: 候補抽出 → スコアリング → 詳細自動取得 ----
async function handleStartResearch(): Promise<BgResponse> {
  const [activeTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!activeTab?.id || !activeTab.url) {
    return { ok: false, message: "アクティブなタブが見つかりません" };
  }
  if (!isListSource(detectSite(activeTab.url))) {
    return {
      ok: false,
      message: "Wantedlyの募集一覧 か ONE CAREERの企業一覧 を開いた状態で実行してください",
    };
  }

  let listResult: CsMessage;
  try {
    listResult = await captureExistingTab(activeTab.id, "content/list.js");
  } catch (e) {
    return { ok: false, message: `一覧の読み取りに失敗: ${e instanceof Error ? e.message : e}` };
  }
  if (listResult.type !== "CS_LIST_RESULT" || !listResult.ok) {
    return {
      ok: false,
      message: (listResult.type === "CS_LIST_RESULT" && listResult.error) || "求人カードを検出できませんでした",
    };
  }

  const settings = await getSettings();
  const top = selectTopCandidates(listResult.cards, settings.scoringConditions);
  if (top.length === 0) {
    return { ok: false, message: "条件に合う求人が見つかりませんでした（設定画面で条件を確認してください）" };
  }

  // CompanyRecordとして保存（status: queued）
  const now = new Date().toISOString();
  const site = detectSite(activeTab.url);
  const records: CompanyRecord[] = top.map((s) => ({
    companyId: newCompanyId(),
    companyName: s.card.companyName,
    sourceSite: site,
    listingUrl: s.card.detailUrl,
    matchScore: s.score,
    status: "queued",
    jobTitle: s.card.jobTitle,
    location: s.card.location,
    salary: s.card.salary,
    createdAt: now,
    capturedTexts: [],
    research: null,
    schedule: null,
    idealProfile: null,
    esDraft: null,
  }));
  for (const r of records) await saveCompany(r);

  // 詳細ページをバックグラウンドで順次取得（awaitしない: パネルには即応答を返す）
  runDetailFetch(records).catch(() => {});

  return { ok: true, message: `${records.length}件をキューに追加しました。詳細ページを順番に自動取得します…` };
}

async function runDetailFetch(records: CompanyRecord[]): Promise<void> {
  await fetchDetailsSequentially(
    records.map((r) => ({
      companyName: r.companyName,
      jobTitle: r.jobTitle ?? "",
      location: r.location ?? "",
      salary: r.salary ?? "",
      detailUrl: r.listingUrl,
      snippet: "",
    })),
    async (result, index) => {
      const rec = records[index];
      if (result.ok) {
        await updateCompany(rec.companyId, (cur) => ({
          ...cur,
          status: "researching",
          capturedTexts: [
            ...cur.capturedTexts,
            {
              url: rec.listingUrl,
              capturedAt: new Date().toISOString(),
              rawText: result.text,
              label: rec.sourceSite === "onecareer" ? "ONE CAREER企業ページ" : "募集詳細",
            },
          ],
        }));
      } else {
        await updateCompany(rec.companyId, { status: "researching" });
        // 失敗はレコードに残す（UI側でキャプチャ0件として見える）
      }
    }
  );
}

// ---- 任意タブのキャプチャ（公式HP / note等） ----
async function handleCaptureActiveTab(companyId: string, label?: string): Promise<BgResponse> {
  const [activeTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!activeTab?.id || !activeTab.url) {
    return { ok: false, message: "アクティブなタブが見つかりません" };
  }
  if (/^chrome(-extension)?:\/\//.test(activeTab.url)) {
    return { ok: false, message: "このページはキャプチャできません（Chrome内部ページ）" };
  }

  let result: CsMessage;
  try {
    result = await captureExistingTab(activeTab.id, "content/page.js");
  } catch (e) {
    return { ok: false, message: `キャプチャ失敗: ${e instanceof Error ? e.message : e}` };
  }
  if (result.type !== "CS_PAGE_RESULT" || !result.ok) {
    return { ok: false, message: (result.type === "CS_PAGE_RESULT" && result.error) || "本文を抽出できませんでした" };
  }

  const updated = await updateCompany(companyId, (cur) => ({
    ...cur,
    capturedTexts: [
      // 同一URLの再キャプチャは上書き
      ...cur.capturedTexts.filter((c) => c.url !== result.url),
      {
        url: result.url,
        capturedAt: new Date().toISOString(),
        rawText: result.text,
        label: label || result.title.slice(0, 30),
      },
    ],
  }));
  if (!updated) return { ok: false, message: "企業レコードが見つかりません" };
  return { ok: true, message: `「${updated.companyName}」に取り込みました（計${updated.capturedTexts.length}ページ）` };
}
