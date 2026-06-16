import { type ReactNode, useEffect, useState } from 'react';
import type { Scale } from '../data/scales';

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

/**
 * ワークステーションの重ね合わせ（WorkstationTuner で確定した値）。
 * 人は NW（背中こちら）向き → 椅子背を最前面(z最大)にして頭＋上背を覗かせる。
 * w=表示サイズ(正方), ox/oy=床アンカーからのオフセット, z=重なり順。
 */
const WS_LAYERS = [
  { img: 'desk.png', w: 140, ox: -6, oy: -22, z: 1 },
  { img: 'laptop.png', w: 66, ox: 10, oy: -99, z: 2 },
  { img: 'person_sit_nw.png', w: 198, ox: 33, oy: -10, z: 3 },
  { img: 'chair.png', w: 73, ox: 34, oy: -42, z: 4 },
];

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
    // セット全体の前後は (i+j) で決め、セット内の重なりは l.z で決める
    const baseZ = (i + j) * 10;
    return (
      <div key={`ws-${i}-${j}`}>
        {WS_LAYERS.map((l) => (
          <img
            key={l.img}
            src={`${SPRITE_BASE}/${l.img}`}
            alt=""
            width={l.w}
            height={l.w}
            style={{
              position: 'absolute',
              left: x + l.ox - l.w / 2,
              top: y + l.oy - l.w,
              imageRendering: 'pixelated',
              zIndex: baseZ + l.z,
              display: 'block',
            }}
          />
        ))}
      </div>
    );
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
      {renderFloor()}
      {WORKSTATION_CELLS.map((c) => renderWorkstation(c.i, c.j))}
    </div>
  );
};
