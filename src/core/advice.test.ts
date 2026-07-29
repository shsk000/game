import { describe, expect, it } from 'vitest';
import { normalizedWeightsFor } from '../data/archetypes';
import { ADVICE_GOOD_THRESHOLD } from '../data/balance';
import type { FeatureId, Work } from '../state/types';
import { ADVICE_ALL_GOOD, adviceFor, FEATURE_ADVICE } from './advice';

/**
 * 特徴ポイント（0〜100）から Work.breakdown.features（＝ポイント × 重み）を作る。
 * adviceFor は重みで割り戻して素のポイントに戻すので、往復が成り立つ形で組む。
 */
const workWith = (genreId: Work['genreId'], points: Partial<Record<FeatureId, number>>): Work => {
  const w = normalizedWeightsFor(genreId);
  const features: Partial<Record<FeatureId, number>> = {};
  for (const [id, p] of Object.entries(points) as [FeatureId, number][]) {
    features[id] = p * w[id];
  }
  return { genreId, breakdown: { features } } as Work;
};

const ALL = (v: number): Record<FeatureId, number> => ({
  usabilityPt: v,
  graphicsPt: v,
  soundPt: v,
  storyPt: v,
  innovationPt: v,
});

describe('adviceFor（次の一手）', () => {
  it('全分野が閾値以上なら死角なし', () => {
    expect(adviceFor(workWith('action', ALL(ADVICE_GOOD_THRESHOLD + 5)))).toBe(ADVICE_ALL_GOOD);
  });

  it('ちょうど閾値でも死角なし（境界）', () => {
    expect(adviceFor(workWith('action', ALL(ADVICE_GOOD_THRESHOLD)))).toBe(ADVICE_ALL_GOOD);
  });

  it.each([
    ['usabilityPt', 'action'],
    ['graphicsPt', 'action'],
    ['soundPt', 'partygame'],
    ['storyPt', 'rpg'],
  ] as [FeatureId, Work['genreId']][])('%s だけ低ければその分野を指摘する', (low, genreId) => {
    const points = { ...ALL(100), [low]: 0 };
    expect(adviceFor(workWith(genreId, points))).toBe(FEATURE_ADVICE[low]);
  });

  it('同じ不足なら、そのジャンルで重い（◎）分野を優先して指摘する', () => {
    // ホラー（物語型）は 🎵📖 が ◎、🕹 が △。
    // 操作性とサウンドが同じだけ足りないなら、伸ばして効くサウンドを指摘する
    const points = { ...ALL(100), usabilityPt: 20, soundPt: 20 };
    expect(adviceFor(workWith('horror', points))).toBe(FEATURE_ADVICE.soundPt);
  });

  it('革新性が低いときは組合せを変えるよう促す（社員では直らない）', () => {
    const points = { ...ALL(100), innovationPt: 10 };
    expect(adviceFor(workWith('action', points))).toBe(FEATURE_ADVICE.innovationPt);
  });

  it('内訳が空でも落ちない', () => {
    expect(adviceFor({ genreId: 'action', breakdown: {} } as Work)).toBe(FEATURE_ADVICE.usabilityPt);
  });
});
