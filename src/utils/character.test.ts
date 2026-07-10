import { describe, expect, it } from 'vitest';
import { powerAt } from '../core/growth';
import type { Employee, EmployeeRole } from '../state/types';
import { computeCharacterScore } from './character';

const emp = (id: string, role: EmployeeRole, power: number): Employee => ({
  id,
  name: `社員${id}`,
  role,
  power,
  basePower: power,
  level: 1,
  exp: 0,
  wage: 0,
  specialties: [],
});

describe('computeCharacterScore（v0.16：能力が支配項）', () => {
  it('新人 3 人（power 0.4×3・3職種・mini）は 40 前後に留まる', () => {
    const team = [emp('a', 'programmer', 0.4), emp('b', 'designer', 0.4), emp('c', 'pr', 0.4)];
    const { score } = computeCharacterScore({ assignedEmployees: team, scale: 'mini' });
    expect(score).toBeGreaterThanOrEqual(25);
    expect(score).toBeLessThanOrEqual(45);
  });

  it('基礎下駄がない：アサイン 0 人はスコア 0', () => {
    const { score } = computeCharacterScore({ assignedEmployees: [], scale: 'mini' });
    expect(score).toBe(0);
  });

  it('頭数だけでは稼げない：同じ power 合計なら 1 人でも 3 人でも powerBonus は同じ', () => {
    const solo = computeCharacterScore({
      assignedEmployees: [emp('a', 'programmer', 1.2)],
      scale: 'mini',
    });
    const trio = computeCharacterScore({
      assignedEmployees: [
        emp('a', 'programmer', 0.4),
        emp('b', 'programmer', 0.4),
        emp('c', 'programmer', 0.4),
      ],
      scale: 'mini',
    });
    expect(solo.breakdown.powerBonus).toBe(trio.breakdown.powerBonus);
    // v0.17：全員参加制のため超過ペナルティは廃止（推奨未満 -10 のみ残る）
    expect(trio.breakdown.fitBonus).toBe(0);
    expect(solo.breakdown.fitBonus).toBe(0);
  });

  it('Lv10 精鋭 3 人 + aaa で 80 前後（終盤の天井）', () => {
    const p = powerAt(0.55, 10); // ≒1.29
    const team = [emp('a', 'programmer', p), emp('b', 'designer', p), emp('c', 'pr', p)];
    const { score } = computeCharacterScore({ assignedEmployees: team, scale: 'aaa' });
    expect(score).toBeGreaterThanOrEqual(75);
    expect(score).toBeLessThanOrEqual(90);
  });

  it('power 寄与は規模上限でカンストする（0..70）', () => {
    const team = [emp('a', 'programmer', 1.5), emp('b', 'designer', 1.5), emp('c', 'pr', 1.5)];
    const { breakdown } = computeCharacterScore({ assignedEmployees: team, scale: 'mini' });
    expect(breakdown.powerBonus).toBe(70);
  });

  it('役割多様性：1 種 0 / 2 種 +5 / 3 種 +10', () => {
    const one = computeCharacterScore({
      assignedEmployees: [emp('a', 'programmer', 0.4)],
      scale: 'mini',
    });
    const two = computeCharacterScore({
      assignedEmployees: [emp('a', 'programmer', 0.2), emp('b', 'designer', 0.2)],
      scale: 'mobile',
    });
    expect(one.breakdown.roleVarietyBonus).toBe(0);
    expect(two.breakdown.roleVarietyBonus).toBe(5);
  });

  it('推奨人数未満はペナルティ -10（hit 規模に 1 人）', () => {
    const { breakdown } = computeCharacterScore({
      assignedEmployees: [emp('a', 'programmer', 0.5)],
      scale: 'hit',
    });
    expect(breakdown.fitBonus).toBe(-10);
  });
});
