import { describe, expect, it } from 'vitest';
import {
  MAX_EMPLOYEES,
  NATIVE_H,
  NATIVE_W,
  OFFICE_LAYOUT,
  chairSprite,
  isWalkable,
  laptopSprite,
  sitFootOffset,
  sittingSprite,
  spriteFolderFor,
  standingSprite,
  vectorToDir8,
  walkSheet,
} from './officeLayout';

describe('officeLayout data', () => {
  it('MAX_EMPLOYEES は座席データの件数と一致する', () => {
    expect(MAX_EMPLOYEES).toBe(OFFICE_LAYOUT.seats.length);
    expect(MAX_EMPLOYEES).toBeGreaterThan(0);
  });

  it('全座席が歩行グリッドに隣接している（配置ツールの機械チェック済みデータ）', () => {
    const cell = OFFICE_LAYOUT.grid.cell;
    const walkable = new Set(OFFICE_LAYOUT.grid.walkable);
    for (const seat of OFFICE_LAYOUT.seats) {
      const i = Math.floor(seat.x / cell);
      const j = Math.floor(seat.y / cell);
      let adjacent = false;
      for (let di = -1; di <= 1 && !adjacent; di++) {
        for (let dj = -1; dj <= 1 && !adjacent; dj++) {
          if (walkable.has(`${i + di},${j + dj}`)) adjacent = true;
        }
      }
      expect(adjacent).toBe(true);
    }
  });

  it('遮蔽物のセルは物体間で重複しない', () => {
    const seen = new Map<string, number>();
    OFFICE_LAYOUT.occluders.forEach((o, idx) => {
      for (const cell of o.cells) {
        expect(seen.has(cell)).toBe(false);
        seen.set(cell, idx);
      }
    });
  });
});

describe('sitFootOffset', () => {
  it('south/north それぞれの足元オフセットを返す', () => {
    expect(sitFootOffset('south')).toBe(OFFICE_LAYOUT.footOffsets.sitSouth);
    expect(sitFootOffset('north')).toBe(OFFICE_LAYOUT.footOffsets.sitNorth);
  });
});

describe('spriteFolderFor', () => {
  it('役職ごとに正しいフォルダ系列を返す（男女は id で決定論的）', () => {
    const roles = ['programmer', 'designer', 'pr'] as const;
    const expectedFolders: Record<(typeof roles)[number], string[]> = {
      programmer: ['engineer', 'programmer_f'],
      designer: ['designer_m', 'designer_f'],
      pr: ['pr_m', 'pr_f'],
    };
    for (const role of roles) {
      const folder = spriteFolderFor({ id: 'employee-1', role });
      expect(expectedFolders[role]).toContain(folder);
    }
  });

  it('同じ id は常に同じ性別（見た目）になる', () => {
    const a = spriteFolderFor({ id: 'stable-id-42', role: 'programmer' });
    const b = spriteFolderFor({ id: 'stable-id-42', role: 'programmer' });
    expect(a).toBe(b);
  });

  it('id が違えば男女どちらも出現しうる（偏りなく分布する）', () => {
    const folders = new Set(
      Array.from({ length: 20 }, (_, i) => spriteFolderFor({ id: `e-${i}`, role: 'designer' })),
    );
    expect(folders.has('designer_m')).toBe(true);
    expect(folders.has('designer_f')).toBe(true);
  });
});

describe('sprite path helpers', () => {
  it('着席・椅子・PC のパスを組み立てる', () => {
    expect(sittingSprite('engineer', 'south')).toBe('/sprites/office/engineer/sitting/south.png');
    expect(chairSprite('north')).toBe('/sprites/office/chair_north.png');
    expect(laptopSprite('south')).toBe('/sprites/office/laptop_south.png');
  });

  it('立ち絵・歩行シートのパスを組み立てる', () => {
    expect(standingSprite('engineer', 'south')).toBe(
      '/sprites/office/engineer/rotations/south.png',
    );
    expect(walkSheet('pr_f', 'north-west')).toBe('/sprites/office/pr_f/walk_north-west.png');
  });
});

describe('isWalkable', () => {
  it('データ上の歩行セルの中心点は歩ける', () => {
    const cell = OFFICE_LAYOUT.grid.cell;
    const [i, j] = OFFICE_LAYOUT.grid.walkable[0].split(',').map(Number);
    expect(isWalkable(i * cell + cell / 2, j * cell + cell / 2)).toBe(true);
  });

  it('背景の外側は歩けない', () => {
    expect(isWalkable(-10, 100)).toBe(false);
    expect(isWalkable(100, -10)).toBe(false);
    expect(isWalkable(NATIVE_W + 10, 100)).toBe(false);
    expect(isWalkable(100, NATIVE_H + 10)).toBe(false);
  });

  it('歩行セルとして登録されていない座標は歩けない', () => {
    // 背景左上の壁の外（原点付近）は歩行データに含まれない
    expect(isWalkable(5, 5)).toBe(false);
  });
});

describe('vectorToDir8', () => {
  it('4方向の入力を正しい向きに量子化する', () => {
    expect(vectorToDir8(1, 0)).toBe('east');
    expect(vectorToDir8(-1, 0)).toBe('west');
    expect(vectorToDir8(0, 1)).toBe('south');
    expect(vectorToDir8(0, -1)).toBe('north');
  });

  it('斜め4方向の入力を正しい向きに量子化する', () => {
    expect(vectorToDir8(1, 1)).toBe('south-east');
    expect(vectorToDir8(1, -1)).toBe('north-east');
    expect(vectorToDir8(-1, 1)).toBe('south-west');
    expect(vectorToDir8(-1, -1)).toBe('north-west');
  });
});
