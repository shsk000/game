import { computeOfflineEarnings } from '../core/economy';
import type { Deps } from '../core/ports';
import { defaultDeps, mulberry32 } from '../core/ports';
import { INITIAL_CATEGORY_IDS } from '../data/categories';
import { newCandidate } from '../data/employees';
import { ensureTrend } from '../data/trend';
import * as storage from '../utils/storage';
import { type GameState, useGameStore } from './gameStore';
import { INITIAL_GAME_DATE } from './types';

/**
 * 起動処理（副作用の唯一の入口。logic-architecture §3）。
 * gameStore は import しただけでは何も起こさない。セーブ読込・オフライン収益・
 * 自動保存・e2e 用の window.__gs はすべて bootGameStore() がアプリ起動時に1回だけ配線する。
 */

/** セーブ対象フィールドのスナップショット（自動保存の selector と保存処理で共用） */
const persistedSnapshot = (s: GameState): Omit<storage.Persisted, 'version' | 'lastSeenAt'> => ({
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
});

const saveNow = (s: GameState, nowMs: number) => {
  storage.save({ version: 5, ...persistedSnapshot(s), lastSeenAt: nowMs });
};

/**
 * セーブデータ → 起動時の state パッチ（純粋関数）。
 * オフライン収益の合算・トレンドの期限切れ補充・採用候補の生成・カテゴリ初期値の防御を行う。
 */
export const buildBootPatch = (
  persisted: storage.Persisted,
  deps: Deps = defaultDeps,
): Partial<GameState> => {
  const nowMs = deps.now();
  const offline = computeOfflineEarnings(persisted.lastSeenAt, persisted.library, nowMs);
  return {
    funds: persisted.funds + (offline.report?.earned ?? 0),
    lifetimeRevenue: persisted.lifetimeRevenue + (offline.report?.earned ?? 0),
    fans: persisted.fans,
    employees: persisted.employees,
    candidate: newCandidate(deps),
    unlockedScales: persisted.unlockedScales,
    unlockedGenres: persisted.unlockedGenres,
    unlockedThemes: persisted.unlockedThemes,
    // 旧セーブデータ防御：カテゴリが空のときは初期3カテゴリを補完
    unlockedCategories:
      persisted.unlockedCategories && persisted.unlockedCategories.length > 0
        ? persisted.unlockedCategories
        : [...INITIAL_CATEGORY_IDS],
    ghosts: persisted.ghosts,
    library: offline.library,
    trend: ensureTrend(persisted.trend, nowMs, deps.rng),
    records: persisted.records,
    achievements: persisted.achievements,
    tutorialDone: persisted.tutorialDone,
    offlineReport: offline.report,
    currentDate: persisted.currentDate ?? INITIAL_GAME_DATE,
  };
};

/** `?seed=NN` クエリがあれば seed 固定乱数に切り替える（e2e 決定化用） */
export const resolveBootDeps = (search: string): Deps => {
  const seedRaw = new URLSearchParams(search).get('seed');
  if (seedRaw === null) return defaultDeps;
  const seed = Number(seedRaw);
  if (!Number.isFinite(seed)) return defaultDeps;
  return { ...defaultDeps, rng: mulberry32(seed) };
};

const AUTOSAVE_INTERVAL_MS = 5_000;

/**
 * アプリ起動処理。main.tsx の render 前に1回だけ呼ぶ。
 * テストでは呼ばない（副作用ゼロで store を使える）。
 */
export const bootGameStore = (deps?: Deps): void => {
  const resolved =
    deps ?? (typeof window !== 'undefined' ? resolveBootDeps(window.location.search) : defaultDeps);

  const persisted = storage.load() ?? storage.defaults();
  useGameStore.setState(buildBootPatch(persisted, resolved));

  // 自動保存①：セーブ対象フィールドが変わったら保存
  useGameStore.subscribe(
    persistedSnapshot,
    (snap) =>
      storage.save({
        version: 5,
        ...snap,
        lastSeenAt: resolved.now(),
      }),
    {
      equalityFn: (a, b) => JSON.stringify(a) === JSON.stringify(b),
    },
  );

  // 自動保存②：離席時刻（lastSeenAt）の定期更新（オフライン収益の基準点）
  if (typeof window !== 'undefined') {
    setInterval(() => saveNow(useGameStore.getState(), resolved.now()), AUTOSAVE_INTERVAL_MS);
  }

  // e2e / dev 用：window.__gs() で現在の state を覗く
  if (typeof window !== 'undefined' && import.meta.env.DEV) {
    (window as unknown as { __gs: () => GameState }).__gs = () => useGameStore.getState();
  }
};
