import { useEffect, useRef, useState } from 'react';
import type { DevEmoteEvent } from '../core/devEmote';
import {
  chairSprite,
  laptopSprite,
  NATIVE_H,
  NATIVE_W,
  OFFICE_LAYOUT,
  officeBgSrc,
  PROP_TRANSFORMS,
  type SeatDir,
  sitFootOffset,
  sittingSprite,
  spriteFolderFor,
} from '../data/officeLayout';
import type { EmployeeRole } from '../state/types';
import { EmoteBubble } from './EmoteBubble';

/**
 * v0.32：開発（development フェーズ）の「実装中の様子」を、社員が机に座って働くオフィスシーンにする。
 * 企画会議（PlanMeetingBoard/MeetingScene）と対称で、背景 office_bg（native 1445×1088）の座席群に
 * 着席スプライト＋椅子＋ノートPC を重ね、頭上にエモート吹き出しを出す**純表示演出**。数値には影響しない。
 *
 * 座席合成の規約は OfficeView / PropEditorTool（/admin/props）と同一：
 *  - 基準は「座り足元」= seat.y + sitFootOffset(dir)。物体（PC・椅子）はその足元からの相対値（PROP_TRANSFORMS）。
 *  - z は席ごとに y 順（南=手前）。席内は laptop(奥) < キャラ < chair(手前)。
 *  - 表示幅は「実ピクセル×CHAR_SCALE」で決める（PixelLab 出力サイズを決め打ちしない）。
 */

const CHAR_SCALE = OFFICE_LAYOUT.charScale;

// パネルの見せ方（native 座標）。座席群がすべて収まる中心・高さ。/admin で微調整可能。
const FOCUS_CX = 858; // 座席群の中心 X（席 x=751..966）
const FOCUS_CY = 450; // 縦の中心。企画会議と同じズーム(≈0.52)では3列全部は入らないため、後列＋中列が
//                       きれいに収まる位置に。前列の足元は机に隠れるので多少切れて可。
// ズーム（native→表示の縮小率）は**固定**にする。パネル高さに追従させると、フェーズ間で
// パネル高さが数px違うだけでスケールと位置がズレて「開発とテストで見え方が違う」原因になる
// （オーナー指摘 2026-07-25）。定数にして全フェーズ・admin で同一の見え方に統一する。
const OFFICE_SCALE = 0.52;

/** 吹き出し枠の一辺（native px）。 */
const EMOTE_BUBBLE_SIZE = 52;
/**
 * 着席スプライトの実頭頂位置（キャンバス上端からの比率）。sitting/north.png の不透明開始行を実測すると
 * 33/124 ≒ 0.266（立ち絵 0.25 とほぼ同じ）。吹き出しはこの頭頂から EMOTE_HEAD_GAP だけ上に浮かせる。
 * 以前 0.18 にしていたため頭より上に離れて浮いていた（企画会議と同じ近さにする＝オーナー指摘 2026-07-24）。
 */
const HEAD_TOP_FRAC = 0.266;
const EMOTE_HEAD_GAP = 16;

/** 実ピクセルを計測してから scale する、着席物体1枚（bottom-center アンカー）。 */
function Prop({
  src,
  x,
  footY,
  scale,
  z,
}: {
  src: string;
  x: number;
  footY: number;
  scale: number;
  z: number;
}) {
  const [natural, setNatural] = useState<number | null>(null);
  const width = natural == null ? undefined : natural * scale;
  return (
    <img
      src={src}
      alt=""
      draggable={false}
      onLoad={(e) => setNatural(e.currentTarget.naturalWidth)}
      style={{
        position: 'absolute',
        left: x,
        top: footY,
        width,
        transform: 'translate(-50%, -100%)',
        zIndex: z,
        imageRendering: 'pixelated',
        visibility: width === undefined ? 'hidden' : 'visible',
        pointerEvents: 'none',
      }}
    />
  );
}

