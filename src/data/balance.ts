/**
 * v0.10 仕上げ：ゲームバランス全数値の集約点。
 *
 * ⭐ **バランス調整はこのファイルだけ触れば完結する** ように設計した。
 * 詳しい説明と「ここを触ると何が起きるか」は BALANCE_README.md を参照。
 *
 * 各定数の決定根拠と議論履歴は v0.10（資料は削除済み） にある。
 * 数値を変えたら balance-scenario.md の §11 変更履歴に追記すること。
 */

import type { Scale } from './scales';

// ============================================================
// 時間レート（リアル ↔ ゲーム内）
// ============================================================

/**
 * リアル時間 ↔ ゲーム内 1 週の変換レート（ms）。
 *
 * 設計：開発中は速く、アイドル中は遅く（balance-scenario §6-2）。
 * - typingActive: 開発画面でタイピング中（リアル 7.5 秒 = ゲーム内 1 週）
 * - idle: オフィス画面等のアイドル中（リアル 30 秒 = ゲーム内 1 週）
 */
export const TIME_RATE_MS_PER_WEEK = {
  typingActive: 7500,
  idle: 30_000,
} as const;

// ============================================================
// 初期資金
// ============================================================

/**
 * 新規プレイ開始時の所持金。現実準拠の個人開発スタートアップ自己資金。
 * 失敗 2-3 本で詰む緊張感を作る。
 */
export const INITIAL_FUNDS = 5_000_000; // ¥500 万

// ============================================================
// スコア帯（balance-scenario §2）
// ============================================================

/**
 * メタスコアの想定分布。
 *
 * 設計：
 * - 約 55% が赤字 or トントン（致命的 20% + 失敗 35%）
 * - 「ほとんどのゲームは赤字」現実準拠
 * - 神ゲー（95+）は 1%、出会えると喜びピーク
 *
 * この分布は computeQualityV10 + 補正の結果として実現される。
 * 実機での分布が想定とずれる場合、metascore.ts の難易度補正と各スコアの正規化を見直す。
 */
export const SCORE_TIERS = {
  catastrophic: { min: 0, max: 29, expectedRate: 0.2 },
  failure: { min: 30, max: 49, expectedRate: 0.35 },
  normal: { min: 50, max: 69, expectedRate: 0.25 },
  hit: { min: 70, max: 79, expectedRate: 0.1 },
  bigHit: { min: 80, max: 89, expectedRate: 0.06 },
  masterpiece: { min: 90, max: 94, expectedRate: 0.03 },
  godGame: { min: 95, max: 100, expectedRate: 0.01 },
} as const;

/**
 * メタスコア帯ごとの売上倍率（balance-scenario §5-2、v0.10 仕上げで再調整）。
 *
 * 各規模の baseRevenue に掛けて最終売上を算出する。
 * 「ほとんどのゲームは赤字 or トントン」現実準拠の難易度に合わせて
 * v0.10 初版より hit 以上を 0.5 倍に圧縮（hit ¥2000万 → ¥1000万）。
 *
 * - 致命的失敗（×0.33）：開発費の 1/3 程度 → 確実に赤字
 * - 失敗（×3.33）：開発費の ~3 倍 → ほぼトントン
 * - 普通（×10）：黒字だが控えめ（mini ¥300万 → +¥210万）
 * - ヒット（×33）：mini ¥1000 万 → +¥910 万（明らかに嬉しい山）
 * - 大ヒット（×100）：mini ¥3000 万 → +¥2910 万
 * - 名作（×250）：mini ¥7500 万
 * - 神ゲー帯（×500）：mini ¥1.5 億
 */
export const SALES_MULTIPLIER_BY_SCORE = {
  catastrophic: 0.333,
  failure: 3.333,
  normal: 10,
  hit: 33,
  bigHit: 100,
  masterpiece: 250,
  godGame: 500,
} as const;

/** スコア帯ごとの売上倍率を引くヘルパー */
export const salesMultiplierForScore = (metascore: number): number => {
  if (metascore <= 29) return SALES_MULTIPLIER_BY_SCORE.catastrophic;
  if (metascore <= 49) return SALES_MULTIPLIER_BY_SCORE.failure;
  if (metascore <= 69) return SALES_MULTIPLIER_BY_SCORE.normal;
  if (metascore <= 79) return SALES_MULTIPLIER_BY_SCORE.hit;
  if (metascore <= 89) return SALES_MULTIPLIER_BY_SCORE.bigHit;
  if (metascore <= 94) return SALES_MULTIPLIER_BY_SCORE.masterpiece;
  return SALES_MULTIPLIER_BY_SCORE.godGame;
};

