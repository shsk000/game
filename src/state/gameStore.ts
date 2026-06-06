import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { ACHIEVEMENTS } from '../data/achievements';
import type { CategoryId } from '../data/categories';
import { CATEGORY_BY_ID, categoryAffinity, INITIAL_CATEGORY_IDS } from '../data/categories';
import {
  newCandidate,
  REFRESH_COST,
  sumEmployeeCategoryBonus,
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
import { ensureTrend, type Trend } from '../data/trend';
import {
  computeMetascore,
  computePerformanceScore,
  computeQuality,
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
  Employee,
  Screen,
  Work,
  WorkBreakdown,
} from './types';

const persisted = storage.load() ?? storage.defaults();

type StageUnlock = {
  unlocked: number;
  newGenres: GenreId[];
  newThemes: ThemeId[];
};

const computeStageUnlocks = (
  currentGenres: GenreId[],
  currentThemes: ThemeId[],
  libraryCount: number,
): StageUnlock => {
  let stage: 1 | 2 | 3 | 4 = 1;
  if (libraryCount >= 3) stage = 2;
  if (libraryCount >= 8) stage = 3;
  if (libraryCount >= 15) stage = 4;
  const newGenres = GENRES.filter(
    (g) => g.unlockStage <= stage && !currentGenres.includes(g.id),
  ).map((g) => g.id);
  const newThemes = THEMES.filter(
    (t) => t.unlockStage <= stage && !currentThemes.includes(t.id),
  ).map((t) => t.id);
  return { unlocked: newGenres.length + newThemes.length, newGenres, newThemes };
};

const CATEGORY_UNLOCK_THRESHOLDS: { count: number; id: CategoryId }[] = [
  { count: 5, id: 'story' },
  { count: 10, id: 'presentation' },
  { count: 20, id: 'innovation' },
];

const computeNewlyUnlockedCategories = (
  current: CategoryId[],
  libraryCount: number,
): CategoryId[] => {
  const set = new Set(current);
  const added: CategoryId[] = [];
  for (const { count, id } of CATEGORY_UNLOCK_THRESHOLDS) {
    if (libraryCount >= count && !set.has(id)) {
      set.add(id);
      added.push(id);
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
    selectedCategories: CategoryId[],
    assignedEmployeeIds: string[],
  ) => void;
  tickAuto: (deltaSec: number) => void;
  tickSales: (deltaSec: number) => void;
  addDevelopLoC: (n: number) => void;
  reportCombo: (combo: number) => void;
  reportWPM: (wpm: number) => void;
  reportAccuracy: (acc: number) => void;
  finishDevelopment: () => void;
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
} & Actions;

const offlineCalc = computeOfflineEarnings(persisted.lastSeenAt, persisted.library);
const initialTrend = ensureTrend(persisted.trend, now());

export const useGameStore = create<GameState>()(
  subscribeWithSelector((set, get) => ({
    screen: 'plan',
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

    goTo: (screen) => set({ screen }),

    startProject: (genreId, themeId, scale, selectedCategories, assignedEmployeeIds) => {
      const def = SCALE_BY_ID[scale];
      const title = generateTitle(genreId, themeId);
      const project: CurrentProject = {
        title,
        genreId,
        themeId,
        scale,
        requiredLoC: def.requiredLoC,
        doneLoC: 0,
        maxCombo: 0,
        devBoostRemainingSec: 0,
        bugPhrase: null,
        startedAt: performance.now(),
        finishedAt: null,
        adBoostActive: false,
        surveyedCompat: null,
        selectedCategories: [...selectedCategories],
        assignedEmployeeIds: [...assignedEmployeeIds],
        perf: { wpm: 0, maxCombo: 0, accuracy: 1 },
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
      const newDone = Math.min(cur.requiredLoC, cur.doneLoC + n);
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
      set({
        current: { ...cur, finishedAt: nowMs, doneLoC: cur.requiredLoC },
        ghosts: { ...get().ghosts, [cur.scale]: newGhost },
        screen: 'release',
      });
    },

    releaseWork: (opts) => {
      const cur = get().current;
      if (!cur) throw new Error('no current project');
      const def = SCALE_BY_ID[cur.scale];
      const employees = get().employees;
      const prBonus = sumPrBonus(employees);

      // categoryHit: 選択カテゴリの affinity 合計
      let categoryHit = 0;
      for (const cid of cur.selectedCategories) {
        const cat = CATEGORY_BY_ID[cid];
        if (!cat) continue;
        categoryHit += categoryAffinity(cat, cur.genreId, cur.themeId);
      }

      // employeeHit: 割当従業員 × 選択カテゴリの specialty bonus 合計
      const employeeHit = sumEmployeeCategoryBonus(
        employees,
        cur.assignedEmployeeIds,
        cur.selectedCategories,
      );

      // performance: タイピング指標から 0..20
      const performance = computePerformanceScore(cur.perf);

      // ad bonuses: marketing/debug は perf/category レバーに乗らないがブレイクダウンの ads に集約
      let adBonus = 0;
      if (opts?.marketingAd) adBonus += 5;
      if (opts?.debugAd) adBonus += 5;

      const { Q: quality, breakdown } = computeQuality({
        scaleBase: def.baseQuality,
        categoryHit,
        employeeHit,
        performance,
        adBonus,
      });

      const trend = get().trend;
      const meta = computeMetascore(quality, cur.genreId, cur.themeId, trend);
      const launchAdActive = !!opts?.launchAd;
      const pioneer = !get().library.some(
        (w) => w.genreId === cur.genreId && w.themeId === cur.themeId,
      );
      const pioneerBonus = pioneer ? 0.3 : 0;
      const totalRevenue = computeRevenue(
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
      const initialRevenue = Math.round(totalRevenue * INITIAL_SHARE);
      const salesPool = totalRevenue - initialRevenue;
      const decayPerSec = decayRateFor(meta.metascore);
      const gainedFans = Math.max(0, fanDelta(meta.metascore, prBonus));
      const newFans = Math.max(0, get().fans + fanDelta(meta.metascore, prBonus));
      const developSec = cur.finishedAt !== null ? (cur.finishedAt - cur.startedAt) / 1000 : 0;
      const prevGhost = get().ghosts[cur.scale];
      const ghostBeaten = prevGhost !== null && developSec <= prevGhost;

      const workBreakdown: WorkBreakdown = breakdown;

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
      };

      const newLibrary = [work, ...get().library];
      const stageUnlock = computeStageUnlocks(
        get().unlockedGenres,
        get().unlockedThemes,
        newLibrary.length,
      );
      const newCategoryUnlocks = computeNewlyUnlockedCategories(
        get().unlockedCategories,
        newLibrary.length,
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
        funds: get().funds + initialRevenue,
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
  }),
  (snap) => {
    storage.save({
      version: 4,
      ...snap,
      lastSeenAt: now(),
    });
  },
  { equalityFn: (a, b) => JSON.stringify(a) === JSON.stringify(b) },
);

// 離席時刻更新
if (typeof window !== 'undefined') {
  setInterval(() => {
    const s = useGameStore.getState();
    storage.save({
      version: 4,
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
      lastSeenAt: now(),
    });
  }, 5000);
}

// 内部利用：相性の安全な取得（循環依存回避のため lazy require）
import { getCompat } from '../data/compatibility';

const getCompatPublic = (g: GenreId, t: ThemeId) => getCompat(g, t);

export const ALL_SCALES = SCALES;
export const ALL_ACHIEVEMENTS = ACHIEVEMENTS;
