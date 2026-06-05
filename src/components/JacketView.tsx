import type { GenreId } from '../data/genres';
import type { ThemeId } from '../data/themes';
import { GENRE_BY_ID } from '../data/genres';
import { THEME_BY_ID } from '../data/themes';

type Props = {
  genreId: GenreId;
  themeId: ThemeId;
  title?: string;
  size?: 'sm' | 'md' | 'lg';
};

export const JacketView = ({ genreId, themeId, title, size = 'md' }: Props) => {
  const genre = GENRE_BY_ID[genreId];
  const theme = THEME_BY_ID[themeId];
  const dim = size === 'lg' ? 200 : size === 'sm' ? 96 : 140;
  const themeFs = size === 'lg' ? 76 : size === 'sm' ? 36 : 56;
  const genreFs = size === 'lg' ? 44 : size === 'sm' ? 22 : 32;
  return (
    <div className="jacket" style={{ width: dim }}>
      <div
        className="jacket-art"
        style={{ background: genre.bgColor, height: dim }}
      >
        <span className="jacket-theme" style={{ fontSize: themeFs }}>
          {theme.emoji}
        </span>
        <span className="jacket-genre" style={{ fontSize: genreFs }}>
          {genre.emoji}
        </span>
      </div>
      {title !== undefined && (
        <div className="jacket-title" title={title}>
          {title}
        </div>
      )}
    </div>
  );
};
