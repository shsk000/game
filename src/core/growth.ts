import { computeMonthlyWage, GROWTH } from '../data/balance';
import type { Employee } from '../state/types';
import { scaleSkills } from './skills';

/**
 * v0.16 社員成長システム（spec v16 §1）。純粋関数のみ。
 * exp はリリース時に一括獲得（オーナー確定）。「作品を出す→社員が育つ」の因果を一本にする。
 */

/** レベル lv から次のレベルに上がるのに必要な exp */
export const nextExpFor = (lv: number): number =>
  Math.round(GROWTH.expCurveBase * lv ** GROWTH.expCurveExp);

/** 素質（basePower）とレベルから現在 power を算出 */
export const powerAt = (basePower: number, level: number): number => {
  const lv = Math.max(1, Math.min(GROWTH.levelCap, level));
  return Math.round(basePower * (1 + GROWTH.powerGrowthPerLevel * (lv - 1)) * 100) / 100;
};

/** リリース 1 回で得る exp（参加社員全員一律。メタスコア連動） */
export const expForRelease = (metascore: number): number => {
  const bonus = GROWTH.expByMeta.find((t) => metascore >= t.minMeta)?.bonus ?? 0;
  return GROWTH.expBase + bonus;
};

export type LevelUp = {
  employeeId: string;
  name: string;
  /** 到達した新レベル */
  level: number;
  /** 成長前後の power（開封演出で「何が良くなったか」を見せる。spec v17 §3） */
  powerBefore: number;
  powerAfter: number;
  /** 月給の増分（円）。レベルが上がるごとに固定費が上がる（オーナー指示） */
  wageDelta: number;
};

/**
 * リリース時の成長適用。参加社員（assignedIds）に exp を与え、
 * しきい値を越えたぶんレベルアップ（複数レベル一気も可）。power と月給も追従する。
 * 非参加社員はそのまま返す。
 */
export const applyReleaseGrowth = (
  employees: Employee[],
  assignedIds: string[],
  metascore: number,
): { employees: Employee[]; levelUps: LevelUp[] } => {
  const assigned = new Set(assignedIds);
  const gained = expForRelease(metascore);
  const levelUps: LevelUp[] = [];

  const updated = employees.map((e) => {
    if (!assigned.has(e.id)) return e;
    let level = e.level;
    let exp = e.exp + gained;
    const reached: number[] = [];
    while (level < GROWTH.levelCap && exp >= nextExpFor(level)) {
      exp -= nextExpFor(level);
      level += 1;
      reached.push(level);
    }
    if (level === e.level) return { ...e, exp };
    // 実装ステップ1 では成長も旧ロジックのまま凍結する。power を先に出し、
    // スキルはそれに同じ比率で追従させる（総合力＝power × 100 を維持）。
    // ランクの天井（growSkills）に切り替えるのは実装ステップ3。
    const power = powerAt(e.basePower, level);
    const factor = e.power > 0 ? power / e.power : 1;
    const skills = scaleSkills(e.skills ?? {}, factor);
    const wage = Math.round(computeMonthlyWage(power, level));
    for (const lv of reached) {
      levelUps.push({
        employeeId: e.id,
        name: e.name,
        level: lv,
        powerBefore: e.power,
        powerAfter: power,
        wageDelta: wage - e.wage,
      });
    }
    return { ...e, level, exp, power, wage, skills };
  });

  return { employees: updated, levelUps };
};
