// billing/creditStateMachine.ts — 外部保存を行わないAIクレジット状態機械

export type CreditActionStatus = "reserved" | "committed" | "released" | "refunded";

export interface BonusCreditLot {
  grantId: string;
  remaining: number;
  expiresAt: string;
}

export interface CreditAllocation {
  monthly: number;
  bonus: { grantId: string; amount: number; expiresAt: string }[];
}

export interface CreditActionRecord {
  actionId: string;
  credits: number;
  status: CreditActionStatus;
  allocation: CreditAllocation;
}

export interface CreditState {
  monthlyRemaining: number;
  bonusLots: BonusCreditLot[];
  actions: Record<string, CreditActionRecord>;
}

export interface CreditTransition {
  state: CreditState;
  changed: boolean;
  action: CreditActionRecord;
}

function cloneState(state: CreditState): CreditState {
  return {
    monthlyRemaining: state.monthlyRemaining,
    bonusLots: state.bonusLots.map((lot) => ({ ...lot })),
    actions: Object.fromEntries(Object.entries(state.actions).map(([key, action]) => [
      key,
      {
        ...action,
        allocation: {
          monthly: action.allocation.monthly,
          bonus: action.allocation.bonus.map((item) => ({ ...item })),
        },
      },
    ])),
  };
}

function assertState(state: CreditState): void {
  if (!Number.isInteger(state.monthlyRemaining) || state.monthlyRemaining < 0) {
    throw new Error("月次クレジット残高が不正です。");
  }
  for (const lot of state.bonusLots) {
    if (!lot.grantId.trim() || !Number.isInteger(lot.remaining) || lot.remaining < 0) {
      throw new Error("無償クレジット残高が不正です。");
    }
    if (Number.isNaN(Date.parse(lot.expiresAt))) {
      throw new Error("無償クレジット期限が不正です。");
    }
  }
}

export function availableCredits(state: CreditState, now: string): number {
  assertState(state);
  const current = Date.parse(now);
  if (Number.isNaN(current)) throw new Error("now が有効な日時ではありません。");
  return state.monthlyRemaining + state.bonusLots
    .filter((lot) => Date.parse(lot.expiresAt) > current)
    .reduce((sum, lot) => sum + lot.remaining, 0);
}

export function reserveCredits(
  state: CreditState,
  actionId: string,
  credits: number,
  now: string
): CreditTransition {
  assertState(state);
  if (!actionId.trim()) throw new Error("actionId は必須です。");
  if (!Number.isInteger(credits) || credits <= 0) {
    throw new Error("credits は正の整数にしてください。");
  }
  const existing = state.actions[actionId];
  if (existing) {
    if (existing.credits !== credits) {
      throw new Error("同じactionIdへ異なる消費量を指定できません。");
    }
    return { state, changed: false, action: existing };
  }
  if (availableCredits(state, now) < credits) {
    throw new Error("AIクレジットが不足しています。");
  }

  const next = cloneState(state);
  let remaining = credits;
  const allocation: CreditAllocation = { monthly: 0, bonus: [] };
  const current = Date.parse(now);
  const orderedLots = next.bonusLots
    .filter((lot) => lot.remaining > 0 && Date.parse(lot.expiresAt) > current)
    .sort((a, b) => Date.parse(a.expiresAt) - Date.parse(b.expiresAt));

  for (const lot of orderedLots) {
    if (!remaining) break;
    const amount = Math.min(lot.remaining, remaining);
    lot.remaining -= amount;
    remaining -= amount;
    allocation.bonus.push({
      grantId: lot.grantId,
      amount,
      expiresAt: lot.expiresAt,
    });
  }
  if (remaining) {
    next.monthlyRemaining -= remaining;
    allocation.monthly = remaining;
  }
  const action: CreditActionRecord = {
    actionId,
    credits,
    status: "reserved",
    allocation,
  };
  next.actions[actionId] = action;
  assertState(next);
  return { state: next, changed: true, action };
}

export function commitCredits(
  state: CreditState,
  actionId: string
): CreditTransition {
  const existing = state.actions[actionId];
  if (!existing) throw new Error("予約済みのactionIdがありません。");
  if (existing.status === "committed") {
    return { state, changed: false, action: existing };
  }
  if (existing.status !== "reserved") {
    throw new Error("予約中のクレジットだけを確定できます。");
  }
  const next = cloneState(state);
  next.actions[actionId].status = "committed";
  return { state: next, changed: true, action: next.actions[actionId] };
}

function restoreAllocation(
  next: CreditState,
  allocation: CreditAllocation,
  now: string
): void {
  next.monthlyRemaining += allocation.monthly;
  const current = Date.parse(now);
  for (const item of allocation.bonus) {
    if (Date.parse(item.expiresAt) <= current) continue;
    const lot = next.bonusLots.find(
      (candidate) => candidate.grantId === item.grantId
    );
    if (lot) lot.remaining += item.amount;
  }
}

export function releaseReservedCredits(
  state: CreditState,
  actionId: string,
  now: string
): CreditTransition {
  const existing = state.actions[actionId];
  if (!existing) throw new Error("予約済みのactionIdがありません。");
  if (existing.status === "released") {
    return { state, changed: false, action: existing };
  }
  if (existing.status !== "reserved") {
    throw new Error("予約中のクレジットだけを解放できます。");
  }
  const next = cloneState(state);
  restoreAllocation(next, next.actions[actionId].allocation, now);
  next.actions[actionId].status = "released";
  assertState(next);
  return { state: next, changed: true, action: next.actions[actionId] };
}

export function refundCommittedCredits(
  state: CreditState,
  actionId: string,
  now: string
): CreditTransition {
  const existing = state.actions[actionId];
  if (!existing) throw new Error("確定済みのactionIdがありません。");
  if (existing.status === "refunded") {
    return { state, changed: false, action: existing };
  }
  if (existing.status !== "committed") {
    throw new Error("確定済みのクレジットだけを返還できます。");
  }
  const next = cloneState(state);
  restoreAllocation(next, next.actions[actionId].allocation, now);
  next.actions[actionId].status = "refunded";
  assertState(next);
  return { state: next, changed: true, action: next.actions[actionId] };
}
