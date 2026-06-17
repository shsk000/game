import { useState } from 'react';
import { WS_CHAIR, WS_LAYERS, type WsChair, type WsLayer } from '../data/workstation';

/**
 * ワークステーション調整ツール（dev 専用、?tuner）。
 * 机/PC/人は単純レイヤー。椅子は1枚画像を clip-path で「背もたれ(奥)」「座面+前脚(手前)」に
 * 動的分割し、分割線（上端 x・下端 x）をスライダーで斜めに調整できる。
 * 人を背もたれと座面の間に挟むことで、椅子を差し替え可能に保ったまま「座っている」を表現する。
 * 値は localStorage 保存。確定値を OfficeView に転記する。
 */

const SPRITE_BASE = '/sprites/office';
const TILE = 32;
const SCALE = 3;
const cellPx = TILE * SCALE; // 96

// 既定値は一元管理ファイル（src/data/workstation.ts）から読む。調整後はあちらに転記する。
type LayerCfg = WsLayer;
type ChairCfg = WsChair;

const DEFAULT_LAYERS: LayerCfg[] = WS_LAYERS;
const DEFAULT_CHAIR: ChairCfg = WS_CHAIR;

const LS_KEY = 'ws-tuner-v2';

type Saved = { layers: LayerCfg[]; chair: ChairCfg };
function load(): Saved {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw) as Saved;
  } catch {
    // ignore
  }
  return { layers: DEFAULT_LAYERS, chair: DEFAULT_CHAIR };
}

