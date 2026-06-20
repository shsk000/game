/**
 * ワークステーション（机 / ノートPC / 社員 / 椅子）の重ね合わせ設定を一元管理する。
 *
 * - 調整は `?tuner`（WorkstationTuner）で行い、確定値をここに反映する。
 * - OfficeView と WorkstationTuner の両方がこのファイルを参照するので、値がズレない。
 * - 向きは 2 種：NW（背中こちら）と SE（カメラ向き）。向かい合わせペアに使う。
 *   反転は使わない（2D なので反転では別向きにならない）。机/椅子/人とも PixelLab で
 *   生成済みの「向き別スプライト」をそのまま使う（机=8方向回転、椅子=向き別オブジェクト、人=向き別着席）。
 *
 * 椅子は 1 枚の chair.png を clip-path で「背もたれ(奥)」「座面+前脚(手前)」に動的分割し、
 * 社員をその間に挟むことで、椅子を単一スプライトのまま差し替え可能に保って「座っている」を表現する。
 */

export type WsLayer = {
  img: string;
  w: number; // 表示サイズ（正方）
  ox: number; // 床アンカーからの横オフセット
  oy: number; // 床アンカーからの縦オフセット（下端基準・負で上）
  z: number; // 重なり順（セット内）
  clipTop?: number; // クリップ線の上端 x%（椅子に隠れる足等を消す）
  clipBot?: number; // 同・下端 x%
  clipSide?: 'left' | 'right'; // クリップで残す側（既定 left）
  flip?: boolean; // 水平反転（SE 向きの家具用）
};

export type WsChair = {
  img: string;
  w: number;
  ox: number;
  oy: number;
  zBack: number; // 背もたれ(奥)の z
  zFront: number; // 座面+前脚(手前)の z
  top: number; // 背もたれ/座面 分割線の上端 x%
  bot: number; // 同・下端 x%
  backSide?: 'left' | 'right'; // 背もたれがある側（既定 right）。clip の振り分けに使う
  flip?: boolean; // （非推奨）水平反転
};

/** cellOffset = このセット全体をセル基準点に対しどこに置くか（セル内位置）。tuner の「全体移動」で設定。 */
export type WsConfig = { layers: WsLayer[]; chair: WsChair; cellOffset: { x: number; y: number } };

/** NW（背中こちら）。 */
export const WS_NW: WsConfig = {
  layers: [
    { img: 'desk.png', w: 77, ox: -25, oy: -19, z: 1 },
    { img: 'laptop.png', w: 43, ox: -22, oy: -56, z: 2 },
    { img: 'person_sit_nw.png', w: 118, ox: -3, oy: -9, z: 6, clipTop: 79, clipBot: 28, clipSide: 'left' },
  ],
  chair: { img: 'chair.png', w: 56, ox: -2, oy: -23, zBack: 2, zFront: 5, top: 57, bot: 24 },
  cellOffset: { x: 14, y: 40 },
};

/** SE（カメラ向き）。正規の向き別スプライト：机=north-west回転、椅子=SE向きオブジェクト、人=SE着席。 */
export const WS_SE: WsConfig = {
  layers: [
    { img: 'desk_se.png', w: 77, ox: -3, oy: -9, z: 7 },
    { img: 'laptop_se.png', w: 43, ox: 0, oy: -42, z: 8 },
    { img: 'person_sit.png', w: 118, ox: -16, oy: -9, z: 6 },
  ],
  chair: { img: 'chair_se.png', w: 56, ox: -17, oy: -26, zBack: 2, zFront: 5, top: 57, bot: 24, backSide: 'left' },
  cellOffset: { x: 14, y: 41 },
};

/** 後方互換（旧名）。 */
export const WS_LAYERS = WS_NW.layers;
export const WS_CHAIR = WS_NW.chair;

/** 分割線より左側を残す clip-path（座面+前脚／社員クリップ用）。 */
export const clipKeepLeft = (top: number, bot: number) => `polygon(0 0, ${top}% 0, ${bot}% 100%, 0 100%)`;

/** 分割線より右側を残す clip-path（背もたれ用）。 */
export const clipKeepRight = (top: number, bot: number) =>
  `polygon(${top}% 0, 100% 0, 100% 100%, ${bot}% 100%)`;
