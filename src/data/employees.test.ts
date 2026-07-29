import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../core/ports';
import { ownedSkillIds, totalPowerOf } from '../core/skills';
import {
  computeMonthlyWage,
  GACHA_CONFIG,
  GACHA_RANKS,
  type GachaRank,
  RANK_TOTAL_POWER,
} from './balance';
import {
  newCandidate,
  rollPowerForRank,
  sumMonthlySalaries,
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
    expect(['C', 'B', 'A', 'S']).toContain(c.rank);
    expect(c.basePower).toBe(c.power);
    expect(c.level).toBe(1);
    expect(c.exp).toBe(0);
  });

  it('スキルは1つか2つで、合計（総合力）がランクの Lv1 帯に収まる', () => {
    // 実装ステップ3：総合力はランクの天井（RANK_TOTAL_POWER）から決まる。
    // Lv1 はランクによらずほぼ同じ（15〜28）で、差がつくのは育ててから
    for (const rank of GACHA_RANKS) {
      const r = RANK_TOTAL_POWER[rank];
      for (let seed = 0; seed < 40; seed++) {
        const c = newCandidate(fixedDeps(seed), rank);
        const owned = ownedSkillIds(c.skills);
        expect(owned.length, `${rank} seed=${seed}`).toBeGreaterThanOrEqual(1);
        expect(owned.length, `${rank} seed=${seed}`).toBeLessThanOrEqual(2);
        const total = totalPowerOf(c.skills);
        // 2スキルは分散ペナルティで目減りする
        expect(total, `${rank} seed=${seed}`).toBeGreaterThanOrEqual(r.lv1Min * 0.9 - 0.5);
        expect(total, `${rank} seed=${seed}`).toBeLessThanOrEqual(r.lv1Max + 0.5);
        // power は総合力から導出される
        expect(c.power, `${rank} seed=${seed}`).toBeCloseTo(total / 100, 2);
      }
    }
  });

  it('月給は balance.ts の computeMonthlyWage と一致する', () => {
    const c = newCandidate(fixedDeps(7), 'A');
    expect(c.wage).toBe(Math.round(computeMonthlyWage(c.power)));
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


});
