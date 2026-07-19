import { INVEST_CONFIG } from '../data/balance';

/**
 * v0.21「投資」：未解放ジャンル/テーマの先行購入（純粋関数のみ・docs/v21 §4-A）。
 * 購入は「解放配列に足す」だけで、選んだ後の品質・売上計算は既存ロジックのまま変更しない
 * （新しい加点経路を増やさない＝v0.19.1 の CAP の罠に該当しない）。
 *
 * 価格 = stage 別の基礎額 × 公比^(これまでの先行購入数)（オーナー指示 2026-07-19「買うほど高くなる」）。
 *  - stage が高い（人気）ほど基礎額が高い（¥30万/¥300万/¥3000万）
 *  - 先行購入するたびに次の価格が公比倍になる（青天井の逓増カーブ）
 * → 「人気 × 買うほど高い」の二重で伸び、資金力の増加に価格が追従し続ける。
 */

/**
 * stage 別の基礎額。stage 1 は初期解放なので購入不可＝null（テーブル外の stage も null）。
 */
export const investStageBase = (stage: number): number | null =>
  INVEST_CONFIG.unlockPriceByStage[stage] ?? null;

/**
 * 実際の先行購入価格 = 基礎額 × 公比^(これまでの先行購入数)。¥万（10,000）単位に丸める。
 * purchaseCount は「これまでに先行購入した累計回数」（無償の自動解放は数えない）。
 * 購入不可 stage（1 やテーブル外）は null。
 */
export const investPrice = (stage: number, purchaseCount: number): number | null => {
  const base = investStageBase(stage);
  if (base === null) return null;
  const raw = base * INVEST_CONFIG.priceGrowth ** Math.max(0, purchaseCount);
  return Math.round(raw / 10_000) * 10_000;
};

/**
 * 先行購入できるか。次の3条件をすべて満たすときだけ true：
 *  1. まだ解放されていない（二重課金にしない）
 *  2. その stage に購入価格が設定されている（stage 1 = 初期解放は不可）
 *  3. 資金が現在の価格以上ある
 */
export const canBuyUnlock = (args: {
  alreadyUnlocked: boolean;
  stage: number;
  purchaseCount: number;
  funds: number;
}): boolean => {
  if (args.alreadyUnlocked) return false;
  const price = investPrice(args.stage, args.purchaseCount);
  if (price === null) return false;
  return args.funds >= price;
};
