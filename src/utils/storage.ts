import type { Scale } from '../data/scales';
import type { Work } from '../state/types';

const KEY = 'typing-factory:v1';

export type Persisted = {
  funds: number;
  employees: number;
  unlockedScales: Scale[];
  ghosts: Record<Scale, number | null>;
  library: Work[];
};

export const load = (): Persisted | null => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Persisted;
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
  } catch {
    /* ignore */
  }
};
