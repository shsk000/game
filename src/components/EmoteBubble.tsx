import type { PlanEmoteDef } from '../core/planEmote';
import { PixelIcon } from './ui/PixelIcon';

/**
 * 企画会議で社員の頭上に出すアイコン吹き出し。
 *
 * - 枠は PixelLab 製のドット絵フキダシ（/sprites/ui/emote_bubble.png）を 9-slice（border-image）で伸縮。
 * - 中身はドット絵アイコン（def.src）。素材が読めない環境では emoji フォールバック。
 * - native 座標に絶対配置する純表示。呼び出し側（MeetingScene）が頭頂座標を計算して渡す。
 * - 中央寄せ（translateX(-50%)）は**外側アンカー**が持ち、ポップ拡大アニメは**内側**に当てる
 *   （同じ要素で中央寄せ transform とアニメ transform を兼ねると衝突するため役割を分ける）。
 * - `animKey` を内側 div の React key にすることで、発火ごとにポップを再生する。
 */
export function EmoteBubble({
  def,
  animKey,
  x,
  top,
  size = 52,
  zIndex = 60000,
}: {
  def: PlanEmoteDef;
  animKey: number;
  /** 吹き出し中心の native X */
  x: number;
  /** 吹き出し上端の native Y */
  top: number;
  /** 吹き出し枠の一辺（native px） */
  size?: number;
  zIndex?: number;
}) {
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top,
        transform: 'translateX(-50%)',
        zIndex,
        pointerEvents: 'none',
      }}
    >
      <div
        key={animKey}
        className="emote-bubble emote-bubble-pop"
        style={{ width: size, height: size }}
      >
        {/* アイコンは枠の少し上（クリーム地の中心）へ寄せる */}
        <PixelIcon
          src={def.src}
          emoji={def.emoji}
          size={Math.round(size * 0.5)}
          style={{
            position: 'absolute',
            left: '50%',
            top: '44%',
            transform: 'translate(-50%, -50%)',
          }}
        />
      </div>
    </div>
  );
}
