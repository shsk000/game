import { JacketView } from '../../components/JacketView';
import {
  PixelMenuBar,
  type PixelMenuItem,
  PixelStatusBar,
  PixelWindow,
} from '../../components/ui';
import { GENRE_BY_ID } from '../../data/genres';
import { SCALE_BY_ID } from '../../data/scales';
import { THEME_BY_ID } from '../../data/themes';
import { useGameStore } from '../../state/gameStore';

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

const ICON_BASE = '/sprites/ui';

export const LibraryScreen = () => {
  const library = useGameStore((s) => s.library);
  const goTo = useGameStore((s) => s.goTo);

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
      id: 'collection',
      label: '図鑑',
      emoji: '📖',
      iconSrc: `${ICON_BASE}/icon_collection.png`,
      onClick: () => goTo('collection'),
    },
  ];

  const sellingCount = library.filter((w) => w.selling).length;

  return (
    <div
      className="screen library-screen"
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
          title={`📚 作品ライブラリ（${library.length}本 / 販売中 ${sellingCount}本）`}
          variant="standard"
          bodyStyle={{ padding: 12 }}
        >
          {library.length === 0 ? (
            <div
              style={{
                padding: '32px 16px',
                textAlign: 'center',
                fontSize: 13,
                color: '#3a2a1e',
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
              {library.map((w) => {
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
                            color: '#1a0f08',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          title={w.title}
                        >
                          {w.pioneer && '🌱 '}
                          {w.title}
                        </div>
                        <div style={{ fontSize: 11, color: '#3a2a1e' }}>
                          {genre.emoji}
                          {genre.name} × {theme.emoji}
                          {theme.name}
                        </div>
                        <div style={{ fontSize: 11, color: '#3a2a1e' }}>{scale.name}</div>
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
                        color: '#3a2a1e',
                        lineHeight: 1.5,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      Q{w.quality} ／ ⏱ {w.developSec.toFixed(2)}秒
                      <br />
                      💰 初動 ¥{w.initialRevenue.toLocaleString()} ／ 累計 ¥
                      {w.totalRevenue.toLocaleString()}
                    </div>

                    {w.selling ? (
                      <div style={{ marginTop: 8 }}>
                        <div
                          aria-label={`販売残 ${sellingPct}%`}
                          style={{
                            height: 10,
                            background: '#1a0f08',
                            border: '2px solid #2c1f15',
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
                            color: '#3a2a1e',
                            fontWeight: 700,
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          販売中 残¥{Math.round(w.salesPool).toLocaleString()}
                        </div>
                      </div>
                    ) : (
                      <div
                        style={{
                          marginTop: 8,
                          padding: '4px 8px',
                          background: '#e8d8b0',
                          border: '2px solid #2c1f15',
                          borderRadius: 2,
                          fontSize: 11,
                          color: '#3a2a1e',
                          fontWeight: 700,
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        完売 ¥{w.totalRevenue.toLocaleString()}
                      </div>
                    )}
                  </PixelWindow>
                );
              })}
            </div>
          )}
        </PixelWindow>
      </main>

      <PixelMenuBar items={menuItems} />
    </div>
  );
};
