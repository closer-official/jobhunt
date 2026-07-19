// catalog/cashflowGuardrails.ts — 外部決済なしのAI調査実行可否試算

export interface CashflowGuardrailsInput {
  grossPaymentUsd: number;
  paymentFeeRate: number;
  paymentFixedFeeUsd?: number;
  executionCostUsd: number;
  reviewCostUsd: number;
  refundReserveUsd?: number;
  fixedCostAllocationUsd?: number;
  taxReserveUsd?: number;
  safetyMultiplier?: number;
}

export interface CashflowGuardrailsEstimate {
  paymentFeeUsd: number;
  netCollectedUsd: number;
  baseReservedCostUsd: number;
  reservedCostUsd: number;
  marginAfterReservationUsd: number;
  minimumGrossPaymentUsd: number;
  canExecute: boolean;
}

function finiteAtLeast(value: number, lowerBound: number, name: string): void {
  if (!Number.isFinite(value) || value < lowerBound) {
    throw new Error(`${name} は${lowerBound}以上の有限数にしてください。`);
  }
}

function rounded(value: number): number {
  return Math.round((value + Number.EPSILON) * 1_000_000) / 1_000_000;
}

/**
 * 収入確定後だけに新規調査を許可するための、最悪費用予約の試算。
 * 実決済、課金、返金、外部AI呼出しは行わない。
 */
export function evaluateCashflowGuardrail(input: CashflowGuardrailsInput): CashflowGuardrailsEstimate {
  finiteAtLeast(input.grossPaymentUsd, 0, "grossPaymentUsd");
  finiteAtLeast(input.paymentFeeRate, 0, "paymentFeeRate");
  if (input.paymentFeeRate >= 1) {
    throw new Error("paymentFeeRate は1未満にしてください。");
  }
  finiteAtLeast(input.paymentFixedFeeUsd ?? 0, 0, "paymentFixedFeeUsd");
  finiteAtLeast(input.executionCostUsd, 0, "executionCostUsd");
  finiteAtLeast(input.reviewCostUsd, 0, "reviewCostUsd");
  finiteAtLeast(input.refundReserveUsd ?? 0, 0, "refundReserveUsd");
  finiteAtLeast(input.fixedCostAllocationUsd ?? 0, 0, "fixedCostAllocationUsd");
  finiteAtLeast(input.taxReserveUsd ?? 0, 0, "taxReserveUsd");
  finiteAtLeast(input.safetyMultiplier ?? 1, 1, "safetyMultiplier");

  const paymentFixedFeeUsd = input.paymentFixedFeeUsd ?? 0;
  const paymentFeeUsd = input.grossPaymentUsd * input.paymentFeeRate + paymentFixedFeeUsd;
  const netCollectedUsd = input.grossPaymentUsd - paymentFeeUsd;
  const baseReservedCostUsd = input.executionCostUsd
    + input.reviewCostUsd
    + (input.refundReserveUsd ?? 0)
    + (input.fixedCostAllocationUsd ?? 0)
    + (input.taxReserveUsd ?? 0);
  const reservedCostUsd = baseReservedCostUsd * (input.safetyMultiplier ?? 1);
  const marginAfterReservationUsd = netCollectedUsd - reservedCostUsd;
  const minimumGrossPaymentUsd = (reservedCostUsd + paymentFixedFeeUsd) / (1 - input.paymentFeeRate);

  return {
    paymentFeeUsd: rounded(paymentFeeUsd),
    netCollectedUsd: rounded(netCollectedUsd),
    baseReservedCostUsd: rounded(baseReservedCostUsd),
    reservedCostUsd: rounded(reservedCostUsd),
    marginAfterReservationUsd: rounded(marginAfterReservationUsd),
    minimumGrossPaymentUsd: rounded(minimumGrossPaymentUsd),
    canExecute: marginAfterReservationUsd >= 0,
  };
}
