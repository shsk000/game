import { describe, expect, it } from 'vitest';
import { JUICE_CONFIG } from '../data/balance';
import {
  comboTitleAt,
  gearFor,
  isCrunchActive,
  keyPitchStep,
  rollBoss,
  rollCrit,
  rollRare,
} from './juice';

describe('keyPitchStep（コンボ→打鍵音の音階）', () => {
  it('コンボ 10 ごとに半音 +1 上がる', () => {
    expect(keyPitchStep(0)).toBe(0);
    expect(keyPitchStep(9)).toBe(0);
    expect(keyPitchStep(10)).toBe(1);
    expect(keyPitchStep(59)).toBe(5);
  });

  it('上限は 12 半音（1オクターブ）で頭打ち', () => {
    expect(keyPitchStep(120)).toBe(12);
    expect(keyPitchStep(999)).toBe(12);
  });

  it('負値（防御）は 0', () => {
    expect(keyPitchStep(-5)).toBe(0);
  });
});

describe('comboTitleAt（コンボ節目の称号）', () => {
  it('節目ちょうどで称号を返す', () => {
    for (const t of JUICE_CONFIG.comboTitles) {
      expect(comboTitleAt(t.combo)).toBe(t.label);
    }
  });

  it('節目以外は null（±1でも出ない＝1節目1回だけ）', () => {
    expect(comboTitleAt(0)).toBeNull();
    expect(comboTitleAt(49)).toBeNull();
    expect(comboTitleAt(51)).toBeNull();
    expect(comboTitleAt(151)).toBeNull();
  });
});

describe('rollCrit（v0.20 B：クリティカル打鍵の判定）', () => {
  it('rng が rate 未満なら発動', () => {
    expect(rollCrit(() => JUICE_CONFIG.crit.rate - 0.001)).toBe(true);
  });

  it('rng が rate 以上なら不発（境界値）', () => {
    expect(rollCrit(() => JUICE_CONFIG.crit.rate)).toBe(false);
    expect(rollCrit(() => JUICE_CONFIG.crit.rate + 0.001)).toBe(false);
  });
});

describe('rollRare（v0.20 B：レア文章の判定）', () => {
  it('rng が rate 未満なら発動', () => {
    expect(rollRare(() => JUICE_CONFIG.rare.rate - 0.001)).toBe(true);
  });

  it('rng が rate 以上なら不発（境界値）', () => {
    expect(rollRare(() => JUICE_CONFIG.rare.rate)).toBe(false);
    expect(rollRare(() => JUICE_CONFIG.rare.rate + 0.001)).toBe(false);
  });
});

describe('isCrunchActive（v0.20 C：クランチタイムの判定）', () => {
  it('全体完成度が閾値未満なら false', () => {
    expect(isCrunchActive(JUICE_CONFIG.crunch.startPct - 1)).toBe(false);
    expect(isCrunchActive(0)).toBe(false);
  });

  it('全体完成度が閾値ちょうど・以上なら true', () => {
    expect(isCrunchActive(JUICE_CONFIG.crunch.startPct)).toBe(true);
    expect(isCrunchActive(100)).toBe(true);
  });
});

describe('rollBoss（v0.20 C：ボス文章の判定）', () => {
  it('rng が bossRate 未満なら発動', () => {
    expect(rollBoss(() => JUICE_CONFIG.crunch.bossRate - 0.001)).toBe(true);
  });

  it('rng が bossRate 以上なら不発（境界値）', () => {
    expect(rollBoss(() => JUICE_CONFIG.crunch.bossRate)).toBe(false);
    expect(rollBoss(() => JUICE_CONFIG.crunch.bossRate + 0.001)).toBe(false);
  });
});

describe('gearFor（v0.20 E：入力速度→ギア）', () => {
  it('1段目の閾値未満は最低ギア（feverGain 1）', () => {
    expect(gearFor(0).feverGain).toBe(1);
    expect(gearFor(JUICE_CONFIG.gears[0].minWpm - 1).feverGain).toBe(1);
  });

  it('1段目の閾値ちょうど・以上で1段目のギアになる', () => {
    const g1 = JUICE_CONFIG.gears[0];
    expect(gearFor(g1.minWpm)).toEqual(g1);
    expect(gearFor(g1.minWpm + 1).feverGain).toBe(g1.feverGain);
  });

  it('2段目の閾値以上で2段目のギアになる（最高段が残る）', () => {
    const g2 = JUICE_CONFIG.gears[1];
    expect(gearFor(g2.minWpm)).toEqual(g2);
    expect(gearFor(9999)).toEqual(g2);
  });
});
