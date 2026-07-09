/**
 * オフィスの配置データ（ワークステーション配置 / 出入口ドア）の単一ソース。
 * OfficeView（本番表示）と OfficeLayoutTool（?layout 調整ツール）が共有する。
 *
 * - コード上の DEFAULT_* が「出荷時の確定レイアウト」。
 * - 調整ツールで動かすと localStorage に保存され、OfficeView もそれを読むので即反映＆永続化する。
 * - 確定したら、ツール出力の値を下の DEFAULT_* に転記してコードに焼き込む。
 */

import { type Placement } from './officeGeometry';

/** ドアもセル基準＋セル内オフセット（ox,oy）で置く。机と同じ「セル＋セル内位置」方式。 */
export type DoorCfg = { img: string; i: number; j: number; w: number; ox: number; oy: number };

/**
 * 装飾家具は「カタログ」と「配置」に分離する（机/ドアと同じ原則）。
 * - カタログ（DecorItem）＝家具の種類ごとの「セル内の見え方」(画像/大きさ/セル内位置)。?tuner で調整。
 * - 配置（DecorPlacement）＝どの種類をどのセルに置くか。?layout で調整。複数置ける。
 */
/**
 * 装飾家具のカタログ項目（種類ごとの見え方）。
 * - imgBase = スプライトのベース名。向き別に `<base>_se.png` / `<base>_sw.png` を使う。
 * - cw × ch = 占有マス数（i軸 × j軸, 既定 1×1）。ホワイトボード/ソファ=2×1、大きな島=2×2 等。
 *   i軸＝画面 右下↘、j軸＝画面 左下↙。アンカーは footprint の中心。
 * - w = 表示サイズ、ox/oy = セル内の微調整（接地点・高さは家具ごとに違う）。
 */
export type DecorDir = 'SE' | 'SW' | 'NW';
export type DecorItem = {
  id: string;
  name: string;
  imgBase: string;
  w: number;
  ox: number;
  oy: number;
  cw?: number;
  ch?: number;
  /** 壁掛け（窓など）。true なら描画時に壁面(slope 0.5=26.57°)へ skew して同一平面に載せる。 */
  onWall?: boolean;
};
/** 配置（どの種類をどのセルに・どの向きで）。 */
export type DecorPlacement = { catalogId: string; i: number; j: number; dir: DecorDir };

/** 向き別スプライトのファイル名。 */
export const decorImg = (imgBase: string, dir: DecorDir) => `${imgBase}_${dir.toLowerCase()}.png`;

/**
 * 壁掛けデコ（onWall）を壁の大面へ載せる skew 角度(deg)。壁面は 2:1 dimetric の slope 0.5 = atan(0.5)=26.57°。
 * SE壁（奥左辺=NW辺）は右上がり→ skewY 負、SW壁（奥右辺=NE辺）は左上がり→ skewY 正。
 */
export const wallSkewDeg = (dir: DecorDir): number => (dir === 'SW' ? 26.565 : dir === 'SE' ? -26.565 : 0);

/**
 * 配置時の実効ジオメトリ。ox はカタログ基準(SE)で、左向き(SW/NW)は符号反転（鏡面）。
 * footprint(cw/ch): SW は反射で i↔j を入れ替え。NW は SE の180°なので入れ替えない（SE と同じ）。oy は常に同じ。
 */
export function decorGeom(item: DecorItem, dir: DecorDir): { ox: number; oy: number; cw: number; ch: number } {
  const cw = item.cw ?? 1;
  const ch = item.ch ?? 1;
  if (dir === 'SW') return { ox: -item.ox, oy: item.oy, cw: ch, ch: cw };
  if (dir === 'NW') return { ox: -item.ox, oy: item.oy, cw, ch };
  return { ox: item.ox, oy: item.oy, cw, ch };
}

/**
 * 壁も「カタログ＋配置」方式（家具と同じ原則）。向きは家具と同じ SW/SE。
 * - WallItem ＝壁の種類ごとの見え方（画像/大きさ/セル内オフセット/回転/積み間隔）。?tuner で調整。
 * - WallPlacement ＝どのセルにどの向きで・何段積むか。?layout で設置。
 * - imgBase は向き別に `<base>_se.png` / `<base>_sw.png`。SE=基準, SW=鏡面。
 *   SW を向く壁は奥右辺(NE辺)、SE を向く壁は奥左辺(NW辺)に立つ。
 */
export type WallDir = 'SE' | 'SW';
/** rot = 表示時のCSS回転角(度, 既定0)。stackDy = 縦積み1段ごとの上方向オフセット(px)。 */
export type WallItem = { id: string; name: string; imgBase: string; w: number; h: number; ox: number; oy: number; rot?: number; stackDy?: number };
/** stack = 縦に何段積むか（1〜3, 既定1）。上方向に stackDy ずつリピート。 */
export type WallPlacement = { catalogId: string; i: number; j: number; dir: WallDir; stack: number };

