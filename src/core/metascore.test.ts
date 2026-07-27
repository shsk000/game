import { describe, expect, it } from 'vitest';
import { METASCORE } from '../data/balance';
import { GENRES } from '../data/genres';
import type { FeaturePoints } from '../state/types';
import { ZERO_FEATURES } from '../state/types';
import { compatBonusFor, computeMetascore, criticVarianceFor, trendBonusFor } from './metascore';
import { mulberry32 } from './ports';

/** ブレ 0 の rng（式そのものを見るため） */
const noVariance = () => 0.5;

const full: FeaturePoints = {
  usabilityPt: 100,
  graphicsPt: 100,
  soundPt: 100,
  storyPt: 100,
  innovationPt: 100,
};

describe('computeMetascore（特徴ポイント → メタスコア）', () => {
  it('全部100・相性中央・トレンドなしなら 100', () => {
    const r = computeMetascore(
      { features: full, genreId: 'action', themeId: 'ninja', compat: 1.0 },
      noVariance,
    );
    expect(r.base).toBe(100);
    expect(r.metascore).toBe(100);
  });

  it('1文も打たなければ革新性ぶんだけ（＝致命的失敗になる）', () => {
    // 現行は1文も打たずに品質72が出ていた。新式では革新性の重み（○=0.12前後）ぶんしか入らない
    const r = computeMetascore(
      {
        features: { ...ZERO_FEATURES, innovationPt: 100 },
        genreId: 'action',
        themeId: 'ninja',
        compat: 1.0,
      },
      noVariance,
    );
    expect(r.metascore).toBeLessThan(30);
  });

  it('ジャンルによって効く特徴ポイントが変わる', () => {
    // ホラー（物語型：🎵📖が◎）はサウンド寄りの作品が伸び、
    // アクション型（🕹🎨が◎）は操作性寄りが伸びる
    const soundy: FeaturePoints = { ...ZERO_FEATURES, soundPt: 100, storyPt: 100 };
    const actiony: FeaturePoints = { ...ZERO_FEATURES, usabilityPt: 100, graphicsPt: 100 };
    const horrorSound = computeMetascore(
      { features: soundy, genreId: 'horror', themeId: 'ninja', compat: 1 },
      noVariance,
    ).base;
    const horrorAction = computeMetascore(
      { features: actiony, genreId: 'horror', themeId: 'ninja', compat: 1 },
      noVariance,
    ).base;
    expect(horrorSound).toBeGreaterThan(horrorAction);

    const actionSound = computeMetascore(
      { features: soundy, genreId: 'action', themeId: 'ninja', compat: 1 },
      noVariance,
    ).base;
    const actionAction = computeMetascore(
      { features: actiony, genreId: 'action', themeId: 'ninja', compat: 1 },
      noVariance,
    ).base;
    expect(actionAction).toBeGreaterThan(actionSound);
  });

  it('内訳の合計が base と一致する（表示と計算が食い違わない）', () => {
    const r = computeMetascore(
      { features: full, genreId: 'rpg', themeId: 'sushi', compat: 1.4 },
      noVariance,
    );
    const sum = Object.values(r.contributions).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(r.base, 1);
  });

  it('0〜100 にクランプされる', () => {
    const over = computeMetascore(
      { features: full, genreId: 'action', themeId: 'ninja', compat: 2.0, trend: { genreId: 'action', themeId: 'ninja' } },
      () => 1,
    );
    expect(over.metascore).toBe(100);

    const under = computeMetascore(
      { features: ZERO_FEATURES, genreId: 'action', themeId: 'ninja', compat: 0.7 },
      () => 0,
    );
    expect(under.metascore).toBe(0);
  });

  it('同じ seed なら結果が完全に一致する（決定性）', () => {
    const input = { features: full, genreId: 'rpg' as const, themeId: 'ninja' as const, compat: 1.2 };
    const a = computeMetascore(input, mulberry32(7));
    const b = computeMetascore(input, mulberry32(7));
    expect(a).toEqual(b);
  });
});

describe('compatBonusFor（相性 → 点）', () => {
  it('相性が中央なら ±0、上限下限は ±8', () => {
    expect(compatBonusFor(METASCORE.compat.center)).toBe(0);
    expect(compatBonusFor(2.0)).toBe(8);
    expect(compatBonusFor(0.7)).toBeCloseTo(-2.4, 1);
  });

  it('相性が高いほど加点が大きい（単調）', () => {
    const vals = [0.7, 1.0, 1.4, 2.0].map(compatBonusFor);
    for (let i = 1; i < vals.length; i++) expect(vals[i]).toBeGreaterThan(vals[i - 1]);
  });

  it('±8 を超えない', () => {
    expect(compatBonusFor(99)).toBe(8);
    expect(compatBonusFor(-99)).toBe(-8);
  });
});

describe('trendBonusFor（トレンド合致）', () => {
  it('両方合致で +10、片方で +5、なしで 0', () => {
    expect(trendBonusFor('action', 'ninja', { genreId: 'action', themeId: 'ninja' })).toBe(10);
    expect(trendBonusFor('action', 'ninja', { genreId: 'action', themeId: 'sushi' })).toBe(5);
    expect(trendBonusFor('action', 'ninja', { genreId: 'rpg', themeId: 'sushi' })).toBe(0);
    expect(trendBonusFor('action', 'ninja', null)).toBe(0);
  });
});

describe('criticVarianceFor（評価家のブレ）', () => {
  it('±5 に収まる', () => {
    const rng = mulberry32(3);
    for (let i = 0; i < 1000; i++) {
      const v = criticVarianceFor(rng);
      expect(Math.abs(v)).toBeLessThanOrEqual(METASCORE.variance);
    }
  });

  it('ヒット区分をまたぐほどの幅は持たない（上位の区分は5〜10点幅）', () => {
    expect(METASCORE.variance * 2).toBeLessThanOrEqual(10);
  });
});

describe('全ジャンルで式が壊れない', () => {
  it('27ジャンルすべてで 0〜100 の値が出る', () => {
    for (const g of GENRES) {
      const r = computeMetascore(
        { features: full, genreId: g.id, themeId: 'ninja', compat: 1 },
        noVariance,
      );
      expect(r.metascore, g.id).toBeGreaterThanOrEqual(0);
      expect(r.metascore, g.id).toBeLessThanOrEqual(100);
    }
  });

  it('全部100ならどのジャンルでも base が 100（正規化が効いている）', () => {
    for (const g of GENRES) {
      const r = computeMetascore(
        { features: full, genreId: g.id, themeId: 'ninja', compat: 1 },
        noVariance,
      );
      expect(r.base, g.id).toBeCloseTo(100, 1);
    }
  });
});
