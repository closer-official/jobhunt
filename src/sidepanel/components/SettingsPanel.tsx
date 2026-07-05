// sidepanel/components/SettingsPanel.tsx — 条件設定・経歴データ入力画面
import { useEffect, useState } from "preact/hooks";
import { UserSettings } from "../../storage/schema";

interface Props {
  settings: UserSettings;
  onSave: (s: UserSettings) => Promise<void>;
  onToast: (msg: string) => void;
}

const toList = (s: string) =>
  s.split(/[、,\n]/).map((x) => x.trim()).filter(Boolean);
const toText = (l: string[]) => l.join(", ");

export function SettingsPanel({ settings, onSave, onToast }: Props) {
  const [form, setForm] = useState({
    industries: toText(settings.scoringConditions.industries),
    jobTitles: toText(settings.scoringConditions.jobTitles),
    locations: toText(settings.scoringConditions.locations),
    priorityKeywords: toText(settings.scoringConditions.priorityKeywords),
    excludeKeywords: toText(settings.scoringConditions.excludeKeywords),
    dailyRunTime: settings.dailyRunTime,
    resumeBase: settings.userProfile.resumeBase,
    strengthsSummary: settings.userProfile.strengthsSummary,
  });

  useEffect(() => {
    setForm({
      industries: toText(settings.scoringConditions.industries),
      jobTitles: toText(settings.scoringConditions.jobTitles),
      locations: toText(settings.scoringConditions.locations),
      priorityKeywords: toText(settings.scoringConditions.priorityKeywords),
      excludeKeywords: toText(settings.scoringConditions.excludeKeywords),
      dailyRunTime: settings.dailyRunTime,
      resumeBase: settings.userProfile.resumeBase,
      strengthsSummary: settings.userProfile.strengthsSummary,
    });
  }, [settings]);

  const set = (key: keyof typeof form) => (e: Event) =>
    setForm({ ...form, [key]: (e.target as HTMLInputElement).value });

  const save = async () => {
    await onSave({
      scoringConditions: {
        industries: toList(form.industries),
        jobTitles: toList(form.jobTitles),
        locations: toList(form.locations),
        priorityKeywords: toList(form.priorityKeywords),
        excludeKeywords: toList(form.excludeKeywords),
      },
      dailyRunTime: form.dailyRunTime || "09:00",
      userProfile: {
        resumeBase: form.resumeBase,
        strengthsSummary: form.strengthsSummary,
      },
    });
    onToast("設定を保存しました");
  };

  return (
    <div class="settings">
      <section>
        <h2>スコアリング条件</h2>
        <p class="hint">カンマ・読点・改行区切りで複数指定できます。</p>
        <label>職種キーワード（タイトル一致+3 / 本文一致+1）
          <input value={form.jobTitles} onInput={set("jobTitles")} placeholder="例: 企画, PM, Webディレクター" />
        </label>
        <label>優先キーワード（1語につき+2）
          <input value={form.priorityKeywords} onInput={set("priorityKeywords")} placeholder="例: リモート, 新規事業" />
        </label>
        <label>業界キーワード（1語につき+1）
          <input value={form.industries} onInput={set("industries")} placeholder="例: IT, Web, SaaS" />
        </label>
        <label>勤務地（一致で+2）
          <input value={form.locations} onInput={set("locations")} placeholder="例: 東京, 大阪, フルリモート" />
        </label>
        <label>除外キーワード（含む求人は除外）
          <input value={form.excludeKeywords} onInput={set("excludeKeywords")} placeholder="例: 夜勤, 訪問販売" />
        </label>
      </section>

      <section>
        <h2>毎日のリマインド時刻</h2>
        <input type="time" value={form.dailyRunTime} onInput={set("dailyRunTime")} />
      </section>

      <section>
        <h2>経歴データ（ES作成④で使用）</h2>
        <label>職務経歴書のベース情報
          <textarea rows={8} value={form.resumeBase} onInput={set("resumeBase")}
            placeholder="学歴・職歴・担当業務・実績（数字入り）を貼り付け" />
        </label>
        <label>自己PR・強みの要約
          <textarea rows={5} value={form.strengthsSummary} onInput={set("strengthsSummary")}
            placeholder="訴求したい強みの軸（例: 課題発見→仮説設計→システム化→現場実行）" />
        </label>
      </section>

      <button class="btn btn--primary" onClick={save}>設定を保存</button>
      <p class="hint">条件と時刻は端末間で同期されます。経歴データはこの端末にのみ保存されます。</p>
    </div>
  );
}
