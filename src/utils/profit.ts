import { SCALE_BY_ID, type Scale } from '../data/scales';

/**
 * v0.10：利益計算ユーティリティ。
 *
 *   profit = totalRevenue - devCost - monthlyFixedCost × developMonths
 *   ROI = profit / (devCost + monthlyFixedCost × developMonths)
 *
 * `ReleaseScreen` のリリース直後ブレイクダウン、P3-F 月次決算サマリ、
 * `PlanScreen` の予想利益（赤字警告）で共用。
 */

export type ProfitInput = {
  totalRevenue: number;
  devCost: number;
  monthlyFixedCost: number;
  developMonths: number;
};

export type ProfitResult = {
  totalRevenue: number;
  totalCost: number;
  devCost: number;
  fixedCostTotal: number;
  profit: number;
  roiPct: number | null;
};

export const computeProfit = (input: ProfitInput): ProfitResult => {
  const months = Math.max(1, Math.round(input.developMonths));
  const fixedCostTotal = input.monthlyFixedCost * months;
  const totalCost = input.devCost + fixedCostTotal;
  const profit = input.totalRevenue - totalCost;
  const roiPct = totalCost > 0 ? (profit / totalCost) * 100 : null;
  return {
    totalRevenue: input.totalRevenue,
    totalCost,
    devCost: input.devCost,
    fixedCostTotal,
    profit,
    roiPct,
  };
};

/** 規模から「開発費」「月固定費」「開発期間（月数）」を取り出してそのまま computeProfit にかけるヘルパ */
export const computeProfitForScale = (params: {
  totalRevenue: number;
  scale: Scale;
  developWeeks?: number;
}): ProfitResult => {
  const def = SCALE_BY_ID[params.scale];
  const months = params.developWeeks
    ? Math.max(1, Math.round(params.developWeeks / 4))
    : Math.max(1, Math.round(def.neededWeeks / 4));
  return computeProfit({
    totalRevenue: params.totalRevenue,
    devCost: def.baseCost,
    monthlyFixedCost: def.monthlyRent,
    developMonths: months,
  });
};
