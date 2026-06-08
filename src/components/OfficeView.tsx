import { useEffect, useState } from 'react';
import { CHAIRS, DEFAULT_EQUIPMENT, DESKS, EQUIPMENT_BY_ID, MONITORS } from '../data/equipment';
import type { Scale } from '../data/scales';
import { SpriteAnimation } from './SpriteAnimation';

/**
 * オフィスの見下ろしビュー（v5：office-visual-design SKILL 準拠）。
 *
 * 仕様：
 * - カメラは南から ~35° 後傾（オブリーク 3/4）
 * - 全員 south 向き（Game Dev Story 慣習）
 * - ワークステーションは「モニター→机→人→椅子」の単一構成
 * - グリッド拡張で部屋サイズUP（mini 2×2 → mobile 3×2 → ... → aaa 4×4）
 *
 * z-order: 床 < 机 < モニター < 人 < 椅子背（手前）
 */

type LayoutDef = {
  /** グリッド：列数 × 行数 */
  cols: number;
  rows: number;
  gridW: number; // 全体セル幅（壁含む）
  gridH: number; // 全体セル高（壁含む）
  wallTopH: number;
  wallSideW: number;
  roomLabel: string;
  decor: { col: number; row: number; type: 'window' | 'plant'; w?: number; h?: number }[];
};

const LAYOUTS: Record<Scale, LayoutDef> = {
  mini: {
    cols: 2,
    rows: 2,
    // 壁1 + 2.5*2(ステーション) + 1余白 = 8幅, 1壁+2.5*2+1余白 = 7高
    gridW: 8,
    gridH: 7,
    wallTopH: 1,
    wallSideW: 1,
    roomLabel: '自宅アパート',
    decor: [
      { col: 3, row: 0, type: 'window', w: 2, h: 1 },
      { col: 6.5, row: 5.5, type: 'plant' },
    ],
  },
  mobile: {
    cols: 3,
    rows: 2,
    gridW: 11,
    gridH: 7,
    wallTopH: 1,
    wallSideW: 1,
    roomLabel: '小オフィス',
    decor: [
      { col: 1.5, row: 0, type: 'window', w: 2, h: 1 },
      { col: 7.5, row: 0, type: 'window', w: 2, h: 1 },
      { col: 9.5, row: 5.5, type: 'plant' },
    ],
  },
  indie: {
    cols: 3,
    rows: 3,
    gridW: 11,
    gridH: 9,
    wallTopH: 1,
    wallSideW: 1,
    roomLabel: 'スタジオ',
    decor: [
      { col: 1.5, row: 0, type: 'window', w: 2, h: 1 },
      { col: 4.5, row: 0, type: 'window', w: 2, h: 1 },
      { col: 7.5, row: 0, type: 'window', w: 2, h: 1 },
      { col: 9.5, row: 7.5, type: 'plant' },
    ],
  },
  hit: {
    cols: 4,
    rows: 3,
    gridW: 14,
    gridH: 9,
    wallTopH: 1,
    wallSideW: 1,
    roomLabel: '中堅企業',
    decor: [
      { col: 1.5, row: 0, type: 'window', w: 2, h: 1 },
      { col: 5, row: 0, type: 'window', w: 2, h: 1 },
      { col: 8.5, row: 0, type: 'window', w: 2, h: 1 },
      { col: 12, row: 0, type: 'window', w: 2, h: 1 },
      { col: 12.5, row: 7.5, type: 'plant' },
    ],
  },
  aaa: {
    cols: 4,
    rows: 4,
    gridW: 14,
    gridH: 11,
    wallTopH: 1,
    wallSideW: 1,
    roomLabel: '大手',
    decor: [
      { col: 1.5, row: 0, type: 'window', w: 2, h: 1 },
      { col: 5, row: 0, type: 'window', w: 2, h: 1 },
      { col: 8.5, row: 0, type: 'window', w: 2, h: 1 },
      { col: 12, row: 0, type: 'window', w: 2, h: 1 },
      { col: 12.5, row: 9.5, type: 'plant' },
    ],
  },
};

const TILE = 32;
const SCALE = 3;
const cellPx = TILE * SCALE; // 96px
const SPRITE_BASE = '/sprites/office';

/** 1ステーションのセル単位サイズ */
const STATION_W_CELLS = 2; // 横2セル = 192px
const STATION_H_CELLS = 2.5; // 縦2.5セル = 240px

/** スプライト存在キャッシュ */
const spriteCache = new Map<string, boolean>();
const checkSprite = async (path: string): Promise<boolean> => {
  if (spriteCache.has(path)) return spriteCache.get(path) ?? false;
  try {
    const res = await fetch(path, { method: 'HEAD' });
    const ok = res.ok;
    spriteCache.set(path, ok);
    return ok;
  } catch {
    spriteCache.set(path, false);
    return false;
  }
};

