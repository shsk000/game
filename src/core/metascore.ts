import { normalizedWeightsFor } from '../data/archetypes';
import { METASCORE } from '../data/balance';
import type { GenreId } from '../data/genres';
import type { ThemeId } from '../data/themes';
import type { FeaturePoints } from '../state/types';
import { FEATURE_IDS } from '../state/types';
import type { Rng } from './ports';

/**
 * 特徴ポイント → メタスコア（docs/spec/score-model.md §4）。
 *
 * ```
 * メタスコア = Σ( 特徴ポイント × 正規化後の重み )
 *            ＋ 相性補正（−8〜+8）
 *            ＋ トレンド合致（両方+10 / 片方+5）
 *            ＋ 評価家のブレ（−5〜+5）
 *            → 0〜100 にクランプ
 * ```
 *
 * ⚠ **実装ステップ3 で `computeRelease` から呼ぶまで、この式は使われない。**
 */

export type MetascoreInput = {
  features: FeaturePoints;
  genreId: GenreId;
  themeId: ThemeId;
  /** ジャンル×テーマの相性（0.7〜2.0） */
  compat: number;
  /** 今月のトレンド（合致で加点） */
  trend?: { genreId?: GenreId; themeId?: ThemeId } | null;
};

export type MetascoreBreakdown = {
  /** 特徴ポイントの加重和（0〜100） */
  base: number;
  /** 各特徴ポイントの寄与（内訳表示用） */
  contributions: Record<string, number>;
  compatBonus: number;
  trendBonus: number;
  criticVariance: number;
  metascore: number;
};

/** 相性（0.7〜2.0）→ 相性補正（−8〜+8） */
export const compatBonusFor = (compat: number): number => {
  const { center, span, max } = METASCORE.compat;
  const raw = ((compat - center) / span) * max;
  return Math.round(Math.max(-max, Math.min(max, raw)) * 10) / 10;
};

/** トレンド合致（両方 +10 / 片方 +5 / なし 0） */
export const trendBonusFor = (
  genreId: GenreId,
  themeId: ThemeId,
  trend?: { genreId?: GenreId; themeId?: ThemeId } | null,
): number => {
  if (!trend) return 0;
  const hits = (trend.genreId === genreId ? 1 : 0) + (trend.themeId === themeId ? 1 : 0);
  if (hits >= 2) return METASCORE.trend.both;
  if (hits === 1) return METASCORE.trend.one;
  return 0;
};

/**
 * 評価家のブレ（−5〜+5）。
 * **同じ作りでも毎回ぶれる**のが中毒の肝（game-design §5）。
 * ヒット区分をまたぐほどの幅は持たせない。
 */
export const criticVarianceFor = (rng: Rng): number => {
  const { variance } = METASCORE;
  return Math.round((rng() * 2 - 1) * variance * 10) / 10;
};

export const computeMetascore = (input: MetascoreInput, rng: Rng): MetascoreBreakdown => {
  const weights = normalizedWeightsFor(input.genreId);
  const raw = FEATURE_IDS.map((id) => input.features[id] * weights[id]);
  const base = Math.round(raw.reduce((a, b) => a + b, 0) * 10) / 10;

  // 内訳は**合計が base に一致する**ように出す（表示と計算が食い違わないため）。
  // 単純に各項を丸めると誤差が積もり、内訳を足しても本体と合わなくなる。
  const contributions: Record<string, number> = {};
  let acc = 0;
  FEATURE_IDS.forEach((id, i) => {
    if (i === FEATURE_IDS.length - 1) {
      contributions[id] = Math.round((base - acc) * 10) / 10;
      return;
    }
    const v = Math.round(raw[i] * 10) / 10;
    contributions[id] = v;
    acc = Math.round((acc + v) * 10) / 10;
  });

  const compatBonus = compatBonusFor(input.compat);
  const trendBonus = trendBonusFor(input.genreId, input.themeId, input.trend);
  const criticVariance = criticVarianceFor(rng);

  const metascore = Math.max(
    0,
    Math.min(100, Math.round(base + compatBonus + trendBonus + criticVariance)),
  );

  return { base, contributions, compatBonus, trendBonus, criticVariance, metascore };
};
