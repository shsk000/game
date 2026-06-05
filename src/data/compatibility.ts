import type { GenreId } from './genres';
import type { ThemeId } from './themes';

const TABLE: Record<string, number> = {
  'horror|zombie': 1.7,
  'horror|onsen':  1.5,
  'horror|sushi':  0.8,
  'horror|fantasy': 1.2,
  'horror|sf':     1.1,
  'horror|ninja':  1.3,

  'rpg|fantasy':   1.6,
  'rpg|sf':        1.3,
  'rpg|ninja':     1.4,
  'rpg|sushi':     0.9,
  'rpg|onsen':     0.8,
  'rpg|zombie':    1.2,

  'action|ninja':  1.7,
  'action|zombie': 1.4,
  'action|sf':     1.3,
  'action|fantasy': 1.2,
  'action|sushi':  0.9,
  'action|onsen':  0.7,

  'puzzle|sushi':  1.5,
  'puzzle|onsen':  1.3,
  'puzzle|sf':     1.2,
  'puzzle|fantasy': 1.1,
  'puzzle|ninja':  1.0,
  'puzzle|zombie': 0.9,
};

export const getCompat = (g: GenreId, t: ThemeId): number =>
  TABLE[`${g}|${t}`] ?? 1.0;

export const compatLabel = (c: number): string => {
  if (c >= 1.6) return '🔥 神';
  if (c >= 1.3) return '👍 good';
  if (c >= 0.9) return '😐 普通';
  return '💀 地雷';
};
