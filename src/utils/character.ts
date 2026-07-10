import type { Scale } from '../data/scales';
import type { Employee } from '../state/types';

/**
 * キャラ能力スコア（0..100）。
 *
 * v0.16 再設計（spec v16 §2-1。オーナー確定「能力を一番考慮する」「序盤は厳しく」）：
 * - 旧実装は SCORE_BASE(30) の下駄＋人数ボーナスで新人 3 人でも 85 に到達し、
 *   初手でメタ 95 が出る難易度崩壊の主因だった
 * - 新実装は power（正規化 0..1・成長込み）の充足率が支配項。頭数と下駄では稼げない
 *
 *   score = powerBonus（0..70）… power 合計 / 規模上限 × 70
 *         + 役割多様性（2 種 +5、3 種 +10）
 *         + 規模適合（推奨人数未満 -10、超過 -5、ぴったり 0）
 *
 * 新人 3 人（power 平均 0.4）で 30 前後 / Lv10 精鋭 3 人 + aaa で 85〜95。
 */

/** 規模ごとの推奨アサイン人数（balance-design §6-4） */
const RECOMMENDED_HEADCOUNT: Record<Scale, number> = {
  mini: 1,
  mobile: 2,
  indie: 2,
  hit: 3,
  aaa: 3,
};

/**
 * 規模ごとの power 合計上限（v0.16 正規化 power 前提で再設定 🔧）。
 * Lv10（成長率 ×2.35）の精鋭（basePower 0.5〜0.6）3 人 ≒ 3.5〜4.2 が aaa でカンストする水準。
 */
const POWER_CAP: Record<Scale, number> = {
  mini: 2.5,
  mobile: 2.8,
  indie: 3.0,
  hit: 3.3,
  aaa: 3.6,
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export type CharacterScoreInput = {
  assignedEmployees: Employee[];
  scale: Scale;
};

export type CharacterScoreBreakdown = {
  powerSum: number;
  powerBonus: number;
  roleVarietyBonus: number;
  fitBonus: number;
};

export const computeCharacterScore = (
  input: CharacterScoreInput,
): { score: number; breakdown: CharacterScoreBreakdown } => {
  const { assignedEmployees, scale } = input;
  const headcount = assignedEmployees.length;

  // 1) power 合計 → +0..70（規模上限に対する充足率。支配項）
  const powerSum = assignedEmployees.reduce((sum, e) => sum + e.power, 0);
  const powerBonus = clamp((powerSum / POWER_CAP[scale]) * 70, 0, 70);

  // 2) 役割多様性：異なる role の数（2 種 +5、3 種 +10）
  const roleCount = new Set(assignedEmployees.map((e) => e.role)).size;
  const roleVarietyBonus = roleCount >= 3 ? 10 : roleCount === 2 ? 5 : 0;

  // 3) 規模適合：推奨人数より少ない -10（雇用の動機）。
  // v0.17：超過ペナルティは廃止（全員参加制で人数はプレイヤーのレバーではなくなったため）
  const recommended = RECOMMENDED_HEADCOUNT[scale];
  const fitBonus = headcount < recommended ? -10 : 0;

  const raw = powerBonus + roleVarietyBonus + fitBonus;
  const score = clamp(raw, 0, 100);

  return {
    score: Math.round(score),
    breakdown: {
      powerSum: Math.round(powerSum * 100) / 100,
      powerBonus: Math.round(powerBonus),
      roleVarietyBonus,
      fitBonus,
    },
  };
};
