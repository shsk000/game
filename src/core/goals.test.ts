import { describe, expect, it } from 'vitest';
import { SCALE_BALANCE } from '../data/balance';
import type { Employee } from '../state/types';
import { type GoalsCtx, nextGoals } from './goals';
import { nextExpFor } from './growth';

const emp = (over: Partial<Employee> = {}): Employee => ({
  id: 'e1',
  name: 'テスト 太郎',
  role: 'programmer',
  power: 0.4,
  basePower: 0.4,
  level: 1,
  exp: 0,
  wage: 0,
  specialties: [], skills: {},
  ...over,
});

const ctx = (over: Partial<GoalsCtx> = {}): GoalsCtx => ({
  unlockedScales: ['mini'],
  lifetimeRevenue: 0,
  funds: 0,
  employees: [emp()],
  library: [],
  ...over,
});

describe('nextGoals（つぎの目標。常に最大3件）', () => {
  it('①次の規模解放：累計不足なら残額を出す', () => {
    const goals = nextGoals(ctx({ lifetimeRevenue: 10_000_000 }));
    const scaleGoal = goals[0];
    expect(scaleGoal.icon).toBe('🏢');
    expect(scaleGoal.value).toContain('あと');
    expect(scaleGoal.done).toBeUndefined();
  });

  it('①累計達成・資金不足なら購入金額の案内、資金もあれば「解放可能！」', () => {
    const reached = SCALE_BALANCE.mobile.unlockSalesRequired;
    const poor = nextGoals(ctx({ lifetimeRevenue: reached, funds: 0 }))[0];
    expect(poor.value).toContain('購入可');
    const rich = nextGoals(
      ctx({ lifetimeRevenue: reached, funds: SCALE_BALANCE.mobile.unlockCost }),
    )[0];
    expect(rich.done).toBe(true);
  });

  it('①全規模解放済みなら規模の目標は出ない', () => {
    const goals = nextGoals(ctx({ unlockedScales: ['mini', 'mobile', 'indie', 'hit', 'aaa'] }));
    expect(goals.some((g) => g.icon === '🏢')).toBe(false);
  });

  it('②社員0人なら採用を促す', () => {
    const goals = nextGoals(ctx({ employees: [] }));
    expect(goals.some((g) => g.icon === '👥')).toBe(true);
  });

  it('②次にレベルが上がる社員（必要expが最小）を選ぶ', () => {
    const near = emp({ id: 'a', name: '近い人', level: 1, exp: nextExpFor(1) - 3 });
    const far = emp({ id: 'b', name: '遠い人', level: 1, exp: 0 });
    const g = nextGoals(ctx({ employees: [far, near] })).find((x) => x.icon === '⬆');
    expect(g?.label).toContain('近い人');
    expect(g?.value).toBe('あと exp 3');
  });

  it('③発見した組合せはユニーク数', () => {
    const w = (g: string, t: string) =>
      ({ genreId: g, themeId: t }) as unknown as GoalsCtx['library'][number];
    const goals = nextGoals(
      ctx({ library: [w('puzzle', 'sushi'), w('puzzle', 'sushi'), w('puzzle', 'onsen')] }),
    );
    const zukan = goals.find((x) => x.icon === '📖');
    expect(zukan?.value.startsWith('2 /')).toBe(true);
  });
});
