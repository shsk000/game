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
