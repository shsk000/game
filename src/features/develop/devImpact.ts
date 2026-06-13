import { DEV_IMPACT_THRESHOLDS, KEYS_PER_KANA, KEYSTROKE_RATING } from '../../data/balance';

/**
 * v0.11 開発フェーズ：中央パネルの「開発への影響（この入力結果）」算出（純関数）。
 *
 * 表示専用の派生値であり、最終作品の品質・バグは既存の
 * `current.perf`（wpm/maxCombo/accuracy）→ releaseWork → computeQualityV10 ルートに
 * 合流する（このファイルでは store を触らない）。
 */

export type ImpactRank = 'S' | 'A' | 'B' | 'C';

export type DevImpact = {
  /** 開発速度 +N%（wpm 由来） */
  speedPct: number;
  speedRank: ImpactRank;
  /** 品質 +N（精度由来、0..5 目安） */
  qualityDelta: number;
  qualityRank: ImpactRank;
  /** バグ率 -N%（ミス率由来、0..5 目安） */
  bugPct: number;
  bugRank: ImpactRank;
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** 入力速度 wpm（打鍵/分）→ 表示用「文字/分」 */
export const toCharsPerMin = (wpm: number): number => Math.round(wpm / KEYS_PER_KANA);

/** 開発への影響 4 指標（EXP を除く 3 指標）を算出 */
export const computeDevImpact = (args: {
  wpm: number;
  accuracy: number; // 0..1（accuracy = correct/total なので missRate = 1 - accuracy）
}): DevImpact => {
  const { wpm, accuracy } = args;
  const missRate = 1 - accuracy;

  // 開発速度：wpm 100 を基準に ±、-30〜+40% にクランプ
  const speedPct = clamp(Math.round(((wpm - 100) / 100) * 100), -30, 40);
  const st = DEV_IMPACT_THRESHOLDS.speed;
  const speedRank: ImpactRank =
    wpm >= st.S ? 'S' : wpm >= st.A ? 'A' : wpm >= st.B ? 'B' : 'C';

  // 品質：精度 0.90→0, 0.98→+4, 1.0→+5
  const qualityDelta = clamp(Math.round((accuracy - 0.9) * 50), 0, 5);
  const qt = DEV_IMPACT_THRESHOLDS.quality;
  const qualityRank: ImpactRank =
    accuracy >= qt.S ? 'S' : accuracy >= qt.A ? 'A' : accuracy >= qt.B ? 'B' : 'C';

  // バグ率：ミスが少ないほど大きく下げる（-0〜-5%）
  const bugPct = -clamp(Math.round((1 - missRate) * 5), 0, 5);
  const bt = DEV_IMPACT_THRESHOLDS.bug;
  const bugRank: ImpactRank =
    missRate <= bt.S ? 'S' : missRate <= bt.A ? 'A' : missRate <= bt.B ? 'B' : 'C';

  return { speedPct, speedRank, qualityDelta, qualityRank, bugPct, bugRank };
};

export type KeystrokeRating = 'PERFECT' | 'GREAT' | 'GOOD' | null;

/** 直近正打の打鍵間隔（ms）→ レーティング */
export const ratingForInterval = (intervalMs: number): KeystrokeRating => {
  if (intervalMs <= KEYSTROKE_RATING.PERFECT) return 'PERFECT';
  if (intervalMs <= KEYSTROKE_RATING.GREAT) return 'GREAT';
  if (intervalMs <= KEYSTROKE_RATING.GOOD) return 'GOOD';
  return null;
};

/** ランク → 表示色 */
export const rankColor = (rank: ImpactRank): string =>
  rank === 'S' ? '#ffd54a' : rank === 'A' ? '#5fd75f' : rank === 'B' ? '#7adfff' : '#c9d8ef';
