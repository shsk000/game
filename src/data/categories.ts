import type { GenreId } from './genres';
import type { ThemeId } from './themes';

export type CategoryId =
  | 'graphics'
  | 'sound'
  | 'story'
  | 'gameplay'
  | 'presentation'
  | 'innovation';

export type Category = {
  id: CategoryId;
  name: string;
  emoji: string;
  genreAffinity: GenreId[];
  themeAffinity: ThemeId[];
  unlockAt: number;
};

export const CATEGORIES: Category[] = [
  {
    id: 'graphics',
    name: 'グラフィック',
    emoji: '🎨',
    genreAffinity: ['action', 'racing', 'horror'],
    themeAffinity: ['sf', 'fantasy'],
    unlockAt: 0,
  },
  {
    id: 'sound',
    name: 'サウンド',
    emoji: '🎵',
    genreAffinity: ['horror', 'rhythm', 'adventure'],
    themeAffinity: ['onsen', 'ninja'],
    unlockAt: 0,
  },
  {
    id: 'gameplay',
    name: 'ゲームプレイ',
    emoji: '🎮',
    genreAffinity: ['puzzle', 'fighting', 'roguelike'],
    themeAffinity: ['sushi', 'konbini'],
    unlockAt: 0,
  },
  {
    id: 'story',
    name: 'ストーリー',
    emoji: '📖',
    genreAffinity: ['rpg', 'adventure', 'horror'],
    themeAffinity: ['fantasy', 'medieval'],
    unlockAt: 5,
  },
  {
    id: 'presentation',
    name: '演出',
    emoji: '✨',
    genreAffinity: ['action', 'shooter'],
    themeAffinity: ['war', 'alien'],
    unlockAt: 10,
  },
  {
    id: 'innovation',
    name: '革新性',
    emoji: '💡',
    genreAffinity: ['roguelike', 'sandbox'],
    themeAffinity: ['alien', 'farming'],
    unlockAt: 20,
  },
];

export const CATEGORY_BY_ID: Record<CategoryId, Category> = CATEGORIES.reduce(
  (acc, c) => {
    acc[c.id] = c;
    return acc;
  },
  {} as Record<CategoryId, Category>,
);

export const INITIAL_CATEGORY_IDS: CategoryId[] = CATEGORIES.filter((c) => c.unlockAt === 0).map(
  (c) => c.id,
);

export const categoryAffinity = (cat: Category, g: GenreId, t: ThemeId): number => {
  let v = 2; // base
  const gHit = cat.genreAffinity.includes(g) ? 4 : 0;
  const tHit = cat.themeAffinity.includes(t) ? 3 : 0;
  if (gHit && tHit) v += 8;
  else v += gHit + tHit;
  return v;
};
