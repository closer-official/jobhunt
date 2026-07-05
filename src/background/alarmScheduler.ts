// background/alarmScheduler.ts — chrome.alarms の登録・発火処理
import { getSettings } from "../storage/settingsRepository";

export const DAILY_ALARM_NAME = "dailyResearchReminder";

/** "HH:MM" を次の発火時刻(ms)に変換する。今日の時刻を過ぎていれば翌日。 */
function nextFireTime(hhmm: string): number {
  const [h, m] = hhmm.split(":").map((n) => parseInt(n, 10));
  const now = new Date();
  const next = new Date(now);
  next.setHours(Number.isFinite(h) ? h : 9, Number.isFinite(m) ? m : 0, 0, 0);
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
  return next.getTime();
}

export async function scheduleDailyAlarm(): Promise<void> {
  const settings = await getSettings();
  await chrome.alarms.clear(DAILY_ALARM_NAME);
  chrome.alarms.create(DAILY_ALARM_NAME, {
    when: nextFireTime(settings.dailyRunTime),
    periodInMinutes: 24 * 60,
  });
}
