import { describe, expect, it } from 'vitest';
import {
  cellPx,
  eachCell,
  footprintCenterOffset,
  makeGeometry,
  ROOM,
  wallEdgeOffset,
  wallSpanOffset,
} from './officeGeometry';

describe('makeGeometry', () => {
  const g = makeGeometry(8, 7);

  it('キャンバスサイズは cols×rows × cellPx', () => {
    expect(g.w).toBe(8 * cellPx);
    expect(g.h).toBe(7 * cellPx);
    expect(g.dW).toBe(cellPx);
    expect(g.dH).toBe(cellPx / 2);
  });

  it('+i は画面右下（x+48, y+24）、+j は画面左下（x-48, y+24）に進む', () => {
    const o = g.tileTopLeft(0, 0);
    expect(g.tileTopLeft(1, 0)).toEqual({ left: o.left + cellPx / 2, top: o.top + cellPx / 4 });
    expect(g.tileTopLeft(0, 1)).toEqual({ left: o.left - cellPx / 2, top: o.top + cellPx / 4 });
  });

  it('cellAnchor は tileTopLeft からセル中央下寄り（+48, +57.6）', () => {
    const t = g.tileTopLeft(2, 3);
    const a = g.cellAnchor(2, 3);
    expect(a.x).toBeCloseTo(t.left + cellPx / 2);
    expect(a.y).toBeCloseTo(t.top + cellPx * 0.6);
  });

  it('baseZ は奥（i+j 小）ほど小さい＝手前が上に描画される', () => {
    expect(g.baseZ(0, 0)).toBeLessThan(g.baseZ(1, 0));
    expect(g.baseZ(3, 2)).toBe(g.baseZ(2, 3)); // 同じ奥行きは同値
  });
});

describe('eachCell', () => {
  it('全セルを重複なく列挙する', () => {
    const cells = eachCell(8, 7);
    expect(cells).toHaveLength(56);
    const keys = new Set(cells.map((c) => `${c.i},${c.j}`));
    expect(keys.size).toBe(56);
  });

  it('奥→手前（i+j 昇順）で並ぶ', () => {
    const cells = eachCell(5, 4);
    for (let k = 1; k < cells.length; k++) {
      expect(cells[k].i + cells[k].j).toBeGreaterThanOrEqual(cells[k - 1].i + cells[k - 1].j);
    }
  });
});

describe('wall offsets', () => {
  it('wallEdgeOffset：NE は右上、NW は左上の辺中点', () => {
    expect(wallEdgeOffset('NE')).toEqual({ dx: cellPx / 4, dy: -cellPx / 8 });
    expect(wallEdgeOffset('NW')).toEqual({ dx: -cellPx / 4, dy: -cellPx / 8 });
  });

  it('wallSpanOffset：cells=1 は wallEdgeOffset と一致', () => {
    expect(wallSpanOffset('NE', 1)).toEqual(wallEdgeOffset('NE'));
    expect(wallSpanOffset('NW', 1)).toEqual(wallEdgeOffset('NW'));
  });

  it('wallSpanOffset：セル数分だけ辺方向へ中心がずれる', () => {
    const e = wallEdgeOffset('NE');
    const span3 = wallSpanOffset('NE', 3); // k = 1
    expect(span3.dx).toBeCloseTo(e.dx + cellPx / 2);
    expect(span3.dy).toBeCloseTo(e.dy + cellPx / 4);
  });
});

describe('footprintCenterOffset', () => {
  it('1×1 はオフセットなし', () => {
    expect(footprintCenterOffset(1, 1)).toEqual({ dx: 0, dy: 0 });
  });

  it('2×1 は i 軸方向へ半セル、1×2 は j 軸方向へ半セル', () => {
    expect(footprintCenterOffset(2, 1)).toEqual({ dx: cellPx / 4, dy: cellPx / 8 });
    expect(footprintCenterOffset(1, 2)).toEqual({ dx: -cellPx / 4, dy: cellPx / 8 });
  });
});

describe('ROOM', () => {
  it('規模が上がると床面積が単調に広がる', () => {
    const area = (s: keyof typeof ROOM) => ROOM[s].cols * ROOM[s].rows;
    expect(area('mini')).toBeLessThan(area('mobile'));
    expect(area('mobile')).toBeLessThan(area('indie'));
    expect(area('indie')).toBeLessThan(area('hit'));
    expect(area('hit')).toBeLessThan(area('aaa'));
  });
});
