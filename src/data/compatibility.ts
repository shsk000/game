import type { GenreId } from './genres';
import { GENRE_BY_ID } from './genres';
import type { ThemeId } from './themes';
import { THEME_BY_ID } from './themes';

/**
 * タグペアの相性加点（base 1.0 に対する加減算）。
 * v0.16：正の加点を全体圧縮（オーナー指示「1.9 という値自体が高すぎる」spec v16 §3）。
 * 初期解放 9 組（puzzle/adventure/simulation × sushi/onsen/farming）が 0.85〜1.25 帯に
 * 収まるよう logic/chill/story 系を調整。相性の実効上限は 1.6（getCompat のクランプ）。
 */
const TAG_AFFINITY: Array<[string, string, number]> = [
  // ジャンル fast × テーマ
  ['fast', 'cool', 0.15],
  ['fast', 'tech', 0.1],
  // ジャンル logic × テーマ
  ['logic', 'gourmet', 0.15],
  ['logic', 'daily', 0.05],
  // ジャンル epic × テーマ
  ['epic', 'classic', 0.2],
  ['epic', 'epic', 0.2],
  // ジャンル scary × テーマ
  ['scary', 'scary', 0.25],
  ['scary', 'chill', 0.15],
  ['scary', 'cute', -0.2],
  // ジャンル chill × テーマ
  ['chill', 'chill', 0.15],
  ['chill', 'cute', 0.15],
  // ジャンル wild × テーマ
  ['wild', 'cool', 0.15],
  ['wild', 'epic', 0.1],
  // ジャンル story × テーマ
  ['story', 'classic', 0.15],
  ['story', 'epic', 0.15],
  ['story', 'daily', 0.05],
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

/**
 * 神の組合せ（手動指定）— ジャンル|テーマ → 加点。
 * v0.16：加点を +0.25〜0.35 に一律圧縮し、**初期解放の交点（puzzle|sushi +0.5）を削除**。
 * 神（実効 1.5〜1.6）は stage 3〜4 解放のジャンル/テーマの交点にのみ存在する。
 */
const DIVINE: Record<string, number> = {
  'horror|zombie': 0.35, // scary×scary 0.25 と合わせて 1.6（最高峰）
  'horror|onsen': 0.3,
  'rpg|fantasy': 0.3,
  'racing|sushi': 0.35,
  'action|ninja': 0.3,
  'simulation|salaryman': 0.3,
  'sandbox|farming': 0.25,
  'roguelike|alien': 0.3,
  'rhythm|sushi': 0.25,
  'fighting|ninja': 0.3,
  'shooter|alien': 0.3,
  'adventure|pirate': 0.3,
  'horror|konbini': 0.3,
};

/** 地雷組合せ（手動指定）。v0.16：初期 9 組にも学習用の地雷を配置 */
const BOMB: Record<string, number> = {
  'horror|animal': -0.3,
  'rhythm|war': -0.3,
  'fighting|farming': -0.2,
  'simulation|alien': -0.2,
  // v0.16：初期帯の地雷（冒険×寿司＝企画が地味）。初期 0.85〜1.25 帯の下端を作る
  'adventure|sushi': -0.2,
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
  // v0.16：上限 2.0 → 1.6 に圧縮（オーナー指示。相性は「帯内の上振れ」でありスコアの天井を作らない）
  const result = clamp(parseFloat(v.toFixed(2)), 0.7, 1.6);
  cache.set(key, result);
  return result;
};

export const compatLabel = (c: number): string => {
  if (c >= 1.5) return '🔥 神';
  if (c >= 1.2) return '👍 good';
  if (c >= 0.9) return '😐 普通';
  return '💀 地雷';
};
