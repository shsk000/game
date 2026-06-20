import { useState } from 'react';
import {
  clipKeepLeft,
  clipKeepRight,
  WS_NW,
  WS_SE,
  type WsChair,
  type WsConfig,
  type WsLayer,
} from '../data/workstation';
import { type DoorCfg, loadDoor, saveDoor } from '../lib/officeLayout';

/**
 * 物体エディタ（dev 専用、?tuner）。1つの URL で全物体の「セル内の置き方」を定義する。
 * - セット物体（ワークステーション＝机/PC/人/椅子）：NW/SE 別に各レイヤー＋椅子＋セル内位置。
 * - 単体物体（ドア）：画像＋セル内位置(ox/oy)＋大きさ。
 * どのセルに置くかは ?layout 側。確定値は workstation.ts / officeLayout.ts に転記する。
 * 将来オブジェクトが増えても、この target セレクタに足すだけで1 URL に集約できる。
 */

const SPRITE_BASE = '/sprites/office';
const TILE = 32;
const SCALE = 3;
const cellPx = TILE * SCALE; // 96

const LS_KEY = 'ws-tuner-v4';
type Saved = { nw: WsConfig; se: WsConfig };
function load(): Saved {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw) as Saved;
  } catch {
    // ignore
  }
  return { nw: WS_NW, se: WS_SE };
}

