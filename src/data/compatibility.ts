import type { GenreId, GenreTag } from './genres';
import { GENRE_BY_ID } from './genres';
import type { ThemeId, ThemeTag } from './themes';
import { THEME_BY_ID } from './themes';

/**
 * ジャンル × テーマの相性（`docs/spec/scoring.md §2-2`）。
 *
 * ## 何を直したか（2026-07-29）
 *
 * オーナー指摘：「バランスが悪くて組み合わせを見つける面白さあまりない。右側とか1.0が多いし」
 *
 * 実測すると **756組のうち185組（24%）がちょうど 1.00**、つまり加点も減点も1つも
 * 当たっていなかった。ゾンビ列は27ジャンル中24個が 1.00。原因は3つ：
 *
 * 1. **タグ相性表がスカスカだった。** 7×9＝63通りのうち定義は22通りだけで、
 *    残り41通りは黙って 0 になっていた
 * 2. **加点が Σ（合計）だった。** タグが1つしかないテーマ（ゾンビ・お化け屋敷・戦争・
 *    サラリーマン）は当たりうるペアが最大2つ＝**構造的に平坦**。表を埋めても直らない
 * 3. **タグ順に意味が無かった。** 同じタグ集合なら同じ行になり、27ジャンル→23行 /
 *    28テーマ→25列に潰れていた（パズルと育成シムは相性が1マスも違わなかった）
 *
 * ## いまの式
 *
 * ```
 * 素点 = 1.0 + ( Σ w_g·w_t·v(gTag,tTag) / Σ w_g·w_t ) × TAG_SPREAD
 * 相性 = clamp( 素点 + DIVINE + BOMB , 0.70, 1.60 )
 *
 *   w = tags[0]（主）… 2 ／ tags[1]（副）… 1
 * ```
 *
 * **合計ではなく加重平均**なので、タグが1つでも2つでも同じ振れ幅を持つ。
 * `TAG_AFFINITY` は 8×9＝72マス**全部**定義する（未定義のマスを作らない）。
 *
 * `DIVINE` / `BOMB` は「タグでは説明できない例外」の枠として残す。
 * 🔥神に届くのはここに手書きした組合せだけ（＝探索のロマンは手作業で作る）。
 */

/** 主タグ（tags[0]）と副タグ（tags[1]）の重み。順序に意味を持たせるためのもの */
const TAG_WEIGHTS = [2, 1] as const;

/**
 * タグ相性の加重平均（−0.25〜+0.25）を素点の振れ幅へ引き伸ばす係数。
 * 1.4 だと素点は 0.65〜1.35 に収まり、DIVINE/BOMB を足して 0.70〜1.60 に入る。
 */
const TAG_SPREAD = 1.4;

/**
 * タグ相性表。**8×9＝72マスすべてを定義する**（空白＝0 を作らない）。
 * 値は `+0.25 / +0.15 / +0.05 / -0.05 / -0.15 / -0.25` の6段だけ。
 *
 * 各行の合計はおおよそ 0（どのタグも「好き2つ・嫌い2つ」を持つ）。
 * こうしておくと、どのジャンルを選んでも「合うテーマ」と「合わないテーマ」が同数あり、
 * 特定のジャンルだけが有利／不利にならない。
 */
const TAG_AFFINITY: Record<GenreTag, Record<ThemeTag, number>> = {
  //          gourmet daily  chill  cute   classic epic   tech   cool   scary
  fast: { gourmet: 0.05, daily: -0.15, chill: -0.25, cute: 0.05, classic: -0.05, epic: 0.05, tech: 0.15, cool: 0.25, scary: -0.05 },
  wild: { gourmet: -0.05, daily: -0.15, chill: -0.25, cute: -0.15, classic: 0.05, epic: 0.25, tech: 0.05, cool: 0.25, scary: 0.05 },
  logic: { gourmet: 0.25, daily: 0.15, chill: 0.05, cute: -0.05, classic: 0.05, epic: -0.15, tech: 0.15, cool: -0.25, scary: -0.15 },
  chill: { gourmet: 0.15, daily: 0.25, chill: 0.25, cute: 0.15, classic: -0.05, epic: -0.25, tech: -0.15, cool: -0.15, scary: -0.25 },
  epic: { gourmet: -0.25, daily: -0.25, chill: -0.15, cute: -0.15, classic: 0.25, epic: 0.25, tech: 0.15, cool: 0.15, scary: 0.05 },
  story: { gourmet: -0.05, daily: 0.05, chill: 0.05, cute: 0.15, classic: 0.25, epic: 0.15, tech: -0.25, cool: -0.25, scary: -0.05 },
  scary: { gourmet: -0.15, daily: -0.05, chill: 0.15, cute: -0.25, classic: 0.15, epic: -0.05, tech: 0.05, cool: -0.05, scary: 0.25 },
  cute: { gourmet: 0.15, daily: 0.15, chill: 0.15, cute: 0.25, classic: -0.15, epic: -0.25, tech: -0.15, cool: 0.05, scary: -0.25 },
};

