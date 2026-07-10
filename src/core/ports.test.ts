import { describe, expect, it } from 'vitest';
import { defaultDeps, mulberry32 } from './ports';

describe('mulberry32', () => {
  it('同じ seed なら同じ系列を返す（決定性）', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 100; i++) {
      expect(a()).toBe(b());
    }
  });

  it('異なる seed なら異なる系列', () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    const seqA = Array.from({ length: 10 }, () => a());
    const seqB = Array.from({ length: 10 }, () => b());
    expect(seqA).not.toEqual(seqB);
  });

  it('値域は [0, 1)', () => {
    const rng = mulberry32(123);
    for (let i = 0; i < 1000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('defaultDeps', () => {
  it('本番実装は Math.random / Date.now', () => {
    expect(defaultDeps.rng).toBe(Math.random);
    expect(defaultDeps.now).toBe(Date.now);
  });
});
