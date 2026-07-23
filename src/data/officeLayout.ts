import type { EmployeeRole } from '../state/types';
import layoutData from './officeLayoutData.json';

/**
 * オフィス「正面向き素材」の配置データ（単一ソース）。
 * データ本体は office-layout-tool（.claude/worktrees/office-front-facing/office-layout-tool.html）
 * で作成し、officeLayoutData.json として書き出したものをそのまま読み込む。
 * 座標系は背景画像のネイティブ座標（1445×1088）。
 */

export type SeatDir = 'south' | 'north';
export type Seat = {
  x: number;
  y: number;
  dir: SeatDir;
  /** 机で下半身を隠す矩形（背景からの切り出し）。未設定なら椅子のみで隠す。 */
  overlay: [number, number, number, number] | null;
};
export type Occluder = { cells: string[]; baseline: number };

export type OfficeLayoutData = {
  charScale: number;
  footOffsets: { stand: number; sitSouth: number; sitNorth: number };
  grid: { cell: number; walkable: string[] };
  seats: Seat[];
  /** 遮蔽物セルの解像度（OfficeEditorTool の OCCL_CELL と対応。データの自己記述用）。 */
  occlCell?: number;
  occluders: Occluder[];
};

export const OFFICE_LAYOUT = layoutData as OfficeLayoutData;

/** 背景画像（office_bg.png）のネイティブ解像度。 */
export const NATIVE_W = 1445;
export const NATIVE_H = 1088;

export const SPRITE_BASE = '/sprites/office';

/** 社員の最大数（＝オフィスの席数）。採用上限とオフィス表示が同じ値で連動する。 */
export const MAX_EMPLOYEES = OFFICE_LAYOUT.seats.length;

/** 着席時の足元オフセット（native px）。dir に応じて sitSouth/sitNorth を選ぶ。 */
export const sitFootOffset = (dir: SeatDir): number =>
  dir === 'south' ? OFFICE_LAYOUT.footOffsets.sitSouth : OFFICE_LAYOUT.footOffsets.sitNorth;

/**
 * 役職→キャラクタースプライトのフォルダ名（男女）。
 * public/sprites/office/<folder>/{rotations,sitting}/<dir>.png
 */
const ROLE_SPRITE_FOLDER: Record<EmployeeRole, { male: string; female: string }> = {
  programmer: { male: 'engineer', female: 'programmer_f' },
  designer: { male: 'designer_m', female: 'designer_f' },
  pr: { male: 'pr_m', female: 'pr_f' },
};

/**
 * 社員1人ぶんの性別を id から決定論的に導出する（Employee 型に性別フィールドがないため）。
 * 同じ社員は常に同じ見た目になる（乱数は使わない＝再描画・保存復元で揺れない）。
 */
function genderFromId(id: string): 'male' | 'female' {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(hash) % 2 === 0 ? 'male' : 'female';
}

/** 社員の見た目スプライトフォルダを解決する。 */
export function spriteFolderFor(employee: { id: string; role: EmployeeRole }): string {
  const folders = ROLE_SPRITE_FOLDER[employee.role];
  return genderFromId(employee.id) === 'male' ? folders.male : folders.female;
}

export const sittingSprite = (folder: string, dir: SeatDir) =>
  `${SPRITE_BASE}/${folder}/sitting/${dir}.png`;

export const chairSprite = (dir: SeatDir) => `${SPRITE_BASE}/chair_${dir}.png`;
export const laptopSprite = (dir: SeatDir) => `${SPRITE_BASE}/laptop_${dir}.png`;
// v0.25 装備の机上スプライト（<name>_<dir>.png）。単体オブジェクト・透過背景。
export const desktopSprite = (dir: SeatDir) => `${SPRITE_BASE}/desktop_${dir}.png`;
export const gamingRigSprite = (dir: SeatDir) => `${SPRITE_BASE}/gaming_rig_${dir}.png`;
export const bookSprite = (dir: SeatDir) => `${SPRITE_BASE}/book_${dir}.png`;
export const pentabSprite = (dir: SeatDir) => `${SPRITE_BASE}/pentab_${dir}.png`;
export const plantSprite = (dir: SeatDir) => `${SPRITE_BASE}/plant_${dir}.png`;
export const officeBgSrc = `${SPRITE_BASE}/office_bg.png`;

