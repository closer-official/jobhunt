// ai/providerBoundary.ts — 特定AI提供者へ接続しない実行契約
import { AI_ACTION_CREDIT_COST } from "../billing/planModel";

export type AiActionType = keyof typeof AI_ACTION_CREDIT_COST;

export interface ConfirmedContext {
  label: string;
  content: string;
  confirmedByUser: true;
}

export interface ProviderIndependentAiRequest {
  actionId: string;
  actionType: AiActionType;
  promptTemplateVersion: string;
  contexts: ConfirmedContext[];
  userConfirmedAt: string;
}

export interface PreparedAiRequest
  extends ProviderIndependentAiRequest {
  creditCost: number;
  limits: {
    inputTokens: number;
    outputTokens: number;
    searchCalls: number;
  };
}

export interface AiProviderResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
  searchCalls: number;
  providerRequestId: string;
}

export interface AiProviderAdapter {
  readonly configId: string;
  execute(request: PreparedAiRequest): Promise<AiProviderResult>;
}

const ACTION_LIMITS: Record<
  AiActionType,
  PreparedAiRequest["limits"]
> = {
  documentFirstDraft: {
    inputTokens: 4_000,
    outputTokens: 2_000,
    searchCalls: 0,
  },
  documentRevision: {
    inputTokens: 4_000,
    outputTokens: 1_500,
    searchCalls: 0,
  },
  interviewPreparation: {
    inputTokens: 6_000,
    outputTokens: 3_000,
    searchCalls: 0,
  },
  existingCompanyComparison: {
    inputTokens: 8_000,
    outputTokens: 3_000,
    searchCalls: 0,
  },
  newCompanyResearch: {
    inputTokens: 12_000,
    outputTokens: 4_000,
    searchCalls: 3,
  },
};

export function prepareAiRequest(
  request: ProviderIndependentAiRequest
): PreparedAiRequest {
  if (!request.actionId.trim()) throw new Error("actionId は必須です。");
  if (!request.promptTemplateVersion.trim()) {
    throw new Error("promptTemplateVersion は必須です。");
  }
  if (Number.isNaN(Date.parse(request.userConfirmedAt))) {
    throw new Error("userConfirmedAt が不正です。");
  }
  if (!request.contexts.length) {
    throw new Error("本人が確認した送信項目が必要です。");
  }
  for (const context of request.contexts) {
    if (
      context.confirmedByUser !== true
      || !context.label.trim()
      || !context.content.trim()
    ) {
      throw new Error("全送信項目に本人確認が必要です。");
    }
  }
  return {
    ...request,
    creditCost: AI_ACTION_CREDIT_COST[request.actionType],
    limits: { ...ACTION_LIMITS[request.actionType] },
  };
}

export function validateProviderResult(
  request: PreparedAiRequest,
  result: AiProviderResult
): string[] {
  const errors: string[] = [];
  if (!result.text.trim()) errors.push("AI出力が空です。");
  if (result.inputTokens > request.limits.inputTokens) {
    errors.push("入力トークン上限を超えました。");
  }
  if (result.outputTokens > request.limits.outputTokens) {
    errors.push("出力トークン上限を超えました。");
  }
  if (result.searchCalls > request.limits.searchCalls) {
    errors.push("検索回数上限を超えました。");
  }
  if (!result.providerRequestId.trim()) {
    errors.push("提供者の実行IDがありません。");
  }
  return errors;
}
