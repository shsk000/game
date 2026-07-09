import { describe, expect, it } from 'vitest';
import { SCALE_BY_ID } from '../data/scales';
import { computeProfit, computeProfitForScale } from './profit';

describe('computeProfit', () => {
  it('profit = 売上 − (開発費 + 月固定費 × 月数)', () => {
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

  it('開発月数は最低 1 ヶ月に切り上げ・四捨五入される', () => {
    const zero = computeProfit({
      totalRevenue: 0,
      devCost: 0,
      monthlyFixedCost: 100,
      developMonths: 0,
    });
    expect(zero.fixedCostTotal).toBe(100);
    const rounded = computeProfit({
      totalRevenue: 0,
      devCost: 0,
      monthlyFixedCost: 100,
      developMonths: 2.6,
    });
    expect(rounded.fixedCostTotal).toBe(300);
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

describe('computeProfitForScale', () => {
  it('規模定義（baseCost / monthlyRent / neededWeeks）から計算する', () => {
    const def = SCALE_BY_ID.mini;
    const months = Math.max(1, Math.round(def.neededWeeks / 4));
    const expected = computeProfit({
      totalRevenue: 10_000_000,
      devCost: def.baseCost,
      monthlyFixedCost: def.monthlyRent,
      developMonths: months,
    });
    expect(computeProfitForScale({ totalRevenue: 10_000_000, scale: 'mini' })).toEqual(expected);
  });

  it('developWeeks 指定時は実績週数から月数を算出する（最低 1 ヶ月）', () => {
    const def = SCALE_BY_ID.mini;
    const r = computeProfitForScale({
      totalRevenue: 0,
      scale: 'mini',
      developWeeks: 2, // round(2/4)=1 → 最低 1 ヶ月
    });
    expect(r.fixedCostTotal).toBe(def.monthlyRent * 1);
  });
});
