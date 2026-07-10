import { describe, expect, it } from 'vitest';
import { getCompat } from './compatibility';
import { GENRE_BY_ID, GENRES, INITIAL_GENRE_IDS } from './genres';
import { INITIAL_THEME_IDS, THEME_BY_ID, THEMES } from './themes';

describe('相性テーブル（v0.16 是正）', () => {
  it('全組合せの実効値は 0.7〜1.6（上限 2.0→1.6 に圧縮）', () => {
    for (const g of GENRES) {
      for (const t of THEMES) {
        const c = getCompat(g.id, t.id);
        expect(c).toBeGreaterThanOrEqual(0.7);
        expect(c).toBeLessThanOrEqual(1.6);
      }
    }
  });

  it('初期解放 9 組は 0.85〜1.25 帯（初手に神も即死級地雷もない）', () => {
    for (const g of INITIAL_GENRE_IDS) {
      for (const t of INITIAL_THEME_IDS) {
        const c = getCompat(g, t);
        expect(c, `${g}|${t}`).toBeGreaterThanOrEqual(0.85);
        expect(c, `${g}|${t}`).toBeLessThanOrEqual(1.25);
      }
    }
  });

  it('puzzle|sushi は神ではなくなった（オーナー報告 1.9 の是正）', () => {
    expect(getCompat('puzzle', 'sushi')).toBeLessThanOrEqual(1.25);
  });

  it('初期帯にも学習用の地雷がある（adventure|sushi < 0.9）', () => {
    expect(getCompat('adventure', 'sushi')).toBeLessThan(0.9);
  });

  it('神（1.5+）は stage3+ 解放のジャンル/テーマの交点にのみ存在する', () => {
    const divineCombos: string[] = [];
    for (const g of GENRES) {
      for (const t of THEMES) {
        if (getCompat(g.id, t.id) >= 1.5) {
          divineCombos.push(`${g.id}|${t.id}`);
          const lateGame = GENRE_BY_ID[g.id].unlockStage >= 3 || THEME_BY_ID[t.id].unlockStage >= 3;
          expect(lateGame, `${g.id}|${t.id} は初期帯に神`).toBe(true);
        }
      }
    }
    // 神が消滅していないこと（探索の柱＝終盤の発見物として存在する）
    expect(divineCombos.length).toBeGreaterThanOrEqual(1);
  });
});
