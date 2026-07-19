// catalog/aiResearchCostModel.ts — 外部APIを呼ばない企業調査の原価試算

export interface AiResearchCostInput {
  searchCalls: number;
  searchCostUsdPerCall: number;
  inputTokens: number;
  inputCostUsdPerMillionTokens: number;
  outputTokens: number;
  outputCostUsdPerMillionTokens: number;
  retryReserveUsd?: number;
  expectedReuses?: number;
  reviewMinutes?: number;
  reviewerHourlyCostUsd?: number;
}

export interface AiResearchCostEstimate {
  searchCostUsd: number;
  modelInputCostUsd: number;
  modelOutputCostUsd: number;
  retryReserveUsd: number;
  executionCostUsd: number;
  reviewCostUsd: number;
  sharedExecutionCostUsd: number;
  sharedCostUsd: number;
}

function nonNegative(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${name} は0以上の有限数にしてください。`);
  }
}

function positive(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} は0より大きい有限数にしてください。`);
  }
}

function rounded(value: number): number {
  return Math.round((value + Number.EPSILON) * 1_000_000) / 1_000_000;
}

/**
 * 提供者へ接続せず、入力済み単価から一意企業あたりの原価を試算する。
 * 共有原価では、実行費だけを想定再利用数で割る。
 */
export function estimateAiResearchCost(input: AiResearchCostInput): AiResearchCostEstimate {
  nonNegative(input.searchCalls, "searchCalls");
  nonNegative(input.searchCostUsdPerCall, "searchCostUsdPerCall");
  nonNegative(input.inputTokens, "inputTokens");
  nonNegative(input.inputCostUsdPerMillionTokens, "inputCostUsdPerMillionTokens");
  nonNegative(input.outputTokens, "outputTokens");
  nonNegative(input.outputCostUsdPerMillionTokens, "outputCostUsdPerMillionTokens");
  nonNegative(input.retryReserveUsd ?? 0, "retryReserveUsd");
  positive(input.expectedReuses ?? 1, "expectedReuses");
  nonNegative(input.reviewMinutes ?? 0, "reviewMinutes");
  nonNegative(input.reviewerHourlyCostUsd ?? 0, "reviewerHourlyCostUsd");

  const searchCostUsd = input.searchCalls * input.searchCostUsdPerCall;
  const modelInputCostUsd = (input.inputTokens / 1_000_000) * input.inputCostUsdPerMillionTokens;
  const modelOutputCostUsd = (input.outputTokens / 1_000_000) * input.outputCostUsdPerMillionTokens;
  const retryReserveUsd = input.retryReserveUsd ?? 0;
  const executionCostUsd = searchCostUsd + modelInputCostUsd + modelOutputCostUsd + retryReserveUsd;
  const reviewCostUsd = ((input.reviewMinutes ?? 0) / 60) * (input.reviewerHourlyCostUsd ?? 0);
  const sharedExecutionCostUsd = executionCostUsd / (input.expectedReuses ?? 1);

  return {
    searchCostUsd: rounded(searchCostUsd),
    modelInputCostUsd: rounded(modelInputCostUsd),
    modelOutputCostUsd: rounded(modelOutputCostUsd),
    retryReserveUsd: rounded(retryReserveUsd),
    executionCostUsd: rounded(executionCostUsd),
    reviewCostUsd: rounded(reviewCostUsd),
    sharedExecutionCostUsd: rounded(sharedExecutionCostUsd),
    sharedCostUsd: rounded(sharedExecutionCostUsd + reviewCostUsd),
  };
}
