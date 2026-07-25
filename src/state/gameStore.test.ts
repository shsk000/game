import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mulberry32 } from '../core/ports';
import { BUG_CONFIG, GACHA_CONFIG } from '../data/balance';
import { SCALE_BY_ID } from '../data/scales';
import { setGameDeps, useGameStore } from './gameStore';
import { resetStore } from './testing';
import type { CurrentProject, Work } from './types';
import { ZERO_AXES } from './types';

const devProject = (over: Partial<CurrentProject> = {}): CurrentProject => ({
  title: 'テスト',
  genreId: 'puzzle',
  themeId: 'sushi',
  scale: 'mini',
  phase: 'development',
  axes: { ...ZERO_AXES },
  devStats: { program: 0, graphics: 0, sound: 0, design: 0 },
  requiredLoC: 100,
  doneLoC: 24,
  maxCombo: 0,
  devBoostRemainingSec: 0,
  bugCount: 0,
  adDebugUsed: false,
  startedAt: 0,
  finishedAt: null,
  adBoostActive: false,
  surveyedCompat: null,
  selectedCategories: [],
  assignedEmployeeIds: [],
  perf: { wpm: 100, maxCombo: 0, accuracy: 1 },
  startDate: { year: 2026, month: 1, week: 1 },
  timeShortcutsUnlocked: [],
  workTarget: 24,
  ...over,
});

describe('advancePhase（v0.17.1 バグ最低保証）', () => {
  beforeEach(() => resetStore());

  it('開発→テスト遷移でバグ 0 でも最低保証ぶんが見つかる', () => {
    resetStore({ current: devProject({ bugCount: 0 }) });
    useGameStore.getState().advancePhase();
    const cur = useGameStore.getState().current;
    expect(cur?.phase).toBe('testing');
    expect(cur?.bugCount).toBe(BUG_CONFIG.minBugsOnDevComplete);
  });

  it('すでに出ているバグは減らない', () => {
    resetStore({ current: devProject({ bugCount: 4 }) });
    useGameStore.getState().advancePhase();
    expect(useGameStore.getState().current?.bugCount).toBe(4);
  });

  it('テスト→デバッグ遷移では保証を適用しない（修正済みが復活しない）', () => {
    resetStore({ current: devProject({ phase: 'testing', bugCount: 2 }) });
    useGameStore.getState().advancePhase();
    const cur = useGameStore.getState().current;
    expect(cur?.phase).toBe('debugging');
    expect(cur?.bugCount).toBe(2);
  });
});

describe('finishDevelopment（DEV検証フック：タイピングを飛ばし発売へ即到達）', () => {
  beforeEach(() => resetStore());

  it('企画フェーズからでも発売フェーズへ飛び、doneLoC が作業目標まで埋まる', () => {
    resetStore({ current: devProject({ phase: 'planning', workTarget: 100, doneLoC: 10 }) });
    useGameStore.getState().finishDevelopment();
    const s = useGameStore.getState();
    expect(s.current?.phase).toBe('release');
    expect(s.current?.doneLoC).toBe(100);
    expect(s.current?.finishedAt).not.toBeNull();
    expect(s.screen).toBe('release');
  });

  it('プロジェクトが無ければ何もしない（発売に飛ばない）', () => {
    resetStore({ current: null });
    useGameStore.getState().finishDevelopment();
    expect(useGameStore.getState().current).toBeNull();
    expect(useGameStore.getState().screen).not.toBe('release');
  });
});

