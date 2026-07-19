import { GACHA_CONFIG, type GachaRank } from '../data/balance';
import type { Scale } from '../data/scales';
import type { Rng } from './ports';

/**
 * v0.22 採用ガチャの純粋ロジック（spec v22 §4・§7）。
 * 状態（資金・ピティカウンタ）は持たない。store が結果を反映する。
 */

/**
 * ランク抽選。ピティ（pityThreshold 回連続 S 非排出）到達時は S 確定。
 * 判定順は S → A → B（rates の合計は 1.0 前提）。
 */
export const rollRank = (rng: Rng = Math.random, pityCount = 0): GachaRank => {
  if (pityCount >= GACHA_CONFIG.pityThreshold) return 'S';
  const r = rng();
  if (r < GACHA_CONFIG.rates.S) return 'S';
  if (r < GACHA_CONFIG.rates.S + GACHA_CONFIG.rates.A) return 'A';
  return 'B';
};

/**
 * 単発ガチャ価格。解放済み最高規模（unlockedScales 末尾＝economy.ts currentRent と同じ判定）
 * に連動する。
 */
export const gachaPrice = (unlockedScales: Scale[]): number => {
  const current: Scale = unlockedScales[unlockedScales.length - 1] ?? 'mini';
  return GACHA_CONFIG.priceByScale[current] ?? GACHA_CONFIG.priceByScale.mini;
};

/** 抽選後のピティカウンタ更新：S 排出でリセット、それ以外は +1 */
export const nextPityCount = (pity: number, rank: GachaRank): number =>
  rank === 'S' ? 0 : pity + 1;
