import { afterEach, describe, expect, it } from 'vitest';
import { scoreTierFor } from '../data/balance';
import { SCALE_BY_ID } from '../data/scales';
import type { CurrentProject, DevAxes, Employee, Work, FeaturePoints } from '../state/types';
import { ZERO_AXES, ZERO_FEATURES } from '../state/types';
import { INITIAL_SHARE } from '../utils/sales';
import { setGameDeps, useGameStore } from '../state/gameStore';
import { defaultDeps, mulberry32 } from './ports';
import {
  applyLaunchAd,
  computeRelease,
  LAUNCH_AD_INITIAL_MULTIPLIER,
  type ReleaseCtx,
} from './release';

const NOW = 1_800_000_000_000;
const deps = (seed = 42) => ({ rng: mulberry32(seed), now: () => NOW });

const project = (over: Partial<CurrentProject> = {}): CurrentProject => ({
  title: 'テスト作品',
  genreId: 'puzzle',
  themeId: 'sushi',
  scale: 'mini',
  phase: 'release',
  axes: { ...ZERO_AXES },
  devStats: { program: 0, graphics: 0, sound: 0, scenario: 0 },
  requiredLoC: 100,
  doneLoC: 100,
  maxCombo: 50,
  devBoostRemainingSec: 0,
  bugCount: 0,
  adDebugUsed: false,
  startedAt: 0,
  finishedAt: 60_000, // 60 秒開発
  adBoostActive: false,
  surveyedCompat: null,
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
      ctx({ current: project({ axes: axes({ buzz: 999 }) }) }),
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



  it('残バグは炎上リスクとして売上にも響く', () => {
    const clean = computeRelease(ctx({ current: project({ bugCount: 0 }) }), undefined, deps());
    const buggy = computeRelease(ctx({ current: project({ bugCount: 20 }) }), undefined, deps());
    const total = (w: Work) => w.initialRevenue + w.salesPool;
    // 炎上リスク 20×2=40 → 売上倍率が 1.0 → 0.6 に低下（品質減点の影響も乗る）
    expect(total(buggy.work)).toBeLessThan(total(clean.work));
  });

  // === v0.25 装備システム ===
  const worker = {
    id: 'e1',
    name: 'テスト 花子',
    role: 'programmer' as const,
    power: 0.4,
    basePower: 0.4,
    level: 1,
    exp: 0,
    wage: 540_000,
    specialties: [], skills: {},
  };
  // program の devStats を積んだ状態（装備の program 倍率が効く土台）




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

  // v0.29：ジャンル/テーマは発売で自動解放しない（解放は購入のみ）。v0.29（資料は削除済み）
  it('発売でジャンル/テーマは自動解放されない（累計売上・ヒット作が閾値を超えても不変）', () => {
    const hitWork = (id: string): Work => ({
      id,
      title: 't',
      genreId: 'puzzle',
      themeId: 'sushi',
      scale: 'mini',
      metascore: 90, // ヒット作（メタ 70+）: 旧ロジックなら stage 加速で一括解放
      isMasterpiece: false,
      developSec: 1,
      initialRevenue: 0,
      salesPool: 0,
      initialSalesPool: 0,
      decayPerSec: 0,
      totalRevenue: 0,
      selling: false,
      fansGained: 0,
      ghostBeaten: false,
      launchAdUsed: false,
      pioneer: false,
      releasedAt: 0,
      createdAt: 0,
      breakdown: {},
    });
    // 累計売上 ¥2 億（旧 stage4 閾値 ¥1 億超）＋ ヒット作 5 本（旧 stage4 閾値）。
    // 旧実装ならこの発売で stage4 到達＝全ジャンル/全テーマが一括解放されていた。
    const c = ctx({
      lifetimeRevenue: 200_000_000,
      library: [hitWork('h1'), hitWork('h2'), hitWork('h3'), hitWork('h4'), hitWork('h5')],
    });
    const { patch } = computeRelease(c, undefined, deps());
    expect(patch.unlockedGenres).toEqual(c.unlockedGenres); // 初期解放のまま増えない
    expect(patch.unlockedThemes).toEqual(c.unlockedThemes);
  });
});