/** 1席ぶん：ノートPC(奥)＋着席キャラ(アイドル揺れ)＋椅子(手前)＋頭上エモート。 */
function SeatedCharacter({
  employee,
  seat,
  seatIndex,
  emote,
}: {
  employee: { id: string; role: EmployeeRole };
  seat: { x: number; y: number; dir: SeatDir };
  seatIndex: number;
  emote?: DevEmoteEvent | null;
}) {
  const folder = spriteFolderFor(employee);
  const dir = seat.dir;
  const footY = seat.y + sitFootOffset(dir);
  const baseZ = Math.round(seat.y);
  const laptopT = PROP_TRANSFORMS.laptop[dir];
  const chairT = PROP_TRANSFORMS.chair[dir];

  const [natural, setNatural] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    setNatural(null);
    const img = new Image();
    img.onload = () => {
      if (!cancelled) setNatural(img.naturalWidth);
    };
    img.src = sittingSprite(folder, dir);
    return () => {
      cancelled = true;
    };
  }, [folder, dir]);

  const charW = natural == null ? undefined : natural * CHAR_SCALE;
  const charSize = natural == null ? 0 : natural * CHAR_SCALE;
  // 頭上吹き出しの native 座標。spriteTop＝着席キャラのキャンバス上端。
  const spriteTop = footY - charSize;
  const headTop = spriteTop + charSize * HEAD_TOP_FRAC;
  const bubbleTop = headTop - EMOTE_BUBBLE_SIZE - EMOTE_HEAD_GAP;

  return (
    <>
      {/* ノートPC（キャラより奥） */}
      <Prop
        src={laptopSprite(dir)}
        x={seat.x + laptopT.x}
        footY={footY + laptopT.y}
        scale={laptopT.scale}
        z={baseZ + laptopT.z}
      />
      {/* 着席キャラ：bottom-center アンカーは外側ラッパーが持ち、アイドル揺れ(translateY)は内側 img に当てる
          （同じ要素でアンカー transform と揺れ transform を兼ねると衝突して中央寄せが消えるため役割分離）。 */}
      <div
        style={{
          position: 'absolute',
          left: seat.x,
          top: footY,
          width: charW,
          transform: 'translate(-50%, -100%)',
          zIndex: baseZ,
          visibility: charW === undefined ? 'hidden' : 'visible',
          pointerEvents: 'none',
        }}
      >
        <img
          className="desk-idle-bob"
          src={sittingSprite(folder, dir)}
          alt=""
          draggable={false}
          style={{
            display: 'block',
            width: '100%',
            imageRendering: 'pixelated',
            // 席ごとに揺れの位相をずらして全員が同期しないようにする
            animationDelay: `${(seatIndex % 4) * 0.4}s`,
          }}
        />
      </div>
      {/* 椅子（キャラより手前） */}
      <Prop
        src={chairSprite(dir)}
        x={seat.x + chairT.x}
        footY={footY + chairT.y}
        scale={chairT.scale}
        z={baseZ + chairT.z}
      />
      {/* 頭上エモート */}
      {emote && natural != null ? (
        <EmoteBubble
          animKey={emote.key}
          def={emote.def}
          x={seat.x}
          top={bubbleTop}
          size={EMOTE_BUBBLE_SIZE}
        />
      ) : null}
    </>
  );
}

/**
 * 開発フェーズの着席デスクシーン（パネル外枠）。背景シーン（native）を座席群にフォーカスして縮小表示。
 * 社員が居ないソロ開発時は、あなた（founder）を1席に座らせて空にしない。
 */
export const DevDeskScene = ({
  employees,
  emote = null,
}: {
  employees: { id: string; role: EmployeeRole }[];
  /** チケット文の完了/アンビエントで座席の社員頭上に出すエモート */
  emote?: DevEmoteEvent | null;
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelW, setPanelW] = useState(680);
  const [panelH, setPanelH] = useState(200);

  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setPanelW(el.clientWidth);
      setPanelH(el.clientHeight);
    });
    ro.observe(el);
    setPanelW(el.clientWidth);
    setPanelH(el.clientHeight);
    return () => ro.disconnect();
  }, []);

  const k = OFFICE_SCALE; // 固定ズーム（フェーズ間で見え方が変わらない）
  const tx = panelW / 2 - k * FOCUS_CX;
  const ty = panelH / 2 - k * FOCUS_CY;

  const seats = OFFICE_LAYOUT.seats;
  // 座席を社員で埋める。ソロ（社員0）でも空にしないため、最低1人（あなた＝programmer）を1席に座らせる。
  const cast: ({ id: string; role: EmployeeRole } | null)[] =
    employees.length > 0
      ? seats.map((_, i) => (i < employees.length ? employees[i] : null))
      : seats.map((_, i) => (i === 0 ? { id: 'you', role: 'programmer' } : null));

  return (
    <div
      ref={panelRef}
      style={{
        position: 'relative',
        height: '100%',
        width: '100%',
        minHeight: 0,
        overflow: 'hidden',
        border: '2px solid #2b3a1c',
        background: '#05080c',
        imageRendering: 'pixelated',
      }}
    >
      {/* ラベル */}
      <span
        style={{
          position: 'absolute',
          top: 4,
          left: 6,
          zIndex: 5,
          fontSize: 10,
          fontWeight: 700,
          color: '#a6e138',
          textShadow: '0 1px 2px #000',
        }}
      >
        {'</> '}実装中のオフィス
      </span>

      {/* 座席シーン（native）を transform で寄せて表示。 */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: NATIVE_W,
          height: NATIVE_H,
          transform: `translate(${tx}px, ${ty}px) scale(${k})`,
          transformOrigin: 'top left',
        }}
      >
        <img
          src={officeBgSrc}
          alt=""
          width={NATIVE_W}
          height={NATIVE_H}
          style={{ position: 'absolute', left: 0, top: 0, imageRendering: 'pixelated' }}
        />
        {seats.map((seat, i) =>
          cast[i] ? (
            <SeatedCharacter
              key={`seat-${i}`}
              employee={cast[i]}
              seat={seat}
              seatIndex={i}
              emote={emote && emote.seat === i ? emote : null}
            />
          ) : null,
        )}
      </div>
    </div>
  );
};
