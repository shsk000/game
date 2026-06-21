import { useState } from 'react';
import type { Scale } from '../data/scales';
import {
  cellPx,
  type Dir,
  eachCell,
  footprintCenterOffset,
  makeGeometry,
  type Placement,
  ROOM,
  SPRITE_BASE,
} from '../lib/officeGeometry';
import {
  DEFAULT_WORKSTATIONS,
  type DecorDir,
  type DecorPlacement,
  decorGeom,
  decorImg,
  type DoorCfg,
  loadDecorCatalog,
  loadDecorPlacements,
  loadDoor,
  loadWallCatalog,
  loadWallPlacements,
  loadWorkstations,
  saveDecorPlacements,
  saveDoor,
  saveWallPlacements,
  saveWorkstations,
  type WallDir,
  type WallPlacement,
  wallImg,
  wallOffset,
  wallSkewDeg,
} from '../lib/officeLayout';
import { Workstation } from './Workstation';

/**
 * オフィス配置ツール（dev 専用、?layout）。
 * 床セルをクリックして「空 → SE → NW → 空」と切り替え、ワークステーションを並べる。
 * 配置・ドア・規模は src/lib/officeLayout 経由で localStorage に保存され、本番 OfficeView もそれを読む。
 */

// 床ひし形天面に合わせたクリック領域の clip-path（cellPx 正方内）
const DIAMOND = 'polygon(50% 34%, 100% 59%, 50% 84%, 0% 59%)';

