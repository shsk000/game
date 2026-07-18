import { compatBg, compatFg } from '../features/collection/CollectionScreen';
import { compatLabel, getCompat } from '../data/compatibility';
import { GENRES } from '../data/genres';
import { THEMES } from '../data/themes';

/**
 * ジャンル×テーマの相性倍率を全組み合わせ表示する開発ツール。
 * CollectionScreen（図鑑）と違い「未発見」ゲートを掛けない（全組み合わせを常に見せる）。
 * 新ジャンル/テーマを追加した際に、compatibility.ts のタグ加点だけで妥当な分布になっているかを
 * 確認するために使う。
 */

const cellStyle: React.CSSProperties = {
  width: 44,
  height: 32,
  fontSize: 10,
  textAlign: 'center',
  border: '1px solid #16202c',
  whiteSpace: 'nowrap',
};

const headerCellStyle: React.CSSProperties = {
  ...cellStyle,
  width: 64,
  padding: '2px 4px',
};

export const AdminCompatMatrix = () => {
  return (
    <div style={{ padding: 20, fontFamily: 'monospace', color: '#dce8f2' }}>
      <h2 style={{ fontSize: 16, marginBottom: 4 }}>
        ジャンル×テーマ相性倍率一覧（{GENRES.length}×{THEMES.length}={GENRES.length * THEMES.length}組）
      </h2>
      <p style={{ fontSize: 12, color: '#9fb6d4', marginBottom: 16 }}>
        未解放・未発見に関係なく全組み合わせを表示（バランス確認用）。セル＝compat倍率
      </p>
      <div style={{ overflow: 'auto', maxWidth: '100%', border: '2px solid #223448' }}>
        <table style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th
                style={{
                  ...cellStyle,
                  position: 'sticky',
                  left: 0,
                  top: 0,
                  zIndex: 2,
                  background: '#101c2a',
                  width: 110,
                }}
              />
              {THEMES.map((t) => (
                <th
                  key={t.id}
                  style={{
                    ...headerCellStyle,
                    position: 'sticky',
                    top: 0,
                    background: '#101c2a',
                    fontWeight: 400,
                  }}
                  title={t.name}
                >
                  {t.emoji}
                  <br />
                  {t.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {GENRES.map((g) => (
              <tr key={g.id}>
                <th
                  style={{
                    ...cellStyle,
                    position: 'sticky',
                    left: 0,
                    background: '#101c2a',
                    textAlign: 'left',
                    width: 110,
                    fontWeight: 400,
                  }}
                >
                  {g.emoji} {g.name}
                </th>
                {THEMES.map((t) => {
                  const c = getCompat(g.id, t.id);
                  return (
                    <td
                      key={t.id}
                      style={{
                        ...cellStyle,
                        background: compatBg(c),
                        color: compatFg(c),
                      }}
                      title={`${g.name} × ${t.name} = ${compatLabel(c)}`}
                    >
                      {c.toFixed(2)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 12, fontSize: 11, color: '#9fb6d4' }}>
        <span style={{ background: '#f0c020', color: '#1a0f08', padding: '1px 6px' }}>■</span> 神
        (1.6+)
        <span style={{ background: '#5aa84a', color: '#1a0f08', padding: '1px 6px' }}>■</span> good
        (1.3+)
        <span style={{ background: '#a0b85a', color: '#1a0f08', padding: '1px 6px' }}>■</span> 普通
        (0.9+)
        <span style={{ background: '#a83a3a', color: '#fff8e0', padding: '1px 6px' }}>■</span> 地雷
      </div>
    </div>
  );
};
