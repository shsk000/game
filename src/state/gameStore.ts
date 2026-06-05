import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { Scale } from '../data/scales';
import { SCALE_BY_ID, nextLockedScale } from '../data/scales';
import type { GenreId } from '../data/genres';
import type { ThemeId } from '../data/themes';
import { generateTitle } from '../data/titleGenerator';
import type { Screen, Work, CurrentProject } from './types';
import * as storage from '../utils/storage';
import { computeMetascore, computeRevenue, polishToQuality } from '../utils/metascore';

const HIRE_COST = 200;
const AD_BOOST_FLAG_KEY = 'next_dev';

const emptyGhosts = (): Record<Scale, number | null> => ({
  mini: null,
  mobile: null,
  indie: null,
});

const persisted = storage.load();

type Actions = {
  goTo: (screen: Screen) => void;
  startProject: (genreId: GenreId, themeId: ThemeId, scale: Scale) => void;
  tickEmployees: (deltaSec: number) => void;
  addDevelopLoC: (n: number) => void;
  addPolishLoC: (n: number) => void;
  finishDevelopment: () => void;
  releaseWork: () => Work;
  hireEmployee: () => boolean;
  unlockNextScale: () => boolean;
  buyAdBoost: () => void;
  reset: () => void;
};

export type GameState = {
  screen: Screen;
  funds: number;
  employees: number;
  unlockedScales: Scale[];
  ghosts: Record<Scale, number | null>;
  library: Work[];
  current: CurrentProject | null;
  lastReleased: Work | null;
  pendingAdBoost: boolean;
} & Actions;

export const useGameStore = create<GameState>()(
  subscribeWithSelector((set, get) => ({
    screen: 'plan',
    funds: persisted?.funds ?? 0,
    employees: persisted?.employees ?? 0,
    unlockedScales: persisted?.unlockedScales ?? ['mini'],
    ghosts: persisted?.ghosts ?? emptyGhosts(),
    library: persisted?.library ?? [],
    current: null,
    lastReleased: null,
    pendingAdBoost: false,

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
        startedAt: performance.now(),
        finishedAt: null,
        adBoostActive: get().pendingAdBoost,
      };
      set({ current: project, screen: 'develop', pendingAdBoost: false });
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

    finishDevelopment: () => {
      const cur = get().current;
      if (!cur || cur.finishedAt !== null) return;
      const now = performance.now();
      const developSec = (now - cur.startedAt) / 1000;
      const prevGhost = get().ghosts[cur.scale];
      const newGhost =
        prevGhost === null || developSec < prevGhost ? developSec : prevGhost;
      set({
        current: { ...cur, finishedAt: now, doneLoC: cur.requiredLoC },
        ghosts: { ...get().ghosts, [cur.scale]: newGhost },
        screen: 'polish',
      });
    },

    releaseWork: () => {
      const cur = get().current;
      if (!cur) throw new Error('no current project');
      const def = SCALE_BY_ID[cur.scale];
      const quality = polishToQuality(def.baseQuality, cur.polishLoC);
      const meta = computeMetascore(quality, cur.genreId, cur.themeId);
      const revenue = computeRevenue(meta.metascore, cur.genreId, cur.themeId, cur.scale);
      const developSec =
        cur.finishedAt !== null ? (cur.finishedAt - cur.startedAt) / 1000 : 0;
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
        createdAt: Date.now(),
      };
      set({
        library: [work, ...get().library],
        funds: get().funds + revenue,
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

    reset: () => {
      storage.reset();
      set({
        screen: 'plan',
        funds: 0,
        employees: 0,
        unlockedScales: ['mini'],
        ghosts: emptyGhosts(),
        library: [],
        current: null,
        lastReleased: null,
        pendingAdBoost: false,
      });
    },
  })),
);

useGameStore.subscribe(
  (s) => ({
    funds: s.funds,
    employees: s.employees,
    unlockedScales: s.unlockedScales,
    ghosts: s.ghosts,
    library: s.library,
  }),
  (snap) => storage.save(snap),
  { equalityFn: (a, b) => JSON.stringify(a) === JSON.stringify(b) },
);

export const HIRE_EMPLOYEE_COST = HIRE_COST;
export const AD_BOOST_KEY = AD_BOOST_FLAG_KEY;
