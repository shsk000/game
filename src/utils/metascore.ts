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
 * v0.10 §4-3：メタスコア帯による売上倍率（ヒット帯ステップ）。
 *  - m < 70  → 1.0
 *  - m ≥ 70  → 4.0   ヒット
 *  - m ≥ 85  → 10.0  大ヒット
 *  - m ≥ 95  → 30.0  神ゲー帯
 */
export const hitTierMultiplier = (metascore: number): number => {
  if (metascore >= 95) return 30;
  if (metascore >= 85) return 10;
  if (metascore >= 70) return 4;
  return 1;
};

/**
 * 売上計算。広報ボーナス・新規開拓ボーナスを加味。
 * v0.10：従来の `metascore / 50` 線形項を `hitTierMultiplier` のステップに置換。
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
  const tierMul = hitTierMultiplier(metascore);
  const v =
    def.baseUnit * locMul * tierMul * compat * trendMul * fanMul * launchMul * prMul * pioneerMul;
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
 * v0.10 §2-2：タイピング演技スコア（0..100）。
 *
 *   base = 50（中庸プレイヤー）
 *   ± WPM 寄与（100 を基準に ±20 程度）
 *   ± コンボ寄与（30+ で +5, 100+ で +10, 200+ で +15, 500+ で +25）
 *   ± 精度ペナルティ（95% 未満で線形に -20 まで）
 *   + バグなし完走 +5
 *
 * 旧 0..20 スケール版は廃止（呼び出し側は `releaseWork` のみで、こちらに移行）。
 */
export const computePerformanceScore = (perf: {
  wpm: number;
  maxCombo: number;
  accuracy: number;
  bugsCleared?: number;
  noBugs?: boolean;
}): number => {
  let score = 50;

  // WPM 寄与（100 基準 ±20）
  if (perf.wpm <= 0) score -= 5;
  else {
    const wpmDelta = clamp((perf.wpm - 100) / 100, -1, 1) * 20;
    score += wpmDelta;
  }

  // コンボ寄与
  if (perf.maxCombo >= 500) score += 25;
  else if (perf.maxCombo >= 200) score += 15;
  else if (perf.maxCombo >= 100) score += 10;
  else if (perf.maxCombo >= 30) score += 5;

  // 精度ペナルティ
  if (perf.accuracy < 0.95) {
    const def = (0.95 - perf.accuracy) / 0.95; // 0..1
    score -= clamp(def * 40, 0, 20);
  }

  // バグなし完走
  if (perf.noBugs) score += 5;

  return clamp(Math.round(score), 0, 100);
};

/**
 * v0.10：4要素ウェイト品質計算式。
 *
 *   quality_base = キャラ能力 × 0.50
 *                + ジャンル相性 × 0.25
 *                + タイピング演技 × 0.15
 *                + 0.10（運の基底）
 *   final_quality = quality_base × 運乱数(0.9〜1.1) × ガチャ(5%で×1.5)
 *
 * 各入力スコアは 0..100 で正規化されている前提。
 * 出力 Q は 0..100 にクランプ。
 *
 * @param charPower      キャラ能力スコア 0..100（採用 × アサインの主ドライバー）
 * @param genreAffinity  ジャンル相性スコア 0..100
 * @param typingScore    タイピング演技スコア 0..100
 * @param luck           運の基底に乗る揺らぎ要素 0..100（省略時は 50＝中庸）
 */
export type QualityV10Breakdown = {
  charPower: number;
  genreAffinity: number;
  typingScore: number;
  luck: number;
  base: number;
  luckMultiplier: number;
  isGodGame: boolean;
};

export const computeQualityV10 = (args: {
  charPower: number;
  genreAffinity: number;
  typingScore: number;
  luck?: number;
}): { Q: number; breakdown: QualityV10Breakdown } => {
  const charPower = clamp(args.charPower, 0, 100);
  const genreAffinity = clamp(args.genreAffinity, 0, 100);
  const typingScore = clamp(args.typingScore, 0, 100);
  const luck = clamp(args.luck ?? 50, 0, 100);

  // ウェイトは spec.md §2-0 の通り（50/25/15/10）
  const base = charPower * 0.5 + genreAffinity * 0.25 + typingScore * 0.15 + luck * 0.1;

  // ±10% の運乱数
  const luckMultiplier = 0.9 + Math.random() * 0.2;
  // 5% で神ゲーガチャ（×1.5）
  const isGodGame = Math.random() < 0.05;
  const gachaMul = isGodGame ? 1.5 : 1.0;

  const Q = clamp(Math.round(base * luckMultiplier * gachaMul), 0, 100);
  return {
    Q,
    breakdown: {
      charPower,
      genreAffinity,
      typingScore,
      luck,
      base: Math.round(base),
      luckMultiplier: Math.round(luckMultiplier * 100) / 100,
      isGodGame,
    },
  };
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
