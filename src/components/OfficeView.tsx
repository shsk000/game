import { useMemo, useState } from 'react';
import {
  chairSprite,
  laptopSprite,
  NATIVE_H,
  NATIVE_W,
  OFFICE_LAYOUT,
  officeBgSrc,
  PROP_TRANSFORMS,
  sitFootOffset,
  sittingSprite,
  spriteFolderFor,
} from '../data/officeLayout';
import type { Employee } from '../state/types';
import {
  buildOccluderLookup,
  type OccluderLookup,
  OccluderMask,
  renderBandedSprite,
} from './bandedSprite';

/**
 * オフィスの床ビュー（v0.19・正面向き素材）。
 * 世界観・座標系・素材規約は docs/v17/notes/office-front-facing-plan.md を参照。
 *
 * 背景は 1 枚絵（office_bg.png、机・壁・床・装飾を内蔵）。座標はすべて背景のネイティブ座標
 * （NATIVE_W×NATIVE_H）。表示コンポーネントはこの div をネイティブサイズのまま返し、
 * 呼び出し側（OfficeScreen）が既存の stageScale ロジックで 1280×720 に収まるよう縮小する。
 *
 * 座席（OFFICE_LAYOUT.seats）は「机の南側・北向き（背中が見える）」で確定。
 * 空席には机だけが背景として見える（社員なし＝椅子・PC・人を描画しないだけ）。
 * レイアウト調整は office-layout-tool.html で行い、出力 JSON を
 * src/data/officeLayoutData.json に転記する。
 */

type Props = {
  /** 在籍社員。座席数ぶんだけ手前から着席させる（未指定なら誰も座らない）。 */
  employees?: Employee[];
};

export const OfficeView = ({ employees = [] }: Props) => {
  const seated = employees.slice(0, OFFICE_LAYOUT.seats.length);
  // 背景の家具（机・ソファ等）に手前を横切られた時に隠れるための遮蔽物。データは
  // officeLayoutData.json（配置ツール④で作成）。レイアウトは不変なので一度だけ構築する。
  const occluderLookup = useMemo(() => buildOccluderLookup(OFFICE_LAYOUT.occluders), []);

  return (
    <div
      className="office-view"
      style={{
        position: 'relative',
        width: NATIVE_W,
        height: NATIVE_H,
        overflow: 'hidden',
      }}
    >
      <img
        src={officeBgSrc}
        alt=""
        width={NATIVE_W}
        height={NATIVE_H}
        style={{ position: 'absolute', left: 0, top: 0, imageRendering: 'pixelated' }}
      />
      {/* 家具の画素を baseline の z で描き直す。これが無いと帯の z を下げても背景（最背面の1枚絵）
          より手前のままで何にも隠されない。renderBandedSprite と必ず対で使う。 */}
      {OFFICE_LAYOUT.occluders.map((o) => (
        <OccluderMask key={`${o.baseline}-${o.cells[0]}`} cells={o.cells} bgSrc={officeBgSrc} />
      ))}
      {seated.map((employee, idx) => (
        <SeatedEmployee
          key={employee.id}
          employee={employee}
          seat={OFFICE_LAYOUT.seats[idx]}
          occluderLookup={occluderLookup}
        />
      ))}
    </div>
  );
};

const CHAR_SCALE = OFFICE_LAYOUT.charScale;

/**
 * 遮蔽物を考慮して1枚のスプライトを描く。
 *
 * PixelLab 出力は要求サイズより大きいキャンバス（余白込み）で返るため、表示サイズは
 * 「実ピクセル数 × scale」で決める必要がある（固定値の決め打ち厳禁）。まず不可視の img で
 * naturalWidth/Height を実測し、確定してから帯分割して描く。
 *
 * 帯分割（部分遮蔽）の本体は bandedSprite.tsx。配置ツール⑤検証と同じ実装を共有していて、
 * 「検証ページの見え方＝本番の見え方」になる。
 */
