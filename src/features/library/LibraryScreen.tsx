import { useMemo, useState } from 'react';
import { JacketView } from '../../components/JacketView';
import { PixelButton, PixelWindow } from '../../components/ui';
import { GENRE_BY_ID } from '../../data/genres';
import type { Scale } from '../../data/scales';
import { SCALE_BY_ID, SCALES } from '../../data/scales';
import { THEME_BY_ID } from '../../data/themes';
import { useGameStore } from '../../state/gameStore';
import { formatYen } from '../../utils/format';

/**
 * 作品ライブラリ画面：これまでリリースした作品一覧。
 *
 * 構造：
 *   ┌─ PixelStatusBar（上部固定）
 *   ├─ PixelWindow「📚 作品ライブラリ」
 *   │   └─ 作品ごとに PixelWindow (variant="standard") で囲って表示
 *   └─ PixelMenuBar（下部固定。オフィス/計画/図鑑など）
 *
 * SKILL `game-ui-design` 準拠：
 * - Tailwind / モダン CSS は使わず、PixelWindow を入れ子で構成
 * - 販売中バーはピクセル感を保つため単色の幅 N% div
 * - 戻るボタンは PixelMenuBar の「オフィス」アイコン
 */

type SortKey = 'newest' | 'revenue' | 'metascore';
const PAGE_SIZE = 12;

