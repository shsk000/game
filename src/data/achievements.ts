import type { Achievement } from '../state/types';

export type AchievementDef = {
  id: Achievement;
  name: string;
  desc: string;
  emoji: string;
};

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first-release', name: '初リリース', desc: '初めて作品をリリース', emoji: '🎉' },
  { id: 'first-masterpiece', name: '初の神ゲー', desc: '神ゲー認定の作品を出す', emoji: '🌟' },
  { id: 'ghost-killer', name: 'ゴーストキラー', desc: 'ゴースト記録を更新する', emoji: '🏁' },
  { id: 'combo-100', name: '100コンボ', desc: '1作で100コンボを達成', emoji: '⚡' },
  { id: 'fan-1k', name: 'スター街道', desc: 'ファン1,000人を突破', emoji: '👥' },
  { id: 'million-yen', name: '初の100万円', desc: '累計売上¥1,000,000突破', emoji: '💴' },
  { id: 'collector-half', name: '図鑑半埋め', desc: '90組合せを発見', emoji: '📖' },
  { id: 'aaa-released', name: 'AAAデビュー', desc: 'AAAタイトルをリリース', emoji: '🏆' },
];

export const ACHIEVEMENT_BY_ID: Record<Achievement, AchievementDef> = ACHIEVEMENTS.reduce(
  (acc, a) => {
    acc[a.id] = a;
    return acc;
  },
  {} as Record<Achievement, AchievementDef>,
);
