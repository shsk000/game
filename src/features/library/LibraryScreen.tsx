import { useGameStore } from '../../state/gameStore';
import { JacketView } from '../../components/JacketView';
import { GENRE_BY_ID } from '../../data/genres';
import { THEME_BY_ID } from '../../data/themes';
import { SCALE_BY_ID } from '../../data/scales';

export const LibraryScreen = () => {
  const library = useGameStore((s) => s.library);
  const goTo = useGameStore((s) => s.goTo);

  return (
    <div className="screen library-screen">
      <header className="topbar">
        <h1>📚 ライブラリ</h1>
        <div className="topbar-meta">
          <span>{library.length}本</span>
          <button className="link-btn" onClick={() => goTo('office')}>戻る</button>
        </div>
      </header>

      {library.length === 0 ? (
        <p className="empty">まだ作品はありません。最初の1本を作りましょう。</p>
      ) : (
        <div className="library-grid">
          {library.map((w) => {
            const genre = GENRE_BY_ID[w.genreId];
            const theme = THEME_BY_ID[w.themeId];
            const scale = SCALE_BY_ID[w.scale];
            return (
              <div key={w.id} className="library-card">
                <JacketView genreId={w.genreId} themeId={w.themeId} title={w.title} size="md" />
                <div className="library-meta">
                  <div className="lib-tags">
                    {genre.emoji}{genre.name} × {theme.emoji}{theme.name}
                  </div>
                  <div className="lib-scale">{scale.name}</div>
                  <div className={`lib-meta-score ${w.isMasterpiece ? 'masterpiece' : ''}`}>
                    🎯 {w.metascore}
                    {w.isMasterpiece && ' 🌟'}
                  </div>
                  <div className="lib-stats">
                    Q{w.quality} ／ ⏱ {w.developSec.toFixed(2)}秒 ／ 💰 ¥{w.revenue.toLocaleString()}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
