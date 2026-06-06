import type { GenreId } from '../data/genres';
import type { Scale } from '../data/scales';
import type { ThemeId } from '../data/themes';

export type Screen =
  | 'plan'
  | 'develop'
  | 'polish'
  | 'release'
  | 'office'
  | 'library'
  | 'collection';

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

export type Employee = {
  id: string;
  name: string;
  role: EmployeeRole;
  /** 役職パラメータ：プログラマーはLoC/秒、デザイナーは品質基礎+、広報は売上%加算 */
  power: number;
  wage: number;
};

export type Candidate = Employee;

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
};

export type CurrentProject = {
  title: string;
  genreId: GenreId;
  themeId: ThemeId;
  scale: Scale;
  requiredLoC: number;
  doneLoC: number;
  polishLoC: number;
  /** ノリ／コンボ最大値（このプロジェクト内） */
  maxCombo: number;
  /** ポリッシュ時の累積コンボボーナス（0〜0.5） */
  comboBonus: number;
  /** 開発加速広告（生産速度2倍）の残り秒数 */
  devBoostRemainingSec: number;
  /** ポリッシュ効率2倍広告の残り秒数 */
  polishBoostRemainingSec: number;
  /** バグイベント中のフレーズ（赤行）。クリアで品質ボーナス */
  bugPhrase: string | null;
  startedAt: number;
  finishedAt: number | null;
  /** 旧フィールド（互換のため残置）：従業員モック広告 */
  adBoostActive: boolean;
  /** 市場調査広告で開示された相性 */
  surveyedCompat: number | null;
};
