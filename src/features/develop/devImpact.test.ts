import { describe, expect, it } from 'vitest';
import { DEV_IMPACT_THRESHOLDS, DEV_SPEED_GAIN, KEYSTROKE_RATING } from '../../data/balance';
import {
  computeDevImpact,
  NORI_MAX_COMBO,
  noriMultiplier,
  progressGain,
  ratingForInterval,
  toCharsPerMin,
} from './devImpact';

describe('computeDevImpact', () => {
  it('wpm 100・精度 100% を基準に速度 0% / 品質 +5 / バグ -5%', () => {
    const r = computeDevImpact({ wpm: 100, accuracy: 1 });
    expect(r.speedPct).toBe(0);
    expect(r.qualityDelta).toBe(5);
    expect(r.bugPct).toBe(-5);
  });

  it('速度は -30〜+40% にクランプされる', () => {
    expect(computeDevImpact({ wpm: 0, accuracy: 1 }).speedPct).toBe(-30);
    expect(computeDevImpact({ wpm: 500, accuracy: 1 }).speedPct).toBe(40);
  });

  it('品質は精度 0.90 で 0、1.0 で 5（0..5 クランプ）', () => {
    expect(computeDevImpact({ wpm: 100, accuracy: 0.9 }).qualityDelta).toBe(0);
    expect(computeDevImpact({ wpm: 100, accuracy: 0.5 }).qualityDelta).toBe(0);
    expect(computeDevImpact({ wpm: 100, accuracy: 0.98 }).qualityDelta).toBe(4);
  });

  it('ランクは balance.ts のしきい値どおり', () => {
    const st = DEV_IMPACT_THRESHOLDS.speed;
    expect(computeDevImpact({ wpm: st.S, accuracy: 1 }).speedRank).toBe('S');
    expect(computeDevImpact({ wpm: st.A, accuracy: 1 }).speedRank).toBe('A');
    expect(computeDevImpact({ wpm: st.B, accuracy: 1 }).speedRank).toBe('B');
    expect(computeDevImpact({ wpm: st.B - 1, accuracy: 1 }).speedRank).toBe('C');

    const qt = DEV_IMPACT_THRESHOLDS.quality;
    expect(computeDevImpact({ wpm: 100, accuracy: qt.S }).qualityRank).toBe('S');
    expect(computeDevImpact({ wpm: 100, accuracy: qt.B - 0.01 }).qualityRank).toBe('C');

    const bt = DEV_IMPACT_THRESHOLDS.bug;
    // 浮動小数点誤差（1 - 0.99 = 0.010000…9）でしきい値ちょうどが超過判定になるため、明確に内側/外側の値で見る
    expect(computeDevImpact({ wpm: 100, accuracy: 1 - bt.S / 2 }).bugRank).toBe('S');
    expect(computeDevImpact({ wpm: 100, accuracy: 1 - bt.B - 0.02 }).bugRank).toBe('C');
  });
});

describe('ratingForInterval', () => {
  it('打鍵間隔のしきい値で PERFECT / GREAT / GOOD / null', () => {
    expect(ratingForInterval(KEYSTROKE_RATING.PERFECT)).toBe('PERFECT');
    expect(ratingForInterval(KEYSTROKE_RATING.PERFECT + 1)).toBe('GREAT');
    expect(ratingForInterval(KEYSTROKE_RATING.GREAT + 1)).toBe('GOOD');
    expect(ratingForInterval(KEYSTROKE_RATING.GOOD + 1)).toBeNull();
  });
});

describe('noriMultiplier', () => {
  it('0 コンボ ×1.0 → 上限コンボ ×2.0 の線形', () => {
    expect(noriMultiplier(0)).toBe(1);
    expect(noriMultiplier(NORI_MAX_COMBO / 2)).toBeCloseTo(1.5);
    expect(noriMultiplier(NORI_MAX_COMBO)).toBe(2);
  });

  it('上限を超えても ×2.0 で頭打ち、負値は ×1.0', () => {
    expect(noriMultiplier(NORI_MAX_COMBO * 10)).toBe(2);
    expect(noriMultiplier(-100)).toBe(1);
  });
});

describe('progressGain', () => {
  const { baseWpm, fastWpm, maxBonus } = DEV_SPEED_GAIN;

  it('基準 wpm 以下は 1 本 = 1.0（コンボなし）', () => {
    expect(progressGain(baseWpm, false)).toBe(1);
    expect(progressGain(0, false)).toBe(1);
  });

  it('fastWpm 以上で最大ボーナス（1 + maxBonus）', () => {
    expect(progressGain(fastWpm, false)).toBeCloseTo(1 + maxBonus);
    expect(progressGain(fastWpm * 2, false)).toBeCloseTo(1 + maxBonus);
  });

  it('バグ修正フレーズは基礎 3 倍', () => {
    expect(progressGain(baseWpm, true)).toBe(3);
  });

  it('ノリ倍率（コンボ）が乗算される', () => {
    expect(progressGain(baseWpm, false, NORI_MAX_COMBO)).toBe(2);
    expect(progressGain(fastWpm, true, NORI_MAX_COMBO)).toBeCloseTo(3 * (1 + maxBonus) * 2);
  });
});

describe('toCharsPerMin', () => {
  it('wpm（打鍵/分）をかな文字/分に換算する', () => {
    expect(toCharsPerMin(200)).toBe(100); // KEYS_PER_KANA = 2.0
  });
});
