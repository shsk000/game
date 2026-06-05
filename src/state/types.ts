import type { Scale } from '../data/scales';
import type { GenreId } from '../data/genres';
import type { ThemeId } from '../data/themes';

export type Screen =
  | 'plan'
  | 'develop'
  | 'polish'
  | 'release'
  | 'office'
  | 'library';

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
  startedAt: number;
  finishedAt: number | null;
  adBoostActive: boolean;
};