describe('devSkipDevelopment（DEV検証フック：平均成績で“それなり品質”発売へ）', () => {
  beforeEach(() => resetStore());

  it('企画フェーズからでも発売へ飛び、perf/devStats が平均成績で埋まる', () => {
    resetStore({
      current: devProject({
        phase: 'planning',
        workTarget: 100,
        doneLoC: 10,
        perf: { wpm: 0, maxCombo: 0, accuracy: 1 },
        devStats: { program: 0, graphics: 0, sound: 0, design: 0 },
      }),
    });
    useGameStore.getState().devSkipDevelopment();
    const s = useGameStore.getState();
    expect(s.current?.phase).toBe('release');
    expect(s.current?.doneLoC).toBe(100);
    expect(s.screen).toBe('release');
    // 品質のもと（perf / devStats）が 0 のままでない＝“それなり品質”で発売できる
    expect(s.current?.perf.wpm).toBeGreaterThan(0);
    expect(s.current?.perf.maxCombo).toBeGreaterThan(0);
    const st = s.current?.devStats;
    expect((st?.program ?? 0) + (st?.graphics ?? 0) + (st?.sound ?? 0) + (st?.design ?? 0)).toBeGreaterThan(0);
  });

  it('プロジェクトが無ければ何もしない（発売に飛ばない）', () => {
    resetStore({ current: null });
    useGameStore.getState().devSkipDevelopment();
    expect(useGameStore.getState().current).toBeNull();
    expect(useGameStore.getState().screen).not.toBe('release');
  });
});

describe('startProject（前払い開発費 devCost の徴収）', () => {
  beforeEach(() => {
    resetStore();
    setGameDeps({ rng: () => 0.5, now: () => 1_000_000 });
  });

  it('企画開始で規模の devCost が funds から引かれる', () => {
    resetStore({ funds: 5_000_000, current: null });
    useGameStore.getState().startProject('puzzle', 'sushi', 'mini');
    const s = useGameStore.getState();
    expect(s.funds).toBe(5_000_000 - SCALE_BY_ID.mini.baseCost);
    expect(s.current?.phase).toBe('planning');
    expect(s.debt).toBe(0);
  });

  it('資金不足なら不足分が借金へ振替される（funds は 0 下げ止まり）', () => {
    resetStore({ funds: 100_000, current: null });
    useGameStore.getState().startProject('puzzle', 'sushi', 'mini');
    const s = useGameStore.getState();
    expect(s.funds).toBe(0);
    expect(s.debt).toBe(SCALE_BY_ID.mini.baseCost - 100_000);
  });
});

describe('buyGenre / buyTheme（投資：未解放ジャンル・テーマの先行購入）', () => {
  beforeEach(() => resetStore());

  it('ロック済みジャンルを購入すると price 分 funds が減り解放される', () => {
    resetStore({ funds: 1_000_000 });
    expect(useGameStore.getState().unlockedGenres).not.toContain('racing'); // stage2=初期未解放
    expect(useGameStore.getState().buyGenre('racing')).toBe(true);
    const s = useGameStore.getState();
    expect(s.funds).toBe(1_000_000 - 300_000); // stage2 基礎額 ¥30万 × 1.8^0
    expect(s.unlockedGenres).toContain('racing');
    expect(s.investPurchaseCount).toBe(1);
  });

  it('ロック済みテーマを購入すると price 分 funds が減り解放される', () => {
    resetStore({ funds: 1_000_000 });
    expect(useGameStore.getState().unlockedThemes).not.toContain('animal');
    expect(useGameStore.getState().buyTheme('animal')).toBe(true);
    const s = useGameStore.getState();
    expect(s.funds).toBe(1_000_000 - 300_000);
    expect(s.unlockedThemes).toContain('animal');
    expect(s.investPurchaseCount).toBe(1);
  });

  it('資金不足なら購入不可（false・状態不変）', () => {
    resetStore({ funds: 100_000 });
    expect(useGameStore.getState().buyGenre('racing')).toBe(false);
    const s = useGameStore.getState();
    expect(s.funds).toBe(100_000);
    expect(s.unlockedGenres).not.toContain('racing');
    expect(s.investPurchaseCount).toBe(0);
  });

  it('初期解放済み（stage1）は購入不可（false・二重課金しない）', () => {
    resetStore({ funds: 10_000_000 });
    expect(useGameStore.getState().buyGenre('puzzle')).toBe(false);
    expect(useGameStore.getState().buyTheme('sushi')).toBe(false);
    expect(useGameStore.getState().funds).toBe(10_000_000);
  });

  it('連続購入で価格が逓増する（×priceGrowth^purchaseCount）', () => {
    resetStore({ funds: 5_000_000 });
    expect(useGameStore.getState().buyGenre('racing')).toBe(true); // ¥30万（count 0）
    expect(useGameStore.getState().buyTheme('animal')).toBe(true); // ¥30万 ×1.8 = ¥54万（count 1）
    const s = useGameStore.getState();
    expect(s.investPurchaseCount).toBe(2);
    expect(s.funds).toBe(5_000_000 - 300_000 - 540_000);
  });
});