export function WorkstationTuner() {
  const init = load();
  const [nw, setNw] = useState<WsConfig>(init.nw);
  const [se, setSe] = useState<WsConfig>(init.se);
  const [editing, setEditing] = useState<'NW' | 'SE'>('NW');
  const [pair, setPair] = useState(false); // 向かい側を隣に表示して整合を取る
  const [target, setTarget] = useState<'ws' | 'door'>('ws'); // 編集対象の物体
  const [door, setDoorState] = useState<DoorCfg>(loadDoor());
  const updDoor = (patch: Partial<DoorCfg>) => {
    const next = { ...door, ...patch };
    setDoorState(next);
    saveDoor(next);
  };

  const cfg = editing === 'NW' ? nw : se;
  const gg = cfg.cellOffset; // セット全体のセル内位置（全体移動）
  const save = (n: WsConfig, s: WsConfig) => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ nw: n, se: s }));
    } catch {
      // ignore
    }
  };
  const setCfg = (next: WsConfig) => {
    if (editing === 'NW') {
      setNw(next);
      save(next, se);
    } else {
      setSe(next);
      save(nw, next);
    }
  };
  const updLayer = (i: number, patch: Partial<WsLayer>) =>
    setCfg({ ...cfg, layers: cfg.layers.map((l, idx) => (idx === i ? { ...l, ...patch } : l)) });
  const updChair = (patch: Partial<WsChair>) => setCfg({ ...cfg, chair: { ...cfg.chair, ...patch } });
  const reset = () => {
    setNw(WS_NW);
    setSe(WS_SE);
    try {
      localStorage.removeItem(LS_KEY);
    } catch {
      // ignore
    }
  };

  // 1マスだけ表示（セルの範囲＝菱形を明示）。物体はこの1セル基準で置く。
  const dW = cellPx; // 96
  const dH = cellPx / 2; // 48
  const w = 480;
  const h = 480;
  const tileLeft = (w - cellPx) / 2;
  const tileTop = (h - cellPx) / 2;
  const ax = tileLeft + cellPx / 2; // セル基準点 x（菱形中心）
  const ay = tileTop + cellPx * 0.6; // セル基準点 y（officeGeometry と同じ）

  // セル天面の菱形（幅 dW × 高 dH、中心 = 基準点）の4頂点
  const diamond = `${ax},${ay - dH / 2} ${ax + dW / 2},${ay} ${ax},${ay + dH / 2} ${ax - dW / 2},${ay}`;

  const tiles = [
    <img
      key="floor"
      src={`${SPRITE_BASE}/floor_iso.png`}
      width={cellPx}
      height={cellPx}
      alt=""
      style={{ position: 'absolute', left: tileLeft, top: tileTop, imageRendering: 'pixelated' }}
    />,
    <svg
      key="cell-outline"
      width={w}
      height={h}
      style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none', zIndex: 200 }}
    >
      <polygon points={diamond} fill="rgba(120,200,255,0.10)" stroke="#5ad" strokeWidth={2} />
    </svg>,
  ];

  const numField = (
    label: string,
    val: number,
    min: number,
    max: number,
    on: (v: number) => void,
  ) => (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, marginTop: 4 }}>
      <span style={{ width: 44 }}>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        value={val}
        onChange={(e) => on(Number(e.target.value))}
        style={{ flex: 1 }}
      />
      <input
        type="number"
        value={val}
        onChange={(e) => on(Number(e.target.value))}
        style={{ width: 54 }}
      />
    </label>
  );

  const fmtLayer = (l: WsLayer) =>
    `{ img: '${l.img}', w: ${l.w}, ox: ${l.ox}, oy: ${l.oy}, z: ${l.z}${l.clipTop !== undefined ? `, clipTop: ${l.clipTop}, clipBot: ${l.clipBot ?? 100}, clipSide: '${l.clipSide ?? 'left'}'` : ''}${l.flip ? ', flip: true' : ''} },`;
  const fmtChair = (c: WsChair) =>
    `chair: { img: '${c.img}', w: ${c.w}, ox: ${c.ox}, oy: ${c.oy}, zBack: ${c.zBack}, zFront: ${c.zFront}, top: ${c.top}, bot: ${c.bot}${c.backSide ? `, backSide: '${c.backSide}'` : ''} }`;
  const output = `// ${editing}\nlayers: [\n${cfg.layers.map((l) => `  ${fmtLayer(l)}`).join('\n')}\n],\n${fmtChair(cfg.chair)},\ncellOffset: { x: ${gg.x}, y: ${gg.y} },`;

  // 1セットを (cx,cy) に描画（編集中=ライブ、向かい側=相手 config）
  const renderWs = (c: WsConfig, cx: number, cy: number, base: number, kp: string) => (
    <>
      {c.layers.map((l) => {
        const clip =
          l.clipTop != null && l.clipBot != null
            ? l.clipSide === 'right'
              ? clipKeepRight(l.clipTop, l.clipBot)
              : clipKeepLeft(l.clipTop, l.clipBot)
            : undefined;
        return (
          <img
            key={`${kp}-l-${l.img}`}
            src={`${SPRITE_BASE}/${l.img}`}
            width={l.w}
            height={l.w}
            alt=""
            style={{
              position: 'absolute',
              left: cx + l.ox - l.w / 2,
              top: cy + l.oy - l.w,
              clipPath: clip,
              transform: l.flip ? 'scaleX(-1)' : undefined,
              zIndex: base + l.z,
              imageRendering: 'pixelated',
            }}
          />
        );
      })}
      {(['back', 'front'] as const).map((part) => {
        const ch = c.chair;
        const backLeft = ch.backSide === 'left';
        const clip =
          part === 'back'
            ? backLeft
              ? clipKeepLeft(ch.top, ch.bot)
              : clipKeepRight(ch.top, ch.bot)
            : backLeft
              ? clipKeepRight(ch.top, ch.bot)
              : clipKeepLeft(ch.top, ch.bot);
        return (
          <img
            key={`${kp}-chair-${part}`}
            src={`${SPRITE_BASE}/${ch.img}`}
            width={ch.w}
            height={ch.w}
            alt=""
            style={{
              position: 'absolute',
              left: cx + ch.ox - ch.w / 2,
              top: cy + ch.oy - ch.w,
              clipPath: clip,
              transform: ch.flip ? 'scaleX(-1)' : undefined,
              zIndex: base + (part === 'back' ? ch.zBack : ch.zFront),
              imageRendering: 'pixelated',
            }}
          />
        );
      })}
    </>
  );

  // 向かい側パートナー：編集SE→相手NWを +1セル(右下)、編集NW→相手SEを -1セル(左上)
  const updG = (patch: Partial<{ x: number; y: number }>) =>
    setCfg({ ...cfg, cellOffset: { ...cfg.cellOffset, ...patch } });
  const partnerCfg = editing === 'SE' ? nw : se;
  const partnerG = partnerCfg.cellOffset;
  const partnerDx = editing === 'SE' ? cellPx / 2 : -cellPx / 2; // ±48
  const partnerDy = editing === 'SE' ? cellPx / 4 : -cellPx / 4; // ±24
  const partnerBase = editing === 'SE' ? 60 : 40;

  const btn = (label: string, active: boolean, on: () => void) => (
    <button
      type="button"
      onClick={on}
      style={{
        flex: 1,
        padding: '6px 0',
        background: active ? '#3a5a9a' : '#222',
        color: '#fff',
        border: '1px solid #444',
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );

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
      <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            width: w,
            height: h,
            imageRendering: 'pixelated',
          }}
        >
          {tiles}
          {target === 'ws' && pair &&
            renderWs(partnerCfg, ax + partnerDx + partnerG.x, ay + partnerDy + partnerG.y, partnerBase, 'partner')}
          {target === 'ws' && renderWs(cfg, ax + gg.x, ay + gg.y, 50, 'edit')}
          {target === 'door' && (
            <img
              src={`${SPRITE_BASE}/${door.img}`}
              width={door.w}
              height={door.w}
              alt=""
              style={{
                position: 'absolute',
                left: ax + door.ox - door.w / 2,
                top: ay + door.oy - door.w,
                imageRendering: 'pixelated',
                zIndex: 50,
              }}
            />
          )}
          <div
            style={{ position: 'absolute', left: ax - 1, top: ay - 10, width: 2, height: 20, background: 'lime', zIndex: 99 }}
          />
          <div
            style={{ position: 'absolute', left: ax - 10, top: ay - 1, width: 20, height: 2, background: 'lime', zIndex: 99 }}
          />
        </div>
      </div>

      <div style={{ width: 340, padding: 12, overflowY: 'auto', borderLeft: '1px solid #333' }}>
        <h3 style={{ marginTop: 0 }}>物体エディタ（セル内の置き方）</h3>
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          {btn('ワークステーション', target === 'ws', () => setTarget('ws'))}
          {btn('ドア', target === 'door', () => setTarget('door'))}
        </div>

        {target === 'door' && (
          <>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 12, width: 40 }}>画像</span>
              <input
                type="text"
                value={door.img}
                onChange={(e) => updDoor({ img: e.target.value })}
                style={{ flex: 1, width: 0 }}
              />
            </div>
            {numField('セル内X', door.ox, -200, 200, (v) => updDoor({ ox: v }))}
            {numField('セル内Y', door.oy, -200, 200, (v) => updDoor({ oy: v }))}
            {numField('大きさ', door.w, 48, 260, (v) => updDoor({ w: v }))}
            <pre
              style={{
                whiteSpace: 'pre-wrap',
                fontSize: 11,
                marginTop: 10,
                background: '#000',
                padding: 8,
                borderRadius: 4,
              }}
            >
              {`// officeLayout.ts DEFAULT_DOOR（i,j は ?layout 側）\n{ img: '${door.img}', i: ${door.i}, j: ${door.j}, w: ${door.w}, ox: ${door.ox}, oy: ${door.oy} }`}
            </pre>
          </>
        )}

        {target === 'ws' && (
        <>
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          {btn('NW（背中）', editing === 'NW', () => setEditing('NW'))}
          {btn('SE（向かい/顔）', editing === 'SE', () => setEditing('SE'))}
        </div>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, marginBottom: 6 }}>
          <input type="checkbox" checked={pair} onChange={(e) => setPair(e.target.checked)} />
          ペア表示（向かい側を隣に出して机の隙間・端を合わせる）
        </label>
        <div style={{ border: '1px solid #66c', borderRadius: 4, padding: 8, marginBottom: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 700, display: 'flex', justifyContent: 'space-between' }}>
            <span>セル内位置（全体移動：机・椅子・人・PC 一括）</span>
            <button type="button" style={{ fontSize: 11 }} onClick={() => updG({ x: 0, y: 0 })}>
              0に戻す
            </button>
          </div>
          {numField('全体X', gg.x, -120, 120, (v) => updG({ x: v }))}
          {numField('全体Y', gg.y, -120, 120, (v) => updG({ y: v }))}
        </div>

        {cfg.layers.map((l, i) => (
          <div
            key={l.img}
            style={{ marginBottom: 10, border: '1px solid #333', padding: 8, borderRadius: 4 }}
          >
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input
                type="text"
                value={l.img}
                onChange={(e) => updLayer(i, { img: e.target.value })}
                style={{ flex: 1, width: 0 }}
              />
              <label style={{ fontSize: 11, display: 'flex', gap: 2, alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={!!l.flip}
                  onChange={(e) => updLayer(i, { flip: e.target.checked })}
                />
                反転
              </label>
            </div>
            {numField('w', l.w, 16, 320, (v) => updLayer(i, { w: v }))}
            {numField('x', l.ox, -160, 160, (v) => updLayer(i, { ox: v }))}
            {numField('y', l.oy, -160, 160, (v) => updLayer(i, { oy: v }))}
            {numField('z', l.z, 0, 10, (v) => updLayer(i, { z: v }))}
            {l.clipTop !== undefined && (
              <>
                <div style={{ fontSize: 11, opacity: 0.6, marginTop: 4, display: 'flex', gap: 8 }}>
                  クリップ（隠す）
                  <label>
                    <input
                      type="radio"
                      checked={(l.clipSide ?? 'left') === 'left'}
                      onChange={() => updLayer(i, { clipSide: 'left' })}
                    />
                    左残
                  </label>
                  <label>
                    <input
                      type="radio"
                      checked={l.clipSide === 'right'}
                      onChange={() => updLayer(i, { clipSide: 'right' })}
                    />
                    右残
                  </label>
                </div>
                {numField('隠上', l.clipTop, 0, 100, (v) => updLayer(i, { clipTop: v }))}
                {numField('隠下', l.clipBot ?? 100, 0, 100, (v) => updLayer(i, { clipBot: v }))}
              </>
            )}
          </div>
        ))}

        <div style={{ marginBottom: 10, border: '1px solid #5a4', padding: 8, borderRadius: 4 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <strong style={{ width: 40 }}>椅子</strong>
            <input
              type="text"
              value={cfg.chair.img}
              onChange={(e) => updChair({ img: e.target.value })}
              style={{ flex: 1, width: 0 }}
            />
            <span style={{ fontSize: 11, display: 'flex', gap: 6, alignItems: 'center' }}>
              背もたれ
              <label>
                <input
                  type="radio"
                  checked={(cfg.chair.backSide ?? 'right') === 'right'}
                  onChange={() => updChair({ backSide: 'right' })}
                />
                右
              </label>
              <label>
                <input
                  type="radio"
                  checked={cfg.chair.backSide === 'left'}
                  onChange={() => updChair({ backSide: 'left' })}
                />
                左
              </label>
            </span>
          </div>
          {numField('w', cfg.chair.w, 16, 320, (v) => updChair({ w: v }))}
          {numField('x', cfg.chair.ox, -160, 160, (v) => updChair({ ox: v }))}
          {numField('y', cfg.chair.oy, -160, 160, (v) => updChair({ oy: v }))}
          {numField('z背', cfg.chair.zBack, 0, 10, (v) => updChair({ zBack: v }))}
          {numField('z座', cfg.chair.zFront, 0, 10, (v) => updChair({ zFront: v }))}
          {numField('分割上', cfg.chair.top, 0, 100, (v) => updChair({ top: v }))}
          {numField('分割下', cfg.chair.bot, 0, 100, (v) => updChair({ bot: v }))}
        </div>

        <button type="button" onClick={reset}>
          リセット
        </button>
        <pre
          style={{
            whiteSpace: 'pre-wrap',
            fontSize: 11,
            marginTop: 10,
            background: '#000',
            padding: 8,
            borderRadius: 4,
          }}
        >
          {output}
        </pre>
        </>
        )}
      </div>
    </div>
  );
}