export function OfficeLayoutTool() {
  const [scale, setScale] = useState<Scale>('mini');
  const [placements, setPlacements] = useState<Placement[]>(loadWorkstations());
  const [hover, setHover] = useState<{ i: number; j: number } | null>(null);
  // 配置モード：机 / 家具 / 壁
  const [mode, setMode] = useState<'ws' | 'decor' | 'wall'>('ws');
  const catalog = loadDecorCatalog();
  const [decorPlace, setDecorPlace] = useState<DecorPlacement[]>(loadDecorPlacements());
  const [selDecor, setSelDecor] = useState<string>(catalog[0]?.id ?? '');
  const [selDir, setSelDir] = useState<DecorDir>('SE'); // 置く向き
  const saveDecorP = (next: DecorPlacement[]) => {
    setDecorPlace(next);
    saveDecorPlacements(next);
  };
  // 家具セルクリック：選択中の種類・向きを置く / 既にあれば消す
  const toggleDecor = (i: number, j: number) => {
    const idx = decorPlace.findIndex((d) => d.i === i && d.j === j && d.catalogId === selDecor);
    if (idx >= 0) saveDecorP(decorPlace.filter((_, k) => k !== idx));
    else saveDecorP([...decorPlace, { catalogId: selDecor, i, j, dir: selDir }]);
  };

  // 壁
  const wallCat = loadWallCatalog();
  const [wallPlace, setWallPlace] = useState<WallPlacement[]>(loadWallPlacements());
  const [selWall, setSelWall] = useState<string>(wallCat[0]?.id ?? '');
  const [selWallDir, setSelWallDir] = useState<WallDir>('SE'); // 置く向き（家具と同じSW/SE）
  const [selWallStack, setSelWallStack] = useState<number>(1); // 縦積み段数
  const saveWallP = (next: WallPlacement[]) => {
    setWallPlace(next);
    saveWallPlacements(next);
  };
  // 壁セルクリック：選択中の種類を選択向きで置く / 既にあれば消す
  const toggleWall = (i: number, j: number) => {
    const idx = wallPlace.findIndex((d) => d.i === i && d.j === j && d.dir === selWallDir);
    if (idx >= 0) saveWallP(wallPlace.filter((_, k) => k !== idx));
    else saveWallP([...wallPlace, { catalogId: selWall, i, j, dir: selWallDir, stack: selWallStack }]);
  };

  const { cols, rows } = ROOM[scale];
  const geo = makeGeometry(cols, rows);

  const save = (next: Placement[]) => {
    setPlacements(next);
    saveWorkstations(next);
  };

  // クリックでセル状態を巡回：空 → SE → NW → 空
  const cycle = (i: number, j: number) => {
    const idx = placements.findIndex((p) => p.i === i && p.j === j);
    if (idx === -1) {
      save([...placements, { i, j, dir: 'SE' }]);
    } else if (placements[idx].dir === 'SE') {
      save(placements.map((p, k) => (k === idx ? { ...p, dir: 'NW' as Dir } : p)));
    } else {
      save(placements.filter((_, k) => k !== idx));
    }
  };

  const at = (i: number, j: number) => placements.find((p) => p.i === i && p.j === j);

  const [door, setDoorState] = useState<DoorCfg>(loadDoor());
  const persistDoor = (d: DoorCfg) => {
    setDoorState(d);
    saveDoor(d);
  };
  const updDoor = (patch: Partial<DoorCfg>) => persistDoor({ ...door, ...patch });

  const numField = (
    label: string,
    val: number,
    min: number,
    max: number,
    on: (v: number) => void,
  ) => (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, marginTop: 4 }}>
      <span style={{ width: 52 }}>{label}</span>
      <input type="range" min={min} max={max} value={val} onChange={(e) => on(Number(e.target.value))} style={{ flex: 1 }} />
      <input type="number" value={val} onChange={(e) => on(Number(e.target.value))} style={{ width: 52 }} />
    </label>
  );

  const cells = eachCell(cols, rows);

  const output = placements
    .slice()
    .sort((a, b) => a.i + a.j - (b.i + b.j) || a.i - b.i)
    .map((p) => `  { i: ${p.i}, j: ${p.j}, dir: '${p.dir}' },`)
    .join('\n');

  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        fontFamily: 'monospace',
        background: '#10131a',
        color: '#cdd6f4',
      }}
    >
      <div style={{ position: 'relative', flex: 1, overflow: 'auto' }}>
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            width: geo.w,
            height: geo.h,
            imageRendering: 'pixelated',
          }}
        >
          {/* 床 */}
          {cells.map(({ i, j }) => {
            const { left, top } = geo.tileTopLeft(i, j);
            return (
              <img
                key={`f-${i}-${j}`}
                src={`${SPRITE_BASE}/floor_iso.png`}
                width={cellPx}
                height={cellPx}
                alt=""
                style={{
                  position: 'absolute',
                  left,
                  top,
                  imageRendering: 'pixelated',
                  pointerEvents: 'none',
                }}
              />
            );
          })}

          {/* ワークステーション（クリックは下のセルに通すため pointer-events 無効） */}
          {placements.map((p) => {
            const { x, y } = geo.cellAnchor(p.i, p.j);
            const lit = hover?.i === p.i && hover?.j === p.j;
            return (
              <div
                key={`ws-${p.i}-${p.j}`}
                style={{
                  pointerEvents: 'none',
                  filter: lit
                    ? 'drop-shadow(0 0 2px #7cf) drop-shadow(0 0 2px #7cf) brightness(1.15)'
                    : undefined,
                }}
              >
                <Workstation x={x} y={y} baseZ={geo.baseZ(p.i, p.j)} dir={p.dir} />
              </div>
            );
          })}

          {/* ドア（セル基準＋セル内オフセット。pointer-events 無効） */}
          {(() => {
            const { x, y } = geo.cellAnchor(door.i, door.j);
            return (
              <img
                src={`${SPRITE_BASE}/${door.img}`}
                width={door.w}
                height={door.w}
                alt=""
                style={{
                  position: 'absolute',
                  left: x + door.ox - door.w / 2,
                  top: y + door.oy - door.w,
                  imageRendering: 'pixelated',
                  zIndex: geo.baseZ(door.i, door.j) + 50,
                  pointerEvents: 'none',
                }}
              />
            );
          })()}

          {/* 家具配置（pointer-events 無効） */}
          {decorPlace.map((d, idx) => {
            const item = catalog.find((c) => c.id === d.catalogId);
            if (!item) return null;
            const { x, y } = geo.cellAnchor(d.i, d.j);
            const g = decorGeom(item, d.dir);
            const off = footprintCenterOffset(g.cw, g.ch);
            const cx = x + off.dx;
            const cy = y + off.dy;
            return (
              <img
                key={`decor-${idx}`}
                src={`${SPRITE_BASE}/${decorImg(item.imgBase, d.dir)}`}
                width={item.w}
                height={item.w}
                alt=""
                style={{
                  position: 'absolute',
                  left: cx + g.ox - item.w / 2,
                  top: cy + g.oy - item.w,
                  imageRendering: 'pixelated',
                  // 壁掛け（窓）は壁面 slope 0.5 へ skew して同一平面に載せる。
                  transform: item.onWall ? `skewY(${wallSkewDeg(d.dir)}deg)` : undefined,
                  // 壁掛けは壁の奥行き（壁パネルの上・手前の家具の背後）。それ以外は footprint 最前セル基準。
                  zIndex: item.onWall
                    ? geo.baseZ(d.i, d.j) + 2
                    : geo.baseZ(d.i, d.j) + (g.cw + g.ch - 2) * 10 + 5,
                  pointerEvents: 'none',
                }}
              />
            );
          })}

          {/* 壁配置（pointer-events 無効）。向き SW/SE＋縦積み stack 段。 */}
          {wallPlace.flatMap((d, idx) => {
            const item = wallCat.find((c) => c.id === d.catalogId);
            if (!item) return [];
            const { x, y } = geo.cellAnchor(d.i, d.j);
            const edx = d.dir === 'SW' ? cellPx / 4 : -cellPx / 4;
            const edy = -cellPx / 8;
            const off = wallOffset(item, d.dir);
            const sdy = item.stackDy ?? 90;
            const base = geo.baseZ(d.i, d.j);
            return Array.from({ length: d.stack ?? 1 }, (_, k) => (
              <img
                key={`wall-${idx}-${k}`}
                src={`${SPRITE_BASE}/${wallImg(item.imgBase, d.dir)}`}
                width={item.w}
                height={item.h}
                alt=""
                style={{
                  position: 'absolute',
                  left: x + edx + off.ox - item.w / 2,
                  top: y + edy + off.oy - item.h - k * sdy,
                  imageRendering: 'pixelated',
                  transform: item.rot ? `rotate(${item.rot}deg)` : undefined,
                  zIndex: base + k,
                  pointerEvents: 'none',
                }}
              />
            ));
          })}

          {/* クリック可能なセル（ひし形）。最前面でホバー強調＋ラベル表示 */}
          {cells.map(({ i, j }) => {
            const { left, top } = geo.tileTopLeft(i, j);
            const p = at(i, j);
            return (
              <button
                type="button"
                key={`c-${i}-${j}`}
                onClick={() => (mode === 'ws' ? cycle(i, j) : mode === 'decor' ? toggleDecor(i, j) : toggleWall(i, j))}
                title={`(${i},${j})`}
                style={{
                  position: 'absolute',
                  left,
                  top,
                  width: cellPx,
                  height: cellPx,
                  clipPath: DIAMOND,
                  background: p ? 'rgba(90,140,220,0.18)' : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  zIndex: 5000,
                  padding: 0,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(120,200,140,0.30)';
                  setHover({ i, j });
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = p ? 'rgba(90,140,220,0.18)' : 'transparent';
                  setHover(null);
                }}
              >
                {!p && (
                  <span
                    style={{
                      position: 'absolute',
                      left: '50%',
                      top: '55%',
                      transform: 'translate(-50%,-50%)',
                      fontSize: 11,
                      fontWeight: 700,
                      color: 'rgba(255,255,255,0.25)',
                      textShadow: '0 1px 2px #000',
                    }}
                  >
                    ·
                  </span>
                )}
              </button>
            );
          })}

          {/* 占有セルのラベルは物体の上に重ねる（床セルだとズレて見えるため） */}
          {placements.map((p) => {
            const { x, y } = geo.cellAnchor(p.i, p.j);
            return (
              <div
                key={`lbl-${p.i}-${p.j}`}
                style={{
                  position: 'absolute',
                  left: x,
                  top: y - 52,
                  transform: 'translate(-50%,-50%)',
                  fontSize: 10,
                  fontWeight: 700,
                  color: '#fff',
                  background: p.dir === 'SE' ? 'rgba(60,120,200,0.92)' : 'rgba(150,90,55,0.92)',
                  padding: '1px 5px',
                  borderRadius: 3,
                  whiteSpace: 'nowrap',
                  zIndex: 9000,
                  pointerEvents: 'none',
                }}
              >
                {p.dir} {p.i},{p.j}
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ width: 320, padding: 12, overflowY: 'auto', borderLeft: '1px solid #333' }}>
        <h3 style={{ marginTop: 0 }}>オフィス配置ツール</h3>

        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          <button
            type="button"
            onClick={() => setMode('ws')}
            style={{ flex: 1, padding: '6px 0', background: mode === 'ws' ? '#3a5a9a' : '#222', color: '#fff', border: '1px solid #444', cursor: 'pointer' }}
          >
            机（社員）
          </button>
          <button
            type="button"
            onClick={() => setMode('decor')}
            style={{ flex: 1, padding: '6px 0', background: mode === 'decor' ? '#3a5a9a' : '#222', color: '#fff', border: '1px solid #444', cursor: 'pointer' }}
          >
            家具
          </button>
          <button
            type="button"
            onClick={() => setMode('wall')}
            style={{ flex: 1, padding: '6px 0', background: mode === 'wall' ? '#3a5a9a' : '#222', color: '#fff', border: '1px solid #444', cursor: 'pointer' }}
          >
            壁
          </button>
        </div>

        {mode === 'ws' && (
          <p style={{ fontSize: 12, opacity: 0.8, lineHeight: 1.6 }}>
            床のマスをクリックで切替：
            <br />
            空 → <strong>SE</strong>(顔こちら) → <strong>NW</strong>(背中) → 空
          </p>
        )}
        {mode === 'decor' && (
          <p style={{ fontSize: 12, opacity: 0.8, lineHeight: 1.6 }}>
            家具を選び、置くマスをクリック（同じマスを再クリックで撤去）。
            <br />
            セル内の位置・大きさは <strong>?tuner</strong>→「家具」で。
          </p>
        )}
        {mode === 'wall' && (
          <p style={{ fontSize: 12, opacity: 0.8, lineHeight: 1.6 }}>
            向き(SE/SW)と段数を選び、置くマスをクリック（同じ向きを再クリックで撤去）。
            <br />
            SW=奥右辺、SE=奥左辺。見た目は <strong>?tuner</strong>→「壁」で。
          </p>
        )}

        {mode === 'decor' && (
          <>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, marginBottom: 6 }}>
              置く向き
              <label>
                <input type="radio" checked={selDir === 'SE'} onChange={() => setSelDir('SE')} /> SE
              </label>
              <label>
                <input type="radio" checked={selDir === 'SW'} onChange={() => setSelDir('SW')} /> SW
              </label>
              <label>
                <input type="radio" checked={selDir === 'NW'} onChange={() => setSelDir('NW')} /> NW
              </label>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
              {catalog.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelDecor(c.id)}
                  style={{
                    fontSize: 11,
                    padding: '4px 6px',
                    background: selDecor === c.id ? '#3a7a4a' : '#222',
                    color: '#fff',
                    border: '1px solid #444',
                    cursor: 'pointer',
                  }}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </>
        )}

        {mode === 'wall' && (
          <>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, marginBottom: 6 }}>
              置く向き
              <label>
                <input type="radio" checked={selWallDir === 'SE'} onChange={() => setSelWallDir('SE')} /> SE
              </label>
              <label>
                <input type="radio" checked={selWallDir === 'SW'} onChange={() => setSelWallDir('SW')} /> SW
              </label>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, marginBottom: 6 }}>
              縦積み
              {[1, 2, 3].map((n) => (
                <label key={n}>
                  <input type="radio" checked={selWallStack === n} onChange={() => setSelWallStack(n)} /> {n}
                </label>
              ))}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
              {wallCat.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelWall(c.id)}
                  style={{
                    fontSize: 11,
                    padding: '4px 6px',
                    background: selWall === c.id ? '#3a7a4a' : '#222',
                    color: '#fff',
                    border: '1px solid #444',
                    cursor: 'pointer',
                  }}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </>
        )}

        <label style={{ fontSize: 12, display: 'flex', gap: 8, alignItems: 'center', margin: '8px 0' }}>
          規模
          <select value={scale} onChange={(e) => setScale(e.target.value as Scale)}>
            {(Object.keys(ROOM) as Scale[]).map((s) => (
              <option key={s} value={s}>
                {s}（{ROOM[s].cols}×{ROOM[s].rows}）
              </option>
            ))}
          </select>
        </label>

        <div style={{ fontSize: 12, margin: '8px 0' }}>配置数: {placements.length}</div>

        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          <button type="button" onClick={() => save([])}>
            全消去
          </button>
          <button type="button" onClick={() => save(DEFAULT_WORKSTATIONS)}>
            既定に戻す
          </button>
        </div>

        <div style={{ border: '1px solid #66c', borderRadius: 4, padding: 8, marginBottom: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 2 }}>出入口ドア（どのセルか）</div>
          {numField('i (列)', door.i, 0, cols - 1, (v) => updDoor({ i: v }))}
          {numField('j (行)', door.j, 0, rows - 1, (v) => updDoor({ j: v }))}
          <div style={{ fontSize: 11, opacity: 0.6, marginTop: 4 }}>
            セル内位置・大きさは <strong>?tuner</strong> →「ドア」タブで設定
          </div>
        </div>

        <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>officeLayout.ts に転記:</div>
        <pre
          style={{
            whiteSpace: 'pre-wrap',
            fontSize: 11,
            background: '#000',
            padding: 8,
            borderRadius: 4,
          }}
        >
          {`DEFAULT_WORKSTATIONS = [\n${output}\n];\n\nDEFAULT_DOOR = { img: '${door.img}', i: ${door.i}, j: ${door.j}, w: ${door.w}, ox: ${door.ox}, oy: ${door.oy} };\n\nDEFAULT_DECOR_PLACEMENTS = [\n${decorPlace
            .slice()
            .sort((a, b) => a.i + a.j - (b.i + b.j))
            .map((d) => `  { catalogId: '${d.catalogId}', i: ${d.i}, j: ${d.j}, dir: '${d.dir}' },`)
            .join('\n')}\n];\n\nDEFAULT_WALL_PLACEMENTS = [\n${wallPlace
            .slice()
            .sort((a, b) => a.i + a.j - (b.i + b.j))
            .map((d) => `  { catalogId: '${d.catalogId}', i: ${d.i}, j: ${d.j}, dir: '${d.dir}', stack: ${d.stack ?? 1} },`)
            .join('\n')}\n];`}
        </pre>
      </div>
    </div>
  );
}
