import type { Scale } from '../data/scales';
import type { GenreId } from '../data/genres';
import type { ThemeId } from '../data/themes';

export type Screen =
  | 'plan'
  | 'develop'
  | 'polish'
  | 'release'
  | 'office'
  | 'library'
  | 'collection';

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
  revenue: number;
  fansGained: number;
  ghostBeaten: boolean;
  launchAdUsed: boolean;
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
  startedAt: number;
  finishedAt: number | null;
  adBoostActive: boolean;
};
