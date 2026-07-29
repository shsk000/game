import { describe, expect, it } from 'vitest';
import { INITIAL_FUNDS, MONTHLY_RENT } from '../data/balance';
import type { Employee } from '../state/types';
import { monthsOfRunway } from './economy';
import { formatRunway, runwayColor } from '../utils/format';

/**
 * ランウェイ（資金が固定費で何ヶ月もつか）のガード。
 *
 * **この数字が画面に無かったことが、序盤の破産を「理不尽」にしていた。**
 * 企画画面は「🎵 担当なし」と4分野ぶんの採用を促すが、
 * 促されたとおり雇うとランウェイが 16ヶ月 → 1〜2ヶ月に落ちる。
 * その落差がどこにも表示されていなかった（オーナー報告 2026-07-29）。
 *
 * 定数（給与式・賃料・初期資金）はこの版では変えない。**見せ方だけ**直す。
 */

const emp = (id: string, wage: number): Employee =>
  ({
    id,
    name: id,
    role: 'programmer',
    power: 0.5,
    basePower: 0.5,
    level: 1,
    exp: 0,
    wage,
    specialties: [],
    rank: 'B',
    skills: { programming: 30 },
  }) as Employee;

const ctx = (funds: number, employees: Employee[] = [], debt = 0) => ({
  funds,
  debt,
  employees,
  unlockedScales: ['mini'] as const as never,
});

describe('ランウェイ', () => {
  it('社員0人なら賃料だけ。初期資金で十分もつ', () => {
    const r = monthsOfRunway(ctx(INITIAL_FUNDS));
    expect(r.monthly).toBe(MONTHLY_RENT);
    expect(r.months).toBeCloseTo(INITIAL_FUNDS / MONTHLY_RENT);
    expect(r.months!).toBeGreaterThan(12);
  });

  it('4分野を埋めると数ヶ月まで落ちる（画面に出すべき落差）', () => {
    // 給与は Employee.wage ではなく power / level から再計算される（`employeeMonthlyWage`）。
    // 額を直書きせず、1人ぶんの実効給与から組み立てる
    const one = monthsOfRunway(ctx(INITIAL_FUNDS), [emp('a', 0)]);
    const perHead = one.monthly - MONTHLY_RENT;
    const team = ['a', 'b', 'c', 'd'].map((id) => emp(id, 0));
    const before = monthsOfRunway(ctx(INITIAL_FUNDS));
    const after = monthsOfRunway(ctx(INITIAL_FUNDS), team);
    expect(perHead).toBeGreaterThan(0);
    expect(after.monthly).toBe(MONTHLY_RENT + perHead * 4);
    expect(after.months!).toBeLessThan(2);
    expect(before.months!).toBeGreaterThan(after.months! * 5);
  });

  it('employeesOverride で「この人を採ったら」を試算できる', () => {
    const now = ctx(INITIAL_FUNDS, [emp('a', 0)]);
    const before = monthsOfRunway(now);
    const after = monthsOfRunway(now, [...now.employees, emp('b', 0)]);
    // 1人ぶんきっかり増える
    expect(after.monthly - before.monthly).toBe(before.monthly - MONTHLY_RENT);
    expect(after.months!).toBeLessThan(before.months!);
  });

  it('借金の利息も固定費に入る', () => {
    const noDebt = monthsOfRunway(ctx(INITIAL_FUNDS));
    const withDebt = monthsOfRunway(ctx(INITIAL_FUNDS, [], 10_000_000));
    expect(withDebt.monthly).toBeGreaterThan(noDebt.monthly);
  });

  it('資金0なら 0 ヶ月（負にしない）', () => {
    expect(monthsOfRunway(ctx(0)).months).toBe(0);
    expect(monthsOfRunway(ctx(-500)).months).toBe(0);
  });
});

describe('ランウェイの表示', () => {
  it('小数第1位まで出す（切り上げで危険を隠さない・切り捨てで手遅れに見せない）', () => {
    expect(formatRunway(1.64)).toBe('あと 1.6 ヶ月');
    expect(formatRunway(0.9)).toBe('あと 0.9 ヶ月');
  });

  it('尽きる寸前と、十分もつ場合は言い切る', () => {
    expect(formatRunway(0.05)).toBe('今月で尽きる');
    expect(formatRunway(200)).toBe('あと 10 年以上');
    expect(formatRunway(null)).toBe('ずっともつ');
  });

  it('1ヶ月未満は赤、3ヶ月未満は橙', () => {
    expect(runwayColor(0.5)).toBe('#cc2f2f');
    expect(runwayColor(2)).toBe('#b26a10');
    expect(runwayColor(12)).toBe('#222a35');
  });
});
