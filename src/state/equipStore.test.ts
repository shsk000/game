import { beforeEach, describe, expect, it } from 'vitest';
import { useGameStore } from './gameStore';
import { resetStore } from './testing';
import type { Employee } from './types';

const emp = (over: Partial<Employee> = {}): Employee => ({
  id: 'e1',
  name: 'テスト太郎',
  role: 'programmer',
  power: 0.4,
  basePower: 0.4,
  level: 1,
  exp: 0,
  wage: 540_000,
  specialties: [], skills: {},
  ...over,
});

const gs = () => useGameStore.getState();

describe('buyEquipment（v0.25 装備購入・実体方式）', () => {
  beforeEach(() => resetStore({ funds: 200_000_000, ownedItems: {} }));

  it('資金以上なら購入でき、funds が減り所有個数が +1', () => {
    expect(gs().buyEquipment('pc-desktop')).toBe(true); // cost 30,000,000
    expect(gs().funds).toBe(200_000_000 - 30_000_000);
    expect(gs().ownedItems['pc-desktop']).toBe(1);
  });

  it('同じ物を複数購入できる（実体方式＝個数が増える）', () => {
    gs().buyEquipment('pc-desktop');
    gs().buyEquipment('pc-desktop');
    expect(gs().ownedItems['pc-desktop']).toBe(2);
    expect(gs().funds).toBe(200_000_000 - 60_000_000);
  });

  it('資金不足は false・状態不変', () => {
    resetStore({ funds: 29_999_999, ownedItems: {} });
    expect(gs().buyEquipment('pc-desktop')).toBe(false);
    expect(gs().funds).toBe(29_999_999);
    expect(gs().ownedItems).toEqual({});
  });

  it('初期装備（cost0）・不明IDは false', () => {
    expect(gs().buyEquipment('pc-laptop')).toBe(false);
    expect(gs().buyEquipment('no-such-item')).toBe(false);
  });
});

describe('equipItem（v0.25 装備割当・空き個数の消費）', () => {
  beforeEach(() =>
    resetStore({
      funds: 200_000_000,
      employees: [emp(), emp({ id: 'e2', name: 'テスト次郎' })],
      ownedItems: {},
    }),
  );

  it('所有していないアイテムは装備できない', () => {
    expect(gs().equipItem('e1', 'pc', 'pc-desktop')).toBe(false);
    expect(gs().employees[0].equipped ?? {}).toEqual({});
  });

  it('購入して所有すれば装備でき、Employee.equipped に入る', () => {
    gs().buyEquipment('pc-desktop');
    expect(gs().equipItem('e1', 'pc', 'pc-desktop')).toBe(true);
    expect(gs().employees[0].equipped?.pc).toBe('pc-desktop');
  });

  it('1個しか無ければ2人目には装備できない（空きが尽きる）', () => {
    gs().buyEquipment('pc-desktop'); // 1個
    expect(gs().equipItem('e1', 'pc', 'pc-desktop')).toBe(true);
    expect(gs().equipItem('e2', 'pc', 'pc-desktop')).toBe(false); // 空き0
    expect(gs().employees[1].equipped ?? {}).toEqual({});
  });

  it('2個買えば2人に装備できる', () => {
    gs().buyEquipment('pc-desktop');
    gs().buyEquipment('pc-desktop');
    expect(gs().equipItem('e1', 'pc', 'pc-desktop')).toBe(true);
    expect(gs().equipItem('e2', 'pc', 'pc-desktop')).toBe(true);
  });

  it('スロット不一致は false（PCスロットに小物は付かない）', () => {
    gs().buyEquipment('misc-pentab');
    expect(gs().equipItem('e1', 'pc', 'misc-pentab')).toBe(false);
  });

  it('null で解除すると空きが戻り、別社員に付け替えできる', () => {
    gs().buyEquipment('pc-desktop'); // 1個
    gs().equipItem('e1', 'pc', 'pc-desktop');
    expect(gs().equipItem('e2', 'pc', 'pc-desktop')).toBe(false); // まだ空き0
    gs().equipItem('e1', 'pc', null); // 解除 → 空き1
    expect(gs().employees[0].equipped?.pc).toBeUndefined();
    expect(gs().equipItem('e2', 'pc', 'pc-desktop')).toBe(true);
  });

  it('不明な社員IDは false', () => {
    gs().buyEquipment('pc-desktop');
    expect(gs().equipItem('nobody', 'pc', 'pc-desktop')).toBe(false);
  });
});