describe('applyLaunchAd（ローンチ広告＝発売後リワード）', () => {
  const released = (over: Partial<Work> = {}): Work => ({
    id: 'w1',
    title: 't',
    genreId: 'puzzle',
    themeId: 'sushi',
    scale: 'mini',
    metascore: 60,
    isMasterpiece: false,
    developSec: 1,
    initialRevenue: 1_000_000,
    salesPool: 4_000_000,
    initialSalesPool: 4_000_000,
    decayPerSec: 0.02,
    totalRevenue: 1_000_000,
    selling: true,
    fansGained: 0,
    ghostBeaten: false,
    launchAdUsed: false,
    pioneer: false,
    releasedAt: 0,
    createdAt: 0,
    breakdown: {},
    ...over,
  });

  it('初動売上を正確に ×1.5 する（ラベル「初動売上 +50%」どおり）', () => {
    const r = applyLaunchAd(released());
    expect(r).not.toBeNull();
    expect(r?.bonus).toBe(500_000);
    expect(r?.work.initialRevenue).toBe(1_000_000 * LAUNCH_AD_INITIAL_MULTIPLIER);
  });

  it('ボーナスは totalRevenue（入金累計）にも載る＝ライブラリ/図鑑から消えない', () => {
    const r = applyLaunchAd(released());
    expect(r?.work.totalRevenue).toBe(1_000_000 + 500_000);
  });

  it('販売プールには掛からない（オーナー判断：総売上+50%は大きすぎる）', () => {
    const r = applyLaunchAd(released());
    expect(r?.work.salesPool).toBe(4_000_000);
    expect(r?.work.initialSalesPool).toBe(4_000_000);
  });

  it('総売上に対する実効は +10%（初動シェア 20% × 50%）', () => {
    const before = released();
    const totalBefore = before.initialRevenue + before.salesPool;
    const r = applyLaunchAd(before);
    const totalAfter = (r?.work.initialRevenue ?? 0) + (r?.work.salesPool ?? 0);
    expect(totalAfter / totalBefore).toBeCloseTo(1 + INITIAL_SHARE * 0.5, 10);
  });

  it('launchAdUsed を立てる／二重適用は null で弾く', () => {
    const r = applyLaunchAd(released());
    expect(r?.work.launchAdUsed).toBe(true);
    expect(applyLaunchAd(r!.work)).toBeNull();
  });

  it('元の作品オブジェクトは書き換えない（純粋関数）', () => {
    const original = released();
    applyLaunchAd(original);
    expect(original.initialRevenue).toBe(1_000_000);
    expect(original.launchAdUsed).toBe(false);
  });
});

describe('実装ステップ3：スコアは特徴ポイントの一本道でしか動かない', () => {
  const teamOf = (skills: Employee['skills'][]): Employee[] =>
    skills.map((sk, i) => ({
      id: `e${i}`,
      name: `社員${i}`,
      role: 'programmer' as const,
      power: 0.3,
      basePower: 0.3,
      level: 1,
      exp: 0,
      wage: 540_000,
      specialties: [],
      skills: sk,
      rank: 'B' as const,
    })) as Employee[];

  const runWith = (features: Partial<FeaturePoints>, scale: 'mini' | 'indie' = 'mini') => {
    const employees = teamOf([{ programming: 50 }]);
    const c = ctx({
      employees,
      current: project({
        scale,
        assignedEmployeeIds: employees.map((e) => e.id),
        features: { ...ZERO_FEATURES, ...features },
      }),
    });
    return computeRelease(c, undefined, deps()).work;
  };

  it('1文も打たなければ致命的失敗になる（革新性ぶんしか入らない）', () => {
    // 旧実装は1文も打たずに品質72＝普通が出ていた。「打たなくても売れる」の解消が
    // このモデル再設計の出発点（docs/plans/20260725-score-redesign/proposal.md）
    const w = runWith({ innovationPt: 100 });
    expect(w.metascore).toBeLessThan(30);
    expect(scoreTierFor(w.metascore)).toBe('catastrophic');
  });

  it('特徴ポイントを積むほどメタスコアが上がる（単調）', () => {
    const scores = [0, 25, 50, 75, 100].map(
      (v) =>
        runWith({
          usabilityPt: v,
          graphicsPt: v,
          soundPt: v,
          storyPt: v,
          innovationPt: v,
        }).metascore,
    );
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeGreaterThan(scores[i - 1]);
    }
  });

  it('社員の能力そのものはスコアに直接効かない（打った結果だけが効く）', () => {
    // 社員は「打鍵1回あたりの伸び」を決めるだけ。同じ特徴ポイントなら同じスコアになる
    const features = { ...ZERO_FEATURES, graphicsPt: 60, innovationPt: 100 };
    const weak = ctx({
      employees: teamOf([{ programming: 10 }]),
      current: project({ scale: 'mini', assignedEmployeeIds: ['e0'], features }),
    });
    const strong = ctx({
      employees: teamOf([{ programming: 100 }]),
      current: project({ scale: 'mini', assignedEmployeeIds: ['e0'], features }),
    });
    expect(computeRelease(strong, undefined, deps()).work.metascore).toBe(
      computeRelease(weak, undefined, deps()).work.metascore,
    );
  });

  it('内訳の合計がメタスコアと整合する（画面の数値が計算と食い違わない）', () => {
    const w = runWith({ usabilityPt: 80, graphicsPt: 60, innovationPt: 100 });
    const bd = w.breakdown;
    const sum = Object.values(bd.features ?? {}).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(bd.base ?? 0, 1);
    const total =
      (bd.base ?? 0) + (bd.compatBonus ?? 0) + (bd.trendBonus ?? 0) + (bd.criticVariance ?? 0);
    expect(Math.max(0, Math.min(100, Math.round(total)))).toBe(w.metascore);
  });
});

