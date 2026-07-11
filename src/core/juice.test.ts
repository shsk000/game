import { describe, expect, it } from 'vitest';
import { JUICE_CONFIG } from '../data/balance';
import { comboTitleAt, keyPitchStep } from './juice';

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
