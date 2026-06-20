/**
 * オフィスの配置データ（ワークステーション配置 / 出入口ドア）の単一ソース。
 * OfficeView（本番表示）と OfficeLayoutTool（?layout 調整ツール）が共有する。
 *
 * - コード上の DEFAULT_* が「出荷時の確定レイアウト」。
 * - 調整ツールで動かすと localStorage に保存され、OfficeView もそれを読むので即反映＆永続化する。
 * - 確定したら、ツール出力の値を下の DEFAULT_* に転記してコードに焼き込む。
 */

import type { Placement } from './officeGeometry';

/** ドアもセル基準＋セル内オフセット（ox,oy）で置く。机と同じ「セル＋セル内位置」方式。 */
export type DoorCfg = { img: string; i: number; j: number; w: number; ox: number; oy: number };

/** 出荷時のワークステーション配置（向かい合わせ 3×2 島・最大6席）。 */
export const DEFAULT_WORKSTATIONS: Placement[] = [
  { i: 3, j: 2, dir: 'SE' },
  { i: 3, j: 3, dir: 'SE' },
  { i: 4, j: 2, dir: 'NW' },
  { i: 3, j: 4, dir: 'SE' },
  { i: 4, j: 3, dir: 'NW' },
  { i: 4, j: 4, dir: 'NW' },
];

/** 出荷時の出入口ドア。?layout の セル(i,j)＋セル内ox/oy/大きさ で調整。 */
export const DEFAULT_DOOR: DoorCfg = { img: 'door_se.png', i: 7, j: 3, w: 120, ox: 23, oy: 31 };

/** 社員の最大数（＝オフィスの席数）。採用上限とオフィス表示が同じ値で連動する。 */
export const MAX_EMPLOYEES = DEFAULT_WORKSTATIONS.length;

const WS_KEY = 'office-layout-v2';
const DOOR_KEY = 'office-door-v4';

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
