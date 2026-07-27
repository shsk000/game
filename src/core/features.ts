import { FEATURE_SCALE_COEF, TYPING_MULTIPLIER } from '../data/balance';
import type { TicketCategory } from '../data/devPhrases';
import type { Scale } from '../data/scales';
import type { DevSkillId, Employee, FeatureId, FeaturePoints, Work } from '../state/types';
import { DEV_SKILL_IDS, SKILL_TO_FEATURE, ZERO_FEATURES } from '../state/types';
import { skillTotalsOf } from './skills';

/**
 * 特徴ポイント（docs/spec/score-model.md §2・§3）の純粋ロジック。
 *
 * **実装ステップ2 では蓄積と表示だけで、スコアには接続しない。**
 * メタスコアへの変換は実装ステップ3（それまで現行のスコア・売上は不変）。
 *
 * 用語（docs/spec/glossary.md）:
 * - **特徴ポイント** … 作品が持つ5つの数値（操作性／グラフィック／サウンド／ストーリー／革新性）
 * - **カバー分野**   … チームの誰かがそのスキルを持っている分野。**文が回ってくるのはここだけ**
 */

/** 開発スキル ↔ 作業チケットのカテゴリ（1対1） */
export const SKILL_TO_TICKET: Record<DevSkillId, TicketCategory> = {
  programming: 'program',
  graphics: 'graphics',
  sound: 'sound',
  scenario: 'scenario',
};

export const TICKET_TO_SKILL: Record<TicketCategory, DevSkillId> = {
  program: 'programming',
  graphics: 'graphics',
  sound: 'sound',
  scenario: 'scenario',
};

/** チームがカバーしている作業カテゴリ（文が回ってくる分野） */
export const coveredCategoriesOf = (employees: Employee[]): TicketCategory[] =>
  coveredFieldsOf(employees).map((f) => SKILL_TO_TICKET[f]);

/** チームがカバーしている開発分野（誰かがそのスキルを持っている） */
export const coveredFieldsOf = (employees: Employee[]): DevSkillId[] => {
  const totals = skillTotalsOf(employees);
  return DEV_SKILL_IDS.filter((f) => totals[f] > 0);
};

/**
 * 打鍵倍率（0.95〜1.05）。**ヒット区分を腕で越えさせない**幅に抑えてある
 * （score-model.md §3。実測では ×1.32 で3区分＝売上15倍差が動いていた）。
 */
export const typingMultiplier = (speedRank: 'good' | 'great' | 'perfect', combo: number): number => {
  const speed = TYPING_MULTIPLIER.speed[speedRank];
  const comboTier = TYPING_MULTIPLIER.combo.find((t) => combo >= t.minCombo);
  return Math.round(speed * (comboTier?.mul ?? 1) * 1000) / 1000;
};

/**
 * 文を1つ打ち切ったときの特徴ポイント加算量。
 *
 * ```
 * 加算量 ＝ ゲーム規模係数 × 打鍵倍率 × スキル合計
 * ```
 *
 * スキル合計は**同じ分野の2人目以降が半減**（`skillTotalsOf`）。
 * これが無いと1分野に人を寄せるのが支配戦略になり、他の職種を引く価値が消える。
 */
export const featureGainFor = (
  field: DevSkillId,
  employees: Employee[],
  scale: Scale,
  typingMul: number,
): number => {
  const total = skillTotalsOf(employees)[field] ?? 0;
  if (total <= 0) return 0;
  return Math.round(FEATURE_SCALE_COEF[scale] * typingMul * total * 10) / 10;
};

/** 特徴ポイントを加算する（0〜100 でクランプ） */
export const addFeature = (
  features: FeaturePoints,
  field: DevSkillId,
  gain: number,
): FeaturePoints => {
  const id: FeatureId = SKILL_TO_FEATURE[field];
  return { ...features, [id]: Math.round(Math.min(100, features[id] + gain) * 10) / 10 };
};

/**
 * 革新性。**スキルでは伸びない。** 同じジャンル×テーマの組合せを連続で作ると下がり、
 * 別の組合せを1本作れば 100 に戻る（score-model.md §2）。
 *
 * @param library 発売済み作品（新しい順でなくてよい。`releasedAt` で並べ替える）
 */
export const innovationFor = (
  library: Work[],
  genreId: string,
  themeId: string,
): number => {
  const key = `${genreId}:${themeId}`;
  const past = [...library].sort((a, b) => b.releasedAt - a.releasedAt);
  let streak = 0;
  for (const w of past) {
    if (`${w.genreId}:${w.themeId}` !== key) break;
    streak += 1;
  }
  // streak は「直前まで同じ組合せが何本続いたか」。今作を含めた連続数で表を引く
  const run = streak + 1;
  if (run <= 1) return 100;
  if (run === 2) return 50;
  if (run === 3) return 25;
  return 10;
};

/** 企画開始時の特徴ポイント（革新性だけ最初から決まっている） */
export const initialFeatures = (
  library: Work[],
  genreId: string,
  themeId: string,
): FeaturePoints => ({
  ...ZERO_FEATURES,
  innovationPt: innovationFor(library, genreId, themeId),
});
