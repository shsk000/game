import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { Scale } from '../data/scales';
import { SCALE_BY_ID, nextLockedScale, SCALES } from '../data/scales';
import type { GenreId } from '../data/genres';
import { GENRES } from '../data/genres';
import type { ThemeId } from '../data/themes';
import { THEMES } from '../data/themes';
import { generateTitle } from '../data/titleGenerator';
import { ensureTrend, type Trend } from '../data/trend';
import type { Screen, Work, CurrentProject } from './types';
import * as storage from '../utils/storage';
import type { Records } from '../utils/storage';
import {
  computeMetascore,
  computeRevenue,
  polishToQuality,
  fanDelta,
} from '../utils/metascore';

const HIRE_COST = 200;

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
  const newGenres = GENRES
    .filter((g) => g.unlockStage <= stage && !currentGenres.includes(g.id))
    .map((g) => g.id);
  const newThemes = THEMES
    .filter((t) => t.unlockStage <= stage && !currentThemes.includes(t.id))
    .map((t) => t.id);
  return { unlocked: newGenres.length + newThemes.length, newGenres, newThemes };
};

type OfflineReport = {
  earned: number;
  awaySec: number;
};

type Actions = {
  goTo: (screen: Screen) => void;
  startProject: (genreId: GenreId, themeId: ThemeId, scale: Scale) => void;
  tickEmployees: (deltaSec: number) => void;
  addDevelopLoC: (n: number) => void;
  addPolishLoC: (n: number) => void;
  applyComboToPolish: (bonus: number) => void;
  reportCombo: (combo: number) => void;
  reportWPM: (wpm: number) => void;
  finishDevelopment: () => void;
  releaseWork: (opts?: { launchAd?: boolean }) => Work;
  hireEmployee: () => boolean;
  unlockNextScale: () => boolean;
  buyAdBoost: () => void;
  clearOfflineReport: () => void;
  reset: () => void;
};

export type GameState = {
  screen: Screen;
  funds: number;
  lifetimeRevenue: number;
  fans: number;
  employees: number;
  unlockedScales: Scale[];
  unlockedGenres: GenreId[];
  unlockedThemes: ThemeId[];
  ghosts: Record<Scale, number | null>;
  library: Work[];
  trend: Trend;
  records: Records;
  current: CurrentProject | null;
  lastReleased: Work | null;
  pendingAdBoost: boolean;
  offlineReport: OfflineReport | null;
} & Actions;

const now = () => Date.now();

const computeOfflineEarnings = (lastSeenAt: number, fans: number): OfflineReport | null => {
  if (!lastSeenAt) return null;
  const awaySec = Math.max(0, (now() - lastSeenAt) / 1000);
  // 5分以上離席していた場合のみ、ファンが収益を運んでくる
  if (awaySec < 300) return null;
  const cappedSec = Math.min(awaySec, 6 * 60 * 60); // 上限 6時間
  const ratePerSec = Math.sqrt(Math.max(0, fans)) * 0.05;
  const earned = Math.round(ratePerSec * cappedSec);
  if (earned <= 0) return null;
  return { earned, awaySec: cappedSec };
};

const offlineReport = computeOfflineEarnings(persisted.lastSeenAt, persisted.fans);
const initialTrend = ensureTrend(persisted.trend, now());

