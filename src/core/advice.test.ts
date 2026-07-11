import { describe, expect, it } from 'vitest';
import type { Work } from '../state/types';
import {
  ADVICE_ALL_GOOD,
  ADVICE_CHAR_POWER,
  ADVICE_GENRE_AFFINITY,
  ADVICE_PERFORMANCE,
  adviceFor,
} from './advice';

const work = (breakdown: Work['breakdown']): Work =>
  ({
    id: 'w',
    title: 't',
    genreId: 'puzzle',
    themeId: 'sushi',
    scale: 'mini',
    quality: 50,
    metascore: 50,
    isMasterpiece: false,
    developSec: 1,
    initialRevenue: 0,
    salesPool: 0,
    initialSalesPool: 0,
    decayPerSec: 0,
    totalRevenue: 0,
    selling: false,
    fansGained: 0,
    ghostBeaten: false,
    launchAdUsed: false,
    pioneer: false,
    releasedAt: 0,
    createdAt: 0,
    breakdown,
  }) as Work;

describe('adviceFor（最大のボトルネックを1つだけ指摘）', () => {
  it('キャラ能力が最小 → 育成・採用のアドバイス', () => {
    expect(adviceFor(work({ charPower: 20, genreAffinity: 40, performance: 60 }))).toBe(
      ADVICE_CHAR_POWER,
    );
  });

  it('相性が最小 → 図鑑のアドバイス', () => {
    expect(adviceFor(work({ charPower: 50, genreAffinity: 10, performance: 60 }))).toBe(
      ADVICE_GENRE_AFFINITY,
    );
  });

  it('タイピングが最小 → 正確に打とう', () => {
    expect(adviceFor(work({ charPower: 50, genreAffinity: 40, performance: 20 }))).toBe(
      ADVICE_PERFORMANCE,
    );
  });

  it('全要素が高水準（最小 ≥ 70）→ 死角なし', () => {
    expect(adviceFor(work({ charPower: 80, genreAffinity: 75, performance: 90 }))).toBe(
      ADVICE_ALL_GOOD,
    );
  });

  it('同点時の優先順位はキャラ能力 → 相性 → タイピング', () => {
    expect(adviceFor(work({ charPower: 30, genreAffinity: 30, performance: 30 }))).toBe(
      ADVICE_CHAR_POWER,
    );
    expect(adviceFor(work({ charPower: 60, genreAffinity: 30, performance: 30 }))).toBe(
      ADVICE_GENRE_AFFINITY,
    );
  });
});
