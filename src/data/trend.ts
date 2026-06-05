import type { GenreId } from './genres';
import type { ThemeId } from './themes';
import { GENRES, GENRE_BY_ID } from './genres';
import { THEMES, THEME_BY_ID } from './themes';

export type Trend = {
  genreId: GenreId;
  themeId: ThemeId;
  /** ローカル時刻ms。これより前なら期限切れ → 再生成 */
  expiresAt: number;
};

/** 1トレンドの寿命（ms）。MVPでは6分＝中盤のテンポ */
const TREND_DURATION_MS = 6 * 60 * 1000;

const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

export const newTrend = (now: number): Trend => ({
  genreId: pick(GENRES.map((g) => g.id)),
  themeId: pick(THEMES.map((t) => t.id)),
  expiresAt: now + TREND_DURATION_MS,
});

export const ensureTrend = (current: Trend | null, now: number): Trend => {
  if (current && current.expiresAt > now) return current;
  return newTrend(now);
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

export const trendLabel = (trend: Trend | null): string => {
  if (!trend) return '';
  const g = GENRE_BY_ID[trend.genreId];
  const t = THEME_BY_ID[trend.themeId];
  return `${g.emoji}${g.name} × ${t.emoji}${t.name}`;
};
