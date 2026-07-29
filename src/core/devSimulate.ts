import type { CurrentProject } from '../state/types';

/**
 * DEV 専用：タイピングを飛ばして「平均的な開発プレイ」を再現するための成績値（純関数）。
 *
 * 実プレイでは打鍵のたびに特徴ポイントが積まれる（core/features.ts）。
 * ここではスキップ時の穴埋めとして「平均的な腕前」に相当する固定値を返す。
 * 乱数・時刻は使わない（決定的）。
 *
 * ⚠ 実装ステップ3 以降、`perf` と `devStats` は**スコアには乗らない**
 * （記録とビルドアップ表示のみ）。スコアは特徴ポイントの一本道で決まる。
 *
 * 値の狙い（release.ts / metascore.ts の式で逆算）：
 *   - typingScore ≈ 50
 *     SCORE_BASE 30 + wpm140→+5 + combo250(≥150)→+10 + noBugs→+5、accuracy 0.98 は無罰
 *   - statQualityBonus ≈ 5（上限 8 の中〜高。program18*0.12 + graphics14*0.08 +
 *     sound14*0.08 + scenario12*0.05 = 5.0）
 */
export type SimulatedRun = {
  perf: CurrentProject['perf'];
  devStats: NonNullable<CurrentProject['devStats']>;
};

export const simulateAverageDevRun = (): SimulatedRun => ({
  perf: { wpm: 140, maxCombo: 250, accuracy: 0.98 },
  devStats: { program: 18, graphics: 14, sound: 14, scenario: 12 },
});
