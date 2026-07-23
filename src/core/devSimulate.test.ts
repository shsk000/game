import { describe, expect, it } from 'vitest';
import { STAT_QUALITY_BONUS_CAP } from '../data/balance';
import { computePerformanceScore } from '../utils/metascore';
import { simulateAverageDevRun } from './devSimulate';

describe('simulateAverageDevRun', () => {
  it('平均成績の typingScore は “それなり”帯（45〜65）に入る', () => {
    const { perf } = simulateAverageDevRun();
    // 発売時はバグ 0（noBugs=true）で発売される想定
    const score = computePerformanceScore({ ...perf, noBugs: true });
    expect(score).toBeGreaterThanOrEqual(45);
    expect(score).toBeLessThanOrEqual(65);
  });

  it('devStats の品質ボーナスは cap/2〜cap の“それなり”帯（release.ts と同じ重み）', () => {
    const { devStats } = simulateAverageDevRun();
    const bonus =
      devStats.program * 0.12 +
      devStats.graphics * 0.08 +
      devStats.sound * 0.08 +
      devStats.design * 0.05;
    // 品質が実感できる水準（上限の半分以上）かつ上限を超えない
    expect(bonus).toBeGreaterThanOrEqual(STAT_QUALITY_BONUS_CAP / 2);
    expect(bonus).toBeLessThanOrEqual(STAT_QUALITY_BONUS_CAP);
  });
});
