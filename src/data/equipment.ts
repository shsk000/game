/**
 * 装備品（デスク・椅子・モニター）。各カテゴリは tier 順の配列で持つ。
 * 各装備は購入コスト＋恒常ボーナス（品質・パフォーマンス等）を持つ。
 *
 * v0.9 §1-7 の「設備投資（恒常ボーナス）」未実装タスクの第一歩。
 * まずはデフォルト装備のみ（コスト0）で配置データを提供する。
 * アップグレード UI は後段。
 */

export type EquipmentKind = 'desk' | 'chair' | 'monitor';

export type EquipmentDef = {
  id: string;
  kind: EquipmentKind;
  name: string;
  sprite: string; // public 配下の絶対パス
  cost: number;
  /** リリース時の品質寄与（カテゴリ寄与の追加点） */
  qualityBonus?: number;
  /** タイピング演技寄与の底上げ（perf係数） */
  perfBonus?: number;
  /** コンボ維持の補正（ノリゲージが切れにくい） */
  comboBonus?: number;
};

export const DESKS: EquipmentDef[] = [
  {
    id: 'desk-basic',
    kind: 'desk',
    name: '木製デスク',
    sprite: '/sprites/office/desk.png',
    cost: 0,
  },
];

export const CHAIRS: EquipmentDef[] = [
  {
    id: 'chair-basic',
    kind: 'chair',
    name: '事務椅子',
    sprite: '/sprites/office/chair.png',
    cost: 0,
  },
];

export const MONITORS: EquipmentDef[] = [
  {
    id: 'monitor-basic',
    kind: 'monitor',
    name: '液晶モニター',
    sprite: '/sprites/office/monitor.png',
    cost: 0,
  },
];

export const EQUIPMENT_BY_ID: Record<string, EquipmentDef> = [
  ...DESKS,
  ...CHAIRS,
  ...MONITORS,
].reduce(
  (acc, e) => {
    acc[e.id] = e;
    return acc;
  },
  {} as Record<string, EquipmentDef>,
);

/** 現在装備（初期値はすべて basic） */
export const DEFAULT_EQUIPMENT = {
  deskId: 'desk-basic',
  chairId: 'chair-basic',
  monitorId: 'monitor-basic',
};
