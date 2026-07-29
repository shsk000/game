import { computeBorrowingLimit, DEBT_CONFIG } from '../data/balance';
import { sumMonthlySalaries } from '../data/employees';
import type { Scale } from '../data/scales';
import { SCALE_BY_ID } from '../data/scales';
import type { Employee, MonthlyFixedCost, OfflineReport, Work } from '../state/types';
import { settleAllWorks } from '../utils/sales';

/**
 * 経済系のルール計算（純粋関数）。
 * 時刻は nowMs 引数で受け取る（logic-architecture §2）。
 */

export type EconomyCtx = {
  funds: number;
  debt: number;
  employees: Employee[];
  unlockedScales: Scale[];
};

/** 現在の規模（解放済みの最上位）の月額賃料 */
const currentRent = (unlockedScales: Scale[]): number => {
  const currentScale: Scale = unlockedScales[unlockedScales.length - 1] ?? 'mini';
  return SCALE_BY_ID[currentScale]?.monthlyRent ?? 0;
};

/**
 * 月初の固定費精算（v0.10 §6-7）。gameStore.monthlyTick から抽出（P3b。ロジック無変更）。
 *  - 固定費 = 給与 + 賃料 + 借金月利
 *  - 資金がマイナスになった分は自動的に借金へ振替（資金は 0 で下げ止まる）
 *  - 借入上限（月固定費 × 12）超過 かつ 資金 0 → ゲームオーバー
 */
export const computeMonthlyTick = (
  ctx: EconomyCtx,
): { cost: MonthlyFixedCost; funds: number; debt: number; gameOver: boolean } => {
  const salaries = sumMonthlySalaries(ctx.employees);
  const rent = currentRent(ctx.unlockedScales);
  const interest = Math.round(ctx.debt * DEBT_CONFIG.monthlyInterestRate);
  const total = salaries + rent + interest;
  const cost: MonthlyFixedCost = { salaries, rent, total };

  const rawFunds = ctx.funds - total;
  let funds = rawFunds;
  let debt = ctx.debt;
  if (rawFunds < 0) {
    debt = ctx.debt + -rawFunds;
    funds = 0;
  }

  const borrowingLimit = computeBorrowingLimit(salaries + rent);
  const gameOver = debt > borrowingLimit && funds <= 0;
  return { cost, funds, debt, gameOver };
};

/**
 * ランウェイ＝いまの資金が、いまの月固定費で**何ヶ月もつか**。
 *
 * 採用はスコアを上げるが、同時に毎月の出費を増やす。
 * この落差がどこにも表示されていないのが「序盤の破産が理不尽に感じる」の本体だった：
 * 社員0人・賃料¥30万だけなら16ヶ月もつのに、4分野を埋めると1.6ヶ月に落ちる。
 * 見えていれば「1人だけ採る」「先にミニを数本回す」という選択ができる。
 *
 * `employeesOverride` を渡すと「この人を採ったら」の試算になる（採用画面の比較用）。
 * 収入（販売プールの取り崩し）は数えない。**手を止めても減り続ける分**だけを見る指標。
 */
export const monthsOfRunway = (
  ctx: EconomyCtx,
  employeesOverride?: Employee[],
): { monthly: number; months: number | null } => {
  const employees = employeesOverride ?? ctx.employees;
  const salaries = sumMonthlySalaries(employees);
  const rent = currentRent(ctx.unlockedScales);
  const interest = Math.round(ctx.debt * DEBT_CONFIG.monthlyInterestRate);
  const monthly = salaries + rent + interest;
  // 固定費0（ありえないが防御）は「尽きない」＝null
  if (monthly <= 0) return { monthly, months: null };
  return { monthly, months: Math.max(0, ctx.funds) / monthly };
};

/**
 * 借入（v0.10 §6-7）。上限 = 月固定費（給与+賃料）× 12 ヶ月。
 * 成立しないときは null を返す（store 側は false を返すだけ）。
 */
export const computeBorrow = (
  ctx: EconomyCtx,
  amount: number,
): { funds: number; debt: number } | null => {
  // 非有限（NaN/Infinity）や 0 以下は無効。NaN は `<= 0` を素通りするため明示的に弾く。
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const salaries = sumMonthlySalaries(ctx.employees);
  const rent = currentRent(ctx.unlockedScales);
  const limit = computeBorrowingLimit(salaries + rent);
  if (ctx.debt + amount > limit) return null;
  return { funds: ctx.funds + amount, debt: ctx.debt + amount };
};

/** 返済。funds と debt の小さい方まで。返せる額がなければ null */
export const computeRepay = (
  ctx: Pick<EconomyCtx, 'funds' | 'debt'>,
  amount: number,
): { funds: number; debt: number } | null => {
  // 非有限（NaN/Infinity）や 0 以下は無効。NaN は `<= 0` を素通りするため明示的に弾く。
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const pay = Math.min(amount, ctx.funds, ctx.debt);
  if (pay <= 0) return null;
  return { funds: ctx.funds - pay, debt: ctx.debt - pay };
};

/**
 * コスト支払い（企画開始の前払い開発費 devCost 等）。computeMonthlyTick と同じ規則で、
 * 資金がマイナスになった分は自動的に借金へ振替し、資金は 0 で下げ止まる。
 * （ゲームオーバー判定は月初 computeMonthlyTick 側に委ねる＝ここでは行わない）
 */
export const computeSpend = (
  ctx: { funds: number; debt: number },
  amount: number,
): { funds: number; debt: number } => {
  const raw = ctx.funds - amount;
  if (raw < 0) return { funds: 0, debt: ctx.debt + -raw };
  return { funds: raw, debt: ctx.debt };
};

/** オフライン収益の反映猶予：これ未満の離席はレポートしない */
const MIN_AWAY_SEC = 60;

/**
 * 離席中の販売精算。lastSeenAt からの経過時間ぶん、販売中作品のプールを取り崩す。
 * 60 秒未満の離席・収益ゼロのときは report: null（モーダルを出さない）。
 */
export const computeOfflineEarnings = (
  lastSeenAt: number,
  library: Work[],
  nowMs: number,
): { report: OfflineReport | null; library: Work[] } => {
  if (!lastSeenAt) return { report: null, library };
  const awaySec = Math.max(0, (nowMs - lastSeenAt) / 1000);
  if (awaySec < MIN_AWAY_SEC) return { report: null, library };
  const { earned, library: updated } = settleAllWorks(library, awaySec);
  if (earned <= 0) return { report: null, library: updated };
  return { report: { earned, awaySec }, library: updated };
};
