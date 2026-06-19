import { clipKeepLeft, clipKeepRight, WS_NW, WS_SE, type WsConfig } from '../data/workstation';
import { type Dir, SPRITE_BASE } from '../lib/officeGeometry';

/**
 * ワークステーション1セット（机→PC→人→椅子）を床アンカー基準で描画する共有コンポーネント。
 * OfficeView と OfficeLayoutTool の両方が使う（描画ロジックを一元化）。
 * 配置値は src/data/workstation.ts（WorkstationTuner で確定）。
 */
export function Workstation({
  x,
  y,
  baseZ,
  dir,
}: {
  x: number;
  y: number;
  baseZ: number;
  dir: Dir;
}) {
  const cfg: WsConfig = dir === 'SE' ? WS_SE : WS_NW;
  const imgEl = (
    key: string,
    img: string,
    sw: number,
    ox: number,
    oy: number,
    z: number,
    clip?: string,
    flip?: boolean,
  ) => (
    <img
      key={key}
      src={`${SPRITE_BASE}/${img}`}
      alt=""
      width={sw}
      height={sw}
      style={{
        position: 'absolute',
        left: x + ox - sw / 2,
        top: y + oy - sw,
        clipPath: clip,
        transform: flip ? 'scaleX(-1)' : undefined,
        imageRendering: 'pixelated',
        zIndex: baseZ + z,
        display: 'block',
      }}
    />
  );
  const c = cfg.chair;
  return (
    <>
      {cfg.layers.map((l) => {
        const clip =
          l.clipTop != null && l.clipBot != null
            ? l.clipSide === 'right'
              ? clipKeepRight(l.clipTop, l.clipBot)
              : clipKeepLeft(l.clipTop, l.clipBot)
            : undefined;
        return imgEl(`l-${l.img}`, l.img, l.w, l.ox, l.oy, l.z, clip, l.flip);
      })}
      {imgEl(
        'chairBack',
        c.img,
        c.w,
        c.ox,
        c.oy,
        c.zBack,
        c.backSide === 'left' ? clipKeepLeft(c.top, c.bot) : clipKeepRight(c.top, c.bot),
        c.flip,
      )}
      {imgEl(
        'chairFront',
        c.img,
        c.w,
        c.ox,
        c.oy,
        c.zFront,
        c.backSide === 'left' ? clipKeepRight(c.top, c.bot) : clipKeepLeft(c.top, c.bot),
        c.flip,
      )}
    </>
  );
}
