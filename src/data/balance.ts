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
 * この分布は「特徴ポイント → メタスコア」（core/metascore.ts）の結果として実現される。
 * 実機での分布が想定とずれる場合は FEATURE_SCALE_COEF と重み（data/archetypes.ts）を見直す。
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
 * ヒット区分の売上倍率（docs/spec/score-model.md §5）。
 *
 * 旧 ×0.33〜×500（レンジ1500倍）は「神ゲー＝1%の稀な当たり」を前提にした数字。
 * 新モデルでは終盤に名作・神ゲーが常態になるため、そのままだと1作で兆が出る（実測）。
 * **1作の売上は現実に近づけ、上限は数百億とする（オーナー確定）。**
 *
 * 隣接区分の比率は 1.7〜2.4倍。「区分をまたぐと売上が約2倍」の跳ね感は維持する。
 * **基準売上 ＝ 普通（×1）のときの売上**に再定義した（旧は普通=×10 換算で分かりにくかった）。
 */
export const SALES_MULTIPLIER_BY_SCORE = {
  catastrophic: 0.25,
  failure: 0.6,
  normal: 1,
  hit: 2,
  bigHit: 3.5,
  masterpiece: 6,
  godGame: 10,
} as const;

/** ヒット区分の表示名（リリース画面・図鑑で共用） */
export const SCORE_TIER_LABEL = {
  catastrophic: '致命的失敗',
  failure: '失敗',
  normal: '普通',
  hit: 'ヒット',
  bigHit: '大ヒット',
  masterpiece: '名作',
  godGame: '神ゲー',
} as const;

export type ScoreTier = keyof typeof SALES_MULTIPLIER_BY_SCORE;

/** メタスコア → ヒット区分 */
export const scoreTierFor = (metascore: number): ScoreTier => {
  if (metascore <= 29) return 'catastrophic';
  if (metascore <= 49) return 'failure';
  if (metascore <= 69) return 'normal';
  if (metascore <= 79) return 'hit';
  if (metascore <= 89) return 'bigHit';
  if (metascore <= 94) return 'masterpiece';
  return 'godGame';
};

/** スコア帯ごとの売上倍率を引くヘルパー */
export const salesMultiplierForScore = (metascore: number): number =>
  SALES_MULTIPLIER_BY_SCORE[scoreTierFor(metascore)];

// ============================================================
// v0.16：power 正規化と役割換算（spec v16 §1-3）
// ============================================================

/**
 * power は全役割共通の 0..1 スケール（v0.16 で正規化。オーナー確定）。
 * 役割ごとの実効果は使用側でこの係数を掛けて換算する。
 * 旧スケール（プログラマー0.3〜1.2 / デザイナー2〜10 / 広報5〜20）は v5→v6 セーブ移行で換算。
 */
/**
 * 広報スキル100 あたりの売上ボーナス（docs/spec/score-model.md §1）。
 * 実装ステップ3：旧 `ROLE_EFFECT.prSalesBonus`（役職 pr の power × 0.2）から付け替えた。
 */
export const PR_SALES_BONUS_PER_SKILL = 0.2;

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
  /**
   * 2スキル持ちの配分。**主 0.70 / 副 0.30**。
   *
   * 0.55/0.45 では2スキル持ちの主スキルが 総合力 × 0.9 × 0.55 ＝ **0.495** しかなく、
   * 1スキル持ち（1.0）の半分。**排出の50%が主力にならず、AAA が実ガチャのチームでは
   * どうしても赤字**になっていた（本番経路の実測）。0.70 なら 0.63 で、
   * 専門特化の優位（1.0 > 0.63）は保ったまま2スキル持ちも主力になれる。
   */
  spreadRatio: { primary: 0.7, secondary: 0.3 },
  /** 同じ分野に2人目以降を置いたときの効率（分業のロス）。スキル合計に掛ける 🔧 */
  /**
   * 同じ分野の2人目以降の効率。**0.5 → 0.12**（実機で支配戦略が見つかったため）。
   *
   * 0.5 では「◎の2分野に人を寄せる」が支配戦略だった：同じ4人・同じ総スキルで
   * 均等がメタ75・12文なのに対し、集中はメタ86・**6文**（半分の労力でスコアも売上も上）。
   * 「1分野あたりの文数は固定」なので集中しても打つ量は増えないのに、
   * スキル合計だけ +50% されて ◎ の分野が上限100 に張り付き、△ の分野を捨てられていた。
   *
   * この値には**上下両方から制約**がある：
   * - 上限 … 大きすぎると「◎に寄せる」が勝つ（0.25 で均等と集中が並ぶ）
   * - 下限 … 小さすぎると「◎の2分野に1人ずつ、2人だけ雇う」が勝つ（人件費と開発期間が半分）
   *
   * 0.12 は全5規模 × 3チーム強度で「均等 > 集中を5点以上」「集中の文数 < 均等」
   * 「同じカバー分野数なら人数が多いほうが強い」を同時に満たす値（`teamLayout.test.ts` が固定）。
   * 2人目は +2.7〜3.0 メタ点を足すので、同じ職種を引いても腐らない。
   */
  secondMemberEfficiency: 0.12,
} as const;