export type PropTransform = {
  x: number;
  y: number;
  scale: number;
  z: number;
  /**
   * v0.25：奥行きへの傾き（rotateX 度）。平らな物（液タブ・本）を机の面に寝かせる。
   * perspective 併用で上辺が中央に寄る＝パース（遠近）に合う。既定 0。
   */
  tiltX?: number;
  /** v0.25：奥行き方向の潰し（縦 scale）。iso の面に合わせる。既定 1。 */
  scaleY?: number;
  /** v0.25：回転（度・時計回り）。向きの微調整に。既定 0。 */
  rotate?: number;
};

/**
 * 物体（PC・椅子…）の配置。すべて着席キャラの足元（seat.y + sitFootOffset(dir)）からの相対値で、
 * 座席を動かしてもキャラとの位置関係は保たれる。
 *
 * **本番（OfficeView）と配置ツール（/admin/props）の唯一の出所**。ツール側に既定値を複製すると、
 * 素材を差し替えた時に本番だけ直してツールが古い値を返す（実際に椅子の scale で発生）。
 *
 * 値はツールで実機調整して「JSON出力」の内容をここに転記する（手で書き換えない）。
 * z はキャラ(0)から見た前後関係（負＝キャラより奥、正＝手前）。scale は素材の実ピクセルに掛ける倍率。
 *
 * 🔧 south は現状どの座席でも使われていない（全席 north）ため未調整の既定値のまま。
 */
export type PropKey = 'laptop' | 'chair' | 'desktop' | 'gaming_rig' | 'book' | 'pentab' | 'plant';

// v0.25：机上プロップ(PC/小物)の north 値は原点＝机の面(PROP_ORIGIN_Y)からの相対。0,0=机の面。
export const PROP_TRANSFORMS: Record<PropKey, Record<SeatDir, PropTransform>> = {
  laptop: {
    north: { x: -3, y: -20, scale: 1.15, z: -1, tiltX: 10 },
    south: { x: 0, y: -230, scale: OFFICE_LAYOUT.charScale, z: 2 },
  },
  chair: {
    // 素材が 48×64 → 136×136 に変わったため scale は charScale ではない（2026-07-17 発注分）。
    north: { x: -3, y: -32, scale: 1, z: 1 },
    // 🔧 south は旧素材（48×64・グレー）のまま。使う席が出たら north と同じ発注から差し替える。
    south: { x: 0, y: 10, scale: OFFICE_LAYOUT.charScale, z: -1 },
  },
  // v0.25 装備プロップ。/admin/props で実機調整した値を転記（2026-07-23・調整途中）。
  desktop: {
    north: { x: -1, y: 16, scale: 1.6, z: -48 },
    south: { x: 0, y: -230, scale: 1, z: 2 },
  },
  gaming_rig: {
    north: { x: -3, y: 5, scale: 1.55, z: -1 },
    south: { x: 0, y: -230, scale: 1, z: 2 },
  },
  book: {
    north: { x: -66, y: -16, scale: 0.35, z: 1, rotate: 0 },
    south: { x: 42, y: -120, scale: 0.55, z: 1 },
  },
  pentab: {
    north: { x: -5, y: 0, scale: 0.55, z: 1, tiltX: 30 },
    south: { x: -42, y: -118, scale: 0.6, z: 1 },
  },
  plant: {
    north: { x: 61, y: -7, scale: 0.45, z: 1, tiltX: 26 },
    south: { x: 50, y: -150, scale: 0.6, z: 1 },
  },
};

