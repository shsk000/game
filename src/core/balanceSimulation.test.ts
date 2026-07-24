import { describe, expect, it } from 'vitest';
import { AXIS_QUALITY_BONUS_CAP, EQUIP_QUALITY_BONUS_CAP } from '../data/balance';
import type { Employee, EmployeeRole } from '../state/types';
import { computeCharacterScore } from '../utils/character';
import { computeMetascore, computeQualityV10 } from '../utils/metascore';
import { powerAt } from './growth';
import { mulberry32, type Rng } from './ports';

/**
 * v0.16 分布シミュレーション（spec v16 §2-3 / §4）。
 * 「スコア帯は能力（会社の育ち）が決める」設計のガードレール。
 * ここが落ちたら balance.ts / character.ts の変更が能力帯別分布を壊している。
 *
 * プレイヤーモデル × 1,000 試行（seed 固定＝決定的）で quality→metascore を回し、
 * 能力帯ごとの到達分布を検証する。
 */

const TRIALS = 1_000;

const emp = (id: string, role: EmployeeRole, power: number): Employee => ({
  id,
  name: id,
  role,
  power,
  basePower: power,
  level: 1,
  exp: 0,
  wage: 0,
  specialties: [],
});

type Persona = {
  name: string;
  charPower: number;
  /** 相性スコア（0..100）。神=69（compat1.6）、初期good=42（1.25）など */
  affinity: number;
  typingScore: number;
  /** 軸ボーナス（企画・イベント・ビルドアップの合計。上限 AXIS_QUALITY_BONUS_CAP） */
  statBonus: number;
  /** トレンド完全一致ボーナス（メタ +3.5 相当）を得ているか */
  trendMatch: boolean;
  /** v0.25 装備の独立品質枠（フル装備で最大 EQUIP_QUALITY_BONUS_CAP）。既定 0＝非装備。 */
  equipBonus?: number;
};

/** 1 試行：quality 合成 → メタスコア（トレンドは boost 相当を quality に直接加算して近似） */
const rollMeta = (p: Persona, rng: Rng): number => {
  const { Q } = computeQualityV10(
    { charPower: p.charPower, genreAffinity: p.affinity, typingScore: p.typingScore },
    rng,
  );
  const quality = Math.max(0, Math.min(100, Math.round(Q + p.statBonus + (p.equipBonus ?? 0))));
  const meta = computeMetascore(quality, 'puzzle', 'sushi', null, rng);
  return meta.metascore + (p.trendMatch ? 3.5 : 0);
};

const distribution = (p: Persona, seed: number) => {
  const rng = mulberry32(seed);
  let over70 = 0;
  let over80 = 0;
  let over90 = 0;
  let over95 = 0;
  for (let i = 0; i < TRIALS; i++) {
    const m = rollMeta(p, rng);
    if (m >= 70) over70++;
    if (m >= 80) over80++;
    if (m >= 90) over90++;
    if (m >= 95) over95++;
  }
  return {
    over70: over70 / TRIALS,
    over80: over80 / TRIALS,
    over90: over90 / TRIALS,
    over95: over95 / TRIALS,
  };
};

/**
 * 序盤：新人 3 人（mini）・初期帯の最良相性・上手いタイピング・属性ボーナス満額。
 *
 * このペルソナは**非課金の平均的な新規プレイヤー**（採用ガチャの通常排出＝power 0.4 前後）を
 * 表す。これが 70+ = 0% であることが v16 の核「序盤は腕やレベルではメタ70に届かない」ガード。
 *
 * v0.22 補足（オーナー決定 2026-07-19「許容」）：採用ガチャのピティで S を 3 体
 * 強制入手すると mini でも charPower が飽和し序盤ティアを加速できる（メタ70+も出る）。
 * これは v21「時間を金で買う＝加速」思想に沿った**意図された課金ショートカット**として許容する
 * （spec v22 §8-1）。よって本ガードは課金ラッシュではなく非課金平均プレイをモデル化する。
 * 最終天井（aaa でメタ95）は S-Lv1 3 体でも charPower ≈51 で届かず、レベル成長が必須なので
 * 「95 の壁は能力でしか越えられない」不変条件は保たれる。
 */
const earlyGame = (): Persona => {
  const team = [emp('a', 'programmer', 0.4), emp('b', 'designer', 0.4), emp('c', 'pr', 0.4)];
  const { score } = computeCharacterScore({ assignedEmployees: team, scale: 'mini' });
  return {
    name: '序盤（非課金・新人3人・全部上振れ）',
    charPower: score,
    affinity: Math.round(((1.25 - 0.7) / 1.3) * 100), // 初期帯の上限 compat 1.25
    typingScore: 90,
    statBonus: AXIS_QUALITY_BONUS_CAP,
    trendMatch: true,
  };
};

