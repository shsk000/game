import type { CategoryId } from '../data/categories';
import { CATEGORY_BY_ID, categoryAffinity } from '../data/categories';
import { getCompat } from '../data/compatibility';
import type { GenreId } from '../data/genres';
import type { ThemeId } from '../data/themes';

/**
 * v0.10 §2-3：ジャンル相性スコア（0..100）。
 *
 *   score = compat_norm(0..60) + category_hit_norm(0..40)
 *
 *   compat       … getCompat(g, t) の 0.7..2.0 を 0..60 に再マップ
 *   category_hit … 選択 3 カテゴリの categoryAffinity 合計（最大 ~54）を 0..40 に正規化
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
  compatPart: number;
  categoryHitSum: number;
  categoryPart: number;
};

export const computeGenreAffinityScore = (
  input: AffinityScoreInput,
): { score: number; breakdown: AffinityScoreBreakdown } => {
  const { genreId, themeId, selectedCategories } = input;

  // compat (0.7..2.0) → 0..60
  const compat = getCompat(genreId, themeId);
  const compatPart = clamp(((compat - 0.7) / (2.0 - 0.7)) * 60, 0, 60);

  // category_hit_sum 最大 = 3 × 17 (=base2 + g4 + t3 + both8) = 51。0..40 に正規化
  let categoryHitSum = 0;
  for (const cid of selectedCategories) {
    const cat = CATEGORY_BY_ID[cid];
    if (!cat) continue;
    categoryHitSum += categoryAffinity(cat, genreId, themeId);
  }
  const categoryPart = clamp((categoryHitSum / 51) * 40, 0, 40);

  return {
    score: Math.round(compatPart + categoryPart),
    breakdown: {
      compat,
      compatPart: Math.round(compatPart),
      categoryHitSum,
      categoryPart: Math.round(categoryPart),
    },
  };
};
