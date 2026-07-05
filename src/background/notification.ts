// background/notification.ts — chrome.notifications 発火処理
export function notifyDailyResearch(): void {
  chrome.notifications.create(`daily_${Date.now()}`, {
    type: "basic",
    iconUrl: "icons/icon128.png",
    title: "本日のリサーチ時間です",
    message:
      "Indeed/マイナビの検索結果を開き、サイドパネルの「本日のリサーチ開始」を押してください。",
    priority: 2,
  });
}
