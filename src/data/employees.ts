import type { Candidate, Employee, EmployeeRole, EmployeeSpecialty } from '../state/types';
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

const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

const randomName = () => `${pick(SURNAMES)} ${pick(GIVEN)}`;

const ROLE_DICE: EmployeeRole[] = ['programmer', 'programmer', 'designer', 'designer', 'pr'];

/**
 * 職種別の力量レンジ:
 *  - programmer: LoC/sec 0.3〜1.2
 *  - designer:   品質基礎+ 2〜10
 *  - pr:         売上%加算 5〜20
 */
const rollPower = (role: EmployeeRole): number => {
  if (role === 'programmer') return Math.round((0.3 + Math.random() * 0.9) * 10) / 10;
  if (role === 'designer') return Math.round(2 + Math.random() * 8);
  return Math.round(5 + Math.random() * 15);
};

const wageFor = (role: EmployeeRole, power: number): number => {
  if (role === 'programmer') return Math.round(150 + power * 600);
  if (role === 'designer') return Math.round(150 + power * 90);
  return Math.round(150 + power * 60);
};

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

const rollSpecialties = (role: EmployeeRole): EmployeeSpecialty[] => {
  const result: EmployeeSpecialty[] = [];
  const primaryPool = PRIMARY_CATEGORIES_BY_ROLE[role];
  const primary = pick(primaryPool);
  const primaryBonus = Math.round(3 + Math.random() * 7); // 3-10
  result.push({ categoryId: primary, bonus: primaryBonus });
  if (Math.random() < 0.4) {
    const otherPool = ALL_CATEGORY_IDS.filter((c) => c !== primary);
    const second = pick(otherPool);
    const secondBonus = Math.round(1 + Math.random() * 3); // 1-4
    result.push({ categoryId: second, bonus: secondBonus });
  }
  return result;
};

let counter = 0;

export const newCandidate = (): Candidate => {
  const role = pick(ROLE_DICE);
  const power = rollPower(role);
  counter += 1;
  return {
    id: `c-${Date.now()}-${counter}`,
    name: randomName(),
    role,
    power,
    wage: wageFor(role, power),
    specialties: rollSpecialties(role),
  };
};

export const sumProgrammerSpeed = (employees: Employee[]): number =>
  employees.filter((e) => e.role === 'programmer').reduce((a, b) => a + b.power, 0);

export const sumDesignerBonus = (employees: Employee[]): number =>
  employees.filter((e) => e.role === 'designer').reduce((a, b) => a + b.power, 0);

export const sumPrBonus = (employees: Employee[]): number =>
  employees.filter((e) => e.role === 'pr').reduce((a, b) => a + b.power, 0) / 100;

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

export const REFRESH_COST = 50;
