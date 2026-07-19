// billing/subscriptionLifecycle.ts — 実決済を行わない解約・救済方針

export type RefundReason =
  | "duplicate_charge"
  | "major_outage"
  | "ai_technical_failure"
  | "quality_dissatisfaction"
  | "partial_period_cancellation";

export interface RefundDecision {
  cashRefund: boolean;
  creditRestoration: boolean;
  requiresOperatorReview: boolean;
  reason: string;
}

export function decideRefund(reason: RefundReason): RefundDecision {
  if (reason === "duplicate_charge" || reason === "major_outage") {
    return {
      cashRefund: true,
      creditRestoration: false,
      requiresOperatorReview: true,
      reason: "二重課金又は重大障害は、運営確認後の返金候補です。",
    };
  }
  if (reason === "ai_technical_failure") {
    return {
      cashRefund: false,
      creditRestoration: true,
      requiresOperatorReview: false,
      reason: "AI技術失敗は、現金でなくクレジットを返還します。",
    };
  }
  return {
    cashRefund: false,
    creditRestoration: false,
    requiresOperatorReview: reason === "quality_dissatisfaction",
    reason: reason === "partial_period_cancellation"
      ? "初期は日割り返金を行わず、現在期間末で解約します。"
      : "品質不満は自動返金せず、訂正申請として確認します。",
  };
}

export function schedulePeriodEndCancellation(
  currentPeriodEndsAt: string,
  exportGraceDays = 90
) {
  const periodEnd = new Date(currentPeriodEndsAt);
  if (Number.isNaN(periodEnd.getTime())) {
    throw new Error("currentPeriodEndsAt が不正です。");
  }
  if (!Number.isInteger(exportGraceDays) || exportGraceDays < 0) {
    throw new Error("exportGraceDays が不正です。");
  }
  const exportGraceEnd = new Date(periodEnd);
  exportGraceEnd.setUTCDate(exportGraceEnd.getUTCDate() + exportGraceDays);
  return {
    subscriptionStatus: "cancel_at_period_end" as const,
    aiAccessEndsAt: periodEnd.toISOString(),
    exportGraceEndsAt: exportGraceEnd.toISOString(),
  };
}