type LayerSprite = { loaded: boolean; path: string | null };
const useSprite = (path: string): LayerSprite => {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    checkSprite(path).then(setLoaded);
  }, [path]);
  return { loaded, path: loaded ? path : null };
};

type Props = {
  scale: Scale;
  employeeCount: number;
  working?: boolean;
  deskId?: string;
  chairId?: string;
  monitorId?: string;
};

export const OfficeView = ({
  scale,
  employeeCount,
  working = false,
  deskId = DEFAULT_EQUIPMENT.deskId,
  chairId = DEFAULT_EQUIPMENT.chairId,
  monitorId = DEFAULT_EQUIPMENT.monitorId,
}: Props) => {
  const layout = LAYOUTS[scale];
  const deskDef = EQUIPMENT_BY_ID[deskId] ?? DESKS[0];
  const chairDef = EQUIPMENT_BY_ID[chairId] ?? CHAIRS[0];
  const monitorDef = EQUIPMENT_BY_ID[monitorId] ?? MONITORS[0];

  const floor = useSprite(`${SPRITE_BASE}/floor_wood.png`);
  const desk = useSprite(deskDef.sprite);
  const chair = useSprite(chairDef.sprite);
  const monitor = useSprite(monitorDef.sprite);
  const windowSprite = useSprite(`${SPRITE_BASE}/window.png`);
  const plantSprite = useSprite(`${SPRITE_BASE}/plant.png`);

  // ワークステーションのスポット座標を計算（2D グリッド・隙間なし配置）
  const stations: { col: number; row: number }[] = [];
  const startCol = 1; // 左壁の隣
  const startRow = 1; // 上壁の下
  for (let r = 0; r < layout.rows; r++) {
    for (let c = 0; c < layout.cols; c++) {
      stations.push({
        col: startCol + c * STATION_W_CELLS,
        row: startRow + r * STATION_H_CELLS,
      });
    }
  }

  const w = layout.gridW * cellPx;
  const h = layout.gridH * cellPx;
  const wallH = layout.wallTopH * cellPx;
  const sideW = layout.wallSideW * cellPx;

  const workersToShow = Math.min(employeeCount, stations.length);

  // 部屋枠（床・壁）
  const renderRoom = () => (
    <>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: floor.loaded
            ? `url("${floor.path}") repeat`
            : 'repeating-conic-gradient(#3a2a1e 0% 25%, #4a3826 0% 50%) 50% / 16px 16px',
          backgroundSize: floor.loaded ? `${cellPx}px ${cellPx}px` : undefined,
          imageRendering: 'pixelated',
          zIndex: 0,
        }}
      />
      {/* 北壁（壁紙＋幅木） */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: w,
          height: wallH,
          background:
            'linear-gradient(to bottom, #f5e8c8 0%, #e8d8b0 85%, #6b4f3a 85%, #6b4f3a 100%)',
          borderBottom: '2px solid #2c1f15',
          zIndex: 1,
        }}
      />
      {/* 西壁 */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: wallH,
          width: sideW * 0.5,
          height: h - wallH,
          background: 'linear-gradient(to right, #1a1208 0%, #2c1f15 100%)',
          zIndex: 1,
        }}
      />
      {/* 東壁 */}
      <div
        style={{
          position: 'absolute',
          right: 0,
          top: wallH,
          width: sideW * 0.5,
          height: h - wallH,
          background: 'linear-gradient(to left, #1a1208 0%, #2c1f15 100%)',
          zIndex: 1,
        }}
      />
    </>
  );

  // 装飾配置
  const renderDecor = (
    d: { col: number; row: number; type: 'window' | 'plant'; w?: number; h?: number },
    idx: number,
  ) => {
    const x = d.col * cellPx;
    const y = d.row * cellPx;
    const dw = (d.w ?? 1) * cellPx;
    const dh = (d.h ?? 1) * cellPx;
    const path = d.type === 'window' ? windowSprite.path : plantSprite.path;
    const loaded = d.type === 'window' ? windowSprite.loaded : plantSprite.loaded;
    return (
      <div
        key={`decor-${idx}`}
        style={{
          position: 'absolute',
          left: x,
          top: y,
          width: dw,
          height: dh,
          zIndex: d.type === 'window' ? 2 : 3,
        }}
      >
        {loaded ? (
          <img
            src={path ?? ''}
            alt=""
            width={dw}
            height={dh}
            style={{ imageRendering: 'pixelated', display: 'block' }}
          />
        ) : (
          <div style={{ fontSize: dw * 0.7, textAlign: 'center' }}>
            {d.type === 'window' ? '🪟' : '🪴'}
          </div>
        )}
      </div>
    );
  };

  /**
   * ワークステーション 1セット描画（全員 south 向き共通）。
   *
   * 縦配置（上→下）：
   *   y=0       机の北端
   *   y=0.1     モニター（机上で立ち上がる）
   *   y=0.85    机の南端
   *   y=0.7     人の頭（机の南エッジに被る）
   *   y=1.6     人の腰
   *   y=1.1     椅子の上端（人の腰あたりから手前に立ち上がる）
   *   y=2.4     椅子の下端
   *
   * z-order: 机(1) < モニター(2) < 人(3) < 椅子(4)
   */
  const renderStation = (
    station: { col: number; row: number },
    idx: number,
    hasWorker: boolean,
  ) => {
    const baseX = station.col * cellPx;
    const baseY = station.row * cellPx;

    // §5-2 office-visual-design 確定サイズ
    const deskW = STATION_W_CELLS * cellPx; // 192px
    const deskH = cellPx * 0.85; // 82px
    const monitorSize = cellPx * 0.6; // 58px
    const workerSize = cellPx * 1.4; // 134px
    const chairSize = cellPx * 1.0; // 96px

    // §7-1 office-visual-design の縦配置目安に従う
    const yDesk = 0; // 北端起点
    const yMonitor = cellPx * 0.15; // 机上の少し南寄り
    const yWorker = cellPx * 0.7; // 机の南エッジに被る位置（人の上半身が机にかぶる）
    const yChair = cellPx * 1.2; // 人の腰下に椅子背が立ち上がる

    // §6-1 全員 south 向き
    const sitSheet = `${SPRITE_BASE}/worker_sit_south.png`;
    const typingSheet = `${SPRITE_BASE}/worker_typing_south.png`;
    const charSheet = working ? typingSheet : sitSheet;
    const charFrames = working ? 9 : 7;
    const charFps = working ? 12 : 5;

    return (
      <div
        key={`station-${idx}`}
        style={{
          position: 'absolute',
          left: baseX,
          top: baseY,
          width: deskW,
          height: STATION_H_CELLS * cellPx,
        }}
      >
        {/* z=1 机 */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: yDesk,
            width: deskW,
            height: deskH,
            zIndex: 1,
          }}
        >
          {desk.loaded ? (
            <img
              src={desk.path ?? ''}
              alt=""
              width={deskW}
              height={deskH}
              style={{ imageRendering: 'pixelated', display: 'block' }}
            />
          ) : (
            <div
              style={{
                width: deskW,
                height: deskH,
                background: '#dcdcdc',
                border: '2px solid #2c1f15',
                borderRadius: 4,
              }}
            />
          )}
        </div>

        {/* z=2 モニター（机に乗る） */}
        <div
          style={{
            position: 'absolute',
            left: (deskW - monitorSize) / 2,
            top: yMonitor,
            width: monitorSize,
            height: monitorSize,
            zIndex: 2,
          }}
        >
          {monitor.loaded ? (
            <img
              src={monitor.path ?? ''}
              alt=""
              width={monitorSize}
              height={monitorSize}
              style={{ imageRendering: 'pixelated', display: 'block' }}
            />
          ) : (
            <div style={{ fontSize: monitorSize * 0.7, textAlign: 'center' }}>🖥️</div>
          )}
        </div>

        {/* z=3 人（机の南エッジに被って座っているように見せる） */}
        {hasWorker && (
          <div
            style={{
              position: 'absolute',
              left: (deskW - workerSize) / 2,
              top: yWorker,
              width: workerSize,
              height: workerSize,
              zIndex: 3,
            }}
          >
            <SpriteAnimation
              sheet={charSheet}
              frames={charFrames}
              fps={charFps}
              frameSize={48}
              scale={workerSize / 48}
              fallback={<div style={{ fontSize: workerSize * 0.7, textAlign: 'center' }}>🧑‍💻</div>}
            />
          </div>
        )}

        {/* z=4 椅子（人の手前下に立ち上がる、座っている感を出す） */}
        <div
          style={{
            position: 'absolute',
            left: (deskW - chairSize) / 2,
            top: yChair,
            width: chairSize,
            height: chairSize,
            zIndex: 4,
          }}
        >
          {chair.loaded ? (
            <img
              src={chair.path ?? ''}
              alt=""
              width={chairSize}
              height={chairSize}
              style={{ imageRendering: 'pixelated', display: 'block' }}
            />
          ) : (
            <div style={{ fontSize: chairSize * 0.7, textAlign: 'center' }}>💺</div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      className="office-view"
      style={{
        width: w,
        height: h,
        imageRendering: 'pixelated',
        position: 'relative',
        border: '3px solid #1a0f08',
        borderRadius: 4,
        overflow: 'hidden',
        boxShadow: 'inset 0 0 24px rgba(0,0,0,0.4)',
      }}
    >
      {renderRoom()}
      {layout.decor.map(renderDecor)}
      {stations.map((s, idx) => renderStation(s, idx, idx < workersToShow))}
    </div>
  );
};
