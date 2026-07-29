import { describe, expect, it } from 'vitest';
import { compatLabel, getCompat } from './compatibility';
import { GENRES } from './genres';
import { THEMES } from './themes';

/**
 * **相性の盤面が「探す価値のある地図」になっていることのガード。**
 *
 * オーナー指摘（2026-07-29）：
 * > バランスが悪くて組み合わせを見つける面白さあまりない。右側とか1.0が多いし
 *
 * 実測すると 756組のうち **185組（24%）がちょうど 1.00**、ゾンビ列は 27ジャンル中 24個が 1.00 だった。
 * ここが緩むと「どれを選んでも同じ」に戻る。
 */

const ALL = GENRES.flatMap((g) => THEMES.map((t) => ({ g: g.id, t: t.id, v: getCompat(g.id, t.id) })));

describe('平坦さが戻っていない', () => {
  it('ちょうど 1.00 のマスがほとんど無い（旧：185組＝24%）', () => {
    const ones = ALL.filter((x) => x.v === 1).length;
    expect(ones, `${ones}/${ALL.length} が 1.00`).toBeLessThanOrEqual(23);
  });

  it('1つのテーマ列で同じ値が3割を超えて並ばない（旧：ゾンビ列 24/27＝89%）', () => {
    for (const t of THEMES) {
      const vals = GENRES.map((g) => getCompat(g.id, t.id));
      const counts = new Map<number, number>();
      for (const v of vals) counts.set(v, (counts.get(v) ?? 0) + 1);
      const top = Math.max(...counts.values());
      expect(top / vals.length, `${t.id} 列の最頻値が ${top}/${vals.length}`).toBeLessThanOrEqual(0.3);
    }
  });

  it('ジャンルの行がすべて別物（旧：27ジャンル→23行）', () => {
    const rows = new Set(GENRES.map((g) => THEMES.map((t) => getCompat(g.id, t.id)).join(',')));
    expect(rows.size, `${rows.size}/${GENRES.length} 種類`).toBe(GENRES.length);
  });

  it('テーマの列がすべて別物（旧：28テーマ→25列）', () => {
    const cols = new Set(THEMES.map((t) => GENRES.map((g) => getCompat(g.id, t.id)).join(',')));
    expect(cols.size, `${cols.size}/${THEMES.length} 種類`).toBe(THEMES.length);
  });
});

describe('帯の分布', () => {
  const share = (label: string) => ALL.filter((x) => compatLabel(x.v) === label).length / ALL.length;

  it('🔥神は2〜4%（＝手書きした例外だけが届く）', () => {
    const n = ALL.filter((x) => compatLabel(x.v) === '🔥 神').length;
    expect(n, `${n}組`).toBeGreaterThanOrEqual(15);
    expect(n, `${n}組`).toBeLessThanOrEqual(30);
  });

  it('👍good は15〜30%、💀地雷は10〜25%、😐普通が過半', () => {
    expect(share('👍 good')).toBeGreaterThanOrEqual(0.15);
    expect(share('👍 good')).toBeLessThanOrEqual(0.3);
    expect(share('💀 地雷')).toBeGreaterThanOrEqual(0.1);
    expect(share('💀 地雷')).toBeLessThanOrEqual(0.25);
    expect(share('😐 普通')).toBeGreaterThan(0.45);
  });

  it('クランプの外に出ない', () => {
    for (const x of ALL) {
      expect(x.v, `${x.g}|${x.t}`).toBeGreaterThanOrEqual(0.7);
      expect(x.v, `${x.g}|${x.t}`).toBeLessThanOrEqual(1.6);
    }
  });
});

describe('初期解放の9組で「相性がある」ことを学べる', () => {
  const INITIAL_GENRES = GENRES.filter((g) => g.unlockStage === 1).map((g) => g.id);
  const INITIAL_THEMES = THEMES.filter((t) => t.unlockStage === 1).map((t) => t.id);
  const initial = INITIAL_GENRES.flatMap((g) => INITIAL_THEMES.map((t) => getCompat(g, t)));

  it('初期は3ジャンル × 3テーマ', () => {
    expect(initial.length).toBe(9);
  });

  it('広がりがある（旧：9組中8組が同じ 1.20 だった）', () => {
    const spread = Math.max(...initial) - Math.min(...initial);
    expect(spread, `max-min=${spread.toFixed(2)}`).toBeGreaterThanOrEqual(0.25);
    const counts = new Map<number, number>();
    for (const v of initial) counts.set(v, (counts.get(v) ?? 0) + 1);
    expect(Math.max(...counts.values()), '同値は2組まで').toBeLessThanOrEqual(2);
  });

  it('🔥神は無く、💀地雷がちょうど1つ（初手で地雷を学ぶ）', () => {
    expect(initial.filter((v) => compatLabel(v) === '🔥 神').length).toBe(0);
    expect(initial.filter((v) => compatLabel(v) === '💀 地雷').length).toBe(1);
  });
});
