import { describe, expect, it } from 'vitest';
import { TICKET_HAND_CONFIG } from '../data/balance';
import { getTicketAt, PHRASES_PER_TICKET } from '../data/devPhrases';
import { mulberry32, type Rng } from './ports';
import { drawHand, drawPlanHand, type HandContext } from './tickets';

const ctx = (over: Partial<HandContext> = {}): HandContext => ({
  genreId: 'puzzle',
  ticketIndex: 0,
  bugCount: 0,
  ...over,
});

/** 指定した値を順に返す rng（使い切ったら最後の値を返し続ける） */
const seqRng = (values: number[]): Rng => {
  let i = 0;
  return () => {
    const v = values[Math.min(i, values.length - 1)];
    i++;
    return v;
  };
};

describe('drawHand（v0.19 手札3枚の生成）', () => {
  it('常に handSize 枚で、標準チケットが必ず1枚以上含まれる（seed 総当たり）', () => {
    for (let seed = 0; seed < 100; seed++) {
      const hand = drawHand(ctx({ bugCount: 3 }), mulberry32(seed));
      expect(hand).toHaveLength(TICKET_HAND_CONFIG.handSize);
      expect(hand.filter((t) => t.kind === 'standard').length).toBeGreaterThanOrEqual(1);
      expect(hand[0].kind).toBe('standard');
    }
  });

  it('bugCount 0 のとき即修チケットは出ない（seed 総当たり）', () => {
    for (let seed = 0; seed < 100; seed++) {
      const hand = drawHand(ctx({ bugCount: 0 }), mulberry32(seed));
      expect(hand.some((t) => t.kind === 'bugfix')).toBe(false);
    }
  });

  it('標準チケットは従来の getTicketAt と同じカテゴリ/フレーバー・3文・倍率×1', () => {
    // 抽選を全部外して 3 枚とも標準にする
    const hand = drawHand(ctx({ ticketIndex: 5, bugCount: 2 }), () => 0.99);
    hand.forEach((t, i) => {
      const base = getTicketAt('puzzle', 5 + i);
      expect(t.kind).toBe('standard');
      expect(t.category).toBe(base.category);
      expect(t.flavor).toEqual(base.flavor);
      expect(t.phrases).toBe(PHRASES_PER_TICKET);
      expect(t.rewardMult).toBe(1);
      expect(t.missBugMult).toBe(1);
    });
  });

  it('チャレンジ抽選：出現率ちょうど未満で出る／以上で出ない（境界値）', () => {
    const { rate, phrases, rewardMult, missBugMult } = TICKET_HAND_CONFIG.challenge;
    const hit = drawHand(ctx(), seqRng([rate - 0.0001, 0.99]));
    const challenge = hit.find((t) => t.kind === 'challenge');
    expect(challenge).toBeDefined();
    expect(challenge?.phrases).toBe(phrases);
    expect(challenge?.rewardMult).toBe(rewardMult);
    expect(challenge?.missBugMult).toBe(missBugMult);
    expect(challenge?.category).toBeDefined();
    expect(challenge?.flavor).toBeDefined();

    const miss = drawHand(ctx(), seqRng([rate, 0.99]));
    expect(miss.some((t) => t.kind === 'challenge')).toBe(false);
  });

  it('即修抽選：bugCount≥1 かつ出現率未満で出る（2文・報酬なし・ミスバグ化×1）', () => {
    const { rate, phrases } = TICKET_HAND_CONFIG.bugfix;
    const hit = drawHand(ctx({ bugCount: 1 }), seqRng([0.99, rate - 0.0001]));
    const bugfix = hit.find((t) => t.kind === 'bugfix');
    expect(bugfix).toBeDefined();
    expect(bugfix?.phrases).toBe(phrases);
    expect(bugfix?.rewardMult).toBe(0);
    expect(bugfix?.missBugMult).toBe(1);
    expect(bugfix?.category).toBeUndefined();

    const miss = drawHand(ctx({ bugCount: 1 }), seqRng([0.99, rate]));
    expect(miss.some((t) => t.kind === 'bugfix')).toBe(false);
    expect(miss[2].kind).toBe('standard');
  });

  it('出現率が設定値どおりに収束する（seed 固定の統計）', () => {
    const rng = mulberry32(7);
    const n = 1000;
    let challenges = 0;
    let bugfixes = 0;
    for (let i = 0; i < n; i++) {
      const hand = drawHand(ctx({ bugCount: 1 }), rng);
      if (hand.some((t) => t.kind === 'challenge')) challenges++;
      if (hand.some((t) => t.kind === 'bugfix')) bugfixes++;
    }
    // 30% ± 5pt / 50% ± 5pt（seed 固定なので決定的）
    expect(challenges / n).toBeGreaterThan(TICKET_HAND_CONFIG.challenge.rate - 0.05);
    expect(challenges / n).toBeLessThan(TICKET_HAND_CONFIG.challenge.rate + 0.05);
    expect(bugfixes / n).toBeGreaterThan(TICKET_HAND_CONFIG.bugfix.rate - 0.05);
    expect(bugfixes / n).toBeLessThan(TICKET_HAND_CONFIG.bugfix.rate + 0.05);
  });
});

describe('drawPlanHand（企画フェーズの手札）', () => {
  it('残りカテゴリの先頭から最大 handSize 件を返す', () => {
    expect(drawPlanHand(['concept', 'genre', 'target', 'world'])).toEqual([
      'concept',
      'genre',
      'target',
    ]);
  });

  it('残りが handSize 未満ならそのまま全部返す', () => {
    expect(drawPlanHand(['title', 'sales'])).toEqual(['title', 'sales']);
    expect(drawPlanHand([])).toEqual([]);
  });
});
