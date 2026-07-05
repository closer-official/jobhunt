// sidepanel/components/StepPromptPanel.tsx
// OS①〜④共通: 「プロンプトをコピー」→（AIで実行）→「出力を貼り付け」→「反映」
import { useState } from "preact/hooks";
import { CompanyRecord, UserProfile } from "../../storage/schema";
import { buildPrompt, StepKey, STEP_LABELS } from "../../prompts/promptBuilder";
import { updateCompany } from "../../storage/companyRepository";

interface Props {
  record: CompanyRecord;
  step: StepKey;
  profile: UserProfile;
  onToast: (msg: string) => void;
  onSaved: () => void;
}

function nextStatus(rec: CompanyRecord): CompanyRecord["status"] {
  if (rec.esDraft) return "done";
  if (rec.research && rec.schedule && rec.idealProfile) return "ready_for_es";
  if (rec.capturedTexts.length > 0 || rec.research || rec.schedule || rec.idealProfile) {
    return "researching";
  }
  return "queued";
}

export function StepPromptPanel({ record, step, profile, onToast, onSaved }: Props) {
  const [pasted, setPasted] = useState("");
  const [copying, setCopying] = useState(false);
  const existing = record[step];

  const copyPrompt = async () => {
    const built = buildPrompt(step, record, profile);
    if (!built.ok) {
      onToast(built.reason);
      return;
    }
    setCopying(true);
    try {
      await navigator.clipboard.writeText(built.prompt);
      onToast(`${STEP_LABELS[step]}のプロンプトをコピーしました。AIに貼り付けて実行してください`);
    } catch {
      onToast("コピーに失敗しました。もう一度お試しください");
    } finally {
      setCopying(false);
    }
  };

  const applyResult = async () => {
    const content = pasted.trim();
    if (!content) {
      onToast("AIの出力を貼り付けてから「反映」を押してください");
      return;
    }
    await updateCompany(record.companyId, (cur) => {
      const next = {
        ...cur,
        [step]: { content, updatedAt: new Date().toISOString() },
      } as CompanyRecord;
      next.status = nextStatus(next);
      return next;
    });
    setPasted("");
    onToast(`${STEP_LABELS[step]}を反映しました`);
    onSaved();
  };

  return (
    <div class="step-panel">
      <div class="step-panel__head">
        <strong>{STEP_LABELS[step]}</strong>
        {existing && (
          <span class="step-panel__done">反映済 {existing.updatedAt.slice(0, 10)}</span>
        )}
      </div>

      <button class="btn btn--primary" onClick={copyPrompt} disabled={copying}>
        プロンプトをコピー
      </button>

      <textarea
        class="step-panel__paste"
        placeholder="AIの出力をここに貼り付け"
        value={pasted}
        onInput={(e) => setPasted((e.target as HTMLTextAreaElement).value)}
        rows={5}
      />
      <button class="btn" onClick={applyResult}>
        反映
      </button>

      {existing && (
        <details class="step-panel__preview">
          <summary>反映済みの内容を見る（{existing.content.length}文字）</summary>
          <pre>{existing.content}</pre>
        </details>
      )}
    </div>
  );
}
