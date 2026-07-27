import { describe, expect, it } from 'vitest';
import { EQUIPMENT_BY_ID } from '../data/equipment';
import {
  canBuyEquipment,
  computeEquipCategoryMul,
  countAssigned,
  type EquipLoadout,
  equipmentPrice,
  freeCopies,
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

describe('computeEquipCategoryMul（集約）', () => {
  it('社員ゼロは全カテゴリ 1.0', () => {
    expect(computeEquipCategoryMul([])).toEqual({ program: 1, graphics: 1, sound: 1, scenario: 1 });
  });

  it('全員同じ装備なら、その増分が満額で乗る', () => {
    const lo: EquipLoadout = { pc: 'pc-desktop' }; // program 1.2
    const m = computeEquipCategoryMul([lo, lo, lo]);
    expect(m.program).toBeCloseTo(1.2, 5);
  });

  it('半分だけ装備すると増分が平均化される（人数非依存の集約）', () => {
    // 2人中1人だけ program 1.2 → 集約 program = 1 + (0.2 + 0)/2 = 1.1
    const equipped: EquipLoadout = { pc: 'pc-desktop' };
    const bare: EquipLoadout = {};
    const m = computeEquipCategoryMul([equipped, bare]);
    expect(m.program).toBeCloseTo(1.1, 5);
    expect(m.graphics).toBe(1);
  });

  it('渡した byId を使う（依存注入）', () => {
    const m = computeEquipCategoryMul([{ pc: 'pc-gaming' }], EQUIPMENT_BY_ID);
    expect(m.program).toBeCloseTo(1.35, 5);
    expect(m.scenario).toBeCloseTo(1.1, 5);
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
