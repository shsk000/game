import { describe, expect, it } from 'vitest';
import { AXIS_QUALITY_BONUS_CAP } from '../data/balance';
import { SCALE_BY_ID } from '../data/scales';
import type { CurrentProject, DevAxes, Work } from '../state/types';
import { ZERO_AXES } from '../state/types';
import { INITIAL_SHARE } from '../utils/sales';
import { mulberry32 } from './ports';
import { computeRelease, type ReleaseCtx } from './release';

const NOW = 1_800_000_000_000;
const deps = (seed = 42) => ({ rng: mulberry32(seed), now: () => NOW });

const project = (over: Partial<CurrentProject> = {}): CurrentProject => ({
  title: 'テスト作品',
  genreId: 'puzzle',
  themeId: 'sushi',
  scale: 'mini',
  phase: 'release',
  axes: { ...ZERO_AXES },
  devStats: { program: 0, graphics: 0, sound: 0, design: 0 },
  requiredLoC: 100,
  doneLoC: 100,
  maxCombo: 50,
  devBoostRemainingSec: 0,
  bugCount: 0,
  startedAt: 0,
  finishedAt: 60_000, // 60 秒開発
  adBoostActive: false,
  surveyedCompat: null,
  selectedCategories: [],
  assignedEmployeeIds: [],
  perf: { wpm: 120, maxCombo: 50, accuracy: 1 },
  startDate: { year: 2026, month: 1, week: 1 },
  timeShortcutsUnlocked: [],
  workTarget: 24,
  ...over,
});

const ctx = (over: Partial<ReleaseCtx> = {}): ReleaseCtx => ({
  current: project(),
  employees: [],
  trend: { genreId: 'action', themeId: 'ninja', expiresAt: NOW + 60_000 }, // 不一致トレンド
  library: [],
  fans: 0,
  funds: 1_000_000,
  lifetimeRevenue: 0,
  ghosts: { mini: null, mobile: null, indie: null, hit: null, aaa: null },
  records: { bestMetascore: 0, bestRevenue: 0, bestCombo: 50, bestWPM: 120 },
  achievements: [],
  newlyAchieved: [],
  unlockedGenres: ['puzzle', 'adventure', 'simulation'],
  unlockedThemes: ['sushi', 'onsen', 'farming'],
  unlockedCategories: ['graphics', 'sound', 'gameplay'],
  currentDate: { year: 2026, month: 2, week: 1 }, // 開始から 4 週後
  ...over,
});

const axes = (over: Partial<DevAxes>): DevAxes => ({ ...ZERO_AXES, ...over });

