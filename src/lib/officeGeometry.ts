/**
 * オフィスのアイソメ床ジオメトリ（OfficeView と配置ツールで共有）。
 * office-visual-design §2 準拠：アイソメ 30°×30°（2:1 dimetric）。
 * 床は (i−j, i+j) 投影のひし形グリッド、部屋の輪郭は菱形（rhombus）。
 */

import type { Scale } from '../data/scales';

export const TILE = 32;
export const SCALE = 3;
export const cellPx = TILE * SCALE; // 96px
export const SPRITE_BASE = '/sprites/office';

/** 床グリッド（菱形フットプリント）の cols × rows。規模で広くなる。 */
export const ROOM: Record<Scale, { cols: number; rows: number }> = {
  mini: { cols: 8, rows: 7 },
  mobile: { cols: 11, rows: 7 },
  indie: { cols: 11, rows: 9 },
  hit: { cols: 14, rows: 9 },
  aaa: { cols: 14, rows: 11 },
};

export type Geometry = {
  cols: number;
  rows: number;
  w: number;
  h: number;
  dW: number;
  dH: number;
  originX: number;
  originY: number;
  /** タイル画像（cellPx 正方）の左上座標 */
  tileTopLeft: (i: number, j: number) => { left: number; top: number };
  /** セル(i,j)の床上アンカー（物を置く基準点） */
  cellAnchor: (i: number, j: number) => { x: number; y: number };
  /** セル(i,j)のセット内 z ベース */
  baseZ: (i: number, j: number) => number;
};

export function makeGeometry(cols: number, rows: number): Geometry {
  const w = cols * cellPx;
  const h = rows * cellPx;
  const dW = cellPx; // ひし形天面の横 96
  const dH = cellPx / 2; // 縦 48
  const spanX = (cols + rows - 2) * (dW / 2) + dW;
  const spanY = (cols + rows - 2) * (dH / 2) + dH;
  const originX = (w - spanX) / 2 + (rows - 1) * (dW / 2);
  const originY = (h - spanY) / 2;
  return {
    cols,
    rows,
    w,
    h,
    dW,
    dH,
    originX,
    originY,
    tileTopLeft: (i, j) => ({ left: originX + (i - j) * (dW / 2), top: originY + (i + j) * (dH / 2) }),
    cellAnchor: (i, j) => ({
      x: originX + (i - j) * (dW / 2) + cellPx / 2,
      y: originY + (i + j) * (dH / 2) + cellPx * 0.6,
    }),
    baseZ: (i, j) => (i + j) * 10,
  };
}

/** 全セルを奥→手前（i+j 昇順）で列挙 */
export function eachCell(cols: number, rows: number): { i: number; j: number }[] {
  const out: { i: number; j: number }[] = [];
  for (let s = 0; s <= cols + rows - 2; s++) {
    for (let i = 0; i < cols; i++) {
      const j = s - i;
      if (j < 0 || j >= rows) continue;
      out.push({ i, j });
    }
  }
  return out;
}

export type Dir = 'NW' | 'SE';
export type Placement = { i: number; j: number; dir: Dir };

/**
 * セル(i,j)の奥辺の中点（壁を立てる基準点）。cellAnchor からの相対で返す用に dx,dy。
 * NE辺＝菱形の上→右の中点（+dW/4, -dH/4）、NW辺＝上→左の中点（-dW/4, -dH/4）。
 */
export function wallEdgeOffset(dir: 'NE' | 'NW'): { dx: number; dy: number } {
  const dW = cellPx;
  const dH = cellPx / 2;
  return { dx: dir === 'NE' ? dW / 4 : -dW / 4, dy: -dH / 4 };
}

/**
 * cells セル分をまとめた壁の中心オフセット（先頭セル(i,j)のアンカーからの相対）。
 * 壁は辺方向に伸びる：NE辺＝+i方向(+dW/2,+dH/2 ステップ)、NW辺＝+j方向(-dW/2,+dH/2 ステップ)。
 * cells=1 は wallEdgeOffset と同じ（単セルの辺中点）。
 */
export function wallSpanOffset(dir: 'NE' | 'NW', cells: number): { dx: number; dy: number } {
  const dW = cellPx;
  const dH = cellPx / 2;
  const e = wallEdgeOffset(dir);
  const stepX = dir === 'NE' ? dW / 2 : -dW / 2;
  const k = (cells - 1) / 2;
  return { dx: e.dx + k * stepX, dy: e.dy + k * (dH / 2) };
}

/**
 * footprint（cw×ch マス）の中心アンカーのオフセット。先頭セル(i,j)から footprint 中心までの (dx,dy)。
 * i軸（+i, 画面 右下↘）= +dW/2,+dH/2 ステップ。j軸（+j, 画面 左下↙）= -dW/2,+dH/2 ステップ。
 */
export function footprintCenterOffset(cw: number, ch: number): { dx: number; dy: number } {
  const hi = (cw - 1) / 2; // i軸の中心まで
  const hj = (ch - 1) / 2; // j軸の中心まで
  const dW = cellPx;
  const dH = cellPx / 2;
  return {
    dx: hi * (dW / 2) + hj * (-dW / 2),
    dy: hi * (dH / 2) + hj * (dH / 2),
  };
}