// ============================================================
// v0.16：power 正規化と役割換算（spec v16 §1-3）
// ============================================================

/**
 * power は全役割共通の 0..1 スケール（v0.16 で正規化。オーナー確定）。
 * 役割ごとの実効果は使用側でこの係数を掛けて換算する。
 * 旧スケール（プログラマー0.3〜1.2 / デザイナー2〜10 / 広報5〜20）は v5→v6 セーブ移行で換算。
 */
export const ROLE_EFFECT = {
  /** プログラマー：自動開発速度 LoC/秒 = power × この値 */
  programmerLocPerSec: 1.2,
  /** デザイナー：品質基礎+ = power × この値 */
  designerQualityBonus: 10,
  /** 広報：売上ボーナス（比率）= power × この値（例 power 0.5 → +10%） */
  prSalesBonus: 0.2,
} as const;

// ============================================================
// v0.22：採用ガチャ（spec v22 §4。旧 CANDIDATE_POWER_RANGE 0.2〜0.6 をランク帯に置換）
// ============================================================

/**
 * 採用ガチャの排出ランク。**C を追加して4種**（docs/spec/score-model.md §1）。
 * ランクは「どこまで伸びるか（天井）」を表す表示ラベルで、育っても変わらない。
 */
export type GachaRank = 'C' | 'B' | 'A' | 'S';

/** ランクの弱い順（排出率テーブルの走査・UI 並び順に使う） */
export const GACHA_RANKS: readonly GachaRank[] = ['C', 'B', 'A', 'S'] as const;

/** 採用ガチャの種類（v0.22.1 で 2 種に分割）。normal＝安価・S 無し／premium＝高額・S 源 */
export type GachaKind = 'normal' | 'premium';

/**
 * 採用ガチャの確定テーブル（spec v22 §4。数値は全て叩き台 🔧）。
 *
 * v0.22.1：オーナー指示で **ノーマル / プレミアム** の 2 種に分割。
 * - **normal**：安価（規模連動・現行テーブル）。**S を出さない**（B/A のみ）。天井なし。
 *   序盤の主力採用。A（power 0.4〜0.55）までは出るので普通に戦力になる。
 * - **premium**：高額（mini ¥500 万＝初期資金と同額で**序盤はほぼ引けない**）。S の唯一の入手源。
 *   天井 pityThreshold 連続 S 非排出で次を S 確定。中盤以降に手が届く設計。
 *   → S を序盤から引けなくすることで v16 の早期分布ガード（序盤メタ70+＝0%）を
 *     経済面から自然に守る（premium が高すぎて序盤は S を揃えられない）。
 *
 * 共通：
 * - powerRange: ランク別 basePower 帯。S 上限 0.7 は旧候補上限 0.6 より高いが、charPower は
 *   POWER_CAP × powerBonus 上限 70 で天井固定＝S は「天井に早く着く」だけ。
 * - specialty: ランク別の得意分野構成。A は旧仕様（3-10 ＋ 40% で 1-4）と同じ。
 */
export const GACHA_CONFIG = {
  normal: {
    // S 無し。S の 5% 分を A に寄せて B70/A30（🔧）
    // C は排出しない（実装ステップ3 で GACHA_RANK_RATES に切り替えるまで）
    rates: { C: 0, B: 0.7, A: 0.3, S: 0 },
    priceByScale: {
      mini: 50_000, // ¥5 万
      mobile: 500_000, // ¥50 万
      indie: 8_000_000, // ¥800 万
      hit: 150_000_000, // ¥1.5 億
      aaa: 1_500_000_000, // ¥15 億
    },
    // S を出さないので天井は無い（0＝ピティ無効）
    pityThreshold: 0,
  },
  premium: {
    // 実装ステップ1で C を追加（GACHA_RANK_RATES が新しい正）。ここは旧経路の互換用
    // C は排出しない（実装ステップ3 で GACHA_RANK_RATES に切り替えるまで）
    rates: { C: 0, B: 0.4, A: 0.45, S: 0.15 },
    priceByScale: {
      mini: 6_000_000, // ¥600 万（初期資金 ¥500 万を上回る＝序盤は 1 発も引けない）
      mobile: 30_000_000, // ¥3000 万
      indie: 300_000_000, // ¥3 億
      hit: 3_000_000_000, // ¥30 億
      aaa: 15_000_000_000, // ¥150 億
    },
    // S 率 15%（期待 ≒6.7 連）に対する救済天井。10 連連続 S 非排出で次を S 確定（🔧）
    pityThreshold: 10,
  },
  powerRange: {
    C: { min: 0.15, max: 0.25 },
    B: { min: 0.2, max: 0.4 },
    A: { min: 0.4, max: 0.55 },
    S: { min: 0.55, max: 0.7 },
  },
  specialty: {
    C: { primaryMin: 2, primaryMax: 5, secondChance: 0, secondMin: 0, secondMax: 0 },
    B: { primaryMin: 3, primaryMax: 7, secondChance: 0, secondMin: 0, secondMax: 0 },
    A: { primaryMin: 3, primaryMax: 10, secondChance: 0.4, secondMin: 1, secondMax: 4 },
    S: { primaryMin: 6, primaryMax: 10, secondChance: 1, secondMin: 3, secondMax: 6 },
  },
} as const satisfies {
  normal: {
    rates: Record<GachaRank, number>;
    priceByScale: Record<Scale, number>;
    pityThreshold: number;
  };
  premium: {
    rates: Record<GachaRank, number>;
    priceByScale: Record<Scale, number>;
    pityThreshold: number;
  };
  powerRange: Record<GachaRank, { min: number; max: number }>;
  specialty: Record<
    GachaRank,
    {
      primaryMin: number;
      primaryMax: number;
      secondChance: number;
      secondMin: number;
      secondMax: number;
    }
  >;
};