describe('computeRelease', () => {
  it('同じ seed・同じ状態なら結果が完全に一致する（決定性）', () => {
    expect(computeRelease(ctx(), undefined, deps())).toEqual(
      computeRelease(ctx(), undefined, deps()),
    );
  });

  it('売上の分配：初動 = 総売上 × INITIAL_SHARE、残りが販売プール', () => {
    const { work } = computeRelease(ctx(), undefined, deps());
    const total = work.initialRevenue + work.salesPool;
    expect(work.initialRevenue).toBe(Math.round(total * INITIAL_SHARE));
    expect(work.initialSalesPool).toBe(work.salesPool);
    expect(work.totalRevenue).toBe(work.initialRevenue);
    expect(work.selling).toBe(work.salesPool > 0);
  });

  it('資金は 初動収入 − コスト調整 だけ増える', () => {
    const { work, patch } = computeRelease(ctx(), undefined, deps());
    expect(patch.funds).toBe(1_000_000 + work.initialRevenue);
    expect(patch.lifetimeRevenue).toBe(work.initialRevenue);
  });

  it('costMod 軸：+50% で開発費の半額を追加徴収', () => {
    const c = ctx({ current: project({ axes: axes({ costMod: 50 }) }) });
    const { work, patch } = computeRelease(c, undefined, deps());
    const costAdjust = Math.round(SCALE_BY_ID.mini.baseCost * 0.5);
    expect(patch.funds).toBe(1_000_000 + work.initialRevenue - costAdjust);
  });

  it('市場系軸の売上倍率は 0.5〜2.0 にクランプされる', () => {
    const base = computeRelease(ctx(), undefined, deps()).work;
    const boosted = computeRelease(
      ctx({ current: project({ axes: axes({ salesForecast: 999 }) }) }),
      undefined,
      deps(),
    ).work;
    const tanked = computeRelease(
      ctx({ current: project({ axes: axes({ reputationRisk: 999 }) }) }),
      undefined,
      deps(),
    ).work;
    const total = (w: Work) => w.initialRevenue + w.salesPool;
    // クランプの検証：どれだけ盛っても 2 倍、どれだけ下げても 0.5 倍（丸め誤差 ±2 許容）
    expect(Math.abs(total(boosted) - total(base) * 2)).toBeLessThanOrEqual(2);
    expect(Math.abs(total(tanked) - total(base) * 0.5)).toBeLessThanOrEqual(2);
  });

  it('pioneer：初組合せは true・売上ボーナス、既出の組合せは false', () => {
    const first = computeRelease(ctx(), undefined, deps()).work;
    expect(first.pioneer).toBe(true);

    const existing: Work = { ...first, id: 'prev' };
    const second = computeRelease(ctx({ library: [existing] }), undefined, deps()).work;
    expect(second.pioneer).toBe(false);
    expect(second.initialRevenue + second.salesPool).toBeLessThan(
      first.initialRevenue + first.salesPool,
    );
  });

  it('ファンは 0 未満にならない（炎上リスクを盛っても）', () => {
    const { patch } = computeRelease(
      ctx({ fans: 0, current: project({ axes: axes({ reputationRisk: 9999 }) }) }),
      undefined,
      deps(),
    );
    expect(patch.fans).toBeGreaterThanOrEqual(0);
  });

  it('developWeeks = カレンダー差分 + devWeeksDelta（下限 0）', () => {
    // 2026/1/1週 → 2026/2/1週 = 4 週
    expect(computeRelease(ctx(), undefined, deps()).work.developWeeks).toBe(4);
    const shortened = computeRelease(
      ctx({ current: project({ axes: axes({ devWeeksDelta: -2 }) }) }),
      undefined,
      deps(),
    );
    expect(shortened.work.developWeeks).toBe(2);
    const floor = computeRelease(
      ctx({ current: project({ axes: axes({ devWeeksDelta: -100 }) }) }),
      undefined,
      deps(),
    );
    expect(floor.work.developWeeks).toBe(0);
  });

  it('devStats（ビルドアップ属性）は品質を押し上げる', () => {
    const plain = computeRelease(ctx(), undefined, deps()).work;
    const built = computeRelease(
      ctx({
        current: project({ devStats: { program: 100, graphics: 100, sound: 100, design: 100 } }),
      }),
      undefined,
      deps(),
    ).work;
    expect(built.quality).toBeGreaterThan(plain.quality);
    expect(built.quality).toBeLessThanOrEqual(100);
  });

  it('breakdown.performance が設定される（v0.10 潜在バグの回帰テスト）', () => {
    // 旧実装は typingScore のまま Work.breakdown にスプレッドしていたため
    // 開封演出の「タイピング演技」寄与が常に 0 表示になっていた
    const { work } = computeRelease(ctx(), undefined, deps());
    expect(work.breakdown.performance).toBeDefined();
    expect(work.breakdown.performance).toBeGreaterThan(0);
  });

  it('records は最大値で更新される', () => {
    const { work, patch } = computeRelease(
      ctx({ records: { bestMetascore: 1, bestRevenue: 1, bestCombo: 50, bestWPM: 120 } }),
      undefined,
      deps(),
    );
    expect(patch.records.bestMetascore).toBe(Math.max(1, work.metascore));
    expect(patch.records.bestRevenue).toBe(Math.max(1, work.initialRevenue + work.salesPool));
  });

  it('初リリースで first-release 実績、ライブラリ先頭に追加、画面は release へ', () => {
    const { work, patch } = computeRelease(ctx(), undefined, deps());
    expect(patch.newlyAchieved).toContain('first-release');
    expect(patch.library[0]).toBe(work);
    expect(patch.lastReleased).toBe(work);
    expect(patch.current).toBeNull();
    expect(patch.screen).toBe('release');
  });

  it('参加社員はリリースで exp を得る（v0.16 成長システムの合流）', () => {
    const worker = {
      id: 'e1',
      name: 'テスト 花子',
      role: 'programmer' as const,
      power: 0.4,
      basePower: 0.4,
      level: 1,
      exp: 0,
      wage: 540_000,
      specialties: [],
    };
    const bystander = { ...worker, id: 'e2', name: 'テスト 次郎' };
    const c = ctx({
      employees: [worker, bystander],
      current: project({ assignedEmployeeIds: ['e1'] }),
    });
    const { patch } = computeRelease(c, undefined, deps());
    const [grown, idle] = patch.employees;
    expect(grown.exp).toBeGreaterThan(0);
    expect(idle.exp).toBe(0);
    expect(Array.isArray(patch.lastLevelUps)).toBe(true);
  });

  it('企画・イベント由来の品質ボーナスは上限で頭打ち（v0.17.1 タイピング0.15の迂回防止）', () => {
    const plain = computeRelease(ctx(), undefined, deps()).work;
    // 面白さを極端に盛っても（×0.3 で +300 相当）、品質増は AXIS_QUALITY_BONUS_CAP まで
    const boosted = computeRelease(
      ctx({ current: project({ axes: axes({ funFactor: 1000 }) }) }),
      undefined,
      deps(),
    ).work;
    expect(boosted.quality - plain.quality).toBeLessThanOrEqual(AXIS_QUALITY_BONUS_CAP);
    expect(boosted.quality).toBeGreaterThan(plain.quality);
  });

  it('残バグを抱えたまま発売すると品質が下がる（v0.17 バグシステム）', () => {
    const clean = computeRelease(ctx({ current: project({ bugCount: 0 }) }), undefined, deps());
    const buggy = computeRelease(ctx({ current: project({ bugCount: 5 }) }), undefined, deps());
    // バグゼロは noBugs ボーナス（+5）も乗るため、差は品質減点(5×2)以上になる
    expect(buggy.work.quality).toBeLessThan(clean.work.quality);
    expect(clean.work.quality - buggy.work.quality).toBeGreaterThanOrEqual(10);
  });

  it('残バグは炎上リスクとして売上にも響く', () => {
    const clean = computeRelease(ctx({ current: project({ bugCount: 0 }) }), undefined, deps());
    const buggy = computeRelease(ctx({ current: project({ bugCount: 20 }) }), undefined, deps());
    const total = (w: Work) => w.initialRevenue + w.salesPool;
    // 炎上リスク 20×2=40 → 売上倍率が 1.0 → 0.6 に低下（品質減点の影響も乗る）
    expect(total(buggy.work)).toBeLessThan(total(clean.work));
  });

  it('ゴースト（開発タイム記録）を上回ったら ghostBeaten', () => {
    const slow = computeRelease(
      ctx({ ghosts: { mini: 30, mobile: null, indie: null, hit: null, aaa: null } }),
      undefined,
      deps(),
    ).work;
    expect(slow.ghostBeaten).toBe(false); // 60 秒 > 記録 30 秒
    const fast = computeRelease(
      ctx({ ghosts: { mini: 120, mobile: null, indie: null, hit: null, aaa: null } }),
      undefined,
      deps(),
    ).work;
    expect(fast.ghostBeaten).toBe(true); // 60 秒 ≤ 記録 120 秒
  });
});
