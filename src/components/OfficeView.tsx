import { type ReactNode, useEffect, useState } from 'react';
import type { Scale } from '../data/scales';
import { clipKeepLeft, clipKeepRight, WS_CHAIR, WS_LAYERS } from '../data/workstation';

/**
 * オフィスの床ビュー（v0.13）。
 *
 * いったん「アイソメの床」だけにリセットした状態。
 * office-visual-design §2 準拠：視点はアイソメ 30°×30°（2:1 dimetric）。
 * 床は (i−j, i+j) 投影のひし形グリッドで、部屋の輪郭は菱形（rhombus）になる。
 *
 * 壁・家具・モニター・社員・装飾はすべて撤去済み。ここから1つずつ積み上げる。
 */

const TILE = 32;
const SCALE = 3;
const cellPx = TILE * SCALE; // 96px
const SPRITE_BASE = '/sprites/office';

/** 床グリッド（菱形フットプリント）の cols × rows。規模で広くなる。 */
const ROOM: Record<Scale, { cols: number; rows: number }> = {
  mini: { cols: 8, rows: 7 },
  mobile: { cols: 11, rows: 7 },
  indie: { cols: 11, rows: 9 },
  hit: { cols: 14, rows: 9 },
  aaa: { cols: 14, rows: 11 },
};

/** ワークステーションを置くセル（ここを編集すれば配置をずらせる）。 */
const WORKSTATION_CELLS: { i: number; j: number }[] = [
  { i: 2, j: 1 },
  { i: 5, j: 1 },
  { i: 2, j: 4 },
  { i: 5, j: 4 },
];

/** スプライト存在チェック（Vite dev は存在しないパスにも index.html を返すため content-type で判定） */
const spriteCache = new Map<string, boolean>();
const checkSprite = async (path: string): Promise<boolean> => {
  if (spriteCache.has(path)) return spriteCache.get(path) ?? false;
  try {
    const res = await fetch(path, { method: 'HEAD' });
    const contentType = res.headers.get('content-type') ?? '';
    const ok = res.ok && !contentType.includes('text/html');
    spriteCache.set(path, ok);
    return ok;
  } catch {
    spriteCache.set(path, false);
    return false;
  }
};
const useSprite = (path: string) => {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    checkSprite(path).then(setLoaded);
  }, [path]);
  return { loaded, path: loaded ? path : null };
};

type Props = {
  scale: Scale;
  // 以下は呼び出し側互換のため受けるが、床のみの現段階では未使用
  employeeCount?: number;
  working?: boolean;
  deskId?: string;
  chairId?: string;
  monitorId?: string;
};