// ============================================================
// スキル・ランク（docs/spec/score-model.md §1。実装ステップ1）
// ============================================================

/**
 * ランクごとの総合力（＝スキル値の合計）。
 *
 * **Lv1 はランクによらずほぼ同じ（15〜28）で、Lv10 で 40/60/80/100 に開く。**
 * ランクは「どこまで伸びるか（天井）」、レベルは「今どこまで伸びたか」を表す。
 * 採用した瞬間は差が分からないので、ガチャの価値は「育てたときの到達点」になる。
 *
 * 数値は 🔧（通しシミュレーションで検証済み：序盤に破産せず終盤で兆が出ない）。
 */
export const RANK_TOTAL_POWER: Record<GachaRank, { lv1Min: number; lv1Max: number; lv10: number }> =
  {
    C: { lv1Min: 15, lv1Max: 20, lv10: 40 },
    B: { lv1Min: 16, lv1Max: 22, lv10: 60 },
    A: { lv1Min: 18, lv1Max: 25, lv10: 80 },
    S: { lv1Min: 20, lv1Max: 28, lv10: 100 },
  };

/**
 * スキル関連の確定値（docs/spec/score-model.md §1）。
 */
export const SKILL_CONFIG = {
  /** 2つ目のスキルを持つ確率（ランクとは無関係） 🔧 */
  twoSkillChance: 0.5,
  /**
   * 2スキル時の分散ペナルティ。総合力にこれを掛けてから2分野へ配分する。
   * **専門特化のほうが総合力が高くなる**（分けると目減りする） 🔧
   */
  spreadPenalty: 0.9,
  /** 2スキル時の配分比（主スキル : 副スキル） 🔧 */
  spreadRatio: { primary: 0.55, secondary: 0.45 },
  /** 同じ分野に2人目以降を置いたときの効率（分業のロス）。スキル合計に掛ける 🔧 */
  secondMemberEfficiency: 0.5,
} as const;

/**
 * 採用ガチャの排出率（C を含む4種構成）🔧。
 * normal は S を出さない（旧仕様どおり）。C を追加したぶんは B から割いた。
 */
/**
 * ⚠ **まだ本番では使っていない**（実装ステップ3 から）。
 * 現行のガチャは `GACHA_CONFIG[kind].rates`（C を出さない旧テーブル）を読む。
 * C の天井 40 が効くのはスキルが直接スコアに乗る実装ステップ3 なので、
 * それより前に C を排出すると「C と表示されるが power は旧ロジック」という嘘になる。
 */
export const GACHA_RANK_RATES: Record<GachaKind, Record<GachaRank, number>> = {
  normal: { C: 0.35, B: 0.45, A: 0.2, S: 0 },
  premium: { C: 0.1, B: 0.35, A: 0.4, S: 0.15 },
};

// ============================================================
// v0.16：社員成長（spec v16 §1。Lv10 = 数十作品規模＝終盤・オーナー確定）
// ============================================================

