/**
 * v0.10 用：金額・期間のフォーマッタ。
 *
 * - `formatYen` …… ¥ + 万 / 億 / 兆 の日本語単位を自動切替（負値はマイナス記号付き）。
 * - `formatYenShort` …… 単位だけ（¥は付けない、グラフ用途）。
 * - `formatWeeks` …… N 週 → 「Y ヶ月 Z 週」「X 年 Y ヶ月」表示。
 *
 * 既存の `toLocaleString` ベースの表記も併用できるよう、桁感を見せたい箇所だけ
 * 段階的に置き換える。global.css は触らない方針（spec §6 / オーダー指示）。
 */

import { SALES_MULTIPLIER_BY_SCORE, SCALE_BALANCE } from '../data/balance';
import type { Scale } from '../data/scales';

const TRILLION = 1_000_000_000_000;
const HUNDRED_MILLION = 100_000_000;
const TEN_THOUSAND = 10_000;

const trimDecimal = (n: number, digits: number): string => {
  // 桁を残しつつ、末尾の不要な 0 を削る（例：1.50 → 1.5、1.00 → 1）
  const fixed = n.toFixed(digits);
  if (digits <= 0) return fixed;
  return fixed.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
};

/**
 * 日本語の桁感に合わせた金額表記。
 *   ¥0
 *   ¥9,999
 *   ¥1.2 万
 *   ¥1.2 億
 *   ¥3.4 兆
 *   -¥1.5 億
 *
 * 1 万未満は素のまま `¥1,234` で表示。
 * 兆 / 億 / 万 のいずれかの単位がついた場合は小数 1 桁まで残す（必要に応じて 0 切り捨て）。
 */
export const formatYen = (value: number): string => {
  if (!Number.isFinite(value)) return '¥—';
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  if (abs < TEN_THOUSAND) return `${sign}¥${Math.round(abs).toLocaleString('ja-JP')}`;
  if (abs < HUNDRED_MILLION) {
    const v = abs / TEN_THOUSAND;
    return `${sign}¥${trimDecimal(v, 1)}万`;
  }
  if (abs < TRILLION) {
    const v = abs / HUNDRED_MILLION;
    return `${sign}¥${trimDecimal(v, 2)}億`;
  }
  const v = abs / TRILLION;
  return `${sign}¥${trimDecimal(v, 2)}兆`;
};

/**
 * 万・億・兆 のいずれかが付いた最大単位だけ取り出した文字列。
 * UI で「¥1.2 億 + 細かい金額」のように二段表示したいときに使う。
 */
export const formatYenShort = (value: number): string => formatYen(value).replace(/^¥|^-¥/, '');

/**
 * 週数を「N ヶ月 M 週」「X 年 Y ヶ月」へ整形。
 * 1 ヶ月 = 4 週、1 年 = 48 週 として spec.md §3-0 の運用に合わせる。
 *  - 0 週 → "0 週"
 *  - 1〜3 週 → "N 週"
 *  - 4 週単位 → "M ヶ月"（端数があれば "M ヶ月 N 週"）
 *  - 12 ヶ月以上 → "X 年"（残りが月単位ならその月も）
 */
export const formatWeeks = (weeks: number): string => {
  if (!Number.isFinite(weeks)) return '—';
  const w = Math.max(0, Math.round(weeks));
  if (w === 0) return '0 週';
  if (w < 4) return `${w} 週`;
  const months = Math.floor(w / 4);
  const remW = w % 4;
  if (months < 12) {
    return remW === 0 ? `${months} ヶ月` : `${months} ヶ月 ${remW} 週`;
  }
  const years = Math.floor(months / 12);
  const remM = months % 12;
  if (remM === 0 && remW === 0) return `${years} 年`;
  if (remW === 0) return `${years} 年 ${remM} ヶ月`;
  return `${years} 年 ${remM} ヶ月 ${remW} 週`;
};

/**
 * ROI（利益 / 投資 × 100）を `+45.2%` / `-12.3%` 表記で返す。
 * 投資 = 0 のときは `—`。
 */
export const formatRoi = (profit: number, invest: number): string => {
  if (!Number.isFinite(profit) || !Number.isFinite(invest) || invest === 0) return '—';
  const pct = (profit / invest) * 100;
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}%`;
};

/**
 * 予想売上レンジ：**実際の売上式と同じ数列**から算出する（企画画面の規模選択で表示）。
 *
 *   実売上 = SCALE_BALANCE[scale].baseRevenue × salesMultiplierForScore(メタスコア) × 各種補正
 *
 * 旧実装は `scales.ts` の `baseUnit` という**実式と接点のない別系列**を使っていたため、
 * インディー以上では「予測の中央値」が「実際の最悪帯（致命的失敗 ×0.33）」すら下回り、
 * 企画画面の予想利益が常に大赤字を表示していた（例：インディーの予測中央値 ¥800 万に対し、
 * 実際の普通帯は ¥3 億）。オーナー指摘 2026-07-25 で是正。
 *
 * 段の取り方（`SCORE_TIERS` の想定分布に合わせる。累積 致命的20% + 失敗35% → 中央値は失敗帯）：
 *   low  = 致命的失敗（メタ 0〜29）  ×0.33
 *   mid  = 失敗（メタ 30〜49）       ×3.33  ← 統計的中央値。盛らない
 *   high = 大ヒット（メタ 80〜89）   ×100
 *
 * ソフト補正（広報・ファン・トレンド・マーケ広告・軸補正）は掛けない＝**素の下限**を見せる。
 */
export const estimateRevenueRange = (scale: Scale): { low: number; mid: number; high: number } => {
  const base = SCALE_BALANCE[scale].baseRevenue;
  return {
    low: Math.round(base * SALES_MULTIPLIER_BY_SCORE.catastrophic),
    mid: Math.round(base * SALES_MULTIPLIER_BY_SCORE.failure),
    high: Math.round(base * SALES_MULTIPLIER_BY_SCORE.bigHit),
  };
};