export function WorkstationTuner() {
  const init = load();
  const [layers, setLayers] = useState<LayerCfg[]>(init.layers);
  const [chair, setChair] = useState<ChairCfg>(init.chair);

  const save = (l: LayerCfg[], c: ChairCfg) => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ layers: l, chair: c }));
    } catch {
      // ignore
    }
  };
  const updLayer = (i: number, patch: Partial<LayerCfg>) =>
    setLayers((prev) => {
      const n = prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l));
      save(n, chair);
      return n;
    });
  const updChair = (patch: Partial<ChairCfg>) =>
    setChair((prev) => {
      const n = { ...prev, ...patch };
      save(layers, n);
      return n;
    });
  const reset = () => {
    setLayers(DEFAULT_LAYERS);
    setChair(DEFAULT_CHAIR);
    try {
      localStorage.removeItem(LS_KEY);
    } catch {
      // ignore
    }
  };

  // アイソメ床グリッド
  const cols = 7;
  const rows = 6;
  const w = cols * cellPx;
  const h = rows * cellPx;
  const dW = cellPx;
  const dH = cellPx / 2;
  const spanX = (cols + rows - 2) * (dW / 2) + dW;
  const spanY = (cols + rows - 2) * (dH / 2) + dH;
  const originX = (w - spanX) / 2 + (rows - 1) * (dW / 2);
  const originY = (h - spanY) / 2;
  const ax = originX + (3 - 3) * (dW / 2) + cellPx / 2;
  const ay = originY + (3 + 3) * (dH / 2) + cellPx * 0.6;

  const tiles = [];
  for (let s = 0; s <= cols + rows - 2; s++) {
    for (let i = 0; i < cols; i++) {
      const j = s - i;
      if (j < 0 || j >= rows) continue;
      const left = originX + (i - j) * (dW / 2);
      const top = originY + (i + j) * (dH / 2);
      tiles.push(
        <img
          key={`f-${i}-${j}`}
          src={`${SPRITE_BASE}/floor_iso.png`}
          width={cellPx}
          height={cellPx}
          alt=""
          style={{ position: 'absolute', left, top, imageRendering: 'pixelated' }}
        />,
      );
    }
  }

  // 椅子の分割（clip-path）
  const backClip = `polygon(${chair.top}% 0, 100% 0, 100% 100%, ${chair.bot}% 100%)`;
  const frontClip = `polygon(0 0, ${chair.top}% 0, ${chair.bot}% 100%, 0 100%)`;
  const chairLeft = ax + chair.ox - chair.w / 2;
  const chairTop = ay + chair.oy - chair.w;
  const chairImg = (clip: string, z: number, key: string) => (
    <img
      key={key}
      src={`${SPRITE_BASE}/${chair.img}`}
      width={chair.w}
      height={chair.w}
      alt=""
      style={{
        position: 'absolute',
        left: chairLeft,
        top: chairTop,
        clipPath: clip,
        zIndex: z,
        imageRendering: 'pixelated',
      }}
    />
  );

  const numField = (
    label: string,
    val: number,
    min: number,
    max: number,
    on: (v: number) => void,
  ) => (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, marginTop: 4 }}>
      <span style={{ width: 40 }}>{label}</span>
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

  const output =
    `${layers
      .map(
        (l) =>
          `{ img: '${l.img}', w: ${l.w}, ox: ${l.ox}, oy: ${l.oy}, z: ${l.z}${l.clipTop !== undefined ? `, clipTop: ${l.clipTop}, clipBot: ${l.clipBot ?? 100}` : ''} },`,
      )
      .join('\n')}\n` +
    `chair: { img: '${chair.img}', w: ${chair.w}, ox: ${chair.ox}, oy: ${chair.oy}, zBack: ${chair.zBack}, zFront: ${chair.zFront}, top: ${chair.top}, bot: ${chair.bot} }`;

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
          {layers.map((l) => {
            const clip =
              l.clipTop != null && l.clipBot != null
                ? `polygon(0 0, ${l.clipTop}% 0, ${l.clipBot}% 100%, 0 100%)`
                : undefined;
            return (
              <img
                key={l.img}
                src={`${SPRITE_BASE}/${l.img}`}
                width={l.w}
                height={l.w}
                alt=""
                style={{
                  position: 'absolute',
                  left: ax + l.ox - l.w / 2,
                  top: ay + l.oy - l.w,
                  zIndex: l.z,
                  clipPath: clip,
                  imageRendering: 'pixelated',
                }}
              />
            );
          })}
          {chairImg(backClip, chair.zBack, 'chairBack')}
          {chairImg(frontClip, chair.zFront, 'chairFront')}
          {/* 分割線ガイド（赤破線） */}
          <svg
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: chairLeft,
              top: chairTop,
              width: chair.w,
              height: chair.w,
              zIndex: 999,
              pointerEvents: 'none',
              overflow: 'visible',
            }}
          >
            <line
              x1={(chair.top / 100) * chair.w}
              y1={0}
              x2={(chair.bot / 100) * chair.w}
              y2={chair.w}
              stroke="red"
              strokeWidth={1}
              strokeDasharray="4 3"
            />
          </svg>
          {/* 床アンカー */}
          <div
            style={{ position: 'absolute', left: ax - 1, top: ay - 10, width: 2, height: 20, background: 'lime', zIndex: 1000 }}
          />
          <div
            style={{ position: 'absolute', left: ax - 10, top: ay - 1, width: 20, height: 2, background: 'lime', zIndex: 1000 }}
          />
        </div>
      </div>

      <div style={{ width: 340, padding: 12, overflowY: 'auto', borderLeft: '1px solid #333' }}>
        <h3 style={{ marginTop: 0 }}>ワークステーション調整</h3>
        <p style={{ fontSize: 11, opacity: 0.7 }}>
          椅子は赤破線で「背もたれ(奥)/座面+前脚(手前)」に分割。top/bot で分割線を斜めに動かせる。
        </p>
        {layers.map((l, i) => (
          <div
            key={l.img}
            style={{ marginBottom: 10, border: '1px solid #333', padding: 8, borderRadius: 4 }}
          >
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <strong style={{ width: 52 }}>{l.img.replace('.png', '')}</strong>
              <input
                type="text"
                value={l.img}
                onChange={(e) => updLayer(i, { img: e.target.value })}
                style={{ flex: 1, width: 0 }}
              />
            </div>
            {numField('w', l.w, 16, 320, (v) => updLayer(i, { w: v }))}
            {numField('x', l.ox, -160, 160, (v) => updLayer(i, { ox: v }))}
            {numField('y', l.oy, -160, 160, (v) => updLayer(i, { oy: v }))}
            {numField('z', l.z, 0, 10, (v) => updLayer(i, { z: v }))}
            {l.clipTop !== undefined && (
              <>
                <div style={{ fontSize: 11, opacity: 0.6, marginTop: 4 }}>
                  クリップ（左を残し右を隠す。100=隠さない）
                </div>
                {numField('隠上', l.clipTop, 0, 100, (v) => updLayer(i, { clipTop: v }))}
                {numField('隠下', l.clipBot ?? 100, 0, 100, (v) => updLayer(i, { clipBot: v }))}
              </>
            )}
          </div>
        ))}

        <div style={{ marginBottom: 10, border: '1px solid #5a4', padding: 8, borderRadius: 4 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <strong style={{ width: 52 }}>椅子</strong>
            <input
              type="text"
              value={chair.img}
              onChange={(e) => updChair({ img: e.target.value })}
              style={{ flex: 1, width: 0 }}
            />
          </div>
          {numField('w', chair.w, 16, 320, (v) => updChair({ w: v }))}
          {numField('x', chair.ox, -160, 160, (v) => updChair({ ox: v }))}
          {numField('y', chair.oy, -160, 160, (v) => updChair({ oy: v }))}
          {numField('z背', chair.zBack, 0, 10, (v) => updChair({ zBack: v }))}
          {numField('z座', chair.zFront, 0, 10, (v) => updChair({ zFront: v }))}
          {numField('分割上', chair.top, 0, 100, (v) => updChair({ top: v }))}
          {numField('分割下', chair.bot, 0, 100, (v) => updChair({ bot: v }))}
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
      </div>
    </div>
  );
}
