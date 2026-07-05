// storage/schema.ts — 全体で共有する型定義

export type SourceSite =
  | "wantedly"
  | "onecareer"
  | "openwork"
  | "offerbox" // 予約枠: 後日OfferBox対応時に使用
  | "mynavi"
  | "unknown";

export type CompanyStatus = "queued" | "researching" | "ready_for_es" | "done";

export interface CapturedText {
  url: string;
  capturedAt: string; // ISO8601
  rawText: string;
  label?: string; // "求人詳細" | "公式HP" | "note" など任意
}

export interface StepResult {
  content: string;
  updatedAt: string; // ISO8601
}

export interface CompanyRecord {
  companyId: string;
  companyName: string;
  sourceSite: SourceSite;
  listingUrl: string;
  matchScore: number;
  status: CompanyStatus;
  jobTitle?: string;
  location?: string;
  salary?: string;
  createdAt: string; // ISO8601（古いレコード整理用）

  capturedTexts: CapturedText[];

  research: StepResult | null;      // OS① 企業研究
  schedule: StepResult | null;      // OS② 選考日程
  idealProfile: StepResult | null;  // OS③ 人物像
  esDraft: StepResult | null;       // OS④ ES/履歴書/面接対策
  updatedAt?: string; // ISO8601（クラウド同期用）
  lastCaptureError?: string;
}

export interface ScoringConditions {
  industries: string[];
  jobTitles: string[];
  locations: string[];
  priorityKeywords: string[];
  excludeKeywords: string[];
}

export interface UserProfile {
  resumeBase: string;
  strengthsSummary: string;
  basicProfile: string;
  schoolCareer: string;
  targetDirection: string;
  workPreferences: string;
}

export interface UserSettings {
  scoringConditions: ScoringConditions;
  dailyRunTime: string; // "09:00"
  userProfile: UserProfile;
  updatedAt?: string; // ISO8601（クラウド同期用）
}

export const DEFAULT_SETTINGS: UserSettings = {
  scoringConditions: {
    industries: [],
    jobTitles: [],
    locations: [],
    priorityKeywords: [],
    excludeKeywords: [],
  },
  dailyRunTime: "09:00",
  userProfile: {
    resumeBase: "",
    strengthsSummary: "",
    basicProfile: "",
    schoolCareer: "",
    targetDirection: "",
    workPreferences: "",
  },
};

// 一覧ページから抽出する求人カード
export interface JobCard {
  companyName: string;
  jobTitle: string;
  location: string;
  salary: string;
  detailUrl: string;
  snippet: string; // カード内のその他テキスト（スコアリング用）
}

// ===== メッセージング =====

export type BgMessage =
  | { type: "START_DAILY_RESEARCH" }
  | { type: "CAPTURE_ACTIVE_TAB"; companyId: string; label?: string }
  | { type: "RESCHEDULE_ALARM" };

export type CsMessage =
  | { type: "CS_LIST_RESULT"; ok: boolean; cards: JobCard[]; url: string; error?: string }
  | { type: "CS_DETAIL_RESULT"; ok: boolean; text: string; url: string; error?: string }
  | { type: "CS_PAGE_RESULT"; ok: boolean; text: string; url: string; title: string; error?: string };

export interface BgResponse {
  ok: boolean;
  message: string;
}

export const STORAGE_KEYS = {
  companies: "companies",        // storage.local
  settingsSync: "settingsSync",  // storage.sync（条件・実行時刻のみ）
  userProfile: "userProfile",    // storage.local（経歴は8KB超が普通のためsyncに置かない）
} as const;
