import { describe, expect, it } from 'vitest';
import { INVEST_CONFIG } from '../data/balance';
import { canBuyUnlock, investPrice, investStageBase } from './invest';

describe('investStageBase', () => {
  it('stage 2/3/4 は基礎額を返す（×10 刻み）', () => {
    expect(investStageBase(2)).toBe(300_000);
    expect(investStageBase(3)).toBe(3_000_000);
    expect(investStageBase(4)).toBe(30_000_000);
  });

  it('stage 1（初期解放）とテーブル外は null', () => {
    expect(investStageBase(1)).toBeNull();
    expect(investStageBase(0)).toBeNull();
    expect(investStageBase(5)).toBeNull();
  });
});

describe('investPrice（購入数による逓増カーブ）', () => {
  it('購入数 0 は基礎額そのもの', () => {
    expect(investPrice(2, 0)).toBe(300_000);
    expect(investPrice(4, 0)).toBe(30_000_000);
  });

  it('購入するたびに公比倍になる（¥万丸め）', () => {
    const r = INVEST_CONFIG.priceGrowth; // 1.8
    // stage2 base 30万 × 1.8^n を ¥万 に丸めた値
    expect(investPrice(2, 1)).toBe(Math.round((300_000 * r) / 10_000) * 10_000); // ¥54万
    expect(investPrice(2, 2)).toBe(Math.round((300_000 * r ** 2) / 10_000) * 10_000); // ¥97万
    expect(investPrice(2, 5)).toBe(Math.round((300_000 * r ** 5) / 10_000) * 10_000);
  });

  it('単調増加：購入数が増えると必ず高くなる', () => {
    let prev = 0;
    for (let n = 0; n <= 10; n++) {
      const p = investPrice(4, n) as number;
      expect(p).toBeGreaterThan(prev);
      prev = p;
    }
  });

  it('購入不可 stage は購入数に関わらず null', () => {
    expect(investPrice(1, 0)).toBeNull();
    expect(investPrice(1, 5)).toBeNull();
    expect(investPrice(5, 3)).toBeNull();
  });
});

describe('canBuyUnlock', () => {
  it('未解放・価格ちょうどで購入可（購入数0の境界）', () => {
    expect(canBuyUnlock({ alreadyUnlocked: false, stage: 2, purchaseCount: 0, funds: 300_000 })).toBe(
      true,
    );
  });

  it('資金が1円でも足りなければ不可（境界）', () => {
    expect(
      canBuyUnlock({ alreadyUnlocked: false, stage: 2, purchaseCount: 0, funds: 299_999 }),
    ).toBe(false);
  });

  it('購入数が増えて価格が上がると、同じ資金でも買えなくなりうる', () => {
    // 公比 1.2：stage2 の1個目 ¥30万 は買えるが、15個目（¥100万超）は ¥100万 では買えない
    expect(
      canBuyUnlock({ alreadyUnlocked: false, stage: 2, purchaseCount: 0, funds: 1_000_000 }),
    ).toBe(true);
    expect(
      canBuyUnlock({ alreadyUnlocked: false, stage: 2, purchaseCount: 15, funds: 1_000_000 }),
    ).toBe(false);
  });

  it('壁にならない：stage2 を全部（22個）買っても最後が ¥1500万以下', () => {
    // オーナー指摘「途中からあげれない」への直接のガード。
    // 旧公比 1.8 では 21個目が ¥382億 で、AAA の基準売上 ¥60億 でも買えなかった
    expect(investPrice(2, 21)!).toBeLessThanOrEqual(15_000_000);
  });

  it('壁にならない：全 stage を全部買っても総額が ¥20億以下', () => {
    const counts = { 2: 22, 3: 14, 4: 13 } as const;
    let total = 0;
    for (const [stage, n] of Object.entries(counts)) {
      for (let i = 0; i < n; i++) total += investPrice(Number(stage), i)!;
    }
    expect(total, `全49個で ¥${Math.round(total / 1e8)}億`).toBeLessThanOrEqual(2_000_000_000);
  });

  it('それでも買うほど高くなる（オーナー指示は保つ）', () => {
    expect(investPrice(2, 21)!).toBeGreaterThan(investPrice(2, 0)! * 20);
  });

  it('すでに解放済みなら資金が足りても不可（二重課金にしない）', () => {
    expect(
      canBuyUnlock({ alreadyUnlocked: true, stage: 4, purchaseCount: 0, funds: 999_999_999 }),
    ).toBe(false);
  });

  it('stage 1（初期解放）は不可', () => {
    expect(
      canBuyUnlock({ alreadyUnlocked: false, stage: 1, purchaseCount: 0, funds: 999_999_999 }),
    ).toBe(false);
  });
});
