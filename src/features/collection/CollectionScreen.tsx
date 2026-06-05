import { useMemo } from 'react';
import { useGameStore } from '../../state/gameStore';
import { GENRES, GENRE_BY_ID } from '../../data/genres';
import { THEMES, THEME_BY_ID } from '../../data/themes';
import { getCompat, compatLabel } from '../../data/compatibility';

type Cell = {
  discovered: boolean;
  count: number;
  bestQ: number;
  bestRevenue: number;
  bestMeta: number;
};

export const CollectionScreen = () => {
  const library = useGameStore((s) => s.library);
  const goTo = useGameStore((s) => s.goTo);

  const stats = useMemo(() => {
    const map = new Map<string, Cell>();
    for (const w of library) {
      const key = `${w.genreId}|${w.themeId}`;
      const cur: Cell = map.get(key) ?? {
        discovered: true, count: 0, bestQ: 0, bestRevenue: 0, bestMeta: 0,
      };
      cur.count += 1;
      cur.bestQ = Math.max(cur.bestQ, w.quality);
      cur.bestRevenue = Math.max(cur.bestRevenue, w.revenue);
      cur.bestMeta = Math.max(cur.bestMeta, w.metascore);
      map.set(key, cur);
    }
    return map;
  }, [library]);

  const totalCells = GENRES.length * THEMES.length;
  const discoveredCount = stats.size;

  return (
    <div className="screen collection-screen">
      <header className="topbar">
        <h1>📖 ジャンル相性図鑑</h1>
        <div className="topbar-meta">
          <span>発見 {discoveredCount} / {totalCells}</span>
          <button className="link-btn" onClick={() => goTo('office')}>戻る</button>
        </div>
      </header>

      <section className="card">
        <p className="hint">マスをクリックする必要はありません。発見済みは相性ランクと記録を表示します。</p>
        <div className="collection-table-wrap">
          <table className="collection-table">
            <thead>
              <tr>
                <th></th>
                {THEMES.map((t) => (
                  <th key={t.id} title={t.name}>
                    <div className="ct-theme-head">
                      <span>{t.emoji}</span>
                      <span>{t.name}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {GENRES.map((g) => (
                <tr key={g.id}>
                  <th title={g.name}>
                    <div className="ct-genre-head">
                      <span>{g.emoji}</span>
                      <span>{g.name}</span>
                    </div>
                  </th>
                  {THEMES.map((t) => {
                    const key = `${g.id}|${t.id}`;
                    const cell = stats.get(key);
                    if (!cell) {
                      return (
                        <td key={t.id} className="ct-cell ct-unknown">？</td>
                      );
                    }
                    const c = getCompat(g.id, t.id);
                    return (
                      <td key={t.id} className="ct-cell ct-known" title={`${GENRE_BY_ID[g.id].name} × ${THEME_BY_ID[t.id].name}`}>
                        <div className="ct-rank">{compatLabel(c)}</div>
                        <div className="ct-numbers">
                          <span>Q{cell.bestQ}</span>
                          <span>🎯{cell.bestMeta}</span>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
