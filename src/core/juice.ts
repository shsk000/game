import { JUICE_CONFIG } from '../data/balance';
import type { Rng } from './ports';

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

/**
 * v0.20 B：クリティカル打鍵の判定（正打1打ごとに抽選）。
 * 発動時は通常の addFever(1) の代わりに JUICE_CONFIG.crit.feverBonus を加算する
 * （呼び出し側の責務。ここでは判定のみ）。
 */
export const rollCrit = (rng: Rng = Math.random): boolean => rng() < JUICE_CONFIG.crit.rate;

/**
 * v0.20 B：レア文章の判定（次の文章を選ぶたびに抽選）。
 * 発動時は文章カードに★表示し、完走時に JUICE_CONFIG.rare.feverBonus をフィーバーに加算する。
 */
export const rollRare = (rng: Rng = Math.random): boolean => rng() < JUICE_CONFIG.rare.rate;

/**
 * v0.20 C：クランチタイムの判定（全体完成度%が閾値を超えたか）。
 * 一度超えたら doneLoC は減らないため、以降ずっと true のまま（時限式ではない）。
 */
export const isCrunchActive = (progressPct: number): boolean =>
  progressPct >= JUICE_CONFIG.crunch.startPct;

/**
 * v0.20 C：ボス文章の判定（クランチタイム中の文章選択のたびに抽選）。
 * 発動時は pickBossPhrase で長文を選び、完走時に JUICE_CONFIG.crunch.bossFeverBonus を加算する。
 */
export const rollBoss = (rng: Rng = Math.random): boolean => rng() < JUICE_CONFIG.crunch.bossRate;