export const LibraryScreen = () => {
  const library = useGameStore((s) => s.library);

  // フィルタ・ソート・ページング状態
  const [scaleFilter, setScaleFilter] = useState<Scale | 'all'>('all');
  const [sortKey, setSortKey] = useState<SortKey>('newest');
  const [page, setPage] = useState(0);

  const filteredSorted = useMemo(() => {
    const filtered =
      scaleFilter === 'all' ? library : library.filter((w) => w.scale === scaleFilter);
    const sorted = [...filtered];
    if (sortKey === 'newest') sorted.sort((a, b) => b.releasedAt - a.releasedAt);
    else if (sortKey === 'revenue') sorted.sort((a, b) => b.totalRevenue - a.totalRevenue);
    else if (sortKey === 'metascore') sorted.sort((a, b) => b.metascore - a.metascore);
    return sorted;
  }, [library, scaleFilter, sortKey]);

  const totalPages = Math.max(1, Math.ceil(filteredSorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const paged = filteredSorted.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  const sellingCount = library.filter((w) => w.selling).length;

  // v0.11 G2：ScreenOverlay の中身として描画（ページ遷移しない）
  return (
    <div
      className="library-screen"
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
      {/* フィルタ + ソート + ページャ */}
      {library.length > 0 && (
        <PixelWindow variant="standard" bodyStyle={{ padding: 8 }}>
          <div
            style={{
              display: 'flex',
              gap: 12,
              alignItems: 'center',
              flexWrap: 'wrap',
              fontSize: 12,
            }}
          >
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              規模:
              <select
                value={scaleFilter}
                onChange={(e) => {
                  setScaleFilter(e.target.value as Scale | 'all');
                  setPage(0);
                }}
                style={{
                  padding: '2px 6px',
                  fontFamily: 'inherit',
                  fontSize: 12,
                  border: '2px solid #0a1422',
                  background: '#ffffff',
                }}
              >
                <option value="all">全て</option>
                {SCALES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              ソート:
              <select
                value={sortKey}
                onChange={(e) => {
                  setSortKey(e.target.value as SortKey);
                  setPage(0);
                }}
                style={{
                  padding: '2px 6px',
                  fontFamily: 'inherit',
                  fontSize: 12,
                  border: '2px solid #0a1422',
                  background: '#ffffff',
                }}
              >
                <option value="newest">新しい順</option>
                <option value="revenue">売上順</option>
                <option value="metascore">メタスコア順</option>
              </select>
            </label>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
              <PixelButton
                size="small"
                variant="secondary"
                disabled={currentPage === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                ◀
              </PixelButton>
              <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>
                {currentPage + 1} / {totalPages}
              </span>
              <PixelButton
                size="small"
                variant="secondary"
                disabled={currentPage >= totalPages - 1}
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              >
                ▶
              </PixelButton>
            </div>
          </div>
        </PixelWindow>
      )}

      <PixelWindow
        title={`📚 作品ライブラリ（${filteredSorted.length}本表示 / 販売中 ${sellingCount}本 / 累計 ${library.length}本）`}
        variant="standard"
        bodyStyle={{ padding: 12 }}
      >
        {library.length === 0 ? (
          <div
            style={{
              padding: '32px 16px',
              textAlign: 'center',
              fontSize: 13,
              color: '#3a4148',
              lineHeight: 1.6,
            }}
          >
            まだ作品がありません。
            <br />
            最初の1本を作りましょう。
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 12,
            }}
          >
            {paged.map((w) => {
              const genre = GENRE_BY_ID[w.genreId];
              const theme = THEME_BY_ID[w.themeId];
              const scale = SCALE_BY_ID[w.scale];
              const sellingRatio =
                w.initialSalesPool > 0
                  ? Math.max(0, Math.min(1, w.salesPool / w.initialSalesPool))
                  : 0;
              const sellingPct = Math.round(sellingRatio * 100);

              return (
                <PixelWindow
                  key={w.id}
                  className="library-card"
                  variant={w.isMasterpiece ? 'emphasis' : 'standard'}
                  bodyStyle={{ padding: 10 }}
                >
                  <div
                    style={{
                      display: 'flex',
                      gap: 10,
                      alignItems: 'flex-start',
                    }}
                  >
                    <div style={{ flexShrink: 0 }}>
                      <JacketView
                        genreId={w.genreId}
                        themeId={w.themeId}
                        title={w.title}
                        size="sm"
                      />
                    </div>
                    <div
                      style={{
                        flex: 1,
                        minWidth: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: '#1c2228',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                        title={w.title}
                      >
                        {w.pioneer && '🌱 '}
                        {w.title}
                      </div>
                      <div style={{ fontSize: 11, color: '#3a4148' }}>
                        {genre.emoji}
                        {genre.name} × {theme.emoji}
                        {theme.name}
                      </div>
                      <div style={{ fontSize: 11, color: '#3a4148' }}>{scale.name}</div>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: w.isMasterpiece ? '#a86a1e' : '#1a0f08',
                        }}
                      >
                        🎯 {w.metascore}
                        {w.isMasterpiece && ' 🌟'}
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      marginTop: 8,
                      fontSize: 11,
                      color: '#3a4148',
                      lineHeight: 1.5,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    <br />💰 初動 {formatYen(w.initialRevenue)} ／ 累計 {formatYen(w.totalRevenue)}
                  </div>

                  {w.selling ? (
                    <div style={{ marginTop: 8 }}>
                      <div
                        aria-label={`販売残 ${sellingPct}%`}
                        style={{
                          height: 10,
                          background: '#c9ccd0',
                          border: '2px solid #0a1422',
                          borderRadius: 2,
                          overflow: 'hidden',
                          imageRendering: 'pixelated',
                        }}
                      >
                        <div
                          style={{
                            width: `${sellingPct}%`,
                            height: '100%',
                            background: '#5aa84a',
                            boxShadow: 'inset 0 0 0 1px #2d6b22',
                          }}
                        />
                      </div>
                      <div
                        style={{
                          marginTop: 4,
                          fontSize: 11,
                          color: '#3a4148',
                          fontWeight: 700,
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        販売中 残 {formatYen(w.salesPool)}
                      </div>
                    </div>
                  ) : (
                    <div
                      style={{
                        marginTop: 8,
                        padding: '4px 8px',
                        background: '#dfe3e8',
                        border: '2px solid #0a1422',
                        borderRadius: 2,
                        fontSize: 11,
                        color: '#3a4148',
                        fontWeight: 700,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      完売 {formatYen(w.totalRevenue)}
                    </div>
                  )}
                </PixelWindow>
              );
            })}
          </div>
        )}
      </PixelWindow>
    </div>
  );
};
