import { SCORE_BASE } from '../data/balance';
import type { CategoryId } from '../data/categories';
import type { Scale } from '../data/scales';
import type { Employee } from '../state/types';

/**
 * v0.10 仕上げ §6-4：キャラ能力スコア（0..100、厳しめ加算方式）。
 *
 *   score = SCORE_BASE(30)
 *         + (power 合計 / 規模上限) × 30      // power 寄与（最大 +30）
 *         + 役割マッチ（プログラマ × 機能カテゴリ等で +10）
 *         + specialty 一致（1 つ +5、最大 +15）
 *         + アサイン人数（1 人 0、2 人 +5、3 人 +10）
 *         + 規模適合（人数不足 -10、十分 0、過剰 -5）
 *         = 0..100 クランプ
 *
 * 「キャラ採用とアサインが品質の主ドライバー」設計。
 * 何も考えずに 1 人アサインすると base 30 のみで致命的失敗予備軍。
 */

/** 規模ごとの推奨アサイン人数（balance-design §6-4） */
const RECOMMENDED_HEADCOUNT: Record<Scale, number> = {
  mini: 1,
  mobile: 2,
  indie: 2,
  hit: 3,
  aaa: 3,
};

/** 規模ごとの power 合計上限（balance-design §6-4 シミュレーション表） */
const POWER_CAP: Record<Scale, number> = {
  mini: 6,
  mobile: 9,
  indie: 15,
  hit: 21,
  aaa: 24,
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
  base: number;
  powerSum: number;
  powerBonus: number;
  roleMatchBonus: number;
  specialtyBonus: number;
  headcountBonus: number;
  fitBonus: number;
};

export const computeCharacterScore = (
  input: CharacterScoreInput,
): { score: number; breakdown: CharacterScoreBreakdown } => {
  const { assignedEmployees, scale, selectedCategories } = input;
  const headcount = assignedEmployees.length;

  // 1) power 合計 → +0..30（規模上限に対する充足率）
  const powerSum = assignedEmployees.reduce((sum, e) => sum + e.power, 0);
  const powerBonus = clamp((powerSum / POWER_CAP[scale]) * 30, 0, 30);

  // 2) 役割マッチ：いずれかの社員 role が選択カテゴリに合致したら +10
  let roleMatched = false;
  for (const emp of assignedEmployees) {
    const matchCats = ROLE_CATEGORY[emp.role] ?? [];
    if (selectedCategories.some((c) => matchCats.includes(c))) {
      roleMatched = true;
      break;
    }
  }
  const roleMatchBonus = roleMatched ? 10 : 0;

  // 3) specialty 一致：1 つ +5、最大 +15
  let specialtyHits = 0;
  const catSet = new Set(selectedCategories);
  for (const emp of assignedEmployees) {
    for (const sp of emp.specialties ?? []) {
      if (catSet.has(sp.categoryId)) specialtyHits += 1;
    }
  }
  const specialtyBonus = clamp(specialtyHits * 5, 0, 15);

  // 4) アサイン人数：1 人 0、2 人 +5、3 人以上 +10
  const headcountBonus = headcount >= 3 ? 10 : headcount === 2 ? 5 : 0;

  // 5) 規模適合：推奨人数より少ない -10、ぴったり 0、超過 -5
  const recommended = RECOMMENDED_HEADCOUNT[scale];
  const fitBonus = headcount < recommended ? -10 : headcount === recommended ? 0 : -5;

  const raw =
    SCORE_BASE + powerBonus + roleMatchBonus + specialtyBonus + headcountBonus + fitBonus;
  const score = clamp(raw, 0, 100);

  return {
    score: Math.round(score),
    breakdown: {
      base: SCORE_BASE,
      powerSum: Math.round(powerSum * 10) / 10,
      powerBonus: Math.round(powerBonus),
      roleMatchBonus,
      specialtyBonus,
      headcountBonus,
      fitBonus,
    },
  };
};