export const useGameStore = create<GameState>()(
  subscribeWithSelector((set, get) => ({
    screen: 'plan',
    funds: persisted.funds + (offlineReport?.earned ?? 0),
    lifetimeRevenue: persisted.lifetimeRevenue + (offlineReport?.earned ?? 0),
    fans: persisted.fans,
    employees: persisted.employees,
    unlockedScales: persisted.unlockedScales,
    unlockedGenres: persisted.unlockedGenres,
    unlockedThemes: persisted.unlockedThemes,
    ghosts: persisted.ghosts,
    library: persisted.library,
    trend: initialTrend,
    records: persisted.records,
    current: null,
    lastReleased: null,
    pendingAdBoost: false,
    offlineReport,

    goTo: (screen) => set({ screen }),

    startProject: (genreId, themeId, scale) => {
      const def = SCALE_BY_ID[scale];
      const title = generateTitle(genreId, themeId);
      const project: CurrentProject = {
        title,
        genreId,
        themeId,
        scale,
        requiredLoC: def.requiredLoC,
        doneLoC: 0,
        polishLoC: 0,
        maxCombo: 0,
        comboBonus: 0,
        startedAt: performance.now(),
        finishedAt: null,
        adBoostActive: get().pendingAdBoost,
      };
      set({
        current: project,
        screen: 'develop',
        pendingAdBoost: false,
        trend: ensureTrend(get().trend, now()),
      });
    },

    tickEmployees: (deltaSec) => {
      const cur = get().current;
      if (!cur || cur.finishedAt !== null) return;
      const employees = get().employees;
      if (employees <= 0 && !cur.adBoostActive) return;
      const rate = employees * 0.5 + (cur.adBoostActive ? 0.5 : 0);
      const add = rate * deltaSec;
      const newDone = Math.min(cur.requiredLoC, cur.doneLoC + add);
      set({ current: { ...cur, doneLoC: newDone } });
    },

    addDevelopLoC: (n) => {
      const cur = get().current;
      if (!cur || cur.finishedAt !== null) return;
      const newDone = Math.min(cur.requiredLoC, cur.doneLoC + n);
      set({ current: { ...cur, doneLoC: newDone } });
    },

    addPolishLoC: (n) => {
      const cur = get().current;
      if (!cur) return;
      set({ current: { ...cur, polishLoC: cur.polishLoC + n } });
    },

    applyComboToPolish: (bonus) => {
      const cur = get().current;
      if (!cur) return;
      set({ current: { ...cur, comboBonus: Math.max(cur.comboBonus, Math.min(0.5, bonus)) } });
    },

    reportCombo: (combo) => {
      const cur = get().current;
      if (cur && combo > cur.maxCombo) {
        set({ current: { ...cur, maxCombo: combo } });
      }
      const rec = get().records;
      if (combo > rec.bestCombo) {
        set({ records: { ...rec, bestCombo: combo } });
      }
    },

    reportWPM: (wpm) => {
      const rec = get().records;
      if (wpm > rec.bestWPM) {
        set({ records: { ...rec, bestWPM: Math.round(wpm) } });
      }
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
        screen: 'polish',
      });
    },

    releaseWork: (opts) => {
      const cur = get().current;
      if (!cur) throw new Error('no current project');
      const def = SCALE_BY_ID[cur.scale];
      const quality = polishToQuality(def.baseQuality, cur.polishLoC, cur.comboBonus);
      const trend = get().trend;
      const meta = computeMetascore(quality, cur.genreId, cur.themeId, trend);
      const launchAdActive = !!opts?.launchAd;
      const revenue = computeRevenue(
        meta.metascore, cur.genreId, cur.themeId, cur.scale, trend, get().fans, launchAdActive,
      );
      const gainedFans = Math.max(0, fanDelta(meta.metascore));
      const newFans = Math.max(0, get().fans + fanDelta(meta.metascore));
      const developSec =
        cur.finishedAt !== null ? (cur.finishedAt - cur.startedAt) / 1000 : 0;
      const prevGhost = get().ghosts[cur.scale];
      // 完成時に再計算（finishDevelopment ですでに更新しているが、ライブラリ記録用に再判定）
      const ghostBeaten = prevGhost !== null && developSec <= prevGhost;

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
        revenue,
        fansGained: gainedFans,
        ghostBeaten,
        launchAdUsed: launchAdActive,
        createdAt: Date.now(),
      };

      // 記録更新
      const rec = get().records;
      const newRec: Records = {
        bestMetascore: Math.max(rec.bestMetascore, meta.metascore),
        bestRevenue: Math.max(rec.bestRevenue, revenue),
        bestCombo: rec.bestCombo,
        bestWPM: rec.bestWPM,
      };

      // ライブラリ更新後のアンロック判定
      const newLibrary = [work, ...get().library];
      const stageUnlock = computeStageUnlocks(
        get().unlockedGenres,
        get().unlockedThemes,
        newLibrary.length,
      );

      set({
        library: newLibrary,
        funds: get().funds + revenue,
        lifetimeRevenue: get().lifetimeRevenue + revenue,
        fans: newFans,
        records: newRec,
        unlockedGenres: [...get().unlockedGenres, ...stageUnlock.newGenres],
        unlockedThemes: [...get().unlockedThemes, ...stageUnlock.newThemes],
        lastReleased: work,
        current: null,
        screen: 'release',
      });
      return work;
    },

    hireEmployee: () => {
      if (get().funds < HIRE_COST) return false;
      set({ funds: get().funds - HIRE_COST, employees: get().employees + 1 });
      return true;
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

    buyAdBoost: () => {
      set({ pendingAdBoost: true });
    },

    clearOfflineReport: () => set({ offlineReport: null }),

    reset: () => {
      storage.reset();
      const d = storage.defaults();
      set({
        screen: 'plan',
        funds: d.funds,
        lifetimeRevenue: d.lifetimeRevenue,
        fans: d.fans,
        employees: d.employees,
        unlockedScales: d.unlockedScales,
        unlockedGenres: d.unlockedGenres,
        unlockedThemes: d.unlockedThemes,
        ghosts: d.ghosts,
        library: d.library,
        trend: ensureTrend(null, now()),
        records: d.records,
        current: null,
        lastReleased: null,
        pendingAdBoost: false,
        offlineReport: null,
      });
    },
  })),
);

// セーブ：永続化対象スライスが変わるたびに保存
useGameStore.subscribe(
  (s) => ({
    funds: s.funds,
    lifetimeRevenue: s.lifetimeRevenue,
    fans: s.fans,
    employees: s.employees,
    unlockedScales: s.unlockedScales,
    unlockedGenres: s.unlockedGenres,
    unlockedThemes: s.unlockedThemes,
    ghosts: s.ghosts,
    library: s.library,
    trend: s.trend,
    records: s.records,
  }),
  (snap) => {
    storage.save({
      version: 2,
      ...snap,
      lastSeenAt: now(),
    });
  },
  { equalityFn: (a, b) => JSON.stringify(a) === JSON.stringify(b) },
);

// 離席時刻の定期更新（5秒に1回程度で十分）
if (typeof window !== 'undefined') {
  setInterval(() => {
    const s = useGameStore.getState();
    storage.save({
      version: 2,
      funds: s.funds,
      lifetimeRevenue: s.lifetimeRevenue,
      fans: s.fans,
      employees: s.employees,
      unlockedScales: s.unlockedScales,
      unlockedGenres: s.unlockedGenres,
      unlockedThemes: s.unlockedThemes,
      ghosts: s.ghosts,
      library: s.library,
      trend: s.trend,
      records: s.records,
      lastSeenAt: now(),
    });
  }, 5000);
}

export const HIRE_EMPLOYEE_COST = HIRE_COST;
export const ALL_SCALES = SCALES;
