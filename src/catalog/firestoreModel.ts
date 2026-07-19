// catalog/firestoreModel.ts — Firestoreへ接続しない共有企業/学生データの契約

export const FIRESTORE_COLLECTIONS = {
  companies: "companies",
  companySources: "companySources",
  researchImports: "researchImports",
  billingCustomers: "billingCustomers",
  companyRequests: "companyRequests",
  users: "users",
} as const;

export type ReviewStatus = "draft" | "reviewed" | "needs_review" | "rejected";
export type SourceKind = "official" | "press_release" | "job_board" | "review" | "other";

export interface CatalogSourceInput {
  sourceId: string;
  sourceKind: SourceKind;
  sourceName: string;
  url: string;
  capturedOn: string; // YYYY-MM-DD
  termsCheckedOn: string; // YYYY-MM-DD
  extractionScope: string;
  evidence: string; // 出典の短い根拠メモ。本文・長文転載は保存しない。
  acquisitionMethod: "operator_manual" | "user_initiated" | "automated";
  automationStatus: "allowed" | "not_explicitly_prohibited" | "explicitly_prohibited";
  accessMethod: "public" | "login_required" | "technical_bypass";
  redistributionStatus: "allowed" | "structured_facts_only" | "prohibited" | "unknown";
}

export interface CatalogFactInput {
  field: string;
  value: string;
  sourceId: string;
  verifiedOn: string; // YYYY-MM-DD
}

export interface CatalogCompanyInput {
  name: string;
  canonicalUrl: string;
  aliases?: string[];
  corporateNumber?: string;
  targetCompanyId?: string;
}

export interface ResearchImportMetadata {
  schemaVersion: 1;
  company: CatalogCompanyInput;
  researchedOn: string;
  reviewStatus: "reviewed";
  sources: CatalogSourceInput[];
  facts: CatalogFactInput[];
}

export interface CompanyCatalogDocument {
  schemaVersion: 1;
  companyId: string;
  name: string;
  normalizedName: string;
  canonicalUrl: string;
  aliases: string[];
  corporateNumber?: string;
  facts: CatalogFactInput[];
  aiSummary: string;
  inferences: string;
  sponsoredOrPr: string;
  reviewStatus: ReviewStatus;
  sourceIds: string[];
  researchedOn: string;
  updatedAt: string;
}

export interface CompanySourceDocument extends Omit<CatalogSourceInput, "sourceId"> {
  schemaVersion: 1;
  sourceId: string; // Firestoreのグローバル文書ID
  sourceKey: string; // Markdown内で事実と対応付けるローカルID
  companyId: string;
  normalizedUrl: string;
  evidenceHash: string;
  createdAt: string;
}

export interface ResearchImportDocument {
  schemaVersion: 1;
  importId: string;
  companyId: string;
  markdownHash: string;
  validationErrors: string[];
  duplicateDecision: DuplicateDecision;
  importedAt: string;
  operatorUid: string;
}

export type StudentDocumentKind =
  | "profile"
  | "self_analysis"
  | "es_draft"
  | "document_draft"
  | "pdf_log"
  | "application"
  | "interview_note"
  | "consent";

export interface StudentDocument<T = Record<string, unknown>> {
  schemaVersion: 1;
  kind: StudentDocumentKind;
  ownerUid: string;
  data: T;
  createdAt: string;
  updatedAt: string;
}

export type SubscriptionPlanId = "free" | "light" | "standard" | "pro";
export type SubscriptionStatus =
  | "free"
  | "active"
  | "past_due"
  | "cancel_at_period_end"
  | "canceled"
  | "grace";

export interface StudentEntitlementDocument {
  schemaVersion: 1;
  ownerUid: string;
  planId: SubscriptionPlanId;
  subscriptionStatus: SubscriptionStatus;
  monthlyCreditsRemaining: number;
  bonusCreditsRemaining: number;
  currentPeriodEndsAt?: string;
  exportGraceEndsAt?: string;
  updatedAt: string;
}

export type CreditLedgerReason =
  | "monthly_grant"
  | "ai_action"
  | "system_failure_refund"
  | "referral_reward"
  | "private_feedback_reward"
  | "verified_correction_reward"
  | "expiry"
  | "fraud_reversal";

export interface CreditLedgerDocument {
  schemaVersion: 1;
  ownerUid: string;
  reason: CreditLedgerReason;
  delta: number;
  actionId?: string;
  expiresAt?: string;
  createdAt: string;
}

export interface BillingCustomerDocument {
  schemaVersion: 1;
  ownerUid: string;
  stripeCustomerId: string;
  stripeSubscriptionId?: string;
  stripePriceId?: string;
  subscriptionStatus: SubscriptionStatus;
  updatedAt: string;
}

export type CompanyRequestStatus = "queued" | "duplicate" | "reviewing" | "added" | "rejected";

export interface CompanyRequestDocument {
  schemaVersion: 1;
  requestId: string;
  ownerUid: string;
  companyName: string;
  officialUrl?: string;
  corporateNumber?: string;
  status: CompanyRequestStatus;
  duplicateCompanyId?: string;
  requestedAt: string;
  updatedAt: string;
}

export type DuplicateDecision =
  | { kind: "create" }
  | { kind: "update_target"; companyId: string }
  | { kind: "review_exact_url"; companyIds: string[] }
  | { kind: "review_name_match"; companyIds: string[] }
  | { kind: "review_source_overlap"; companyIds: string[] };

export const firestorePaths = {
  company: (companyId: string) => `${FIRESTORE_COLLECTIONS.companies}/${companyId}`,
  companySource: (sourceId: string) => `${FIRESTORE_COLLECTIONS.companySources}/${sourceId}`,
  researchImport: (importId: string) => `${FIRESTORE_COLLECTIONS.researchImports}/${importId}`,
  billingCustomer: (uid: string) => `${FIRESTORE_COLLECTIONS.billingCustomers}/${uid}`,
  companyRequest: (requestId: string) => `${FIRESTORE_COLLECTIONS.companyRequests}/${requestId}`,
  studentRoot: (uid: string) => `${FIRESTORE_COLLECTIONS.users}/${uid}`,
  studentDocument: (uid: string, kind: StudentDocumentKind, id: string) =>
    `${FIRESTORE_COLLECTIONS.users}/${uid}/${kind}/${id}`,
  studentEntitlement: (uid: string) => `${FIRESTORE_COLLECTIONS.users}/${uid}/entitlements/current`,
  studentCreditLedger: (uid: string, eventId: string) =>
    `${FIRESTORE_COLLECTIONS.users}/${uid}/creditLedger/${eventId}`,
} as const;

/** Firestore Rulesへ転記するための、コードからも参照できるアクセス契約。 */
export const FIRESTORE_ACCESS_CONTRACT = {
  companies: { read: "authenticated", write: "operator" },
  companySources: { read: "operator", write: "operator" },
  researchImports: { read: "operator", write: "operator" },
  billingCustomers: { read: "trusted_backend", write: "trusted_backend" },
  companyRequests: { read: "owner_or_operator", write: "owner_create_operator_review" },
  entitlements: { read: "owner", write: "trusted_backend" },
  creditLedger: { read: "owner", write: "trusted_backend" },
  studentData: { read: "owner_only", write: "owner_only" },
} as const;
