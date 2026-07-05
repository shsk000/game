import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { ACHIEVEMENTS } from '../data/achievements';
import { DEBT_CONFIG, DEV_PHRASES_PER_WEEK, computeBorrowingLimit } from '../data/balance';
import type { CategoryId } from '../data/categories';
import { INITIAL_CATEGORY_IDS } from '../data/categories';
import {
  newCandidate,
  REFRESH_COST,
  sumMonthlySalaries,
  sumPrBonus,
  sumProgrammerSpeed,
} from '../data/employees';
import type { GenreId } from '../data/genres';
import { GENRES } from '../data/genres';
import type { Scale } from '../data/scales';
import { nextLockedScale, SCALE_BY_ID, SCALES } from '../data/scales';
import type { ThemeId } from '../data/themes';
import { THEMES } from '../data/themes';
import { generateTitle } from '../data/titleGenerator';
import { ensureTrend, type Trend, trendMultiplier } from '../data/trend';
import { MAX_EMPLOYEES } from '../lib/officeLayout';
import { computeGenreAffinityScore } from '../utils/affinity';
import { computeCharacterScore } from '../utils/character';
import {
  computeMetascore,
  computePerformanceScore,
  computeQualityV10,
  computeRevenue,
  fanDelta,
} from '../utils/metascore';
import { decayRateFor, INITIAL_SHARE, settleAllWorks, settlePool } from '../utils/sales';
import type { Records } from '../utils/storage';
import * as storage from '../utils/storage';
import type {
  Achievement,
  Candidate,
  CurrentProject,
  DevPhase,
  Employee,
  GameDate,
  MonthlyFixedCost,
  Screen,
  Work,
  WorkBreakdown,
} from './types';
import type { DevAxis } from './types';
import { addWeeks, DEV_PHASE_ORDER, INITIAL_GAME_DATE, ZERO_AXES } from './types';

const persisted = storage.load() ?? storage.defaults();

/**
 * v0.11：開発フェーズの「MISSION 名・見出し」を生成（演出専用）。
 * ジャンルごとに開発っぽいタスク見出しを 1 つ選ぶ。ゲームロジックには影響しない。
 */
const MISSION_FLAVORS: Record<string, string[]> = {
  action: ['敵を配置する', '当たり判定を実装する', 'コンボ処理を組む', '必殺技を実装する'],
  rpg: ['敵を配置する', '戦闘システムを実装する', '経験値処理を組む', 'マップを生成する'],
  puzzle: ['盤面を生成する', '判定ロジックを組む', '連鎖処理を実装する', 'ヒント機能を作る'],
  adventure: ['シナリオ分岐を組む', 'マップを生成する', 'アイテム処理を実装する', '会話を実装する'],
  simulation: ['経済ループを組む', 'AI 行動を実装する', 'パラメータ処理を作る', 'UI を組む'],
  shooter: ['弾幕を生成する', '当たり判定を実装する', 'ボスAIを組む', 'スコア処理を作る'],
  racing: ['物理挙動を実装する', 'コースを生成する', 'AI 走行を組む', 'タイム計測を作る'],
  horror: ['演出トリガーを組む', '敵AIを実装する', 'サウンド処理を作る', 'マップを生成する'],
  fighting: ['コンボ判定を組む', '当たり判定を実装する', '必殺技を作る', 'AI 行動を組む'],
  roguelike: ['ダンジョンを生成する', 'アイテム処理を組む', '敵を配置する', '永続化処理を作る'],
  rhythm: ['譜面を生成する', '判定ロジックを組む', 'コンボ処理を作る', 'スコア処理を組む'],
  sandbox: ['ブロック処理を組む', 'セーブ処理を作る', '物理挙動を実装する', '生成ロジックを組む'],
};
let missionCounter = 3;
const buildMissionFlavor = (genreId: GenreId): { missionName: string; missionDesc: string } => {
  const pool = MISSION_FLAVORS[genreId] ?? MISSION_FLAVORS.action;
  missionCounter += 1;
  const desc = pool[Math.floor(Math.random() * pool.length)];
  return {
    missionName: `MISSION_${String(missionCounter).padStart(2, '0')}`,
    missionDesc: desc,
  };
};

type StageUnlock = {
  unlocked: number;
  newGenres: GenreId[];
  newThemes: ThemeId[];
};

/**
 * v0.10 仕上げ §6-8：解放テンポ（ハイブリッド）。
 *   - 基本軸：累計売上（駄作量産では解放されない）
 *   - 加速軸：ヒット作（メタ 70+）の本数
 *   - 段階的に：stage 2/3/4 へ進める
 *
 * stage しきい値（balance-design §6-8 解放テーブル準拠）：
 *   - stage 2：累計売上 ¥1000 万 OR ヒット作 1 本
 *   - stage 3：累計売上 ¥5000 万 OR ヒット作 3 本
 *   - stage 4：累計売上 ¥1 億 OR ヒット作 5 本
 *
 * 「累計売上だけ」「ヒット作だけ」のどちらでも解放できる二段構え。
 */
