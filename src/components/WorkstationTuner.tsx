import { useState } from 'react';

/**
 * ワークステーション調整ツール（dev 専用）。
 * `?tuner` でアクセス。机/PC/椅子/人の「画像・サイズ・XYオフセット・z」をスライダーで動かし、
 * アイソメ床の上で即プレビュー。確定値を画面右下に出力するので OfficeView に転記する。
 * 値は localStorage に保存（リロードしても保持）。
 */

const SPRITE_BASE = '/sprites/office';
const TILE = 32;
const SCALE = 3;
const cellPx = TILE * SCALE; // 96

type LayerCfg = { key: string; img: string; w: number; ox: number; oy: number; z: number };

// §5 比率（人物高/モニター高≈2.2、椅子高/人物高≈0.8、机幅/人物幅≈2.2、モニター幅/机幅≈0.4）から
// 各スプライトの中身トリム寸法を逆算した w（キャンバス基準）。位置(ox/oy/z)はツールで微調整。
const DEFAULTS: LayerCfg[] = [
  // 人は NW（背中こちら）を向くので、机＋PC を人の正面＝奥（NW/上）に置き、人を手前にする
  { key: 'desk', img: 'desk.png', w: 140, ox: -6, oy: -22, z: 1 },
  { key: 'laptop', img: 'laptop.png', w: 62, ox: -6, oy: -52, z: 2 },
  // 人は NW（背中こちら）。座面に乗るよう少し上げ、椅子背を手前(z最大)にして頭だけ覗かせる
  { key: 'person', img: 'person_sit_nw.png', w: 219, ox: 0, oy: 8, z: 3 },
  { key: 'chair', img: 'chair.png', w: 96, ox: 0, oy: 2, z: 4 },
];

const LS_KEY = 'ws-tuner-v1';

function loadCfg(): LayerCfg[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw) as LayerCfg[];
  } catch {
    // ignore
  }
  return DEFAULTS;
}

export function WorkstationTuner() {
  const [cfg, setCfg] = useState<LayerCfg[]>(loadCfg);

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
  const ci = 3;
  const cj = 3;
  const ax = originX + (ci - cj) * (dW / 2) + cellPx / 2;
  const ay = originY + (ci + cj) * (dH / 2) + cellPx * 0.6;

  const update = (i: number, patch: Partial<LayerCfg>) => {
    setCfg((prev) => {
      const next = prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l));
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };
  const reset = () => {
    setCfg(DEFAULTS);
    try {
      localStorage.removeItem(LS_KEY);
    } catch {
      // ignore
    }
  };

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

  const numField = (
    label: string,
    val: number,
    min: number,
    max: number,
    on: (v: number) => void,
  ) => (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, marginTop: 4 }}>
      <span style={{ width: 16 }}>{label}</span>
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
        style={{ width: 56 }}
      />
    </label>
  );

  const output = cfg
    .map((l) => `{ key: '${l.key}', img: '${l.img}', w: ${l.w}, ox: ${l.ox}, oy: ${l.oy}, z: ${l.z} },`)
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
          {cfg.map((l) => (
            <img
              key={l.key}
              src={`${SPRITE_BASE}/${l.img}`}
              width={l.w}
              height={l.w}
              alt=""
              style={{
                position: 'absolute',
                left: ax + l.ox - l.w / 2,
                top: ay + l.oy - l.w,
                zIndex: l.z,
                imageRendering: 'pixelated',
              }}
            />
          ))}
          {/* 床アンカー（赤十字） */}
          <div
            style={{ position: 'absolute', left: ax - 1, top: ay - 10, width: 2, height: 20, background: 'red', zIndex: 99 }}
          />
          <div
            style={{ position: 'absolute', left: ax - 10, top: ay - 1, width: 20, height: 2, background: 'red', zIndex: 99 }}
          />
        </div>
      </div>

      <div style={{ width: 340, padding: 12, overflowY: 'auto', borderLeft: '1px solid #333' }}>
        <h3 style={{ marginTop: 0 }}>ワークステーション調整</h3>
        <p style={{ fontSize: 11, opacity: 0.7 }}>
          スライダーで w(サイズ)/x/y/z を調整。赤十字＝床アンカー。下の値を OfficeView に転記。
        </p>
        {cfg.map((l, i) => (
          <div
            key={l.key}
            style={{ marginBottom: 12, border: '1px solid #333', padding: 8, borderRadius: 4 }}
          >
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <strong style={{ width: 56 }}>{l.key}</strong>
              <input
                type="text"
                value={l.img}
                onChange={(e) => update(i, { img: e.target.value })}
                style={{ flex: 1, width: 0 }}
              />
            </div>
            {numField('w', l.w, 16, 320, (v) => update(i, { w: v }))}
            {numField('x', l.ox, -160, 160, (v) => update(i, { ox: v }))}
            {numField('y', l.oy, -160, 160, (v) => update(i, { oy: v }))}
            {numField('z', l.z, 0, 10, (v) => update(i, { z: v }))}
          </div>
        ))}
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