/**
 * 採用ガチャの排出率（C を含む4種構成）🔧。
 * normal は S を出さない（旧仕様どおり）。C を追加したぶんは B から割いた。
 */
/** 採用ガチャのランク排出率（C を含む4種）。`rollRank4` が読む */
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
  mini: 1.58,
  mobile: 0.3,
  indie: 0.108,
  hit: 0.058,
  // AAA だけ天井基準（最強構成でようやく100）。
  // 0.035 では入門チーム（A級Lv8）が名作＝粗利¥200億 になり「大作を当てにいく」緊張が消え、
  // 0.03 では逆に入門が普通＝¥50億の赤字で詰みかけた（2人目効率を 0.5→0.12 に下げた影響）。
  // 実測：A級Lv8 でメタ72（ヒット）＝収支トントン、A級Lv10 で大ヒット、S級Lv10 で神ゲー。
  aaa: 0.041,
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
    baseRevenue: 3_000_000, // 普通（×1）で ¥300 万
    unlockSalesRequired: 0,
    unlockCost: 0,
    // 実装ステップ2：8週 → 4週（docs/spec/score-model.md §3。序盤の破産ウォール対策）。
    // 総文数 24 → 12。開発は打鍵で終わるので、固定費が3ヶ月ぶん→1ヶ月ぶんに減る
    neededWeeks: 4,
  },
  mobile: {
    devCost: 3_000_000, // ¥300 万
    baseRevenue: 30_000_000, // 普通（×1）で ¥3000 万
    // v0.18：新分布に整合（旧値 ¥3000万 は初手メタ95時代の設定。8〜12作目で到達する水準に）
    // 実装ステップ3：各規模を7〜9本ずつ遊べるペースに再校正（docs/spec/score-model.md §5）
    unlockSalesRequired: 150_000_000, // ¥1.5 億（8作目前後）
    unlockCost: 2_000_000, // ¥200 万
    neededWeeks: 12, // 3 ヶ月
  },
  indie: {
    devCost: 50_000_000, // ¥5000 万
    baseRevenue: 300_000_000, // 普通（×1）で ¥3 億
    unlockSalesRequired: 1_700_000_000, // ¥17 億（16作目前後）
    unlockCost: 15_000_000, // ¥1500 万（v0.18）
    neededWeeks: 20, // 5 ヶ月
  },
  hit: {
    devCost: 1_000_000_000, // ¥10 億
    baseRevenue: 2_000_000_000, // 普通（×1）で ¥20 億
    unlockSalesRequired: 8_000_000_000, // ¥80 億（24作目前後）
    unlockCost: 150_000_000, // ¥1.5 億（v0.18）
    neededWeeks: 28, // 7 ヶ月
  },
  aaa: {
    // ¥100 億では**話題作のほうが儲かり、AAA を作る理由が消えていた**
    // （A級Lv10 で 話題作 ¥110億 vs AAA ¥75億。終盤13本が「話題作を回すのが最適」になる）。
    // ¥60 億にすると規模の順序が正しくなり、「普通（¥50億）では赤字・ヒット以上で黒字」も保てる。
    devCost: 6_000_000_000, // ¥60 億
    baseRevenue: 5_000_000_000, // 普通（×1）で ¥50 億
    unlockSalesRequired: 35_000_000_000, // ¥350 億（32作目前後）
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
 * v0.16 改訂（オーナー確定「能力を一番考慮する」）：
 * キャラ能力を最大の支配項（0.60）に。相性とタイピングを両方カンストしても
 * 能力抜きでは品質 +30 が上限＝スコア帯は会社の育ちでしか上がらない。
 * 旧: charPower 0.35 / genreAffinity 0.25 / typingScore 0.37 / luck 0.03
 */


/**
 * v0.25：装備（設備）によるカテゴリ品質ボーナスの上限。
 * 既存の STAT/AXIS 枠（8点・企画/イベントと共有）は据え置き、装備は**別枠**で加点する
 * （装備は「金で買う設備投資」なので、既存の腕前ボーナスとは独立した近道にする）。
 * 青天井にすると分布ガード（メタ95は終盤）を壊すため上限付き。
 * 値は装備込み/なし両シナリオで balanceSimulation / progressionSimulation が緑になる交点で確定する 🔧
 */

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
  /**
   * 抑制率 = min(maxSuppression, プログラミングスキル合計 / suppressSkillCap)。
   * 旧 power 合計（上限2.0）と同じ体感になるよう ×100 スケールに合わせた。
   */
  suppressSkillCap: 200,
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
