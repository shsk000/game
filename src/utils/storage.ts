import { INITIAL_FUNDS } from '../data/balance';
import type { CategoryId } from '../data/categories';
import { INITIAL_CATEGORY_IDS } from '../data/categories';
import type { GenreId } from '../data/genres';
import type { Scale } from '../data/scales';
import type { ThemeId } from '../data/themes';
import type { Trend } from '../data/trend';
import type { Achievement, Employee, GameDate, Work, WorkBreakdown } from '../state/types';
import { INITIAL_GAME_DATE } from '../state/types';

/**
 * v5 で導入：
 *  - currentDate（ゲーム内日付・週単位）
 *  - funds / lifetimeRevenue / library.totalRevenue / library.initialRevenue /
 *    library.salesPool / library.initialSalesPool を v0.10 の桁感に合わせて ×10,000
 *  - records.bestRevenue も ×10,000
 */
const KEY = 'typing-factory:v5';
const LEGACY_KEY_V4 = 'typing-factory:v4';
const LEGACY_KEY_V3 = 'typing-factory:v3';
const LEGACY_KEY_V2 = 'typing-factory:v2';
const LEGACY_KEY_V1 = 'typing-factory:v1';

/** v0.9→v0.10 の桁変換係数。spec.md §6 参照 */
const V10_MONEY_MULTIPLIER = 10_000;

export type Records = {
  bestMetascore: number;
  bestRevenue: number;
  bestCombo: number;
  bestWPM: number;
};

export type Persisted = {
  version: 5;
  funds: number;
  lifetimeRevenue: number;
  fans: number;
  employees: Employee[];
  unlockedScales: Scale[];
  unlockedGenres: GenreId[];
  unlockedThemes: ThemeId[];
  unlockedCategories: CategoryId[];
  ghosts: Record<Scale, number | null>;
  library: Work[];
  trend: Trend | null;
  records: Records;
  achievements: Achievement[];
  tutorialDone: boolean;
  lastSeenAt: number;
  currentDate: GameDate;
};

const emptyGhostsRecord = (): Record<Scale, number | null> => ({
  mini: null,
  mobile: null,
  indie: null,
  hit: null,
  aaa: null,
});

const defaultBreakdown = (): WorkBreakdown => ({
  base: 30,
  categories: 0,
  employees: 0,
  performance: 0,
  ads: 0,
  variance: 0,
});

export const defaults = (): Persisted => ({
  version: 5,
  // v0.10 仕上げ：初期資金は balance.ts INITIAL_FUNDS（¥500 万）に統一。
  // 失敗 2-3 本で詰む緊張感（balance-design §0、§5-4）。
  funds: INITIAL_FUNDS,
  lifetimeRevenue: 0,
  fans: 0,
  employees: [],
  unlockedScales: ['mini'],
  // v0.10 仕上げ：初期解放は「人気無い・単純」ジャンル / テーマのみ。
  // ファンタジー・SF・忍者などの人気テーマは終盤解放。
  unlockedGenres: ['puzzle', 'adventure', 'simulation'],
  unlockedThemes: ['sushi', 'onsen', 'farming'],
  unlockedCategories: [...INITIAL_CATEGORY_IDS],
  ghosts: emptyGhostsRecord(),
  library: [],
  trend: null,
  records: { bestMetascore: 0, bestRevenue: 0, bestCombo: 0, bestWPM: 0 },
  achievements: [],
  tutorialDone: false,
  lastSeenAt: Date.now(),
  currentDate: { ...INITIAL_GAME_DATE },
});

type LegacyWork = Partial<Work> & {
  id: string;
  revenue?: number;
};

const ensureWorkBreakdown = (w: Work): Work => {
  if (w.breakdown) return w;
  return { ...w, breakdown: defaultBreakdown() };
};

const migrateWorkV2 = (w: LegacyWork): Work => {
  // v2 では revenue が一括加算で確定済 → v3 形式に合わせて販売は完売扱い
  const total = w.totalRevenue ?? w.revenue ?? 0;
  return {
    id: w.id,
    title: w.title ?? '',
    genreId: (w.genreId ?? 'action') as Work['genreId'],
    themeId: (w.themeId ?? 'fantasy') as Work['themeId'],
    scale: (w.scale ?? 'mini') as Work['scale'],
    quality: w.quality ?? 0,
    metascore: w.metascore ?? 0,
    isMasterpiece: w.isMasterpiece ?? false,
    developSec: w.developSec ?? 0,
    initialRevenue: total,
    salesPool: 0,
    initialSalesPool: 0,
    decayPerSec: 0,
    totalRevenue: total,
    selling: false,
    fansGained: w.fansGained ?? 0,
    ghostBeaten: w.ghostBeaten ?? false,
    launchAdUsed: w.launchAdUsed ?? false,
    pioneer: false,
    releasedAt: w.createdAt ?? Date.now(),
    createdAt: w.createdAt ?? Date.now(),
    breakdown: w.breakdown ?? defaultBreakdown(),
    selectedCategories: w.selectedCategories,
  };
};

