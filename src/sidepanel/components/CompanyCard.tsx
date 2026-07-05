// sidepanel/components/CompanyCard.tsx
// 個別企業カード。OS①〜④の進捗レール、キャプチャ操作、各ステップのパネルを持つ。
import { useState } from "preact/hooks";
import { CompanyRecord, CompanyStatus, UserProfile } from "../../storage/schema";
import { StepKey } from "../../prompts/promptBuilder";
import { deleteCompany } from "../../storage/companyRepository";
import { StepPromptPanel } from "./StepPromptPanel";
import { CaptureStatusBadge } from "./CaptureStatusBadge";

const STATUS_LABEL: Record<CompanyStatus, string> = {
  queued: "未着手",
  researching: "リサーチ中",
  ready_for_es: "ES作成可能",
  done: "完了",
};

const STEPS: { key: StepKey; short: string }[] = [
  { key: "research", short: "①研究" },
  { key: "schedule", short: "②日程" },
  { key: "idealProfile", short: "③人物像" },
  { key: "esDraft", short: "④ES" },
];

interface Props {
  record: CompanyRecord;
  profile: UserProfile;
  onToast: (msg: string) => void;
  onChanged: () => void;
}

export function CompanyCard({ record, profile, onToast, onChanged }: Props) {
  const [open, setOpen] = useState(false);
  const [activeStep, setActiveStep] = useState<StepKey | null>(null);
  const [capturing, setCapturing] = useState(false);

  const esLocked =
    !record.research || !record.schedule || !record.idealProfile;

  const captureTab = async () => {
    setCapturing(true);
    try {
      const res = await chrome.runtime.sendMessage({
        type: "CAPTURE_ACTIVE_TAB",
        companyId: record.companyId,
      });
      onToast(res?.message ?? "キャプチャに失敗しました");
      onChanged();
    } finally {
      setCapturing(false);
    }
  };

  const remove = async () => {
    if (!confirm(`「${record.companyName}」を削除しますか?`)) return;
    await deleteCompany(record.companyId);
    onToast("削除しました");
    onChanged();
  };

  return (
    <article class={`card status-${record.status}`}>
      <button class="card__head" onClick={() => setOpen(!open)}>
        <div class="card__title-row">
          <span class="card__name">{record.companyName}</span>
          <span class={`badge badge--${record.status}`}>{STATUS_LABEL[record.status]}</span>
        </div>
        <div class="card__meta">
          {record.jobTitle && <span>{record.jobTitle}</span>}
          <span class="card__score">score {record.matchScore}</span>
        </div>
        {/* OSステップの進捗レール */}
        <div class="rail" aria-label="進捗">
          {STEPS.map((s) => (
            <span
              key={s.key}
              class={`rail__step ${record[s.key] ? "is-done" : ""}`}
              title={s.short}
            >
              {s.short}
            </span>
          ))}
        </div>
      </button>

      {open && (
        <div class="card__body">
          <div class="card__capture">
            <div class="card__capture-row">
              <span class="cap-count">取込済ページ: {record.capturedTexts.length}</span>
              <CaptureStatusBadge record={record} />
            </div>
            <button class="btn btn--sub" onClick={captureTab} disabled={capturing}>
              {capturing ? "取込中…" : "いま開いているタブを取り込む"}
            </button>
            {record.capturedTexts.length === 0 && (
              <p class="hint">
                求人詳細の自動取得に失敗した場合は、求人ページや公式HP・noteを開いてから上のボタンで取り込んでください。
              </p>
            )}
            {record.capturedTexts.length > 0 && (
              <details class="captured-list">
                <summary>取り込んだページ一覧</summary>
                <ul>
                  {record.capturedTexts.map((c) => (
                    <li key={c.url}>
                      <a href={c.url} target="_blank" rel="noreferrer">
                        {c.label || c.url}
                      </a>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>

          <div class="card__steps">
            {STEPS.map((s) => {
              const locked = s.key === "esDraft" && esLocked;
              return (
                <button
                  key={s.key}
                  class={`step-tab ${activeStep === s.key ? "is-active" : ""} ${record[s.key] ? "is-done" : ""}`}
                  disabled={locked}
                  title={locked ? "①〜③をすべて反映するとES作成が使えます" : ""}
                  onClick={() => setActiveStep(activeStep === s.key ? null : s.key)}
                >
                  {s.short}
                </button>
              );
            })}
          </div>

          {activeStep && (
            <StepPromptPanel
              record={record}
              step={activeStep}
              profile={profile}
              onToast={onToast}
              onSaved={onChanged}
            />
          )}

          <button class="btn btn--danger" onClick={remove}>
            この企業を削除
          </button>
        </div>
      )}
    </article>
  );
}
