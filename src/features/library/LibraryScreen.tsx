import { JacketView } from '../../components/JacketView';
import { GENRE_BY_ID } from '../../data/genres';
import { SCALE_BY_ID } from '../../data/scales';
import { THEME_BY_ID } from '../../data/themes';
import { useGameStore } from '../../state/gameStore';

export const LibraryScreen = () => {
  const library = useGameStore((s) => s.library);
  const goTo = useGameStore((s) => s.goTo);

  return (
    <div className="screen library-screen">
      <header className="topbar">
        <h1>📚 ライブラリ</h1>
        <div className="topbar-meta">
          <span>{library.length}本</span>
          <button className="link-btn" onClick={() => goTo('office')}>
            戻る
          </button>
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
            const sellingRatio =
              w.initialSalesPool > 0
                ? Math.max(0, Math.min(1, w.salesPool / w.initialSalesPool))
                : 0;
            return (
              <div key={w.id} className="library-card">
                <JacketView genreId={w.genreId} themeId={w.themeId} title={w.title} size="md" />
                <div className="library-meta">
                  <div className="lib-title-row">
                    {w.pioneer && '🌱 '}
                    {w.title}
                  </div>
                  <div className="lib-tags">
                    {genre.emoji}
                    {genre.name} × {theme.emoji}
                    {theme.name}
                  </div>
                  <div className="lib-scale">{scale.name}</div>
                  <div className={`lib-meta-score ${w.isMasterpiece ? 'masterpiece' : ''}`}>
                    🎯 {w.metascore}
                    {w.isMasterpiece && ' 🌟'}
                  </div>
                  <div className="lib-stats">
                    Q{w.quality} ／ ⏱ {w.developSec.toFixed(2)}秒 ／ 💰 初動 ¥
                    {w.initialRevenue.toLocaleString()} ／ 累計 ¥{w.totalRevenue.toLocaleString()}
                  </div>
                  {w.selling ? (
                    <div className="lib-selling">
                      <div className="lib-selling-bar">
                        <div
                          className="lib-selling-fill"
                          style={{ width: `${sellingRatio * 100}%` }}
                        />
                      </div>
                      <div className="lib-selling-label">
                        販売中 残¥{w.salesPool.toLocaleString()}
                      </div>
                    </div>
                  ) : (
                    <div className="lib-sold-out">完売 ¥{w.totalRevenue.toLocaleString()}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
