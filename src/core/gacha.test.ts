import { describe, expect, it } from 'vitest';
import { GACHA_CONFIG, type GachaRank, INITIAL_FUNDS } from '../data/balance';
import type { Scale } from '../data/scales';
import { gachaPrice, nextPityCount, pityThreshold, rollRank } from './gacha';
import { mulberry32 } from './ports';

describe('rollRank（normal＝S無し）', () => {
  it('ノーマルは S を一切出さず、B/A の実測率が設定値に近い（±3%）', () => {
    const rng = mulberry32(12345);
    const N = 30_000;
    const counts: Record<GachaRank, number> = { B: 0, A: 0, S: 0 };
    for (let i = 0; i < N; i++) counts[rollRank('normal', rng, 0)]++;
    expect(counts.S).toBe(0); // S は絶対に出ない
    expect(counts.A / N).toBeGreaterThan(GACHA_CONFIG.normal.rates.A - 0.03);
    expect(counts.A / N).toBeLessThan(GACHA_CONFIG.normal.rates.A + 0.03);
    expect(counts.B / N).toBeGreaterThan(GACHA_CONFIG.normal.rates.B - 0.03);
  });

  it('ノーマルは天井無効（pity を積んでも S 確定にならない）', () => {
    const alwaysB = () => 0.99;
    expect(rollRank('normal', alwaysB, 999)).toBe('B');
  });
});

describe('rollRank（premium＝S源＋天井）', () => {
  it('大量試行での実測排出率が設定値に近い（±3%）', () => {
    const rng = mulberry32(999);
    const N = 30_000;
    const counts: Record<GachaRank, number> = { B: 0, A: 0, S: 0 };
    for (let i = 0; i < N; i++) counts[rollRank('premium', rng, 0)]++;
    expect(counts.S / N).toBeGreaterThan(GACHA_CONFIG.premium.rates.S - 0.03);
    expect(counts.S / N).toBeLessThan(GACHA_CONFIG.premium.rates.S + 0.03);
    expect(counts.A / N).toBeGreaterThan(GACHA_CONFIG.premium.rates.A - 0.03);
    expect(counts.B / N).toBeGreaterThan(GACHA_CONFIG.premium.rates.B - 0.03);
  });

  it('ピティ閾値到達で S 確定（乱数に関わらず）', () => {
    const alwaysB = () => 0.99;
    const th = GACHA_CONFIG.premium.pityThreshold;
    expect(rollRank('premium', alwaysB, th)).toBe('S');
    expect(rollRank('premium', alwaysB, th + 5)).toBe('S');
  });

  it('ピティ未達なら通常抽選（閾値-1 では S 確定にしない）', () => {
    const alwaysB = () => 0.99;
    expect(rollRank('premium', alwaysB, GACHA_CONFIG.premium.pityThreshold - 1)).toBe('B');
  });
});

describe('nextPityCount', () => {
  it('S 排出でリセット、それ以外は +1', () => {
    expect(nextPityCount(7, 'S')).toBe(0);
    expect(nextPityCount(7, 'A')).toBe(8);
    expect(nextPityCount(7, 'B')).toBe(8);
    expect(nextPityCount(0, 'B')).toBe(1);
  });

  it('premium 天井連続 B→次が S 確定→カウンタが 0 に戻る一連の流れ', () => {
    let pity = 0;
    const alwaysB = () => 0.99;
    const th = GACHA_CONFIG.premium.pityThreshold;
    for (let i = 0; i < th; i++) {
      const rank = rollRank('premium', alwaysB, pity);
      expect(rank).toBe('B');
      pity = nextPityCount(pity, rank);
    }
    expect(pity).toBe(th);
    const forced = rollRank('premium', alwaysB, pity);
    expect(forced).toBe('S');
    pity = nextPityCount(pity, forced);
    expect(pity).toBe(0);
  });
});

describe('gachaPrice', () => {
  it('種類別に、解放済み最高規模（配列末尾）で価格を引く', () => {
    expect(gachaPrice('normal', ['mini'])).toBe(GACHA_CONFIG.normal.priceByScale.mini);
    expect(gachaPrice('premium', ['mini'])).toBe(GACHA_CONFIG.premium.priceByScale.mini);
    expect(gachaPrice('normal', ['mini', 'mobile'])).toBe(GACHA_CONFIG.normal.priceByScale.mobile);
    expect(gachaPrice('premium', ['mini', 'mobile', 'indie', 'hit', 'aaa'])).toBe(
      GACHA_CONFIG.premium.priceByScale.aaa,
    );
  });

  it('空配列でも mini 価格にフォールバックする', () => {
    expect(gachaPrice('normal', [] as Scale[])).toBe(GACHA_CONFIG.normal.priceByScale.mini);
    expect(gachaPrice('premium', [] as Scale[])).toBe(GACHA_CONFIG.premium.priceByScale.mini);
  });

  it('プレミアムはどの規模でもノーマルより高い（序盤ほど差が大きい）', () => {
    const order: Scale[] = ['mini', 'mobile', 'indie', 'hit', 'aaa'];
    for (const sc of order) {
      expect(GACHA_CONFIG.premium.priceByScale[sc]).toBeGreaterThan(
        GACHA_CONFIG.normal.priceByScale[sc],
      );
    }
  });

  it('mini のプレミアム価格は初期資金を上回る＝序盤は 1 発も引けない設計', () => {
    // mini premium > INITIAL_FUNDS なら開始直後は premium を引けない（funds < price）
    expect(GACHA_CONFIG.premium.priceByScale.mini).toBeGreaterThan(INITIAL_FUNDS);
  });

  it('各種類とも規模が上がるほど価格は単調増加する', () => {
    const order: Scale[] = ['mini', 'mobile', 'indie', 'hit', 'aaa'];
    for (const kind of ['normal', 'premium'] as const) {
      for (let i = 1; i < order.length; i++) {
        expect(GACHA_CONFIG[kind].priceByScale[order[i]]).toBeGreaterThan(
          GACHA_CONFIG[kind].priceByScale[order[i - 1]],
        );
      }
    }
  });
});

describe('pityThreshold ヘルパ', () => {
  it('normal は 0（天井無し）、premium は正の閾値', () => {
    expect(pityThreshold('normal')).toBe(0);
    expect(pityThreshold('premium')).toBe(GACHA_CONFIG.premium.pityThreshold);
    expect(pityThreshold('premium')).toBeGreaterThan(0);
  });
});

describe('GACHA_CONFIG 整合性', () => {
  it('各種類の排出率合計が 1.0', () => {
    for (const kind of ['normal', 'premium'] as const) {
      const { B, A, S } = GACHA_CONFIG[kind].rates;
      expect(B + A + S).toBeCloseTo(1.0, 10);
    }
  });

  it('normal の S 率は 0', () => {
    expect(GACHA_CONFIG.normal.rates.S).toBe(0);
  });
});
