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

/**
 * v0.10 仕上げ：「人気テーマは後で解放」設計に再配置。
 *  - Stage 1（初期）：地味・日常系（寿司・温泉・農業）
 *  - Stage 2：日常・かわいい系（動物・会社員・コンビニ・現代）
 *  - Stage 3：クラシック・大作系（中世・戦争）
 *  - Stage 4：超人気テーマ（ファンタジー・SF・忍者・ゾンビ・海賊・宇宙人）
 */
export const THEMES: Theme[] = [
  { id: 'sushi', name: '寿司', emoji: '🍣', tags: ['gourmet', 'daily'], unlockStage: 1 },
  { id: 'onsen', name: '温泉', emoji: '♨️', tags: ['chill', 'daily'], unlockStage: 1 },
  { id: 'farming', name: '農業', emoji: '🌾', tags: ['chill', 'daily'], unlockStage: 1 },
  { id: 'animal', name: '動物', emoji: '🐾', tags: ['cute', 'chill'], unlockStage: 2 },
  { id: 'salaryman', name: '会社員', emoji: '💼', tags: ['daily'], unlockStage: 2 },
  { id: 'konbini', name: 'コンビニ', emoji: '🏪', tags: ['daily', 'gourmet'], unlockStage: 2 },
  { id: 'modern', name: '現代', emoji: '🏙️', tags: ['daily'], unlockStage: 2 },
  { id: 'medieval', name: '中世', emoji: '🛡️', tags: ['classic', 'epic'], unlockStage: 3 },
  { id: 'war', name: '戦争', emoji: '⚓', tags: ['epic'], unlockStage: 3 },
  { id: 'fantasy', name: 'ファンタジー', emoji: '🏰', tags: ['epic', 'classic'], unlockStage: 4 },
  { id: 'sf', name: 'SF', emoji: '🚀', tags: ['epic', 'tech'], unlockStage: 4 },
  { id: 'ninja', name: '忍者', emoji: '🥷', tags: ['cool', 'classic'], unlockStage: 4 },
  { id: 'zombie', name: 'ゾンビ', emoji: '🧟', tags: ['scary'], unlockStage: 4 },
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
