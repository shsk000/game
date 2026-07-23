import type { CurrentProject } from '../state/types';

/**
 * DEV 専用：タイピングを飛ばして「平均的な開発プレイ」を再現するための成績値（純関数）。
 *
 * 実プレイでは `current.perf`（wpm/maxCombo/accuracy）と `devStats` に打鍵結果が蓄積し、
 * それが release.ts の `computeQualityV10`（typingScore weight 0.15・上限なし）と
 * `statQualityBonus`（上限 `STAT_QUALITY_BONUS_CAP`=8）へ合流して品質になる。
 * ここではその「平均的な腕前」に相当する固定値を返し、スキップ後も“それなりの品質”で
 * 発売できるようにする。乱数・時刻は使わない（決定的）。
 *
 * 値の狙い（release.ts / metascore.ts の式で逆算）：
 *   - typingScore ≈ 50
 *     SCORE_BASE 30 + wpm140→+5 + combo250(≥150)→+10 + noBugs→+5、accuracy 0.98 は無罰
 *   - statQualityBonus ≈ 5（上限 8 の中〜高。program18*0.12 + graphics14*0.08 +
 *     sound14*0.08 + design12*0.05 = 5.0）
 */
export type SimulatedRun = {
  perf: CurrentProject['perf'];
  devStats: NonNullable<CurrentProject['devStats']>;
};

export const simulateAverageDevRun = (): SimulatedRun => ({
  perf: { wpm: 140, maxCombo: 250, accuracy: 0.98 },
  devStats: { program: 18, graphics: 14, sound: 14, design: 12 },
});
