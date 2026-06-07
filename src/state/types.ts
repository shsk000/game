import type { CategoryId } from '../data/categories';
import type { GenreId } from '../data/genres';
import type { Scale } from '../data/scales';
import type { ThemeId } from '../data/themes';

export type Screen = 'plan' | 'develop' | 'release' | 'office' | 'library' | 'collection';

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

export type WorkBreakdown = {
  base: number;
  categories: number;
  employees: number;
  performance: number;
  ads: number;
  variance: number;
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
};
