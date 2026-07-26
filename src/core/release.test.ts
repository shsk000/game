import { afterEach, describe, expect, it } from 'vitest';
import { AXIS_QUALITY_BONUS_CAP, EQUIP_QUALITY_BONUS_CAP } from '../data/balance';
import { newCandidate } from '../data/employees';
import { SCALE_BY_ID } from '../data/scales';
import type { CurrentProject, DevAxes, Employee, Work } from '../state/types';
import { ZERO_AXES } from '../state/types';
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
  devStats: { program: 0, graphics: 0, sound: 0, design: 0 },
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
      specialties: [], skills: {},
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
  const builtProgram = () =>
    project({
      assignedEmployeeIds: ['e1'],
      devStats: { program: 100, graphics: 0, sound: 0, design: 0 },
    });

  it('装備なしと「初期装備（効果1.0）」は品質が一致する（装備枠は未装備で0）', () => {
    const bare = computeRelease(
      ctx({ employees: [worker], current: builtProgram() }),
      undefined,
      deps(),
    ).work;
    const defaultEquipped = computeRelease(
      ctx({
        employees: [
          { ...worker, equipped: { pc: 'pc-laptop', chair: 'chair-basic', misc: 'misc-none' } },
        ],
        current: builtProgram(),
      }),
      undefined,
      deps(),
    ).work;
    expect(defaultEquipped.quality).toBe(bare.quality);
  });

  it('装備した社員は、打ったカテゴリの品質が上がる（上限内）', () => {
    const bare = computeRelease(
      ctx({ employees: [worker], current: builtProgram() }),
      undefined,
      deps(),
    ).work;
    const equipped = computeRelease(
      ctx({
        employees: [{ ...worker, equipped: { pc: 'pc-gaming' } }], // program 1.35
        current: builtProgram(),
      }),
      undefined,
      deps(),
    ).work;
    expect(equipped.quality).toBeGreaterThan(bare.quality);
    // 装備以外は同一入力・同一 seed なので、差分＝装備枠のみ ≤ EQUIP_QUALITY_BONUS_CAP
    expect(equipped.quality - bare.quality).toBeLessThanOrEqual(EQUIP_QUALITY_BONUS_CAP);
  });

  it('打っていないカテゴリの装備は効かない（devStatsが0なら加点0）', () => {
    // graphics を打っていない（program だけ積んだ）状態で graphics 装備（液タブ）を付けても不変
    const bare = computeRelease(
      ctx({ employees: [worker], current: builtProgram() }),
      undefined,
      deps(),
    ).work;
    const pentab = computeRelease(
      ctx({
        employees: [{ ...worker, equipped: { misc: 'misc-pentab' } }], // graphics 1.25
        current: builtProgram(),
      }),
      undefined,
      deps(),
    ).work;
    expect(pentab.quality).toBe(bare.quality);
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

  // v0.29：ジャンル/テーマは発売で自動解放しない（解放は購入のみ）。v0.29（資料は削除済み）
  it('発売でジャンル/テーマは自動解放されない（累計売上・ヒット作が閾値を超えても不変）', () => {
    const hitWork = (id: string): Work => ({
      id,
      title: 't',
      genreId: 'puzzle',
      themeId: 'sushi',
      scale: 'mini',
      quality: 90,
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
    quality: 60,
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

describe('実装ステップ1：現行のスコア・売上が変わらないこと（ゴールデン値）', () => {
  /**
   * docs/plans/20260725-score-redesign/proposal.md 実装ステップ1 の安全弁。
   *
   * 以前ここには「power が同じならスコアが同じ」というテストがあったが、
   * それは**互換アダプタが何をしても通る恒真テスト**で、`power` の値そのものが
   * 変わってしまう回帰（採用社員の平均 power が半減）を素通しした。
   *
   * いまは**代表チームでの実売上をゴールデン値で固定**する。式でも分布でもなく、
   * プレイヤーが受け取る結果そのものを見る。ここが動いたらバランスが動いている。
   */
  const teamOf = (powers: number[]): Employee[] =>
    powers.map((power, i) => ({
      id: `e${i}`,
      name: `社員${i}`,
      role: 'programmer' as const,
      power,
      basePower: power,
      level: 1,
      exp: 0,
      wage: 540_000,
      specialties: [],
      skills: { programming: Math.round(power * 100 * 10) / 10 },
    })) as Employee[];

  const runWith = (powers: number[], scale: 'mini' | 'indie') => {
    const employees = teamOf(powers);
    const c = ctx({
      employees,
      current: project({ scale, assignedEmployeeIds: employees.map((e) => e.id) }),
    });
    return computeRelease(c, undefined, deps()).work;
  };

  it('序盤（power 0.35 × 2人・mini）の結果が変わらない', () => {
    const w = runWith([0.35, 0.35], 'mini');
    expect(w.metascore).toBe(28);
    expect(w.salesPool + w.initialRevenue).toBe(104_895);
  });

  it('中盤（power 0.76 × 3人・indie）の結果が変わらない', () => {
    const w = runWith([0.76, 0.76, 0.76], 'indie');
    expect(w.metascore).toBe(48);
    expect(w.salesPool + w.initialRevenue).toBe(104_989_500);
  });

  it('採用ガチャで出た社員でも同じ結果になる（分布と式の両方を通す）', () => {
    // ここが落ちるとき、原因は式ではなく「誰が出るか」が変わっている。
    // 実装ステップ1 の回帰（平均 power が半減）はこの経路でしか見えなかった
    const rng = mulberry32(5);
    const cand = newCandidate({ rng, now: () => 0 }, 'B');
    expect(cand.power).toBeGreaterThanOrEqual(0.2);
    expect(cand.power).toBeLessThanOrEqual(0.4);
    const totalSkill = Object.values(cand.skills ?? {}).reduce((a, b) => a + (b ?? 0), 0);
    expect(totalSkill).toBeCloseTo(cand.power * 100, 1);
  });
});

describe('序盤バランスのガード（採用 → 発売の通し）', () => {
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

  it('序盤チームの平均売上と致命的失敗率が基準から動かない', () => {
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
    // 実装ステップ1 前と同じ水準（平均メタ 29.5 / 平均売上 ¥60万台 / 致命的失敗 約49%）。
    // 回帰時は 平均メタ 27.8 / ¥40万 / 69.6% まで落ちた
    expect(metaSum / N).toBeGreaterThan(29);
    expect(sum / N).toBeGreaterThan(560_000);
    expect(fatal / N).toBeLessThan(0.55);
  });
});
