import { describe, expect, it } from 'vitest';
import { SCALE_BY_ID } from '../data/scales';
import { computeProfit, computeProfitForScale } from './profit';

describe('computeProfit', () => {
  it('利益 = 売上 − (開発費 + 固定費)', () => {
    const r = computeProfit({
      totalRevenue: 10_000_000,
      devCost: 3_000_000,
      monthlyFixedCost: 500_000,
      developMonths: 2,
    });
    expect(r.fixedCostTotal).toBe(1_000_000);
    expect(r.totalCost).toBe(4_000_000);
    expect(r.profit).toBe(6_000_000);
    expect(r.roiPct).toBeCloseTo(150);
  });

  it('実額（fixedCostTotal）を渡したら月数計算は使わない', () => {
    // リリース後の実績はこちらを使う。`monthlyTick` が実際に引いた合計をそのまま出す
    const r = computeProfit({
      totalRevenue: 1_000_000,
      devCost: 300_000,
      fixedCostTotal: 2_523_000,
      // 渡しても無視される（実額が優先）
      monthlyFixedCost: 999_999_999,
      developMonths: 99,
    });
    expect(r.fixedCostTotal).toBe(2_523_000);
    expect(r.profit).toBe(1_000_000 - 300_000 - 2_523_000);
  });

  it('払っていない月を計上しない（下限1ヶ月は撤廃した）', () => {
    // **これが以前の表示の嘘だった**：月またぎ0回でも1ヶ月ぶん請求していた。
    // 3人チームなら約 ¥252万＝ミニゲーム1本の総売上を超える誤差になる
    const zero = computeProfit({
      totalRevenue: 0,
      devCost: 0,
      monthlyFixedCost: 100,
      developMonths: 0,
    });
    expect(zero.fixedCostTotal).toBe(0);

    // 2.6ヶ月＝10.4週。月またぎは2回なので 2 ヶ月ぶん（round で 3 にしない）
    const partial = computeProfit({
      totalRevenue: 0,
      devCost: 0,
      monthlyFixedCost: 100,
      developMonths: 2.6,
    });
    expect(partial.fixedCostTotal).toBe(200);
  });

  it('速く打ち切るほど固定費が安い（表示がコアループと一致する）', () => {
    const fast = computeProfit({
      totalRevenue: 0,
      devCost: 0,
      monthlyFixedCost: 1_000_000,
      developMonths: 0.75, // 3週
    });
    const slow = computeProfit({
      totalRevenue: 0,
      devCost: 0,
      monthlyFixedCost: 1_000_000,
      developMonths: 3, // 12週
    });
    expect(fast.fixedCostTotal).toBe(0);
    expect(slow.fixedCostTotal).toBe(3_000_000);
    expect(fast.profit).toBeGreaterThan(slow.profit);
  });

  it('総コスト 0 のとき ROI は null（ゼロ除算防止）', () => {
    const r = computeProfit({
      totalRevenue: 100,
      devCost: 0,
      monthlyFixedCost: 0,
      developMonths: 1,
    });
    expect(r.roiPct).toBeNull();
    expect(r.profit).toBe(100);
  });

  it('赤字なら profit と ROI が負になる', () => {
    const r = computeProfit({
      totalRevenue: 1_000_000,
      devCost: 3_000_000,
      monthlyFixedCost: 0,
      developMonths: 1,
    });
    expect(r.profit).toBe(-2_000_000);
    expect(r.roiPct).toBeLessThan(0);
  });
});

describe('computeProfitForScale（見込み専用）', () => {
  it('規模定義（baseCost / monthlyRent / neededWeeks）から計算する', () => {
    const def = SCALE_BY_ID.mini;
    const expected = computeProfit({
      totalRevenue: 10_000_000,
      devCost: def.baseCost,
      monthlyFixedCost: def.monthlyRent,
      developMonths: def.neededWeeks / 4,
    });
    expect(computeProfitForScale({ totalRevenue: 10_000_000, scale: 'mini' })).toEqual(expected);
  });

  it('developWeeks 指定時は実績週数から月またぎ回数を切り捨てで出す', () => {
    const r = computeProfitForScale({
      totalRevenue: 0,
      scale: 'mini',
      developWeeks: 2, // 2週 → 月またぎ0回
    });
    expect(r.fixedCostTotal).toBe(0);

    const r2 = computeProfitForScale({
      totalRevenue: 0,
      scale: 'mini',
      developWeeks: 9, // 9週 → 2回
    });
    expect(r2.fixedCostTotal).toBe(SCALE_BY_ID.mini.monthlyRent * 2);
  });
});