describe('adDebugAssist（v0.19 広告でバグ半減・1開発1回）', () => {
  beforeEach(() => resetStore());

  it('バグ残数の 50%（切り上げ）を即駆除し、使用済みになる', () => {
    resetStore({ current: devProject({ phase: 'debugging', bugCount: 5 }) });
    expect(useGameStore.getState().adDebugAssist()).toBe(true);
    const cur = useGameStore.getState().current;
    expect(cur?.bugCount).toBe(2); // 5 - ceil(5/2)=3
    expect(cur?.adDebugUsed).toBe(true);
  });

  it('1開発1回：2回目は false でバグは減らない', () => {
    resetStore({ current: devProject({ phase: 'debugging', bugCount: 8 }) });
    expect(useGameStore.getState().adDebugAssist()).toBe(true);
    expect(useGameStore.getState().current?.bugCount).toBe(4);
    expect(useGameStore.getState().adDebugAssist()).toBe(false);
    expect(useGameStore.getState().current?.bugCount).toBe(4);
  });

  it('バグ 0 のときは false（使用済みにもならない）', () => {
    resetStore({ current: devProject({ phase: 'debugging', bugCount: 0 }) });
    expect(useGameStore.getState().adDebugAssist()).toBe(false);
    expect(useGameStore.getState().current?.adDebugUsed).toBe(false);
  });

  it('プロジェクトが無ければ false', () => {
    resetStore({ current: null });
    expect(useGameStore.getState().adDebugAssist()).toBe(false);
  });
});

