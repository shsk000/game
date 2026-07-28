import { GACHA_CONFIG, INITIAL_FUNDS } from '../data/balance';
import { describe, expect, it } from 'vitest';
import type { Scale } from '../data/scales';
import { gachaPrice, pityThreshold } from './gacha';


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
      const { C, B, A, S } = GACHA_CONFIG[kind].rates;
      expect(C + B + A + S).toBeCloseTo(1.0, 10);
    }
  });

  it('normal の S 率は 0', () => {
    expect(GACHA_CONFIG.normal.rates.S).toBe(0);
  });
});
