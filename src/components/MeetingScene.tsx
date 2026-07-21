import { useEffect, useMemo, useState } from 'react';
import {
  type MeetingSpot,
  NOTE_COLORS,
  WHITEBOARD_BOARD_RECT,
  WHITEBOARD_MEETING_SPOTS,
} from '../data/meetingScene';
import {
  NATIVE_H,
  NATIVE_W,
  OFFICE_LAYOUT,
  officeBgSrc,
  spriteFolderFor,
  standingSprite,
} from '../data/officeLayout';
import type { EmployeeRole } from '../state/types';
import {
  buildOccluderLookup,
  type OccluderLookup,
  OccluderMask,
  renderBandedSprite,
} from './bandedSprite';

/**
 * v0.26 B：オフィス背景のホワイトボードを社員が取り囲む「会議シーン」。
 *
 * OfficeView（歩行）と同じ座標系・遮蔽（OccluderMask＋renderBandedSprite）で、
 * WHITEBOARD_MEETING_SPOTS の各地点に立ち絵を1枚ずつ置く。背景 1枚絵の上に重ねるだけの純表示。
 * /admin/meeting のプレビューで配置を確認・調整し、企画フェーズなどに流用する。
 */

const CHAR_SCALE = OFFICE_LAYOUT.charScale;

type Rect = [number, number, number, number];

/**
 * ホワイトボード白面に貼るアイデア付箋。付箋は **rect の内側グリッドに収める**（枠外へ突き抜けない）。
 * native 座標の絶対配置なので、positioned なネイティブ座標コンテナの子として置くこと。
 * rect を大きくすれば付箋も大きく（＝文字が読みやすく）なる。
 */
export function WhiteboardNotes({
  cards,
  rect = WHITEBOARD_BOARD_RECT,
}: {
  cards: string[];
  rect?: Rect;
}) {
  const [bx, by, bw, bh] = rect;
  const cols = 3;
  const rows = Math.max(1, Math.ceil(cards.length / cols));
  const gap = 5;
  const cellW = bw / cols;
  // 行高は一定（枚数が少なくても付箋が縦に伸びない）。行数が多いときだけ縮める。
  const rowH = Math.min(34, bh / rows);
  const startY = by + Math.max(0, (bh - rows * rowH) / 2); // 縦中央寄せ
  const noteW = Math.max(16, cellW - gap);
  const noteH = Math.max(12, rowH - gap);
  const fontSize = Math.max(7, Math.min(13, Math.round(noteH * 0.55)));
  return (
    <>
      {cards.map((c, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const cx = bx + (col + 0.5) * cellW; // セル中心（rect 内に必ず収まる）
        const cy = startY + (row + 0.5) * rowH;
        const rot = i % 2 === 0 ? -3 : 3;
        // 位置は左上角を left/top で直接指定する。中央寄せを transform に頼ると
        // 内側の .dev-stat-pop（scale アニメ）が transform を上書きして中央寄せが消え、
        // 付箋が幅の半分だけ右下へずれて枠外へ突き抜ける（実際に起きた）。
        return (
          <span
            key={`${i}-${c}`}
            style={{
              position: 'absolute',
              left: cx - noteW / 2,
              top: cy - noteH / 2,
              width: noteW,
              height: noteH,
              transform: `rotate(${rot}deg)`,
              zIndex: 50000,
            }}
          >
            <span
              className="dev-stat-pop"
              style={{
                display: 'block',
                width: '100%',
                height: '100%',
                background: NOTE_COLORS[i % NOTE_COLORS.length],
                color: '#241d0e',
                fontSize,
                fontWeight: 700,
                lineHeight: `${noteH}px`,
                textAlign: 'center',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                boxShadow: '1px 2px 0 rgba(0,0,0,0.4)',
                boxSizing: 'border-box',
              }}
            >
              {c}
            </span>
          </span>
        );
      })}
    </>
  );
}

/** 立ち絵1枚を会議スポットに描く。実ピクセルを計測してから scale する（PixelLab 出力サイズを決め打ちしない）。 */
function MeetingCharacter({
  employee,
  spot,
  spotIndex,
  occluderLookup,
}: {
  employee: { id: string; role: EmployeeRole };
  spot: MeetingSpot;
  spotIndex: number;
  occluderLookup: OccluderLookup;
}) {
  const folder = spriteFolderFor(employee);
  const [natural, setNatural] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setNatural(null);
    const img = new Image();
    img.onload = () => {
      if (!cancelled) setNatural(img.naturalWidth);
    };
    img.src = standingSprite(folder, spot.dir);
    return () => {
      cancelled = true;
    };
  }, [folder, spot.dir]);

  if (natural == null) return null;
  const charSize = natural * CHAR_SCALE;
  return (
    <>
      {renderBandedSprite(
        `${employee.id}-meet-${spotIndex}`,
        spot.x,
        spot.y,
        OFFICE_LAYOUT.footOffsets.stand,
        charSize,
        charSize,
        standingSprite(folder, spot.dir),
        0,
        charSize,
        occluderLookup,
      )}
    </>
  );
}

/**
 * 会議シーン全体。背景ネイティブサイズ（NATIVE_W×NATIVE_H）の div を返す。
 * 呼び出し側（OfficeScreen 相当 / admin プレビュー）が stageScale で 1280×720 等に縮小する。
 */
export const MeetingScene = ({
  employees,
  spots = WHITEBOARD_MEETING_SPOTS,
}: {
  employees: { id: string; role: EmployeeRole }[];
  spots?: MeetingSpot[];
}) => {
  const occluderLookup = useMemo(() => buildOccluderLookup(OFFICE_LAYOUT.occluders), []);
  return (
    <div
      className="meeting-scene"
      style={{ position: 'relative', width: NATIVE_W, height: NATIVE_H, overflow: 'hidden' }}
    >
      <img
        src={officeBgSrc}
        alt=""
        width={NATIVE_W}
        height={NATIVE_H}
        style={{ position: 'absolute', left: 0, top: 0, imageRendering: 'pixelated' }}
      />
      {OFFICE_LAYOUT.occluders.map((o) => (
        <OccluderMask key={`${o.baseline}-${o.cells[0]}`} cells={o.cells} bgSrc={officeBgSrc} />
      ))}
      {spots.map((spot, i) =>
        employees[i] ? (
          <MeetingCharacter
            key={`spot-${i}`}
            employee={employees[i]}
            spot={spot}
            spotIndex={i}
            occluderLookup={occluderLookup}
          />
        ) : null,
      )}
    </div>
  );
};
