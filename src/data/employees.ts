import type { Candidate, Employee, EmployeeRole } from '../state/types';

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
  };
};

export const sumProgrammerSpeed = (employees: Employee[]): number =>
  employees.filter((e) => e.role === 'programmer').reduce((a, b) => a + b.power, 0);

export const sumDesignerBonus = (employees: Employee[]): number =>
  employees.filter((e) => e.role === 'designer').reduce((a, b) => a + b.power, 0);

export const sumPrBonus = (employees: Employee[]): number =>
  employees.filter((e) => e.role === 'pr').reduce((a, b) => a + b.power, 0) / 100;

export const REFRESH_COST = 50;
