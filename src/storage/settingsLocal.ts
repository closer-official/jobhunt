// storage/settingsLocal.ts — 設定データのローカルCRUD共通処理
import { DEFAULT_SETTINGS, STORAGE_KEYS, UserProfile, UserSettings } from "./schema";

interface SyncPart {
  scoringConditions: UserSettings["scoringConditions"];
  dailyRunTime: string;
  updatedAt?: string;
}

export async function readSettingsSnapshotLocal(): Promise<UserSettings> {
  const [syncRes, localRes] = await Promise.all([
    chrome.storage.sync.get(STORAGE_KEYS.settingsSync),
    chrome.storage.local.get(STORAGE_KEYS.userProfile),
  ]);
  const sync = (syncRes[STORAGE_KEYS.settingsSync] as SyncPart) ?? null;
  const profile = (localRes[STORAGE_KEYS.userProfile] as Partial<UserProfile> | null) ?? null;
  return {
    scoringConditions: sync?.scoringConditions ?? DEFAULT_SETTINGS.scoringConditions,
    dailyRunTime: sync?.dailyRunTime ?? DEFAULT_SETTINGS.dailyRunTime,
    userProfile: {
      ...DEFAULT_SETTINGS.userProfile,
      ...profile,
    },
    updatedAt: sync?.updatedAt,
  };
}

export async function writeSettingsSnapshotLocal(settings: UserSettings): Promise<void> {
  const userProfile: UserProfile = {
    ...DEFAULT_SETTINGS.userProfile,
    ...settings.userProfile,
  };
  const syncPart: SyncPart = {
    scoringConditions: settings.scoringConditions,
    dailyRunTime: settings.dailyRunTime,
    updatedAt: settings.updatedAt,
  };
  try {
    await chrome.storage.sync.set({ [STORAGE_KEYS.settingsSync]: syncPart });
  } catch {
    await chrome.storage.local.set({ [STORAGE_KEYS.settingsSync]: syncPart });
  }
  await chrome.storage.local.set({ [STORAGE_KEYS.userProfile]: userProfile });
}
