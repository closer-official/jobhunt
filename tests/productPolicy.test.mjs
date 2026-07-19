import assert from "node:assert/strict";
import * as esbuild from "esbuild";
import path from "node:path";

const abs = (p) => path.resolve(p).replace(/\\/g, "/");
await esbuild.build({
  entryPoints: [abs("tests/productPolicy.entry.ts")],
  tsconfig: abs("tsconfig.json"),
  nodePaths: [abs("node_modules")],
  bundle: true,
  format: "esm",
  outfile: abs("tests/productPolicy.bundle.mjs"),
  platform: "node",
});

const policy = await import("./productPolicy.bundle.mjs");
const {
  DRAFT_SUBSCRIPTION_PLANS,
  availableCredits,
  commitCredits,
  decideRefund,
  evaluateSourceGate,
  prepareAiRequest,
  refundCommittedCredits,
  releaseReservedCredits,
  reserveCredits,
  schedulePeriodEndCancellation,
  validateManualSocialPack,
  validateProviderResult,
} = policy;

assert.equal(DRAFT_SUBSCRIPTION_PLANS.length, 4);
for (const plan of DRAFT_SUBSCRIPTION_PLANS) {
  assert.equal(plan.launchAvailability, "initial_public_launch");
  assert.equal(plan.inviteRequired, false);
}

const now = "2026-07-19T00:00:00.000Z";
const initial = {
  monthlyRemaining: 10,
  bonusLots: [{
    grantId: "bonus-1",
    remaining: 3,
    expiresAt: "2026-08-01T00:00:00.000Z",
  }],
  actions: {},
};
assert.equal(availableCredits(initial, now), 13);
const reserved = reserveCredits(initial, "action-1", 5, now);
assert.equal(reserved.state.monthlyRemaining, 8);
assert.equal(reserved.state.bonusLots[0].remaining, 0);
assert.equal(reserveCredits(reserved.state, "action-1", 5, now).changed, false);
const committed = commitCredits(reserved.state, "action-1");
assert.equal(committed.action.status, "committed");
const refunded = refundCommittedCredits(committed.state, "action-1", now);
assert.equal(availableCredits(refunded.state, now), 13);
assert.equal(refundCommittedCredits(refunded.state, "action-1", now).changed, false);

const reservation2 = reserveCredits(initial, "action-2", 2, now);
const released = releaseReservedCredits(reservation2.state, "action-2", now);
assert.equal(availableCredits(released.state, now), 13);
assert.throws(
  () => reserveCredits(initial, "action-3", 14, now),
  /不足/
);

const prepared = prepareAiRequest({
  actionId: "ai-1",
  actionType: "newCompanyResearch",
  promptTemplateVersion: "v1",
  contexts: [{
    label: "学生が選択した企業名",
    content: "例式会社",
    confirmedByUser: true,
  }],
  userConfirmedAt: now,
});
assert.equal(prepared.creditCost, 30);
assert.equal(prepared.limits.searchCalls, 3);
assert.deepEqual(validateProviderResult(prepared, {
  text: "結果",
  inputTokens: 10_000,
  outputTokens: 2_000,
  searchCalls: 3,
  providerRequestId: "provider-1",
}), []);
assert.ok(validateProviderResult(prepared, {
  text: "",
  inputTokens: 13_000,
  outputTokens: 5_000,
  searchCalls: 4,
  providerRequestId: "",
}).length >= 4);

assert.equal(evaluateSourceGate({
  sourceName: "公開公式サイト",
  url: "https://example.co.jp",
  acquisitionMethod: "automated",
  automationStatus: "not_explicitly_prohibited",
  accessMethod: "public",
  redistributionStatus: "structured_facts_only",
  contentKind: "structured_facts_and_self_authored_summary",
}).acquisition, "allow_candidate");
assert.equal(evaluateSourceGate({
  sourceName: "禁止サイト",
  url: "https://example.net",
  acquisitionMethod: "automated",
  automationStatus: "explicitly_prohibited",
  accessMethod: "public",
  redistributionStatus: "structured_facts_only",
  contentKind: "structured_facts_and_self_authored_summary",
}).acquisition, "block");
assert.equal(evaluateSourceGate({
  sourceName: "口コミ",
  url: "https://example.org",
  acquisitionMethod: "operator_manual",
  automationStatus: "not_explicitly_prohibited",
  accessMethod: "public",
  redistributionStatus: "allowed",
  contentKind: "review_body",
}).redistribution, "block");

assert.equal(decideRefund("duplicate_charge").cashRefund, true);
assert.equal(decideRefund("ai_technical_failure").creditRestoration, true);
assert.equal(decideRefund("partial_period_cancellation").cashRefund, false);
const cancellation = schedulePeriodEndCancellation(
  "2026-08-01T00:00:00.000Z"
);
assert.equal(cancellation.subscriptionStatus, "cancel_at_period_end");
assert.equal(cancellation.exportGraceEndsAt, "2026-10-30T00:00:00.000Z");

const textChannels = ["note", "x", "threads"];
const videoChannels = [
  "instagram_reels",
  "tiktok",
  "youtube_shorts",
];
const socialPack = [
  ...textChannels.map((channel) => ({
    channel,
    caption: "投稿文",
    prLabel: "PRなし",
    sourceNote: "確認済み原稿",
    checkedOn: "2026-07-19",
    copyText: "コピペ本文",
  })),
  ...videoChannels.map((channel) => ({
    channel,
    caption: "投稿文",
    prLabel: "PRなし",
    sourceNote: "確認済み原稿",
    checkedOn: "2026-07-19",
    videoFile: `${channel}.mp4`,
    coverImageFile: `${channel}.png`,
  })),
];
assert.deepEqual(validateManualSocialPack(socialPack), []);
assert.ok(validateManualSocialPack(socialPack.slice(1)).length > 0);

console.log("=== PRODUCT POLICY TEST: PASS ===");
