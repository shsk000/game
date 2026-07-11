import { JUICE_CONFIG } from '../data/balance';

/**
 * v0.20 打鍵ジュース（docs/v20）。純粋関数のみ。
 * 「作業感」対策の本丸＝打鍵の瞬間そのものの快感を上げる。
 * 原則：打鍵は止めない・読ませない・選ばせない（v0.19 選択制撤回の学び）。
 */

/**
 * コンボ → 打鍵SEの音階ステップ（半音数）。
 * コンボ 10 ごとに半音 +1、上限 12（1オクターブ）。コンボが切れると 0 に戻る＝
 * 音の高さそのものが「今どれだけ乗っているか」のフィードバックになる。
 */
export const keyPitchStep = (combo: number): number =>
  Math.min(
    JUICE_CONFIG.keyPitch.maxStep,
    Math.floor(Math.max(0, combo) / JUICE_CONFIG.keyPitch.comboPerStep),
  );

/**
 * コンボ節目の称号（その値ちょうどのときだけ返す）。
 * コンボは正打で 1 ずつしか増えないため、=== 判定で1節目1回だけ発火する。
 */
export const comboTitleAt = (combo: number): string | null =>
  JUICE_CONFIG.comboTitles.find((t) => t.combo === combo)?.label ?? null;