export const OfficeView = ({ scale }: Props) => {
  const floor = useSprite(`${SPRITE_BASE}/floor_iso.png`);
  const { cols, rows } = ROOM[scale] ?? ROOM.mini;

  const w = cols * cellPx;
  const h = rows * cellPx;

  // アイソメ床グリッドの幾何（床と配置物で共有）。天面は 2:1 dimetric。
  const dW = cellPx; // ひし形天面の横 96
  const dH = cellPx / 2; // 縦 48
  const spanX = (cols + rows - 2) * (dW / 2) + dW;
  const spanY = (cols + rows - 2) * (dH / 2) + dH;
  const originX = (w - spanX) / 2 + (rows - 1) * (dW / 2);
  const originY = (h - spanY) / 2;

  const tileTopLeft = (i: number, j: number) => ({
    left: originX + (i - j) * (dW / 2),
    top: originY + (i + j) * (dH / 2),
  });
  // セル(i,j)の床上アンカー（ひし形天面の中心あたり）＝物を置く基準点
  const cellAnchor = (i: number, j: number) => ({
    x: originX + (i - j) * (dW / 2) + cellPx / 2,
    y: originY + (i + j) * (dH / 2) + cellPx * 0.6,
  });

  // 床：アイソメひし形タイルを菱形グリッドで敷く
  const renderFloor = (): ReactNode => {
    if (!floor.loaded) {
      return (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'repeating-conic-gradient(#cfc6b3 0% 25%, #c2b8a3 0% 50%) 50% / 32px 32px',
            imageRendering: 'pixelated',
          }}
        />
      );
    }
    const tiles: ReactNode[] = [];
    for (let s = 0; s <= cols + rows - 2; s++) {
      for (let i = 0; i < cols; i++) {
        const j = s - i;
        if (j < 0 || j >= rows) continue;
        const { left, top } = tileTopLeft(i, j);
        tiles.push(
          <img
            key={`floor-${i}-${j}`}
            src={floor.path ?? ''}
            alt=""
            width={cellPx}
            height={cellPx}
            style={{ position: 'absolute', left, top, imageRendering: 'pixelated', display: 'block' }}
          />,
        );
      }
    }
    return tiles;
  };

  // ワークステーション1セット（机→PC→人→椅子背）。
  // 配置値は WorkstationTuner で確定したもの。各 img は正方キャンバスを w にスケールし、
  // 「左右中央＝x+ox、下端＝y+oy」で床アンカー基準に置く。
  const renderWorkstation = (i: number, j: number): ReactNode => {
    const { x, y } = cellAnchor(i, j);
    // セット全体の前後は (i+j)、セット内の重なりは z で決める
    const baseZ = (i + j) * 10;
    const imgEl = (
      key: string,
      img: string,
      sw: number,
      ox: number,
      oy: number,
      z: number,
      clip?: string,
    ) => (
      <img
        key={key}
        src={`${SPRITE_BASE}/${img}`}
        alt=""
        width={sw}
        height={sw}
        style={{
          position: 'absolute',
          left: x + ox - sw / 2,
          top: y + oy - sw,
          clipPath: clip,
          imageRendering: 'pixelated',
          zIndex: baseZ + z,
          display: 'block',
        }}
      />
    );
    const c = WS_CHAIR;
    return (
      <div key={`ws-${i}-${j}`}>
        {WS_LAYERS.map((l) =>
          imgEl(
            `l-${l.img}`,
            l.img,
            l.w,
            l.ox,
            l.oy,
            l.z,
            l.clipTop != null && l.clipBot != null ? clipKeepLeft(l.clipTop, l.clipBot) : undefined,
          ),
        )}
        {imgEl('chairBack', c.img, c.w, c.ox, c.oy, c.zBack, clipKeepRight(c.top, c.bot))}
        {imgEl('chairFront', c.img, c.w, c.ox, c.oy, c.zFront, clipKeepLeft(c.top, c.bot))}
      </div>
    );
  };

  // 壁：床の菱形の奥2辺（NW・NE）に沿って窓パネル（ドット絵）を並べる。
  // NE 辺＝(i,0) タイル列、NW 辺＝(0,j) タイル列。パネル自体がアイソメで傾いているので
  // 辺に沿って 2 タイルおきに置くと窓壁になる。サイズ/オフセットは要調整。
  const renderWalls = (): ReactNode => {
    const pW = 110; // パネル表示幅
    const pH = (pW * 160) / 96; // アスペクト維持
    const oy = 12; // 縦微調整（床の奥辺に沿わせる）
    const step = 1; // 何タイルおきに1枚
    const panels: ReactNode[] = [];
    // NE 壁（奥右）: (i,0) の NE 辺中点
    for (let i = 0; i < cols; i += step) {
      const mx = originX + i * (dW / 2) + 72;
      const my = originY + i * (dH / 2) + 45;
      panels.push(
        <img
          key={`wne-${i}`}
          src={`${SPRITE_BASE}/wall_window_ne.png`}
          alt=""
          width={pW}
          height={pH}
          style={{ position: 'absolute', left: mx - pW / 2, top: my - pH + oy, imageRendering: 'pixelated', zIndex: 0 }}
        />,
      );
    }
    // NW 壁（奥左）: (0,j) の NW 辺中点
    for (let j = 0; j < rows; j += step) {
      const mx = originX - j * (dW / 2) + 24;
      const my = originY + j * (dH / 2) + 45;
      panels.push(
        <img
          key={`wnw-${j}`}
          src={`${SPRITE_BASE}/wall_window_nw.png`}
          alt=""
          width={pW}
          height={pH}
          style={{ position: 'absolute', left: mx - pW / 2, top: my - pH + oy, imageRendering: 'pixelated', zIndex: 0 }}
        />,
      );
    }
    // 角の柱：2壁の窓が重なる繋ぎ目を隠す（窓枠色のフラットな柱）
    const cornerX = originX + dW / 2;
    panels.push(
      <div
        key="corner-post"
        style={{
          position: 'absolute',
          left: cornerX - 7,
          top: originY - 118,
          width: 14,
          height: 180,
          background: '#ecdcab',
          borderLeft: '2px solid #cdb878',
          borderRight: '3px solid #a98e50',
          zIndex: 1,
        }}
      />,
    );
    return <>{panels}</>;
  };

  return (
    <div
      className="office-view"
      style={{
        width: w,
        height: h,
        position: 'relative',
        imageRendering: 'pixelated',
        overflow: 'hidden',
      }}
    >
      {renderWalls()}
      {renderFloor()}
      {WORKSTATION_CELLS.map((c) => renderWorkstation(c.i, c.j))}
    </div>
  );
};
