import { type ReactNode, useEffect, useState } from 'react';
import type { Scale } from '../data/scales';
import { cellPx, makeGeometry, ROOM, SPRITE_BASE, TILE } from '../lib/officeGeometry';
import { DEFAULT_DOOR, DEFAULT_WORKSTATIONS } from '../lib/officeLayout';
import { Workstation } from './Workstation';

/**
 * オフィスの床ビュー（v0.13）。
 * office-visual-design §2 準拠：視点はアイソメ 30°×30°（2:1 dimetric）。
 * ジオメトリ・ワークステーション描画は src/lib/officeGeometry + Workstation に一元化。
 * 配置（机/ドア）は src/lib/officeLayout のコード定数（=配信される確定レイアウト）。
 * 調整は OfficeLayoutTool(?layout) で行い、出力値を officeLayout.ts の DEFAULT_* に転記してコミットする。
 */

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
  /** 在籍社員数。席はこの数だけ埋まる（最大 = 席数）。未指定なら全席表示（ツール/プレビュー用）。 */
  employeeCount?: number;
  working?: boolean;
  deskId?: string;
  chairId?: string;
  monitorId?: string;
};

export const OfficeView = ({ scale, employeeCount }: Props) => {
  const floor = useSprite(`${SPRITE_BASE}/floor_iso.png`);
  const { cols, rows } = ROOM[scale] ?? ROOM.mini;
  const geo = makeGeometry(cols, rows);
  const { w, h, dW, originX, originY } = geo;
  // 配置（配信される確定レイアウト。officeLayout.ts のコード定数）
  // 在籍社員数だけ席を埋める（最大 = 席数）。employeeCount 未指定なら全席。
  const seatCount = employeeCount == null ? DEFAULT_WORKSTATIONS.length : Math.min(employeeCount, DEFAULT_WORKSTATIONS.length);
  const workstations = DEFAULT_WORKSTATIONS.slice(0, seatCount);
  const door = DEFAULT_DOOR;

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
        const { left, top } = geo.tileTopLeft(i, j);
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

  // 壁：床の菱形の奥2辺（NW・NE）に沿って窓パネルを並べる。
  const renderWalls = (): ReactNode => {
    const topOff = (11 / TILE) * cellPx; // 床タイルの透明上端（ひし形頂点まで）≈33
    const pW = 96;
    const pH = 160;
    const stepX = 68; // 横ステップ(px)：窓が桟を揃えて並ぶ値
    const sillOy = 24; // 窓台を床奥辺に乗せる縦微調整
    const Tx = originX + dW / 2;
    const Ty = originY + topOff;
    const panels: ReactNode[] = [];
    const neMaxX = originX + (cols - 1) * (dW / 2) + dW;
    let k = 0;
    for (let cx = Tx + 36; cx <= neMaxX; cx += stepX, k++) {
      const floorY = Ty + (cx - Tx) * 0.5;
      panels.push(
        <img
          key={`wne-${k}`}
          src={`${SPRITE_BASE}/wall_window_ne.png`}
          alt=""
          width={pW}
          height={pH}
          style={{ position: 'absolute', left: cx - pW / 2, top: floorY + sillOy - pH, imageRendering: 'pixelated', zIndex: 1 }}
        />,
      );
    }
    const nwMinX = originX - (rows - 1) * (dW / 2);
    let m = 0;
    for (let cx = Tx - 36; cx >= nwMinX; cx -= stepX, m++) {
      const floorY = Ty + (Tx - cx) * 0.5;
      panels.push(
        <img
          key={`wnw-${m}`}
          src={`${SPRITE_BASE}/wall_window_nw.png`}
          alt=""
          width={pW}
          height={pH}
          style={{ position: 'absolute', left: cx - pW / 2, top: floorY + sillOy - pH, imageRendering: 'pixelated', zIndex: 1 }}
        />,
      );
    }
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
      {workstations.map((c) => {
        const { x, y } = geo.cellAnchor(c.i, c.j);
        return (
          <Workstation key={`ws-${c.i}-${c.j}`} x={x} y={y} baseZ={geo.baseZ(c.i, c.j)} dir={c.dir} />
        );
      })}
      {(() => {
        const { x, y } = geo.cellAnchor(door.i, door.j);
        return (
          <img
            key="se-door"
            src={`${SPRITE_BASE}/${door.img}`}
            alt=""
            width={door.w}
            height={door.w}
            style={{
              position: 'absolute',
              left: x + door.ox - door.w / 2,
              top: y + door.oy - door.w,
              imageRendering: 'pixelated',
              zIndex: geo.baseZ(door.i, door.j) + 50,
            }}
          />
        );
      })()}
    </div>
  );
};
