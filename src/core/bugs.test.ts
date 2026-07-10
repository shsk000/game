import { describe, expect, it } from 'vitest';
import { BUG_CONFIG } from '../data/balance';
import type { Employee } from '../state/types';
import {
  BUG_FIX_PHRASES,
  bugSuppression,
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

describe('rollBugOnMiss / rollBugOnPhrase（発生率）', () => {
  const rate = (roll: (e: Employee[], rng: () => number) => boolean, team: Employee[]) => {
    const rng = mulberry32(42);
    let hit = 0;
    for (let i = 0; i < 10_000; i++) if (roll(team, rng)) hit++;
    return hit / 10_000;
  };

  it('バグ化率はエンジニアがいないと基礎率どおり（ミス/正打鍵）', () => {
    expect(rate(rollBugOnMiss, [])).toBeCloseTo(BUG_CONFIG.onMissRate, 1);
    expect(rate(rollBugOnKeystroke, [])).toBeCloseTo(BUG_CONFIG.onKeystrokeRate, 2);
  });

  it('エンジニアを入れると発生率が下がる', () => {
    const noEng = rate(rollBugOnMiss, []);
    const withEng = rate(rollBugOnMiss, [programmer(1)]);
    expect(withEng).toBeLessThan(noEng * 0.7);
  });
});

describe('debugWorkFor（バグが多いほどデバッグが大変）', () => {
  it('工数 = バグ数 × PHRASES_PER_BUG（線形）', () => {
    expect(debugWorkFor(0)).toBe(0);
    expect(debugWorkFor(3)).toBe(3 * BUG_CONFIG.phrasesPerBug);
    expect(debugWorkFor(10)).toBe(10 * BUG_CONFIG.phrasesPerBug);
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