/**
 * 特徴ポイントのゲーム規模係数（docs/spec/score-model.md §3）🔧
 *
 * 規模ごとに「入門チーム」（その規模を解放した直後の想定チーム）を基準に決めてある。
 * 全規模を最強構成で基準化すると、序盤のスキル値では特徴ポイントが17程度しか出ず、
 * どう頑張ってもミニゲームで黒字に届かない破産ウォールになる（実測）。
 *
 * 🔧 **入門チーム前提はまだ検証していない。** 実測の解放時レベルは Lv3/5/7/8
 * （経験値の規模連動を入れたあと）。係数の校正は実装ステップ3 の通しシミュレーションで行う。
 */
/**
 * 特徴ポイント → メタスコア（docs/spec/score-model.md §4）。
 *
 * ⚠ **実装ステップ3 で `computeRelease` から呼ぶまで未使用。**
 */
export const METASCORE = {
  /**
   * 相性（0.7〜2.0）→ 相性補正（−8〜+8）。
   * トレンド合致と同じ形＝「良い組合せの発見がヒット区分を1つ押し上げる」。
   * 相性は学習できる（図鑑に記録される）ので、点に直結させても運ゲーにならない。
   * 🔧 center は相性分布の中央値に合わせる（±0付近が平均になるように）。
   */
  compat: { center: 1.0, span: 1.0, max: 8 },
  /** トレンド合致（ジャンルとテーマの両方／片方） */
  trend: { both: 10, one: 5 },
  /**
   * 評価家のブレ（±5）。同じ作りでも毎回ぶれるのが中毒の肝（game-design §5）。
   * ヒット区分をまたぐほどの幅は持たせない。
   */
  variance: 5,
} as const;

export const FEATURE_SCALE_COEF: Record<Scale, number> = {
  mini: 1.32,
  mobile: 0.25,
  indie: 0.09,
  hit: 0.048,
  aaa: 0.035,
};

/**
 * 打鍵倍率（docs/spec/score-model.md §3）。合計 0.95〜1.05。
 *
 * **ヒット区分を腕で越えさせないための幅**。上位の区分は幅が狭い
 * （ヒット10点／大ヒット10点／名作5点／神ゲー6点）ため、倍率が 1.07 を超えると区分をまたぐ。
 * 実測では ×1.32 で3区分＝売上15倍差が動いていた（game-scenario §10-3 に反する）。
 */
export const TYPING_MULTIPLIER = {
  speed: { good: 0.97, great: 1.0, perfect: 1.03 },
  /** コンボ帯（高い方から先に判定） */
  combo: [
    { minCombo: 100, mul: 1.02 },
    { minCombo: 30, mul: 1.01 },
    { minCombo: 10, mul: 1.0 },
    { minCombo: 0, mul: 0.98 },
  ],
} as const;

export const GROWTH = {
  /** レベル上限 */
  levelCap: 10,
  /** リリース参加 1 回の基礎 exp */
  expBase: 10,
  /** メタスコア連動の追加 exp（しきい値の高い方から先に判定） */
  expByMeta: [
    { minMeta: 90, bonus: 30 },
    { minMeta: 70, bonus: 15 },
    { minMeta: 50, bonus: 5 },
  ],
  /**
   * **ゲーム規模ごとの exp 倍率**（docs/spec/score-model.md §1）。
   *
   * 定額だと解放ペースに育成が追いつかない。解放は累計売上ゲートで、売上も閾値も
   * 規模ごとに ×10 で伸びるため各規模は数本で次を解放するのに、必要 exp は lv^1.5 で
   * 急増するため。実測では 話題作の解放時に Lv4（想定 A級Lv7〜8）まで開いていた。
   *
   * 「大きい作品を作るほど学ぶ」を入れて追いつかせる。副作用として
   * **上位規模で失敗しても経験値は入る**ので、「失敗続きで育て直しに戻れない」死の螺旋にならない。
   */
  expScaleMultiplier: {
    mini: 1,
    mobile: 3,
    indie: 6,
    hit: 12,
    aaa: 24,
  },
  /** 次のレベルに必要な exp = expCurveBase × lv^expCurveExp */
  expCurveBase: 20,
  expCurveExp: 1.5,
  /** power 成長：power = basePower × (1 + powerGrowthPerLevel × (lv − 1)) */
  powerGrowthPerLevel: 0.15,
} as const;

// ============================================================
// 月給テーブル（balance-scenario §6-1、v0.16 で正規化 power に追従）
// ============================================================

