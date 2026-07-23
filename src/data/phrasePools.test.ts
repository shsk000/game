import { describe, expect, it } from 'vitest';
import { CATEGORY_ORDER, CATEGORY_PHRASE_POOLS } from './devPhrases';
import { PLAN_CATEGORY_ORDER, PLAN_MEMO_POOLS, PLAN_PHRASE_POOLS } from './planTickets';

/**
 * v0.27「言葉を増やす」：打鍵プールを厳密テーマで10倍に増量した際の機械検査。
 * - 件数下限（開発≥80 / 企画≥40 / メモ≥5）
 * - 打鍵プールはひらがな＋長音符のみ（タイピングコアの入力モデルを崩さない）
 * - プール内で完全重複がない（体感の「またこれ」を避ける前提）
 * ※メモは打鍵しない表示テキストのため、ひらがな限定検査の対象外（漢字可）。
 */

/** ひらがな（小書き・ゔ含む）＋長音符のみ許可 */
const HIRAGANA_ONLY = /^[ぁ-んゔー]+$/;

describe('CATEGORY_PHRASE_POOLS（開発フェーズ打鍵文）', () => {
  it.each(CATEGORY_ORDER)('%s は 80 件以上ある', (cat) => {
    expect(CATEGORY_PHRASE_POOLS[cat].length).toBeGreaterThanOrEqual(80);
  });

  it.each(CATEGORY_ORDER)('%s は全文がひらがな＋長音符のみ', (cat) => {
    const bad = CATEGORY_PHRASE_POOLS[cat].filter((p) => !HIRAGANA_ONLY.test(p));
    expect(bad).toEqual([]);
  });

  it.each(CATEGORY_ORDER)('%s のプール内に完全重複がない', (cat) => {
    const pool = CATEGORY_PHRASE_POOLS[cat];
    expect(new Set(pool).size).toBe(pool.length);
  });
});

describe('PLAN_PHRASE_POOLS（企画フェーズ打鍵文）', () => {
  it.each(PLAN_CATEGORY_ORDER)('%s は 40 件以上ある', (cat) => {
    expect(PLAN_PHRASE_POOLS[cat].length).toBeGreaterThanOrEqual(40);
  });

  it.each(PLAN_CATEGORY_ORDER)('%s は全文がひらがな＋長音符のみ', (cat) => {
    const bad = PLAN_PHRASE_POOLS[cat].filter((p) => !HIRAGANA_ONLY.test(p));
    expect(bad).toEqual([]);
  });

  it.each(PLAN_CATEGORY_ORDER)('%s のプール内に完全重複がない', (cat) => {
    const pool = PLAN_PHRASE_POOLS[cat];
    expect(new Set(pool).size).toBe(pool.length);
  });
});

describe('PLAN_MEMO_POOLS（会議メモ・表示専用）', () => {
  it.each(PLAN_CATEGORY_ORDER)('%s は 5 件以上あり重複がない', (cat) => {
    const pool = PLAN_MEMO_POOLS[cat];
    expect(pool.length).toBeGreaterThanOrEqual(5);
    expect(new Set(pool).size).toBe(pool.length);
  });
});
