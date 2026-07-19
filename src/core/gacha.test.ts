import { describe, expect, it } from 'vitest';
import { GACHA_CONFIG, type GachaRank } from '../data/balance';
import type { Scale } from '../data/scales';
import { gachaPrice, nextPityCount, rollRank } from './gacha';
import { mulberry32 } from './ports';

describe('rollRank', () => {
  it('大量試行での実測排出率が設定値に近い（±3%）', () => {
    const rng = mulberry32(12345);
    const N = 30_000;
    const counts: Record<GachaRank, number> = { B: 0, A: 0, S: 0 };
    for (let i = 0; i < N; i++) counts[rollRank(rng, 0)]++;
    expect(counts.S / N).toBeCloseTo(GACHA_CONFIG.rates.S, 1);
    expect(counts.A / N).toBeGreaterThan(GACHA_CONFIG.rates.A - 0.03);
    expect(counts.A / N).toBeLessThan(GACHA_CONFIG.rates.A + 0.03);
    expect(counts.B / N).toBeGreaterThan(GACHA_CONFIG.rates.B - 0.03);
    expect(counts.B / N).toBeLessThan(GACHA_CONFIG.rates.B + 0.03);
  });

  it('ピティ閾値到達で S 確定（乱数に関わらず）', () => {
    // rng を常に 0.99（＝本来 B）にしても、pity 到達なら S
    const alwaysB = () => 0.99;
    expect(rollRank(alwaysB, GACHA_CONFIG.pityThreshold)).toBe('S');
    expect(rollRank(alwaysB, GACHA_CONFIG.pityThreshold + 5)).toBe('S');
  });

  it('ピティ未達なら通常抽選（閾値-1 では S 確定にしない）', () => {
    const alwaysB = () => 0.99;
    expect(rollRank(alwaysB, GACHA_CONFIG.pityThreshold - 1)).toBe('B');
  });
});

describe('nextPityCount', () => {
  it('S 排出でリセット、それ以外は +1', () => {
    expect(nextPityCount(7, 'S')).toBe(0);
    expect(nextPityCount(7, 'A')).toBe(8);
    expect(nextPityCount(7, 'B')).toBe(8);
    expect(nextPityCount(0, 'B')).toBe(1);
  });

  it('20連 B 続き→次が S 確定→カウンタが 0 に戻る一連の流れ', () => {
    let pity = 0;
    const alwaysB = () => 0.99;
    for (let i = 0; i < GACHA_CONFIG.pityThreshold; i++) {
      const rank = rollRank(alwaysB, pity);
      expect(rank).toBe('B');
      pity = nextPityCount(pity, rank);
    }
    expect(pity).toBe(GACHA_CONFIG.pityThreshold);
    const forced = rollRank(alwaysB, pity);
    expect(forced).toBe('S');
    pity = nextPityCount(pity, forced);
    expect(pity).toBe(0);
  });
});

describe('gachaPrice', () => {
  it('解放済み最高規模（配列末尾）に連動する', () => {
    expect(gachaPrice(['mini'])).toBe(GACHA_CONFIG.priceByScale.mini);
    expect(gachaPrice(['mini', 'mobile'])).toBe(GACHA_CONFIG.priceByScale.mobile);
    expect(gachaPrice(['mini', 'mobile', 'indie', 'hit', 'aaa'])).toBe(
      GACHA_CONFIG.priceByScale.aaa,
    );
  });

  it('空配列でも mini 価格にフォールバックする', () => {
    expect(gachaPrice([] as Scale[])).toBe(GACHA_CONFIG.priceByScale.mini);
  });

  it('規模が上がるほど価格は単調増加する', () => {
    const order: Scale[] = ['mini', 'mobile', 'indie', 'hit', 'aaa'];
    for (let i = 1; i < order.length; i++) {
      expect(GACHA_CONFIG.priceByScale[order[i]]).toBeGreaterThan(
        GACHA_CONFIG.priceByScale[order[i - 1]],
      );
    }
  });
});

describe('GACHA_CONFIG 整合性', () => {
  it('排出率の合計が 1.0', () => {
    const { B, A, S } = GACHA_CONFIG.rates;
    expect(B + A + S).toBeCloseTo(1.0, 10);
  });
});
