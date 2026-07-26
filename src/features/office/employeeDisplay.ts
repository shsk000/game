import { skillLabel } from '../../core/skills';
import type { GachaRank } from '../../data/balance';
import type { SkillId, SkillSet } from '../../state/types';

/**
 * 社員表示ヘルパ（OfficeScreen / GachaReveal で共用）。
 *
 * 表示する数値は docs/spec/glossary.md の用語に一致させる。
 * 実装ステップ1：役割ごとの固定係数の表示（「品質基礎 +5.0」）を廃止した。
 * `sumDesignerBonus` が未接続で**何も起きない数値**を画面に出していたもの。
 */

/** スキルを「グラフィック 82 ／ シナリオ 40」の形に整形（値の大きい順） */
export const formatSkills = (skills: SkillSet | undefined): string => {
  const entries = (Object.entries(skills ?? {}) as [SkillId, number][])
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return 'スキルなし';
  return entries.map(([id, v]) => `${skillLabel(id)} ${Math.round(v)}`).join(' ／ ');
};

/** スキルごとの絵文字と色（特徴ポイントの絵文字と対応させる） */
export const SKILL_VISUAL: Record<SkillId, { emoji: string; color: string }> = {
  programming: { emoji: '🕹', color: '#1d8a3c' },
  graphics: { emoji: '🎨', color: '#1668a8' },
  sound: { emoji: '🎵', color: '#b8860b' },
  scenario: { emoji: '📖', color: '#7a4fbf' },
  pr: { emoji: '📣', color: '#c2447a' },
};

/** 役職ごとの絵文字とラベル色（旧 role ベース。実装ステップ3 で SKILL_VISUAL に一本化する） */
export const ROLE_VISUAL: Record<string, { emoji: string; color: string }> = {
  programmer: { emoji: '🧑‍💻', color: '#1d8a3c' },
  designer: { emoji: '🎨', color: '#1668a8' },
  pr: { emoji: '📣', color: '#c2447a' },
};

/** ガチャランクの表示色（C=鉄 / B=銅 / A=銀 / S は虹アニメの基調色） */
export const RANK_VISUAL: Record<GachaRank, { color: string; label: string }> = {
  C: { color: '#8a8f96', label: 'C' },
  B: { color: '#b87333', label: 'B' },
  A: { color: '#c0c8d0', label: 'A' },
  S: { color: '#f0c020', label: 'S' },
};
