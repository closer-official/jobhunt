// sidepanel/components/CloudSyncPanel.tsx — Firebase同期とサインイン操作
import { CloudSyncStatus, CloudUserInfo } from "../hooks/useCloudSync";

interface Props {
  enabled: boolean;
  error: string | null;
  onSignIn: () => Promise<void>;
  onSignOut: () => Promise<void>;
  onSyncNow: () => Promise<void>;
  status: CloudSyncStatus;
  user: CloudUserInfo | null;
}

const STATUS_LABEL: Record<CloudSyncStatus, string> = {
  disabled: "未設定",
  loading: "接続確認中",
  signed_out: "未サインイン",
  signed_in: "同期済み",
  syncing: "同期中",
  error: "エラー",
};

export function CloudSyncPanel({
  enabled,
  error,
  onSignIn,
  onSignOut,
  onSyncNow,
  status,
  user,
}: Props) {
  return (
    <section class="cloud-sync">
      <h2>Firebase 同期</h2>
      <p class="hint">
        サインインすると、設定と企業データを Firebase に保存して端末間で共有できます。
      </p>
      <p class="hint">
        状態: <strong>{enabled ? STATUS_LABEL[status] : STATUS_LABEL.disabled}</strong>
        {user?.email ? <span> / {user.email}</span> : null}
      </p>
      {error && <p class="hint hint--error">{error}</p>}

      <div class="sync-actions">
        <button class="btn btn--sub" onClick={onSignIn} disabled={!enabled || status === "loading" || status === "syncing"}>
          Googleでサインイン
        </button>
        <button class="btn btn--sub" onClick={onSyncNow} disabled={!enabled || status === "loading" || status === "syncing"}>
          今すぐ同期
        </button>
        <button class="btn btn--danger" onClick={onSignOut} disabled={!enabled || status === "loading" || !user}>
          サインアウト
        </button>
      </div>
    </section>
  );
}