/** 中盤：Lv5 × 3 人（hit）・good 相性 */
const midGame = (): Persona => {
  const p = powerAt(0.45, 5);
  const team = [emp('a', 'programmer', p), emp('b', 'designer', p), emp('c', 'pr', p)];
  const { score } = computeCharacterScore({ assignedEmployees: team, scale: 'hit' });
  return {
    name: '中盤（Lv5×3人）',
    charPower: score,
    affinity: Math.round(((1.35 - 0.7) / 1.3) * 100),
    typingScore: 85,
    statBonus: AXIS_QUALITY_BONUS_CAP,
    trendMatch: true,
  };
};

/** 終盤：Lv10 精鋭 3 人（aaa）・神相性（compat 1.6） */
const lateGame = (): Persona => {
  const p = powerAt(0.55, 10);
  const team = [emp('a', 'programmer', p), emp('b', 'designer', p), emp('c', 'pr', p)];
  const { score } = computeCharacterScore({ assignedEmployees: team, scale: 'aaa' });
  return {
    name: '終盤（Lv10×3人・神相性）',
    charPower: score,
    affinity: Math.round(((1.6 - 0.7) / 1.3) * 100),
    typingScore: 92,
    statBonus: AXIS_QUALITY_BONUS_CAP,
    trendMatch: true,
  };
};

describe('能力帯別のメタスコア分布（spec v16 §2-3）', () => {
  it('序盤：どれだけ上振れてもメタ 70 に届かない（70+ = 0%）', () => {
    const d = distribution(earlyGame(), 42);
    expect(d.over70).toBe(0);
  });

  it('中盤：80 には届かない（80+ = 0%）。70 台は出うる', () => {
    const d = distribution(midGame(), 42);
    expect(d.over80).toBe(0);
  });

  it('終盤：90+ に到達でき、95+ は出るが稀（0% < rate ≤ 15%）', () => {
    const d = distribution(lateGame(), 42);
    expect(d.over90).toBeGreaterThan(0);
    expect(d.over95).toBeGreaterThan(0);
    expect(d.over95).toBeLessThanOrEqual(0.15);
  });

  it('95 の壁は能力でしか越えられない：序盤・中盤モデルの 95+ は 0%', () => {
    expect(distribution(earlyGame(), 7).over95).toBe(0);
    expect(distribution(midGame(), 7).over95).toBe(0);
  });
});

/**
 * v0.25 装備（設備）の分布への影響。
 * 装備は「金で買う加速」（数千万〜1.5億）で、mini の初期資金では手が出ない＝序盤/中盤は非装備モデルのまま。
 * 終盤（資金潤沢）はフル装備で独立枠 EQUIP_QUALITY_BONUS_CAP を得るが、上限付きなので青天井にならない。
 */
const lateGameEquipped = (): Persona => ({
  ...lateGame(),
  name: '終盤・フル装備',
  equipBonus: EQUIP_QUALITY_BONUS_CAP,
});

describe('v0.25 装備の分布ガード（金で買う加速・上限付き）', () => {
  it('装備は序盤の壁を壊さない（高価で mini では買えない＝非装備で over70=0）', () => {
    expect(distribution(earlyGame(), 42).over70).toBe(0);
    expect(distribution(earlyGame(), 7).over70).toBe(0);
  });

  it('終盤フル装備は 95+ 到達を後押しする（非装備以上）', () => {
    const plain = distribution(lateGame(), 42);
    const eq = distribution(lateGameEquipped(), 42);
    expect(eq.over95).toBeGreaterThanOrEqual(plain.over95);
  });

  it('終盤フル装備でも 95+ は青天井にならない（全作 95 にはならない・上限 50%）', () => {
    // 実測 ≈0.48：Lv10×3・神相性・タイピング92・statBonus満額 ＋ 装備枠満額(+6) の理論上限シナリオ。
    // 数億の設備投資に見合う「maxチームの到達点」。強すぎる場合は EQUIP_QUALITY_BONUS_CAP を下げる（spec §9-1）。
    const eq = distribution(lateGameEquipped(), 42);
    expect(eq.over95).toBeGreaterThan(0);
    expect(eq.over95).toBeLessThanOrEqual(0.5);
  });
});