/**
 * 従業員 1 人あたりの月給。役職差なし、power（0..1 正規化・成長込みの現在値）とレベルで計算。
 *   月給 = base ¥30 万 + power × ¥60 万 + (level − 1) × ¥5 万
 *
 * v0.17：レベル項を追加（オーナー指示「Lv が上がるごとに固定費が上がるように」）。
 * 例：basePower 0.4 → Lv1 ¥54 万 / Lv5 ¥88 万 / Lv10 ¥146 万
 * 成長するほど高給になる＝強い会社は固定費も重い（経済の緊張を維持）。
 */
export const MONTHLY_WAGE_FORMULA = {
  base: 300_000,
  perPowerUnit: 600_000,
  perLevel: 50_000,
} as const;

export const computeMonthlyWage = (power: number, level = 1): number =>
  MONTHLY_WAGE_FORMULA.base +
  power * MONTHLY_WAGE_FORMULA.perPowerUnit +
  (Math.max(1, level) - 1) * MONTHLY_WAGE_FORMULA.perLevel;

// ============================================================
// 賃料（balance-scenario §6-2、一律固定）
// ============================================================

/**
 * 月固定費（賃料）。
 * 規模に関係なく一律。社員上限は無し、人件費が社員数で増える。
 */
export const MONTHLY_RENT = 300_000; // ¥30 万

// ============================================================
// 借金（balance-scenario §6-7）
// ============================================================

/**
 * 借金システムの定数。
 *
 * - 月利 3%（高利貸し風で緊張感）
 * - 借入上限 = 月固定費 × 12 ヶ月分
 * - 借入上限超 + 資金 0 でゲームオーバー
 */
export const DEBT_CONFIG = {
  monthlyInterestRate: 0.03,
  borrowingLimitMonths: 12,
} as const;

/** 借入上限を計算（月固定費合計 × 12） */
export const computeBorrowingLimit = (monthlyTotalFixedCost: number): number =>
  monthlyTotalFixedCost * DEBT_CONFIG.borrowingLimitMonths;

// ============================================================
// 規模別バランス（balance-scenario §5-1）
// ============================================================

/**
 * 規模ごとの経済バランス。
 *
 * - devCost: プロジェクト開始時の前払い開発費
 * - baseRevenue: 平均売上の基準値（普通スコア時、これに SALES_MULTIPLIER_BY_SCORE を掛ける）
 * - unlockSalesRequired: この規模を解放するための累計売上閾値
 * - unlockCost: 解放時の一括支払い
 * - neededWeeks: 1 本の開発に必要なゲーム内週数
 */
export const SCALE_BALANCE: Record<
  Scale,
  {
    devCost: number;
    baseRevenue: number;
    unlockSalesRequired: number;
    unlockCost: number;
    neededWeeks: number;
  }
> = {
  mini: {
    devCost: 300_000, // ¥30 万
    baseRevenue: 300_000, // normal(×10) で ¥300 万
    unlockSalesRequired: 0,
    unlockCost: 0,
    // 実装ステップ2：8週 → 4週（docs/spec/score-model.md §3。序盤の破産ウォール対策）。
    // 総文数 24 → 12。開発は打鍵で終わるので、固定費が3ヶ月ぶん→1ヶ月ぶんに減る
    neededWeeks: 4,
  },
  mobile: {
    devCost: 3_000_000, // ¥300 万
    baseRevenue: 3_000_000, // normal(×10) で ¥3000 万
    // v0.18：新分布に整合（旧値 ¥3000万 は初手メタ95時代の設定。8〜12作目で到達する水準に）
    unlockSalesRequired: 30_000_000, // ¥3000 万（シミュレーションで 8〜16 作目に調整）
    unlockCost: 2_000_000, // ¥200 万
    neededWeeks: 12, // 3 ヶ月
  },
  indie: {
    devCost: 50_000_000, // ¥5000 万
    baseRevenue: 30_000_000, // normal(×10) で ¥3 億
    unlockSalesRequired: 200_000_000, // ¥2 億（v0.18）
    unlockCost: 15_000_000, // ¥1500 万（v0.18）
    neededWeeks: 20, // 5 ヶ月
  },
  hit: {
    devCost: 1_000_000_000, // ¥10 億
    baseRevenue: 300_000_000, // normal(×10) で ¥30 億
    unlockSalesRequired: 2_000_000_000, // ¥20 億（v0.18）
    unlockCost: 150_000_000, // ¥1.5 億（v0.18）
    neededWeeks: 28, // 7 ヶ月
  },
  aaa: {
    devCost: 10_000_000_000, // ¥100 億
    baseRevenue: 3_000_000_000, // normal(×10) で ¥300 億
    unlockSalesRequired: 25_000_000_000, // ¥250 億（v0.18）
    unlockCost: 1_500_000_000, // ¥15 億（v0.18）
    neededWeeks: 36, // 9 ヶ月
  },
};

