import type { GachaRank } from '../data/balance';
import type { CategoryId } from '../data/categories';
import type { EquipLoadout } from '../data/equipment';
import type { GenreId } from '../data/genres';
import type { Scale } from '../data/scales';
import type { ThemeId } from '../data/themes';

export type Screen = 'plan' | 'develop' | 'release' | 'office' | 'library' | 'collection';

/**
 * v0.10：ゲーム内時間。週単位で進行する。
 *  - 1ヶ月 = 4週、1年 = 48週 として運用
 *  - 表示形式：`20XX年 MM月 第 N週`
 *  - month は 1..12、week は 1..4。
 */
export type GameDate = {
  year: number;
  month: number;
  week: number;
};

export const INITIAL_GAME_DATE: GameDate = { year: 2026, month: 1, week: 1 };

/** GameDate を週インデックスに変換（年単位の差を含む通算週）。比較・加算用 */
export const dateToWeekIndex = (d: GameDate): number =>
  d.year * 48 + (d.month - 1) * 4 + (d.week - 1);

/** 週インデックスから GameDate へ復元 */
export const weekIndexToDate = (i: number): GameDate => {
  const year = Math.floor(i / 48);
  const rem = i - year * 48;
  const month = Math.floor(rem / 4) + 1;
  const week = (rem % 4) + 1;
  return { year, month, week };
};

/** GameDate を n 週進める（n が負なら戻る）。月またぎ・年またぎを正しく処理 */
export const addWeeks = (d: GameDate, n: number): GameDate =>
  weekIndexToDate(dateToWeekIndex(d) + n);

/** 比較ヘルパ：a < b なら負、a == b なら 0、a > b なら正 */
export const compareDate = (a: GameDate, b: GameDate): number =>
  dateToWeekIndex(a) - dateToWeekIndex(b);

/** 表示用のフォーマット（例：「2026年 4月 第3週」） */
export const formatGameDate = (d: GameDate): string => `${d.year}年 ${d.month}月 第${d.week}週`;

/**
 * v0.10：月初（第1週）に発生する固定費の内訳。
 *  - salaries：在籍社員の給与合計（円）
 *  - rent：現在の規模のオフィス賃料（円）
 *  - total：salaries + rent
 */
export type MonthlyFixedCost = {
  salaries: number;
  rent: number;
  total: number;
};

/** 離席中（オフライン）に稼いだ売上のレポート。復帰時にモーダル表示する */
export type OfflineReport = {
  earned: number;
  awaySec: number;
};

export type Achievement =
  | 'first-release'
  | 'first-masterpiece'
  | 'ghost-killer'
  | 'combo-100'
  | 'fan-1k'
  | 'million-yen'
  | 'collector-half'
  | 'aaa-released';

export type EmployeeRole = 'programmer' | 'designer' | 'pr';

export type EmployeeSpecialty = {
  categoryId: CategoryId;
  bonus: number;
};

export type Employee = {
  id: string;
  name: string;
  role: EmployeeRole;
  /**
   * v0.22：採用ガチャの排出ランク（表示ラベル専用）。
   * 能力への影響は basePower / specialties に織り込み済みで、rank 自体が
   * 品質・売上に加点する経路は作らない（spec v22 §2）。旧セーブの社員は undefined。
   */
  rank?: GachaRank;
  /**
   * v0.16：全役割共通の 0..1 正規化スケール（成長込みの現在値）。
   * 実効果は使用側で ROLE_EFFECT 係数を掛ける（LoC/秒・品質+・売上%）。
   */
  power: number;
  /** v0.16：素質（採用時に決まる 0.2〜0.6）。power = basePower × レベル成長率 */
  basePower: number;
  /** v0.16：レベル（1〜GROWTH.levelCap）。リリース参加の exp で上がる */
  level: number;
  /** v0.16：現在の経験値（レベルアップで消費） */
  exp: number;
  wage: number;
  specialties: EmployeeSpecialty[];
  /**
   * v0.25：装備（スロット→アイテムID）。未装備スロットは undefined、旧セーブの社員は undefined。
   * 効果はリリース品質に別枠で加点（EQUIP_QUALITY_BONUS_CAP）。see core/equip.ts。
   */
  equipped?: EquipLoadout;
};

