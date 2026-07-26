import {
  GACHA_RANK_RATES,
  GACHA_RANKS,
  type GachaKind,
  type GachaRank,
  GROWTH,
  RANK_TOTAL_POWER,
  SKILL_CONFIG,
} from '../data/balance';
import type { DevSkillId, Employee, SkillId, SkillSet } from '../state/types';
import { DEV_SKILL_IDS } from '../state/types';
import type { Rng } from './ports';

/**
 * スキル（docs/spec/score-model.md §1）の純粋ロジック。
 *
 * 用語（docs/spec/glossary.md）:
 * - **スキル**  … 社員が持つ能力値（0〜100）。持てるのは1つか2つ
 * - **総合力**  … スキル値の合計。ランクが天井、レベルが現在値を決める
 * - **ランク**  … C/B/A/S。採用時に決まる素質のラベルで、育っても変わらない
 * - **職種**    … 一番高いスキルの呼び名（管理する枠ではない）
 */

/** 全スキル（広報を含む5種） */
export const ALL_SKILL_IDS: readonly SkillId[] = [...DEV_SKILL_IDS, 'pr'] as const;

const SKILL_LABELS: Record<SkillId, string> = {
  programming: 'プログラミング',
  graphics: 'グラフィック',
  sound: 'サウンド',
  scenario: 'シナリオ',
  pr: '広報',
};

/** 職種名（＝一番高いスキルの呼び名）。管理する枠ではなく表示上の名前 */
const JOB_LABELS: Record<SkillId, string> = {
  programming: 'プログラマー',
  graphics: 'グラフィッカー',
  sound: 'サウンドクリエイター',
  scenario: 'シナリオライター',
  pr: '広報',
};

export const skillLabel = (id: SkillId): string => SKILL_LABELS[id];

/**
 * 総合力（＝スキル値の合計）。
 * Lv1 はランクによらずほぼ同じで、Lv10 でランクごとの天井へ線形に伸びる。
 */
export const totalPowerFor = (rank: GachaRank, level: number, lv1Roll = 0.5): number => {
  const r = RANK_TOTAL_POWER[rank];
  const lv1 = r.lv1Min + (r.lv1Max - r.lv1Min) * lv1Roll;
  const lv = Math.max(1, Math.min(GROWTH.levelCap, level));
  const t = (lv - 1) / (GROWTH.levelCap - 1);
  return Math.round((lv1 + (r.lv10 - lv1) * t) * 10) / 10;
};

/**
 * 総合力をスキルへ配分する。
 * - 1スキル … そのまま1分野に乗る（尖る）
 * - 2スキル … 分散ペナルティを掛けてから2分野へ配分（**専門特化のほうが総合力が高い**）
 */
export const distributeSkills = (totalPower: number, ids: SkillId[]): SkillSet => {
  if (ids.length === 0) return {};
  if (ids.length === 1) return { [ids[0]]: Math.round(totalPower * 10) / 10 };
  const eff = totalPower * SKILL_CONFIG.spreadPenalty;
  const { primary, secondary } = SKILL_CONFIG.spreadRatio;
  return {
    [ids[0]]: Math.round(eff * primary * 10) / 10,
    [ids[1]]: Math.round(eff * secondary * 10) / 10,
  };
};

/** 社員が実際に持っているスキルの ID（値が 0 より大きいもの） */
export const ownedSkillIds = (skills: SkillSet): SkillId[] =>
  ALL_SKILL_IDS.filter((id) => (skills[id] ?? 0) > 0);

/** その社員の総合力（スキル値の合計） */
export const totalPowerOf = (skills: SkillSet): number =>
  Math.round(ALL_SKILL_IDS.reduce((sum, id) => sum + (skills[id] ?? 0), 0) * 10) / 10;

/** 一番高いスキル（同値なら ALL_SKILL_IDS の順で先のもの） */
export const primarySkillOf = (skills: SkillSet): SkillId | null => {
  let best: SkillId | null = null;
  let bestVal = 0;
  for (const id of ALL_SKILL_IDS) {
    const v = skills[id] ?? 0;
    if (v > bestVal) {
      best = id;
      bestVal = v;
    }
  }
  return best;
};

/** 職種名（一番高いスキルの呼び名）。スキルが無ければ「社員」 */
export const jobTitleOf = (skills: SkillSet): string => {
  const p = primarySkillOf(skills);
  return p ? JOB_LABELS[p] : '社員';
};

