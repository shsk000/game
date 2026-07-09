import { SCORE_BASE } from '../data/balance';
import type { Scale } from '../data/scales';
import type { Employee } from '../state/types';

/**
 * キャラ能力スコア（0..100、厳しめ加算方式）。
 *
 * v0.14 改訂（開発カテゴリ選択の廃止に伴う）：
 * - 旧「役割マッチ（選択カテゴリ×role）」「specialty 一致」はカテゴリ前提だったため撤去
 * - 代わりに「役割の多様性」（異なる role が揃うほど加点）を採用
 *   ※ 社員の specialties（得意分野）はジャンル連動への転用を検討中（後続版 🔧）
 *
 *   score = SCORE_BASE(30)
 *         + (power 合計 / 規模上限) × 35      // power 寄与（最大 +35）
 *         + 役割多様性（2 種 +8、3 種 +15）
 *         + アサイン人数（1 人 0、2 人 +5、3 人 +10）
 *         + 規模適合（人数不足 -10、十分 0、過剰 -5）
 *         = 0..100 クランプ
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

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export type CharacterScoreInput = {
  assignedEmployees: Employee[];
  scale: Scale;
};

export type CharacterScoreBreakdown = {
  base: number;
  powerSum: number;
  powerBonus: number;
  roleVarietyBonus: number;
  headcountBonus: number;
  fitBonus: number;
};

export const computeCharacterScore = (
  input: CharacterScoreInput,
): { score: number; breakdown: CharacterScoreBreakdown } => {
  const { assignedEmployees, scale } = input;
  const headcount = assignedEmployees.length;

  // 1) power 合計 → +0..35（規模上限に対する充足率）
  const powerSum = assignedEmployees.reduce((sum, e) => sum + e.power, 0);
  const powerBonus = clamp((powerSum / POWER_CAP[scale]) * 35, 0, 35);

  // 2) 役割多様性：異なる role の数（2 種 +8、3 種 +15）
  const roleCount = new Set(assignedEmployees.map((e) => e.role)).size;
  const roleVarietyBonus = roleCount >= 3 ? 15 : roleCount === 2 ? 8 : 0;

  // 3) アサイン人数：1 人 0、2 人 +5、3 人以上 +10
  const headcountBonus = headcount >= 3 ? 10 : headcount === 2 ? 5 : 0;

  // 4) 規模適合：推奨人数より少ない -10、ぴったり 0、超過 -5
  const recommended = RECOMMENDED_HEADCOUNT[scale];
  const fitBonus = headcount < recommended ? -10 : headcount === recommended ? 0 : -5;

  const raw = SCORE_BASE + powerBonus + roleVarietyBonus + headcountBonus + fitBonus;
  const score = clamp(raw, 0, 100);

  return {
    score: Math.round(score),
    breakdown: {
      base: SCORE_BASE,
      powerSum: Math.round(powerSum * 10) / 10,
      powerBonus: Math.round(powerBonus),
      roleVarietyBonus,
      headcountBonus,
      fitBonus,
    },
  };
};