describe('採用ガチャ（v0.22）', () => {
  const setDeterministicDeps = (seed: number) =>
    setGameDeps({ rng: mulberry32(seed), now: () => 1_000_000 });

  afterEach(() => {
    // 他テストへ本番 deps の漏れを防ぐ
    setGameDeps({ rng: Math.random, now: () => Date.now() });
  });

  it('pullGacha(normal)：資金がガチャ料分だけ減り、候補が出現する', () => {
    setDeterministicDeps(1);
    const price = GACHA_CONFIG.normal.priceByScale.mini;
    resetStore({ funds: price + 100, unlockedScales: ['mini'], candidate: null, gachaPity: 0 });
    expect(useGameStore.getState().pullGacha('normal')).toBe(true);
    expect(useGameStore.getState().funds).toBe(100);
    expect(useGameStore.getState().candidate).not.toBeNull();
  });

  it('pullGacha(normal)：S は絶対に出ず、pity も動かさない', () => {
    // rng を常に 0（本来 S 判定）に固定してもノーマルは S=0 なので S にならない
    setGameDeps({ rng: () => 0, now: () => 1_000_000 });
    resetStore({ funds: 100_000_000, unlockedScales: ['mini'], candidate: null, gachaPity: 3 });
    for (let i = 0; i < 10; i++) {
      useGameStore.getState().pullGacha('normal');
      expect(useGameStore.getState().candidate?.rank).not.toBe('S');
    }
    expect(useGameStore.getState().gachaPity).toBe(3); // ノーマルは pity 不変
  });

  it('pullGacha(premium)：資金がガチャ料未満なら false・状態不変（序盤は引けない）', () => {
    setDeterministicDeps(1);
    const price = GACHA_CONFIG.premium.priceByScale.mini;
    // 初期資金相当だと premium は引けない
    resetStore({ funds: price - 1, unlockedScales: ['mini'], candidate: null });
    expect(useGameStore.getState().pullGacha('premium')).toBe(false);
    expect(useGameStore.getState().funds).toBe(price - 1);
    expect(useGameStore.getState().candidate).toBeNull();
  });

  it('pullGacha(premium)：S 排出でピティが 0 リセット、非 S で +1', () => {
    setDeterministicDeps(1);
    resetStore({ funds: 1_000_000_000, unlockedScales: ['mini'], candidate: null, gachaPity: 5 });
    useGameStore.getState().pullGacha('premium');
    const rank = useGameStore.getState().candidate?.rank;
    const pity = useGameStore.getState().gachaPity;
    if (rank === 'S') expect(pity).toBe(0);
    else expect(pity).toBe(6);
  });

  it('dismissCandidate：候補が消え、資金は返らない', () => {
    setDeterministicDeps(1);
    const price = GACHA_CONFIG.normal.priceByScale.mini;
    resetStore({ funds: price + 500, unlockedScales: ['mini'], candidate: null });
    useGameStore.getState().pullGacha('normal');
    const fundsAfterPull = useGameStore.getState().funds;
    useGameStore.getState().dismissCandidate();
    expect(useGameStore.getState().candidate).toBeNull();
    expect(useGameStore.getState().funds).toBe(fundsAfterPull); // 返金なし
  });

  it('hireCandidate：初月給が引かれ社員が増え、候補は消える', () => {
    setDeterministicDeps(1);
    resetStore({ funds: 10_000_000, unlockedScales: ['mini'], candidate: null, employees: [] });
    useGameStore.getState().pullGacha('normal');
    const cand = useGameStore.getState().candidate;
    expect(cand).not.toBeNull();
    const fundsBeforeHire = useGameStore.getState().funds;
    expect(useGameStore.getState().hireCandidate()).toBe(true);
    expect(useGameStore.getState().employees.length).toBe(1);
    expect(useGameStore.getState().funds).toBe(fundsBeforeHire - (cand?.wage ?? 0));
    expect(useGameStore.getState().candidate).toBeNull();
  });

  it('premium 天井連続 S 非排出→次で S 確定（ピティが実 store で機能する）', () => {
    // rng を常に 0.99（本来 B）に固定
    setGameDeps({ rng: () => 0.99, now: () => 1_000_000 });
    const th = GACHA_CONFIG.premium.pityThreshold;
    resetStore({
      funds: 1_000_000_000_000,
      unlockedScales: ['aaa'],
      candidate: null,
      gachaPity: 0,
    });
    for (let i = 0; i < th; i++) {
      useGameStore.getState().pullGacha('premium');
      expect(useGameStore.getState().candidate?.rank).toBe('B');
    }
    expect(useGameStore.getState().gachaPity).toBe(th);
    useGameStore.getState().pullGacha('premium');
    expect(useGameStore.getState().candidate?.rank).toBe('S');
    expect(useGameStore.getState().gachaPity).toBe(0);
  });
});