type LegacyEmployeeV3 = Omit<Employee, 'specialties'> & {
  specialties?: Employee['specialties'];
};

const migrateEmployeeFromV3 = (e: LegacyEmployeeV3): Employee => ({
  ...e,
  specialties: e.specialties ?? [],
});

/** v0.9 → v0.10 用：work の金額を ×10,000 倍する */
const rescaleWorkForV10 = (w: Work): Work => ({
  ...w,
  initialRevenue: Math.round(w.initialRevenue * V10_MONEY_MULTIPLIER),
  salesPool: Math.round(w.salesPool * V10_MONEY_MULTIPLIER),
  initialSalesPool: Math.round(w.initialSalesPool * V10_MONEY_MULTIPLIER),
  totalRevenue: Math.round(w.totalRevenue * V10_MONEY_MULTIPLIER),
});

/** v0.9（version=4）→ v0.10（version=5）の移行。 */
const migrateFromV4 = (raw: string): Persisted | null => {
  try {
    const old = JSON.parse(raw) as Partial<Persisted> & {
      version?: number;
      employees?: LegacyEmployeeV3[];
      library?: LegacyWork[];
    };
    const base = defaults();
    const employees: Employee[] = Array.isArray(old.employees)
      ? (old.employees as LegacyEmployeeV3[]).map(migrateEmployeeFromV3)
      : [];
    const library: Work[] = Array.isArray(old.library)
      ? (old.library as LegacyWork[])
          .map((w) => ensureWorkBreakdown(migrateWorkV2(w)))
          .map(rescaleWorkForV10)
      : [];
    const oldRecords = old.records ?? base.records;
    const records: Records = {
      ...oldRecords,
      bestRevenue: Math.round((oldRecords.bestRevenue ?? 0) * V10_MONEY_MULTIPLIER),
    };
    return {
      ...base,
      funds: Math.round((old.funds ?? 0) * V10_MONEY_MULTIPLIER),
      lifetimeRevenue: Math.round((old.lifetimeRevenue ?? 0) * V10_MONEY_MULTIPLIER),
      fans: old.fans ?? 0,
      employees,
      unlockedScales: (old.unlockedScales ?? base.unlockedScales) as Scale[],
      unlockedGenres: (old.unlockedGenres ?? base.unlockedGenres) as GenreId[],
      unlockedThemes: (old.unlockedThemes ?? base.unlockedThemes) as ThemeId[],
      unlockedCategories:
        old.unlockedCategories && old.unlockedCategories.length > 0
          ? (old.unlockedCategories as CategoryId[])
          : [...INITIAL_CATEGORY_IDS],
      ghosts: { ...base.ghosts, ...(old.ghosts ?? {}) } as Record<Scale, number | null>,
      library,
      trend: old.trend ?? null,
      records,
      achievements: old.achievements ?? base.achievements,
      tutorialDone: old.tutorialDone ?? false,
      lastSeenAt: old.lastSeenAt ?? Date.now(),
      currentDate: { ...INITIAL_GAME_DATE },
    };
  } catch {
    return null;
  }
};

const migrateFromV3 = (raw: string): Persisted | null => {
  // v3 はまず v4 形式へ寄せて、その後 v5 へ
  try {
    const old = JSON.parse(raw) as Partial<Persisted> & {
      employees?: LegacyEmployeeV3[];
      library?: LegacyWork[];
    };
    const base = defaults();
    const employees: Employee[] = Array.isArray(old.employees)
      ? old.employees.map(migrateEmployeeFromV3)
      : [];
    const library: Work[] = Array.isArray(old.library)
      ? old.library.map((w) => ensureWorkBreakdown(migrateWorkV2(w))).map(rescaleWorkForV10)
      : [];
    const oldRecords = old.records ?? base.records;
    const records: Records = {
      ...oldRecords,
      bestRevenue: Math.round((oldRecords.bestRevenue ?? 0) * V10_MONEY_MULTIPLIER),
    };
    return {
      ...base,
      funds: Math.round((old.funds ?? 0) * V10_MONEY_MULTIPLIER),
      lifetimeRevenue: Math.round((old.lifetimeRevenue ?? 0) * V10_MONEY_MULTIPLIER),
      fans: old.fans ?? 0,
      employees,
      unlockedScales: (old.unlockedScales ?? base.unlockedScales) as Scale[],
      unlockedGenres: (old.unlockedGenres ?? base.unlockedGenres) as GenreId[],
      unlockedThemes: (old.unlockedThemes ?? base.unlockedThemes) as ThemeId[],
      unlockedCategories: [...INITIAL_CATEGORY_IDS],
      ghosts: { ...base.ghosts, ...(old.ghosts ?? {}) } as Record<Scale, number | null>,
      library,
      trend: old.trend ?? null,
      records,
      achievements: old.achievements ?? base.achievements,
      tutorialDone: old.tutorialDone ?? false,
      lastSeenAt: old.lastSeenAt ?? Date.now(),
      currentDate: { ...INITIAL_GAME_DATE },
    };
  } catch {
    return null;
  }
};

