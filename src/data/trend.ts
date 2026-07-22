import type { Rng } from '../core/ports';
import type { GenreId } from './genres';
import { GENRE_BY_ID, GENRES } from './genres';
import type { ThemeId } from './themes';
import { THEME_BY_ID, THEMES } from './themes';

export type Trend = {
  genreId: GenreId;
  themeId: ThemeId;
  /** ローカル時刻ms。これより前なら期限切れ → 再生成 */
  expiresAt: number;
};

/** 1トレンドの寿命（ms）。MVPでは6分＝中盤のテンポ */
const TREND_DURATION_MS = 6 * 60 * 1000;

const pick = <T>(arr: T[], rng: Rng): T => arr[Math.floor(rng() * arr.length)];

export const newTrend = (now: number, rng: Rng = Math.random): Trend => ({
  genreId: pick(
    GENRES.map((g) => g.id),
    rng,
  ),
  themeId: pick(
    THEMES.map((t) => t.id),
    rng,
  ),
  expiresAt: now + TREND_DURATION_MS,
});

export const ensureTrend = (current: Trend | null, now: number, rng: Rng = Math.random): Trend => {
  if (current && current.expiresAt > now) return current;
  return newTrend(now, rng);
};

/**
 * 売上に掛ける係数。
 *  - ジャンル＋テーマの両方が合致: ×1.7
 *  - どちらか片方合致: ×1.3
 *  - 完全逆張り（ジャンルもテーマも違う）: ×1.0（ペナルティはなし、合致時のボーナスのみ）
 *
 * 設計書の `合致 ×1.5 / 逆張り ×0.7` は厳しすぎるためMVPは穏当版にチューニング。
 */
export const trendMultiplier = (trend: Trend | null, g: GenreId, t: ThemeId): number => {
  if (!trend) return 1.0;
  const gHit = trend.genreId === g;
  const tHit = trend.themeId === t;
  if (gHit && tHit) return 1.7;
  if (gHit || tHit) return 1.3;
  return 1.0;
};

/**
 * トレンド合致でメタスコアに直接加える点数（スコアに反映する主経路）。
 *  - ジャンル＋テーマ両方合致: +10
 *  - どちらか片方合致: +5
 *  - 合致なし: 0
 * ※ 売上への二重掛け（softBonus 側）は廃止し、トレンドは「スコアを上げて段を押し上げる」形で
 *   売上に効かせる（docs/scoring.md）。
 */
export const trendScoreBonus = (trend: Trend | null, g: GenreId, t: ThemeId): number => {
  if (!trend) return 0;
  const gHit = trend.genreId === g;
  const tHit = trend.themeId === t;
  if (gHit && tHit) return 10;
  if (gHit || tHit) return 5;
  return 0;
};

/**
 * トレンド合致で売上に掛ける倍率（控えめ・案B）。スコア側（trendScoreBonus +10/+5）とは別の
 * 穏当な上乗せで、売上にも効かせる。両方合致 ×1.10 / 片方 ×1.05 / 合致なし ×1.0。
 * ※ softBonus の +20% 共有上限の外で掛ける（表示どおり効く）。
 */
export const trendSalesMultiplier = (trend: Trend | null, g: GenreId, t: ThemeId): number => {
  if (!trend) return 1;
  const gHit = trend.genreId === g;
  const tHit = trend.themeId === t;
  if (gHit && tHit) return 1.1;
  if (gHit || tHit) return 1.05;
  return 1;
};

export const trendLabel = (trend: Trend | null): string => {
  if (!trend) return '';
  const g = GENRE_BY_ID[trend.genreId];
  const t = THEME_BY_ID[trend.themeId];
  return `${g.emoji}${g.name} × ${t.emoji}${t.name}`;
};
