import { SCALE_BALANCE, salesMultiplierForScore } from '../data/balance';
import type { GenreId } from '../data/genres';
import type { Scale } from '../data/scales';
import type { ThemeId } from '../data/themes';
import type { Trend } from '../data/trend';



/**
 * v0.10 仕上げ §5-1, §5-2：売上計算。
 *
 *   revenue = baseRevenue × salesMultiplierForScore(metascore) × softBonus
 *
 *   softBonus は fan / pr / pioneer の独立倍率の積（案B。共有キャップは廃止）。
 *
 * 旧バージョンは compat / trend / fan / launch / pr / pioneer を全て乗算でかけていたため、
 * normal 帯でも合算で ×5〜10 になり、設計の想定売上が簡単に何倍にも化けていた。
 *
 * 対策：
 *   1. compat は既に genreAffinity → quality → metascore 経由で組み込み済み → ここでは掛けない
 *   2. trend はスコア側（trendScoreBonus）＋ release.ts の trendSalesMultiplier に一本化
 *   3. launch（ローンチ広告）は発売後リワードなのでこの式から分離（applyLaunchAd）
 */
export const computeRevenue = (
  metascore: number,
  _genreId: GenreId,
  _themeId: ThemeId,
  scale: Scale,
  _trend: Trend | null,
  fans: number,
  prBonus = 0,
  pioneerBonus = 0,
): number => {
  const baseRevenue = SCALE_BALANCE[scale].baseRevenue;
  const tierMul = salesMultiplierForScore(metascore);

  // 案B：共有の +20% 上限を廃止し、各ボーナスを独立の倍率として掛ける（表示どおり効く）。
  //  - 広報(prBonus) は上限なし（+11%×2人 = 約+22% が本当に効く）
  //  - ファン / 初回組合せ もそれぞれ独立に上乗せ
  // ※ トレンド／マーケ広告の売上倍率は release.ts 側で別途掛ける（同じく上限の外）。
  // ※ ローンチ広告は**発売後**に視聴するリワードなので、ここ（発売時の売上算出）には居ない。
  //    core/release.ts の applyLaunchAd が確定済みの初動に後から掛ける（下記コメントも参照）。
  // ファンボーナスは上限なし（オーナー判断 2026-07-25。旧実装は +0.15 で頭打ち＝ファン 3600 人で
  // 打ち止めになり、それ以上ファンを増やしても売上に一切効かなかった）。
  // √ なので伸びは緩やか：1万人 +25% / 4万人 +50% / 16万人 +100%。
  const fanBonus = Math.sqrt(Math.max(0, fans)) / 400;
  const softMul = (1 + Math.max(0, prBonus)) * (1 + fanBonus) * (1 + Math.max(0, pioneerBonus));

  const v = baseRevenue * tierMul * softMul;
  return Math.max(0, Math.round(v));
};

export const scoreFlavor = (m: number): string => {
  if (m >= 90) return '今年の傑作';
  if (m >= 70) return '良作';
  if (m >= 50) return '平凡';
  if (m >= 30) return '惜しい';
  return 'バグだらけ';
};


/**
 * タイピング演技スコア（0..100）。
 *
 * v0.14 辛口化（ウェイト 37% への引き上げとセット。緩いままだと適当プレイが逆に得をする）：
 *   base = SCORE_BASE (30) — 4 要素全体で統一
 *   + WPM 寄与（120 基準で -25〜+30。旧: 100 基準 ±20）
 *   + コンボ寄与（50+ で +5、150+ で +10、300+ で +18、600+ で +25。旧: 30/100/200/500）
 *   - 精度ペナルティ（97% 未満で線形に -25 まで。旧: 95% 未満 -20）
 *   + バグなし完走 +5
 *
 * 結果レンジ：下手 5-25 / 普通 30-45 / 上手 65-90
 * タイピング能力が「勝負を分ける」設計（品質の 37% を握る最大レバー）。
 */



/** リリース時のファン増分。広報ボーナスで底上げ */
export const fanDelta = (metascore: number, prBonus = 0): number => {
  let base: number;
  if (metascore >= 90) base = 80;
  else if (metascore >= 70) base = 40;
  else if (metascore >= 50) base = 15;
  else if (metascore >= 30) base = 0;
  else base = -5;
  if (base <= 0) return base;
  return Math.round(base * (1 + prBonus));
};
