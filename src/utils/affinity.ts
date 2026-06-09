import { SCORE_BASE } from '../data/balance';
import type { CategoryId } from '../data/categories';
import { CATEGORY_BY_ID, categoryAffinity } from '../data/categories';
import { getCompat } from '../data/compatibility';
import type { GenreId } from '../data/genres';
import type { ThemeId } from '../data/themes';

/**
 * v0.10 仕上げ §6-3：ジャンル相性スコア（0..100）。
 *
 *   score = SCORE_BASE(30)
 *         + ジャンル一致ボーナス（compat>=1.3 で +15）
 *         + テーマ一致ボーナス（compat>=1.7 で +15）
 *         + 3 カテゴリの categoryAffinity 正規化（0..40）
 *
 * 「全部揃った時のみ高スコア」設計。何も考えずに選ぶと base 30 のみで致命的失敗予備軍。
 *
 * spec.md §2-0 で `final_quality = quality_base × トレンド × 運 × ガチャ`。
 * トレンド倍率と新規開拓ボーナスは **affinity スコア内では掛けず**、`releaseWork` で乗算する。
 */

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export type AffinityScoreInput = {
  genreId: GenreId;
  themeId: ThemeId;
  selectedCategories: CategoryId[];
};

export type AffinityScoreBreakdown = {
  compat: number;
  base: number;
  genreMatch: number;
  themeMatch: number;
  categoryHitSum: number;
  categoryPart: number;
};

export const computeGenreAffinityScore = (
  input: AffinityScoreInput,
): { score: number; breakdown: AffinityScoreBreakdown } => {
  const { genreId, themeId, selectedCategories } = input;

  const compat = getCompat(genreId, themeId);

  // ジャンル一致：compat 1.3 以上で +15
  const genreMatch = compat >= 1.3 ? 15 : 0;
  // テーマ一致：compat 1.7 以上で +15（更に良い相性）
  const themeMatch = compat >= 1.7 ? 15 : 0;

  // categoryAffinity 合計 最大 = 3 × 17 ≈ 51 → 0..40 に正規化
  let categoryHitSum = 0;
  for (const cid of selectedCategories) {
    const cat = CATEGORY_BY_ID[cid];
    if (!cat) continue;
    categoryHitSum += categoryAffinity(cat, genreId, themeId);
  }
  const categoryPart = clamp((categoryHitSum / 51) * 40, 0, 40);

  const raw = SCORE_BASE + genreMatch + themeMatch + categoryPart;
  return {
    score: Math.round(clamp(raw, 0, 100)),
    breakdown: {
      compat,
      base: SCORE_BASE,
      genreMatch,
      themeMatch,
      categoryHitSum,
      categoryPart: Math.round(categoryPart),
    },
  };
};
