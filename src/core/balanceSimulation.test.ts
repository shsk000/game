import { describe, expect, it } from 'vitest';
import { scoreTierFor } from '../data/balance';
import { SCALE_BY_ID } from '../data/scales';
import type { Employee, EmployeeRole, FeaturePoints } from '../state/types';
import { DEV_SKILL_IDS } from '../state/types';
import { addFeature, featureGainFor, initialFeatures } from './features';
import { computeMetascore } from './metascore';
import { mulberry32, type Rng } from './ports';

/**
 * スコア分布のシミュレーション（docs/spec/score-model.md）。
 *
 * **「スコア帯は会社の育ちが決める」設計のガードレール。**
 * ここが落ちたら、スキル・規模係数・重み・売上倍率のどれかが分布を壊している。
 *
 * 実装ステップ3：旧 4要素品質（キャラ能力・相性・タイピング・運）から、
 * **打鍵で積んだ特徴ポイント → メタスコア**の一本道に置き換えた。
 */

const TRIALS = 500;

const emp = (id: string, role: EmployeeRole, skill: number): Employee =>
  ({
    id,
    name: id,
    role,
    power: skill / 100,
    basePower: skill / 100,
    level: 1,
    exp: 0,
    wage: 0,
    specialties: [],
    rank: 'B',
    skills: { programming: skill },
  }) as Employee;

/** 4分野をカバーしたチーム（各分野の専門家1人ずつ） */
const teamOf = (skill: number): Employee[] =>
  DEV_SKILL_IDS.map(
    (f, i) =>
      ({
        ...emp(`e${i}`, 'designer', skill),
        skills: { [f]: skill },
      }) as Employee,
  );

/** そのチームが素直に打ち切ったときの特徴ポイント */
const playThrough = (team: Employee[], scale: 'mini' | 'indie' | 'aaa'): FeaturePoints => {
  const perField = Math.max(1, Math.round((SCALE_BY_ID[scale].neededWeeks * 3) / 4));
  let f = initialFeatures([], 'puzzle', 'sushi');
  for (const field of DEV_SKILL_IDS) {
    for (let n = 0; n < perField; n++) {
      f = addFeature(f, field, featureGainFor(field, team, scale, 1.01));
    }
  }
  return f;
};

const distribution = (skill: number, scale: 'mini' | 'indie' | 'aaa') => {
  const rng: Rng = mulberry32(7);
  const team = teamOf(skill);
  const features = playThrough(team, scale);
  const scores: number[] = [];
  for (let i = 0; i < TRIALS; i++) {
    scores.push(
      computeMetascore(
        { features, genreId: 'puzzle', themeId: 'sushi', compat: 1.0, trend: null },
        rng,
      ).metascore,
    );
  }
  const rate = (min: number) => scores.filter((s) => s >= min).length / scores.length;
  return { scores, rate, mean: scores.reduce((a, b) => a + b, 0) / scores.length };
};

describe('スコア分布（会社の育ちが帯を決める）', () => {
  it('入門チーム（スキル18）でミニゲームは「普通〜ヒット」帯に収まる', () => {
    const d = distribution(18, 'mini');
    expect(d.mean).toBeGreaterThan(50);
    expect(d.mean).toBeLessThan(85);
    expect(d.rate(95), '入門で神ゲーは出ない').toBe(0);
  });

  it('育ったチーム（スキル100）は小さい規模で上限に張り付く（小さい作品は簡単でいい）', () => {
    const d = distribution(100, 'mini');
    expect(d.mean).toBeGreaterThan(90);
  });

  it('スキルが上がるほどメタスコアが上がる（単調）', () => {
    const means = [18, 40, 60, 100].map((s) => distribution(s, 'mini').mean);
    for (let i = 1; i < means.length; i++) {
      expect(means[i]).toBeGreaterThanOrEqual(means[i - 1]);
    }
    expect(means[means.length - 1]).toBeGreaterThan(means[0]);
  });

  it('大きい規模ほど同じチームでは点が出ない（規模が難易度の階段）', () => {
    expect(distribution(40, 'aaa').mean).toBeLessThan(distribution(40, 'mini').mean);
  });

  it('1文も打たなければどのチームでも致命的失敗', () => {
    const rng: Rng = mulberry32(3);
    const f = initialFeatures([], 'puzzle', 'sushi');
    for (let i = 0; i < 100; i++) {
      const m = computeMetascore(
        { features: f, genreId: 'puzzle', themeId: 'sushi', compat: 1.0, trend: null },
        rng,
      ).metascore;
      expect(scoreTierFor(m)).toBe('catastrophic');
    }
  });

  it('評価家のブレだけではヒット区分を3つまたがない（腕でも運でも帯は跳ねない）', () => {
    const d = distribution(18, 'mini');
    const tiers = new Set(d.scores.map(scoreTierFor));
    expect(tiers.size, [...tiers].join('/')).toBeLessThanOrEqual(2);
  });
});