const HIT_METASCORE_THRESHOLD = 70;

const computeStageUnlocks = (
  currentGenres: GenreId[],
  currentThemes: ThemeId[],
  library: Work[],
  lifetimeRevenue: number,
): StageUnlock => {
  const hitCount = library.filter((w) => w.metascore >= HIT_METASCORE_THRESHOLD).length;
  let stage: 1 | 2 | 3 | 4 = 1;
  if (lifetimeRevenue >= 10_000_000 || hitCount >= 1) stage = 2;
  if (lifetimeRevenue >= 50_000_000 || hitCount >= 3) stage = 3;
  if (lifetimeRevenue >= 100_000_000 || hitCount >= 5) stage = 4;
  const newGenres = GENRES.filter(
    (g) => g.unlockStage <= stage && !currentGenres.includes(g.id),
  ).map((g) => g.id);
  const newThemes = THEMES.filter(
    (t) => t.unlockStage <= stage && !currentThemes.includes(t.id),
  ).map((t) => t.id);
  return { unlocked: newGenres.length + newThemes.length, newGenres, newThemes };
};

/**
 * v0.10 仕上げ §6-8：カテゴリ解放（ハイブリッド条件）。
 *  - story: 初期 3 カテゴリ（graphics, sound, gameplay）全てで作品リリース
 *  - presentation: ヒット作 5 本（メタ 70+）
 *  - innovation: 累計売上 ¥1 億
 */
const computeNewlyUnlockedCategories = (
  current: CategoryId[],
  library: Work[],
  lifetimeRevenue: number,
): CategoryId[] => {
  const set = new Set(current);
  const added: CategoryId[] = [];

  // story: 初期 3 カテゴリで作品リリース済み
  if (!set.has('story')) {
    const used = new Set<CategoryId>();
    for (const w of library) {
      for (const cid of w.selectedCategories ?? []) used.add(cid as CategoryId);
    }
    if (used.has('graphics') && used.has('sound') && used.has('gameplay')) {
      set.add('story');
      added.push('story');
    }
  }

  // presentation: ヒット作 5 本
  if (!set.has('presentation')) {
    const hits = library.filter((w) => w.metascore >= HIT_METASCORE_THRESHOLD).length;
    if (hits >= 5) {
      set.add('presentation');
      added.push('presentation');
    }
  }

  // innovation: 累計売上 ¥1 億
  if (!set.has('innovation')) {
    if (lifetimeRevenue >= 100_000_000) {
      set.add('innovation');
      added.push('innovation');
    }
  }

  return added;
};

const evaluateAchievements = (
  current: Achievement[],
  ctx: {
    library: Work[];
    fans: number;
    lifetimeRevenue: number;
    bestCombo: number;
    lastWork?: Work;
  },
): { unlocked: Achievement[]; newly: Achievement[] } => {
  const set = new Set(current);
  const candidates: Achievement[] = [];
  if (ctx.library.length >= 1) candidates.push('first-release');
  if (ctx.lastWork?.isMasterpiece || ctx.library.some((w) => w.isMasterpiece)) {
    candidates.push('first-masterpiece');
  }
  if (ctx.lastWork?.ghostBeaten || ctx.library.some((w) => w.ghostBeaten)) {
    candidates.push('ghost-killer');
  }
  if (ctx.bestCombo >= 100) candidates.push('combo-100');
  if (ctx.fans >= 1000) candidates.push('fan-1k');
  if (ctx.lifetimeRevenue >= 1_000_000) candidates.push('million-yen');
  const discovered = new Set(ctx.library.map((w) => `${w.genreId}|${w.themeId}`));
  if (discovered.size >= 90) candidates.push('collector-half');
  if (ctx.library.some((w) => w.scale === 'aaa')) candidates.push('aaa-released');
  const newly: Achievement[] = [];
  for (const a of candidates) {
    if (!set.has(a)) {
      set.add(a);
      newly.push(a);
    }
  }
  return { unlocked: Array.from(set), newly };
};

type OfflineReport = {
  earned: number;
  awaySec: number;
};

const now = () => Date.now();

const computeOfflineEarnings = (
  lastSeenAt: number,
  library: Work[],
): { report: OfflineReport | null; library: Work[] } => {
  if (!lastSeenAt) return { report: null, library };
  const awaySec = Math.max(0, (now() - lastSeenAt) / 1000);
  if (awaySec < 60) return { report: null, library };
  const { earned, library: updated } = settleAllWorks(library, awaySec);
  if (earned <= 0) return { report: null, library: updated };
  return { report: { earned, awaySec }, library: updated };
};

