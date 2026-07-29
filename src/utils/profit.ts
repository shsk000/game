import { SCALE_BY_ID, type Scale } from '../data/scales';

/**
 * 利益計算ユーティリティ。
 *
 *   利益 = 総売上 − 開発費 − 開発中に払った固定費
 *   ROI  = 利益 / (開発費 + 開発中に払った固定費)
 *
 * `ReleaseScreen` のリリース直後ブレイクダウン、月次決算サマリ、
 * `PlanScreen` の予想利益（赤字警告）で共用。
 *
 * ## 固定費の入れ方は2通りある
 *
 * | 使う場面 | 渡すもの | 精度 |
 * |---|---|---|
 * | リリース後（実績） | `fixedCostTotal`（`monthlyTick` が積んだ実額） | **実測** |
 * | 企画時（見込み） | `monthlyFixedCost` × `developMonths` | 推定 |
 *
 * リリース画面は必ず実額を渡す。以前は実績側も推定を使っており、
 * `Math.round(週数 ÷ 4)` と `Math.max(1, months)` の切り上げで
 * **払っていない月を1ヶ月ぶん計上する**ことがあった（3人チームで約 ¥252万＝
 * ミニゲーム1本の総売上を超える誤差）。オーナー指摘 2026-07-29。
 *
 * 下限1ヶ月は撤廃した。月またぎが0回なら固定費0が正しい
 * （速く打ち切るほど固定費が安い、というコアループの手応えを表示が消していた）。
 */

export type ProfitInput = {
  totalRevenue: number;
  devCost: number;
  /** 実額がわかっている場合はこちらを渡す（リリース後）。渡したら月数計算は使わない */
  fixedCostTotal?: number;
  /** 見込みで出す場合（企画時）。`developMonths` と掛け合わせる */
  monthlyFixedCost?: number;
  developMonths?: number;
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
  const fixedCostTotal =
    input.fixedCostTotal ??
    // 見込み側も切り上げない。4週=1ヶ月なので、月またぎ回数の期待値は 週数÷4 の切り捨て
    (input.monthlyFixedCost ?? 0) * Math.max(0, Math.floor(input.developMonths ?? 0));
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

/**
 * 規模から「開発費」「月固定費」「開発期間（月数）」を取り出してそのまま computeProfit にかけるヘルパ。
 * **見込み専用**（実績はリリース時の実額を使う）。
 */
export const computeProfitForScale = (params: {
  totalRevenue: number;
  scale: Scale;
  developWeeks?: number;
}): ProfitResult => {
  const def = SCALE_BY_ID[params.scale];
  const weeks = params.developWeeks ?? def.neededWeeks;
  return computeProfit({
    totalRevenue: params.totalRevenue,
    devCost: def.baseCost,
    monthlyFixedCost: def.monthlyRent,
    developMonths: weeks / 4,
  });
};
