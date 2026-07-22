import { describe, expect, it } from 'vitest';
import { QUALITY_WEIGHTS, SALES_MULTIPLIER_BY_SCORE, SCALE_BALANCE } from '../data/balance';
import type { Trend } from '../data/trend';
import { trendSalesMultiplier, trendScoreBonus } from '../data/trend';
import {
  computeMetascore,
  computePerformanceScore,
  computeQualityV10,
  computeRevenue,
  fanDelta,
} from './metascore';

// rng を固定して決定的にテストする（testing-rules §2）
const MID: () => number = () => 0.5; // variance 0 / luck ×1.0 相当

describe('computeMetascore', () => {
  it('rng=0.5（ブレ0）・トレンドなしなら metascore = quality', () => {
    const r = computeMetascore(70, 'action', 'ninja', null, MID);
    expect(r.metascore).toBe(70);
    expect(r.isMasterpiece).toBe(false);
  });

  it('評価家ブレは ±5：rng=1 で +5、rng=0 で -5', () => {
    expect(computeMetascore(70, 'action', 'ninja', null, () => 0.9999).metascore).toBe(75);
    expect(computeMetascore(70, 'action', 'ninja', null, () => 0).metascore).toBe(65);
  });

  it('トレンド両方合致は +10、片方合致は +5', () => {
    const trend: Trend = {
      genreId: 'action',
      themeId: 'ninja',
      expiresAt: Number.MAX_SAFE_INTEGER,
    };
    // 両方合致（ジャンルもテーマも一致）
    expect(computeMetascore(70, 'action', 'ninja', trend, MID).metascore).toBe(80);
    // 片方合致（ジャンルのみ一致）
    expect(computeMetascore(70, 'action', 'sushi', trend, MID).metascore).toBe(75);
    // 不一致
    expect(computeMetascore(70, 'puzzle', 'sushi', trend, MID).metascore).toBe(70);
  });

  it('0..100 にクランプ、90+ で名作', () => {
    expect(computeMetascore(120, 'action', 'ninja', null, MID).metascore).toBe(100);
    expect(computeMetascore(-20, 'action', 'ninja', null, MID).metascore).toBe(0);
    expect(computeMetascore(92, 'action', 'ninja', null, MID).isMasterpiece).toBe(true);
  });
});

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
    const trend: Trend = { genreId: 'action', themeId: 'ninja', expiresAt: Number.MAX_SAFE_INTEGER };
    const withTrend = computeRevenue(60, 'action', 'ninja', 'mini', trend, 0, false);
    const noTrend = computeRevenue(60, 'action', 'ninja', 'mini', null, 0, false);
    expect(withTrend).toBe(noTrend);
  });
});

describe('computeQualityV10', () => {
  it('ウェイト合成：rng=0.5 で運倍率 ×1.0（誤差内）', () => {
    const r = computeQualityV10(
      { charPower: 80, genreAffinity: 60, typingScore: 40, luck: 50 },
      MID,
    );
    const base =
      80 * QUALITY_WEIGHTS.charPower +
      60 * QUALITY_WEIGHTS.genreAffinity +
      40 * QUALITY_WEIGHTS.typingScore +
      50 * QUALITY_WEIGHTS.luck;
    expect(r.Q).toBe(Math.round(base * 1.0));
    expect(r.breakdown.base).toBe(Math.round(base));
  });

  it('運乱数は 0.97〜1.03 の範囲（rng=0 と rng≈1 の両端）', () => {
    const lo = computeQualityV10({ charPower: 100, genreAffinity: 100, typingScore: 100 }, () => 0);
    const hi = computeQualityV10(
      { charPower: 50, genreAffinity: 50, typingScore: 50, luck: 50 },
      () => 0.9999,
    );
    expect(lo.breakdown.luckMultiplier).toBeCloseTo(0.97, 2);
    expect(hi.breakdown.luckMultiplier).toBeCloseTo(1.03, 2);
  });

  it('入力は 0..100 にクランプされる', () => {
    const r = computeQualityV10(
      { charPower: 999, genreAffinity: -50, typingScore: 100, luck: 50 },
      MID,
    );
    expect(r.breakdown.charPower).toBe(100);
    expect(r.breakdown.genreAffinity).toBe(0);
  });
});

describe('computeRevenue', () => {
  it('売上 = baseRevenue × スコア帯倍率 × ソフトボーナス', () => {
    // トレンドなし・ファン0・広告なし → softMul 1.0
    const v = computeRevenue(60, 'action', 'ninja', 'mini', null, 0, false);
    expect(v).toBe(Math.round(SCALE_BALANCE.mini.baseRevenue * SALES_MULTIPLIER_BY_SCORE.normal));
  });

  it('各ボーナスは独立の倍率として掛かる（案B：共有 +20% 上限を廃止）', () => {
    // ファン1万(+0.15) / ローンチ広告(+0.1) / 広報+0.22（+11%×2相当）/ 初回+0.05
    const boosted = computeRevenue(60, 'action', 'ninja', 'mini', null, 1_000_000, true, 0.22, 0.05);
    const raw = SCALE_BALANCE.mini.baseRevenue * SALES_MULTIPLIER_BY_SCORE.normal;
    const expectedMul = (1 + 0.22) * (1 + 0.15) * (1 + 0.1) * (1 + 0.05);
    expect(boosted).toBe(Math.round(raw * expectedMul)); // 約 ×1.62（上限で潰れない）
  });

  it('マイナスの広報ボーナスは売上を下げない（0 で下げ止まる）', () => {
    const base = computeRevenue(60, 'action', 'ninja', 'mini', null, 0, false);
    const negative = computeRevenue(60, 'action', 'ninja', 'mini', null, 0, false, -5, 0);
    expect(negative).toBe(base);
  });

  it('売上は 0 未満にならない', () => {
    expect(computeRevenue(0, 'action', 'ninja', 'mini', null, 0, false)).toBeGreaterThanOrEqual(0);
  });
});

describe('computePerformanceScore', () => {
  it('wpm 120・コンボ0・精度100% で基準スコア', () => {
    expect(computePerformanceScore({ wpm: 120, maxCombo: 0, accuracy: 1 })).toBe(30);
  });

  it('wpm が高いほど・コンボが多いほど高スコア', () => {
    const low = computePerformanceScore({ wpm: 60, maxCombo: 0, accuracy: 1 });
    const high = computePerformanceScore({ wpm: 240, maxCombo: 600, accuracy: 1, noBugs: true });
    expect(high).toBeGreaterThan(low);
    expect(high).toBe(30 + 30 + 25 + 5); // wpm上限 + コンボ600 + バグなし
  });

  it('精度 97% 未満からペナルティ（最大 -25）', () => {
    const ok = computePerformanceScore({ wpm: 120, maxCombo: 0, accuracy: 0.97 });
    const bad = computePerformanceScore({ wpm: 120, maxCombo: 0, accuracy: 0.5 });
    expect(ok).toBe(30);
    expect(bad).toBe(30 - 25);
  });

  it('0..100 にクランプ', () => {
    expect(computePerformanceScore({ wpm: 0, maxCombo: 0, accuracy: 0 })).toBeGreaterThanOrEqual(0);
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
