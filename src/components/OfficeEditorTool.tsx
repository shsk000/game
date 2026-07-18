import {
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  chairSprite,
  type Dir8,
  laptopSprite,
  NATIVE_H,
  NATIVE_W,
  OFFICE_LAYOUT,
  officeBgSrc,
  sitFootOffset,
  standingSprite,
  vectorToDir8,
  WALK_FRAMES,
  walkSheet,
} from '../data/officeLayout';
import {
  buildOccluderLookup,
  OCCL_CELL,
  type OccluderLookup,
  OccluderMask,
  renderBandedSprite,
} from './bandedSprite';

/**
 * オフィス配置ツール（統合版、dev専用、`?layout` で起動）。
 * office-layout-tool.html（スタンドアロン、port 8931）と OfficeWalkTool（?walk）を
 * 1コンポーネント・1URLに統合（2026-07-12）。
 *
 * ① サイズ ② 移動領域 ③ 座席 ④ 遮蔽物 ⑤ 検証 の5モード。
 * ①〜④で編集したデータは state 上でそのまま保持され、⑤検証は
 * エクスポート/インポートを介さずに**その場でテストできる**（旧2ツール分割からの改善）。
 *
 * ⚠️ 実装上の注意（実機デバッグで判明した制約）：
 * - ネストした transform:scale() の中で overflow:hidden を <img> の親に使うと
 *   Chromium が再ペイントに失敗し何も表示されないことがある。clip-path で代用する。
 * - キャラ・歩行アニメは <img src> を React state 駆動で描画する（ref経由の直接 style
 *   書き換えは同様の理由で避ける）。
 * - ②④の塗り作業は数百〜千セル規模になるため、canvas に直接描画する
 *   （DOM ノードを大量生成する方式は重くなる）。
 */

type SeatDir = 'south' | 'north';
type Seat = {
  x: number;
  y: number;
  dir: SeatDir;
  overlay: [number, number, number, number] | null;
};
type WorkingOccluder = { cells: Record<string, true> };
type EditorMode = 'size' | 'walk' | 'seat' | 'occl' | 'verify';
type WalkTool = 'brush' | 'rect';
type OcclTool = 'select' | 'paint' | 'rect' | 'erase';
type Brush = 'walk' | 'erase';
type Rect = { x: number; y: number; w: number; h: number };
type PropOffsets = {
  laptopX: number;
  laptopY: number;
  laptopScale: number;
  chairX: number;
  chairY: number;
  chairScale: number;
};

// スプライト実測の bbox マージン（canvas px）。charScale を掛けて native の footOffsets にする。
const FOOT_MARGIN = { stand: 30, sitSouth: 28, sitNorth: 35 };
const STORAGE_KEY = 'office-editor-tool-v1';

// OfficeView.tsx の SeatedEmployee と同じオフセット（座りプレビューで椅子・PCも一緒に確認するため）。
const LAPTOP_Y_OFFSET = -230;
const CHAIR_Y_OFFSET = 10;

/**
 * 遮蔽物データは元々（cell=20 のグリッドで）保存されている場合があるため、OCCL_CELL 単位へ
 * 展開し直す（同じ範囲を 4×4 の細かいセルに置き換えるだけで見た目は変わらない）。
 */
function migrateOccluderCells(cells: string[], legacyCell: number): Record<string, true> {
  if (legacyCell === OCCL_CELL) return Object.fromEntries(cells.map((k) => [k, true]));
  const scale = Math.max(1, Math.round(legacyCell / OCCL_CELL));
  const result: Record<string, true> = {};
  for (const key of cells) {
    const [oi, oj] = key.split(',').map(Number);
    for (let di = 0; di < scale; di++) {
      for (let dj = 0; dj < scale; dj++) {
        result[`${oi * scale + di},${oj * scale + dj}`] = true;
      }
    }
  }
  return result;
}

const SAMPLES = [
  { src: 'engineer/rotations/south.png', x: 360, y: 952, off: 'stand' as const },
  { src: 'engineer/rotations/south-west.png', x: 1130, y: 800, off: 'stand' as const },
  { src: 'engineer/sitting/south.png', x: 760, y: 488, off: 'sitSouth' as const },
  { src: 'engineer/sitting/north.png', x: 752, y: 850, off: 'sitNorth' as const },
];

const HINTS: Record<EditorMode, string> = {
  size: '① キャラ倍率をスライダーで調整。サンプル（立ち=ドア前/通路、着席=机）が追従します。',
  walk: '② 🖌ブラシ=なぞって塗る / ▭矩形選択=範囲一括。🟩で歩ける場所を塗り、⬜で削る（塗ってないマス＝歩けない）。',
  seat: '③ クリックで座席を置く（向きボタンで ⬇south/⬆north 切替）。south席は「🟦隠し矩形」で机の隠しエリアをドラッグ描画。',
  occl: '④ 家具を🖌/▭で塗る（1物体=1色、濃い色=編集中、②より細かい5px単位）。「🎯選択」で対象をクリック→修正。「➕新しい遮蔽物」で次の家具へ。オレンジ線=接地ライン。',
  verify:
    '⑤ 矢印キー/WASDでキャラを移動。遮蔽物の裏に回ると隠れます。🪑で各座席に順番に座る。①〜④の編集内容がそのままテストできます。',
};

const HUES = [185, 300, 55, 140, 20, 260, 90, 330];

const ROSTER = [
  { folder: 'engineer', label: 'プログラマー(男)' },
  { folder: 'programmer_f', label: 'プログラマー(女)' },
  { folder: 'designer_m', label: 'デザイナー(男)' },
  { folder: 'designer_f', label: 'デザイナー(女)' },
  { folder: 'pr_m', label: '広報(男)' },
  { folder: 'pr_f', label: '広報(女)' },
] as const;

function occluderBaseline(o: WorkingOccluder): number {
  let maxJ = -1;
  for (const key in o.cells) maxJ = Math.max(maxJ, Number(key.split(',')[1]));
  return (maxJ + 1) * OCCL_CELL;
}

/** 作業中の遮蔽物（cells が Record）→ 共有 lookup ビルダーが受け取れる形に正規化する。 */
function buildLookup(occluders: WorkingOccluder[]): OccluderLookup {
  return buildOccluderLookup(
    occluders.map((o) => ({ cells: Object.keys(o.cells), baseline: occluderBaseline(o) })),
  );
}

