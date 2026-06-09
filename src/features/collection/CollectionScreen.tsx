import { useMemo } from 'react';
import { PixelMenuBar, type PixelMenuItem, PixelStatusBar, PixelWindow } from '../../components/ui';
import { compatLabel, getCompat } from '../../data/compatibility';
import { GENRE_BY_ID, GENRES } from '../../data/genres';
import { THEME_BY_ID, THEMES } from '../../data/themes';
import { useGameStore } from '../../state/gameStore';

/**
 * ジャンル相性図鑑画面：ジャンル × テーマの 12 × 15 マトリクス。
 *
 * 構造：
 *   ┌─ PixelStatusBar（上部固定）
 *   ├─ PixelWindow「📖 ジャンル相性図鑑」
 *   │   └─ ジャンル × テーマの表（ピクセル風セル）
 *   └─ PixelMenuBar（下部固定。オフィス/計画/作品）
 *
 * SKILL `game-ui-design` 準拠：
 * - Tailwind / モダン CSS は使わず、PixelWindow と単色セルで構成
 * - 発見済セル：緑系背景・compatLabel + Q / 🎯
 * - 未発見セル：グレー背景・黄色「？」
 * - 表が大きいので overflow-x: auto で横スクロール可
 */

const ICON_BASE = '/sprites/ui';

type Cell = {
  discovered: boolean;
  count: number;
  bestQ: number;
  bestRevenue: number;
  bestMeta: number;
};

// 相性ランクに応じた背景色（ピクセル風単色のみ）
const compatBg = (c: number): string => {
  if (c >= 1.7) return '#f0c020'; // 神（金）
  if (c >= 1.3) return '#5aa84a'; // good（緑）
  if (c >= 0.9) return '#a0b85a'; // 普通（薄緑）
  return '#a83a3a'; // 地雷（赤）
};

const compatFg = (c: number): string => {
  if (c >= 1.7) return '#1a0f08';
  if (c >= 1.3) return '#1a0f08';
  if (c >= 0.9) return '#1a0f08';
  return '#fff8e0';
};

const HEADER_CELL: React.CSSProperties = {
  background: '#3a2a1e',
  color: '#fff8e0',
  border: '2px solid #1a0f08',
  padding: '4px 6px',
  fontSize: 12,
  textAlign: 'center',
  lineHeight: 1.2,
  fontWeight: 700,
  minWidth: 60,
};

const ROW_HEADER_CELL: React.CSSProperties = {
  ...HEADER_CELL,
  textAlign: 'left',
  minWidth: 100,
  position: 'sticky',
  left: 0,
  zIndex: 1,
};

const BASE_CELL: React.CSSProperties = {
  border: '2px solid #8b6f47',
  padding: '4px 4px',
  fontSize: 11,
  textAlign: 'center',
  lineHeight: 1.2,
  minWidth: 60,
  height: 48,
  fontVariantNumeric: 'tabular-nums',
};

const LEGEND_SWATCH: React.CSSProperties = {
  display: 'inline-block',
  width: 16,
  height: 16,
  border: '2px solid #1a0f08',
  marginRight: 6,
  verticalAlign: 'middle',
  imageRendering: 'pixelated',
};