export type Candidate = Employee;

/**
 * v0.10：4 要素ウェイト品質計算（spec §2-0）のブレイクダウン。
 *  - charPower / genreAffinity / performance / luck は 0..100 スケール
 *  - base = 加重和（運10含む）
 *  - luckMultiplier / isGodGame は final_quality 段階の補正
 *  - trendMul / pioneer はメタスコア/売上に乗る別系統
 *  - 旧 v0.9 4 レバー（categories/employees/ads/variance）は互換用に optional 残置
 */
export type WorkBreakdown = {
  // v0.10 新ブレイクダウン
  charPower?: number;
  genreAffinity?: number;
  performance?: number;
  luck?: number;
  base?: number;
  luckMultiplier?: number;
  trendMul?: number;
  pioneer?: boolean;
  /** v0.14：イベント新軸（面白さ/操作性/バランス−バグ率）による品質への加点 */
  axisBonus?: number;
  // v0.9 互換
  categories?: number;
  employees?: number;
  ads?: number;
  variance?: number;
};

export type Work = {
  id: string;
  title: string;
  genreId: GenreId;
  themeId: ThemeId;
  scale: Scale;
  quality: number;
  metascore: number;
  isMasterpiece: boolean;
  developSec: number;
  /** 初動売上（releaseで即時加算済み） */
  initialRevenue: number;
  /** 残りの販売プール（時間で減衰しつつ funds に流れる） */
  salesPool: number;
  /** 元の販売プール（プログレスバー表示用） */
  initialSalesPool: number;
  /** 売上の1秒あたり減衰率 0〜1 */
  decayPerSec: number;
  /** これまでに累積された総売上（初動 + 販売） */
  totalRevenue: number;
  /** 販売継続中フラグ。プールが残り少なくなると false */
  selling: boolean;
  fansGained: number;
  ghostBeaten: boolean;
  launchAdUsed: boolean;
  /** 新規組合せ初リリースだったか */
  pioneer: boolean;
  releasedAt: number;
  createdAt: number;
  /** 品質の4レバー内訳 */
  breakdown: WorkBreakdown;
  /** ライブラリ表示用：このリリースで選んだカテゴリ */
  selectedCategories?: CategoryId[];
  /** v0.10：開発に要したゲーム内週数（カレンダー差分。リリース時に確定） */
  developWeeks?: number;
};

/**
 * v0.14：1 作の開発フェーズ。1 つのテイクオーバー画面の中で `current.phase` を進める。
 * 企画 → 開発 → テスト → デバッグ → 発売 → 開発完了。
 */
export type DevPhase =
  | 'planning'
  | 'development'
  | 'testing'
  | 'debugging'
  | 'release'
  | 'complete';

/** フェーズの並び順（遷移と進行リスト表示に使う） */
export const DEV_PHASE_ORDER: DevPhase[] = [
  'planning',
  'development',
  'testing',
  'debugging',
  'release',
  'complete',
];

/**
 * v0.14：イベント効果の新名称軸（オーナー決定「新名称軸を追加」）。
 * `current.axes` に蓄積し、リリース時に既存の品質→メタスコア→売上/ファンへ合流する（spec §5-6）。
 */
export type DevAxis =
  | 'funFactor' // 面白さ → 品質
  | 'usability' // 操作性 → 品質
  | 'balance' // バランス → 品質
  | 'hype' // 期待度 → ファン/初動
  // 旧 'salesForecast'（売上予測%）は削除（オーナー判断 2026-07-25）。
  // 「予測」という名前なのに実売上を増やす補正で、効果も buzz と同じ式・同じ分母に足すだけだった＝
  // ゲーム内で何も表していない変数名がそのまま UI に出ていた。付与していたイベントは buzz に付け替え。
  | 'buzz' // 話題性 → ファン/売上
  | 'bugRate' // バグ率±（+ で品質減）
  | 'reputationRisk' // 炎上リスク（+ で売上/ファン減）
  | 'devWeeksDelta' // 開発期間±週
  | 'costMod' // コスト%（- で節約）
  | 'trust'; // 信頼度 → ファン微増

export type DevAxes = Record<DevAxis, number>;