const migrateFromV2 = (raw: string): Persisted | null => {
  try {
    const old = JSON.parse(raw) as Partial<Persisted> & {
      employees?: number | Employee[];
      library?: LegacyWork[];
    };
    const base = defaults();
    const employees: Employee[] = Array.isArray(old.employees)
      ? (old.employees as Employee[]).map((e) => ({ ...e, specialties: e.specialties ?? [] }))
      : [];
    const library: Work[] = (old.library ?? []).map(migrateWorkV2).map(rescaleWorkForV10);
    const oldRecords = old.records ?? base.records;
    const records: Records = {
      ...oldRecords,
      bestRevenue: Math.round((oldRecords.bestRevenue ?? 0) * V10_MONEY_MULTIPLIER),
    };
    return {
      ...base,
      funds: Math.round((old.funds ?? 0) * V10_MONEY_MULTIPLIER),
      lifetimeRevenue: Math.round((old.lifetimeRevenue ?? 0) * V10_MONEY_MULTIPLIER),
      fans: old.fans ?? 0,
      employees,
      unlockedScales: (old.unlockedScales ?? ['mini']) as Scale[],
      unlockedGenres: (old.unlockedGenres ?? base.unlockedGenres) as GenreId[],
      unlockedThemes: (old.unlockedThemes ?? base.unlockedThemes) as ThemeId[],
      unlockedCategories: [...INITIAL_CATEGORY_IDS],
      ghosts: { ...base.ghosts, ...(old.ghosts ?? {}) } as Record<Scale, number | null>,
      library,
      trend: old.trend ?? null,
      records,
      currentDate: { ...INITIAL_GAME_DATE },
    };
  } catch {
    return null;
  }
};

const migrateFromV1 = (raw: string): Persisted | null => {
  try {
    const old = JSON.parse(raw) as {
      funds?: number;
      employees?: number;
      unlockedScales?: Scale[];
      ghosts?: Record<string, number | null>;
      library?: LegacyWork[];
    };
    const base = defaults();
    return {
      ...base,
      funds: Math.round((old.funds ?? 0) * V10_MONEY_MULTIPLIER),
      unlockedScales: (old.unlockedScales ?? ['mini']) as Scale[],
      unlockedCategories: [...INITIAL_CATEGORY_IDS],
      ghosts: { ...base.ghosts, ...(old.ghosts ?? {}) } as Record<Scale, number | null>,
      library: (old.library ?? []).map(migrateWorkV2).map(rescaleWorkForV10),
      currentDate: { ...INITIAL_GAME_DATE },
    };
  } catch {
    return null;
  }
};

export const load = (): Persisted | null => {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Persisted;
      if (parsed && parsed.version === 5) {
        const merged: Persisted = { ...defaults(), ...parsed };
        merged.library = merged.library.map(ensureWorkBreakdown);
        merged.employees = merged.employees.map((e) => ({
          ...e,
          specialties: e.specialties ?? [],
        }));
        merged.unlockedCategories =
          parsed.unlockedCategories && parsed.unlockedCategories.length > 0
            ? parsed.unlockedCategories
            : [...INITIAL_CATEGORY_IDS];
        merged.currentDate = parsed.currentDate ?? { ...INITIAL_GAME_DATE };
        return merged;
      }
    }
    const v4 = localStorage.getItem(LEGACY_KEY_V4);
    if (v4) {
      const migrated = migrateFromV4(v4);
      if (migrated) {
        save(migrated);
        try {
          localStorage.removeItem(LEGACY_KEY_V4);
        } catch {
          /* ignore */
        }
        return migrated;
      }
    }
    const v3 = localStorage.getItem(LEGACY_KEY_V3);
    if (v3) {
      const migrated = migrateFromV3(v3);
      if (migrated) {
        save(migrated);
        try {
          localStorage.removeItem(LEGACY_KEY_V3);
        } catch {
          /* ignore */
        }
        return migrated;
      }
    }
    const v2 = localStorage.getItem(LEGACY_KEY_V2);
    if (v2) {
      const migrated = migrateFromV2(v2);
      if (migrated) {
        save(migrated);
        try {
          localStorage.removeItem(LEGACY_KEY_V2);
        } catch {
          /* ignore */
        }
        return migrated;
      }
    }
    const legacy = localStorage.getItem(LEGACY_KEY_V1);
    if (legacy) {
      const migrated = migrateFromV1(legacy);
      if (migrated) {
        save(migrated);
        try {
          localStorage.removeItem(LEGACY_KEY_V1);
        } catch {
          /* ignore */
        }
        return migrated;
      }
    }
    return null;
  } catch {
    return null;
  }
};

export const save = (p: Persisted): void => {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* quota or disabled storage — ignore */
  }
};

export const reset = (): void => {
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem(LEGACY_KEY_V4);
    localStorage.removeItem(LEGACY_KEY_V3);
    localStorage.removeItem(LEGACY_KEY_V2);
    localStorage.removeItem(LEGACY_KEY_V1);
  } catch {
    /* ignore */
  }
};
