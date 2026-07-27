import { useEffect, useMemo, useState } from 'react';
import { PixelWindow } from '../../components/ui';
import { compatLabel, getCompat } from '../../data/compatibility';
import type { GenreId } from '../../data/genres';
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

type Cell = {
  discovered: boolean;
  count: number;
  bestQ: number;
  bestRevenue: number;
  bestMeta: number;
};

// 相性ランクに応じた背景色（ピクセル風単色のみ）
// v0.16でgetCompatの実効上限を2.0→1.6に圧縮した際、この閾値(1.7)を下げ忘れており
// 「神」が理論上出せなくなっていた（2026-07-16 発見・修正）。上限と同じ1.6に揃える。
export const compatBg = (c: number): string => {
  if (c >= 1.6) return '#f0c020'; // 神（金）
  if (c >= 1.3) return '#5aa84a'; // good（緑）
  if (c >= 0.9) return '#a0b85a'; // 普通（薄緑）
  return '#a83a3a'; // 地雷（赤）
};

export const compatFg = (c: number): string => {
  if (c >= 1.6) return '#1a0f08';
  if (c >= 1.3) return '#1a0f08';
  if (c >= 0.9) return '#1a0f08';
  return '#fff8e0';
};

const LEGEND_SWATCH: React.CSSProperties = {
  display: 'inline-block',
  width: 16,
  height: 16,
  border: '2px solid #0a1422',
  marginRight: 6,
  verticalAlign: 'middle',
  imageRendering: 'pixelated',
};

export const CollectionScreen = () => {
  const library = useGameStore((s) => s.library);
  const unlockedGenres = useGameStore((s) => s.unlockedGenres);
  const unlockedThemes = useGameStore((s) => s.unlockedThemes);

  // v0.10 仕上げ：未解放ジャンル / テーマは図鑑にも出さない（何があるか分からない設計）。
  const visibleGenres = useMemo(
    () => GENRES.filter((g) => unlockedGenres.includes(g.id)),
    [unlockedGenres],
  );
  const visibleThemes = useMemo(
    () => THEMES.filter((t) => unlockedThemes.includes(t.id)),
    [unlockedThemes],
  );

  // v0.11 L7：選択中ジャンルのタブ
  const [activeGenre, setActiveGenre] = useState<GenreId | null>(visibleGenres[0]?.id ?? null);
  // 解放ジャンルが変わった時のフェイルセーフ
  useEffect(() => {
    if (visibleGenres.length === 0) {
      setActiveGenre(null);
      return;
    }
    if (!activeGenre || !visibleGenres.some((g) => g.id === activeGenre)) {
      setActiveGenre(visibleGenres[0].id);
    }
  }, [visibleGenres, activeGenre]);

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
      cur.bestQ = Math.max(cur.bestQ, w.metascore);
      cur.bestRevenue = Math.max(cur.bestRevenue, w.totalRevenue);
      cur.bestMeta = Math.max(cur.bestMeta, w.metascore);
      map.set(key, cur);
    }
    return map;
  }, [library]);

  const totalCells = visibleGenres.length * visibleThemes.length;
  const discoveredCount = stats.size;

  // v0.11 G2：ScreenOverlay の中身として描画（ページ遷移しない）
  return (
    <div
      className="collection-screen"
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        padding: 10,
        minHeight: 0,
        overflow: 'auto',
        background: '#c9ccd0',
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
            color: '#3a4148',
            lineHeight: 1.5,
          }}
        >
          選択中ジャンルと解放済テーマの相性を表示。発見済は相性ランク + 最高記録（Q・🎯）。
        </p>

        {/* v0.11 L7：ジャンルタブ */}
        <div
          style={{
            display: 'flex',
            gap: 4,
            flexWrap: 'wrap',
            marginBottom: 10,
            padding: 4,
            background: '#aab2bb',
            border: '2px solid #0a1422',
          }}
        >
          {visibleGenres.map((g) => {
            const isActive = g.id === activeGenre;
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => setActiveGenre(g.id)}
                style={{
                  padding: '4px 10px',
                  fontFamily: 'inherit',
                  fontSize: 12,
                  fontWeight: 700,
                  background: isActive ? '#ffd54a' : '#3a2a1e',
                  color: isActive ? '#1a0f08' : '#fff8e0',
                  border: '2px solid #0a1422',
                  cursor: 'pointer',
                  imageRendering: 'pixelated',
                }}
              >
                {g.emoji} {g.name}
              </button>
            );
          })}
          {GENRES.length > visibleGenres.length && (
            <span style={{ fontSize: 11, color: '#6b7280', alignSelf: 'center', padding: '0 6px' }}>
              + ? 種類（未解放）
            </span>
          )}
        </div>

        {/* v0.11 L7：選択中ジャンル × 解放済テーマ グリッド（5×3） */}
        {activeGenre && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(5, 1fr)',
              gap: 6,
              padding: 6,
              background: '#aab2bb',
              border: '2px solid #0a1422',
              imageRendering: 'pixelated',
            }}
          >
            {visibleThemes.map((t) => {
              const key = `${activeGenre}|${t.id}`;
              const cell = stats.get(key);
              if (!cell) {
                return (
                  <div
                    key={t.id}
                    style={{
                      padding: 8,
                      background: '#3a4148',
                      color: '#f0c020',
                      textAlign: 'center',
                      border: '2px solid #0a1422',
                      minHeight: 70,
                    }}
                  >
                    <div style={{ fontSize: 16 }}>{t.emoji}</div>
                    <div style={{ fontSize: 10, color: '#6b7280' }}>{t.name}</div>
                    <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>？</div>
                  </div>
                );
              }
              const c = getCompat(activeGenre, t.id);
              return (
                <div
                  key={t.id}
                  style={{
                    padding: 8,
                    background: compatBg(c),
                    color: compatFg(c),
                    textAlign: 'center',
                    border: '2px solid #0a1422',
                    fontWeight: 700,
                    minHeight: 70,
                  }}
                  title={`${GENRE_BY_ID[activeGenre].name} × ${THEME_BY_ID[t.id].name}`}
                >
                  <div style={{ fontSize: 16 }}>{t.emoji}</div>
                  <div style={{ fontSize: 10 }}>{t.name}</div>
                  <div style={{ fontSize: 11, marginTop: 2 }}>{compatLabel(c)}</div>
                  <div style={{ fontSize: 9, marginTop: 1 }}>
                    Q{cell.bestQ} 🎯{cell.bestMeta}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 凡例 */}
        <div
          style={{
            marginTop: 12,
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px 16px',
            fontSize: 11,
            color: '#3a4148',
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
            <span style={{ ...LEGEND_SWATCH, background: '#16263e' }} />？ 未発見
          </span>
        </div>
      </PixelWindow>
    </div>
  );
};
