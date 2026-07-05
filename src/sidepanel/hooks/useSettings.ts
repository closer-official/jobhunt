// sidepanel/hooks/useSettings.ts — ユーザー設定の読み書きフック
import { useEffect, useState } from "preact/hooks";
import { DEFAULT_SETTINGS, UserSettings } from "../../storage/schema";
import { getSettings, saveSettings } from "../../storage/settingsRepository";

export function useSettings() {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getSettings().then((s) => {
      setSettings(s);
      setLoaded(true);
    });
  }, []);

  const save = async (next: UserSettings) => {
    setSettings(next);
    await saveSettings(next);
    // リマインド時刻の変更をalarmへ反映
    chrome.runtime.sendMessage({ type: "RESCHEDULE_ALARM" }).catch(() => {});
  };

  return { settings, save, loaded };
}
