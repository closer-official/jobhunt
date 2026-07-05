// scoring/scoringRules.ts — 加点/減点ルールの定義（数値はここだけを触れば調整できる）

export const SCORING_WEIGHTS = {
  jobTitleInTitle: 3,      // 職種キーワードが求人タイトルに含まれる
  jobTitleInBody: 1,       // 職種キーワードが本文（スニペット）に含まれる
  priorityKeyword: 2,      // 優先キーワードが本文に含まれる（キーワードごと）
  locationMatch: 2,        // 勤務地が条件と一致
  industryKeyword: 1,      // 業界キーワードが本文に含まれる（キーワードごと）
  excludeKeyword: -100,    // 除外キーワードが含まれる（実質除外）
} as const;

/** このスコア未満の求人はキュー対象外（除外キーワードにより負値になったもの等） */
export const MIN_QUALIFYING_SCORE = 1;

/** 1日にキューへ入れる上限件数 */
export const DAILY_QUEUE_SIZE = 10;
