import type { GenreId } from '../data/genres';
import type { ThemeId } from '../data/themes';
import type { Scale } from '../data/scales';
import { SCALE_BY_ID } from '../data/scales';
import { getCompat } from '../data/compatibility';

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export type MetascoreResult = {
  metascore: number;
  isMasterpiece: boolean;
};

export const computeMetascore = (
  quality: number,
  genreId: GenreId,
  themeId: ThemeId,
): MetascoreResult => {
  const compat = getCompat(genreId, themeId);
  const base = quality * compat;
  const variance = (Math.random() - 0.5) * 10;
  const isMasterpiece = Math.random() < 0.03;
  const bonus = isMasterpiece ? 25 : 0;
  return {
    metascore: Math.round(clamp(base + variance + bonus, 0, 100)),
    isMasterpiece,
  };
};

export const computeRevenue = (
  metascore: number,
  genreId: GenreId,
  themeId: ThemeId,
  scale: Scale,
): number => {
  const compat = getCompat(genreId, themeId);
  const base = SCALE_BY_ID[scale].baseUnit;
  return Math.round(base * (metascore / 50) * compat);
};

export const scoreFlavor = (m: number): string => {
  if (m >= 90) return '今年の傑作';
  if (m >= 70) return '良作';
  if (m >= 50) return '平凡';
  if (m >= 30) return '惜しい';
  return 'バグだらけ';
};

export const polishToQuality = (baseQuality: number, polishLoC: number): number => {
  return Math.min(100, Math.round(baseQuality + polishLoC * 3));
};
