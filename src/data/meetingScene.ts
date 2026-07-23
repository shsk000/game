import type { Dir8 } from './officeLayout';

/**
 * v0.26 B：企画フェーズの「ホワイトボード会議」用のキャラ配置。
 *
 * 背景 office_bg.png（1445×1088）の上部中央にあるホワイトボード
 *   板面 native x[722..912] / y[129..255]、足元（床接地）y≈327、板面中心 ≈ (817,192)
 * を手前から取り囲むように立ち絵を並べる。座標は背景ネイティブ px（足元の接地点）。
 * dir は立ち絵の向き（Dir8）。north＝背中が見える＝ホワイトボードを見ている向き。
 *
 * 数値は /admin/meeting のプレビューでドラッグ調整して「JSONコピー」の内容をここへ転記する
 * （officeLayoutData.json と同じ運用：ツールが唯一の出所、手で当て推量で書き換えない）。
 */
export type MeetingSpot = { x: number; y: number; dir: Dir8 };

export const WHITEBOARD_MEETING_SPOTS: MeetingSpot[] = [
  { x: 684, y: 376, dir: 'north-east' }, // 左フランク（板の左手前、右奥＝板を見る）
  { x: 737, y: 422, dir: 'north' }, // 左前
  { x: 821, y: 454, dir: 'north' }, // 中央前（背中＝板に向かって発表/注視）
  { x: 905, y: 434, dir: 'north' }, // 右前
  { x: 945, y: 352, dir: 'north-west' }, // 右フランク
];

/**
 * 企画フェーズで付箋を貼るホワイトボード「白面」のネイティブ矩形 [x, y, w, h]。
 * 付箋はこの矩形内グリッドに収める（はみ出さない）。枠外の金属フレーム/マーカー受けは含めない。
 * /admin/meeting の「ボード枠」編集でドラッグ調整して、その JSON をここへ転記する。
 */
export const WHITEBOARD_BOARD_RECT: [number, number, number, number] = [734, 140, 166, 104];

/** アイデア付箋の色。 */
export const NOTE_COLORS = ['#ffe27a', '#a6e3a1', '#ffd59e', '#9ecbff', '#ffb3c1'];
