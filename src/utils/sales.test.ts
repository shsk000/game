import { describe, expect, it } from 'vitest';
import type { Work } from '../state/types';
import { decayRateFor, INITIAL_SHARE, settleAllWorks, settlePool } from './sales';

describe('decayRateFor', () => {
  it('メタスコアが高いほど減衰率が下がる（人気が長持ちする）', () => {
    expect(decayRateFor(30)).toBeGreaterThan(decayRateFor(70));
    expect(decayRateFor(70)).toBeGreaterThan(decayRateFor(100));
  });

  it('式どおり：メタ0 → 0.038、メタ100 → 下限 0.010', () => {
    expect(decayRateFor(0)).toBeCloseTo(0.038);
    expect(decayRateFor(100)).toBeCloseTo(0.01);
  });

  it('範囲外の入力は 0..100 にクランプされる', () => {
    expect(decayRateFor(-50)).toBeCloseTo(decayRateFor(0));
    expect(decayRateFor(999)).toBeCloseTo(decayRateFor(100));
  });
});

describe('settlePool', () => {
  it('pool・decay・awaySec のいずれかが 0 以下なら支払いゼロ', () => {
    expect(settlePool(0, 0.02, 10)).toEqual({ payout: 0, remaining: 0, sold: true });
    expect(settlePool(1000, 0, 10)).toEqual({ payout: 0, remaining: 1000, sold: false });
    expect(settlePool(1000, 0.02, 0)).toEqual({ payout: 0, remaining: 1000, sold: false });
  });

  it('連続減衰モデル：pool × (1 - e^-decay·t) を取り出す', () => {
    const r = settlePool(1000, 0.1, 10); // ratio = 1 - e^-1 ≈ 0.6321
    expect(r.payout).toBe(632);
    expect(r.remaining).toBe(368);
    expect(r.sold).toBe(false);
  });

  it('十分長い時間で残額 0.5 未満になると sold', () => {
    const r = settlePool(1000, 0.1, 120);
    expect(r.remaining).toBeLessThan(0.5);
    expect(r.sold).toBe(true);
  });

  it('経過時間は capSec で打ち切られる', () => {
    const capped = settlePool(1000, 0.001, 999_999_999, 100);
    const exact = settlePool(1000, 0.001, 100);
    expect(capped).toEqual(exact);
  });

  it('payout + remaining が元の pool を超えない', () => {
    const r = settlePool(12345, 0.05, 33);
    expect(r.payout + r.remaining).toBeLessThanOrEqual(12345);
    expect(r.remaining).toBeGreaterThanOrEqual(0);
  });
});

describe('settleAllWorks', () => {
  const baseWork = (over: Partial<Work>): Work => ({
    id: 'w1',
    title: 'テスト作',
    genreId: 'action',
    themeId: 'ninja',
    scale: 'mini',
    quality: 50,
    metascore: 60,
    isMasterpiece: false,
    developSec: 60,
    initialRevenue: 100,
    salesPool: 1000,
    initialSalesPool: 1000,
    decayPerSec: 0.1,
    totalRevenue: 100,
    selling: true,
    fansGained: 0,
    ghostBeaten: false,
    launchAdUsed: false,
    pioneer: false,
    releasedAt: 0,
    createdAt: 0,
    breakdown: {},
    ...over,
  });

  it('販売中の作品から売上を回収し、totalRevenue に積む', () => {
    const { earned, library } = settleAllWorks([baseWork({})], 10);
    expect(earned).toBe(632);
    expect(library[0].salesPool).toBe(368);
    expect(library[0].totalRevenue).toBe(100 + 632);
    expect(library[0].selling).toBe(true);
  });

  it('販売終了作品・プール空の作品は変更しない', () => {
    const done = baseWork({ id: 'w2', selling: false });
    const empty = baseWork({ id: 'w3', salesPool: 0 });
    const { earned, library } = settleAllWorks([done, empty], 10);
    expect(earned).toBe(0);
    expect(library[0]).toBe(done);
    expect(library[1]).toBe(empty);
  });

  it('売り切ったら selling が false になる', () => {
    const { library } = settleAllWorks([baseWork({})], 1_000);
    expect(library[0].selling).toBe(false);
  });
});

describe('INITIAL_SHARE', () => {
  it('初動の割合は 0..1 の範囲', () => {
    expect(INITIAL_SHARE).toBeGreaterThan(0);
    expect(INITIAL_SHARE).toBeLessThan(1);
  });
});
