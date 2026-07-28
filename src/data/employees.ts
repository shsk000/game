import type { Deps, Rng } from '../core/ports';
import { defaultDeps } from '../core/ports';
import {
  primarySkillOf,
  rollRank4,
  prSkillTotalOf,
  rollSkills,
  totalPowerFor,
  totalPowerOf,
} from '../core/skills';
import type { Candidate, Employee, EmployeeRole, SkillId } from '../state/types';
import { computeMonthlyWage, GACHA_CONFIG, type GachaRank, PR_SALES_BONUS_PER_SKILL } from './balance';

const SURNAMES = [
  '佐藤',
  '鈴木',
  '高橋',
  '田中',
  '伊藤',
  '渡辺',
  '山本',
  '中村',
  '小林',
  '加藤',
  '吉田',
  '山田',
  '佐々木',
  '山口',
  '松本',
  '井上',
  '木村',
  '林',
  '清水',
  '斎藤',
];
const GIVEN = [
  '太郎',
  '次郎',
  '花子',
  'ミサキ',
  'ハル',
  'カエデ',
  'ユウト',
  '葵',
  '蓮',
  'リク',
  'ソラ',
  'ヒロト',
  'アヤ',
  'ユイ',
  'コハル',
  'ハルト',
  'ナナ',
  'ミオ',
  'リン',
  'ノア',
];

const ROLE_LABELS: Record<EmployeeRole, string> = {
  programmer: 'プログラマー',
  designer: 'デザイナー',
  pr: '広報',
};

export const roleLabel = (r: EmployeeRole) => ROLE_LABELS[r];

const pick = <T>(arr: T[], rng: Rng): T => arr[Math.floor(rng() * arr.length)];

const randomName = (rng: Rng) => `${pick(SURNAMES, rng)} ${pick(GIVEN, rng)}`;

/**
 * v0.16：power は全役割共通の 0..1 正規化スケール（balance.ts ROLE_EFFECT で換算）。
 * v0.22：一様な「見習い帯」（旧 0.2〜0.6）をガチャランク別の帯に置換。
 */
const rollPower = (rng: Rng, range: { min: number; max: number }): number =>
  Math.round((range.min + rng() * (range.max - range.min)) * 100) / 100;

/** v0.22：ランク帯で basePower を抽選（進行シミュレーション等からも使う） */
export const rollPowerForRank = (rank: GachaRank, rng: Rng): number =>
  rollPower(rng, GACHA_CONFIG.powerRange[rank]);

/**
 * v0.10 仕上げ：月給計算は balance.ts に集約。役職差なし。
 * v0.17：レベル項（(level−1)×¥5万）込み。
 *
 * @param _role 役職（現バランスでは未使用、将来の差別化用にシグネチャは維持）
 */
const wageFor = (_role: EmployeeRole, power: number, level = 1): number =>
  Math.round(computeMonthlyWage(power, level));

/**
 * v0.10：個別社員の月給を取得（v0.17：レベル項込み）。
 */
export const employeeMonthlyWage = (e: Employee): number => wageFor(e.role, e.power, e.level);

/**
 * v0.10：全社員の月給合計（円）。
 */
export const sumMonthlySalaries = (employees: Employee[]): number =>
  employees.reduce((sum, e) => sum + employeeMonthlyWage(e), 0);


/**
 * v0.22：ランク別の specialty 構成（GACHA_CONFIG.specialty）。
 * B は主 1 つのみ / A は旧仕様どおり（主 3-10 ＋ 40% で副 1-4）/ S は 2 つ確定。
 */

let counter = 0;

/**
 * v0.22：候補はガチャランク付きで生成する。
 * rank 省略時はノーマルガチャ（S 無し）の素の排出率で抽選（シミュレーション・テスト用）。
 * 実際の抽選（種類・ピティ込み）は呼び出し側（gameStore.pullGacha）が rollRank の結果を渡す。
 */
export const newCandidate = (
  deps: Deps = defaultDeps,
  rank: GachaRank = rollRank4('normal', deps.rng),
): Candidate => {
  const { rng, now } = deps;
  // 実装ステップ3：**スキルが真**。ランクの天井（RANK_TOTAL_POWER）から総合力を決め、
  // 分散ペナルティ（2スキルは ×0.9）も効かせる。
  const skills = rollSkills(totalPowerFor(rank, 1, rng()), rng);
  const role = roleFromSkills(skills);
  // 互換：給与計算がまだ power を使う。総合力 ÷ 100 で導出する（同じスケールになった）
  const power = Math.round((totalPowerOf(skills) / 100) * 1000) / 1000;
  counter += 1;
  return {
    id: `c-${now()}-${counter}`,
    name: randomName(rng),
    role,
    rank,
    power,
    basePower: power,
    level: 1,
    exp: 0,
    wage: wageFor(role, power),
    specialties: [],
    skills,
  };
};

/** 主スキル → 旧 role（表示・旧経路の分岐用）。実装ステップ3 で role ごと削除する */
export const roleFromSkills = (skills: Employee['skills']): EmployeeRole => {
  const p: SkillId | null = primarySkillOf(skills);
  if (p === 'pr') return 'pr';
  if (p === 'graphics' || p === 'sound' || p === 'scenario') return 'designer';
  return 'programmer';
};

/**
 * プログラマーの power 合計（正規化 0..1 スケールのまま）。
 * 用途はバグ抑制（core/bugs.ts）。旧 sumProgrammerSpeed（LoC/秒）は自動開発機能の削除に伴い廃止。
 */

/**
 * 広報の売上ボーナス（比率）。
 *
 * 実装ステップ3：役職 `pr` の `power` 合計 → **広報スキルの合計**に付け替えた
 * （同分野の2人目以降は半減。`prSkillTotalOf`）。
 * スキル100 の広報1人で +20%、2人目は +10% 上乗せ。
 */
export const sumPrBonus = (employees: Employee[]): number =>
  Math.round((prSkillTotalOf(employees) / 100) * PR_SALES_BONUS_PER_SKILL * 1000) / 1000;

/**
 * 割当従業員のうち、選択カテゴリにマッチする specialty.bonus の総和。
 */