type ReleaseOpts = {
  launchAd?: boolean;
  marketingAd?: boolean;
  debugAd?: boolean;
};

type Actions = {
  goTo: (screen: Screen) => void;
  startProject: (
    genreId: GenreId,
    themeId: ThemeId,
    scale: Scale,
    assignedEmployeeIds: string[],
  ) => void;
  tickAuto: (deltaSec: number) => void;
  tickSales: (deltaSec: number) => void;
  /**
   * v0.10：ゲーム内時間を1週進める。
   * 月またぎ（次月第1週へ）になったときは monthlyTick も実行され、固定費が引かれる。
   */
  tickWeek: () => void;
  /**
   * v0.10：月初固定費（給与＋賃料）を funds から引く。
   * 通常は tickWeek 内部から月またぎ時に呼ばれるが、テストや初期化のため公開。
   */
  monthlyTick: () => MonthlyFixedCost;
  addDevelopLoC: (n: number) => void;
  reportCombo: (combo: number) => void;
  reportWPM: (wpm: number) => void;
  reportAccuracy: (acc: number) => void;
  finishDevelopment: () => void;
  /**
   * v0.14：開発フェーズを次へ進める。
   * planning→development→testing→debugging の遷移はテイクオーバー内で完結。
   * debugging から先（release 相当）に進むときは既存リリースフロー finishDevelopment に委譲する。
   */
  advancePhase: () => void;
  /** v0.14：イベント/ミッション結果の新軸デルタを current.axes に適用 */
  applyAxisDelta: (delta: Partial<Record<DevAxis, number>>) => void;
  releaseWork: (opts?: ReleaseOpts) => Work;
  buyAdDevBoost: () => void;
  buyAdSurvey: (g: GenreId, t: ThemeId) => void;
  triggerBugIfDue: () => void;
  clearBug: () => void;
  hireCandidate: () => boolean;
  refreshCandidate: () => boolean;
  fireEmployee: (id: string) => void;
  unlockNextScale: () => boolean;
  clearOfflineReport: () => void;
  finishTutorial: () => void;
  clearNewlyAchieved: () => void;
  /** v0.10 §9-2：資金不足でゲームオーバー状態に入る。borrow 機構ができたら条件を緩める */
  triggerGameOver: () => void;
  clearGameOver: () => void;
  /** v0.10 F-5：WPM しきい値クロスで -X 週短縮した記録（重複防止）。週短縮も即時反映 */
  applyTimeShortcut: (thresholdWpm: number, weeksDelta: number) => boolean;
  /** v0.10 仕上げ §6-7：借入。borrowing limit 内なら成立。 */
  borrowMoney: (amount: number) => boolean;
  /** v0.10 仕上げ §6-7：返済。funds の範囲で debt を返す。 */
  repayDebt: (amount: number) => boolean;
  reset: () => void;
};

export type GameState = {
  screen: Screen;
  funds: number;
  lifetimeRevenue: number;
  fans: number;
  employees: Employee[];
  candidate: Candidate | null;
  unlockedScales: Scale[];
  unlockedGenres: GenreId[];
  unlockedThemes: ThemeId[];
  unlockedCategories: CategoryId[];
  ghosts: Record<Scale, number | null>;
  library: Work[];
  trend: Trend;
  records: Records;
  achievements: Achievement[];
  newlyAchieved: Achievement[];
  tutorialDone: boolean;
  current: CurrentProject | null;
  lastReleased: Work | null;
  offlineReport: OfflineReport | null;
  /** v0.10：ゲーム内日付（週単位） */
  currentDate: GameDate;
  /** v0.10：直近に発生した月初固定費（UI 表示用。発生していなければ null） */
  lastFixedCost: MonthlyFixedCost | null;
  /** v0.10 §9-2：資金枯渇でゲームオーバー */
  gameOver: boolean;
  /**
   * v0.10 仕上げ §6-7：借金残高（円）。
   * 月初の固定費で資金がマイナスになった分は自動的に借金へ振替。
   * 月利は monthlyTick 時に乗る。借入上限超 + 資金 0 でゲームオーバー。
   */
  debt: number;
} & Actions;

const offlineCalc = computeOfflineEarnings(persisted.lastSeenAt, persisted.library);
const initialTrend = ensureTrend(persisted.trend, now());