export const ZERO_AXES: DevAxes = {
  funFactor: 0,
  usability: 0,
  balance: 0,
  hype: 0,
  buzz: 0,
  bugRate: 0,
  reputationRisk: 0,
  devWeeksDelta: 0,
  costMod: 0,
  trust: 0,
};

/** フェーズの表示メタ（左の進行リスト用）。番号は 1 始まり */
export const DEV_PHASE_META: Record<DevPhase, { label: string; image: string }> = {
  planning: { label: '企画', image: 'planning' },
  development: { label: '開発', image: 'development' },
  testing: { label: 'テスト', image: 'testing' },
  debugging: { label: 'デバッグ', image: 'debugging' },
  release: { label: '発売', image: 'release' },
  complete: { label: '開発完了', image: 'complete' },
};

export type CurrentProject = {
  title: string;
  genreId: GenreId;
  themeId: ThemeId;
  scale: Scale;
  /** v0.14：現在の開発フェーズ。未設定の旧データは development 扱い（防御） */
  phase?: DevPhase;
  /** v0.14：イベントで蓄積する新名称軸。リリース時に既存パイプラインへ合流（spec §5-6） */
  axes?: DevAxes;
  /**
   * v0.15 ビルドアップ・タイピング：打った文の属性ごとに伸びる開発パラメータ。
   * リリース時に品質・売上へ合流（因果を最後まで一本にする）
   */
  devStats?: { program: number; graphics: number; sound: number; design: number };
  requiredLoC: number;
  doneLoC: number;
  /** ノリ／コンボ最大値（このプロジェクト内） */
  maxCombo: number;
  /** 開発加速広告（生産速度2倍）の残り秒数 */
  devBoostRemainingSec: number;
  /**
   * v0.17：残バグ数。開発中にミス打鍵/コード起因で増え、デバッグフェーズの修正で減る。
   * リリース時に残っていると品質減点＋炎上リスク。0 なら「バグゼロ」ボーナス。
   * （旧 bugPhrase（v0.14 の15%抽選）はこのシステムに一本化して廃止）
   */
  bugCount: number;
  /**
   * v0.19：広告「デバッグ応援（バグ半減）」を今回の開発で使ったか（1開発1回）。
   * 旧セーブは undefined ＝ 未使用扱い（falsy 防御）。
   */
  adDebugUsed: boolean;
  startedAt: number;
  finishedAt: number | null;
  /** 旧フィールド（互換のため残置）：従業員モック広告 */
  adBoostActive: boolean;
  /** 市場調査広告で開示された相性 */
  surveyedCompat: number | null;
  /** 今回開発で選ばれた3つのカテゴリ */
  selectedCategories: CategoryId[];
  /** 今回開発に割り当てた従業員 */
  assignedEmployeeIds: string[];
  /** タイピングのパフォーマンス指標 */
  perf: {
    wpm: number;
    maxCombo: number;
    accuracy: number;
  };
  /** v0.10：開発開始時のゲーム内日付（F-6 完成サマリ用） */
  startDate?: GameDate;
  /** v0.10：WPM しきい値クロスで -X 週テロップを出した一覧（重複防止） */
  timeShortcutsUnlocked?: number[];
  /**
   * @deprecated v0.11 後期に締切（残り時間）モデルを廃止。現在は未設定。
   * 旧：開発フェーズの制限秒。0 到達で finishDevelopment していた。
   * 現行は進捗オンリー（workTarget まで打って完了）。後方互換のため型のみ残置。
   */
  timeLimitSec?: number;
  /** v0.11：演出表示用のミッション名（例 MISSION_04） */
  missionName?: string;
  /** v0.11：演出表示用のミッション見出し（例 敵を配置する） */
  missionDesc?: string;
  /**
   * v0.11：開発完了の作業量目標（完走すべきフレーズ数）。
   * doneLoC がこれに達したら開発完了。締切は無く、打たないと終わらない。
   * neededWeeks × DEV_PHRASES_PER_WEEK で startProject 時に確定。
   * 速く打つほど 1 本の進捗寄与が増え（DEV_SPEED_GAIN）、少ない本数で到達＝早期完了。
   */
  workTarget?: number;
};
