import { describe, expect, it } from 'vitest';
import { getCompat } from '../data/compatibility';
import { GENRES } from '../data/genres';
import { THEMES } from '../data/themes';
import { computeGenreAffinityScore } from './affinity';

describe('computeGenreAffinityScore', () => {
  it('全ジャンル×全テーマでスコアは 0..100 の整数', () => {
    for (const g of GENRES) {
      for (const t of THEMES) {
        const { score, breakdown } = computeGenreAffinityScore({
          genreId: g.id,
          themeId: t.id,
        });
        expect(Number.isInteger(score)).toBe(true);
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(100);
        expect(breakdown.compat).toBe(getCompat(g.id, t.id));
      }
    }
  });

  it('compat の連続マッピング：compat 1.0 → 23 点相当の式', () => {
    // score = round((compat - 0.7) / 1.3 × 100)
    for (const [g, t] of [
      ['action', 'ninja'],
      ['puzzle', 'sushi'],
      ['horror', 'zombie'],
    ] as const) {
      const compat = getCompat(g, t);
      const expected = Math.round(Math.max(0, Math.min(100, ((compat - 0.7) / 1.3) * 100)));
      expect(computeGenreAffinityScore({ genreId: g, themeId: t }).score).toBe(expected);
    }
  });

  it('神組合せ（horror×zombie）はミスマッチ（horror×会社員）より高スコア', () => {
    const divine = computeGenreAffinityScore({ genreId: 'horror', themeId: 'zombie' });
    const mismatch = computeGenreAffinityScore({ genreId: 'horror', themeId: 'salaryman' });
    expect(divine.score).toBeGreaterThan(mismatch.score);
  });
});
