import {
  LUCK_DEFAULT,
  QUALITY_WEIGHTS,
  SCALE_BALANCE,
  SCORE_BASE,
  salesMultiplierForScore,
} from '../data/balance';
import type { GenreId } from '../data/genres';
import type { Scale } from '../data/scales';
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
  // v0.10 仕上げ：compat / trend ブーストは quality（4 要素）と revenue 側に
  // 既に組み込み済み。ここでは ±5 の評価家ブレのみ加える。
  // 旧仕様の「3% 確率で名作 +25」は廃止。名作タイル（90-94）は SCORE_TIERS の自然分布で実現。
  const trendBoost = (trendMultiplier(trend, genreId, themeId) - 1) * 5;
  const variance = (Math.random() - 0.5) * 10;
  const metascore = Math.round(clamp(quality + trendBoost + variance, 0, 100));
  // isMasterpiece は metascore 90+ の自然到達で判定（後方互換のため残す）
  const isMasterpiece = metascore >= 90;
  return { metascore, isMasterpiece };
};

/**
 * v0.10 仕上げ §5-2：メタスコア帯による売上倍率。
 * balance.ts の SALES_MULTIPLIER_BY_SCORE を利用（致命的失敗 ×0.33 〜 神ゲー ×1000）。
 *
 * 旧 4 段階（1 / 4 / 10 / 30）の hitTierMultiplier は廃止し、salesMultiplierForScore に統一。
 */
export const hitTierMultiplier = (metascore: number): number =>
  salesMultiplierForScore(metascore);

/**
 * v0.10 仕上げ §5-1, §5-2：売上計算。
 *
 *   revenue = baseRevenue × salesMultiplierForScore(metascore) × softBonus
 *
 *   softBonus は trend / fan / launch / pr / pioneer の合算で最大 +50%（×1.5）にキャップ。
 *
 * 旧バージョンは compat / trend / fan / launch / pr / pioneer を全て乗算でかけていたため、
 * normal 帯（×16.67）でも合算で ×5〜10 になり、設計の「mini normal ¥500 万」が
 * 簡単に ¥2000-5000 万に化けて「余裕でプラス」になっていた。
 *
 * 対策：
 *   1. compat は既に genreAffinity → quality → metascore 経由で組み込み済み → ここでは掛けない
 *   2. trend / fan / launch / pr / pioneer は合算してから +50% でキャップ
 *      → tier 表（balance-design §5-2）の数値が「実売上の上限の 2/3」になる程度に抑える
 */
export const computeRevenue = (
  metascore: number,
  _genreId: GenreId,
  _themeId: ThemeId,
  scale: Scale,
  trend: Trend | null,
  fans: number,
  launchAdActive: boolean,
  prBonus = 0,
  pioneerBonus = 0,
): number => {
  const baseRevenue = SCALE_BALANCE[scale].baseRevenue;
  const tierMul = salesMultiplierForScore(metascore);

  // 各ソフトボーナス（負の値もあり、最終的に合算）
  // v0.10 仕上げ：上限を +50% → +20% に圧縮（hit 帯がさらに ×1.5 で +¥1500 万嵩上げされていた問題）
  const trendBonus = Math.max(-0.15, trendMultiplier(trend, _genreId, _themeId) - 1);
  const fanBonus = Math.min(0.15, Math.sqrt(Math.max(0, fans)) / 400); // ファン 10000 で +0.15 上限
  const launchBonus = launchAdActive ? 0.1 : 0;
  const totalBonus = trendBonus + fanBonus + launchBonus + prBonus + pioneerBonus;
  const softMul = 1 + Math.max(-0.3, Math.min(0.2, totalBonus));

  const v = baseRevenue * tierMul * softMul;
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
 * タイピング演技スコア（0..100）。
 *
 * v0.14 辛口化（ウェイト 37% への引き上げとセット。緩いままだと適当プレイが逆に得をする）：
 *   base = SCORE_BASE (30) — 4 要素全体で統一
 *   + WPM 寄与（120 基準で -25〜+30。旧: 100 基準 ±20）
 *   + コンボ寄与（50+ で +5、150+ で +10、300+ で +18、600+ で +25。旧: 30/100/200/500）
 *   - 精度ペナルティ（97% 未満で線形に -25 まで。旧: 95% 未満 -20）
 *   + バグなし完走 +5
 *
 * 結果レンジ：下手 5-25 / 普通 30-45 / 上手 65-90
 * タイピング能力が「勝負を分ける」設計（品質の 37% を握る最大レバー）。
 */
export const computePerformanceScore = (perf: {
  wpm: number;
  maxCombo: number;
  accuracy: number;
  bugsCleared?: number;
  noBugs?: boolean;
}): number => {
  let score = SCORE_BASE;

  // WPM 寄与（120 基準 -25〜+30）
  if (perf.wpm <= 0) score -= 5;
  else {
    const t = clamp((perf.wpm - 120) / 120, -1, 1);
    score += t * (t >= 0 ? 30 : 25);
  }

  // コンボ寄与
  if (perf.maxCombo >= 600) score += 25;
  else if (perf.maxCombo >= 300) score += 18;
  else if (perf.maxCombo >= 150) score += 10;
  else if (perf.maxCombo >= 50) score += 5;

  // 精度ペナルティ（97% 未満から効く）
  if (perf.accuracy < 0.97) {
    const def = (0.97 - perf.accuracy) / 0.97; // 0..1
    score -= clamp(def * 60, 0, 25);
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
  const luck = clamp(args.luck ?? LUCK_DEFAULT, 0, 100);

  // ウェイト（balance-design §0、QUALITY_WEIGHTS）
  const base =
    charPower * QUALITY_WEIGHTS.charPower +
    genreAffinity * QUALITY_WEIGHTS.genreAffinity +
    typingScore * QUALITY_WEIGHTS.typingScore +
    luck * QUALITY_WEIGHTS.luck;

  // ±3% の運乱数（v0.14：±10%→±3%。運は味付けに留め、壁は腕で越えさせる）
  const luckMultiplier = 0.97 + Math.random() * 0.06;

  // 神ゲーガチャは v0.10 で廃止：4 要素の合算とタイピング演技で正面突破する設計
  const Q = clamp(Math.round(base * luckMultiplier), 0, 100);
  return {
    Q,
    breakdown: {
      charPower,
      genreAffinity,
      typingScore,
      luck,
      base: Math.round(base),
      luckMultiplier: Math.round(luckMultiplier * 100) / 100,
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
