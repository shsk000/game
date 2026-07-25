import type { GachaRank } from '../../data/balance';
import { ROLE_EFFECT } from '../../data/balance';

/**
 * 社員表示ヘルパ（OfficeScreen / GachaReveal で共用。v0.22 でモジュールに切り出し）。
 */

// v0.16：power は 0..1 正規化。表示は ROLE_EFFECT で実効値に換算する
export const formatPower = (role: string, power: number) => {
  // 自動開発（LoC/秒）は機能自体が存在しないため表示しない。プログラマーの実効果はバグ抑制のみ。
  if (role === 'programmer') return '🐛 バグ抑制';
  if (role === 'designer')
    return `品質基礎 +${(power * ROLE_EFFECT.designerQualityBonus).toFixed(1)}`;
  return `売上 +${Math.round(power * ROLE_EFFECT.prSalesBonus * 100)}%`;
};

/** 役職ごとの絵文字とラベル色（リファレンスの社員リスト準拠） */
export const ROLE_VISUAL: Record<string, { emoji: string; color: string }> = {
  programmer: { emoji: '🧑‍💻', color: '#1d8a3c' },
  designer: { emoji: '🎨', color: '#1668a8' },
  pr: { emoji: '📣', color: '#c2447a' },
};

/** v0.22：ガチャランクの表示色（B=銅 / A=銀 / S は虹アニメの基調色） */
export const RANK_VISUAL: Record<GachaRank, { color: string; label: string }> = {
  B: { color: '#b87333', label: 'B' },
  A: { color: '#c0c8d0', label: 'A' },
  S: { color: '#f0c020', label: 'S' },
};