// ============================================================
// v0.21「投資」：未解放ジャンル/テーマの先行購入（v0.21 §4-A）
// ============================================================

/**
 * 未解放のジャンル/テーマを資金で「先行購入」する価格（`unlockStage` 別・ジャンル/テーマ共通）。
 * 叩き台 🔧：SCALE_BALANCE.unlockCost が各 stage の累計売上ゲートの約 6〜8% である比率を参考に設定。
 * stage が上がるほど到達に必要な実績が大きい＝価値が高い、を「人気なほど高い」の代理指標とする
 * （新しい人気度パラメータは作らない）。stage 1 は初期解放なので購入対象外（テーブルに載せない）。
 * 既存の無償自動解放（computeStageUnlocks：累計売上 or ヒット作本数）はそのまま併存する。
 */
export const INVEST_CONFIG = {
  /**
   * unlockStage → 先行購入の「基礎額」（円）。stage 1 は初期解放のため無し。
   * stage 間は ×10 刻み（オーナー指示 2026-07-19）。実際の価格はここに購入回数の逓増を掛ける。
   * 既存の SCALE_BALANCE.unlockCost がほぼ ×10 刻み（¥200万→¥1500万→¥1.5億→¥15億）なのに揃える。
   * 最上位 stage 4（人気ジャンル/テーマ）は基礎 ¥3000万＝スマホゲーム解放ゲートと同水準。
   */
  unlockPriceByStage: {
    2: 300_000, // ¥30 万
    3: 3_000_000, // ¥300 万
    4: 30_000_000, // ¥3000 万
  } as Record<number, number>,
  /**
   * 先行購入するたびに次の価格へ掛かる公比（逓増カーブ・オーナー指示 2026-07-19「買うほど高くなる」）。
   * price = 基礎額 × priceGrowth^(これまでの先行購入数)。1.8 で 5 個ごとに約 ×18、青天井の金の吸収先。
   */
  priceGrowth: 1.8,
} as const;

// ============================================================
// 品質計算の難易度補正（balance-scenario §2, §6-3〜§6-5）
// ============================================================

/**
 * 4 要素品質計算のウェイト。
 *
 * ⚠ 現在の値は charPower 0.60 / genreAffinity 0.15 / typingScore 0.15 / luck 0.10。
 * v0.16 で「勝敗の決定因は会社の育ち（社員能力）／タイピングは体験の入口と手触り」に方針が
 * 確定したため、社員を最大レバーに戻した（game-scenario スキル §0・§10-3）。
 *
 * 旧コメントには「タイピング 15%→37% に引き上げて最大レバー化」と書かれていたが、
 * これは v0.14 時点の方針で、現在は**逆**。数値も一致していなかったので書き換えた。
 *
 *   final = (charPower × 0.60 + genreAffinity × 0.15 + typingScore × 0.15 + luck × 0.10)
 *           × luckMultiplier(0.97〜1.03)
 */
/**
 * v0.16 改訂（オーナー確定「能力を一番考慮する」）：
 * キャラ能力を最大の支配項（0.60）に。相性とタイピングを両方カンストしても
 * 能力抜きでは品質 +30 が上限＝スコア帯は会社の育ちでしか上がらない。
 * 旧: charPower 0.35 / genreAffinity 0.25 / typingScore 0.37 / luck 0.03
 */
export const QUALITY_WEIGHTS = {
  charPower: 0.6,
  genreAffinity: 0.15,
  typingScore: 0.15,
  luck: 0.1,
} as const;

/**
 * v0.16：ビルドアップ属性ボーナス（devStats → 品質加点）の上限。
 * 旧実装は上限なしで青天井だったため、序盤でもスコアが積み上がりすぎた。
 */
export const STAT_QUALITY_BONUS_CAP = 8;

/**
 * v0.17.1：軸ボーナス（企画の面白さ/操作性/バランス×0.3 ＋ ビルドアップ属性）の
 * **正の合計の上限**。これらはコンボ・速度倍率＝タイピングの腕で増えるため、
 * 上限がないと QUALITY_WEIGHTS のタイピング 0.15 を裏口で迂回してしまう
 * （オーナー指摘「タイピングは0.15のはずなのにかなり加算されてる」）。
 * 上限 8 ＝ 分布シミュレーションで「序盤はメタ70に届かない」帯を維持できる最大値 🔧
 */
