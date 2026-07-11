/**
 * v0.18：リリース結果の「次の一手」アドバイス（spec §3）。
 *
 * 4 要素ブレイクダウンから**最大のボトルネックを 1 つだけ**選び、
 * プレイヤーへの日本語アドバイス 1 行に翻訳する純粋関数。
 * 「赤字が自分のせい＋改善の道筋が見える」なら継続動機になる（診断3）。
 *
 * 注：Work には残バグ数が保存されていない（品質減点は breakdown.axisBonus に
 * 溶けている）ため、残バグ専用のアドバイスは出さず 3 要素比較に徹する。
 * バグ情報を Work に載せたら分岐を足すこと。
 */
import { ADVICE_GOOD_THRESHOLD } from '../data/balance';
import type { Work } from '../state/types';

export const ADVICE_CHAR_POWER = '👥 社員の力不足が響いた。育成か採用で会社を強くしよう';
export const ADVICE_GENRE_AFFINITY = '🧩 ジャンル×テーマの相性が低い。図鑑で好相性を探そう';
export const ADVICE_PERFORMANCE = '⌨ タイピングの乱れが品質を下げた。正確に打とう';
export const ADVICE_ALL_GOOD = '🎉 死角なし。この調子で次回作へ';

/**
 * 3 要素（キャラ能力・ジャンル相性・タイピング演技。各 0..100）の最小値を
 * ボトルネックとして 1 つだけ指摘する。決定的：
 * - 最小値が ADVICE_GOOD_THRESHOLD 以上 → 死角なし
 * - 同点時の優先順位は キャラ能力 → 相性 → タイピング（固定）
 */
export const adviceFor = (work: Work): string => {
  const charPower = work.breakdown.charPower ?? 0;
  const genreAffinity = work.breakdown.genreAffinity ?? 0;
  const performance = work.breakdown.performance ?? 0;
  const min = Math.min(charPower, genreAffinity, performance);
  if (min >= ADVICE_GOOD_THRESHOLD) return ADVICE_ALL_GOOD;
  if (charPower === min) return ADVICE_CHAR_POWER;
  if (genreAffinity === min) return ADVICE_GENRE_AFFINITY;
  return ADVICE_PERFORMANCE;
};
