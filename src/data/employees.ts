import { rollRank } from '../core/gacha';
import type { Deps, Rng } from '../core/ports';
import { defaultDeps } from '../core/ports';
import type { Candidate, Employee, EmployeeRole, EmployeeSpecialty } from '../state/types';
import { computeMonthlyWage, GACHA_CONFIG, type GachaRank, ROLE_EFFECT } from './balance';
import type { CategoryId } from './categories';

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

const ROLE_DICE: EmployeeRole[] = ['programmer', 'programmer', 'designer', 'designer', 'pr'];

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

const ALL_CATEGORY_IDS: CategoryId[] = [
  'graphics',
  'sound',
  'story',
  'gameplay',
  'presentation',
  'innovation',
];

const PRIMARY_CATEGORIES_BY_ROLE: Record<EmployeeRole, CategoryId[]> = {
  programmer: ['gameplay', 'innovation'],
  designer: ['graphics', 'sound'],
  pr: ['story', 'presentation'],
};

/**
 * v0.22：ランク別の specialty 構成（GACHA_CONFIG.specialty）。
 * B は主 1 つのみ / A は旧仕様どおり（主 3-10 ＋ 40% で副 1-4）/ S は 2 つ確定。
 */
const rollSpecialties = (role: EmployeeRole, rank: GachaRank, rng: Rng): EmployeeSpecialty[] => {
  const cfg = GACHA_CONFIG.specialty[rank];
  const result: EmployeeSpecialty[] = [];
  const primaryPool = PRIMARY_CATEGORIES_BY_ROLE[role];
  const primary = pick(primaryPool, rng);
  const primaryBonus = Math.round(cfg.primaryMin + rng() * (cfg.primaryMax - cfg.primaryMin));
  result.push({ categoryId: primary, bonus: primaryBonus });
  if (cfg.secondChance > 0 && rng() < cfg.secondChance) {
    const otherPool = ALL_CATEGORY_IDS.filter((c) => c !== primary);
    const second = pick(otherPool, rng);
    const secondBonus = Math.round(cfg.secondMin + rng() * (cfg.secondMax - cfg.secondMin));
    result.push({ categoryId: second, bonus: secondBonus });
  }
  return result;
};

let counter = 0;

/**
 * v0.22：候補はガチャランク付きで生成する。
 * rank 省略時はノーマルガチャ（S 無し）の素の排出率で抽選（シミュレーション・テスト用）。
 * 実際の抽選（種類・ピティ込み）は呼び出し側（gameStore.pullGacha）が rollRank の結果を渡す。
 */
export const newCandidate = (
  deps: Deps = defaultDeps,
  rank: GachaRank = rollRank('normal', deps.rng),
): Candidate => {
  const { rng, now } = deps;
  const role = pick(ROLE_DICE, rng);
  const power = rollPowerForRank(rank, rng);
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
    specialties: rollSpecialties(role, rank, rng),
  };
};

/** プログラマーの自動開発速度合計（LoC/秒）。v0.16：正規化 power × 係数 */
export const sumProgrammerSpeed = (employees: Employee[]): number =>
  employees
    .filter((e) => e.role === 'programmer')
    .reduce((a, b) => a + b.power * ROLE_EFFECT.programmerLocPerSec, 0);

/** デザイナーの品質基礎ボーナス合計。v0.16：正規化 power × 係数 */
export const sumDesignerBonus = (employees: Employee[]): number =>
  employees
    .filter((e) => e.role === 'designer')
    .reduce((a, b) => a + b.power * ROLE_EFFECT.designerQualityBonus, 0);

/** 広報の売上ボーナス合計（比率）。v0.16：正規化 power × 係数 */
export const sumPrBonus = (employees: Employee[]): number =>
  employees
    .filter((e) => e.role === 'pr')
    .reduce((a, b) => a + b.power * ROLE_EFFECT.prSalesBonus, 0);

/**
 * 割当従業員のうち、選択カテゴリにマッチする specialty.bonus の総和。
 */
export const sumEmployeeCategoryBonus = (
  employees: Employee[],
  selectedIds: string[],
  categoryIds: CategoryId[],
): number => {
  const selectedSet = new Set(selectedIds);
  const categorySet = new Set(categoryIds);
  let total = 0;
  for (const emp of employees) {
    if (!selectedSet.has(emp.id)) continue;
    for (const sp of emp.specialties ?? []) {
      if (categorySet.has(sp.categoryId)) total += sp.bonus;
    }
  }
  return total;
};
