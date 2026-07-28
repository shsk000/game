import { describe, expect, it } from 'vitest';
import type { CurrentProject, Employee, Work } from '../state/types';
import { ZERO_AXES, ZERO_FEATURES } from '../state/types';
import { INITIAL_SHARE } from '../utils/sales';
import { bugsClearedByAd } from './bugs';
import { mulberry32 } from './ports';
import {
  applyLaunchAd,
  computeRelease,
  LAUNCH_AD_INITIAL_MULTIPLIER,
  type ReleaseCtx,
} from './release';

/**
 * **広告の効果が画面のラベルどおりかを突き合わせる。**
 *
 * このプロジェクトの出発点は「ローンチ広告 売上+50% と書いてあるのに実効 +10% だった」。
 * 広告は収益の柱（game-design §2）なので、**ラベルと実装が食い違うのが最も致命的**。
 * ここでは4種すべてについて、画面の文言と実装の式を1対1で検証する。
 *
 * | 広告 | 画面のラベル | 実装 |
 * |---|---|---|
 * | ローンチ広告 | 初動売上 +50% | `applyLaunchAd`（初動 ×1.5） |
 * | マーケティング広告 | 売上 +10% | `computeRelease` の `marketingMul` 1.1 |
 * | デバッグ応援 | 半分まとめて駆除 | `bugsClearedByAd`（切り上げ） |
 * | 市場調査 | 相性を開示 | 表示のみ（数値は変えない） |
 */

const emp = (id: string, skills: Employee['skills']): Employee =>
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
  }) as Employee;

const project = (over: Partial<CurrentProject> = {}): CurrentProject =>
  ({
    title: 'テスト',
    genreId: 'puzzle',
    themeId: 'sushi',
    scale: 'mini',
    phase: 'release',
    axes: { ...ZERO_AXES },
    features: {
      ...ZERO_FEATURES,
      usabilityPt: 70,
      graphicsPt: 70,
      soundPt: 70,
      storyPt: 70,
      innovationPt: 100,
    },
    assignedEmployeeIds: ['a'],
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
    employees: [emp('a', { programming: 40 })],
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

const deps = () => ({ rng: mulberry32(4), now: () => 1_700_000_000_000 });

describe('📺 マーケティング広告（ラベル：売上 +10%）', () => {
  it('総売上がちょうど 1.1 倍になる', () => {
    const without = computeRelease(ctx(), undefined, deps()).work;
    const withAd = computeRelease(ctx(), { marketingAd: true }, deps()).work;
    const totalOf = (w: Work) => w.initialRevenue + w.salesPool;
    expect(totalOf(withAd) / totalOf(without)).toBeCloseTo(1.1, 2);
  });

  it('メタスコアは変わらない（広告でスコアは買えない）', () => {
    const without = computeRelease(ctx(), undefined, deps()).work;
    const withAd = computeRelease(ctx(), { marketingAd: true }, deps()).work;
    expect(withAd.metascore).toBe(without.metascore);
  });

  it('内訳に倍率が出る（画面の数値と実装が一致する）', () => {
    expect(computeRelease(ctx(), { marketingAd: true }, deps()).work.breakdown.marketingMul).toBe(
      1.1,
    );
    expect(computeRelease(ctx(), undefined, deps()).work.breakdown.marketingMul).toBe(1);
  });
});

describe('📺 ローンチ広告（ラベル：初動売上 +50%）', () => {
  const released = (): Work =>
    computeRelease(ctx(), undefined, deps()).work;

  it('初動売上がちょうど 1.5 倍になる', () => {
    const w = released();
    const before = w.initialRevenue;
    const r = applyLaunchAd(w);
    expect(r).not.toBeNull();
    expect(r?.work.initialRevenue).toBe(Math.round(before * LAUNCH_AD_INITIAL_MULTIPLIER));
  });

  it('販売プールには掛からない（「総売上 +50%」ではない）', () => {
    const w = released();
    const r = applyLaunchAd(w);
    expect(r?.work.salesPool).toBe(w.salesPool);
  });

  it('総売上に対する実効は +10%（初動シェア 20% × 50%）', () => {
    const w = released();
    const totalBefore = w.initialRevenue + w.salesPool;
    const r = applyLaunchAd(w);
    const totalAfter = (r?.work.initialRevenue ?? 0) + (r?.work.salesPool ?? 0);
    const effective = totalAfter / totalBefore - 1;
    expect(effective).toBeCloseTo(INITIAL_SHARE * (LAUNCH_AD_INITIAL_MULTIPLIER - 1), 3);
    expect(effective).toBeCloseTo(0.1, 2);
  });

  it('ボーナスは累計売上にも載る（ライブラリや図鑑から消えない）', () => {
    const w = released();
    const r = applyLaunchAd(w);
    expect(r?.work.totalRevenue).toBeGreaterThan(w.totalRevenue);
    expect(r?.bonus).toBe((r?.work.initialRevenue ?? 0) - w.initialRevenue);
  });

  it('二重適用できない', () => {
    const w = released();
    const first = applyLaunchAd(w);
    expect(applyLaunchAd(first!.work)).toBeNull();
  });
});

describe('📺 デバッグ応援広告（ラベル：まとめて駆除）', () => {
  it('残バグの半分（切り上げ）を駆除する', () => {
    expect(bugsClearedByAd(10)).toBe(5);
    expect(bugsClearedByAd(7)).toBe(4);
    expect(bugsClearedByAd(1)).toBe(1);
  });

  it('バグ0なら何も起きない（広告を無駄打ちさせない）', () => {
    expect(bugsClearedByAd(0)).toBe(0);
  });

  it('必ず1匹以上減る（見たのに変化なしにならない）', () => {
    for (let n = 1; n <= 50; n++) expect(bugsClearedByAd(n)).toBeGreaterThanOrEqual(1);
  });

  it('全部は消えない（デバッグフェーズが無意味にならない）', () => {
    for (let n = 2; n <= 50; n++) expect(bugsClearedByAd(n)).toBeLessThan(n);
  });
});

describe('広告は「見なくても進める」（game-design §2 の絶対原則）', () => {
  it('広告なしでも売上は出る（人質になっていない）', () => {
    const w = computeRelease(ctx(), undefined, deps()).work;
    expect(w.initialRevenue + w.salesPool).toBeGreaterThan(0);
  });

  it('広告ありの得は 1.3〜2 倍に収まる（壊れる強さではない）', () => {
    const base = computeRelease(ctx(), undefined, deps()).work;
    const withMarketing = computeRelease(ctx(), { marketingAd: true }, deps()).work;
    const withBoth = applyLaunchAd(withMarketing)!.work;
    const totalOf = (w: Work) => w.initialRevenue + w.salesPool;
    const ratio = totalOf(withBoth) / totalOf(base);
    expect(ratio).toBeGreaterThan(1);
    expect(ratio, '全部見ても2倍を超えない').toBeLessThan(2);
  });
});