/** 向き別の壁スプライト名。 */
export const wallImg = (imgBase: string, dir: WallDir) => `${imgBase}_${dir.toLowerCase()}.png`;

/** SW は SE の鏡映（セル内オフセット ox の符号反転）。oy は同じ。スプライト自体は各向き専用。 */
export function wallOffset(item: WallItem, dir: WallDir): { ox: number; oy: number } {
  return dir === 'SW' ? { ox: -item.ox, oy: item.oy } : { ox: item.ox, oy: item.oy };
}

/** 壁カタログ。?tuner で調整 → ここに転記。 */
export const DEFAULT_WALL_CATALOG: WallItem[] = [
  { id: 'wall', name: '壁', imgBase: 'wall_v', w: 96, h: 150, ox: -3, oy: 39, rot: 0, stackDy: 68 },
];

/** 出荷時の壁配置（既定＝mini の奥2辺に窓壁）。?layout で編集 → ここに転記。 */
export const DEFAULT_WALL_PLACEMENTS: WallPlacement[] = [
  { catalogId: 'wall', i: 0, j: 0, dir: 'SE', stack: 2 },
  { catalogId: 'wall', i: 0, j: 0, dir: 'SW', stack: 2 },
  { catalogId: 'wall', i: 0, j: 1, dir: 'SE', stack: 2 },
  { catalogId: 'wall', i: 1, j: 0, dir: 'SW', stack: 2 },
  { catalogId: 'wall', i: 0, j: 2, dir: 'SE', stack: 2 },
  { catalogId: 'wall', i: 2, j: 0, dir: 'SW', stack: 2 },
  { catalogId: 'wall', i: 0, j: 3, dir: 'SE', stack: 2 },
  { catalogId: 'wall', i: 3, j: 0, dir: 'SW', stack: 2 },
  { catalogId: 'wall', i: 0, j: 4, dir: 'SE', stack: 2 },
  { catalogId: 'wall', i: 4, j: 0, dir: 'SW', stack: 2 },
  { catalogId: 'wall', i: 0, j: 5, dir: 'SE', stack: 2 },
  { catalogId: 'wall', i: 5, j: 0, dir: 'SW', stack: 2 },
  { catalogId: 'wall', i: 0, j: 6, dir: 'SE', stack: 2 },
  { catalogId: 'wall', i: 6, j: 0, dir: 'SW', stack: 2 },
  { catalogId: 'wall', i: 7, j: 0, dir: 'SW', stack: 2 },
];

/** 出荷時のワークステーション配置（向かい合わせ 3×2 島・最大6席）。 */
export const DEFAULT_WORKSTATIONS: Placement[] = [
  { i: 1, j: 1, dir: 'SE' },
  { i: 1, j: 2, dir: 'SE' },
  { i: 2, j: 1, dir: 'NW' },
  { i: 1, j: 3, dir: 'SE' },
  { i: 2, j: 2, dir: 'NW' },
  { i: 2, j: 3, dir: 'NW' },
  { i: 4, j: 1, dir: 'SE' },
  { i: 4, j: 2, dir: 'SE' },
  { i: 5, j: 1, dir: 'NW' },
  { i: 4, j: 3, dir: 'SE' },
  { i: 5, j: 2, dir: 'NW' },
  { i: 5, j: 3, dir: 'NW' },
];

/** 出荷時の出入口ドア。?layout の セル(i,j)＋セル内ox/oy/大きさ で調整。 */
export const DEFAULT_DOOR: DoorCfg = { img: 'door_se.png', i: 7, j: 3, w: 120, ox: 23, oy: 31 };

/** 社員の最大数（＝オフィスの席数）。採用上限とオフィス表示が同じ値で連動する。 */
export const MAX_EMPLOYEES = DEFAULT_WORKSTATIONS.length;

