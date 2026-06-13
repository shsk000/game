/**
 * v0.10 仕上げ：ゲームバランス全数値の集約点。
 *
 * ⭐ **バランス調整はこのファイルだけ触れば完結する** ように設計した。
 * 詳しい説明と「ここを触ると何が起きるか」は BALANCE_README.md を参照。
 *
 * 各定数の決定根拠と議論履歴は docs/v10/notes/balance-design.md にある。
 * 数値を変えたら balance-design.md の §11 変更履歴に追記すること。
 */

import type { Scale } from './scales';

// ============================================================
// 時間レート（リアル ↔ ゲーム内）
// ============================================================

/**
 * リアル時間 ↔ ゲーム内 1 週の変換レート（ms）。
 *
 * 設計：開発中は速く、アイドル中は遅く（balance-design §6-2）。
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
// スコア帯（balance-design §2）
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
 * メタスコア帯ごとの売上倍率（balance-design §5-2、v0.10 仕上げで再調整）。
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
// 採用 power 分布（balance-design §4）
// ============================================================

/**
 * 採用候補の power 値分布。
 *
 * - N（並）：power 0.5〜1.5、出現率 65%
 * - R（強い）：power 1.6〜3.0、出現率 25%
 * - SR（精鋭）：power 3.1〜5.0、出現率 8%
 * - SSR（伝説）：power 5.1〜8.0、出現率 2%
 */
export const HIRE_POWER_DISTRIBUTION = {
  N: { rate: 0.65, powerMin: 0.5, powerMax: 1.5 },
  R: { rate: 0.25, powerMin: 1.6, powerMax: 3.0 },
  SR: { rate: 0.08, powerMin: 3.1, powerMax: 5.0 },
  SSR: { rate: 0.02, powerMin: 5.1, powerMax: 8.0 },
} as const;

/** power 値からレアリティを引く（採用 UI 表示用） */
export const rarityForPower = (power: number): 'N' | 'R' | 'SR' | 'SSR' => {
  if (power >= HIRE_POWER_DISTRIBUTION.SSR.powerMin) return 'SSR';
  if (power >= HIRE_POWER_DISTRIBUTION.SR.powerMin) return 'SR';
  if (power >= HIRE_POWER_DISTRIBUTION.R.powerMin) return 'R';
  return 'N';
};

// ============================================================
// 月給テーブル（balance-design §6-1）
// ============================================================

/**
 * 従業員 1 人あたりの月給。役職差なし、power のみで計算。
 *   月給 = base ¥30 万 + power × ¥20 万
 *
 * 例：power 1（N）¥50 万 / power 3（R）¥90 万 / power 5（SR）¥130 万 / power 7（SSR）¥170 万
 */
export const MONTHLY_WAGE_FORMULA = {
  base: 300_000,
  perPowerUnit: 200_000,
} as const;

export const computeMonthlyWage = (power: number): number =>
  MONTHLY_WAGE_FORMULA.base + power * MONTHLY_WAGE_FORMULA.perPowerUnit;

// ============================================================
// 賃料（balance-design §6-2、一律固定）
// ============================================================

/**
 * 月固定費（賃料）。
 * 規模に関係なく一律。社員上限は無し、人件費が社員数で増える。
 */
export const MONTHLY_RENT = 300_000; // ¥30 万

// ============================================================
// 借金（balance-design §6-7）
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
// 規模別バランス（balance-design §5-1）
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
    baseRevenue: 300_000, // normal で ×16.67 = ¥500 万
    unlockSalesRequired: 0,
    unlockCost: 0,
    neededWeeks: 8, // 2 ヶ月 = リアル 60 秒
  },
  mobile: {
    devCost: 3_000_000, // ¥300 万
    baseRevenue: 3_000_000, // normal で ¥5000 万
    unlockSalesRequired: 30_000_000, // ¥3000 万
    unlockCost: 5_000_000, // ¥500 万
    neededWeeks: 12, // 3 ヶ月
  },
  indie: {
    devCost: 50_000_000, // ¥5000 万
    baseRevenue: 30_000_000, // normal で ¥5 億
    unlockSalesRequired: 300_000_000, // ¥3 億
    unlockCost: 50_000_000, // ¥5000 万
    neededWeeks: 20, // 5 ヶ月
  },
  hit: {
    devCost: 1_000_000_000, // ¥10 億
    baseRevenue: 300_000_000, // normal で ¥50 億
    unlockSalesRequired: 3_000_000_000, // ¥30 億
    unlockCost: 500_000_000, // ¥5 億
    neededWeeks: 28, // 7 ヶ月
  },
  aaa: {
    devCost: 10_000_000_000, // ¥100 億
    baseRevenue: 3_000_000_000, // normal で ¥500 億
    unlockSalesRequired: 300_000_000_000, // ¥3000 億
    unlockCost: 5_000_000_000, // ¥50 億
    neededWeeks: 36, // 9 ヶ月
  },
};

// ============================================================
// 品質計算の難易度補正（balance-design §2, §6-3〜§6-5）
// ============================================================

/**
 * 4 要素品質計算のウェイト（balance-design §0 確定）。
 *
 *   final = (charPower × 0.5 + genreAffinity × 0.25 + typingScore × 0.15 + luck × 0.1)
 *           × luckMultiplier(0.9〜1.1) × gachaMul(1.0 or 1.5)
 */
export const QUALITY_WEIGHTS = {
  charPower: 0.5,
  genreAffinity: 0.25,
  typingScore: 0.15,
  luck: 0.1,
} as const;

/**
 * 各スコアの計算基準値（balance-design §6-3〜§6-5）。
 * 「何もしないと base 30」設計。base + 各種ボーナスで 100 まで上がる。
 */
export const SCORE_BASE = 30;

/** 運の中庸値 */
export const LUCK_DEFAULT = 50;

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