export const CollectionScreen = () => {
  const library = useGameStore((s) => s.library);
  const unlockedGenres = useGameStore((s) => s.unlockedGenres);
  const unlockedThemes = useGameStore((s) => s.unlockedThemes);
  const goTo = useGameStore((s) => s.goTo);

  // v0.10 仕上げ：未解放ジャンル / テーマは図鑑にも出さない（何があるか分からない設計）。
  const visibleGenres = useMemo(
    () => GENRES.filter((g) => unlockedGenres.includes(g.id)),
    [unlockedGenres],
  );
  const visibleThemes = useMemo(
    () => THEMES.filter((t) => unlockedThemes.includes(t.id)),
    [unlockedThemes],
  );

  const stats = useMemo(() => {
    const map = new Map<string, Cell>();
    for (const w of library) {
      const key = `${w.genreId}|${w.themeId}`;
      const cur: Cell = map.get(key) ?? {
        discovered: true,
        count: 0,
        bestQ: 0,
        bestRevenue: 0,
        bestMeta: 0,
      };
      cur.count += 1;
      cur.bestQ = Math.max(cur.bestQ, w.quality);
      cur.bestRevenue = Math.max(cur.bestRevenue, w.totalRevenue);
      cur.bestMeta = Math.max(cur.bestMeta, w.metascore);
      map.set(key, cur);
    }
    return map;
  }, [library]);

  const totalCells = visibleGenres.length * visibleThemes.length;
  const discoveredCount = stats.size;

  const menuItems: PixelMenuItem[] = [
    {
      id: 'office',
      label: 'オフィス',
      emoji: '🏠',
      iconSrc: `${ICON_BASE}/icon_office.png`,
      onClick: () => goTo('office'),
    },
    {
      id: 'plan',
      label: '計画',
      emoji: '📋',
      iconSrc: `${ICON_BASE}/icon_plan.png`,
      onClick: () => goTo('plan'),
    },
    {
      id: 'library',
      label: '作品',
      emoji: '📚',
      iconSrc: `${ICON_BASE}/icon_library.png`,
      onClick: () => goTo('library'),
    },
  ];

  return (
    <div
      className="screen collection-screen"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        minHeight: '100dvh',
        padding: 12,
        background: '#2a1a0e',
      }}
    >
      <PixelStatusBar />

      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          minHeight: 0,
        }}
      >
        <PixelWindow
          title={`📖 ジャンル相性図鑑（発見 ${discoveredCount} / ${totalCells}）`}
          variant="standard"
          bodyStyle={{ padding: 12 }}
        >
          <p
            style={{
              margin: '0 0 10px',
              fontSize: 12,
              color: '#3a2a1e',
              lineHeight: 1.5,
            }}
          >
            作品をリリースするとマスが解放されます。発見済みは相性ランクと最高記録（Q・🎯）を表示。
          </p>

          <div
            style={{
              overflowX: 'auto',
              border: '3px solid #1a0f08',
              background: '#5c4a3a',
              imageRendering: 'pixelated',
            }}
          >
            <table
              style={{
                borderCollapse: 'collapse',
                width: '100%',
                tableLayout: 'fixed',
              }}
            >
              <thead>
                <tr>
                  <th
                    style={{
                      ...ROW_HEADER_CELL,
                      background: '#1a0f08',
                    }}
                  >
                    ジャンル ＼ テーマ
                  </th>
                  {visibleThemes.map((t) => (
                    <th key={t.id} style={HEADER_CELL} title={t.name}>
                      <div style={{ fontSize: 14, lineHeight: 1.2 }}>{t.emoji}</div>
                      <div style={{ fontSize: 10, lineHeight: 1.2, marginTop: 2 }}>{t.name}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleGenres.map((g) => (
                  <tr key={g.id}>
                    <th style={ROW_HEADER_CELL} title={g.name}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <span style={{ fontSize: 14 }}>{g.emoji}</span>
                        <span style={{ fontSize: 11 }}>{g.name}</span>
                      </div>
                    </th>
                    {visibleThemes.map((t) => {
                      const key = `${g.id}|${t.id}`;
                      const cell = stats.get(key);
                      if (!cell) {
                        return (
                          <td
                            key={t.id}
                            style={{
                              ...BASE_CELL,
                              background: '#5c4a3a',
                              color: '#f0c020',
                              fontSize: 20,
                              fontWeight: 700,
                            }}
                          >
                            ？
                          </td>
                        );
                      }
                      const c = getCompat(g.id, t.id);
                      return (
                        <td
                          key={t.id}
                          style={{
                            ...BASE_CELL,
                            background: compatBg(c),
                            color: compatFg(c),
                            fontWeight: 700,
                          }}
                          title={`${GENRE_BY_ID[g.id].name} × ${THEME_BY_ID[t.id].name}`}
                        >
                          <div style={{ fontSize: 11, lineHeight: 1.1 }}>{compatLabel(c)}</div>
                          <div
                            style={{
                              fontSize: 10,
                              marginTop: 2,
                              lineHeight: 1.1,
                              display: 'flex',
                              justifyContent: 'center',
                              gap: 4,
                              flexWrap: 'wrap',
                            }}
                          >
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

          {/* 凡例 */}
          <div
            style={{
              marginTop: 12,
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px 16px',
              fontSize: 11,
              color: '#3a2a1e',
              lineHeight: 1.6,
            }}
          >
            <span>
              <span style={{ ...LEGEND_SWATCH, background: '#f0c020' }} />🔥 神（1.7+）
            </span>
            <span>
              <span style={{ ...LEGEND_SWATCH, background: '#5aa84a' }} />👍 good（1.3+）
            </span>
            <span>
              <span style={{ ...LEGEND_SWATCH, background: '#a0b85a' }} />😐 普通（0.9+）
            </span>
            <span>
              <span style={{ ...LEGEND_SWATCH, background: '#a83a3a' }} />💀 地雷（&lt;0.9）
            </span>
            <span>
              <span style={{ ...LEGEND_SWATCH, background: '#5c4a3a' }} />？ 未発見
            </span>
          </div>
        </PixelWindow>
      </main>

      <PixelMenuBar items={menuItems} />
    </div>
  );
};