/** タグ相性の加重平均（−0.25〜+0.25）。タグ数によらず同じ尺度になる */
const tagAffinityMean = (gTags: GenreTag[], tTags: ThemeTag[]): number => {
  let sum = 0;
  let weight = 0;
  gTags.forEach((gt, gi) => {
    const wg = TAG_WEIGHTS[gi] ?? 1;
    tTags.forEach((tt, ti) => {
      const wt = TAG_WEIGHTS[ti] ?? 1;
      sum += wg * wt * TAG_AFFINITY[gt][tt];
      weight += wg * wt;
    });
  });
  return weight === 0 ? 0 : sum / weight;
};

/**
 * 🔥神の組合せ（手動指定）。**タグでは説明できない例外**の枠。
 * 素点にこれを足して 1.45 以上（＝神の帯）へ押し上げる。
 *
 * ここに載っているものだけが神になる＝「探索のロマン」は手作業で作る、という設計。
 * 一覧はオーナーが差し替えられる（`docs/plans/20260725-score-redesign/report.md`）。
 */
const DIVINE: Record<string, number> = {
  // 既存13組（v0.16 から維持）
  'horror|zombie': 0.35,
  'horror|onsen': 0.45,
  'rpg|fantasy': 0.3,
  'racing|sushi': 0.6,
  'action|ninja': 0.35,
  'simulation|salaryman': 0.5,
  'sandbox|farming': 0.35,
  'roguelike|alien': 0.5,
  'rhythm|sushi': 0.45,
  'fighting|ninja': 0.35,
  'shooter|alien': 0.45,
  'adventure|pirate': 0.45,
  'horror|konbini': 0.5,
  // 追加（stage2 の交点にも当たりを置き、中盤で発見が起きるようにする）
  'fishing|onsen': 0.45,
  'visualnovel|school': 0.35,
  'survival|zombie': 0.35,
  'cardgame|library': 0.4,
  'quiz|school': 0.45,
  'raisingsim|animal': 0.35,
  'platformer|amusementpark': 0.45,
  'escapegame|hauntedhouse': 0.35,
};

/**
 * 💀地雷の組合せ（手動指定）。噛み合わない企画をタグの外から作る枠。
 * 素点にこれを足して 0.82 以下（＝地雷の帯の下端）へ落とす。
 */
const BOMB: Record<string, number> = {
  'horror|animal': -0.3,
  'rhythm|war': -0.3,
  'fighting|farming': -0.25,
  'simulation|alien': -0.2,
  // 初期9組の学習用の地雷（冒険×寿司＝企画が地味）。ここが初期帯の下端になる
  'adventure|sushi': -0.25,
};

/**
 * ヒット区分のラベルと同じく、相性にも帯がある。
 * 帯を変えるときは図鑑の凡例・背景色（`CollectionScreen`）も必ず同時に直すこと
 * （3箇所がバラバラで、凡例だけ到達不能な「1.7+」を載せていた事故がある）。
 */
export const COMPAT_TIERS = { divine: 1.45, good: 1.15, normal: 0.85 } as const;

/** 相性の下限・上限。ここを変えると `compatBonusFor` の写像も見直しが要る */
export const COMPAT_RANGE = { min: 0.7, max: 1.6 } as const;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

const cache = new Map<string, number>();

export const getCompat = (g: GenreId, t: ThemeId): number => {
  const key = `${g}|${t}`;
  const cached = cache.get(key);
  if (cached !== undefined) return cached;
  const genre = GENRE_BY_ID[g];
  const theme = THEME_BY_ID[t];
  const base = 1.0 + tagAffinityMean(genre.tags, theme.tags) * TAG_SPREAD;
  const v = base + (DIVINE[key] ?? 0) + (BOMB[key] ?? 0);
  const result = clamp(parseFloat(v.toFixed(2)), COMPAT_RANGE.min, COMPAT_RANGE.max);
  cache.set(key, result);
  return result;
};

export const compatLabel = (c: number): string => {
  if (c >= COMPAT_TIERS.divine) return '🔥 神';
  if (c >= COMPAT_TIERS.good) return '👍 good';
  if (c >= COMPAT_TIERS.normal) return '😐 普通';
  return '💀 地雷';
};
