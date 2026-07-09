import type { GenreId } from './genres';
import { GENRE_BY_ID } from './genres';
import type { ThemeId } from './themes';
import { THEME_BY_ID } from './themes';

/** タグペアの相性加点（base 1.0 に対する加減算） */
const TAG_AFFINITY: Array<[string, string, number]> = [
  // ジャンル fast × テーマ
  ['fast', 'cool', 0.2],
  ['fast', 'tech', 0.15],
  // ジャンル logic × テーマ
  ['logic', 'gourmet', 0.25],
  ['logic', 'daily', 0.15],
  // ジャンル epic × テーマ
  ['epic', 'classic', 0.3],
  ['epic', 'epic', 0.3],
  // ジャンル scary × テーマ
  ['scary', 'scary', 0.4],
  ['scary', 'chill', 0.2],
  ['scary', 'cute', -0.2],
  // ジャンル chill × テーマ
  ['chill', 'chill', 0.25],
  ['chill', 'cute', 0.2],
  // ジャンル wild × テーマ
  ['wild', 'cool', 0.2],
  ['wild', 'epic', 0.15],
  // ジャンル story × テーマ
  ['story', 'classic', 0.2],
  ['story', 'epic', 0.2],
  ['story', 'daily', 0.1],
  // v0.14：ミスマッチ（噛み合わない企画は 1.0 未満に落ちる）。
  // 旧状態はマイナスが scary×cute の 1 個だけで、180 組中 1.0 未満が 4 組しか無く
  // 「地雷を踏む学習」が機能していなかった（オーナー指摘）。約 24% が 1.0 未満になる配分。
  // ※ DIVINE（racing|sushi 等）は救済されるので「例外の発見」はむしろ際立つ
  ['fast', 'daily', -0.15], // スピード系 × 日常 ＝ 企画が地味
  ['logic', 'epic', -0.15], // 理屈系 × 壮大 ＝ 食い合わせが悪い
  ['wild', 'daily', -0.1], // 豪快系 × 日常 ＝ 盛り上がらない
  ['epic', 'gourmet', -0.15], // 壮大 × グルメ ＝ 空回り
  ['scary', 'daily', -0.1], // ホラー × 日常 ＝ 怖くない
];

const tagPairBonus = (gTags: string[], tTags: string[]): number => {
  let bonus = 0;
  for (const gt of gTags) {
    for (const tt of tTags) {
      for (const [a, b, v] of TAG_AFFINITY) {
        if (a === gt && b === tt) bonus += v;
      }
    }
  }
  return bonus;
};

/** 神の組合せ（手動指定） — ジャンル|テーマ → 加点 */
const DIVINE: Record<string, number> = {
  'horror|zombie': 0.6,
  'horror|onsen': 0.5,
  'rpg|fantasy': 0.6,
  'racing|sushi': 0.7,
  'action|ninja': 0.6,
  'puzzle|sushi': 0.5,
  'simulation|salaryman': 0.6,
  'sandbox|farming': 0.5,
  'roguelike|alien': 0.5,
  'rhythm|sushi': 0.4,
  'fighting|ninja': 0.5,
  'shooter|alien': 0.5,
  'adventure|pirate': 0.5,
  'horror|konbini': 0.6,
};

/** 地雷組合せ（手動指定） */
const BOMB: Record<string, number> = {
  'horror|animal': -0.3,
  'rhythm|war': -0.3,
  'fighting|farming': -0.2,
  'simulation|alien': -0.2,
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

const cache = new Map<string, number>();

export const getCompat = (g: GenreId, t: ThemeId): number => {
  const key = `${g}|${t}`;
  const cached = cache.get(key);
  if (cached !== undefined) return cached;
  const genre = GENRE_BY_ID[g];
  const theme = THEME_BY_ID[t];
  let v = 1.0;
  v += tagPairBonus(genre.tags, theme.tags);
  v += DIVINE[key] ?? 0;
  v += BOMB[key] ?? 0;
  const result = clamp(parseFloat(v.toFixed(2)), 0.7, 2.0);
  cache.set(key, result);
  return result;
};

export const compatLabel = (c: number): string => {
  if (c >= 1.7) return '🔥 神';
  if (c >= 1.3) return '👍 good';
  if (c >= 0.9) return '😐 普通';
  return '💀 地雷';
};
