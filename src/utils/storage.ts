import type { GenreId } from '../data/genres';
import type { Scale } from '../data/scales';
import type { ThemeId } from '../data/themes';
import type { Trend } from '../data/trend';
import type { Achievement, Employee, Work } from '../state/types';

const KEY = 'typing-factory:v3';
const LEGACY_KEY_V2 = 'typing-factory:v2';
const LEGACY_KEY_V1 = 'typing-factory:v1';

export type Records = {
  bestMetascore: number;
  bestRevenue: number;
  bestCombo: number;
  bestWPM: number;
};

export type Persisted = {
  version: 3;
  funds: number;
  lifetimeRevenue: number;
  fans: number;
  employees: Employee[];
  unlockedScales: Scale[];
  unlockedGenres: GenreId[];
  unlockedThemes: ThemeId[];
  ghosts: Record<Scale, number | null>;
  library: Work[];
  trend: Trend | null;
  records: Records;
  achievements: Achievement[];
  tutorialDone: boolean;
  lastSeenAt: number;
};

const emptyGhostsRecord = (): Record<Scale, number | null> => ({
  mini: null,
  mobile: null,
  indie: null,
  hit: null,
  aaa: null,
});

export const defaults = (): Persisted => ({
  version: 3,
  funds: 0,
  lifetimeRevenue: 0,
  fans: 0,
  employees: [],
  unlockedScales: ['mini'],
  unlockedGenres: ['action', 'puzzle', 'rpg'],
  unlockedThemes: ['fantasy', 'sf', 'sushi', 'ninja', 'onsen'],
  ghosts: emptyGhostsRecord(),
  library: [],
  trend: null,
  records: { bestMetascore: 0, bestRevenue: 0, bestCombo: 0, bestWPM: 0 },
  achievements: [],
  tutorialDone: false,
  lastSeenAt: Date.now(),
});

type LegacyWork = Partial<Work> & {
  id: string;
  revenue?: number;
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
  };
};

const migrateFromV2 = (raw: string): Persisted | null => {
  try {
    const old = JSON.parse(raw) as Partial<Persisted> & {
      employees?: number | Employee[];
      library?: LegacyWork[];
    };
    const base = defaults();
    const employees: Employee[] = Array.isArray(old.employees) ? (old.employees as Employee[]) : [];
    return {
      ...base,
      funds: old.funds ?? 0,
      lifetimeRevenue: old.lifetimeRevenue ?? 0,
      fans: old.fans ?? 0,
      employees,
      unlockedScales: (old.unlockedScales ?? ['mini']) as Scale[],
      unlockedGenres: (old.unlockedGenres ?? base.unlockedGenres) as GenreId[],
      unlockedThemes: (old.unlockedThemes ?? base.unlockedThemes) as ThemeId[],
      ghosts: { ...base.ghosts, ...(old.ghosts ?? {}) } as Record<Scale, number | null>,
      library: (old.library ?? []).map(migrateWorkV2),
      trend: old.trend ?? null,
      records: old.records ?? base.records,
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
      funds: old.funds ?? 0,
      unlockedScales: (old.unlockedScales ?? ['mini']) as Scale[],
      ghosts: { ...base.ghosts, ...(old.ghosts ?? {}) } as Record<Scale, number | null>,
      library: (old.library ?? []).map(migrateWorkV2),
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
      if (parsed && parsed.version === 3) {
        // 旧セーブで achievements / tutorialDone が無い場合は補完
        return { ...defaults(), ...parsed };
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
    localStorage.removeItem(LEGACY_KEY_V2);
    localStorage.removeItem(LEGACY_KEY_V1);
  } catch {
    /* ignore */
  }
};