/**
 * v0.25：奥行き遠近スケール。座席Y（大きい=手前）で 1.0、奥の列ほど小さく。
 * 机上プロップ（PC・小物）の scale とオフセット(x,y)に掛けることで、1つの調整値で
 * 手前/奥どちらのデスクにも比率で合う（絶対px運用のズレを解消）。椅子・人は等倍のまま。
 */
export const PERSPECTIVE_BACK_SCALE = 0.75; // 最奥列の倍率（手前列=1.0）🔧（/admin/props で調整→ここに転記）
const SEAT_Y_MIN = Math.min(...OFFICE_LAYOUT.seats.map((s) => s.y));
const SEAT_Y_MAX = Math.max(...OFFICE_LAYOUT.seats.map((s) => s.y));
export const seatDepthScale = (
  seatY: number,
  backScale: number = PERSPECTIVE_BACK_SCALE,
): number => {
  if (SEAT_Y_MAX === SEAT_Y_MIN) return 1;
  const t = (seatY - SEAT_Y_MIN) / (SEAT_Y_MAX - SEAT_Y_MIN); // 0=最奥, 1=最手前
  return backScale + (1 - backScale) * t;
};
/** 遠近スケールを掛ける机上プロップ（椅子・人は着席ユニットとして対象外）。 */
export const DEPTH_SCALED_PROPS = new Set<PropKey>([
  'laptop',
  'desktop',
  'gaming_rig',
  'book',
  'pentab',
  'plant',
]);

/**
 * v0.25：机上プロップ(PC/小物)の原点を「座り足元」から**机の面**へ上げるYオフセット(native px)。
 * PROP_TRANSFORMS の各値はこの原点からの相対値（＝0,0が机の面）。描画時に足し戻すので見た目は不変。
 * 横(X)は座席中央がそのまま机の中央なので原点シフト不要（=0）。
 */
export const PROP_ORIGIN_Y = -150;

/** 立ち・歩行スプライトの8方向。 */
export type Dir8 =
  | 'south'
  | 'south-east'
  | 'east'
  | 'north-east'
  | 'north'
  | 'north-west'
  | 'west'
  | 'south-west';

export const DIR8: Dir8[] = [
  'south',
  'south-east',
  'east',
  'north-east',
  'north',
  'north-west',
  'west',
  'south-west',
];

/** 立ち絵（8方向）。 */
export const standingSprite = (folder: string, dir: Dir8) =>
  `${SPRITE_BASE}/${folder}/rotations/${dir}.png`;

/** 歩行アニメ（8方向 × 8フレーム、横並びスプライトシート 960×120）。 */
export const walkSheet = (folder: string, dir: Dir8) => `${SPRITE_BASE}/${folder}/walk_${dir}.png`;
export const WALK_FRAMES = 8;

/**
 * 歩行可否の判定。移動検証ツール（?walk）専用。
 * OFFICE_LAYOUT.grid.walkable は "i,j" 形式のセルキー集合（塗ったマス＝歩ける）。
 */
const walkableSet = new Set(OFFICE_LAYOUT.grid.walkable);
export function isWalkable(nativeX: number, nativeY: number): boolean {
  const cell = OFFICE_LAYOUT.grid.cell;
  if (nativeX < 0 || nativeY < 0 || nativeX >= NATIVE_W || nativeY >= NATIVE_H) return false;
  const i = Math.floor(nativeX / cell);
  const j = Math.floor(nativeY / cell);
  return walkableSet.has(`${i},${j}`);
}

/** 8方向の入力ベクトルから最も近い Dir8 を選ぶ（atan2 を45度刻みで量子化）。 */
export function vectorToDir8(dx: number, dy: number): Dir8 {
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  const idx = Math.round(((angle + 360) % 360) / 45) % 8;
  // 0deg=east を起点に45度刻みで DIR8 と同じ並びに揃える
  const order: Dir8[] = [
    'east',
    'south-east',
    'south',
    'south-west',
    'west',
    'north-west',
    'north',
    'north-east',
  ];
  return order[idx];
}
