import type { GenreId } from '../data/genres';
import type { Scale } from '../data/scales';
import type { ThemeId } from '../data/themes';
import type { Trend } from '../data/trend';
import type { Work } from '../state/types';

const KEY = 'typing-factory:v2';
const LEGACY_KEY_V1 = 'typing-factory:v1';

export type Records = {
  bestMetascore: number;
  bestRevenue: number;
  bestCombo: number;
  bestWPM: number;
};

export type Persisted = {
  version: 2;
  funds: number;
  lifetimeRevenue: number;
  fans: number;
  employees: number;
  unlockedScales: Scale[];
  unlockedGenres: GenreId[];
  unlockedThemes: ThemeId[];
  ghosts: Record<Scale, number | null>;
  library: Work[];
  trend: Trend | null;
  records: Records;
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
  version: 2,
  funds: 0,
  lifetimeRevenue: 0,
  fans: 0,
  employees: 0,
  unlockedScales: ['mini'],
  unlockedGenres: ['action', 'puzzle', 'rpg'],
  unlockedThemes: ['fantasy', 'sf', 'sushi', 'ninja', 'onsen'],
  ghosts: emptyGhostsRecord(),
  library: [],
  trend: null,
  records: { bestMetascore: 0, bestRevenue: 0, bestCombo: 0, bestWPM: 0 },
  lastSeenAt: Date.now(),
});

const migrateFromV1 = (raw: string): Persisted | null => {
  try {
    const old = JSON.parse(raw) as Partial<Persisted> & { ghosts?: Record<string, number | null> };
    const base = defaults();
    return {
      ...base,
      funds: old.funds ?? 0,
      employees: old.employees ?? 0,
      unlockedScales: (old.unlockedScales ?? ['mini']) as Scale[],
      ghosts: { ...base.ghosts, ...(old.ghosts ?? {}) } as Record<Scale, number | null>,
      library: old.library ?? [],
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
      if (parsed && parsed.version === 2) return parsed;
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
    localStorage.removeItem(LEGACY_KEY_V1);
  } catch {
    /* ignore */
  }
};
