import { useState } from 'react';
import type { Scale } from '../data/scales';
import {
  cellPx,
  type Dir,
  eachCell,
  makeGeometry,
  type Placement,
  ROOM,
  SPRITE_BASE,
} from '../lib/officeGeometry';
import {
  DEFAULT_WORKSTATIONS,
  type DoorCfg,
  loadDoor,
  loadWorkstations,
  saveDoor,
  saveWorkstations,
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

          {/* クリック可能なセル（ひし形）。最前面でホバー強調＋ラベル表示 */}
          {cells.map(({ i, j }) => {
            const { left, top } = geo.tileTopLeft(i, j);
            const p = at(i, j);
            return (
              <button
                type="button"
                key={`c-${i}-${j}`}
                onClick={() => cycle(i, j)}
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
        <p style={{ fontSize: 12, opacity: 0.8, lineHeight: 1.6 }}>
          床のマスをクリックで切替：
          <br />
          空 → <strong>SE</strong>(顔こちら) → <strong>NW</strong>(背中) → 空
        </p>

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

        <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>
          OfficeView の WORKSTATION_CELLS / DOOR に転記:
        </div>
        <pre
          style={{
            whiteSpace: 'pre-wrap',
            fontSize: 11,
            background: '#000',
            padding: 8,
            borderRadius: 4,
          }}
        >
          {`const WORKSTATION_CELLS: Placement[] = [\n${output}\n];\n\nconst DOOR = { img: '${door.img}', i: ${door.i}, j: ${door.j}, w: ${door.w}, ox: ${door.ox}, oy: ${door.oy} };`}
        </pre>
      </div>
    </div>
  );
}
