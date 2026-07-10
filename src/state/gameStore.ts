import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { computeBorrow, computeMonthlyTick, computeRepay } from '../core/economy';
import { type Deps, defaultDeps } from '../core/ports';
import { evaluateAchievements } from '../core/progression';
import { computeRelease, type ReleaseOpts } from '../core/release';
import { ACHIEVEMENTS } from '../data/achievements';
import { DEV_PHRASES_PER_WEEK } from '../data/balance';
import type { CategoryId } from '../data/categories';
import { INITIAL_CATEGORY_IDS } from '../data/categories';
import { newCandidate, REFRESH_COST, sumProgrammerSpeed } from '../data/employees';
import type { GenreId } from '../data/genres';
import { GENRES } from '../data/genres';
import type { Scale } from '../data/scales';
import { nextLockedScale, SCALE_BY_ID, SCALES } from '../data/scales';
import type { ThemeId } from '../data/themes';
import { THEMES } from '../data/themes';
import { generateTitle } from '../data/titleGenerator';
import { ensureTrend, type Trend } from '../data/trend';
import { MAX_EMPLOYEES } from '../lib/officeLayout';
import { settlePool } from '../utils/sales';
import type { Records } from '../utils/storage';
import * as storage from '../utils/storage';
import type {
  Achievement,
  Candidate,
  CurrentProject,
  DevAxis,
  DevPhase,
  Employee,
  GameDate,
  MonthlyFixedCost,
  OfflineReport,
  Screen,
  Work,
} from './types';
import { addWeeks, DEV_PHASE_ORDER, INITIAL_GAME_DATE, ZERO_AXES } from './types';

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
  const desc = pool[Math.floor(deps.rng() * pool.length)];
  return {
    missionName: `MISSION_${String(missionCounter).padStart(2, '0')}`,
    missionDesc: desc,
  };
};

/**
 * アクションが使う乱数・時刻の供給元。既定は本番実装（Math.random / Date.now）。
 * boot が `?seed=NN` を検出したとき setGameDeps で seed 固定乱数に差し替える（e2e 決定化）。
 */
let deps: Deps = defaultDeps;
export const setGameDeps = (d: Deps): void => {
  deps = d;
};

const now = () => deps.now();

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
  /** v0.15：バグ侵食（完成度じわ減り。0 未満にならない） */
  erodeDevelopLoC: (n: number) => void;
  /** v0.15：ビルドアップ・タイピングの属性ポイント加算 */
  addDevStat: (key: 'program' | 'graphics' | 'sound' | 'design', n: number) => void;
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

/**
 * import 時副作用ゼロの初期状態（logic-architecture §3）。
 * セーブ読込・オフライン収益・採用候補・トレンド補充は boot.ts の bootGameStore() が
 * アプリ起動時に上書きする。テストは boot を呼ばず、この決定的な初期状態から始められる。
 * トレンドは expiresAt: 0（期限切れ）のプレースホルダ。boot / tick 側の ensureTrend が差し替える。
 */
const pureDefaults = storage.defaults();

export const useGameStore = create<GameState>()(
  subscribeWithSelector((set, get) => ({
    screen: 'office',
    funds: pureDefaults.funds,
    lifetimeRevenue: 0,
    fans: 0,
    employees: [],
    candidate: null,
    unlockedScales: pureDefaults.unlockedScales,
    unlockedGenres: pureDefaults.unlockedGenres,
    unlockedThemes: pureDefaults.unlockedThemes,
    unlockedCategories: [...INITIAL_CATEGORY_IDS],
    ghosts: pureDefaults.ghosts,
    library: [],
    trend: { genreId: GENRES[0].id, themeId: THEMES[0].id, expiresAt: 0 },
    records: pureDefaults.records,
    achievements: [],
    newlyAchieved: [],
    tutorialDone: false,
    current: null,
    lastReleased: null,
    offlineReport: null,
    currentDate: pureDefaults.currentDate ?? INITIAL_GAME_DATE,
    lastFixedCost: null,
    gameOver: false,
    debt: 0,

    goTo: (screen) => set({ screen }),

    startProject: (genreId, themeId, scale, assignedEmployeeIds) => {
      const def = SCALE_BY_ID[scale];
      const title = generateTitle(genreId, themeId, deps.rng);
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
        devStats: { program: 0, graphics: 0, sound: 0, design: 0 },
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
        trend: ensureTrend(get().trend, now(), deps.rng),
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
      const r = computeMonthlyTick(get());
      set({ funds: r.funds, debt: r.debt, lastFixedCost: r.cost });
      if (r.gameOver) get().triggerGameOver();
      return r.cost;
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

    erodeDevelopLoC: (n) => {
      // v0.15：バグ侵食。完成度をじわ減りさせる（0 未満にはならない＝詰まない）。
      const cur = get().current;
      if (!cur || cur.finishedAt !== null) return;
      set({ current: { ...cur, doneLoC: Math.max(0, cur.doneLoC - n) } });
    },

    addDevStat: (key, n) => {
      const cur = get().current;
      if (!cur || cur.finishedAt !== null) return;
      const stats = cur.devStats ?? { program: 0, graphics: 0, sound: 0, design: 0 };
      set({ current: { ...cur, devStats: { ...stats, [key]: stats[key] + n } } });
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
      const s = get();
      const cur = s.current;
      if (!cur) throw new Error('no current project');
      const { work, patch } = computeRelease({ ...s, current: cur }, opts, deps);
      set(patch);
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
      if (deps.rng() < 0.15) {
        const candidates = ['ばぐしゅうせい', 'くらっしゅかいひ', 'ふぐあいたいおう', 'えらーろぐ'];
        const phrase = candidates[Math.floor(deps.rng() * candidates.length)];
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
        id: `e-${now()}-${deps.rng().toString(36).slice(2, 6)}`,
      };
      set({
        funds: get().funds - cand.wage,
        employees: [...get().employees, emp],
        candidate: newCandidate(deps),
      });
      return true;
    },

    refreshCandidate: () => {
      if (get().funds < REFRESH_COST) return false;
      set({ funds: get().funds - REFRESH_COST, candidate: newCandidate(deps) });
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
      const patch = computeBorrow(get(), amount);
      if (!patch) return false;
      set(patch);
      return true;
    },

    repayDebt: (amount) => {
      const patch = computeRepay(get(), amount);
      if (!patch) return false;
      set(patch);
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
        candidate: newCandidate(deps),
        unlockedScales: d.unlockedScales,
        unlockedGenres: d.unlockedGenres,
        unlockedThemes: d.unlockedThemes,
        unlockedCategories: d.unlockedCategories,
        ghosts: d.ghosts,
        library: d.library,
        trend: ensureTrend(null, now(), deps.rng),
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

// 自動保存・window.__gs 等の起動時副作用は state/boot.ts の bootGameStore() に集約
// （logic-architecture §3。main.tsx が render 前に1回だけ呼ぶ）

// 内部利用：相性の安全な取得（循環依存回避のため lazy require）
import { getCompat } from '../data/compatibility';

const getCompatPublic = (g: GenreId, t: ThemeId) => getCompat(g, t);

export const ALL_SCALES = SCALES;
export const ALL_ACHIEVEMENTS = ACHIEVEMENTS;
