import { BUG_CONFIG, ROLE_EFFECT } from '../data/balance';
import { sumProgrammerSpeed } from '../data/employees';
import type { Employee } from '../state/types';
import type { Rng } from './ports';

/**
 * v0.17 バグ発生システム（spec v17 §4）。純粋関数のみ。
 * 発生（開発中：ミス打鍵＋コード起因）→ 発覚（テスト）→ 返済（デバッグ）。
 * エンジニア（プログラマー）の質が高いほど発生が抑制される。
 */

/** プログラマー power 合計（正規化スケール）。sumProgrammerSpeed は係数込みなので割り戻す */
const programmerPowerSum = (employees: Employee[]): number =>
  sumProgrammerSpeed(employees) / ROLE_EFFECT.programmerLocPerSec;

/**
 * バグ抑制率（0..maxSuppression）。プログラマーの power 合計で決まる。
 * 例：新人 1 人（0.4）→ 20% 抑制 / 育った 2 人（合計 2.0）→ 80% 抑制（上限）
 */
export const bugSuppression = (employees: Employee[]): number =>
  Math.min(BUG_CONFIG.maxSuppression, programmerPowerSum(employees) / BUG_CONFIG.suppressCap);

/** ミス打鍵 1 回でバグが発生するか */
export const rollBugOnMiss = (employees: Employee[], rng: Rng): boolean =>
  rng() < BUG_CONFIG.onMissRate * (1 - bugSuppression(employees));

/** フレーズ完走 1 回でコード起因バグが発生するか（ミスゼロでも一定量出る） */
export const rollBugOnPhrase = (employees: Employee[], rng: Rng): boolean =>
  rng() < BUG_CONFIG.onPhraseRate * (1 - bugSuppression(employees));

/** デバッグフェーズの作業量（修正フレーズ数）＝ バグが多いほど大変（線形） */
export const debugWorkFor = (bugCount: number): number =>
  Math.max(0, bugCount) * BUG_CONFIG.phrasesPerBug;

/**
 * 残バグを抱えたまま発売した場合のペナルティ。
 * 品質減点は releaseWork の品質合成前に、炎上リスクは axes.reputationRisk に合流する。
 */
export const remainingBugPenalty = (
  bugCount: number,
): { qualityPenalty: number; reputationRisk: number } => ({
  qualityPenalty: Math.max(0, bugCount) * BUG_CONFIG.qualityPenaltyPerBug,
  reputationRisk: Math.max(0, bugCount) * BUG_CONFIG.reputationRiskPerBug,
});

/** デバッグフェーズで打つバグ修正フレーズ（ひらがなのみ） */
export const BUG_FIX_PHRASES = [
  'ばぐをさいげんする',
  'ろぐをおいかける',
  'げんいんをとくていする',
  'しゅうせいをあてる',
  'かいぜんをかくにんする',
  'りぐれっしょんをふせぐ',
  'ぬるちぇっくをたす',
  'きょうかいちをためす',
] as const;

export const pickBugFixPhrase = (rng: Rng = Math.random): string =>
  BUG_FIX_PHRASES[Math.floor(rng() * BUG_FIX_PHRASES.length)];
