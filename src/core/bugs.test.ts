import { describe, expect, it } from 'vitest';
import { BUG_CONFIG } from '../data/balance';
import type { Employee } from '../state/types';
import {
  BUG_FIX_PHRASES,
  bugSuppression,
  bugsClearedByAd,
  debugWorkFor,
  ensureMinBugsOnDevComplete,
  pickBugFixPhrase,
  remainingBugPenalty,
  rollBugOnKeystroke,
  rollBugOnMiss,
} from './bugs';
import { mulberry32 } from './ports';

const programmer = (power: number, id = 'p1'): Employee => ({
  id,
  name: 'エンジニア',
  role: 'programmer',
  power,
  basePower: power,
  level: 1,
  exp: 0,
  wage: 0,
  specialties: [],
});

const designer = (power: number): Employee => ({ ...programmer(power, 'd1'), role: 'designer' });

describe('bugSuppression（エンジニアの質がバグを抑える）', () => {
  it('プログラマー不在なら抑制 0', () => {
    expect(bugSuppression([])).toBe(0);
    expect(bugSuppression([designer(1)])).toBe(0);
  });

  it('プログラマー power 合計に比例し、上限で頭打ち', () => {
    expect(bugSuppression([programmer(0.5)])).toBeCloseTo(0.5 / BUG_CONFIG.suppressCap);
    expect(bugSuppression([programmer(1), programmer(1, 'p2'), programmer(1, 'p3')])).toBe(
      BUG_CONFIG.maxSuppression,
    );
  });
});

describe('rollBugOnMiss / rollBugOnKeystroke（発生判定）', () => {
  const rate = (team: Employee[]) => {
    const rng = mulberry32(42);
    let hit = 0;
    for (let i = 0; i < 10_000; i++) if (rollBugOnKeystroke(team, rng)) hit++;
    return hit / 10_000;
  };

  it('ミス打鍵は必ずバグになる（v0.17.1 オーナー指示「入力間違えた場合はバグ」）', () => {
    expect(rollBugOnMiss()).toBe(true);
  });

  it('正打鍵のバグ化率はエンジニアがいないと基礎率どおり', () => {
    expect(rate([])).toBeCloseTo(BUG_CONFIG.onKeystrokeRate, 2);
  });

  it('エンジニアを入れると正打鍵の発生率が下がる', () => {
    expect(rate([programmer(1)])).toBeLessThan(rate([]) * 0.7);
  });
});

describe('debugWorkFor（バグが多いほどデバッグが大変）', () => {
  it('工数 = バグ数 × PHRASES_PER_BUG（線形）', () => {
    expect(debugWorkFor(0)).toBe(0);
    expect(debugWorkFor(3)).toBe(3 * BUG_CONFIG.phrasesPerBug);
    expect(debugWorkFor(10)).toBe(10 * BUG_CONFIG.phrasesPerBug);
  });
});

describe('bugsClearedByAd（v0.19 広告でバグ半減・切り上げ）', () => {
  it('残数の 50% を切り上げで駆除する', () => {
    expect(bugsClearedByAd(5)).toBe(3);
    expect(bugsClearedByAd(4)).toBe(2);
    expect(bugsClearedByAd(1)).toBe(1);
  });

  it('バグ 0（または負値の防御）なら駆除 0', () => {
    expect(bugsClearedByAd(0)).toBe(0);
    expect(bugsClearedByAd(-3)).toBe(0);
  });
});

describe('remainingBugPenalty（このまま発売の代償）', () => {
  it('残バグ 1 匹につき品質と炎上リスクが線形に増える', () => {
    expect(remainingBugPenalty(0)).toEqual({ qualityPenalty: 0, reputationRisk: 0 });
    expect(remainingBugPenalty(5)).toEqual({
      qualityPenalty: 5 * BUG_CONFIG.qualityPenaltyPerBug,
      reputationRisk: 5 * BUG_CONFIG.reputationRiskPerBug,
    });
  });
});

describe('ensureMinBugsOnDevComplete（v0.17.1 最低保証）', () => {
  it('抽選が全部外れても最低 1 匹は見つかる（まともに作ってもバグは出る）', () => {
    expect(ensureMinBugsOnDevComplete(0)).toBe(BUG_CONFIG.minBugsOnDevComplete);
  });

  it('すでに出ている分はそのまま', () => {
    expect(ensureMinBugsOnDevComplete(5)).toBe(5);
  });
});

describe('pickBugFixPhrase', () => {
  it('修正フレーズプールから決定的に選べる', () => {
    const a = pickBugFixPhrase(mulberry32(1));
    expect(BUG_FIX_PHRASES).toContain(a);
    expect(pickBugFixPhrase(mulberry32(1))).toBe(a);
  });
});
