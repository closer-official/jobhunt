// storage/settingsRepository.ts — ユーザー条件・経歴データのCRUD
//
// 設計判断:
//   chrome.storage.sync は 1アイテム 8,192 bytes の制限があるため、
//   長文になりがちな userProfile（職務経歴書ベース等）は storage.local に置き、
//   軽量な scoringConditions / dailyRunTime のみ sync（端末間同期）に置く。
import {
  DEFAULT_SETTINGS,
  ScoringConditions,
  STORAGE_KEYS,
  UserProfile,
  UserSettings,
} from "./schema";

interface SyncPart {
  scoringConditions: ScoringConditions;
  dailyRunTime: string;
}

export async function getSettings(): Promise<UserSettings> {
  const [syncRes, localRes] = await Promise.all([
    chrome.storage.sync.get(STORAGE_KEYS.settingsSync),
    chrome.storage.local.get(STORAGE_KEYS.userProfile),
  ]);
  const sync = (syncRes[STORAGE_KEYS.settingsSync] as SyncPart) ?? null;
  const profile = (localRes[STORAGE_KEYS.userProfile] as UserProfile) ?? null;
  return {
    scoringConditions: sync?.scoringConditions ?? DEFAULT_SETTINGS.scoringConditions,
    dailyRunTime: sync?.dailyRunTime ?? DEFAULT_SETTINGS.dailyRunTime,
    userProfile: profile ?? DEFAULT_SETTINGS.userProfile,
  };
}

export async function saveSettings(settings: UserSettings): Promise<void> {
  const syncPart: SyncPart = {
    scoringConditions: settings.scoringConditions,
    dailyRunTime: settings.dailyRunTime,
  };
  try {
    await chrome.storage.sync.set({ [STORAGE_KEYS.settingsSync]: syncPart });
  } catch {
    // syncクォータ超過や未サインイン環境でも動作を止めない
    await chrome.storage.local.set({ [STORAGE_KEYS.settingsSync]: syncPart });
  }
  await chrome.storage.local.set({ [STORAGE_KEYS.userProfile]: settings.userProfile });
}
