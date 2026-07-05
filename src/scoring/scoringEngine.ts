// scoring/scoringEngine.ts — 条件マッチングによるスコア計算（ルールベース・AI不要）
import { JobCard, ScoringConditions } from "../storage/schema";
import { DAILY_QUEUE_SIZE, MIN_QUALIFYING_SCORE, SCORING_WEIGHTS as W } from "./scoringRules";

export interface ScoredCard {
  card: JobCard;
  score: number;
  reasons: string[]; // UIでスコア根拠を表示するため
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, "");

function includesKw(haystack: string, kw: string): boolean {
  const k = norm(kw);
  return k.length > 0 && norm(haystack).includes(k);
}

export function scoreCard(card: JobCard, cond: ScoringConditions): ScoredCard {
  let score = 0;
  const reasons: string[] = [];
  const body = `${card.snippet} ${card.salary} ${card.companyName}`;

  for (const kw of cond.jobTitles) {
    if (includesKw(card.jobTitle, kw)) {
      score += W.jobTitleInTitle;
      reasons.push(`職種「${kw}」がタイトルに一致 +${W.jobTitleInTitle}`);
    } else if (includesKw(body, kw)) {
      score += W.jobTitleInBody;
      reasons.push(`職種「${kw}」が本文に一致 +${W.jobTitleInBody}`);
    }
  }

  for (const kw of cond.priorityKeywords) {
    if (includesKw(`${card.jobTitle} ${body}`, kw)) {
      score += W.priorityKeyword;
      reasons.push(`優先「${kw}」+${W.priorityKeyword}`);
    }
  }

  for (const kw of cond.industries) {
    if (includesKw(`${card.jobTitle} ${body}`, kw)) {
      score += W.industryKeyword;
      reasons.push(`業界「${kw}」+${W.industryKeyword}`);
    }
  }

  for (const loc of cond.locations) {
    if (includesKw(card.location, loc)) {
      score += W.locationMatch;
      reasons.push(`勤務地「${loc}」一致 +${W.locationMatch}`);
      break; // 勤務地は1回だけ加点
    }
  }

  for (const kw of cond.excludeKeywords) {
    if (includesKw(`${card.jobTitle} ${body} ${card.location}`, kw)) {
      score += W.excludeKeyword;
      reasons.push(`除外「${kw}」検出 ${W.excludeKeyword}`);
      break;
    }
  }

  return { card, score, reasons };
}

/** 一覧カード群をスコアリングし、企業名で重複排除して上位N件を返す */
export function selectTopCandidates(
  cards: JobCard[],
  cond: ScoringConditions,
  limit = DAILY_QUEUE_SIZE
): ScoredCard[] {
  const scored = cards.map((c) => scoreCard(c, cond));
  const seen = new Set<string>();
  const result: ScoredCard[] = [];
  for (const s of scored.sort((a, b) => b.score - a.score)) {
    if (s.score < MIN_QUALIFYING_SCORE) continue;
    const key = norm(s.card.companyName) || s.card.detailUrl;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(s);
    if (result.length >= limit) break;
  }
  // 条件未設定などで1件も選ばれない場合は、先頭からlimit件を返す（ゼロ件で止めない）
  if (result.length === 0 && cards.length > 0) {
    return scored.slice(0, limit).map((s) => ({
      ...s,
      reasons: [...s.reasons, "条件一致なし（暫定選出）"],
    }));
  }
  return result;
}
