import { describe, expect, it } from 'vitest';
import { SALES_MULTIPLIER_BY_SCORE, SCALE_BALANCE, scoreTierFor } from '../data/balance';
import { getCompat } from '../data/compatibility';
import { GENRES } from '../data/genres';
import type { CurrentProject, Employee, FeaturePoints, Work } from '../state/types';
import { ZERO_AXES, ZERO_FEATURES } from '../state/types';
import { INITIAL_SHARE } from '../utils/sales';
import { computeRelease, type ReleaseCtx } from './release';
import { mulberry32 } from './ports';

/**
 * **画面に出す内訳から元の数値を再計算できることを保証する。**
 *
 * このプロジェクトの事故は全部「表示された数値が実際の計算と違う」形で起きた
 * （ローンチ広告 +50% が実効 +10%／軸「売上予測」／「開発 +0.60 LoC/秒」／「バグ率 −10%」）。
 * ここでは **`work.breakdown` に出している項だけを掛け合わせて、実際の売上とメタスコアに
 * 一致するか**を複数パターンで突き合わせる。一致しなければ、画面がプレイヤーに嘘をついている。
 */

const emp = (id: string, skills: Employee['skills'], over: Partial<Employee> = {}): Employee =>
  ({
    id,
    name: id,
    role: 'designer',
    power: 0.3,
    basePower: 0.3,
    level: 1,
    exp: 0,
    wage: 100,
    specialties: [],
    rank: 'B',
    skills,
    ...over,
  }) as Employee;

const project = (over: Partial<CurrentProject> = {}): CurrentProject =>
  ({
    title: 'テスト作品',
    genreId: 'puzzle',
    themeId: 'sushi',
    scale: 'mini',
    phase: 'release',
    axes: { ...ZERO_AXES },
    features: { ...ZERO_FEATURES },
    assignedEmployeeIds: [],
    startedAt: 0,
    finishedAt: 1_000,
    doneLoC: 12,
    workTarget: 12,
    requiredLoC: 12,
    maxCombo: 0,
    bugCount: 0,
    perf: { wpm: 60, maxCombo: 10, accuracy: 100 },
    devStats: { program: 0, graphics: 0, sound: 0, scenario: 0 },
    startDate: { year: 2026, month: 1, week: 1 },
    ...over,
  }) as CurrentProject;

const ctx = (over: Partial<ReleaseCtx> = {}): ReleaseCtx =>
  ({
    current: project(),
    employees: [],
    library: [],
    fans: 0,
    funds: 10_000_000,
    lifetimeRevenue: 0,
    unlockedScales: ['mini'],
    unlockedGenres: [],
    unlockedThemes: [],
    achievements: [],
    newlyAchieved: [],
    records: { bestMetascore: 0, bestRevenue: 0, bestCombo: 0, bestWPM: 0 },
    ghosts: {},
    trend: null,
    currentDate: { year: 2026, month: 2, week: 1 },
    ...over,
  }) as ReleaseCtx;

const deps = (seed = 1) => ({ rng: mulberry32(seed), now: () => 1_700_000_000_000 });

/** 画面の内訳から総売上を再計算する（ReleaseScreen が出している項と同じ並び） */
const recomputeRevenue = (w: Work): number => {
  const b = w.breakdown;
  return Math.round(
    (b.baseRevenue ?? 0) *
      (b.tierMul ?? 1) *
      (1 + (b.prBonus ?? 0)) *
      (1 + (b.fanBonus ?? 0)) *
      (1 + (b.pioneerBonus ?? 0)) *
      (b.axisSalesMul ?? 1) *
      (b.marketingMul ?? 1) *
      (b.trendMul ?? 1),
  );
};

/** 画面の内訳からメタスコアを再計算する */
const recomputeMetascore = (w: Work): number => {
  const b = w.breakdown;
  // 画面は小数1桁で出しているので、プレイヤーが足すのと同じ精度に揃える
  // （JS の浮動小数では 24.6+21.2+5.9+2.4+11.8 が 65.89999… になる）
  const featureSum =
    Math.round(Object.values(b.features ?? {}).reduce((a, v) => a + v, 0) * 10) / 10;
  return Math.max(
    0,
    Math.min(
      100,
      Math.round(featureSum + (b.compatBonus ?? 0) + (b.trendBonus ?? 0) + (b.criticVariance ?? 0)),
    ),
  );
};

