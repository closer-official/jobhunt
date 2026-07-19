import assert from "node:assert/strict";
import * as esbuild from "esbuild";
import path from "node:path";

const abs = (p) => path.resolve(p).replace(/\\/g, "/");
await esbuild.build({
  entryPoints: [abs("tests/catalogImport.entry.ts")],
  tsconfig: abs("tsconfig.json"),
  nodePaths: [abs("node_modules")],
  bundle: true,
  format: "esm",
  outfile: abs("tests/catalogImport.bundle.mjs"),
  platform: "node",
});
const { DRAFT_SUBSCRIPTION_PLANS, estimateAiResearchCost, estimatePlanEconomics, evaluateCashflowGuardrail, normalizeUrl, previewResearchImport, validateResearchMarkdown } = await import("./catalogImport.bundle.mjs");

const markdown = `# 企業リサーチ: 例式会社

\`\`\`company-research-json
{
  "schemaVersion": 1,
  "company": { "name": "例式会社", "canonicalUrl": "https://example.co.jp/?utm_source=test" },
  "researchedOn": "2026-07-18",
  "reviewStatus": "reviewed",
  "sources": [{
    "sourceId": "official-20260718",
    "sourceKind": "official",
    "sourceName": "例式会社公式サイト",
    "url": "https://example.co.jp/about?fbclid=ignored",
    "capturedOn": "2026-07-18",
    "termsCheckedOn": "2026-07-18",
    "extractionScope": "会社概要の事業内容",
    "evidence": "会社概要の事業内容を確認",
    "acquisitionMethod": "operator_manual",
    "automationStatus": "not_explicitly_prohibited",
    "accessMethod": "public",
    "redistributionStatus": "structured_facts_only"
  }],
  "facts": [{ "field": "事業内容", "value": "業務支援ソフトウェア", "sourceId": "official-20260718", "verifiedOn": "2026-07-18" }]
}
\`\`\`

## AI要約

公開事実を基にした要約。

## 推測・未確認

なし

## 広告・PR

なし`;

assert.equal(normalizeUrl("https://EXAMPLE.co.jp/about/?utm_source=x#intro"), "https://example.co.jp/about");
const preview = previewResearchImport(markdown, [], "2026-07-18T00:00:00.000Z");
assert.equal(preview.validation.errors.length, 0, preview.validation.errors.join("\n"));
assert.equal(preview.duplicateDecision.kind, "create");
assert.equal(preview.company.canonicalUrl, "https://example.co.jp/");
assert.equal(preview.sources[0].normalizedUrl, "https://example.co.jp/about");
assert.equal(preview.company.facts[0].sourceId, preview.sources[0].sourceId);
assert.equal(preview.sources[0].sourceKey, "official-20260718");
assert.match(preview.sources[0].evidenceHash, /^local-[0-9a-f]{8}$/);

const urlDuplicate = previewResearchImport(markdown, [{
  companyId: "cmp_existing",
  canonicalUrl: "https://example.co.jp/",
  normalizedName: "別会社",
  sourceIds: [],
}]);
assert.deepEqual(urlDuplicate.duplicateDecision, { kind: "review_exact_url", companyIds: ["cmp_existing"] });

const invalid = validateResearchMarkdown(markdown.replace('"sourceId": "official-20260718"', '"sourceId": "official-20260718"').replace('"sourceId": "official-20260718", "verifiedOn"', '"sourceId": "missing", "verifiedOn"').replace("## 広告・PR\n\nなし", ""));
assert.ok(invalid.errors.some((error) => error.includes("facts[0].sourceId")));
assert.ok(invalid.errors.some((error) => error.includes("広告・PR")));

const blockedSource = validateResearchMarkdown(markdown
  .replace("https://example.co.jp/about?fbclid=ignored", "https://www.wantedly.com/companies/example")
  .replace("例式会社公式サイト", "Wantedly")
);
assert.ok(blockedSource.errors.some((error) => error.includes("Wantedly")));

