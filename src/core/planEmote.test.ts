import { describe, expect, it } from 'vitest';
import { PLAN_IDEA_EMOTES, PLAN_THINKING_EMOTES, pickPlanEmote } from './planEmote';

/** 呼び出し順に固定値を返す決定論 rng。 */
const seqRng = (values: number[]): (() => number) => {
  let i = 0;
  return () => values[i++ % values.length];
};

describe('pickPlanEmote', () => {
  it('rng が 0 のとき先頭スポット・先頭エモートを選ぶ（idea 既定）', () => {
    const { spot, def } = pickPlanEmote(seqRng([0, 0]), 5);
    expect(spot).toBe(0);
    expect(def).toBe(PLAN_IDEA_EMOTES[0]);
  });

  it('rng が 1 直前のとき末尾スポット・末尾エモートを選ぶ（範囲外にならない）', () => {
    const { spot, def } = pickPlanEmote(seqRng([0.999999, 0.999999]), 5);
    expect(spot).toBe(4);
    expect(def).toBe(PLAN_IDEA_EMOTES[PLAN_IDEA_EMOTES.length - 1]);
  });

  it("kind='thinking' では考え中エモート集合から選ぶ", () => {
    const { def } = pickPlanEmote(seqRng([0, 0]), 5, 'thinking');
    expect(def).toBe(PLAN_THINKING_EMOTES[0]);
    expect(PLAN_THINKING_EMOTES).toContain(def);
  });

  it('spot は常に 0..spotCount-1、def は指定 kind の集合の要素', () => {
    for (let n = 0; n < 200; n++) {
      const idea = pickPlanEmote(seqRng([n / 200, ((n * 7) % 200) / 200]), 5, 'idea');
      expect(idea.spot).toBeGreaterThanOrEqual(0);
      expect(idea.spot).toBeLessThan(5);
      expect(PLAN_IDEA_EMOTES).toContain(idea.def);

      const think = pickPlanEmote(seqRng([n / 200, ((n * 3) % 200) / 200]), 5, 'thinking');
      expect(PLAN_THINKING_EMOTES).toContain(think.def);
    }
  });

  it('全エモート定義は src と emoji を持つ', () => {
    for (const def of [...PLAN_IDEA_EMOTES, ...PLAN_THINKING_EMOTES]) {
      expect(def.src).toMatch(/^\/sprites\/ui\/emote_.+\.png$/);
      expect(def.emoji.length).toBeGreaterThan(0);
    }
  });

  it('spotCount が 0 以下でも spot=0 を返す（クラッシュしない）', () => {
    expect(pickPlanEmote(seqRng([0.5, 0.5]), 0).spot).toBe(0);
    expect(pickPlanEmote(seqRng([0.5, 0.5]), -3).spot).toBe(0);
  });
});
