import { describe, expect, it } from 'vitest';
import { computeBorrowingLimit, DEBT_CONFIG } from '../data/balance';
import { employeeMonthlyWage } from '../data/employees';
import { SCALE_BY_ID } from '../data/scales';
import type { Employee, Work } from '../state/types';
import {
  computeBorrow,
  computeMonthlyTick,
  computeOfflineEarnings,
  computeRepay,
  type EconomyCtx,
} from './economy';

const programmer = (power: number): Employee => ({
  id: `p-${power}`,
  name: 'テスト社員',
  role: 'programmer',
  power,
  wage: employeeMonthlyWage({
    id: '',
    name: '',
    role: 'programmer',
    power,
    wage: 0,
    specialties: [],
  }),
  specialties: [],
});

const ctx = (over: Partial<EconomyCtx> = {}): EconomyCtx => ({
  funds: 1_000_000,
  debt: 0,
  employees: [],
  unlockedScales: ['mini'],
  ...over,
});

const MINI_RENT = SCALE_BY_ID.mini.monthlyRent;

describe('computeMonthlyTick', () => {
  it('固定費 = 給与 + 賃料 + 借金月利', () => {
    const emp = programmer(1);
    const r = computeMonthlyTick(ctx({ employees: [emp], debt: 1_000_000 }));
    const interest = Math.round(1_000_000 * DEBT_CONFIG.monthlyInterestRate);
    expect(r.cost.salaries).toBe(emp.wage);
    expect(r.cost.rent).toBe(MINI_RENT);
    expect(r.cost.total).toBe(emp.wage + MINI_RENT + interest);
  });

  it('資金が足りていれば単純に引かれる', () => {
    const r = computeMonthlyTick(ctx({ funds: 10_000_000 }));
    expect(r.funds).toBe(10_000_000 - MINI_RENT);
    expect(r.debt).toBe(0);
    expect(r.gameOver).toBe(false);
  });

  it('資金不足分は借金へ振替、資金は 0 で下げ止まる', () => {
    const r = computeMonthlyTick(ctx({ funds: MINI_RENT - 100 }));
    expect(r.funds).toBe(0);
    expect(r.debt).toBe(100);
    expect(r.gameOver).toBe(false);
  });

  it('借入上限超 + 資金 0 でゲームオーバー', () => {
    const limit = computeBorrowingLimit(MINI_RENT);
    const r = computeMonthlyTick(ctx({ funds: 0, debt: limit }));
    // 月利と賃料が借金に振り替わり limit を超える → ゲームオーバー
    expect(r.debt).toBeGreaterThan(limit);
    expect(r.gameOver).toBe(true);
  });
});

describe('computeBorrow', () => {
  it('上限（月固定費 ×12）以内なら成立', () => {
    const limit = computeBorrowingLimit(MINI_RENT);
    const r = computeBorrow(ctx({ funds: 0 }), limit);
    expect(r).toEqual({ funds: limit, debt: limit });
  });

  it('上限超・0 以下の額は不成立（null）', () => {
    const limit = computeBorrowingLimit(MINI_RENT);
    expect(computeBorrow(ctx(), limit + 1)).toBeNull();
    expect(computeBorrow(ctx(), 0)).toBeNull();
    expect(computeBorrow(ctx(), -100)).toBeNull();
  });
});

describe('computeRepay', () => {
  it('資金と借金の小さい方まで返済する', () => {
    expect(computeRepay({ funds: 500, debt: 1000 }, 1000)).toEqual({ funds: 0, debt: 500 });
    expect(computeRepay({ funds: 1000, debt: 300 }, 1000)).toEqual({ funds: 700, debt: 0 });
  });

  it('借金なし・資金なし・0 以下の額は不成立（null）', () => {
    expect(computeRepay({ funds: 1000, debt: 0 }, 100)).toBeNull();
    expect(computeRepay({ funds: 0, debt: 1000 }, 100)).toBeNull();
    expect(computeRepay({ funds: 1000, debt: 1000 }, 0)).toBeNull();
  });
});

describe('computeOfflineEarnings', () => {
  const sellingWork: Work = {
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
    salesPool: 10_000,
    initialSalesPool: 10_000,
    decayPerSec: 0.02,
    totalRevenue: 0,
    selling: true,
    fansGained: 0,
    ghostBeaten: false,
    launchAdUsed: false,
    pioneer: false,
    releasedAt: 0,
    createdAt: 0,
    breakdown: {},
  };

  it('60 秒以上の離席で販売分を精算しレポートを返す', () => {
    const r = computeOfflineEarnings(0 + 1, [sellingWork], 1 + 100_000);
    expect(r.report).not.toBeNull();
    expect(r.report?.earned).toBeGreaterThan(0);
    expect(r.library[0].salesPool).toBeLessThan(10_000);
  });

  it('lastSeenAt が 0（初回起動）や 60 秒未満はレポートなし', () => {
    expect(computeOfflineEarnings(0, [sellingWork], 100_000).report).toBeNull();
    expect(computeOfflineEarnings(50_000, [sellingWork], 100_000).report).toBeNull();
  });
});
