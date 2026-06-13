import type { CategoryId } from '../data/categories';
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
  /** 役職パラメータ：プログラマーはLoC/秒、デザイナーは品質基礎+、広報は売上%加算 */
  power: number;
  wage: number;
  specialties: EmployeeSpecialty[];
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

export type CurrentProject = {
  title: string;
  genreId: GenreId;
  themeId: ThemeId;
  scale: Scale;
  requiredLoC: number;
  doneLoC: number;
  /** ノリ／コンボ最大値（このプロジェクト内） */
  maxCombo: number;
  /** 開発加速広告（生産速度2倍）の残り秒数 */
  devBoostRemainingSec: number;
  /** バグイベント中のフレーズ（赤行）。クリアで品質ボーナス */
  bugPhrase: string | null;
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
   * v0.11：開発フェーズの制限時間（リアル秒）。startProject 時に
   * neededWeeks × (TIME_RATE_MS_PER_WEEK.typingActive/1000) で確定保存。
   * DevelopScreen の rAF で残り秒をカウントダウンし、0 到達で finishDevelopment。
   */
  timeLimitSec?: number;
  /** v0.11：演出表示用のミッション名（例 MISSION_04） */
  missionName?: string;
  /** v0.11：演出表示用のミッション見出し（例 敵を配置する） */
  missionDesc?: string;
  /**
   * v0.11：早期完了の作業量目標（完走すべきフレーズ数）。
   * doneLoC がこれに達したら制限秒を待たず開発完了（速く打つほど早く終わる）。
   * timeLimitSec / DEV_SEC_PER_PHRASE で startProject 時に確定。
   */
  workTarget?: number;
};
