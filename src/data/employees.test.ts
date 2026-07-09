import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../core/ports';
import { computeMonthlyWage } from './balance';
import {
  newCandidate,
  REFRESH_COST,
  sumEmployeeCategoryBonus,
  sumMonthlySalaries,
  sumProgrammerSpeed,
} from './employees';

const fixedDeps = (seed: number) => ({ rng: mulberry32(seed), now: () => 1_000_000 });

describe('newCandidate', () => {
  it('同じ seed なら同じ候補が生成される（id の連番を除く）', () => {
    const a = newCandidate(fixedDeps(42));
    const b = newCandidate(fixedDeps(42));
    expect(a.name).toBe(b.name);
    expect(a.role).toBe(b.role);
    expect(a.power).toBe(b.power);
    expect(a.specialties).toEqual(b.specialties);
  });

  it('power は役職ごとの値域に収まる', () => {
    for (let seed = 0; seed < 50; seed++) {
      const c = newCandidate(fixedDeps(seed));
      if (c.role === 'programmer') {
        expect(c.power).toBeGreaterThanOrEqual(0.3);
        expect(c.power).toBeLessThanOrEqual(1.2);
      } else if (c.role === 'designer') {
        expect(c.power).toBeGreaterThanOrEqual(2);
        expect(c.power).toBeLessThanOrEqual(10);
      } else {
        expect(c.power).toBeGreaterThanOrEqual(5);
        expect(c.power).toBeLessThanOrEqual(20);
      }
    }
  });

  it('月給は balance.ts の computeMonthlyWage と一致する', () => {
    const c = newCandidate(fixedDeps(7));
    expect(c.wage).toBe(Math.round(computeMonthlyWage(c.power)));
  });

  it('specialty は 1〜2 個で、ボーナス値域は主 3-10 / 副 1-4', () => {
    for (let seed = 0; seed < 50; seed++) {
      const c = newCandidate(fixedDeps(seed));
      expect(c.specialties.length).toBeGreaterThanOrEqual(1);
      expect(c.specialties.length).toBeLessThanOrEqual(2);
      expect(c.specialties[0].bonus).toBeGreaterThanOrEqual(3);
      expect(c.specialties[0].bonus).toBeLessThanOrEqual(10);
      if (c.specialties[1]) {
        expect(c.specialties[1].bonus).toBeGreaterThanOrEqual(1);
        expect(c.specialties[1].bonus).toBeLessThanOrEqual(4);
        expect(c.specialties[1].categoryId).not.toBe(c.specialties[0].categoryId);
      }
    }
  });
});

describe('集計ヘルパー', () => {
  const emp = (over: Partial<ReturnType<typeof newCandidate>>) => ({
    ...newCandidate(fixedDeps(1)),
    ...over,
  });

  it('sumMonthlySalaries は全員の月給合計', () => {
    const a = emp({ id: 'a', power: 1 });
    const b = emp({ id: 'b', power: 0.5 });
    expect(sumMonthlySalaries([a, b])).toBe(
      Math.round(computeMonthlyWage(1)) + Math.round(computeMonthlyWage(0.5)),
    );
  });

  it('sumProgrammerSpeed はプログラマーの power 合計のみ', () => {
    const p1 = emp({ id: 'p1', role: 'programmer' as const, power: 0.5 });
    const p2 = emp({ id: 'p2', role: 'programmer' as const, power: 0.7 });
    const d = emp({ id: 'd', role: 'designer' as const, power: 9 });
    expect(sumProgrammerSpeed([p1, p2, d])).toBeCloseTo(1.2);
  });

  it('sumEmployeeCategoryBonus は割当済み社員×一致カテゴリのみ加算', () => {
    const a = emp({
      id: 'a',
      specialties: [{ categoryId: 'graphics' as const, bonus: 5 }],
    });
    const b = emp({
      id: 'b',
      specialties: [{ categoryId: 'sound' as const, bonus: 3 }],
    });
    // b は未割当なので加算されない
    expect(sumEmployeeCategoryBonus([a, b], ['a'], ['graphics', 'sound'])).toBe(5);
    // カテゴリ不一致も加算されない
    expect(sumEmployeeCategoryBonus([a], ['a'], ['story'])).toBe(0);
  });
});

describe('REFRESH_COST', () => {
  it('候補リフレッシュ費用が定義されている', () => {
    expect(REFRESH_COST).toBeGreaterThan(0);
  });
});
