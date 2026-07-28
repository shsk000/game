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

  // **画面に出す値をそのまま計算に使う。**
  //
  // 内訳（小数1桁に丸めた各項）の合計を base とし、丸めで生じた差は
  // 最大の項に寄せる。こうすると「内訳を足したら必ず本体になる」が
  // 浮動小数の誤差なしで成り立つ。
  // 単純に各項を丸めるだけだと合計が 100.1 になり（実測）、
  // 逆に先に合計を丸めると境界（.5）でメタスコアが1点ずれる。
  const rounded = raw.map((v) => Math.round(v * 10) / 10);
  const exact = Math.round(raw.reduce((a, b) => a + b, 0) * 10) / 10;
  const drift = Math.round((exact - rounded.reduce((a, b) => a + b, 0)) * 10) / 10;
  if (drift !== 0) {
    let maxIdx = 0;
    for (let i = 1; i < rounded.length; i++) if (rounded[i] > rounded[maxIdx]) maxIdx = i;
    rounded[maxIdx] = Math.round((rounded[maxIdx] + drift) * 10) / 10;
  }
  const contributions: Record<string, number> = {};
  FEATURE_IDS.forEach((id, i) => {
    contributions[id] = rounded[i];
  });
  // base は**丸めた内訳の合計そのもの**にする（exact ではなく）。
  // exact を使うと浮動小数の誤差が残り、画面の内訳を足した値と 0.0001 ずれる。
  const base = Math.round(rounded.reduce((a, b) => a + b, 0) * 10) / 10;

  const compatBonus = compatBonusFor(input.compat);
  const trendBonus = trendBonusFor(input.genreId, input.themeId, input.trend);
  const criticVariance = criticVarianceFor(rng);

  const metascore = Math.max(
    0,
    Math.min(100, Math.round(base + compatBonus + trendBonus + criticVariance)),
  );

  return { base, contributions, compatBonus, trendBonus, criticVariance, metascore };
};
