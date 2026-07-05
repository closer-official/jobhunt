// sidepanel/index.tsx — Side Panel エントリポイント
import { render } from "preact";
import { useState } from "preact/hooks";
import { useCompanyQueue } from "./hooks/useCompanyQueue";
import { useSettings } from "./hooks/useSettings";
import { QueueList } from "./components/QueueList";
import { SettingsPanel } from "./components/SettingsPanel";

type Tab = "queue" | "settings";

function App() {
  const { companies, reload } = useCompanyQueue();
  const { settings, save, loaded } = useSettings();
  const [tab, setTab] = useState<Tab>("queue");
  const [toast, setToast] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const startResearch = async () => {
    setRunning(true);
    try {
      const res = await chrome.runtime.sendMessage({ type: "START_DAILY_RESEARCH" });
      showToast(res?.message ?? "実行に失敗しました");
      reload();
    } catch {
      showToast("バックグラウンド処理との通信に失敗しました。拡張を再読み込みしてください");
    } finally {
      setRunning(false);
    }
  };

  if (!loaded) return <div class="loading">読み込み中…</div>;

  return (
    <div class="app">
      <header class="app__header">
        <h1>就活OS</h1>
        <button class="btn btn--primary" onClick={startResearch} disabled={running}>
          {running ? "抽出中…" : "本日のリサーチ開始"}
        </button>
      </header>

      <nav class="tabs">
        <button class={tab === "queue" ? "is-active" : ""} onClick={() => setTab("queue")}>
          キュー（{companies.length}）
        </button>
        <button class={tab === "settings" ? "is-active" : ""} onClick={() => setTab("settings")}>
          設定
        </button>
      </nav>

      <main class="app__main">
        {tab === "queue" ? (
          <QueueList
            companies={companies}
            profile={settings.userProfile}
            onToast={showToast}
            onChanged={reload}
          />
        ) : (
          <SettingsPanel settings={settings} onSave={save} onToast={showToast} />
        )}
      </main>

      {toast && <div class="toast" role="status">{toast}</div>}
    </div>
  );
}

render(<App />, document.getElementById("root")!);
