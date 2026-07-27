/**
 * リリース結果の「次の一手」アドバイス。
 *
 * メタスコアの内訳から**最大のボトルネックを1つだけ**選び、日本語1行に翻訳する純粋関数。
 * 「赤字が自分のせい＋改善の道筋が見える」なら継続動機になる。
 *
 * 実装ステップ3：旧4要素（キャラ能力／ジャンル相性／タイピング演技）から
 * **特徴ポイント5種**（docs/spec/score-model.md §2）に付け替えた。
 * 指摘するのは「そのジャンルで重い（◎）のに低い分野」＝伸ばせば一番効くところ。
 */
import { normalizedWeightsFor } from '../data/archetypes';
import { ADVICE_GOOD_THRESHOLD } from '../data/balance';
import type { FeatureId, Work } from '../state/types';
import { FEATURE_IDS } from '../state/types';

export const ADVICE_ALL_GOOD = '🎉 死角なし。この調子で次回作へ';

/** 分野ごとのアドバイス文（低いときに出す） */
export const FEATURE_ADVICE: Record<FeatureId, string> = {
  usabilityPt: '🕹 操作性が足りない。プログラミングの高い社員を入れて打ち込もう',
  graphicsPt: '🎨 見た目が弱い。グラフィックの高い社員を入れて打ち込もう',
  soundPt: '🎵 音が弱い。サウンドの高い社員を入れて打ち込もう',
  storyPt: '📖 物語が薄い。シナリオの高い社員を入れて打ち込もう',
  innovationPt: '💡 既視感がある。ジャンルかテーマを変えて新しい組合せを試そう',
};

/**
 * ボトルネックを1つだけ指摘する。決定的：
 * - **そのジャンルでの重み × 不足分**が最大の分野を選ぶ
 *   （重い分野の不足ほど効くので、「◎なのに低い」を優先して拾う）
 * - すべて ADVICE_GOOD_THRESHOLD 以上なら死角なし
 * - 同点時は FEATURE_IDS の順（操作性 → グラフィック → サウンド → ストーリー → 革新性）
 */
export const adviceFor = (work: Work): string => {
  const contributions = work.breakdown.features ?? {};
  const weights = normalizedWeightsFor(work.genreId);

  let worst: FeatureId | null = null;
  let worstLoss = -1;
  let minPoint = Number.POSITIVE_INFINITY;

  for (const id of FEATURE_IDS) {
    const w = weights[id];
    // 内訳は「特徴ポイント × 重み」なので、割り戻して素の特徴ポイントに戻す
    const point = w > 0 ? (contributions[id] ?? 0) / w : 0;
    minPoint = Math.min(minPoint, point);
    // 伸ばしたときに増える点＝重み × 不足分
    const loss = w * (100 - point);
    if (loss > worstLoss) {
      worstLoss = loss;
      worst = id;
    }
  }

  if (minPoint >= ADVICE_GOOD_THRESHOLD) return ADVICE_ALL_GOOD;
  return worst ? FEATURE_ADVICE[worst] : ADVICE_ALL_GOOD;
};
