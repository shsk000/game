import { getCompat } from '../data/compatibility';
import type { GenreId } from '../data/genres';
import type { ThemeId } from '../data/themes';

/**
 * v0.14：ジャンル相性スコア（0..100）＝ compat（ジャンル×テーマの隠し相性）を連続マッピング。
 *
 * オーナー決定（2026-06-27）：
 * - 開発カテゴリ選択は廃止（「どれもゲームに必要で、選ぶ意味が無い」）。旧 categoryPart(0..40) を撤去
 * - compat 1.0 未満（地雷）は壊滅する：旧式は加点のみで地雷を踏んでも無傷だった欠陥を修正
 *
 *   score = (compat - 0.7) / 1.3 × 100   … compat は 0.7〜2.0 にクランプ済み
 *
 *   compat 0.7（地雷直撃） →   0 点
 *   compat 1.0（普通）     →  23 点
 *   compat 1.3（好相性）   →  46 点
 *   compat 1.7（大当たり） →  77 点
 *   compat 2.0（神組合せ） → 100 点
 *
 * 探索の柱（game-design §6）：組合せの発見＝図鑑がそのまま品質に直結する。
 * トレンド倍率と新規開拓ボーナスは affinity 内では掛けず `releaseWork` 側で扱う。
 */

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export type AffinityScoreInput = {
  genreId: GenreId;
  themeId: ThemeId;
};

export type AffinityScoreBreakdown = {
  compat: number;
};

export const computeGenreAffinityScore = (
  input: AffinityScoreInput,
): { score: number; breakdown: AffinityScoreBreakdown } => {
  const { genreId, themeId } = input;
  const compat = getCompat(genreId, themeId);
  const score = Math.round(clamp(((compat - 0.7) / 1.3) * 100, 0, 100));
  return { score, breakdown: { compat } };
};