/** 検証パターン（実際のプレイで起きうる組み合わせ） */
const PATTERNS: {
  label: string;
  features: Partial<FeaturePoints>;
  employees: Employee[];
  scale: 'mini' | 'mobile' | 'indie' | 'hit' | 'aaa';
  fans: number;
  genreId: string;
  themeId: string;
  library?: Work[];
  trend?: { genreId: string; themeId: string; expiresAt: number } | null;
  marketingAd?: boolean;
}[] = [
  {
    label: '① 序盤：入門チーム・ミニ・ファン0',
    features: { usabilityPt: 66, graphicsPt: 74, soundPt: 75, storyPt: 75, innovationPt: 100 },
    employees: [emp('a', { programming: 18 })],
    scale: 'mini',
    fans: 0,
    genreId: 'puzzle',
    themeId: 'sushi',
  },
  {
    label: '② 広報つき・ファン1万・初組合せ',
    features: { usabilityPt: 60, graphicsPt: 60, soundPt: 60, storyPt: 60, innovationPt: 100 },
    employees: [emp('a', { programming: 40 }), emp('pr', { pr: 50 }, { role: 'pr' })],
    scale: 'mobile',
    fans: 10_000,
    genreId: 'action',
    themeId: 'ninja',
  },
  {
    label: '③ トレンド両方合致＋マーケ広告',
    features: { usabilityPt: 80, graphicsPt: 80, soundPt: 40, storyPt: 40, innovationPt: 100 },
    employees: [emp('a', { graphics: 80 })],
    scale: 'indie',
    fans: 40_000,
    genreId: 'rpg',
    themeId: 'ninja',
    trend: { genreId: 'rpg', themeId: 'ninja', expiresAt: Number.MAX_SAFE_INTEGER },
    marketingAd: true,
  },
  {
    label: '④ 1文も打っていない（革新性だけ）',
    features: { innovationPt: 100 },
    employees: [emp('a', { programming: 50 })],
    scale: 'mini',
    fans: 0,
    genreId: 'horror',
    themeId: 'zombie',
  },
  {
    label: '⑤ 同じ組合せの連投（革新性が下がる）',
    features: { usabilityPt: 90, graphicsPt: 90, soundPt: 90, storyPt: 90, innovationPt: 25 },
    employees: [emp('a', { programming: 90 })],
    scale: 'hit',
    fans: 100_000,
    genreId: 'action',
    themeId: 'sushi',
  },
  {
    label: '⑥ 終盤：最強構成・AAA',
    features: { usabilityPt: 100, graphicsPt: 100, soundPt: 100, storyPt: 100, innovationPt: 100 },
    employees: [emp('a', { programming: 100 }), emp('pr', { pr: 100 }, { role: 'pr' })],
    scale: 'aaa',
    fans: 1_000_000,
    genreId: 'simulation',
    themeId: 'farming',
  },
];

describe('画面の内訳と実際の計算が一致する（複数パターン）', () => {
  const run = (p: (typeof PATTERNS)[number], seed = 3) => {
    const employees = p.employees;
    const c = ctx({
      employees,
      fans: p.fans,
      library: p.library ?? [],
      trend: (p.trend ?? null) as ReleaseCtx['trend'],
      current: project({
        scale: p.scale,
        genreId: p.genreId as CurrentProject['genreId'],
        themeId: p.themeId as CurrentProject['themeId'],
        assignedEmployeeIds: employees.map((e) => e.id),
        features: { ...ZERO_FEATURES, ...p.features },
      }),
    });
    return computeRelease(c, { marketingAd: p.marketingAd }, deps(seed)).work;
  };

  it.each(PATTERNS.map((p) => [p.label, p] as const))(
    '%s：内訳からメタスコアを再計算できる',
    (_label, p) => {
      const w = run(p);
      expect(recomputeMetascore(w)).toBe(w.metascore);
    },
  );

  it.each(PATTERNS.map((p) => [p.label, p] as const))(
    '%s：内訳から総売上を再計算できる',
    (_label, p) => {
      const w = run(p);
      expect(recomputeRevenue(w)).toBe(w.initialRevenue + w.salesPool);
    },
  );

  it.each(PATTERNS.map((p) => [p.label, p] as const))(
    '%s：初動と販売プールの分配が INITIAL_SHARE どおり',
    (_label, p) => {
      const w = run(p);
      const total = w.initialRevenue + w.salesPool;
      expect(w.initialRevenue).toBe(Math.round(total * INITIAL_SHARE));
    },
  );

  it.each(PATTERNS.map((p) => [p.label, p] as const))(
    '%s：ヒット区分の表示と倍率が一致する',
    (_label, p) => {
      const w = run(p);
      expect(w.breakdown.tier).toBe(scoreTierFor(w.metascore));
      expect(w.breakdown.tierMul).toBe(SALES_MULTIPLIER_BY_SCORE[scoreTierFor(w.metascore)]);
    },
  );

  it.each(PATTERNS.map((p) => [p.label, p] as const))(
    '%s：基準売上が規模の定義値と一致する',
    (_label, p) => {
      const w = run(p);
      expect(w.breakdown.baseRevenue).toBe(SCALE_BALANCE[p.scale].baseRevenue);
    },
  );

  it('相性補正は図鑑の相性値から導ける（プレイヤーが学習できる）', () => {
    for (const p of PATTERNS) {
      const w = run(p);
      const compat = getCompat(p.genreId as never, p.themeId as never);
      // 相性が高いほど補正が大きい（順序が一致する）
      const sign = Math.sign(compat - 1.0);
      expect(Math.sign(w.breakdown.compatBonus ?? 0), p.label).toBe(sign);
    }
  });

  it('トレンド合致がないパターンでは trendBonus が 0（効かない項は出さない）', () => {
    for (const p of PATTERNS.filter((x) => !x.trend)) {
      expect(run(p).breakdown.trendBonus, p.label).toBe(0);
    }
  });

  it('マーケティング広告を使わないパターンでは倍率が 1（表示されない）', () => {
    for (const p of PATTERNS.filter((x) => !x.marketingAd)) {
      expect(run(p).breakdown.marketingMul, p.label).toBe(1);
    }
  });
});

describe('全ジャンルで内訳が壊れない', () => {
  it('27ジャンルすべてで、内訳からメタスコアと売上を再計算できる', () => {
    for (const g of GENRES) {
      const employees = [emp('a', { programming: 50 })];
      const c = ctx({
        employees,
        current: project({
          genreId: g.id,
          assignedEmployeeIds: ['a'],
          features: {
            usabilityPt: 70,
            graphicsPt: 60,
            soundPt: 50,
            storyPt: 40,
            innovationPt: 100,
          },
        }),
      });
      const w = computeRelease(c, undefined, deps(9)).work;
      expect(recomputeMetascore(w), g.id).toBe(w.metascore);
      expect(recomputeRevenue(w), g.id).toBe(w.initialRevenue + w.salesPool);
    }
  });
});
