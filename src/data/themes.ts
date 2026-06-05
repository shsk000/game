export type ThemeId =
  | 'fantasy'
  | 'sf'
  | 'medieval'
  | 'modern'
  | 'war'
  | 'sushi'
  | 'farming'
  | 'salaryman'
  | 'konbini'
  | 'onsen'
  | 'ninja'
  | 'pirate'
  | 'alien'
  | 'zombie'
  | 'animal';

export type ThemeTag =
  | 'epic'
  | 'tech'
  | 'classic'
  | 'daily'
  | 'gourmet'
  | 'cute'
  | 'scary'
  | 'cool'
  | 'chill';

export type Theme = {
  id: ThemeId;
  name: string;
  emoji: string;
  tags: ThemeTag[];
  /** 解放ステージ */
  unlockStage: 1 | 2 | 3 | 4;
};

export const THEMES: Theme[] = [
  { id: 'fantasy', name: 'ファンタジー', emoji: '🏰', tags: ['epic', 'classic'], unlockStage: 1 },
  { id: 'sf', name: 'SF', emoji: '🚀', tags: ['epic', 'tech'], unlockStage: 1 },
  { id: 'sushi', name: '寿司', emoji: '🍣', tags: ['gourmet', 'daily'], unlockStage: 1 },
  { id: 'ninja', name: '忍者', emoji: '🥷', tags: ['cool', 'classic'], unlockStage: 1 },
  { id: 'onsen', name: '温泉', emoji: '♨️', tags: ['chill', 'daily'], unlockStage: 1 },
  { id: 'medieval', name: '中世', emoji: '🛡️', tags: ['classic', 'epic'], unlockStage: 2 },
  { id: 'modern', name: '現代', emoji: '🏙️', tags: ['daily'], unlockStage: 2 },
  { id: 'farming', name: '農業', emoji: '🌾', tags: ['chill', 'daily'], unlockStage: 2 },
  { id: 'animal', name: '動物', emoji: '🐾', tags: ['cute', 'chill'], unlockStage: 2 },
  { id: 'war', name: '戦争', emoji: '⚓', tags: ['epic'], unlockStage: 3 },
  { id: 'salaryman', name: '会社員', emoji: '💼', tags: ['daily'], unlockStage: 3 },
  { id: 'konbini', name: 'コンビニ', emoji: '🏪', tags: ['daily', 'gourmet'], unlockStage: 3 },
  { id: 'zombie', name: 'ゾンビ', emoji: '🧟', tags: ['scary'], unlockStage: 3 },
  { id: 'pirate', name: '海賊', emoji: '🏴‍☠️', tags: ['cool', 'epic'], unlockStage: 4 },
  { id: 'alien', name: '宇宙人', emoji: '👽', tags: ['tech', 'cute'], unlockStage: 4 },
];

export const THEME_BY_ID: Record<ThemeId, Theme> = THEMES.reduce(
  (acc, t) => {
    acc[t.id] = t;
    return acc;
  },
  {} as Record<ThemeId, Theme>,
);

export const INITIAL_THEME_IDS: ThemeId[] = THEMES.filter((t) => t.unlockStage === 1).map(
  (t) => t.id,
);
