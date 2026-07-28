import { describe, expect, it } from 'vitest';
import { ALL_EQUIPMENT, EQUIPMENT_BY_ID } from '../data/equipment';
import {
  canBuyEquipment,
  countAssigned,
  type EquipLoadout,
  equipmentPrice,
  freeCopies,
  effectiveSkillsOf,
  loadoutCategoryMul,
} from './equip';

describe('loadoutCategoryMul', () => {
  it('未装備（空ロードアウト）は全カテゴリ 1.0', () => {
    expect(loadoutCategoryMul({})).toEqual({ program: 1, graphics: 1, sound: 1, scenario: 1 });
  });

  it('初期装備（cost0・categoryMulなし）も 1.0', () => {
    const lo: EquipLoadout = { pc: 'pc-laptop', chair: 'chair-basic', misc: 'misc-none' };
    expect(loadoutCategoryMul(lo)).toEqual({ program: 1, graphics: 1, sound: 1, scenario: 1 });
  });

  it('スロットのカテゴリ倍率をカテゴリごとに掛け合わせる（PC×チェア）', () => {
    // pc-desktop: program 1.2 / chair-office: 全 1.05
    const lo: EquipLoadout = { pc: 'pc-desktop', chair: 'chair-office' };
    const m = loadoutCategoryMul(lo);
    expect(m.program).toBeCloseTo(1.2 * 1.05, 5);
    expect(m.graphics).toBeCloseTo(1.05, 5);
    expect(m.sound).toBeCloseTo(1.05, 5);
    expect(m.scenario).toBeCloseTo(1.05, 5);
  });

  it('小物のカテゴリ特化（液タブ=graphics）が乗る', () => {
    const m = loadoutCategoryMul({ misc: 'misc-pentab' });
    expect(m.graphics).toBeCloseTo(1.25, 5);
    expect(m.program).toBe(1);
  });

  it('不明IDは無視して 1.0（データ欠損に強い）', () => {
    expect(loadoutCategoryMul({ pc: 'does-not-exist' })).toEqual({
      program: 1,
      graphics: 1,
      sound: 1,
      scenario: 1,
    });
  });
});


describe('equipmentPrice / canBuyEquipment', () => {
  it('価格はテーブルの cost', () => {
    expect(equipmentPrice(EQUIPMENT_BY_ID['pc-desktop'])).toBe(30_000_000);
    expect(equipmentPrice(EQUIPMENT_BY_ID['pc-laptop'])).toBe(0);
  });

  it('初期装備（cost0）は購入対象外', () => {
    expect(canBuyEquipment({ def: EQUIPMENT_BY_ID['pc-laptop'], funds: 999_999_999 })).toBe(
      false,
    );
  });

  it('資金が価格以上なら購入可、不足なら不可', () => {
    expect(canBuyEquipment({ def: EQUIPMENT_BY_ID['pc-desktop'], funds: 30_000_000 })).toBe(true);
    expect(canBuyEquipment({ def: EQUIPMENT_BY_ID['pc-desktop'], funds: 29_999_999 })).toBe(false);
  });
});

describe('countAssigned / freeCopies（実体方式の空き）', () => {
  it('countAssigned は itemId を着けているスロット数を数える', () => {
    const loadouts: EquipLoadout[] = [{ pc: 'pc-desktop' }, { pc: 'pc-desktop' }, {}];
    expect(countAssigned(loadouts, 'pc-desktop')).toBe(2);
    expect(countAssigned(loadouts, 'pc-gaming')).toBe(0);
  });

  it('freeCopies = 所有 − 使用中', () => {
    const owned = { 'pc-desktop': 3 };
    const loadouts: EquipLoadout[] = [{ pc: 'pc-desktop' }, { pc: 'pc-desktop' }];
    expect(freeCopies(owned, loadouts, 'pc-desktop')).toBe(1);
    expect(freeCopies(owned, [], 'pc-desktop')).toBe(3);
    expect(freeCopies({}, loadouts, 'pc-desktop')).toBe(-2); // 所有0で2使用中（防御的に負値）
  });
});

describe('effectiveSkillsOf（実装ステップ4：装備は社員のスキルに倍率を掛ける）', () => {
  const emp = (skills: Record<string, number>, equipped = {}) =>
    ({ id: 'e', name: 'x', role: 'programmer', power: 0, basePower: 0, level: 1, exp: 0, wage: 0, specialties: [], skills, equipped }) as never;

  it('装備なしならスキルは変わらない', () => {
    expect(effectiveSkillsOf(emp({ graphics: 60 }))).toEqual({ graphics: 60 });
  });

  it('液タブ（グラフィック ×1.25）でグラフィックだけ伸びる', () => {
    const e = emp({ graphics: 60, sound: 40 }, { misc: 'misc-pentab' });
    const s = effectiveSkillsOf(e);
    expect(s.graphics).toBe(75);
    expect(s.sound).toBe(40);
  });

  it('スロットの倍率は掛け合わさる（PC × チェア）', () => {
    const e = emp({ programming: 100 }, { pc: 'pc-desktop', chair: 'chair-ergo' });
    // 1.2 × 1.1 = 1.32
    expect(effectiveSkillsOf(e).programming).toBeCloseTo(132, 0);
  });

  it('実効スキルは 100 を超えてよい（終盤に装備を買う理由を残す）', () => {
    const e = emp({ graphics: 100 }, { misc: 'misc-pentab' });
    expect(effectiveSkillsOf(e).graphics).toBeGreaterThan(100);
  });

  it('持っていないスキルは装備で生えない', () => {
    expect(effectiveSkillsOf(emp({ graphics: 50 }, { misc: 'misc-monitor-speaker' })).sound).toBeUndefined();
  });

  it('広報スキルは装備の対象外（開発4分野だけに掛かる）', () => {
    const e = emp({ pr: 80 }, { chair: 'chair-ergo' });
    expect(effectiveSkillsOf(e).pr).toBe(80);
  });

  it('4つの開発分野すべてに特化アイテムがある（引いた職種が腐らない）', () => {
    const fields = ['program', 'graphics', 'sound', 'scenario'] as const;
    for (const f of fields) {
      const has = ALL_EQUIPMENT.some((d) => (d.categoryMul?.[f] ?? 1) >= 1.2);
      expect(has, f).toBe(true);
    }
  });
});
