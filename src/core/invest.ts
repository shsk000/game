import { INVEST_CONFIG } from '../data/balance';
import { GENRE_BY_ID, type GenreId } from '../data/genres';
import { THEME_BY_ID, type ThemeId } from '../data/themes';

/**
 * 未解放ジャンル/テーマの先行購入（純粋関数のみ）。
 * 購入は「解放配列に足す」だけで、選んだ後の品質・売上計算は既存ロジックのまま変更しない。
 *
 * ```
 * 価格 = stage 別の基礎額 × 公比^(その stage でこれまでに買った数)
 * ```
 *
 * - stage が高い（人気）ほど基礎額が高い（¥30万 / ¥300万 / ¥3000万）
 * - 買うほど高くなる（オーナー指示 2026-07-19）
 *
 * ## 2026-07-29 に直した2点
 *
 * オーナー指摘：「解放金だけどもう少し緩やかにしてほしい。途中からあげれない」
 *
 * 1. **公比 1.8 → 1.2。** 1.8 は「無償の自動解放と併存する」前提で置かれた値だったが、
 *    v0.29 で自動解放を廃止して**購入が唯一の経路**になったのに再調整されていなかった。
 *    実測で 11個目 ¥1.1億 / 16個目 ¥20.2億 / 21個目 ¥382億 ＝ AAA の基準売上 ¥60億 でも
 *    次の1個が買えない。27ジャンルの大半に一生触れない構造だった。
 * 2. **購入数を stage 別に分けた。** 以前はジャンル・テーマ通しの1つのカウンタで、
 *    **探索のために安いテーマを買うほど人気ジャンルが遠のいた**。
 *    ジャンル×テーマの相性を探す遊びと真正面から衝突する。
 *    「人気なほど高い」は基礎額の ×10 刻みがすでに担っている。
 *
 * 購入数は**状態として持たない**。自動解放を廃止した以上、
 * 「stage2 以上で解放済み ＝ 買ったもの」なので解放リストから数えられる。
 */

/**
 * stage 別の基礎額。stage 1 は初期解放なので購入不可＝null（テーブル外の stage も null）。
 */
export const investStageBase = (stage: number): number | null =>
  INVEST_CONFIG.unlockPriceByStage[stage] ?? null;

/**
 * その stage でこれまでに買った数。
 * 自動解放は廃止済み（`core/release.ts`）なので、stage2 以上の解放済み＝購入したもの。
 */
export const purchasedCountAtStage = (
  stage: number,
  unlockedGenres: GenreId[],
  unlockedThemes: ThemeId[],
): number => {
  let n = 0;
  for (const id of unlockedGenres) if (GENRE_BY_ID[id]?.unlockStage === stage) n += 1;
  for (const id of unlockedThemes) if (THEME_BY_ID[id]?.unlockStage === stage) n += 1;
  return n;
};

/**
 * 先行購入価格 = 基礎額 × 公比^(その stage でこれまでに買った数)。¥万（10,000）単位に丸める。
 * 購入不可 stage（1 やテーブル外）は null。
 */
export const investPrice = (stage: number, purchasedAtStage: number): number | null => {
  const base = investStageBase(stage);
  if (base === null) return null;
  const raw = base * INVEST_CONFIG.priceGrowth ** Math.max(0, purchasedAtStage);
  return Math.round(raw / 10_000) * 10_000;
};

/** 解放リストから直接 stage の価格を出す（画面・ストアはこちらを使う） */
export const investPriceFor = (
  stage: number,
  unlockedGenres: GenreId[],
  unlockedThemes: ThemeId[],
): number | null => investPrice(stage, purchasedCountAtStage(stage, unlockedGenres, unlockedThemes));

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
