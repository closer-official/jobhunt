// sidepanel/components/HomePanel.tsx — 初回導線と全体の役割整理
import { CloudSyncStatus, CloudUserInfo } from "../hooks/useCloudSync";
import { UserSettings } from "../../storage/schema";

interface Props {
  companiesCount: number;
  onStartResearch: () => void;
  onGoToProfile: () => void;
  onGoToQueue: () => void;
  cloudEnabled: boolean;
  cloudStatus: CloudSyncStatus;
  cloudUser: CloudUserInfo | null;
  settings: UserSettings;
}

const STATUS_LABEL: Record<CloudSyncStatus, string> = {
  disabled: "未設定",
  loading: "接続確認中",
  signed_out: "未サインイン",
  signed_in: "同期済み",
  syncing: "同期中",
  error: "エラー",
};

function doneCount(settings: UserSettings) {
  return [
    settings.userProfile.basicProfile,
    settings.userProfile.schoolCareer,
    settings.userProfile.targetDirection,
    settings.userProfile.workPreferences,
    settings.userProfile.resumeBase,
    settings.userProfile.strengthsSummary,
  ].filter(Boolean).length;
}

export function HomePanel({
  companiesCount,
  onStartResearch,
  onGoToProfile,
  onGoToQueue,
  cloudEnabled,
  cloudStatus,
  cloudUser,
  settings,
}: Props) {
  const profileFilled = doneCount(settings);
  const readyForEs = Boolean(
    settings.userProfile.resumeBase.trim() && settings.userProfile.strengthsSummary.trim()
  );

  return (
    <div class="home">
      <section class="home__hero">
        <p class="home__eyebrow">はじめに</p>
        <h2>何を入れて、何を作るかを先に見せる画面です</h2>
        <p class="hint">
          このアプリは「企業を集める」だけでなく、
          「自分の情報をためる」→「企業ごとのESを作る」まで流せるようにしています。
        </p>
      </section>

      <section class="home__cards">
        <article class="home-card">
          <div class="home-card__head">
            <h3>1. 自分の情報を入れる</h3>
            <span class="home-card__meta">{profileFilled}/6</span>
          </div>
          <p class="hint">
            学歴・活動・志望の方向性・働き方の希望を先に入れると、ES作成が一気に楽になります。
          </p>
          <button class="btn btn--sub" onClick={onGoToProfile}>プロフィールを入力する</button>
        </article>

        <article class="home-card">
          <div class="home-card__head">
            <h3>2. 企業を集める</h3>
            <span class="home-card__meta">{companiesCount}件</span>
          </div>
          <p class="hint">
            募集一覧や企業一覧を開いた状態でリサーチを始めると、候補がここに並びます。
          </p>
          <button class="btn btn--primary" onClick={onStartResearch}>本日のリサーチ開始</button>
          <button class="btn btn--sub" onClick={onGoToQueue}>企業リストを見る</button>
        </article>

        <article class="home-card">
          <div class="home-card__head">
            <h3>3. ESを作る</h3>
            <span class="home-card__meta">{readyForEs ? "準備OK" : "未準備"}</span>
          </div>
          <p class="hint">
            ①企業研究 ②選考日程 ③人物像 をそろえると、④ES作成のプロンプトが開けます。
          </p>
          <p class="hint">企業カードを開いて、①〜④を順に反映していく流れです。</p>
        </article>
      </section>

      <section class="home__status">
        <h3>いまの状態</h3>
        <div class="home__status-grid">
          <div class="status-pill">
            <span>Firebase</span>
            <strong>{cloudEnabled ? STATUS_LABEL[cloudStatus] : STATUS_LABEL.disabled}</strong>
          </div>
          <div class="status-pill">
            <span>サインイン</span>
            <strong>{cloudUser?.email ?? "未接続"}</strong>
          </div>
          <div class="status-pill">
            <span>候補企業</span>
            <strong>{companiesCount}件</strong>
          </div>
        </div>
      </section>
    </div>
  );
}