export const AXIS_QUALITY_BONUS_CAP = 8;

/**
 * v0.25：装備（設備）によるカテゴリ品質ボーナスの上限。
 * 既存の STAT/AXIS 枠（8点・企画/イベントと共有）は据え置き、装備は**別枠**で加点する
 * （装備は「金で買う設備投資」なので、既存の腕前ボーナスとは独立した近道にする）。
 * 青天井にすると分布ガード（メタ95は終盤）を壊すため上限付き。
 * 値は装備込み/なし両シナリオで balanceSimulation / progressionSimulation が緑になる交点で確定する 🔧
 */
export const EQUIP_QUALITY_BONUS_CAP = 6;

// ============================================================
// v0.17：バグ発生システム（spec v17 §4。数値は叩き台 🔧）
// ============================================================

/**
 * バグは「タイピングの腕」と「エンジニアの質」の両方が現れる場所。
 * 発生（開発中）→ 発覚（テスト）→ 返済（デバッグ）の一本の因果。
 */
export const BUG_CONFIG = {
  /**
   * v0.17.1：ミス打鍵は**必ず**バグになる（オーナー指示「入力間違えた場合はバグ」）。
   * 社員能力の抑制は正打側の抽選（onKeystrokeRate）にのみ効く。
   */
  missAlwaysBugs: true,
  /**
   * 正打 1 打鍵ごとのバグ確率（抑制前）。
   * v0.17.1：オーナー指示「実装最中にタイピング入力のたびにランダムでバグ追加。
   * 社員能力が高ければ割合が低くなる」。mini（正打 200〜300 打）で 3〜5 匹の期待値
   */
  onKeystrokeRate: 0.02,
  /** 抑制率 = min(maxSuppression, プログラマー power 合計 / suppressCap) */
  suppressCap: 2.0,
  maxSuppression: 0.8,
  /**
   * 開発完了時の最低保証バグ数。「どんなコードにもバグはいる」＝
   * まともに作っても（ミスゼロ・抽選が全部外れても）デバッグフェーズが空にならない
   */
  minBugsOnDevComplete: 1,
  /** デバッグ工数：バグ 1 匹 = 修正フレーズ N 文 */
  phrasesPerBug: 2,
  /** テストフェーズのチケット数（バグを「発覚」させる工程） */
  testTickets: 3,
  /** 残バグ 1 匹あたりのペナルティ（このまま発売した場合） */
  qualityPenaltyPerBug: 2,
  reputationRiskPerBug: 2,
} as const;

// ============================================================
// v0.20：打鍵ジュース＆山場（v0.20。数値は叩き台 🔧）
// ============================================================

/**
 * 「作業感」対策の本丸＝打鍵の瞬間そのものを気持ちよくする。
 * 原則：打鍵は止めない・読ませない・選ばせない（v0.19 選択制撤回の学び）。
 * 報酬はすべて**フィーバー（既存の進捗×2）に合流**させる：
 * クリティカル＝チャージが跳ねる／ギア＝溜まりが速くなる／パーフェクト文＝ボーナス。
 * 経済への新しい抜け道を作らず、既存のフィーバー→進捗の一本道を太くする。
 */
export const JUICE_CONFIG = {
  /** 打鍵SEの音階：コンボ N ごとに半音 +1（上限 maxStep 半音） */
  keyPitch: { comboPerStep: 10, maxStep: 12 },
  /** コンボ節目の称号ポップ（その値ちょうどで1回だけ） */
  comboTitles: [
    { combo: 50, label: '好調!' },
    { combo: 150, label: '神速!!' },
    { combo: 300, label: '無我の境地!!!' },
  ],
  /** クリティカル打鍵：正打1打ごとの発生率とフィーバーチャージ（通常は1打+1） */
  crit: { rate: 0.02, feverBonus: 12 },
  /** レア文章：文の差し替え時の出現率・打ち切り時のフィーバーチャージ（クリティカルより大きい） */
  rare: { rate: 0.07, feverBonus: 20 },
  /**
   * クランチタイム：全体完成度がこの%以上で進捗倍率（自動発動・選択なし）。
   * bossRate：クランチ中の文章選択でボス文章（プール2文連結の長文）になる確率。
   * bossFeverBonus：ボス文章完走時のフィーバーチャージ（rare.feverBonusより大きい）。
   */
  crunch: { startPct: 80, progressMult: 2, bossRate: 0.15, bossFeverBonus: 30 },
  /** ギア：入力速度 wpm（打鍵/分）のしきい値。上がるほどフィーバーが溜まりやすい */
  gears: [
    { minWpm: 150, feverGain: 2 },
    { minWpm: 230, feverGain: 3 },
  ],
  /**
   * ノーミスで1文完走した時のフィーバーボーナス。
   * 画面表示は「ノーミス継続」。speedRank の 'PERFECT'（1文の速度ランク）と紛らわしいため
   * 「パーフェクト」という語は画面には出さない（設定キー名のみ perfect のまま）。
   */
  perfect: { feverBonus: 10 },
} as const;