/** 家具カタログ（種類ごとの見え方）。全項目を ?tuner で調整 → ここに転記。全家具で同じ項目を持つ。 */
export const DEFAULT_DECOR_CATALOG: DecorItem[] = [
  { id: 'plant', name: '観葉植物', imgBase: 'plant', w: 110, ox: -1, oy: 21, cw: 1, ch: 1 },
  { id: 'bookshelf', name: '本棚', imgBase: 'bookshelf', w: 120, ox: -4, oy: 16, cw: 1, ch: 1 },
  { id: 'water_cooler', name: 'ウォーターサーバー', imgBase: 'water_cooler', w: 67, ox: -12, oy: 6, cw: 1, ch: 1 },
  { id: 'whiteboard', name: 'ホワイトボード', imgBase: 'whiteboard', w: 130, ox: -9, oy: 23, cw: 1, ch: 2 },
  { id: 'sofa', name: 'ソファ', imgBase: 'sofa', w: 120, ox: 4, oy: 42, cw: 1, ch: 2 },
  { id: 'coffee_table', name: 'コーヒーテーブル', imgBase: 'coffee_table', w: 90, ox: -9, oy: 38, cw: 1, ch: 2 },
  { id: 'vending', name: '自販機', imgBase: 'vending', w: 110, ox: 6, oy: 15, cw: 1, ch: 1 },
  { id: 'fridge', name: '冷蔵庫', imgBase: 'fridge', w: 100, ox: -7, oy: 24, cw: 1, ch: 1 },
  { id: 'trash', name: 'ゴミ箱', imgBase: 'trash', w: 50, ox: 1, oy: 6, cw: 1, ch: 1 },
  { id: 'clock', name: '時計', imgBase: 'clock', w: 60, ox: -22, oy: -82, cw: 1, ch: 1 },
  { id: 'window', name: '窓', imgBase: 'window_sky', w: 79, ox: -22, oy: -40, cw: 1, ch: 1, onWall: true },
];

/** 出荷時の家具配置（どの種類をどのセルに）。?layout で調整 → ここに転記。 */
export const DEFAULT_DECOR_PLACEMENTS: DecorPlacement[] = [
  { catalogId: 'plant', i: 0, j: 0, dir: 'SE' },
  { catalogId: 'clock', i: 0, j: 1, dir: 'SE' },
  { catalogId: 'whiteboard', i: 0, j: 2, dir: 'SE' },
  { catalogId: 'window', i: 2, j: 0, dir: 'SW' },
  { catalogId: 'window', i: 0, j: 2, dir: 'SE' },
  { catalogId: 'window', i: 3, j: 0, dir: 'SW' },
  { catalogId: 'window', i: 0, j: 3, dir: 'SE' },
  { catalogId: 'water_cooler', i: 0, j: 4, dir: 'SE' },
  { catalogId: 'trash', i: 4, j: 0, dir: 'SW' },
  { catalogId: 'vending', i: 0, j: 5, dir: 'SW' },
  { catalogId: 'bookshelf', i: 5, j: 0, dir: 'SW' },
  { catalogId: 'trash', i: 0, j: 6, dir: 'SW' },
  { catalogId: 'bookshelf', i: 6, j: 0, dir: 'SW' },
  { catalogId: 'sofa', i: 2, j: 5, dir: 'SE' },
  { catalogId: 'bookshelf', i: 7, j: 0, dir: 'SW' },
  { catalogId: 'coffee_table', i: 3, j: 5, dir: 'SE' },
  { catalogId: 'sofa', i: 4, j: 5, dir: 'NW' },
];

// localStorage キーは固定名（バージョン付けしない）。既定値を変えてツールに反映したい時は
// ツールの「リセット/既定に戻す」で明示的にクリアする。本番(OfficeView)は localStorage を見ず常にコード定数。
const WS_KEY = 'office-layout';
const DOOR_KEY = 'office-door';
const DECOR_CATALOG_KEY = 'office-decor-catalog';
const DECOR_PLACE_KEY = 'office-decor-place';
const WALL_CATALOG_KEY = 'office-wall-catalog';
const WALL_PLACE_KEY = 'office-wall-place';

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
  } catch {
    // ignore
  }
  return fallback;
}
function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

export const loadWorkstations = (): Placement[] => read(WS_KEY, DEFAULT_WORKSTATIONS);
export const saveWorkstations = (p: Placement[]) => write(WS_KEY, p);
export const loadDoor = (): DoorCfg => read(DOOR_KEY, DEFAULT_DOOR);
export const saveDoor = (d: DoorCfg) => write(DOOR_KEY, d);
export const loadDecorCatalog = (): DecorItem[] => read(DECOR_CATALOG_KEY, DEFAULT_DECOR_CATALOG);
export const saveDecorCatalog = (c: DecorItem[]) => write(DECOR_CATALOG_KEY, c);
export const loadDecorPlacements = (): DecorPlacement[] => read(DECOR_PLACE_KEY, DEFAULT_DECOR_PLACEMENTS);
export const saveDecorPlacements = (p: DecorPlacement[]) => write(DECOR_PLACE_KEY, p);
export const loadWallCatalog = (): WallItem[] => read(WALL_CATALOG_KEY, DEFAULT_WALL_CATALOG);
export const saveWallCatalog = (c: WallItem[]) => write(WALL_CATALOG_KEY, c);
export const loadWallPlacements = (): WallPlacement[] => read(WALL_PLACE_KEY, DEFAULT_WALL_PLACEMENTS);
export const saveWallPlacements = (p: WallPlacement[]) => write(WALL_PLACE_KEY, p);