describe('無打鍵で発売したときのガード（採用 → 発売の通し）', () => {
  /**
   * ガチャで実際に引いた社員で発売まで通し、**プレイヤーが受け取る結果**を固定する。
   *
   * 上のゴールデン値テストは power を直接渡すので、「式は同じだが入力の分布が変わった」
   * 事故（実装ステップ1 の回帰）では落ちない。ここは**本番の入口（`pullGacha`）から**
   * 採用して通すので落ちる（lessons #16：ガードは本番が実際に呼ぶ入口から通す）。
   *
   * 序盤（社員2人・ミニゲーム）はメタスコアがヒット区分の境界（29/30）付近に居るため、
   * 採用が少し弱くなるだけで 失敗 ×3.333 → 致命的失敗 ×0.333 に落ちて売上が桁で変わる。
   * ゲーム開始時の社員は0人なので、全プレイヤーが必ずここを通る。
   */
  afterEach(() => {
    setGameDeps(defaultDeps);
    useGameStore.setState({ candidate: null, gachaPity: 0 });
  });

  /** 本番の入口（pullGacha）から社員を2人引く */
  const hireTwoViaStore = (): Employee[] => {
    const out: Employee[] = [];
    for (let k = 0; k < 2; k++) {
      useGameStore.setState({ funds: 1e12, gachaPity: 0, candidate: null });
      useGameStore.getState().pullGacha('normal');
      const c = useGameStore.getState().candidate;
      if (c) out.push({ ...c, id: `e${k}` } as Employee);
    }
    return out;
  };

  it('1文も打たずに発売すると、ほぼ確実に致命的失敗になる', () => {
    setGameDeps({ rng: mulberry32(101), now: () => 0 });
    let sum = 0;
    let metaSum = 0;
    let fatal = 0;
    const N = 2_000;
    for (let i = 0; i < N; i++) {
      const employees = hireTwoViaStore();
      const c = ctx({
        employees,
        current: project({ scale: 'mini', assignedEmployeeIds: employees.map((e) => e.id) }),
      });
      const w = computeRelease(c, undefined, deps()).work;
      sum += w.salesPool + w.initialRevenue;
      metaSum += w.metascore;
      if (w.metascore <= 29) fatal += 1;
    }
    // 実装ステップ3：スコアは特徴ポイントで決まる。このガードは**1文も打たずに発売した場合**を
    // 測っているので、致命的失敗が出るのが正しい（旧モデルは打たなくても品質72が出ていた）。
    // 実際に打った場合のバランスは progressionSimulation / solvencySimulation で見る。
    console.log(
      `[序盤・無打鍵] 平均メタ ${(metaSum / N).toFixed(1)} / 平均売上 ¥${Math.round(sum / N).toLocaleString()} / 致命的失敗 ${((fatal / N) * 100).toFixed(1)}%`,
    );
    expect(metaSum / N).toBeLessThan(30);
    expect(fatal / N).toBeGreaterThan(0.9);
  });
});