const estimate = estimateAiResearchCost({
  searchCalls: 3,
  searchCostUsdPerCall: 0.01,
  inputTokens: 8_000,
  inputCostUsdPerMillionTokens: 0.75,
  outputTokens: 2_000,
  outputCostUsdPerMillionTokens: 4.5,
  retryReserveUsd: 0.015,
  expectedReuses: 10,
  reviewMinutes: 3,
  reviewerHourlyCostUsd: 20,
});
assert.equal(estimate.searchCostUsd, 0.03);
assert.equal(estimate.modelInputCostUsd, 0.006);
assert.equal(estimate.modelOutputCostUsd, 0.009);
assert.equal(estimate.executionCostUsd, 0.06);
assert.equal(estimate.sharedExecutionCostUsd, 0.006);
assert.equal(estimate.reviewCostUsd, 1);
assert.equal(estimate.sharedCostUsd, 1.006);
assert.throws(() => estimateAiResearchCost({
  searchCalls: 1,
  searchCostUsdPerCall: 0.01,
  inputTokens: 1,
  inputCostUsdPerMillionTokens: 1,
  outputTokens: 1,
  outputCostUsdPerMillionTokens: 1,
  expectedReuses: 0,
}), /expectedReuses/);

const guardrail = evaluateCashflowGuardrail({
  grossPaymentUsd: 2,
  paymentFeeRate: 0.036,
  executionCostUsd: 0.06,
  reviewCostUsd: 0.5,
  refundReserveUsd: 0.1,
  fixedCostAllocationUsd: 0.1,
  safetyMultiplier: 1.1,
});
assert.equal(guardrail.paymentFeeUsd, 0.072);
assert.equal(guardrail.netCollectedUsd, 1.928);
assert.equal(guardrail.reservedCostUsd, 0.836);
assert.equal(guardrail.canExecute, true);
assert.ok(guardrail.minimumGrossPaymentUsd > 0.867);
assert.throws(() => evaluateCashflowGuardrail({
  grossPaymentUsd: 1,
  paymentFeeRate: 1,
  executionCostUsd: 0,
  reviewCostUsd: 0,
}), /paymentFeeRate/);

const lightPlan = DRAFT_SUBSCRIPTION_PLANS.find((plan) => plan.id === "light");
const standardPlan = DRAFT_SUBSCRIPTION_PLANS.find((plan) => plan.id === "standard");
const proPlan = DRAFT_SUBSCRIPTION_PLANS.find((plan) => plan.id === "pro");
assert.ok(lightPlan && standardPlan && proPlan);

const lightEconomics = estimatePlanEconomics({
  priceIncludingTaxJpy: lightPlan.monthlyPriceJpy,
  monthlyCredits: lightPlan.monthlyCredits,
});
assert.equal(lightEconomics.taxReserveJpy, 44.545);
assert.equal(lightEconomics.stripeFeeJpy, 21.07);
assert.equal(lightEconomics.netAfterTaxAndFeesJpy, 424.385);
assert.equal(lightEconomics.creditCostReserveJpy, 200);
assert.equal(lightEconomics.cashflowPositive, true);

const referredLightEconomics = estimatePlanEconomics({
  priceIncludingTaxJpy: lightPlan.monthlyPriceJpy,
  monthlyCredits: lightPlan.monthlyCredits,
  bonusCredits: 40,
});
assert.equal(referredLightEconomics.contributionAfterCreditReserveJpy, 64.385);
assert.equal(referredLightEconomics.cashflowPositive, true);

const proEconomics = estimatePlanEconomics({
  priceIncludingTaxJpy: proPlan.monthlyPriceJpy,
  monthlyCredits: proPlan.monthlyCredits,
});
assert.equal(proEconomics.creditCostReserveJpy, 1_500);
assert.ok(proEconomics.contributionMarginRate > 0.4);
console.log("=== CATALOG IMPORT TEST: PASS ===");
