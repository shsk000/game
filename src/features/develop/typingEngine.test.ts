import { describe, expect, it } from 'vitest';
import {
  applyKey,
  initialTypingStats,
  type TypingStats,
  WPM_MIN_SAMPLES,
  WPM_WINDOW,
} from './typingEngine';

/** 一定間隔（intervalMs）で n 打の correct を打つヘルパー */
const typeCorrect = (stats: TypingStats, n: number, intervalMs: number, startMs = 0) => {
  let s = stats;
  let last = { stats: s, comboBroken: null as number | null, wpmUpdated: false };
  for (let i = 0; i < n; i++) {
    last = applyKey(s, 'correct', startMs + i * intervalMs);
    s = last.stats;
  }
  return last;
};

describe('applyKey: correct', () => {
  it('コンボと正打数が増える', () => {
    const r = typeCorrect(initialTypingStats(), 3, 100);
    expect(r.stats.combo).toBe(3);
    expect(r.stats.correctCount).toBe(3);
    expect(r.stats.accuracy).toBe(1);
    expect(r.comboBroken).toBeNull();
  });

  it(`WPM は ${WPM_MIN_SAMPLES} 打鍵たまるまで算出されない`, () => {
    const under = typeCorrect(initialTypingStats(), WPM_MIN_SAMPLES - 1, 100);
    expect(under.wpmUpdated).toBe(false);
    expect(under.stats.wpm).toBe(0);
    const at = typeCorrect(initialTypingStats(), WPM_MIN_SAMPLES, 100);
    expect(at.wpmUpdated).toBe(true);
    expect(at.stats.wpm).toBeGreaterThan(0);
  });

  it('WPM = (サンプル数-1) / 経過分。100ms 間隔なら 600 打/分', () => {
    const r = typeCorrect(initialTypingStats(), 10, 100);
    expect(r.stats.wpm).toBeCloseTo(600, 5);
  });

  it(`タイムスタンプ窓は直近 ${WPM_WINDOW} 件に制限される`, () => {
    const r = typeCorrect(initialTypingStats(), WPM_WINDOW + 20, 100);
    expect(r.stats.correctTimes).toHaveLength(WPM_WINDOW);
  });

  it('同時刻打鍵（span 0）では WPM を更新しない（ゼロ除算防止）', () => {
    const r = typeCorrect(initialTypingStats(), 10, 0);
    expect(r.stats.wpm).toBe(0);
  });
});

describe('applyKey: fail', () => {
  it('コンボが切れ、切れる直前の値が comboBroken で返る', () => {
    const built = typeCorrect(initialTypingStats(), 5, 100).stats;
    const r = applyKey(built, 'fail', 1000);
    expect(r.stats.combo).toBe(0);
    expect(r.comboBroken).toBe(5);
    expect(r.stats.failCount).toBe(1);
  });

  it('コンボ 0 のときの fail は comboBroken を返さない', () => {
    const r = applyKey(initialTypingStats(), 'fail', 0);
    expect(r.comboBroken).toBeNull();
  });

  it('正確度 = 正打 / (正打 + ミス)', () => {
    const built = typeCorrect(initialTypingStats(), 3, 100).stats;
    const r = applyKey(built, 'fail', 1000);
    expect(r.stats.accuracy).toBeCloseTo(3 / 4);
  });

  it('WPM は据え置き（ミスでは再計算しない）', () => {
    const built = typeCorrect(initialTypingStats(), 10, 100).stats;
    const r = applyKey(built, 'fail', 5000);
    expect(r.stats.wpm).toBe(built.wpm);
    expect(r.wpmUpdated).toBe(false);
  });
});

describe('applyKey: complete（フレーズ完了打）', () => {
  it('コンボ・正打数は増えるがタイムスタンプは積まない（既存挙動の踏襲）', () => {
    const built = typeCorrect(initialTypingStats(), 3, 100).stats;
    const r = applyKey(built, 'complete', 1000);
    expect(r.stats.combo).toBe(4);
    expect(r.stats.correctCount).toBe(4);
    expect(r.stats.correctTimes).toHaveLength(3);
    expect(r.wpmUpdated).toBe(false);
  });
});

describe('initialTypingStats', () => {
  it('打鍵前の正確度は 1、WPM は 0', () => {
    const s = initialTypingStats();
    expect(s.accuracy).toBe(1);
    expect(s.wpm).toBe(0);
    expect(s.combo).toBe(0);
  });
});