/**
 * 各スコアの計算基準値（balance-scenario §6-3〜§6-5）。
 * 「何もしないと base 30」設計。base + 各種ボーナスで 100 まで上がる。
 */
export const SCORE_BASE = 30;

/** 運の中庸値 */
export const LUCK_DEFAULT = 50;

/**
 * v0.18：リリース結果アドバイス（core/advice.ts）の「高水準」しきい値 🔧叩き台。
 * 3 要素（キャラ能力・相性・タイピング）の最小値がこれ以上なら「死角なし」扱い。
 */
export const ADVICE_GOOD_THRESHOLD = 70;

// ============================================================
// v0.11 開発フェーズ：打鍵フィードバック（DevelopScreen 中央パネル）
// ============================================================

/**
 * 入力速度の「文字/分」表示換算。
 * useTyping の wpm は「成功打鍵（ローマ字キー）/分」相当。かな 1 文字 ≒ 2 打鍵として割る。
 * 表示専用（内部の品質計算は素の wpm を使う）。
 */
export const KEYS_PER_KANA = 2.0;

/**
 * 開発の「作業量」目標（完走すべきフレーズ数）を決める係数。
 * workTarget = neededWeeks × DEV_PHRASES_PER_WEEK（最低 3）。
 *
 * v0.11 後期：締切（残り時間）を廃止し、進捗オンリーのモデルに変更。
 * 打って作業量（doneLoC）を workTarget まで埋めないと完了しない（AFK では終わらない）。
 * 例：mini neededWeeks 8 × 3 = 24 フレーズ。
 * 小さくしすぎると「数語で終了（B-Crit-2）」が再発するので下げすぎない。
 */
export const DEV_PHRASES_PER_WEEK = 3;

/**
 * v0.15.3：企画フェーズ（＋テスト/デバッグの仕上げ）ぶんのスケジュール猶予（週）。
 * neededWeeks は開発フェーズの作業量だけを想定した数字なので、
 * 企画チケットのタイピングに使うぶんを予定週へ上乗せして「予定超過」判定を公平にする。
 * 例：mini 8 週 → 予定 8 + 4 = 12 週。速い人は予定内、遅いと超過＝固定費がかさむ（v11 プレッシャー設計は維持）。
 */
export const planWeeksAllowance = (neededWeeks: number): number => Math.ceil(neededWeeks / 2);

/**
 * 「速く打つほどある程度早く終わる」ための速度ボーナス。
 * フレーズ 1 本の進捗寄与 = 1 × (1 + bonus)。bonus は wpm に応じて 0〜maxBonus。
 * - baseWpm 以下：ボーナス 0（1 本 = 1.0 進捗）
 * - fastWpm 以上：ボーナス最大（1 本 = 1 + maxBonus 進捗）
 * 速い人ほど少ないフレーズ数で workTarget に到達＝早期完了。
 * maxBonus は B-Crit-2 再発を避けるため控えめに（24 本 → 最速でも ≈15 本）。
 */
export const DEV_SPEED_GAIN = { baseWpm: 90, fastWpm: 200, maxBonus: 0.6 } as const;

/**
 * 「開発への影響」4 指標の S/A/B/C しきい値（DevelopScreen で表示）。
 * 値はモックアップ準拠の体感ベース。balance 調整時はここだけ触る。
 */
export const DEV_IMPACT_THRESHOLDS = {
  /** 開発速度：wpm のしきい値 */
  speed: { S: 200, A: 140, B: 90 },
  /** 品質：accuracy（0..1）のしきい値 */
  quality: { S: 0.99, A: 0.95, B: 0.9 },
  /** バグ率：ミス率（0..1）の上限しきい値（小さいほど良い） */
  bug: { S: 0.01, A: 0.03, B: 0.06 },
} as const;

/**
 * 打鍵レーティング（COMBO +GREAT! 等）の判定（直近正打の打鍵間隔 ms）。
 */
export const KEYSTROKE_RATING = {
  PERFECT: 120,
  GREAT: 200,
  GOOD: 350,
} as const;
