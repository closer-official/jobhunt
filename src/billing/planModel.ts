// billing/planModel.ts — 外部決済へ接続しない料金・クレジット試算

export type SubscriptionPlanId = "free" | "light" | "standard" | "pro";

export interface SubscriptionPlanDraft {
  id: SubscriptionPlanId;
  monthlyPriceJpy: number;
  monthlyCredits: number;
  cloudSavedItemLimit: number;
  companyRequestsPerMonth: number;
  paidFeaturesEnabled: boolean;
  launchAvailability: "initial_public_launch";
  inviteRequired: false;
  commercialTermsStatus: "decided" | "experimental";
}

export const DRAFT_SUBSCRIPTION_PLANS: readonly SubscriptionPlanDraft[] = [
  {
    id: "free",
    monthlyPriceJpy: 0,
    monthlyCredits: 0,
    cloudSavedItemLimit: 0,
    companyRequestsPerMonth: 5,
    paidFeaturesEnabled: false,
    launchAvailability: "initial_public_launch",
    inviteRequired: false,
    commercialTermsStatus: "decided",
  },
  {
    id: "light",
    monthlyPriceJpy: 490,
    monthlyCredits: 50,
    cloudSavedItemLimit: 100,
    companyRequestsPerMonth: 5,
    paidFeaturesEnabled: true,
    launchAvailability: "initial_public_launch",
    inviteRequired: false,
    commercialTermsStatus: "experimental",
  },
  {
    id: "standard",
    monthlyPriceJpy: 1_490,
    monthlyCredits: 180,
    cloudSavedItemLimit: 500,
    companyRequestsPerMonth: 5,
    paidFeaturesEnabled: true,
    launchAvailability: "initial_public_launch",
    inviteRequired: false,
    commercialTermsStatus: "experimental",
  },
  {
    id: "pro",
    monthlyPriceJpy: 2_980,
    monthlyCredits: 375,
    cloudSavedItemLimit: 2_000,
    companyRequestsPerMonth: 5,
    paidFeaturesEnabled: true,
    launchAvailability: "initial_public_launch",
    inviteRequired: false,
    commercialTermsStatus: "experimental",
  },
] as const;

export const AI_ACTION_CREDIT_COST = {
  documentFirstDraft: 5,
  documentRevision: 2,
  interviewPreparation: 5,
  existingCompanyComparison: 8,
  newCompanyResearch: 30,
} as const;

export const DRAFT_REWARD_POLICY = {
  referralInviterCredits: 20,
  referralInviteeCredits: 20,
  referralMonthlyLimit: 5,
  referralPendingDays: 14,
  privateFeedbackCredits: 5,
  verifiedCorrectionCredits: 5,
  contributionRewardMonthlyLimit: 1,
  bonusCreditExpiryDays: 90,
  publicReviewCredits: 0,
} as const;

export interface PlanEconomicsInput {
  priceIncludingTaxJpy: number;
  monthlyCredits: number;
  bonusCredits?: number;
  consumptionTaxRate?: number;
  paymentFeeRate?: number;
  billingFeeRate?: number;
  reservedCostPerCreditJpy?: number;
}

export interface PlanEconomicsEstimate {
  taxReserveJpy: number;
  stripeFeeJpy: number;
  netAfterTaxAndFeesJpy: number;
  creditCostReserveJpy: number;
  contributionAfterCreditReserveJpy: number;
  contributionMarginRate: number;
  cashflowPositive: boolean;
}

function nonNegative(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${name} は0以上の有限数にしてください。`);
  }
}

function rate(value: number, name: string): void {
  nonNegative(value, name);
  if (value >= 1) throw new Error(`${name} は1未満にしてください。`);
}

function rounded(value: number): number {
  return Math.round((value + Number.EPSILON) * 1_000) / 1_000;
}

/**
 * 税込売価から、税、Stripe料金、全クレジット予約後の余力を試算する。
 * 決済、請求、クレジット付与は実行しない。
 */
export function estimatePlanEconomics(input: PlanEconomicsInput): PlanEconomicsEstimate {
  const consumptionTaxRate = input.consumptionTaxRate ?? 0.1;
  const paymentFeeRate = input.paymentFeeRate ?? 0.036;
  const billingFeeRate = input.billingFeeRate ?? 0.007;
  const reservedCostPerCreditJpy = input.reservedCostPerCreditJpy ?? 4;
  const bonusCredits = input.bonusCredits ?? 0;

  nonNegative(input.priceIncludingTaxJpy, "priceIncludingTaxJpy");
  nonNegative(input.monthlyCredits, "monthlyCredits");
  nonNegative(bonusCredits, "bonusCredits");
  rate(consumptionTaxRate, "consumptionTaxRate");
  rate(paymentFeeRate, "paymentFeeRate");
  rate(billingFeeRate, "billingFeeRate");
  nonNegative(reservedCostPerCreditJpy, "reservedCostPerCreditJpy");

  const taxExclusiveRevenueJpy = input.priceIncludingTaxJpy / (1 + consumptionTaxRate);
  const taxReserveJpy = input.priceIncludingTaxJpy - taxExclusiveRevenueJpy;
  const stripeFeeJpy = input.priceIncludingTaxJpy * (paymentFeeRate + billingFeeRate);
  const netAfterTaxAndFeesJpy = input.priceIncludingTaxJpy - taxReserveJpy - stripeFeeJpy;
  const creditCostReserveJpy = (input.monthlyCredits + bonusCredits) * reservedCostPerCreditJpy;
  const contributionAfterCreditReserveJpy = netAfterTaxAndFeesJpy - creditCostReserveJpy;
  const contributionMarginRate = netAfterTaxAndFeesJpy > 0
    ? contributionAfterCreditReserveJpy / netAfterTaxAndFeesJpy
    : 0;

  return {
    taxReserveJpy: rounded(taxReserveJpy),
    stripeFeeJpy: rounded(stripeFeeJpy),
    netAfterTaxAndFeesJpy: rounded(netAfterTaxAndFeesJpy),
    creditCostReserveJpy: rounded(creditCostReserveJpy),
    contributionAfterCreditReserveJpy: rounded(contributionAfterCreditReserveJpy),
    contributionMarginRate: rounded(contributionMarginRate),
    cashflowPositive: contributionAfterCreditReserveJpy >= 0,
  };
}
