import type { CategoryId } from '../data/categories';
import type { Scale } from '../data/scales';
import type { Employee } from '../state/types';

/**
 * v0.10 §2-1：キャラ能力スコア（0..100）。
 *
 *   score = clamp(0, 100,
 *     基礎_power_正規化(0..70)
 *     × (1 + 役割マッチ +0.30)
 *     × (1 + specialty_一致 +0.20 / 一致)
 *     × (1 + 複数人相乗 0/+0.10/+0.25)
 *     × (規模適合 1.05 / 1.0 / 0.80)
 *   )
 *
 * 「キャラ採用とアサインが品質の主ドライバー」になるよう、各補正を係数として乗じる。
 */

/** 規模ごとの推奨アサイン人数（spec §2-1 規模適合） */
const RECOMMENDED_HEADCOUNT: Record<Scale, number> = {
  mini: 1,
  mobile: 1,
  indie: 2,
  hit: 2,
  aaa: 3,
};

/** 規模ごとの「合計 power」基準値（この値で正規化スコア 70 になる目安） */
const POWER_NORM: Record<Scale, number> = {
  mini: 6,
  mobile: 10,
  indie: 18,
  hit: 28,
  aaa: 40,
};

/** カテゴリと役割の親和（spec §2-1 役割マッチ） */
const ROLE_CATEGORY: Record<Employee['role'], CategoryId[]> = {
  programmer: ['gameplay', 'innovation'],
  designer: ['graphics', 'sound'],
  pr: ['story', 'presentation'],
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export type CharacterScoreInput = {
  assignedEmployees: Employee[];
  scale: Scale;
  selectedCategories: CategoryId[];
};

export type CharacterScoreBreakdown = {
  powerSum: number;
  powerNorm: number;
  roleMatchBonus: number;
  specialtyBonus: number;
  synergyBonus: number;
  fitMultiplier: number;
};

export const computeCharacterScore = (
  input: CharacterScoreInput,
): { score: number; breakdown: CharacterScoreBreakdown } => {
  const { assignedEmployees, scale, selectedCategories } = input;
  const headcount = assignedEmployees.length;

  // 1) 基礎 power 合計 → 0..70 正規化
  const powerSum = assignedEmployees.reduce((sum, e) => sum + e.power, 0);
  const powerNorm = clamp((powerSum / POWER_NORM[scale]) * 70, 0, 70);

  // 2) 役割マッチ：選択カテゴリと社員 role が合致するペアごとに +0.30
  let roleHits = 0;
  for (const emp of assignedEmployees) {
    const matchCats = ROLE_CATEGORY[emp.role] ?? [];
    if (selectedCategories.some((c) => matchCats.includes(c))) {
      roleHits += 1;
    }
  }
  const roleMatchBonus = roleHits * 0.3;

  // 3) specialty 一致：割当社員 × 選択カテゴリで一致するごとに +0.20
  let specialtyHits = 0;
  const catSet = new Set(selectedCategories);
  for (const emp of assignedEmployees) {
    for (const sp of emp.specialties ?? []) {
      if (catSet.has(sp.categoryId)) specialtyHits += 1;
    }
  }
  const specialtyBonus = specialtyHits * 0.2;

  // 4) 複数人相乗：2 人 +0.10、3 人以上 +0.25
  const synergyBonus = headcount >= 3 ? 0.25 : headcount === 2 ? 0.1 : 0;

  // 5) 規模適合：充足 +5%, 不足 -20%
  const recommended = RECOMMENDED_HEADCOUNT[scale];
  const fitMultiplier = headcount >= recommended ? 1.05 : 0.8;

  // 合成
  const score = clamp(
    powerNorm * (1 + roleMatchBonus) * (1 + specialtyBonus) * (1 + synergyBonus) * fitMultiplier,
    0,
    100,
  );

  return {
    score: Math.round(score),
    breakdown: {
      powerSum: Math.round(powerSum * 10) / 10,
      powerNorm: Math.round(powerNorm),
      roleMatchBonus,
      specialtyBonus,
      synergyBonus,
      fitMultiplier,
    },
  };
};
