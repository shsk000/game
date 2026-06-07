import { getCompat } from '../data/compatibility';
import type { GenreId } from '../data/genres';
import type { Scale } from '../data/scales';
import { SCALE_BY_ID } from '../data/scales';
import type { ThemeId } from '../data/themes';
import type { Trend } from '../data/trend';
import { trendMultiplier } from '../data/trend';

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export type MetascoreResult = {
  metascore: number;
  isMasterpiece: boolean;
};

export const computeMetascore = (
  quality: number,
  genreId: GenreId,
  themeId: ThemeId,
  trend: Trend | null,
): MetascoreResult => {
  const compat = getCompat(genreId, themeId);
  const trendBoost = (trendMultiplier(trend, genreId, themeId) - 1) * 10;
  const base = quality * Math.min(1.0, compat * 0.85) + trendBoost;
  const variance = (Math.random() - 0.5) * 10;
  const isMasterpiece = Math.random() < 0.03;
  const bonus = isMasterpiece ? 25 : 0;
  return {
    metascore: Math.round(clamp(base + variance + bonus, 0, 100)),
    isMasterpiece,
  };
};

/**
 * 売上計算。広報ボーナス・新規開拓ボーナスを加味。
 */
export const computeRevenue = (
  metascore: number,
  genreId: GenreId,
  themeId: ThemeId,
  scale: Scale,
  trend: Trend | null,
  fans: number,
  launchAdActive: boolean,
  prBonus = 0,
  pioneerBonus = 0,
): number => {
  const compat = getCompat(genreId, themeId);
  const def = SCALE_BY_ID[scale];
  const locMul = 1 + Math.log(def.requiredLoC / 8);
  const trendMul = trendMultiplier(trend, genreId, themeId);
  const fanMul = 1 + Math.sqrt(Math.max(0, fans)) / 50;
  const launchMul = launchAdActive ? 1.5 : 1.0;
  const prMul = 1 + prBonus;
  const pioneerMul = 1 + pioneerBonus;
  const v =
    def.baseUnit *
    locMul *
    (metascore / 50) *
    compat *
    trendMul *
    fanMul *
    launchMul *
    prMul *
    pioneerMul;
  return Math.max(0, Math.round(v));
};

export const scoreFlavor = (m: number): string => {
  if (m >= 90) return '今年の傑作';
  if (m >= 70) return '良作';
  if (m >= 50) return '平凡';
  if (m >= 30) return '惜しい';
  return 'バグだらけ';
};

export type QualityBreakdown = {
  base: number;
  categories: number;
  employees: number;
  performance: number;
  ads: number;
  variance: number;
};

/**
 * 4レバー方式の品質計算。
 *   Q = 30 + cap(20, cat) + cap(25, emp) + cap(20, perf) + cap(15, ad) + variance(±5)
 */
export const computeQuality = (args: {
  scaleBase: number;
  categoryHit: number;
  employeeHit: number;
  performance: number;
  adBonus: number;
}): { Q: number; breakdown: QualityBreakdown } => {
  const base = 30;
  const categories = Math.max(0, Math.min(20, args.categoryHit));
  const employees = Math.max(0, Math.min(25, args.employeeHit));
  const performance = Math.max(0, Math.min(20, args.performance));
  const ads = Math.max(0, Math.min(15, args.adBonus));
  const variance = Math.round((Math.random() - 0.5) * 10); // ±5
  const sum = base + categories + employees + performance + ads + variance;
  const Q = clamp(sum, 0, 100);
  return {
    Q: Math.round(Q),
    breakdown: { base, categories, employees, performance, ads, variance },
  };
};

/**
 * タイピングパフォーマンスから 0..20 のスコアを算出。
 *   wpm/10 (0..7) + maxCombo/15 (0..7) + accuracy*6 (0..6 → cap 7) → 合計を 0..20 にクランプ
 */
export const computePerformanceScore = (perf: {
  wpm: number;
  maxCombo: number;
  accuracy: number;
}): number => {
  const wpmPart = clamp(perf.wpm / 10, 0, 7);
  const comboPart = clamp(perf.maxCombo / 15, 0, 7);
  const accPart = clamp(perf.accuracy * 6, 0, 7);
  return clamp(Math.round(wpmPart + comboPart + accPart), 0, 20);
};

/** リリース時のファン増分。広報ボーナスで底上げ */
export const fanDelta = (metascore: number, prBonus = 0): number => {
  let base: number;
  if (metascore >= 90) base = 80;
  else if (metascore >= 70) base = 40;
  else if (metascore >= 50) base = 15;
  else if (metascore >= 30) base = 0;
  else base = -5;
  if (base <= 0) return base;
  return Math.round(base * (1 + prBonus));
};
