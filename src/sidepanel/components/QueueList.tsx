// sidepanel/components/QueueList.tsx — 候補企業のリスト表示
import { CompanyRecord, UserProfile } from "../../storage/schema";
import { CompanyCard } from "./CompanyCard";

interface Props {
  companies: CompanyRecord[];
  profile: UserProfile;
  onToast: (msg: string) => void;
  onChanged: () => void;
}

export function QueueList({ companies, profile, onToast, onChanged }: Props) {
  if (companies.length === 0) {
    return (
      <div class="empty">
        <p>まだ候補企業がありません。</p>
        <p>
          Wantedlyの募集一覧（または ONE CAREERの企業一覧）を開いた状態で
          <strong>「本日のリサーチ開始」</strong>を押すと、条件に合う上位10件がここに並びます。
        </p>
        <p>先に「はじめに」タブで、自分の情報も入れておくとES作成が進めやすくなります。</p>
      </div>
    );
  }
  return (
    <div class="queue">
      {companies.map((c) => (
        <CompanyCard
          key={c.companyId}
          record={c}
          profile={profile}
          onToast={onToast}
          onChanged={onChanged}
        />
      ))}
    </div>
  );
}
