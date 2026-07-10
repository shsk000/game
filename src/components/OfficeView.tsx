import { type ReactNode, useEffect, useState } from 'react';
import type { Scale } from '../data/scales';
import {
  cellPx,
  footprintCenterOffset,
  makeGeometry,
  ROOM,
  SPRITE_BASE,
} from '../lib/officeGeometry';
import {
  DEFAULT_DECOR_CATALOG,
  DEFAULT_DECOR_PLACEMENTS,
  DEFAULT_DOOR,
  DEFAULT_WALL_CATALOG,
  DEFAULT_WALL_PLACEMENTS,
  DEFAULT_WORKSTATIONS,
  decorGeom,
  decorImg,
  wallImg,
  wallOffset,
  wallSkewDeg,
} from '../lib/officeLayout';
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
  const { w, h } = geo;
  // 配置（配信される確定レイアウト。officeLayout.ts のコード定数）
  // 在籍社員数だけ席を埋める（最大 = 席数）。employeeCount 未指定なら全席。
  const seatCount =
    employeeCount == null
      ? DEFAULT_WORKSTATIONS.length
      : Math.min(employeeCount, DEFAULT_WORKSTATIONS.length);
  const workstations = DEFAULT_WORKSTATIONS.slice(0, seatCount);
  const door = DEFAULT_DOOR;
  const decorCatalog = DEFAULT_DECOR_CATALOG;
  const decorPlacements = DEFAULT_DECOR_PLACEMENTS;
  const wallCatalog = DEFAULT_WALL_CATALOG;
  const wallPlacements = DEFAULT_WALL_PLACEMENTS;

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
            style={{
              position: 'absolute',
              left,
              top,
              imageRendering: 'pixelated',
              display: 'block',
            }}
          />,
        );
      }
    }
    return tiles;
  };

  // 壁：配置（WallPlacement）駆動。向き SW/SE（鏡面）＋ 縦積み stack 段を上にリピート。
  const dW = cellPx;
  const dH = cellPx / 2;
  const renderWalls = (): ReactNode => {
    const panels: ReactNode[] = [];
    wallPlacements.forEach((p, idx) => {
      const item = wallCatalog.find((c) => c.id === p.catalogId);
      if (!item) return;
      const { x, y } = geo.cellAnchor(p.i, p.j);
      // SW=奥右辺, SE=奥左辺。SW は ox 符号反転（鏡面）。
      const edx = p.dir === 'SW' ? dW / 4 : -dW / 4;
      const edy = -dH / 4;
      const off = wallOffset(item, p.dir);
      const sdy = item.stackDy ?? 90;
      const base = geo.baseZ(p.i, p.j);
      for (let k = 0; k < (p.stack ?? 1); k++) {
        panels.push(
          <img
            key={`wall-${idx}-${k}`}
            src={`${SPRITE_BASE}/${wallImg(item.imgBase, p.dir)}`}
            alt=""
            width={item.w}
            height={item.h}
            style={{
              position: 'absolute',
              left: x + edx + off.ox - item.w / 2,
              top: y + edy + off.oy - item.h - k * sdy,
              imageRendering: 'pixelated',
              transform: item.rot ? `rotate(${item.rot}deg)` : undefined,
              zIndex: base + k,
            }}
          />,
        );
      }
    });
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
          <Workstation
            key={`ws-${c.i}-${c.j}`}
            x={x}
            y={y}
            baseZ={geo.baseZ(c.i, c.j)}
            dir={c.dir}
          />
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
      {decorPlacements.map((p, idx) => {
        const item = decorCatalog.find((c) => c.id === p.catalogId);
        if (!item) return null;
        const { x, y } = geo.cellAnchor(p.i, p.j);
        // 向きで実効ジオメトリを得る（SW は鏡映）。footprint 中心をアンカーに。
        const g = decorGeom(item, p.dir);
        const off = footprintCenterOffset(g.cw, g.ch);
        const cx = x + off.dx;
        const cy = y + off.dy;
        return (
          <img
            key={`decor-${p.catalogId}-${idx}`}
            src={`${SPRITE_BASE}/${decorImg(item.imgBase, p.dir)}`}
            alt=""
            width={item.w}
            height={item.w}
            style={{
              position: 'absolute',
              left: cx + g.ox - item.w / 2,
              top: cy + g.oy - item.w,
              imageRendering: 'pixelated',
              // 壁掛け（窓）は壁面 slope 0.5 へ skew して同一平面に載せる。
              transform: item.onWall ? `skewY(${wallSkewDeg(p.dir)}deg)` : undefined,
              // 壁掛けは壁の奥行き（壁パネルの上・手前の家具の背後）。それ以外は footprint 最前セル基準。
              zIndex: item.onWall
                ? geo.baseZ(p.i, p.j) + 2
                : geo.baseZ(p.i, p.j) + (g.cw + g.ch - 2) * 10 + 5,
            }}
          />
        );
      })}
    </div>
  );
};