/** ランク抽選（C を含む4種）。premium のみ天井が効く */
export const rollRank4 = (kind: GachaKind, rng: Rng = Math.random, pityCount = 0): GachaRank => {
  const rates = GACHA_RANK_RATES[kind];
  const pity = kind === 'premium' ? 10 : 0;
  if (pity > 0 && pityCount >= pity) return 'S';
  // 強い順に判定（S → A → B → C）。合計は 1.0 前提
  const r = rng();
  let acc = 0;
  for (const rank of [...GACHA_RANKS].reverse()) {
    acc += rates[rank];
    if (r < acc) return rank;
  }
  return 'C';
};

/**
 * 採用時のスキル抽選。
 * スキル数（1つ／2つ）は確率で決まり、**ランクとは無関係**。
 */
export const rollSkills = (rank: GachaRank, rng: Rng): SkillSet => {
  const two = rng() < SKILL_CONFIG.twoSkillChance;
  const pool = [...ALL_SKILL_IDS];
  const primary = pool.splice(Math.floor(rng() * pool.length), 1)[0];
  const ids: SkillId[] = [primary];
  if (two) ids.push(pool[Math.floor(rng() * pool.length)]);
  return distributeSkills(totalPowerFor(rank, 1, rng()), ids);
};

/**
 * レベルアップ後のスキル。**増えるのは総合力**で、それが持っているスキルに
 * 同じ比率で配分される（スキルの種類は増えない）。
 */
export const growSkills = (skills: SkillSet, rank: GachaRank, newLevel: number): SkillSet => {
  const ids = ownedSkillIds(skills);
  if (ids.length === 0) return skills;
  const current = totalPowerOf(skills);
  // 現在の総合力がランクの Lv1 帯のどこにあったかを推定して、同じ引きのまま伸ばす
  const r = RANK_TOTAL_POWER[rank];
  const lv1Span = r.lv1Max - r.lv1Min;
  const spread = ids.length >= 2 ? SKILL_CONFIG.spreadPenalty : 1;
  const baseAtLv1 = current / spread;
  const roll = lv1Span > 0 ? Math.max(0, Math.min(1, (baseAtLv1 - r.lv1Min) / lv1Span)) : 0.5;
  const next = totalPowerFor(rank, newLevel, roll);
  // 配分比は維持する（尖った社員は尖ったまま強くなる）
  const ratio = ids.map((id) => (skills[id] ?? 0) / current);
  const eff = next * spread;
  const out: SkillSet = {};
  ids.forEach((id, i) => {
    out[id] = Math.round(eff * ratio[i] * 10) / 10;
  });
  return out;
};

/**
 * スキルを一律の倍率で伸ばす（配分の比率は維持）。
 *
 * **旧セーブから移行した社員は `rank` を持たない**ため、ランクの天井から総合力を
 * 決められない。その場合はこちらを使い、旧来の成長率（`powerAt`）と同じ比率で伸ばす。
 * これで「レベルは上がったのにスキルが伸びない」状態を防ぎ、旧 power との整合も保てる。
 */
export const scaleSkills = (skills: SkillSet, factor: number): SkillSet => {
  const out: SkillSet = {};
  for (const id of ownedSkillIds(skills)) {
    out[id] = Math.round((skills[id] ?? 0) * factor * 10) / 10;
  }
  return out;
};

/**
 * チームの分野別スキル合計。
 * **同じ分野の2人目以降は効率が半分**（分業のロス）。
 * これが無いと「◎の2分野に人を寄せる」が支配戦略になり、他の職種を引く価値が消える。
 */
export const skillTotalsOf = (employees: Employee[]): Record<DevSkillId, number> => {
  const out = {} as Record<DevSkillId, number>;
  for (const field of DEV_SKILL_IDS) {
    const vals = employees
      .map((e) => e.skills?.[field] ?? 0)
      .filter((v) => v > 0)
      .sort((a, b) => b - a);
    out[field] = vals.reduce(
      (sum, v, i) => sum + v * (i === 0 ? 1 : SKILL_CONFIG.secondMemberEfficiency),
      0,
    );
  }
  return out;
};

/** 広報スキルの合計（売上ボーナスの素）。2人目以降の減衰は開発分野と同じ扱い */
export const prSkillTotalOf = (employees: Employee[]): number => {
  const vals = employees
    .map((e) => e.skills?.pr ?? 0)
    .filter((v) => v > 0)
    .sort((a, b) => b - a);
  return vals.reduce(
    (sum, v, i) => sum + v * (i === 0 ? 1 : SKILL_CONFIG.secondMemberEfficiency),
    0,
  );
};