export function OfficeEditorTool() {
  const [mode, setMode] = useState<EditorMode>('size');
  const [charScale, setCharScale] = useState(OFFICE_LAYOUT.charScale);
  const [zoom, setZoom] = useState(0.66);
  const [cell, setCell] = useState(OFFICE_LAYOUT.grid.cell);

  // 大量セルを扱う ②④ は ref を単一ソースにして canvas へ直接描画（React 再レンダーの負荷を避ける）。
  // paintVersion をインクリメントすることで「再描画・⑤検証の再評価が必要」を通知する。
  const walkableRef = useRef<Record<string, true>>(
    Object.fromEntries(OFFICE_LAYOUT.grid.walkable.map((k) => [k, true])),
  );
  const occludersRef = useRef<WorkingOccluder[]>(
    OFFICE_LAYOUT.occluders.map((o) => ({
      cells: migrateOccluderCells(o.cells, OFFICE_LAYOUT.grid.cell),
    })),
  );
  const [paintVersion, setPaintVersion] = useState(0);
  // ブラシで塗っている間、mousemove は画面のリフレッシュレートより高頻度で発火しうる
  // （高ポーリングレートのマウス/トラックパッド）。bump() を呼ぶたびに setState→全体再描画→
  // canvas 全セル再描画→localStorage 保存…が走ると、遮蔽物セル数が多い（OCCL_CELL=5 化で
  // 最大16倍に増えた）レイアウトでは動作が固まるほど重くなる。rAF で1フレームに1回へ間引く。
  const bumpScheduledRef = useRef(false);
  const bump = useCallback(() => {
    if (bumpScheduledRef.current) return;
    bumpScheduledRef.current = true;
    requestAnimationFrame(() => {
      bumpScheduledRef.current = false;
      setPaintVersion((v) => v + 1);
    });
  }, []);

  const [seats, setSeats] = useState<Seat[]>(OFFICE_LAYOUT.seats.map((s) => ({ ...s })));
  const [seatTool, setSeatTool] = useState<'add' | 'rect'>('add');
  const [seatDir, setSeatDir] = useState<SeatDir>('south');

  const [walkTool, setWalkTool] = useState<WalkTool>('brush');
  const [brush, setBrush] = useState<Brush>('walk');

  const [occlTool, setOcclTool] = useState<OcclTool>('paint');
  const [occlSel, setOcclSel] = useState(-1);

  const [showGrid, setShowGrid] = useState(true); // 検証モードの移動グリッド表示
  const [verifyFolder, setVerifyFolder] = useState<string>(ROSTER[0].folder);
  const [previewSit, setPreviewSit] = useState(false); // 座席を使わず座り姿勢を単独プレビュー
  const [previewDir, setPreviewDir] = useState<SeatDir>('south');
  // 椅子・PC の位置オフセット（south/north 別、実機調整用）。既定値は現行コードの定数と同じ。
  const [propOffsets, setPropOffsets] = useState<Record<SeatDir, PropOffsets>>({
    south: {
      laptopX: 0,
      laptopY: LAPTOP_Y_OFFSET,
      laptopScale: charScale,
      chairX: 0,
      chairY: CHAIR_Y_OFFSET,
      chairScale: charScale,
    },
    north: {
      laptopX: 0,
      laptopY: LAPTOP_Y_OFFSET,
      laptopScale: charScale,
      chairX: 0,
      chairY: CHAIR_Y_OFFSET,
      chairScale: charScale,
    },
  });
  const updatePropOffset = (dir: SeatDir, key: keyof PropOffsets, value: number) => {
    setPropOffsets((prev) => ({ ...prev, [dir]: { ...prev[dir], [key]: value } }));
  };
  const [io, setIo] = useState('');

  const stageRef = useRef<HTMLDivElement>(null); // transform:scale() の内側（ネイティブ座標基準）
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // ---- localStorage 永続化（保存/復元） ----
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (typeof d.charScale === 'number') setCharScale(d.charScale);
      if (typeof d.zoom === 'number') setZoom(d.zoom);
      if (typeof d.cell === 'number') setCell(d.cell);
      if (d.walkable) walkableRef.current = d.walkable;
      if (d.occluders) {
        const legacyCell = typeof d.occlCell === 'number' ? d.occlCell : (d.cell ?? 20);
        occludersRef.current =
          legacyCell === OCCL_CELL
            ? d.occluders
            : d.occluders.map((o: WorkingOccluder) => ({
                cells: migrateOccluderCells(Object.keys(o.cells), legacyCell),
              }));
      }
      if (d.seats) setSeats(d.seats);
      bump();
    } catch {
      // 壊れたデータは無視して既定値を使う
    }
  }, [bump]);

  const persist = useCallback(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          charScale,
          zoom,
          cell,
          walkable: walkableRef.current,
          occluders: occludersRef.current,
          occlCell: OCCL_CELL,
          seats,
        }),
      );
    } catch {
      // 保存に失敗しても致命的ではない
    }
  }, [charScale, zoom, cell, seats]);

  // paintVersion は ref（walkable/occluders）の変更後に再保存させるための専用トリガー。
  // ブラシ塗り中は paintVersion が連続的に変わるため、そのたびに同期的に
  // JSON.stringify+localStorage.setItem すると（遮蔽物セルが多いレイアウトでは数百KB〜MB規模）
  // 塗り操作そのものが固まる。500ms のデバウンスで「塗り終わってから保存」にまとめる。
  // biome-ignore lint/correctness/useExhaustiveDependencies: paintVersion 更新で再実行させたい
  useEffect(() => {
    const timer = window.setTimeout(persist, 500);
    return () => window.clearTimeout(timer);
  }, [persist, paintVersion]);

  // タブを閉じる/離れる直前は、デバウンス中の未保存分を必ず反映する。
  useEffect(() => {
    window.addEventListener('beforeunload', persist);
    return () => window.removeEventListener('beforeunload', persist);
  }, [persist]);

  const occlCurrentIndex = useCallback(() => {
    const occluders = occludersRef.current;
    return occlSel >= 0 && occlSel < occluders.length ? occlSel : occluders.length - 1;
  }, [occlSel]);

  const occlCurrent = useCallback((): WorkingOccluder => {
    const occluders = occludersRef.current;
    const idx = occlCurrentIndex();
    if (idx >= 0 && idx < occluders.length) return occluders[idx];
    const fresh: WorkingOccluder = { cells: {} };
    occluders.push(fresh);
    return fresh;
  }, [occlCurrentIndex]);

  // ---- canvas 描画（②④モードの塗り・グリッド線・遮蔽物色分け） ----
  // paintVersion は ref（walkable/occluders）の変更後に再描画させるための専用トリガー。
  // biome-ignore lint/correctness/useExhaustiveDependencies: paintVersion 更新で再実行させたい
  const drawOverlay = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, NATIVE_W, NATIVE_H);

    if (mode === 'walk' || mode === 'occl') {
      const gridCell = mode === 'walk' ? cell : OCCL_CELL;
      ctx.strokeStyle = mode === 'walk' ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.08)';
      for (let x = 0; x <= NATIVE_W; x += gridCell) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, NATIVE_H);
        ctx.stroke();
      }
      for (let y = 0; y <= NATIVE_H; y += gridCell) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(NATIVE_W, y);
        ctx.stroke();
      }
    }

    if (mode === 'walk' || mode === 'seat') {
      ctx.fillStyle = 'rgba(40,200,80,0.35)';
      for (const key in walkableRef.current) {
        const [i, j] = key.split(',').map(Number);
        ctx.fillRect(i * cell, j * cell, cell, cell);
      }
    }

    if (mode === 'seat') {
      ctx.lineWidth = 2;
      for (const s of seats) {
        if (!s.overlay) continue;
        const [x, y, w, h] = s.overlay;
        ctx.strokeStyle = 'rgba(80,140,255,0.9)';
        ctx.strokeRect(x, y, w, h);
        ctx.fillStyle = 'rgba(80,140,255,0.15)';
        ctx.fillRect(x, y, w, h);
      }
    }

    if (mode === 'occl') {
      const curIdx = occlCurrentIndex();
      occludersRef.current.forEach((o, idx) => {
        const hue = HUES[idx % HUES.length];
        const current = idx === curIdx;
        ctx.fillStyle = `hsla(${hue}, 90%, 55%, ${current ? 0.4 : 0.22})`;
        let maxJ = -1;
        let minI = Number.POSITIVE_INFINITY;
        let maxI = -1;
        for (const key in o.cells) {
          const [i, j] = key.split(',').map(Number);
          ctx.fillRect(i * OCCL_CELL, j * OCCL_CELL, OCCL_CELL, OCCL_CELL);
          if (j > maxJ) {
            maxJ = j;
            minI = i;
            maxI = i;
          } else if (j === maxJ) {
            minI = Math.min(minI, i);
            maxI = Math.max(maxI, i);
          }
        }
        if (maxJ >= 0) {
          ctx.strokeStyle = 'rgba(255,120,0,0.95)';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(minI * OCCL_CELL, (maxJ + 1) * OCCL_CELL);
          ctx.lineTo((maxI + 1) * OCCL_CELL, (maxJ + 1) * OCCL_CELL);
          ctx.stroke();
        }
      });
    }

    if (rectDraftRef.current && (mode === 'seat' || mode === 'occl' || mode === 'walk')) {
      const { x, y, w, h } = rectDraftRef.current;
      ctx.strokeStyle = 'rgba(255,220,80,0.9)';
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(x, y, w, h);
      ctx.setLineDash([]);
    }
  }, [mode, cell, seats, occlCurrentIndex, paintVersion]);

  useEffect(() => {
    drawOverlay();
  }, [drawOverlay]);

  // 矩形選択のドラッグ中プレビューは mousemove のたびに drawOverlay() を直接呼んでいたため、
  // bump() 同様に高頻度発火で重くなっていた（§bump の rAF 間引きと同じ理由）。1フレームに1回へ間引く。
  const drawScheduledRef = useRef(false);
  const scheduleDraw = useCallback(() => {
    if (drawScheduledRef.current) return;
    drawScheduledRef.current = true;
    requestAnimationFrame(() => {
      drawScheduledRef.current = false;
      drawOverlay();
    });
  }, [drawOverlay]);

  // ---- マウス操作 ----
  const paintingRef = useRef(false);
  const occlPaintingRef = useRef(false);
  const lastPaintRef = useRef<{ x: number; y: number } | null>(null);
  const rectStartRef = useRef<{ x: number; y: number } | null>(null);
  const rectDraftRef = useRef<Rect | null>(null);

  const toNative = useCallback(
    (e: { clientX: number; clientY: number }) => {
      const r = stageRef.current?.getBoundingClientRect();
      if (!r) return { x: 0, y: 0 };
      return {
        x: Math.round((e.clientX - r.left) / zoom),
        y: Math.round((e.clientY - r.top) / zoom),
      };
    },
    [zoom],
  );

  const paintCell = useCallback(
    (x: number, y: number) => {
      if (x < 0 || y < 0 || x > NATIVE_W || y > NATIVE_H) return;
      const i = Math.floor(x / cell);
      const j = Math.floor(y / cell);
      const key = `${i},${j}`;
      if (brush === 'walk') walkableRef.current[key] = true;
      else delete walkableRef.current[key];
    },
    [cell, brush],
  );

  const paint = useCallback(
    (p: { x: number; y: number }) => {
      const from = lastPaintRef.current ?? p;
      const dist = Math.hypot(p.x - from.x, p.y - from.y);
      const steps = Math.max(1, Math.ceil(dist / (cell / 2)));
      for (let s = 0; s <= steps; s++) {
        paintCell(from.x + ((p.x - from.x) * s) / steps, from.y + ((p.y - from.y) * s) / steps);
      }
      lastPaintRef.current = p;
      bump();
    },
    [cell, paintCell, bump],
  );

  const occlApplyCell = useCallback(
    (x: number, y: number) => {
      if (x < 0 || y < 0 || x > NATIVE_W || y > NATIVE_H) return;
      const i = Math.floor(x / OCCL_CELL);
      const j = Math.floor(y / OCCL_CELL);
      const key = `${i},${j}`;
      if (occlTool === 'erase') {
        for (const o of occludersRef.current) delete o.cells[key];
      } else {
        occlCurrent().cells[key] = true;
      }
    },
    [occlTool, occlCurrent],
  );

  const occlPaint = useCallback(
    (p: { x: number; y: number }) => {
      const from = lastPaintRef.current ?? p;
      const dist = Math.hypot(p.x - from.x, p.y - from.y);
      const steps = Math.max(1, Math.ceil(dist / (OCCL_CELL / 2)));
      for (let s = 0; s <= steps; s++) {
        occlApplyCell(from.x + ((p.x - from.x) * s) / steps, from.y + ((p.y - from.y) * s) / steps);
      }
      lastPaintRef.current = p;
      bump();
    },
    [occlApplyCell, bump],
  );

  const onStageMouseDown = (e: ReactMouseEvent) => {
    e.preventDefault();
    const p = toNative(e);
    if (mode === 'walk') {
      if (walkTool === 'rect') {
        rectStartRef.current = p;
        rectDraftRef.current = { x: p.x, y: p.y, w: 0, h: 0 };
      } else {
        paintingRef.current = true;
        lastPaintRef.current = null;
        paint(p);
      }
    } else if (mode === 'seat') {
      if (seatTool === 'add') {
        setSeats((prev) => [...prev, { x: p.x, y: p.y, dir: seatDir, overlay: null }]);
      } else {
        rectStartRef.current = p;
        rectDraftRef.current = { x: p.x, y: p.y, w: 0, h: 0 };
      }
    } else if (mode === 'occl') {
      if (occlTool === 'select') {
        const i = Math.floor(p.x / OCCL_CELL);
        const j = Math.floor(p.y / OCCL_CELL);
        const key = `${i},${j}`;
        const idx = occludersRef.current.findIndex((o) => o.cells[key]);
        if (idx >= 0) {
          setOcclSel(idx);
          setOcclTool('paint');
          bump();
        }
      } else if (occlTool === 'rect') {
        rectStartRef.current = p;
        rectDraftRef.current = { x: p.x, y: p.y, w: 0, h: 0 };
      } else {
        occlPaintingRef.current = true;
        lastPaintRef.current = null;
        occlPaint(p);
      }
    }
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (paintingRef.current) paint(toNative(e));
      if (occlPaintingRef.current) occlPaint(toNative(e));
      if (rectStartRef.current) {
        const p = toNative(e);
        const start = rectStartRef.current;
        rectDraftRef.current = {
          x: Math.min(start.x, p.x),
          y: Math.min(start.y, p.y),
          w: Math.abs(p.x - start.x),
          h: Math.abs(p.y - start.y),
        };
        scheduleDraw();
      }
    };
    const onUp = () => {
      paintingRef.current = false;
      occlPaintingRef.current = false;
      lastPaintRef.current = null;
      const rect = rectDraftRef.current;
      if (rectStartRef.current && rect && rect.w > 4 && rect.h > 4) {
        if (mode === 'seat') {
          setSeats((prev) => {
            const next = [...prev];
            let target: Seat | undefined;
            for (let i = next.length - 1; i >= 0; i--) {
              if (next[i].dir === 'south' && !next[i].overlay) {
                target = next[i];
                break;
              }
            }
            if (!target) target = next[next.length - 1];
            if (target) target.overlay = [rect.x, rect.y, rect.w, rect.h];
            return next;
          });
        } else if (mode === 'occl') {
          const i0 = Math.max(0, Math.floor(rect.x / OCCL_CELL));
          const i1 = Math.floor((rect.x + rect.w) / OCCL_CELL);
          const j0 = Math.max(0, Math.floor(rect.y / OCCL_CELL));
          const j1 = Math.floor((rect.y + rect.h) / OCCL_CELL);
          for (let i = i0; i <= i1; i++)
            for (let j = j0; j <= j1; j++)
              occlApplyCell(i * OCCL_CELL + OCCL_CELL / 2, j * OCCL_CELL + OCCL_CELL / 2);
        } else if (mode === 'walk') {
          const i0 = Math.max(0, Math.floor(rect.x / cell));
          const i1 = Math.floor((rect.x + rect.w) / cell);
          const j0 = Math.max(0, Math.floor(rect.y / cell));
          const j1 = Math.floor((rect.y + rect.h) / cell);
          for (let i = i0; i <= i1; i++)
            for (let j = j0; j <= j1; j++) paintCell(i * cell + cell / 2, j * cell + cell / 2);
        }
        bump();
      }
      rectStartRef.current = null;
      rectDraftRef.current = null;
      drawOverlay();
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [
    mode,
    cell,
    paint,
    occlPaint,
    occlApplyCell,
    paintCell,
    drawOverlay,
    scheduleDraw,
    bump,
    toNative,
  ]);

  // occludersRef の全セルを毎レンダー数え直すと（塗り中は最大60回/秒レンダーされるため）
  // drawOverlay と同等の走査コストが二重にかかる。paintVersion をキーに使う時だけ数え直す。
  // biome-ignore lint/correctness/useExhaustiveDependencies: paintVersion 変化時のみ ref を数え直したい
  const occlCount = useMemo(
    () => occludersRef.current.filter((o) => Object.keys(o.cells).length > 0).length,
    [paintVersion],
  );
  const occlInfoText =
    occlCount === 0 ? '0個' : `${occlCount}個 / 編集中: #${occlCurrentIndex() + 1}`;

  const spritePath = (p: string) => `/sprites/office/${p}`;

  // ---- JSON 出力/読込 ----
  const exportJson = () => {
    const out = {
      charScale,
      footOffsets: {
        stand: Math.round(FOOT_MARGIN.stand * charScale),
        sitSouth: Math.round(FOOT_MARGIN.sitSouth * charScale),
        sitNorth: Math.round(FOOT_MARGIN.sitNorth * charScale),
      },
      grid: { cell, walkable: Object.keys(walkableRef.current) },
      seats,
      occlCell: OCCL_CELL,
      occluders: occludersRef.current
        .filter((o) => Object.keys(o.cells).length > 0)
        .map((o) => ({ cells: Object.keys(o.cells), baseline: occluderBaseline(o) })),
    };
    const json = JSON.stringify(out, null, 2);
    setIo(json);
    navigator.clipboard?.writeText(json).catch(() => {});
  };

  const importJson = () => {
    try {
      const d = JSON.parse(io);
      if (typeof d.charScale === 'number') setCharScale(d.charScale);
      if (d.grid) {
        if (typeof d.grid.cell === 'number') setCell(d.grid.cell);
        walkableRef.current = Object.fromEntries(
          (d.grid.walkable ?? []).map((k: string) => [k, true]),
        );
      }
      if (d.seats) setSeats(d.seats);
      if (d.occluders) {
        const legacyCell = typeof d.occlCell === 'number' ? d.occlCell : (d.grid?.cell ?? 20);
        occludersRef.current = d.occluders.map((o: { cells: string[] }) => ({
          cells: migrateOccluderCells(o.cells, legacyCell),
        }));
      }
      setOcclSel(-1);
      bump();
    } catch (e) {
      alert(`JSON が不正です: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const setModeAndReset = (m: EditorMode) => {
    setMode(m);
    rectStartRef.current = null;
    rectDraftRef.current = null;
    drawOverlay();
  };

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        background: '#1c1c1e',
        color: '#eee',
        fontFamily: 'sans-serif',
        fontSize: 13,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          gap: 16,
          alignItems: 'center',
          padding: '8px 12px',
          background: '#2a2a2e',
          borderBottom: '1px solid #444',
          flexWrap: 'wrap',
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: 6,
            alignItems: 'center',
            padding: '4px 10px',
            background: '#333',
            borderRadius: 6,
          }}
        >
          <b>モード:</b>
          {(['size', 'walk', 'seat', 'occl', 'verify'] as const).map((m, i) => (
            <button
              key={m}
              type="button"
              onClick={() => setModeAndReset(m)}
              style={btnStyle(mode === m)}
            >
              {['① サイズ', '② 移動領域', '③ 座席', '④ 遮蔽物', '⑤ 検証'][i]}
            </button>
          ))}
        </div>

        {mode === 'size' && (
          <div style={groupStyle}>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              キャラ倍率 <span style={valStyle}>{charScale.toFixed(2)}</span>×
              <input
                type="range"
                min={1.5}
                max={4.5}
                step={0.25}
                value={charScale}
                onChange={(e) => setCharScale(Number(e.target.value))}
              />
            </label>
          </div>
        )}

        {mode === 'walk' && (
          <div style={groupStyle}>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              セル <span style={valStyle}>{cell}</span>px
              <input
                type="range"
                min={10}
                max={80}
                step={5}
                value={cell}
                onChange={(e) => setCell(Number(e.target.value))}
              />
            </label>
            <button
              type="button"
              onClick={() => setWalkTool('brush')}
              style={btnStyle(walkTool === 'brush')}
            >
              🖌 ブラシ
            </button>
            <button
              type="button"
              onClick={() => setWalkTool('rect')}
              style={btnStyle(walkTool === 'rect')}
            >
              ▭ 矩形選択
            </button>
            <span>|</span>
            <button
              type="button"
              onClick={() => setBrush('walk')}
              style={btnStyle(brush === 'walk')}
            >
              🟩 歩ける
            </button>
            <button
              type="button"
              onClick={() => setBrush('erase')}
              style={btnStyle(brush === 'erase')}
            >
              ⬜ 消す
            </button>
            <button
              type="button"
              onClick={() => {
                if (confirm('移動領域を全消去しますか？')) {
                  walkableRef.current = {};
                  bump();
                }
              }}
              style={btnStyle(false)}
            >
              全消去
            </button>
          </div>
        )}

        {mode === 'seat' && (
          <div style={groupStyle}>
            <button
              type="button"
              onClick={() => setSeatTool('add')}
              style={btnStyle(seatTool === 'add')}
            >
              ➕ 座席追加
            </button>
            <button
              type="button"
              onClick={() => setSeatDir((d) => (d === 'south' ? 'north' : 'south'))}
              style={btnStyle(false)}
            >
              向き: {seatDir === 'south' ? '⬇ south' : '⬆ north'}
            </button>
            <button
              type="button"
              onClick={() => setSeatTool('rect')}
              style={btnStyle(seatTool === 'rect')}
            >
              🟦 隠し矩形を描く
            </button>
            <button
              type="button"
              onClick={() => setSeats((prev) => prev.slice(0, -1))}
              style={btnStyle(false)}
            >
              🗑 最後の座席を削除
            </button>
            <span style={valStyle}>{seats.length}席</span>
          </div>
        )}

        {mode === 'occl' && (
          <div style={groupStyle}>
            <button
              type="button"
              onClick={() => {
                setOcclSel(-1);
                const cur = occludersRef.current[occludersRef.current.length - 1];
                if (!cur || Object.keys(cur.cells).length > 0)
                  occludersRef.current.push({ cells: {} });
                setOcclTool('paint');
                bump();
              }}
              style={btnStyle(false)}
            >
              ➕ 新しい遮蔽物
            </button>
            <button
              type="button"
              onClick={() => setOcclTool('select')}
              style={btnStyle(occlTool === 'select')}
            >
              🎯 選択
            </button>
            <button
              type="button"
              onClick={() => setOcclTool('paint')}
              style={btnStyle(occlTool === 'paint')}
            >
              🖌 塗る
            </button>
            <button
              type="button"
              onClick={() => setOcclTool('rect')}
              style={btnStyle(occlTool === 'rect')}
            >
              ▭ 矩形
            </button>
            <button
              type="button"
              onClick={() => setOcclTool('erase')}
              style={btnStyle(occlTool === 'erase')}
            >
              ⬜ 消す
            </button>
            <button
              type="button"
              onClick={() => {
                const idx = occlCurrentIndex();
                if (idx >= 0) occludersRef.current.splice(idx, 1);
                setOcclSel(-1);
                bump();
              }}
              style={btnStyle(false)}
            >
              🗑 選択中を削除
            </button>
            <span style={valStyle}>{occlInfoText}</span>
          </div>
        )}

        {mode === 'verify' && (
          <div style={groupStyle}>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              キャラ
              <select value={verifyFolder} onChange={(e) => setVerifyFolder(e.target.value)}>
                {ROSTER.map((r) => (
                  <option key={r.folder} value={r.folder}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={showGrid}
                onChange={(e) => setShowGrid(e.target.checked)}
              />
              歩行グリッド表示
            </label>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={previewSit}
                onChange={(e) => setPreviewSit(e.target.checked)}
              />
              座りプレビュー（座席不要・椅子/PC込み）
            </label>
            {previewSit && (
              <button
                type="button"
                onClick={() => setPreviewDir((d) => (d === 'south' ? 'north' : 'south'))}
                style={btnStyle(false)}
              >
                向き: {previewDir === 'south' ? '⬇ south' : '⬆ north'}
              </button>
            )}
            {previewSit && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ color: '#aaa' }}>PC</span>
                <label style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  X
                  <input
                    type="number"
                    value={propOffsets[previewDir].laptopX}
                    onChange={(e) =>
                      updatePropOffset(previewDir, 'laptopX', Number(e.target.value))
                    }
                    style={{ width: 60 }}
                  />
                </label>
                <label style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  Y
                  <input
                    type="number"
                    value={propOffsets[previewDir].laptopY}
                    onChange={(e) =>
                      updatePropOffset(previewDir, 'laptopY', Number(e.target.value))
                    }
                    style={{ width: 60 }}
                  />
                </label>
                <label style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  倍率
                  <input
                    type="number"
                    step={0.05}
                    min={0.1}
                    value={propOffsets[previewDir].laptopScale}
                    onChange={(e) =>
                      updatePropOffset(previewDir, 'laptopScale', Number(e.target.value))
                    }
                    style={{ width: 60 }}
                  />
                </label>
                <span style={{ color: '#aaa' }}>椅子</span>
                <label style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  X
                  <input
                    type="number"
                    value={propOffsets[previewDir].chairX}
                    onChange={(e) => updatePropOffset(previewDir, 'chairX', Number(e.target.value))}
                    style={{ width: 60 }}
                  />
                </label>
                <label style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  Y
                  <input
                    type="number"
                    value={propOffsets[previewDir].chairY}
                    onChange={(e) => updatePropOffset(previewDir, 'chairY', Number(e.target.value))}
                    style={{ width: 60 }}
                  />
                </label>
                <label style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  倍率
                  <input
                    type="number"
                    step={0.05}
                    min={0.1}
                    value={propOffsets[previewDir].chairScale}
                    onChange={(e) =>
                      updatePropOffset(previewDir, 'chairScale', Number(e.target.value))
                    }
                    style={{ width: 60 }}
                  />
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setPropOffsets((prev) => ({
                      ...prev,
                      [previewDir]: {
                        laptopX: 0,
                        laptopY: LAPTOP_Y_OFFSET,
                        laptopScale: charScale,
                        chairX: 0,
                        chairY: CHAIR_Y_OFFSET,
                        chairScale: charScale,
                      },
                    }))
                  }
                  style={btnStyle(false)}
                >
                  ↺ 既定値
                </button>
                <button
                  type="button"
                  onClick={() => setIo(JSON.stringify({ propOffsets }, null, 2))}
                  style={btnStyle(false)}
                >
                  📋 物体JSON出力
                </button>
              </div>
            )}
            <span style={{ color: '#aaa' }}>移動: 矢印キー / WASD</span>
          </div>
        )}

        <div style={groupStyle}>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            表示 <span style={valStyle}>{Math.round(zoom * 100)}%</span>
            <input
              type="range"
              min={40}
              max={400}
              value={Math.round(zoom * 100)}
              onChange={(e) => setZoom(Number(e.target.value) / 100)}
            />
          </label>
          <button type="button" onClick={exportJson} style={btnStyle(false)}>
            📋 JSON出力
          </button>
          <button type="button" onClick={importJson} style={btnStyle(false)}>
            読込
          </button>
        </div>
      </div>

      <p style={{ color: '#aaa', margin: '4px 14px' }}>{HINTS[mode]}</p>

      <div style={{ flex: 1, overflow: 'auto', display: 'flex', justifyContent: 'center' }}>
        <div
          style={{
            position: 'relative',
            width: NATIVE_W * zoom,
            height: NATIVE_H * zoom,
            margin: '12px 0',
            flexShrink: 0,
          }}
        >
          {/* biome-ignore lint/a11y/noStaticElementInteractions: dev専用のマウス描画面（キーボード操作の代替はない） */}
          <div
            ref={stageRef}
            onMouseDown={mode === 'verify' ? undefined : onStageMouseDown}
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              transform: `scale(${zoom})`,
              transformOrigin: 'top left',
              width: NATIVE_W,
              height: NATIVE_H,
              cursor: mode === 'verify' ? 'default' : 'crosshair',
            }}
          >
            <img
              src={officeBgSrc}
              alt=""
              width={NATIVE_W}
              height={NATIVE_H}
              style={{ position: 'absolute', left: 0, top: 0, imageRendering: 'pixelated' }}
              draggable={false}
            />
            <canvas
              ref={canvasRef}
              width={NATIVE_W}
              height={NATIVE_H}
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                pointerEvents: 'none',
                display: mode === 'verify' ? 'none' : 'block',
              }}
            />

            {mode === 'size' &&
              SAMPLES.map((s) => (
                <SizeSample
                  key={s.src}
                  src={spritePath(s.src)}
                  x={s.x}
                  y={s.y}
                  charScale={charScale}
                  offKey={s.off}
                />
              ))}

            {mode === 'seat' &&
              seats.map((s, idx) => (
                <div
                  key={idx}
                  style={{
                    position: 'absolute',
                    left: s.x,
                    top: s.y,
                    transform: 'translate(-50%, -50%)',
                    pointerEvents: 'none',
                    fontSize: 14,
                    textShadow: '0 0 3px #000',
                    color: s.dir === 'south' ? '#7fd7ff' : '#ffb57f',
                  }}
                >
                  {s.dir === 'south' ? '⬇' : '⬆'}
                  {idx + 1}
                </div>
              ))}

            {mode === 'verify' && (
              <VerifyLayer
                walkable={walkableRef.current}
                occluders={occludersRef.current}
                seats={seats}
                charScale={charScale}
                cell={cell}
                showGrid={showGrid}
                folder={verifyFolder}
                previewSit={previewSit}
                previewDir={previewDir}
                onPreviewDirChange={setPreviewDir}
                propOffsets={propOffsets}
              />
            )}
          </div>
        </div>
      </div>

      <textarea
        value={io}
        onChange={(e) => setIo(e.target.value)}
        placeholder="ここに JSON が出ます / 貼り付けて「読込」も可"
        style={{
          width: '96%',
          height: 110,
          margin: '8px auto',
          display: 'block',
          background: '#222',
          color: '#9f9',
          fontFamily: 'monospace',
          fontSize: 11,
        }}
      />
    </div>
  );
}

const groupStyle: CSSProperties = {
  display: 'flex',
  gap: 6,
  alignItems: 'center',
  padding: '4px 10px',
  background: '#333',
  borderRadius: 6,
};
const valStyle: CSSProperties = {
  color: '#ffd479',
  minWidth: '3em',
  display: 'inline-block',
  textAlign: 'right',
};
const btnStyle = (active: boolean): CSSProperties => ({
  background: active ? '#2d6cdf' : '#4a4a52',
  color: '#eee',
  border: `1px solid ${active ? '#5b8ff0' : '#666'}`,
  borderRadius: 4,
  padding: '4px 10px',
  cursor: 'pointer',
});

/** ①サイズモードのサンプルキャラ。naturalWidth 実測 × charScale で表示（決め打ち禁止の原則）。 */
function SizeSample({
  src,
  x,
  y,
  charScale,
  offKey,
}: {
  src: string;
  x: number;
  y: number;
  charScale: number;
  offKey: keyof typeof FOOT_MARGIN;
}) {
  const [width, setWidth] = useState<number | null>(null);
  return (
    <img
      src={src}
      alt=""
      onLoad={(e) => setWidth(e.currentTarget.naturalWidth * charScale)}
      style={{
        position: 'absolute',
        left: x,
        top: y + FOOT_MARGIN[offKey] * charScale,
        width: width ?? undefined,
        visibility: width === null ? 'hidden' : 'visible',
        transform: 'translate(-50%, -100%)',
        imageRendering: 'pixelated',
        pointerEvents: 'none',
      }}
    />
  );
}

// ============ ⑤ 検証モード ============

type Pos = { x: number; y: number; dir: Dir8; moving: boolean };
const VERIFY_SPEED = 260;
const VERIFY_START = { x: 530, y: 950 };

/**
 * VERIFY_START はドア前の歩行可能マスを想定した固定座標だが、②で移動領域を編集したり
 * localStorage に古いデータが残っていたりすると歩行不可になり得る。同心円状に近傍を探索し
 * 実際に歩けるセルへ自己修復することで、データの状態によらず検証モードが必ず歩ける場所から
 * 始まるようにする（固定座標を別の値に変えるだけだと同じ問題が形を変えて再発するため）。
 */
function findNearestWalkable(
  walkable: Record<string, true>,
  cell: number,
  x: number,
  y: number,
  maxRadius = 40,
): { x: number; y: number } {
  const i0 = Math.floor(x / cell);
  const j0 = Math.floor(y / cell);
  if (walkable[`${i0},${j0}`]) return { x, y };
  for (let r = 1; r <= maxRadius; r++) {
    for (let di = -r; di <= r; di++) {
      for (let dj = -r; dj <= r; dj++) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
        if (walkable[`${i0 + di},${j0 + dj}`]) {
          return { x: (i0 + di + 0.5) * cell, y: (j0 + dj + 0.5) * cell };
        }
      }
    }
  }
  return { x, y };
}
const KEY_TO_AXIS: Record<string, [number, number]> = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  w: [0, -1],
  s: [0, 1],
  a: [-1, 0],
  d: [1, 0],
};
function VerifyLayer({
  walkable,
  occluders,
  seats,
  charScale,
  cell,
  showGrid,
  folder,
  previewSit,
  previewDir,
  onPreviewDirChange,
  propOffsets,
}: {
  walkable: Record<string, true>;
  occluders: WorkingOccluder[];
  seats: Seat[];
  charScale: number;
  cell: number;
  showGrid: boolean;
  folder: string;
  previewSit: boolean;
  previewDir: SeatDir;
  onPreviewDirChange: (dir: SeatDir) => void;
  propOffsets: Record<SeatDir, PropOffsets>;
}) {
  const [pos, setPos] = useState<Pos>(() => {
    const safe = findNearestWalkable(walkable, cell, VERIFY_START.x, VERIFY_START.y);
    return { x: safe.x, y: safe.y, dir: 'south', moving: false };
  });
  const [frame, setFrame] = useState(0);
  const [sitting, setSitting] = useState(-1);
  const [frameW, setFrameW] = useState<number | null>(null);
  const keysRef = useRef<Record<string, boolean>>({});
  const posRef = useRef(pos);
  posRef.current = pos;
  const sittingRef = useRef(sitting);
  sittingRef.current = sitting;

  // 歩行シートの実フレーム幅を計測（PixelLab 出力サイズを決め打ちしない。OfficeWalkTool と同じ原則）
  useEffect(() => {
    let cancelled = false;
    setFrameW(null);
    const img = new Image();
    img.onload = () => {
      if (!cancelled) setFrameW(img.naturalWidth / WALK_FRAMES);
    };
    img.src = walkSheet(folder, 'south');
    return () => {
      cancelled = true;
    };
  }, [folder]);

  // 座りプレビューON時は最初の座席の前に自動配置する（毎回ドア前から歩かせる手間を省く）。
  // previewSit が true になった瞬間だけ発火させたい（seats 変更のたびに再配置し直すと
  // プレビュー中の移動と衝突するため、依存配列は意図的に previewSit のみにする）。
  // biome-ignore lint/correctness/useExhaustiveDependencies: only reposition on the previewSit on-edge, not on every seats change
  useEffect(() => {
    if (!previewSit || seats.length === 0) return;
    const s = seats[0];
    setSitting(-1);
    setPos({ x: s.x, y: s.y, dir: s.dir, moving: false });
    onPreviewDirChange(s.dir);
  }, [previewSit]);

  const canStand = useCallback(
    (x: number, y: number) => !!walkable[`${Math.floor(x / cell)},${Math.floor(y / cell)}`],
    [walkable, cell],
  );

  const occluderLookup = useMemo(() => buildLookup(occluders), [occluders]);

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (KEY_TO_AXIS[e.key]) e.preventDefault();
      keysRef.current[e.key] = true;
    };
    const onUp = (e: KeyboardEvent) => {
      keysRef.current[e.key] = false;
    };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    };
  }, []);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      let dx = 0;
      let dy = 0;
      for (const [key, axis] of Object.entries(KEY_TO_AXIS)) {
        if (keysRef.current[key]) {
          dx += axis[0];
          dy += axis[1];
        }
      }
      const p = posRef.current;
      const moving = dx !== 0 || dy !== 0;
      if (moving) {
        if (sittingRef.current >= 0) setSitting(-1);
        const dir = vectorToDir8(dx, dy);
        const len = Math.hypot(dx, dy);
        const nx = p.x + (dx / len) * VERIFY_SPEED * dt;
        const ny = p.y + (dy / len) * VERIFY_SPEED * dt;
        let next: Pos;
        if (canStand(nx, ny)) next = { x: nx, y: ny, dir, moving };
        else if (canStand(nx, p.y)) next = { x: nx, y: p.y, dir, moving };
        else if (canStand(p.x, ny)) next = { x: p.x, y: ny, dir, moving };
        else next = { ...p, dir, moving };
        setPos(next);
        setFrame(Math.floor((now / 90) % WALK_FRAMES));
      } else if (p.moving) {
        setPos({ ...p, moving: false });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [canStand]);

  const sitNext = () => {
    if (seats.length === 0) return;
    const next = (sitting + 1) % seats.length;
    setSitting(next);
    const s = seats[next];
    setPos({ x: s.x, y: s.y, dir: s.dir, moving: false });
  };
  const reset = () => {
    setSitting(-1);
    const safe = findNearestWalkable(walkable, cell, VERIFY_START.x, VERIFY_START.y);
    setPos({ x: safe.x, y: safe.y, dir: 'south', moving: false });
  };

  const charSize = frameW != null ? frameW * charScale : 0;
  const isSitting = sitting >= 0;

  return (
    <>
      {showGrid && <WalkableGridCanvas walkable={walkable} cell={cell} />}

      {occluders.map((o, idx) => (
        <OccluderMask key={idx} cells={Object.keys(o.cells)} bgSrc={officeBgSrc} />
      ))}

      <div style={{ position: 'fixed', top: 90, left: 16, zIndex: 99999, display: 'flex', gap: 8 }}>
        <button type="button" onClick={sitNext} style={btnStyle(false)}>
          🪑 次の座席に座る
        </button>
        <button type="button" onClick={reset} style={btnStyle(false)}>
          ↺ ドア前に戻す
        </button>
      </div>

      {isSitting && (pos.dir === 'south' || pos.dir === 'north') ? (
        <SeatedPreview
          folder={folder}
          dir={pos.dir}
          x={pos.x}
          y={pos.y}
          charScale={charScale}
          occluderLookup={occluderLookup}
          offsets={propOffsets[pos.dir]}
        />
      ) : previewSit ? (
        <SeatedPreview
          folder={folder}
          dir={previewDir}
          x={pos.x}
          y={pos.y}
          charScale={charScale}
          occluderLookup={occluderLookup}
          offsets={propOffsets[previewDir]}
        />
      ) : (
        charSize > 0 &&
        renderBandedSprite(
          'char',
          pos.x,
          pos.y,
          FOOT_MARGIN.stand * charScale,
          charSize,
          charSize,
          pos.moving ? walkSheet(folder, pos.dir) : standingSprite(folder, pos.dir),
          pos.moving ? -frame * charSize : 0,
          pos.moving ? charSize * WALK_FRAMES : charSize,
          occluderLookup,
        )
      )}
    </>
  );
}

/**
 * 移動グリッドの緑色オーバーレイ。歩行可能セル数（既定 cell=20 で最大 数百〜1000超）ぶん
 * <div> を1個ずつ生成すると、⑤検証中は移動のたびに毎フレーム（rAFループでの setPos）作り直され
 * 重くなる（ファイル冒頭の「②④は canvas に描画、DOM大量生成は重い」という原則が
 * ⑤のこのオーバーレイにだけ適用されていなかった）。walkable/cell が変わった時だけ
 * canvas に描き直し、以降は歩行中も再描画しない静的なレイヤーにする。
 */
function WalkableGridCanvas({ walkable, cell }: { walkable: Record<string, true>; cell: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(40,200,80,0.3)';
    ctx.strokeStyle = 'rgba(40,200,80,0.5)';
    for (const key in walkable) {
      const [i, j] = key.split(',').map(Number);
      ctx.fillRect(i * cell, j * cell, cell, cell);
      ctx.strokeRect(i * cell + 0.5, j * cell + 0.5, cell - 1, cell - 1);
    }
  }, [walkable, cell]);
  return (
    <canvas
      ref={canvasRef}
      width={NATIVE_W}
      height={NATIVE_H}
      style={{ position: 'absolute', left: 0, top: 0, zIndex: 1, pointerEvents: 'none' }}
    />
  );
}

/**
 * 着席スプライトは立ち/歩行と canvas サイズが異なりうる（footOffsets に stand と
 * sitSouth/sitNorth で別々の値があるのはそのため）ので、専用に naturalWidth を計測する。
 */
function SittingCharacter({
  folder,
  dir,
  x,
  y,
  charScale,
  occluderLookup,
}: {
  folder: string;
  dir: SeatDir;
  x: number;
  y: number;
  charScale: number;
  occluderLookup: OccluderLookup;
}) {
  const [size, setSize] = useState<number | null>(null);
  const footOffset = (dir === 'south' ? FOOT_MARGIN.sitSouth : FOOT_MARGIN.sitNorth) * charScale;
  const src = `/sprites/office/${folder}/sitting/${dir}.png`;
  return (
    <>
      {size == null && (
        <img
          src={src}
          alt=""
          onLoad={(e) => setSize(e.currentTarget.naturalWidth * charScale)}
          style={{ position: 'absolute', width: 0, height: 0, opacity: 0 }}
        />
      )}
      {size != null &&
        renderBandedSprite('sit', x, y, footOffset, size, size, src, 0, size, occluderLookup)}
    </>
  );
}

/**
 * 座りプレビュー用に椅子・PCも合わせて表示する（OfficeView.tsx の SeatedEmployee と同じ
 * オフセット・z順を再現）。静的な小物なので、歩行検証用の occluder バンド処理は使わず
 * 単純な絶対配置+スケールのみで描く（OfficeView.tsx の ScaledSprite と同じ方式）。
 */
function PropSprite({
  src,
  x,
  footY,
  z,
  charScale,
}: {
  src: string;
  x: number;
  footY: number;
  z: number;
  charScale: number;
}) {
  // 実ピクセル幅だけを保持し、表示幅は毎回 natural×scale で計算する
  // （倍率をUIで変えたときに即反映させるため。onLoad で確定値を持つと変わらない）。
  const [natural, setNatural] = useState<number | null>(null);
  const width = natural == null ? undefined : natural * charScale;
  const style: CSSProperties = {
    position: 'absolute',
    left: x,
    top: footY,
    width,
    transform: 'translate(-50%, -100%)',
    zIndex: z,
    imageRendering: 'pixelated',
    visibility: width === undefined ? 'hidden' : 'visible',
  };
  return (
    <img src={src} alt="" style={style} onLoad={(e) => setNatural(e.currentTarget.naturalWidth)} />
  );
}

function SeatedPreview({
  folder,
  dir,
  x,
  y,
  charScale,
  occluderLookup,
  offsets,
}: {
  folder: string;
  dir: SeatDir;
  x: number;
  y: number;
  charScale: number;
  occluderLookup: OccluderLookup;
  offsets: PropOffsets;
}) {
  const baseZ = Math.round(y);
  // OfficeView.tsx の SeatedEmployee と同様、着席時の足元オフセットを足した footY を基準にする
  // （キャラの座り足元と同じ基準点に揃えないと、椅子・PCがキャラから浮いて見える）。
  const footY = y + sitFootOffset(dir);
  if (dir === 'north') {
    return (
      <>
        <PropSprite
          src={laptopSprite('north')}
          x={x + offsets.laptopX}
          footY={footY + offsets.laptopY}
          z={baseZ - 1}
          charScale={offsets.laptopScale}
        />
        <SittingCharacter
          folder={folder}
          dir="north"
          x={x}
          y={y}
          charScale={charScale}
          occluderLookup={occluderLookup}
        />
        <PropSprite
          src={chairSprite('north')}
          x={x + offsets.chairX}
          footY={footY + offsets.chairY}
          z={baseZ + 1}
          charScale={offsets.chairScale}
        />
      </>
    );
  }
  return (
    <>
      <PropSprite
        src={chairSprite('south')}
        x={x + offsets.chairX}
        footY={footY + offsets.chairY}
        z={baseZ - 1}
        charScale={offsets.chairScale}
      />
      <SittingCharacter
        folder={folder}
        dir="south"
        x={x}
        y={y}
        charScale={charScale}
        occluderLookup={occluderLookup}
      />
      <PropSprite
        src={laptopSprite('south')}
        x={x + offsets.laptopX}
        footY={footY + offsets.laptopY}
        z={baseZ + 2}
        charScale={offsets.laptopScale}
      />
    </>
  );
}
