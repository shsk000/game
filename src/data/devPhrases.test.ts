import { describe, expect, it } from 'vitest';
import { splitMorae } from '../core/kanaProgress';
import { CATEGORY_ORDER, CATEGORY_PHRASE_POOLS, pickBossPhrase, pickPhrase } from './devPhrases';
import type { Scale } from './scales';

describe('pickBossPhrase（v0.20 C：ボス文章＝プール2文の連結）', () => {
  it('プール内の2文をそのまま連結した文字列を返す', () => {
    const pool = CATEGORY_PHRASE_POOLS.program;
    // rng を固定：1回目 0（先頭）・2回目 ほぼ1（末尾）を返す
    // ※ プール件数に依存しないよう 1 未満の最大級の値を使う（0.99 だと件数増で末尾に届かない）
    const calls: number[] = [0, 0.999999];
    let i = 0;
    const rng = () => calls[i++];
    expect(pickBossPhrase('program', rng)).toBe(pool[0] + pool[pool.length - 1]);
  });

  it('通常文より明確に長い（プール中の最短文の2倍以上）', () => {
    const pool = CATEGORY_PHRASE_POOLS.graphics;
    const shortest = Math.min(...pool.map((p) => p.length));
    const boss = pickBossPhrase('graphics', () => 0);
    expect(boss.length).toBeGreaterThanOrEqual(shortest * 2);
  });
});

describe('pickPhrase（v0.30：規模で1文の長さ＝モーラ数が偏る）', () => {
  // 決定的 PRNG（mulberry32）でサンプルを再現可能にする
  const seeded = (seed: number) => {
    let a = seed >>> 0;
    return () => {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  const avgMorae = (scale: Scale, cats = CATEGORY_ORDER, samples = 4000): number => {
    const rng = seeded(1234 + scale.length);
    let sum = 0;
    for (let i = 0; i < samples; i++) {
      const cat = cats[i % cats.length];
      sum += splitMorae(pickPhrase(cat, rng, scale)).length;
    }
    return sum / samples;
  };

  it('各カテゴリのプールは三分位に割れる長さの幅を持つ（重み付けの前提）', () => {
    for (const cat of CATEGORY_ORDER) {
      const morae = CATEGORY_PHRASE_POOLS[cat].map((p) => splitMorae(p).length);
      expect(morae.length).toBeGreaterThanOrEqual(3); // 三等分できる
      expect(Math.max(...morae)).toBeGreaterThan(Math.min(...morae)); // 長短の幅がある
    }
  });

  it('規模が上がるほど平均モーラ数が単調に増える（全カテゴリ集計）', () => {
    const order: Scale[] = ['mini', 'mobile', 'indie', 'hit', 'aaa'];
    const avgs = order.map((s) => avgMorae(s));
    for (let i = 1; i < avgs.length; i++) {
      expect(avgs[i]).toBeGreaterThan(avgs[i - 1]);
    }
    // 端の差がはっきり出ること（aaa は mini より明確に長い）
    expect(avgs[avgs.length - 1] - avgs[0]).toBeGreaterThan(1);
  });

  it('カテゴリ単位でも aaa は mini より平均が長い', () => {
    for (const cat of CATEGORY_ORDER) {
      expect(avgMorae('aaa', [cat])).toBeGreaterThan(avgMorae('mini', [cat]));
    }
  });

  it('scale を省略すると従来どおり（プール全体の一様抽選＝重み付けしない）', () => {
    const pool = CATEGORY_PHRASE_POOLS.program;
    expect(pickPhrase('program', () => 0)).toBe(pool[0]);
    expect(pickPhrase('program', () => 0.999)).toBe(pool[pool.length - 1]);
  });
});
