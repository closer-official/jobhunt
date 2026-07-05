// prompts/promptBuilder.ts — テンプレート + 企業レコードのデータ合成
import { CompanyRecord, UserProfile } from "../storage/schema";
import { COMPANY_RESEARCH_TEMPLATE } from "./templates/companyResearch";
import { SCHEDULE_RESEARCH_TEMPLATE } from "./templates/scheduleResearch";
import { IDEAL_PROFILE_TEMPLATE } from "./templates/idealProfileResearch";
import { ES_RESUME_TEMPLATE } from "./templates/esResumeGeneration";

export type StepKey = "research" | "schedule" | "idealProfile" | "esDraft";

export const STEP_LABELS: Record<StepKey, string> = {
  research: "① 企業研究",
  schedule: "② 選考日程",
  idealProfile: "③ 人物像",
  esDraft: "④ ES作成",
};

// 貼り付け先AIのコンテキストを圧迫しすぎないよう、1ページあたり・合計に上限を設ける
const PER_PAGE_CHARS = 8000;
const TOTAL_CHARS = 36000;

function joinCapturedTexts(record: CompanyRecord): string {
  if (record.capturedTexts.length === 0) {
    return "（収集済み情報がありません。求人詳細ページ等をキャプチャしてから再生成してください）";
  }
  let total = 0;
  const blocks: string[] = [];
  for (const [i, cap] of record.capturedTexts.entries()) {
    let body = cap.rawText;
    if (body.length > PER_PAGE_CHARS) body = body.slice(0, PER_PAGE_CHARS) + "\n…（省略）";
    if (total + body.length > TOTAL_CHARS) {
      blocks.push(`--- 情報源${i + 1}以降は文字数上限のため省略 ---`);
      break;
    }
    total += body.length;
    blocks.push(
      `--- 情報源${i + 1}${cap.label ? `（${cap.label}）` : ""}: ${cap.url}（取得: ${cap.capturedAt.slice(0, 10)}） ---\n${body}`
    );
  }
  return blocks.join("\n\n");
}

function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? `（${key}: データなし）`);
}

export function buildPrompt(
  step: StepKey,
  record: CompanyRecord,
  profile?: UserProfile
): { ok: true; prompt: string } | { ok: false; reason: string } {
  const common = {
    companyName: record.companyName,
    capturedTexts: joinCapturedTexts(record),
  };

  switch (step) {
    case "research":
      return { ok: true, prompt: fill(COMPANY_RESEARCH_TEMPLATE, common) };
    case "schedule":
      return { ok: true, prompt: fill(SCHEDULE_RESEARCH_TEMPLATE, common) };
    case "idealProfile":
      return { ok: true, prompt: fill(IDEAL_PROFILE_TEMPLATE, common) };
    case "esDraft": {
      if (!record.research || !record.schedule || !record.idealProfile) {
        return { ok: false, reason: "①〜③がすべて反映済みになるとES作成が使えます" };
      }
      if (!profile || !profile.resumeBase.trim()) {
        return { ok: false, reason: "設定画面で経歴データ（職務経歴書ベース）を入力してください" };
      }
      return {
        ok: true,
        prompt: fill(ES_RESUME_TEMPLATE, {
          companyName: record.companyName,
          research: record.research.content,
          schedule: record.schedule.content,
          idealProfile: record.idealProfile.content,
          resumeBase: profile.resumeBase,
          strengthsSummary: profile.strengthsSummary || "（未入力）",
        }),
      };
    }
  }
}
