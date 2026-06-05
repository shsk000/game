import type { GenreId } from '../data/genres';
import type { ThemeId } from '../data/themes';
import type { Scale } from '../data/scales';
import { SCALE_BY_ID } from '../data/scales';
import { getCompat } from '../data/compatibility';
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
  const trendBoost = (trendMultiplier(trend, genreId, themeId) - 1) * 10; // +0, +3, +7
  const base = quality * Math.min(1.0, compat * 0.85) + trendBoost;
  const variance = (Math.random() - 0.5) * 10; // ±5
  const isMasterpiece = Math.random() < 0.03;
  const bonus = isMasterpiece ? 25 : 0;
  return {
    metascore: Math.round(clamp(base + variance + bonus, 0, 100)),
    isMasterpiece,
  };
};

/**
 * 売上計算（設計書 7-E）。
 *   売上 = 基礎単価 × 必要LoC係数 × (メタ/50) × 相性 × トレンド × ファン係数
 * MVPでは:
 *   - 基礎単価 = baseUnit
 *   - 必要LoC係数 = 1 + ln(requiredLoC/8)   ※miniを1.0基準にした緩やかな増加
 *   - ファン係数 = 1 + sqrt(fans) / 50
 */
export const computeRevenue = (
  metascore: number,
  genreId: GenreId,
  themeId: ThemeId,
  scale: Scale,
  trend: Trend | null,
  fans: number,
  launchAdActive: boolean,
): number => {
  const compat = getCompat(genreId, themeId);
  const def = SCALE_BY_ID[scale];
  const locMul = 1 + Math.log(def.requiredLoC / 8);
  const trendMul = trendMultiplier(trend, genreId, themeId);
  const fanMul = 1 + Math.sqrt(Math.max(0, fans)) / 50;
  const launchMul = launchAdActive ? 1.5 : 1.0;
  const v = def.baseUnit * locMul * (metascore / 50) * compat * trendMul * fanMul * launchMul;
  return Math.max(0, Math.round(v));
};

export const scoreFlavor = (m: number): string => {
  if (m >= 90) return '今年の傑作';
  if (m >= 70) return '良作';
  if (m >= 50) return '平凡';
  if (m >= 30) return '惜しい';
  return 'バグだらけ';
};

/**
 * ポリッシュによる品質上昇（逓減カーブ）。
 *   Q = base + (100 - base) × (1 - exp(-polishLoC / TAU))
 *   TAU=30 ⇒ 30LoC磨くと残差の約63%、60LoCで約86%が埋まる。
 * → Q90 以降が指数的に伸びにくい＝「どこで切り上げるか」の判断が生まれる
 */
export const polishToQuality = (
  baseQuality: number,
  polishLoC: number,
  comboBonus = 0,
): number => {
  const TAU = 30;
  const effective = polishLoC * (1 + comboBonus);
  const ratio = 1 - Math.exp(-effective / TAU);
  const q = baseQuality + (100 - baseQuality) * ratio;
  return Math.min(100, Math.round(q));
};

/** リリース時のファン増分。メタが高いほどジワッと、低いと減ることもある */
export const fanDelta = (metascore: number): number => {
  if (metascore >= 90) return 80;
  if (metascore >= 70) return 40;
  if (metascore >= 50) return 15;
  if (metascore >= 30) return 0;
  return -5;
};
