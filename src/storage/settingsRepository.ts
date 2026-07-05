// storage/settingsRepository.ts — ユーザー条件・経歴データのCRUD
//
// 設計判断:
//   chrome.storage.sync は 1アイテム 8,192 bytes の制限があるため、
//   長文になりがちな userProfile（職務経歴書ベース等）は storage.local に置き、
//   軽量な scoringConditions / dailyRunTime のみ sync（端末間同期）に置く。
import { UserSettings } from "./schema";
import { pushCurrentStateToCloud } from "../cloud/snapshotSync";
import { readSettingsSnapshotLocal, writeSettingsSnapshotLocal } from "./settingsLocal";

export async function getSettings(): Promise<UserSettings> {
  return readSettingsSnapshotLocal();
}

export async function saveSettings(settings: UserSettings): Promise<void> {
  await writeSettingsSnapshotLocal({
    ...settings,
    updatedAt: settings.updatedAt ?? new Date().toISOString(),
  });
  await pushCurrentStateToCloud().catch(() => {});
}

export async function replaceSettings(settings: UserSettings): Promise<void> {
  await writeSettingsSnapshotLocal(settings);
}
