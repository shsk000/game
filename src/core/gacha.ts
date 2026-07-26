import { GACHA_CONFIG, type GachaKind, type GachaRank } from '../data/balance';
import type { Scale } from '../data/scales';
import type { Rng } from './ports';

/**
 * v0.22 採用ガチャの純粋ロジック（spec v22 §4・§7）。
 * 状態（資金・ピティカウンタ）は持たない。store が結果を反映する。
 *
 * v0.22.1：ノーマル / プレミアムの 2 種（kind）に対応。
 * - normal：B/A のみ（S 無し）。天井無し（pityThreshold=0）。
 * - premium：B/A/S。天井 pityThreshold 連続 S 非排出で次を S 確定。
 */

/**
 * ランク抽選。premium はピティ（pityThreshold 回連続 S 非排出）到達時に S 確定。
 * 判定順は S → A → B（rates の合計は 1.0 前提。normal は S=0 なので S は出ない）。
 */
/**
 * @deprecated 実装ステップ1 で `core/skills.ts` の `rollRank4`（C を含む4種）に置き換えた。
 * 旧テーブル `GACHA_CONFIG[kind].rates` を読むため C も出るが、新しい正は `GACHA_RANK_RATES`。
 * 参照が消えたら削除する。
 */
export const rollRank = (kind: GachaKind, rng: Rng = Math.random, pityCount = 0): GachaRank => {
  const cfg = GACHA_CONFIG[kind];
  // pityThreshold=0（normal）はピティ無効。premium のみ天井が効く。
  if (cfg.pityThreshold > 0 && pityCount >= cfg.pityThreshold) return 'S';
  const r = rng();
  if (r < cfg.rates.S) return 'S';
  if (r < cfg.rates.S + cfg.rates.A) return 'A';
  if (r < cfg.rates.S + cfg.rates.A + cfg.rates.B) return 'B';
  return 'C';
};

/**
 * 単発ガチャ価格。種類別テーブルを解放済み最高規模（unlockedScales 末尾＝economy.ts
 * currentRent と同じ判定）で引く。
 */
export const gachaPrice = (kind: GachaKind, unlockedScales: Scale[]): number => {
  const table = GACHA_CONFIG[kind].priceByScale;
  const current: Scale = unlockedScales[unlockedScales.length - 1] ?? 'mini';
  return table[current] ?? table.mini;
};

/** premium の天井閾値（UI 表示・境界判定用）。normal は 0（天井無し）。 */
export const pityThreshold = (kind: GachaKind): number => GACHA_CONFIG[kind].pityThreshold;

/** 抽選後のピティカウンタ更新：S 排出でリセット、それ以外は +1（premium のみで使う） */
export const nextPityCount = (pity: number, rank: GachaRank): number =>
  rank === 'S' ? 0 : pity + 1;
