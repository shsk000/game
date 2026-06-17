/**
 * ワークステーション（机 / ノートPC / 社員 / 椅子）の重ね合わせ設定を一元管理する。
 *
 * - 調整は `?tuner`（WorkstationTuner）で行い、確定値をここに反映する。
 * - OfficeView と WorkstationTuner の両方がこのファイルを参照するので、値がズレない。
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
  clipTop?: number; // 左を残し右を隠すクリップ線の上端 x%（椅子に隠れる右足等を消す）
  clipBot?: number; // 同・下端 x%
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
};

/** 机 / ノートPC / 社員（社員は clip で椅子に隠れる部分を消す）。 */
export const WS_LAYERS: WsLayer[] = [
  { img: 'desk.png', w: 77, ox: -6, oy: -22, z: 1 },
  { img: 'laptop.png', w: 43, ox: -3, oy: -59, z: 2 },
  { img: 'person_sit_nw.png', w: 118, ox: 16, oy: -12, z: 6, clipTop: 79, clipBot: 28 },
];

/** 椅子（1 枚を clip で 背もたれ/座面 に分割）。 */
export const WS_CHAIR: WsChair = {
  img: 'chair.png',
  w: 56,
  ox: 17,
  oy: -26,
  zBack: 2,
  zFront: 5,
  top: 57,
  bot: 24,
};

/** 分割線より左側を残す clip-path（座面+前脚／社員クリップ用）。 */
export const clipKeepLeft = (top: number, bot: number) => `polygon(0 0, ${top}% 0, ${bot}% 100%, 0 100%)`;

/** 分割線より右側を残す clip-path（背もたれ用）。 */
export const clipKeepRight = (top: number, bot: number) =>
  `polygon(${top}% 0, 100% 0, 100% 100%, ${bot}% 100%)`;
