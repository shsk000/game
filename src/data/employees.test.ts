import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../core/ports';
import { computeMonthlyWage, GACHA_CONFIG, type GachaRank, ROLE_EFFECT } from './balance';
import {
  newCandidate,
  rollPowerForRank,
  sumEmployeeCategoryBonus,
  sumMonthlySalaries,
  sumProgrammerSpeed,
} from './employees';

const fixedDeps = (seed: number) => ({ rng: mulberry32(seed), now: () => 1_000_000 });

describe('newCandidate', () => {
  it('同じ seed・同じランクなら同じ候補が生成される（id の連番を除く）', () => {
    const a = newCandidate(fixedDeps(42), 'A');
    const b = newCandidate(fixedDeps(42), 'A');
    expect(a.name).toBe(b.name);
    expect(a.role).toBe(b.role);
    expect(a.power).toBe(b.power);
    expect(a.rank).toBe('A');
    expect(a.specialties).toEqual(b.specialties);
  });

  it('rank を指定しなくても排出テーブルで抽選され rank が付与される', () => {
    const c = newCandidate(fixedDeps(3));
    expect(['B', 'A', 'S']).toContain(c.rank);
    expect(c.basePower).toBe(c.power);
    expect(c.level).toBe(1);
    expect(c.exp).toBe(0);
  });

  it('ランク別 basePower はそのランクの帯に収まる（境界含む）', () => {
    for (const rank of ['B', 'A', 'S'] as GachaRank[]) {
      const range = GACHA_CONFIG.powerRange[rank];
      for (let seed = 0; seed < 40; seed++) {
        const c = newCandidate(fixedDeps(seed), rank);
        expect(c.power, `${rank} seed=${seed}`).toBeGreaterThanOrEqual(range.min);
        expect(c.power, `${rank} seed=${seed}`).toBeLessThanOrEqual(range.max);
      }
    }
  });

  it('月給は balance.ts の computeMonthlyWage と一致する', () => {
    const c = newCandidate(fixedDeps(7), 'A');
    expect(c.wage).toBe(Math.round(computeMonthlyWage(c.power)));
  });

  it('specialty はランク仕様帯に収まる（B=1個 / S=2個確定）', () => {
    for (const rank of ['B', 'A', 'S'] as GachaRank[]) {
      const cfg = GACHA_CONFIG.specialty[rank];
      for (let seed = 0; seed < 40; seed++) {
        const c = newCandidate(fixedDeps(seed), rank);
        expect(c.specialties.length).toBeGreaterThanOrEqual(1);
        expect(c.specialties.length).toBeLessThanOrEqual(2);
        expect(c.specialties[0].bonus).toBeGreaterThanOrEqual(cfg.primaryMin);
        expect(c.specialties[0].bonus).toBeLessThanOrEqual(cfg.primaryMax);
        if (rank === 'B') expect(c.specialties.length).toBe(1);
        if (rank === 'S') expect(c.specialties.length).toBe(2);
        if (c.specialties[1]) {
          expect(c.specialties[1].bonus).toBeGreaterThanOrEqual(cfg.secondMin);
          expect(c.specialties[1].bonus).toBeLessThanOrEqual(cfg.secondMax);
          expect(c.specialties[1].categoryId).not.toBe(c.specialties[0].categoryId);
        }
      }
    }
  });
});

describe('rollPowerForRank', () => {
  it('各ランクの帯域内を返す', () => {
    for (const rank of ['B', 'A', 'S'] as GachaRank[]) {
      const range = GACHA_CONFIG.powerRange[rank];
      for (let seed = 0; seed < 20; seed++) {
        const p = rollPowerForRank(rank, mulberry32(seed));
        expect(p).toBeGreaterThanOrEqual(range.min);
        expect(p).toBeLessThanOrEqual(range.max);
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

  it('sumProgrammerSpeed はプログラマーのみ power × 係数で合算する', () => {
    const p1 = emp({ id: 'p1', role: 'programmer' as const, power: 0.5 });
    const p2 = emp({ id: 'p2', role: 'programmer' as const, power: 0.7 });
    const d = emp({ id: 'd', role: 'designer' as const, power: 0.9 });
    expect(sumProgrammerSpeed([p1, p2, d])).toBeCloseTo(1.2 * ROLE_EFFECT.programmerLocPerSec);
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