export const useGameStore = create<GameState>()(
  subscribeWithSelector((set, get) => ({
    screen: 'office',
    funds: persisted.funds + (offlineCalc.report?.earned ?? 0),
    lifetimeRevenue: persisted.lifetimeRevenue + (offlineCalc.report?.earned ?? 0),
    fans: persisted.fans,
    employees: persisted.employees,
    candidate: newCandidate(),
    unlockedScales: persisted.unlockedScales,
    unlockedGenres: persisted.unlockedGenres,
    unlockedThemes: persisted.unlockedThemes,
    unlockedCategories:
      persisted.unlockedCategories && persisted.unlockedCategories.length > 0
        ? persisted.unlockedCategories
        : [...INITIAL_CATEGORY_IDS],
    ghosts: persisted.ghosts,
    library: offlineCalc.library,
    trend: initialTrend,
    records: persisted.records,
    achievements: persisted.achievements,
    newlyAchieved: [],
    tutorialDone: persisted.tutorialDone,
    current: null,
    lastReleased: null,
    offlineReport: offlineCalc.report,
    currentDate: persisted.currentDate ?? INITIAL_GAME_DATE,
    lastFixedCost: null,
    gameOver: false,
    debt: 0,

    goTo: (screen) => set({ screen }),

    startProject: (genreId, themeId, scale, assignedEmployeeIds) => {
      const def = SCALE_BY_ID[scale];
      const title = generateTitle(genreId, themeId);
      // v0.11 後期：締切（残り時間）を廃止し進捗オンリーに。
      // 作業量目標 workTarget（完走フレーズ数）まで打って初めて完了する（AFK では終わらない）。
      // 例：mini neededWeeks 8 × 3 = 24 フレーズ。速く打つほど少ない本数で到達＝早期完了。
      const workTarget = Math.max(3, Math.round(def.neededWeeks * DEV_PHRASES_PER_WEEK));
      const project: CurrentProject = {
        title,
        genreId,
        themeId,
        scale,
        phase: 'planning',
        axes: { ...ZERO_AXES },
        requiredLoC: def.requiredLoC,
        doneLoC: 0,
        maxCombo: 0,
        devBoostRemainingSec: 0,
        bugPhrase: null,
        startedAt: performance.now(),
        finishedAt: null,
        adBoostActive: false,
        surveyedCompat: null,
        // v0.14：開発カテゴリ選択は廃止（オーナー決定）。型は後方互換のため残し空配列固定
        selectedCategories: [],
        assignedEmployeeIds: [...assignedEmployeeIds],
        perf: { wpm: 0, maxCombo: 0, accuracy: 1 },
        startDate: get().currentDate,
        timeShortcutsUnlocked: [],
        workTarget,
        ...buildMissionFlavor(genreId),
      };
      set({
        current: project,
        screen: 'develop',
        trend: ensureTrend(get().trend, now()),
      });
    },

    tickAuto: (deltaSec) => {
      const cur = get().current;
      if (!cur) return;
      const progSpeed = sumProgrammerSpeed(get().employees);
      const boost = cur.devBoostRemainingSec > 0 ? 2 : 1;
      const add = progSpeed * deltaSec * boost;
      if (cur.finishedAt === null) {
        const newDone = Math.min(cur.requiredLoC, cur.doneLoC + add);
        set({
          current: {
            ...cur,
            doneLoC: newDone,
            devBoostRemainingSec: Math.max(0, cur.devBoostRemainingSec - deltaSec),
          },
        });
      }
    },

    tickWeek: () => {
      const s = get();
      const prev = s.currentDate;
      const next = addWeeks(prev, 1);
      // 月またぎ判定：month が変わったら固定費発生
      const monthChanged = prev.month !== next.month || prev.year !== next.year;
      set({ currentDate: next });
      if (monthChanged) {
        get().monthlyTick();
      }
    },

    monthlyTick: () => {
      const s = get();
      const salaries = sumMonthlySalaries(s.employees);
      const currentScale: Scale = s.unlockedScales[s.unlockedScales.length - 1] ?? 'mini';
      const rent = SCALE_BY_ID[currentScale]?.monthlyRent ?? 0;
      // v0.10 仕上げ §6-7：借金月利
      const interest = Math.round(s.debt * DEBT_CONFIG.monthlyInterestRate);
      const total = salaries + rent + interest;
      const cost: MonthlyFixedCost = { salaries, rent, total };

      // funds から固定費を引く → マイナスになったら借金に振替
      const rawFunds = s.funds - total;
      let newFunds = rawFunds;
      let newDebt = s.debt;
      if (rawFunds < 0) {
        newDebt = s.debt + -rawFunds;
        newFunds = 0;
      }

      // 借入上限：月固定費 × 12 ヶ月
      const borrowingLimit = computeBorrowingLimit(salaries + rent);

      set({
        funds: newFunds,
        debt: newDebt,
        lastFixedCost: cost,
      });

      // 借入上限超 + 資金 0 でゲームオーバー
      if (newDebt > borrowingLimit && newFunds <= 0) {
        get().triggerGameOver();
      }
      return cost;
    },

    triggerGameOver: () => {
      if (get().gameOver) return;
      set({ gameOver: true });
    },

    clearGameOver: () => set({ gameOver: false }),

    applyTimeShortcut: (thresholdWpm, _weeksDelta) => {
      const cur = get().current;
      if (!cur) return false;
      const list = cur.timeShortcutsUnlocked ?? [];
      if (list.includes(thresholdWpm)) return false;
      // 期間短縮の実態は DevelopScreen 側の表示（経過 / 必要週数）に反映する。
      // ここではフラグだけ立てて重複通知を防ぐ。
      set({
        current: {
          ...cur,
          timeShortcutsUnlocked: [...list, thresholdWpm],
        },
      });
      return true;
    },

    tickSales: (deltaSec) => {
      if (deltaSec <= 0) return;
      const lib = get().library;
      let earned = 0;
      const updated = lib.map((w) => {
        if (!w.selling) return w;
        const r = settlePool(w.salesPool, w.decayPerSec, deltaSec);
        earned += r.payout;
        return {
          ...w,
          salesPool: r.remaining,
          totalRevenue: w.totalRevenue + r.payout,
          selling: !r.sold,
        };
      });
      if (earned <= 0) {
        // selling 状態が変わったケースだけ反映
        const changed = updated.some((w, i) => w.selling !== lib[i].selling);
        if (changed) set({ library: updated });
        return;
      }
      const s = get();
      const newAch = evaluateAchievements(s.achievements, {
        library: updated,
        fans: s.fans,
        lifetimeRevenue: s.lifetimeRevenue + earned,
        bestCombo: s.records.bestCombo,
      });
      set({
        library: updated,
        funds: s.funds + earned,
        lifetimeRevenue: s.lifetimeRevenue + earned,
        achievements: newAch.unlocked,
        newlyAchieved: [...s.newlyAchieved, ...newAch.newly],
      });
    },

    addDevelopLoC: (n) => {
      const cur = get().current;
      if (!cur || cur.finishedAt !== null) return;
      // v0.11 後期：進捗の上限は workTarget（作業量目標）。doneLoC が達したら完了。
      const cap = cur.workTarget ?? cur.requiredLoC;
      const newDone = Math.min(cap, cur.doneLoC + n);
      set({ current: { ...cur, doneLoC: newDone } });
    },

    reportCombo: (combo) => {
      const cur = get().current;
      if (cur && combo > cur.maxCombo) {
        set({
          current: {
            ...cur,
            maxCombo: combo,
            perf: { ...cur.perf, maxCombo: Math.max(cur.perf.maxCombo, combo) },
          },
        });
      }
      const rec = get().records;
      if (combo > rec.bestCombo) {
        set({ records: { ...rec, bestCombo: combo } });
      }
    },

    reportWPM: (wpm) => {
      const cur = get().current;
      if (cur) {
        set({ current: { ...cur, perf: { ...cur.perf, wpm: Math.max(cur.perf.wpm, wpm) } } });
      }
      const rec = get().records;
      if (wpm > rec.bestWPM) {
        set({ records: { ...rec, bestWPM: Math.round(wpm) } });
      }
    },

    reportAccuracy: (acc) => {
      const cur = get().current;
      if (!cur) return;
      const clamped = Math.max(0, Math.min(1, acc));
      set({ current: { ...cur, perf: { ...cur.perf, accuracy: clamped } } });
    },

    finishDevelopment: () => {
      const cur = get().current;
      if (!cur || cur.finishedAt !== null) return;
      const nowMs = performance.now();
      const developSec = (nowMs - cur.startedAt) / 1000;
      const prevGhost = get().ghosts[cur.scale];
      const beat = prevGhost === null || developSec < prevGhost;
      const newGhost = beat ? developSec : prevGhost;

      // v0.11 後期：開発中は GlobalTicker が裏で週を進め固定費も精算済み。
      // よってここでは週の一括進行や固定費精算は行わない（二重計上を防ぐ）。
      // 実際にかかった週数（startDate→currentDate）は releaseWork の developWeeks に反映される。
      set({
        current: {
          ...cur,
          finishedAt: nowMs,
          doneLoC: cur.workTarget ?? cur.requiredLoC,
          // v0.14：発売フェーズへ（ReleaseScreen の広告選択＝発売作業に対応）
          phase: 'release',
        },
        ghosts: { ...get().ghosts, [cur.scale]: newGhost },
        screen: 'release',
      });
    },

    advancePhase: () => {
      const cur = get().current;
      if (!cur) return;
      const phase: DevPhase = cur.phase ?? 'development';
      const idx = DEV_PHASE_ORDER.indexOf(phase);
      const next = DEV_PHASE_ORDER[idx + 1];
      if (!next) return;
      // 発売以降は既存リリースフロー（finishDevelopment → ReleaseScreen）に委譲。
      if (next === 'release' || next === 'complete') {
        get().finishDevelopment();
        return;
      }
      set({ current: { ...cur, phase: next } });
    },

    applyAxisDelta: (delta) => {
      const cur = get().current;
      if (!cur) return;
      const axes = { ...(cur.axes ?? ZERO_AXES) };
      (Object.keys(delta) as DevAxis[]).forEach((k) => {
        axes[k] = (axes[k] ?? 0) + (delta[k] ?? 0);
      });
      set({ current: { ...cur, axes } });
    },

    releaseWork: (opts) => {
      const cur = get().current;
      if (!cur) throw new Error('no current project');
      const employees = get().employees;
      const prBonus = sumPrBonus(employees);
      const assignedEmployees = employees.filter((e) => cur.assignedEmployeeIds.includes(e.id));

      // === 4 要素品質（v0.14：カテゴリ選択廃止に伴い category 依存を撤去）===
      // 1) キャラ能力スコア（0..100）
      const charResult = computeCharacterScore({
        assignedEmployees,
        scale: cur.scale,
      });
      // 2) ジャンル相性スコア（0..100）＝ compat 連続マッピング
      const affResult = computeGenreAffinityScore({
        genreId: cur.genreId,
        themeId: cur.themeId,
      });
      // 3) タイピング演技スコア（0..100）— spec §2-2
      // 広告ボーナス（既存仕様）はパフォーマンス側に +5 ずつ寄せる
      const adPerfBoost = (opts?.marketingAd ? 5 : 0) + (opts?.debugAd ? 5 : 0);
      const performance = Math.min(
        100,
        computePerformanceScore({ ...cur.perf, noBugs: !cur.bugPhrase }) + adPerfBoost,
      );

      // 4) computeQualityV10 で合成（運の基底 50 ± 揺らぎ）。神ゲーガチャは v0.10 で廃止。
      const { Q: quality0, breakdown: qBreakdown } = computeQualityV10({
        charPower: charResult.score,
        genreAffinity: affResult.score,
        typingScore: performance,
      });

      // v0.14：イベント新軸の合流（品質系 + バグ罰）。既存 4 要素は不変、加点/減点として上乗せ。
      const axes = cur.axes ?? ZERO_AXES;
      const axisQualityBonus =
        (axes.funFactor + axes.usability + axes.balance) * 0.3 - axes.bugRate * 0.2;
      const quality = Math.max(0, Math.min(100, Math.round(quality0 + axisQualityBonus)));

      const trend = get().trend;
      const meta = computeMetascore(quality, cur.genreId, cur.themeId, trend);
      const launchAdActive = !!opts?.launchAd;
      const pioneer = !get().library.some(
        (w) => w.genreId === cur.genreId && w.themeId === cur.themeId,
      );
      const pioneerBonus = pioneer ? 0.3 : 0;
      const baseTotalRevenue = computeRevenue(
        meta.metascore,
        cur.genreId,
        cur.themeId,
        cur.scale,
        trend,
        get().fans,
        launchAdActive,
        prBonus,
        pioneerBonus,
      );
      // v0.14：市場系新軸（売上予測・話題性 − 炎上リスク）で売上を補正（0.5〜2.0 倍にクランプ）。
      const axisSalesMul = Math.max(
        0.5,
        Math.min(2, 1 + (axes.salesForecast + axes.buzz) / 100 - axes.reputationRisk / 100),
      );
      const totalRevenue = Math.round(baseTotalRevenue * axisSalesMul);
      const initialRevenue = Math.round(totalRevenue * INITIAL_SHARE);
      const salesPool = totalRevenue - initialRevenue;
      const decayPerSec = decayRateFor(meta.metascore);
      // v0.14：期待/話題/信頼でファン上乗せ、炎上リスクで減（spec §5-6）。
      const axisFans = Math.round(axes.hype + axes.buzz * 0.5 + axes.trust - axes.reputationRisk);
      const gainedFans = Math.max(0, fanDelta(meta.metascore, prBonus) + axisFans);
      const newFans = Math.max(0, get().fans + gainedFans);
      const developSec = cur.finishedAt !== null ? (cur.finishedAt - cur.startedAt) / 1000 : 0;
      const prevGhost = get().ghosts[cur.scale];
      const ghostBeaten = prevGhost !== null && developSec <= prevGhost;

      // ゲーム内週数：開始日 → 現在日 の差 ＋ イベントのスケジュール効果（devWeeksDelta）
      const startDate = cur.startDate ?? get().currentDate;
      const developWeeks = Math.max(
        0,
        (get().currentDate.year - startDate.year) * 48 +
          (get().currentDate.month - startDate.month) * 4 +
          (get().currentDate.week - startDate.week) +
          Math.round(axes.devWeeksDelta),
      );

      // イベントのコスト効果（costMod%）：開発費に対する追加徴収/返金をリリース時に精算
      const costAdjust = Math.round(SCALE_BY_ID[cur.scale].baseCost * (axes.costMod / 100));

      const trendMul = trendMultiplier(trend, cur.genreId, cur.themeId);
      const workBreakdown: WorkBreakdown = {
        ...qBreakdown,
        // v0.14 修正：Work.breakdown のフィールド名は performance。
        // 旧実装は typingScore のままスプレッドしていたため、開封演出の
        // 「タイピング演技」寄与が常に 0 表示になっていた（v0.10 からの潜在バグ）。
        performance: qBreakdown.typingScore,
        trendMul,
        pioneer,
      };

      const work: Work = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        title: cur.title,
        genreId: cur.genreId,
        themeId: cur.themeId,
        scale: cur.scale,
        quality,
        metascore: meta.metascore,
        isMasterpiece: meta.isMasterpiece,
        developSec,
        initialRevenue,
        salesPool,
        initialSalesPool: salesPool,
        decayPerSec,
        totalRevenue: initialRevenue, // 初動はすでに加算した分のみ。販売で積み上がる
        selling: salesPool > 0,
        fansGained: gainedFans,
        ghostBeaten,
        launchAdUsed: launchAdActive,
        pioneer,
        releasedAt: Date.now(),
        createdAt: Date.now(),
        breakdown: workBreakdown,
        selectedCategories: [...cur.selectedCategories],
        developWeeks,
      };

      const newLibrary = [work, ...get().library];
      // v0.10 仕上げ §6-8：累計売上 + ヒット作のハイブリッドで解放判定
      const projectedLifetimeRevenue = get().lifetimeRevenue + initialRevenue;
      const stageUnlock = computeStageUnlocks(
        get().unlockedGenres,
        get().unlockedThemes,
        newLibrary,
        projectedLifetimeRevenue,
      );
      const newCategoryUnlocks = computeNewlyUnlockedCategories(
        get().unlockedCategories,
        newLibrary,
        projectedLifetimeRevenue,
      );

      const rec = get().records;
      const newRec: Records = {
        bestMetascore: Math.max(rec.bestMetascore, meta.metascore),
        bestRevenue: Math.max(rec.bestRevenue, totalRevenue),
        bestCombo: rec.bestCombo,
        bestWPM: rec.bestWPM,
      };

      const newAch = evaluateAchievements(get().achievements, {
        library: newLibrary,
        fans: newFans,
        lifetimeRevenue: get().lifetimeRevenue + initialRevenue,
        bestCombo: rec.bestCombo,
        lastWork: work,
      });

      set({
        library: newLibrary,
        funds: get().funds + initialRevenue - costAdjust,
        lifetimeRevenue: get().lifetimeRevenue + initialRevenue,
        fans: newFans,
        records: newRec,
        achievements: newAch.unlocked,
        newlyAchieved: [...get().newlyAchieved, ...newAch.newly],
        unlockedGenres: [...get().unlockedGenres, ...stageUnlock.newGenres],
        unlockedThemes: [...get().unlockedThemes, ...stageUnlock.newThemes],
        unlockedCategories: [...get().unlockedCategories, ...newCategoryUnlocks],
        lastReleased: work,
        current: null,
        screen: 'release',
      });
      return work;
    },

    buyAdDevBoost: () => {
      const cur = get().current;
      if (!cur || cur.finishedAt !== null) return;
      set({ current: { ...cur, devBoostRemainingSec: cur.devBoostRemainingSec + 30 } });
    },

    buyAdSurvey: (g, t) => {
      const cur = get().current;
      const surveyed = +getCompatPublic(g, t).toFixed(2);
      if (cur) {
        set({ current: { ...cur, surveyedCompat: surveyed } });
      } else {
        // 企画中：ストアにスナップショットを残すために state を借りる手段がないため、
        // PlanScreen 側で setState 呼び出しに頼る（このアクションは経由しない）
      }
    },

    triggerBugIfDue: () => {
      const cur = get().current;
      if (!cur || cur.finishedAt !== null || cur.bugPhrase) return;
      // 15% で発生（呼び出し側で間引き）
      if (Math.random() < 0.15) {
        const candidates = ['ばぐしゅうせい', 'くらっしゅかいひ', 'ふぐあいたいおう', 'えらーろぐ'];
        const phrase = candidates[Math.floor(Math.random() * candidates.length)];
        set({ current: { ...cur, bugPhrase: phrase } });
      }
    },

    clearBug: () => {
      const cur = get().current;
      if (!cur) return;
      set({ current: { ...cur, bugPhrase: null } });
    },

    hireCandidate: () => {
      const cand = get().candidate;
      if (!cand) return false;
      if (get().employees.length >= MAX_EMPLOYEES) return false; // 席数=最大人数で打ち止め
      if (get().funds < cand.wage) return false;
      const emp: Employee = {
        ...cand,
        id: `e-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      };
      set({
        funds: get().funds - cand.wage,
        employees: [...get().employees, emp],
        candidate: newCandidate(),
      });
      return true;
    },

    refreshCandidate: () => {
      if (get().funds < REFRESH_COST) return false;
      set({ funds: get().funds - REFRESH_COST, candidate: newCandidate() });
      return true;
    },

    fireEmployee: (id) => {
      set({ employees: get().employees.filter((e) => e.id !== id) });
    },

    unlockNextScale: () => {
      const next = nextLockedScale(get().unlockedScales);
      if (!next) return false;
      if (get().funds < next.unlockCost) return false;
      set({
        funds: get().funds - next.unlockCost,
        unlockedScales: [...get().unlockedScales, next.id],
      });
      return true;
    },

    clearOfflineReport: () => set({ offlineReport: null }),
    finishTutorial: () => set({ tutorialDone: true }),
    clearNewlyAchieved: () => set({ newlyAchieved: [] }),

    borrowMoney: (amount) => {
      if (amount <= 0) return false;
      const s = get();
      const salaries = sumMonthlySalaries(s.employees);
      const currentScale: Scale = s.unlockedScales[s.unlockedScales.length - 1] ?? 'mini';
      const rent = SCALE_BY_ID[currentScale]?.monthlyRent ?? 0;
      const limit = computeBorrowingLimit(salaries + rent);
      if (s.debt + amount > limit) return false;
      set({ funds: s.funds + amount, debt: s.debt + amount });
      return true;
    },

    repayDebt: (amount) => {
      if (amount <= 0) return false;
      const s = get();
      const pay = Math.min(amount, s.funds, s.debt);
      if (pay <= 0) return false;
      set({ funds: s.funds - pay, debt: s.debt - pay });
      return true;
    },

    reset: () => {
      storage.reset();
      const d = storage.defaults();
      set({
        screen: 'plan',
        funds: d.funds,
        lifetimeRevenue: d.lifetimeRevenue,
        fans: d.fans,
        employees: d.employees,
        candidate: newCandidate(),
        unlockedScales: d.unlockedScales,
        unlockedGenres: d.unlockedGenres,
        unlockedThemes: d.unlockedThemes,
        unlockedCategories: d.unlockedCategories,
        ghosts: d.ghosts,
        library: d.library,
        trend: ensureTrend(null, now()),
        records: d.records,
        achievements: [],
        newlyAchieved: [],
        tutorialDone: false,
        current: null,
        lastReleased: null,
        offlineReport: null,
        currentDate: d.currentDate,
        lastFixedCost: null,
        gameOver: false,
        debt: 0,
      });
    },
  })),
);

// セーブ
useGameStore.subscribe(
  (s) => ({
    funds: s.funds,
    lifetimeRevenue: s.lifetimeRevenue,
    fans: s.fans,
    employees: s.employees,
    unlockedScales: s.unlockedScales,
    unlockedGenres: s.unlockedGenres,
    unlockedThemes: s.unlockedThemes,
    unlockedCategories: s.unlockedCategories,
    ghosts: s.ghosts,
    library: s.library,
    trend: s.trend,
    records: s.records,
    achievements: s.achievements,
    tutorialDone: s.tutorialDone,
    currentDate: s.currentDate,
  }),
  (snap) => {
    storage.save({
      version: 5,
      ...snap,
      lastSeenAt: now(),
    });
  },
  { equalityFn: (a, b) => JSON.stringify(a) === JSON.stringify(b) },
);

// テスト用：window.__gs() で現在のストア state を取得（dev / e2e のみで使用）
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  (window as unknown as { __gs: () => GameState }).__gs = () => useGameStore.getState();
}

// 離席時刻更新
if (typeof window !== 'undefined') {
  setInterval(() => {
    const s = useGameStore.getState();
    storage.save({
      version: 5,
      funds: s.funds,
      lifetimeRevenue: s.lifetimeRevenue,
      fans: s.fans,
      employees: s.employees,
      unlockedScales: s.unlockedScales,
      unlockedGenres: s.unlockedGenres,
      unlockedThemes: s.unlockedThemes,
      unlockedCategories: s.unlockedCategories,
      ghosts: s.ghosts,
      library: s.library,
      trend: s.trend,
      records: s.records,
      achievements: s.achievements,
      tutorialDone: s.tutorialDone,
      currentDate: s.currentDate,
      lastSeenAt: now(),
    });
  }, 5000);
}

// 内部利用：相性の安全な取得（循環依存回避のため lazy require）
import { getCompat } from '../data/compatibility';

const getCompatPublic = (g: GenreId, t: ThemeId) => getCompat(g, t);

export const ALL_SCALES = SCALES;
export const ALL_ACHIEVEMENTS = ACHIEVEMENTS;
