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

/** 採用候補の初期 power レンジ（見習い帯。成長システムで育てるのが前提）叩き台 🔧 */
export const CANDIDATE_POWER_RANGE = { min: 0.2, max: 0.6 } as const;

// ============================================================
// v0.16：社員成長（spec v16 §1。Lv10 = 数十作品規模＝終盤・オーナー確定）
// ============================================================

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
  /** 次のレベルに必要な exp = expCurveBase × lv^expCurveExp */
  expCurveBase: 20,
  expCurveExp: 1.5,
  /** power 成長：power = basePower × (1 + powerGrowthPerLevel × (lv − 1)) */
  powerGrowthPerLevel: 0.15,
} as const;

// ============================================================
// 月給テーブル（balance-design §6-1、v0.16 で正規化 power に追従）
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
    // v0.18：新分布に整合（旧値 ¥3000万 は初手メタ95時代の設定。8〜12作目で到達する水準に）
    unlockSalesRequired: 30_000_000, // ¥3000 万（シミュレーションで 8〜16 作目に調整）
    unlockCost: 2_000_000, // ¥200 万
    neededWeeks: 12, // 3 ヶ月
  },
  indie: {
    devCost: 50_000_000, // ¥5000 万
    baseRevenue: 30_000_000, // normal で ¥5 億
    unlockSalesRequired: 200_000_000, // ¥2 億（v0.18）
    unlockCost: 15_000_000, // ¥1500 万（v0.18）
    neededWeeks: 20, // 5 ヶ月
  },
  hit: {
    devCost: 1_000_000_000, // ¥10 億
    baseRevenue: 300_000_000, // normal で ¥50 億
    unlockSalesRequired: 2_000_000_000, // ¥20 億（v0.18）
    unlockCost: 150_000_000, // ¥1.5 億（v0.18）
    neededWeeks: 28, // 7 ヶ月
  },
  aaa: {
    devCost: 10_000_000_000, // ¥100 億
    baseRevenue: 3_000_000_000, // normal で ¥500 億
    unlockSalesRequired: 25_000_000_000, // ¥250 億（v0.18）
    unlockCost: 1_500_000_000, // ¥15 億（v0.18）
    neededWeeks: 36, // 9 ヶ月
  },
};

// ============================================================
// 品質計算の難易度補正（balance-design §2, §6-3〜§6-5）
// ============================================================

/**
 * 4 要素品質計算のウェイト。
 *
 * v0.14 再配分（オーナー指示 2026-06-27）：
 * - タイピング 15%→37%：最大レバー化＝北極星「タイピングが主役」を数式で担保
 * - 運 10%→3%：適当プレイが運で 70 の壁（売上×33 倍）を越えないように
 * - 社員 50%→35%：ミニ規模では 2 人雇うだけで power 上限に飽和し、
 *   放置プレイでも高得点が出てしまっていた問題の緩和
 *
 *   final = (charPower × 0.35 + genreAffinity × 0.25 + typingScore × 0.37 + luck × 0.03)
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

/**
 * 各スコアの計算基準値（balance-design §6-3〜§6-5）。
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