function BandedSprite({
  spriteKey,
  src,
  x,
  trueFootY,
  marginNative,
  z,
  scale,
  occluderLookup,
}: {
  spriteKey: string;
  src: string;
  x: number;
  /** 接地点のワールドY。遮蔽物の baseline と比較して前後を決める。 */
  trueFootY: number;
  /** 接地点より下のキャンバス余白。 */
  marginNative: number;
  /** 遮蔽されない帯の z（同じ座席内の重ね順を決め打ちするため明示する）。 */
  z: number;
  scale: number;
  occluderLookup: OccluderLookup;
}) {
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);

  if (!natural) {
    // 実測用。読み込み前に等倍サイズがちらつかないよう不可視で置く。
    return (
      <img
        src={src}
        alt=""
        style={{ position: 'absolute', width: 0, height: 0, opacity: 0 }}
        onLoad={(e) =>
          setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })
        }
      />
    );
  }
  const width = natural.w * scale;
  const height = natural.h * scale;
  return (
    <>
      {renderBandedSprite(
        spriteKey,
        x,
        trueFootY,
        marginNative,
        width,
        height,
        src,
        0,
        width,
        occluderLookup,
        z,
      )}
    </>
  );
}

function SeatedEmployee({
  employee,
  seat,
  occluderLookup,
}: {
  employee: Employee;
  seat: (typeof OFFICE_LAYOUT.seats)[number];
  occluderLookup: OccluderLookup;
}) {
  const folder = spriteFolderFor(employee);
  const dir = seat.dir;
  // z-order（painter's algorithm）: y が大きい（南＝手前）ほど前面。
  const baseZ = Math.round(seat.y);
  const laptop = PROP_TRANSFORMS.laptop[dir];
  const chair = PROP_TRANSFORMS.chair[dir];

  // 遮蔽の判定に使う接地点は座席で1つ（seat.y）。人も椅子もPCも「同じ床位置に居る」ので、
  // どれも seat.y を基準に前後を決め、スプライトごとの下端の違いは marginNative で表す
  // （canvasBottom = seat.y + marginNative）。物体の下端を接地点にすると、椅子は seat.y より
  // 南に沈んで手前の机より手前と誤判定され、机の上に描かれてしまう（実機で発覚）。
  const propMargin = (p: { y: number }) => sitFootOffset(dir) + p.y;

  const laptopSprite_ = (
    <BandedSprite
      spriteKey={`${employee.id}-laptop`}
      src={laptopSprite(dir)}
      x={seat.x + laptop.x}
      trueFootY={seat.y}
      marginNative={propMargin(laptop)}
      z={baseZ + laptop.z}
      scale={laptop.scale}
      occluderLookup={occluderLookup}
    />
  );
  const chairSprite_ = (
    <BandedSprite
      spriteKey={`${employee.id}-chair`}
      src={chairSprite(dir)}
      x={seat.x + chair.x}
      trueFootY={seat.y}
      marginNative={propMargin(chair)}
      z={baseZ + chair.z}
      scale={chair.scale}
      occluderLookup={occluderLookup}
    />
  );
  const person = (
    <BandedSprite
      spriteKey={`${employee.id}-sit`}
      src={sittingSprite(folder, dir)}
      x={seat.x}
      trueFootY={seat.y}
      marginNative={sitFootOffset(dir)}
      z={baseZ}
      scale={CHAR_SCALE}
      occluderLookup={occluderLookup}
    />
  );

  if (dir === 'north') {
    // 背面向き：机は奥（北）。PC(奥)→人→椅子(手前、脚を隠す)の順（順序は z が決める）。
    return (
      <>
        {laptopSprite_}
        {person}
        {chairSprite_}
      </>
    );
  }

  // 正面向き：机は手前（南）。椅子(奥)→人→机オーバーレイ(手前、脚を隠す)→PC(最前面)の順。
  return (
    <>
      {chairSprite_}
      {person}
      {seat.overlay && (
        <div
          style={{
            position: 'absolute',
            left: seat.overlay[0],
            top: seat.overlay[1],
            width: seat.overlay[2],
            height: seat.overlay[3],
            backgroundImage: `url(${officeBgSrc})`,
            backgroundPosition: `${-seat.overlay[0]}px ${-seat.overlay[1]}px`,
            imageRendering: 'pixelated',
            zIndex: baseZ + 1,
          }}
        />
      )}
      {laptopSprite_}
    </>
  );
}
