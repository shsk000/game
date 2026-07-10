import { describe, expect, it } from 'vitest';
import { computeMonthlyWage, GROWTH } from '../data/balance';
import type { Employee } from '../state/types';
import { applyReleaseGrowth, expForRelease, nextExpFor, powerAt } from './growth';

const emp = (over: Partial<Employee> = {}): Employee => ({
  id: 'e1',
  name: 'テスト 太郎',
  role: 'programmer',
  power: 0.4,
  basePower: 0.4,
  level: 1,
  exp: 0,
  wage: 540_000,
  specialties: [],
  ...over,
});

describe('nextExpFor', () => {
  it('必要 exp は 20 × lv^1.5 の二次曲線', () => {
    expect(nextExpFor(1)).toBe(20);
    expect(nextExpFor(4)).toBe(160);
    expect(nextExpFor(9)).toBe(540);
  });

  it('Lv10 到達は数十作品規模（オーナー確定の成長ペース）', () => {
    // 全レベルの必要 exp 合計 / 平均獲得 exp（メタ50+想定 15）≒ 必要リリース数
    let total = 0;
    for (let lv = 1; lv < GROWTH.levelCap; lv++) total += nextExpFor(lv);
    const releasesNeeded = total / (GROWTH.expBase + 5);
    expect(releasesNeeded).toBeGreaterThanOrEqual(30);
    expect(releasesNeeded).toBeLessThanOrEqual(200);
  });
});

describe('powerAt', () => {
  it('Lv1 は素質そのまま、レベルで線形成長（Lv10 で約 2.35 倍）', () => {
    expect(powerAt(0.4, 1)).toBe(0.4);
    expect(powerAt(0.4, 10)).toBeCloseTo(0.4 * (1 + 0.15 * 9), 2);
  });

  it('レベルは 1..levelCap にクランプされる', () => {
    expect(powerAt(0.4, 0)).toBe(0.4);
    expect(powerAt(0.4, 99)).toBe(powerAt(0.4, GROWTH.levelCap));
  });
});

describe('expForRelease', () => {
  it('メタスコア連動：90+ / 70+ / 50+ / それ未満', () => {
    expect(expForRelease(95)).toBe(GROWTH.expBase + 30);
    expect(expForRelease(70)).toBe(GROWTH.expBase + 15);
    expect(expForRelease(50)).toBe(GROWTH.expBase + 5);
    expect(expForRelease(30)).toBe(GROWTH.expBase);
  });
});

describe('applyReleaseGrowth', () => {
  it('参加社員だけが exp を得る', () => {
    const a = emp({ id: 'a' });
    const b = emp({ id: 'b' });
    const r = applyReleaseGrowth([a, b], ['a'], 40);
    expect(r.employees[0].exp).toBe(GROWTH.expBase);
    expect(r.employees[1]).toBe(b); // 非参加は同一オブジェクトのまま
    expect(r.levelUps).toEqual([]);
  });

  it('しきい値を越えるとレベルアップし、power と月給が上がる', () => {
    const a = emp({ id: 'a', exp: nextExpFor(1) - 5 }); // あと 5 で Lv2
    const r = applyReleaseGrowth([a], ['a'], 50); // +15 exp
    const grown = r.employees[0];
    expect(grown.level).toBe(2);
    expect(grown.exp).toBe(a.exp + 15 - nextExpFor(1));
    expect(grown.power).toBe(powerAt(a.basePower, 2));
    expect(grown.wage).toBe(Math.round(computeMonthlyWage(grown.power, 2)));
    expect(r.levelUps).toEqual([
      expect.objectContaining({ employeeId: 'a', name: a.name, level: 2 }),
    ]);
    expect(r.levelUps[0].wageDelta).toBe(grown.wage - a.wage);
  });

  it('大量 exp で複数レベル一気に上がる', () => {
    const a = emp({ id: 'a', exp: nextExpFor(1) + nextExpFor(2) });
    const r = applyReleaseGrowth([a], ['a'], 95); // +40
    expect(r.employees[0].level).toBe(3);
    expect(r.levelUps.map((l) => l.level)).toEqual([2, 3]);
  });

  it('レベル上限で止まり、それ以上は上がらない', () => {
    const a = emp({
      id: 'a',
      level: GROWTH.levelCap,
      exp: 0,
      power: powerAt(0.4, GROWTH.levelCap),
    });
    const r = applyReleaseGrowth([a], ['a'], 95);
    expect(r.employees[0].level).toBe(GROWTH.levelCap);
    expect(r.levelUps).toEqual([]);
  });
});
