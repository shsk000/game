import { describe, expect, it } from 'vitest';
import { CATEGORY_PHRASE_POOLS, pickBossPhrase } from './devPhrases';

describe('pickBossPhrase（v0.20 C：ボス文章＝プール2文の連結）', () => {
  it('プール内の2文をそのまま連結した文字列を返す', () => {
    const pool = CATEGORY_PHRASE_POOLS.program;
    // rng を固定：1回目 0（先頭）・2回目 0.99（末尾）を返す
    const calls: number[] = [0, 0.99];
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