describe('applyLaunchAd（ローンチ広告を store 経由で適用）', () => {
  beforeEach(() => resetStore());

  /** 発売済み作品を 1 本仕込む（初動 ¥100万 / プール ¥400万） */
  const seedReleased = (over: Partial<Work> = {}): Work => {
    const w: Work = {
      id: 'w1',
      title: 'テスト作',
      genreId: 'puzzle',
      themeId: 'sushi',
      scale: 'mini',
      quality: 60,
      metascore: 60,
      isMasterpiece: false,
      developSec: 60,
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
    };
    resetStore({ funds: 10_000_000, lifetimeRevenue: 1_000_000, library: [w], lastReleased: w });
    return w;
  };

  it('初動 ×1.5 のボーナスを funds / lifetimeRevenue / totalRevenue に同額載せる', () => {
    seedReleased();
    const bonus = useGameStore.getState().applyLaunchAd();
    expect(bonus).toBe(500_000);
    const s = useGameStore.getState();
    expect(s.funds).toBe(10_000_000 + 500_000);
    expect(s.lifetimeRevenue).toBe(1_000_000 + 500_000);
    expect(s.lastReleased?.initialRevenue).toBe(1_500_000);
    expect(s.lastReleased?.totalRevenue).toBe(1_500_000);
  });

  it('library の同一作品も差し替わる（累計表示にボーナスが載る）', () => {
    seedReleased();
    useGameStore.getState().applyLaunchAd();
    const inLib = useGameStore.getState().library.find((w) => w.id === 'w1');
    expect(inLib?.initialRevenue).toBe(1_500_000);
    expect(inLib?.totalRevenue).toBe(1_500_000);
    expect(inLib?.launchAdUsed).toBe(true);
  });

  it('販売で積み上がった売上を巻き戻さない（lastReleased は tickSales で更新されない）', () => {
    seedReleased();
    // 販売を進める＝library 側だけ totalRevenue が増え salesPool が減る
    useGameStore.getState().tickSales(30);
    const mid = useGameStore.getState().library.find((w) => w.id === 'w1');
    const soldSoFar = (mid?.totalRevenue ?? 0) - 1_000_000;
    expect(soldSoFar).toBeGreaterThan(0); // 前提：実際に売れている
    expect(useGameStore.getState().lastReleased?.totalRevenue).toBe(1_000_000); // 古いまま

    useGameStore.getState().applyLaunchAd();
    const after = useGameStore.getState().library.find((w) => w.id === 'w1');
    // 販売ぶん + 広告ボーナスの両方が残る（library の現物を起点にしているため）
    expect(after?.totalRevenue).toBe(1_000_000 + soldSoFar + 500_000);
    expect(after?.salesPool).toBe(mid?.salesPool);
  });

  it('リリース画面の売上見込（初動＋販売プール）はボーナス分だけ増える（減らない）', () => {
    seedReleased();
    const before = useGameStore.getState().lastReleased!;
    const projectedBefore = before.initialRevenue + before.salesPool;
    // 販売を進めても lastReleased 側のスナップショットは動かないのが前提
    useGameStore.getState().tickSales(30);
    useGameStore.getState().applyLaunchAd();
    const after = useGameStore.getState().lastReleased!;
    const projectedAfter = after.initialRevenue + after.salesPool;
    // 減衰済みプールを持ち込むと projectedAfter < projectedBefore になる（広告で総額が減る嘘）
    expect(projectedAfter).toBe(projectedBefore + 500_000);
  });

  it('二重適用しても 2 回目は 0 で資金も動かない', () => {
    seedReleased();
    useGameStore.getState().applyLaunchAd();
    const fundsAfterFirst = useGameStore.getState().funds;
    expect(useGameStore.getState().applyLaunchAd()).toBe(0);
    expect(useGameStore.getState().funds).toBe(fundsAfterFirst);
  });

  it('records.bestRevenue は減衰前の総売上（初動＋初期プール）で更新される', () => {
    seedReleased();
    useGameStore.getState().tickSales(30); // プールを減衰させる
    useGameStore.getState().applyLaunchAd();
    expect(useGameStore.getState().records.bestRevenue).toBe(1_500_000 + 4_000_000);
  });

  it('未リリース（lastReleased なし）では 0 を返して何も変えない', () => {
    resetStore({ funds: 5_000_000 });
    expect(useGameStore.getState().applyLaunchAd()).toBe(0);
    expect(useGameStore.getState().funds).toBe(5_000_000);
  });
});
