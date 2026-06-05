export type ThemeId = 'fantasy' | 'sf' | 'sushi' | 'ninja' | 'zombie' | 'onsen';

export type Theme = {
  id: ThemeId;
  name: string;
  emoji: string;
};

export const THEMES: Theme[] = [
  { id: 'fantasy', name: 'ファンタジー', emoji: '🏰' },
  { id: 'sf',      name: 'SF',         emoji: '🚀' },
  { id: 'sushi',   name: '寿司',         emoji: '🍣' },
  { id: 'ninja',   name: '忍者',         emoji: '🥷' },
  { id: 'zombie',  name: 'ゾンビ',       emoji: '🧟' },
  { id: 'onsen',   name: '温泉',         emoji: '♨️' },
];

export const THEME_BY_ID: Record<ThemeId, Theme> = THEMES.reduce((acc, t) => {
  acc[t.id] = t;
  return acc;
}, {} as Record<ThemeId, Theme>);
