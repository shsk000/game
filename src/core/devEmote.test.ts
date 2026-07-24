import { describe, expect, it } from 'vitest';
import { DEV_DONE_EMOTES, DEV_FOCUS_EMOTES, pickDevEmote } from './devEmote';

/** 呼び出し順に固定値を返す決定論 rng。 */
const seqRng = (values: number[]): (() => number) => {
  let i = 0;
  return () => values[i++ % values.length];
};

describe('pickDevEmote', () => {
  it('rng が 0 のとき先頭席・先頭エモートを選ぶ（focus 既定）', () => {
    const { seat, def } = pickDevEmote(seqRng([0, 0]), 6);
    expect(seat).toBe(0);
    expect(def).toBe(DEV_FOCUS_EMOTES[0]);
  });

  it('rng が 1 直前のとき末尾席・末尾エモートを選ぶ（範囲外にならない）', () => {
    const { seat, def } = pickDevEmote(seqRng([0.999999, 0.999999]), 6);
    expect(seat).toBe(5);
    expect(def).toBe(DEV_FOCUS_EMOTES[DEV_FOCUS_EMOTES.length - 1]);
  });

  it("kind='done' ではできたエモート集合から選ぶ", () => {
    const { def } = pickDevEmote(seqRng([0, 0]), 6, 'done');
    expect(def).toBe(DEV_DONE_EMOTES[0]);
    expect(DEV_DONE_EMOTES).toContain(def);
  });

  it('seat は常に 0..seatCount-1、def は指定 kind の集合の要素', () => {
    for (let n = 0; n < 200; n++) {
      const done = pickDevEmote(seqRng([n / 200, ((n * 7) % 200) / 200]), 6, 'done');
      expect(done.seat).toBeGreaterThanOrEqual(0);
      expect(done.seat).toBeLessThan(6);
      expect(DEV_DONE_EMOTES).toContain(done.def);

      const focus = pickDevEmote(seqRng([n / 200, ((n * 3) % 200) / 200]), 6, 'focus');
      expect(DEV_FOCUS_EMOTES).toContain(focus.def);
    }
  });

  it('全エモート定義は src と emoji を持つ', () => {
    for (const def of [...DEV_DONE_EMOTES, ...DEV_FOCUS_EMOTES]) {
      expect(def.src).toMatch(/^\/sprites\/ui\/emote_.+\.png$/);
      expect(def.emoji.length).toBeGreaterThan(0);
    }
  });

  it('seatCount が 0 以下でも seat=0 を返す（クラッシュしない）', () => {
    expect(pickDevEmote(seqRng([0.5, 0.5]), 0).seat).toBe(0);
    expect(pickDevEmote(seqRng([0.5, 0.5]), -3).seat).toBe(0);
  });
});
