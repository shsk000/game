import { describe, expect, it } from 'vitest';
import { SALES_MULTIPLIER_BY_SCORE, SCALE_BALANCE } from '../data/balance';
import type { Trend } from '../data/trend';
import { trendSalesMultiplier, trendScoreBonus } from '../data/trend';
import {
  computeRevenue,
  fanDelta,
} from './metascore';

// rng を固定して決定的にテストする（testing-rules §2）

describe('trendScoreBonus（トレンドはスコアに反映）', () => {
  const trend: Trend = { genreId: 'action', themeId: 'ninja', expiresAt: Number.MAX_SAFE_INTEGER };
  it('スコア：両方合致 +10 / 片方 +5 / 不一致 0 / トレンドなし 0', () => {
    expect(trendScoreBonus(trend, 'action', 'ninja')).toBe(10);
    expect(trendScoreBonus(trend, 'action', 'sushi')).toBe(5);
    expect(trendScoreBonus(trend, 'puzzle', 'ninja')).toBe(5);
    expect(trendScoreBonus(trend, 'puzzle', 'sushi')).toBe(0);
    expect(trendScoreBonus(null, 'action', 'ninja')).toBe(0);
  });

  it('売上：両方合致 ×1.10 / 片方 ×1.05 / 不一致 ×1.0 / なし ×1.0', () => {
    expect(trendSalesMultiplier(trend, 'action', 'ninja')).toBe(1.1);
    expect(trendSalesMultiplier(trend, 'action', 'sushi')).toBe(1.05);
    expect(trendSalesMultiplier(trend, 'puzzle', 'sushi')).toBe(1);
    expect(trendSalesMultiplier(null, 'action', 'ninja')).toBe(1);
  });
});

describe('computeRevenue はトレンドに依存しない（二重掛けを撤去）', () => {
  it('trend の有無・合致に関わらず売上は同じ（トレンドはスコア側で効かせる）', () => {
    const trend: Trend = {
      genreId: 'action',
      themeId: 'ninja',
      expiresAt: Number.MAX_SAFE_INTEGER,
    };
    const withTrend = computeRevenue(60, 'action', 'ninja', 'mini', trend, 0);
    const noTrend = computeRevenue(60, 'action', 'ninja', 'mini', null, 0);
    expect(withTrend).toBe(noTrend);
  });
});

describe('computeRevenue', () => {
  it('売上 = baseRevenue × スコア帯倍率 × ソフトボーナス', () => {
    // トレンドなし・ファン0・広告なし → softMul 1.0
    const v = computeRevenue(60, 'action', 'ninja', 'mini', null, 0);
    expect(v).toBe(Math.round(SCALE_BALANCE.mini.baseRevenue * SALES_MULTIPLIER_BY_SCORE.normal));
  });

  it('各ボーナスは独立の倍率として掛かる（案B：共有 +20% 上限を廃止）', () => {
    // ファン1万(√10000/400 = +0.25) / 広報+0.22（+11%×2相当）/ 初回+0.05
    // ※ ローンチ広告は発売後リワードなのでこの式には含まれない（core/release.ts applyLaunchAd）
    const boosted = computeRevenue(60, 'action', 'ninja', 'mini', null, 10_000, 0.22, 0.05);
    const raw = SCALE_BALANCE.mini.baseRevenue * SALES_MULTIPLIER_BY_SCORE.normal;
    const expectedMul = (1 + 0.22) * (1 + 0.25) * (1 + 0.05);
    expect(boosted).toBe(Math.round(raw * expectedMul)); // 約 ×1.60（上限で潰れない）
  });

  it('ファンボーナスは上限なしで √ファン数/400 のまま伸びる（オーナー判断で +0.15 上限を撤去）', () => {
    const raw = SCALE_BALANCE.mini.baseRevenue * SALES_MULTIPLIER_BY_SCORE.normal;
    const rev = (fans: number) => computeRevenue(60, 'action', 'ninja', 'mini', null, fans);
    // 旧上限 +0.15 が効き始めていた 3600 人ちょうどは据え置き（境界で挙動が変わらない）
    expect(rev(3_600)).toBe(Math.round(raw * 1.15));
    // 上限撤去でここから先が伸びる（旧実装はすべて ×1.15 で頭打ちだった）
    expect(rev(10_000)).toBe(Math.round(raw * 1.25));
    expect(rev(40_000)).toBe(Math.round(raw * 1.5));
    expect(rev(160_000)).toBe(Math.round(raw * 2));
  });

  it('ファン 0・負値でもボーナスは 0（√の定義域を割らない）', () => {
    const raw = SCALE_BALANCE.mini.baseRevenue * SALES_MULTIPLIER_BY_SCORE.normal;
    expect(computeRevenue(60, 'action', 'ninja', 'mini', null, 0)).toBe(Math.round(raw));
    expect(computeRevenue(60, 'action', 'ninja', 'mini', null, -100)).toBe(Math.round(raw));
  });

  it('マイナスの広報ボーナスは売上を下げない（0 で下げ止まる）', () => {
    const base = computeRevenue(60, 'action', 'ninja', 'mini', null, 0);
    const negative = computeRevenue(60, 'action', 'ninja', 'mini', null, 0, -5, 0);
    expect(negative).toBe(base);
  });

  it('売上は 0 未満にならない', () => {
    expect(computeRevenue(0, 'action', 'ninja', 'mini', null, 0)).toBeGreaterThanOrEqual(0);
  });
});

describe('fanDelta', () => {
  it('スコア帯ごとの基礎値（90+:80 / 70+:40 / 50+:15 / 30+:0 / それ未満:-5）', () => {
    expect(fanDelta(95)).toBe(80);
    expect(fanDelta(75)).toBe(40);
    expect(fanDelta(55)).toBe(15);
    expect(fanDelta(35)).toBe(0);
    expect(fanDelta(10)).toBe(-5);
  });

  it('広報ボーナスはプラスの基礎値にだけ乗る', () => {
    expect(fanDelta(75, 0.5)).toBe(60);
    expect(fanDelta(10, 0.5)).toBe(-5); // マイナスには乗らない
  });
});
