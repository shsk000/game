/**
 * 装備品（v0.25 装備システム）。v0.25（資料は削除済み） §4-1。
 *
 * 種別スロット制：社員ごとに【PC】【チェア】【小物(misc)】の3スロット。各スロットに1つ装備。
 * 各装備は購入コスト＋**カテゴリ別倍率**（program/graphics/sound/scenario を底上げ）を持つ。
 *
 * 効果はリリース品質に効くが、既存の STAT/AXIS ボーナス枠（8点）とは別枠で加点する
 * （EQUIP_QUALITY_BONUS_CAP で頭打ち）。純粋な倍率計算は src/core/equip.ts。
 *
 * 価格・categoryMul の値は叩き台 🔧。
 *
 * 実装ステップ4（docs/spec/score-model.md §1）：
 * **装備は社員のスキルに分野別の倍率を掛ける**（作品側の数値には直接掛けない）。
 * 実効スキルは 100 を超えてよい ── 上限を置くとスキル100 の社員に装備が無意味になり、
 * 終盤に装備を買う理由が消えるため。効果は「特徴ポイントを速く積める」＝開発が早く終わる
 * ＝固定費が安い、に出る。
 *
 * スロットの役割：**PC と小物で分野特化、チェアで全分野の底上げ**。
 * 4つの開発分野それぞれに特化アイテムがある（program=デスクトップ / graphics=液タブ /
 * sound=モニタースピーカー / scenario=資料本）。
 */

import type { TicketCategory } from './devPhrases';

export type EquipSlot = 'pc' | 'chair' | 'misc';

/** 社員1人ぶんの装備（スロット→アイテムID）。未装備スロットは undefined。 */
export type EquipLoadout = Partial<Record<EquipSlot, string>>;

export type EquipmentDef = {
  id: string;
  slot: EquipSlot;
  name: string;
  /** 同一スロット内の序列（0 = 初期装備）。UI 並び順・見た目ティアに使う。 */
  tier: number;
  /** 購入コスト（¥）。tier 0 の初期装備は 0。 */
  cost: number;
  /**
   * カテゴリ別の品質倍率。未指定カテゴリは 1.0（無強化）。
   * 例 { program: 1.2 } = program の devStats 寄与を +20%。
   */
  categoryMul?: Partial<Record<TicketCategory, number>>;
  /** 机上に描くスプライトの基底名（<base>_<dir>.png）。見た目は Phase E で接続。 */
  sprite?: string;
};

/** 【PC】スロット：program 中心（上位は scenario も少し）。標準ノートは無強化の初期装備。 */
export const PC_ITEMS: EquipmentDef[] = [
  // 標準ノート＝誰もが持つ標準装備（無料・能力ボーナスなし）。ボーナスはデスクトップ以上のみ。
  { id: 'pc-laptop', slot: 'pc', name: '標準ノート', tier: 0, cost: 0, sprite: 'laptop' },
  {
    id: 'pc-desktop',
    slot: 'pc',
    name: 'デスクトップ',
    tier: 1,
    cost: 30_000_000,
    categoryMul: { program: 1.2 },
    sprite: 'desktop',
  },
  {
    id: 'pc-gaming',
    slot: 'pc',
    name: 'ゲーミングリグ',
    tier: 2,
    cost: 150_000_000,
    categoryMul: { program: 1.35, scenario: 1.1 },
    sprite: 'gaming_rig',
  },
];

/** 【チェア】スロット：全カテゴリ微増（座り心地＝全体の底上げ）。 */
export const CHAIR_ITEMS: EquipmentDef[] = [
  { id: 'chair-basic', slot: 'chair', name: '事務椅子', tier: 0, cost: 0, sprite: 'chair' },
  {
    id: 'chair-office',
    slot: 'chair',
    name: 'オフィスチェア',
    tier: 1,
    cost: 10_000_000,
    categoryMul: { program: 1.05, graphics: 1.05, sound: 1.05, scenario: 1.05 },
    sprite: 'chair_office',
  },
  {
    id: 'chair-ergo',
    slot: 'chair',
    name: 'エルゴノミクスチェア',
    tier: 2,
    cost: 60_000_000,
    categoryMul: { program: 1.1, graphics: 1.1, sound: 1.1, scenario: 1.1 },
    sprite: 'chair_ergo',
  },
];

/** 【小物】スロット：カテゴリ特化（1品1カテゴリ）＋癒し枠。 */
export const MISC_ITEMS: EquipmentDef[] = [
  { id: 'misc-none', slot: 'misc', name: 'なし', tier: 0, cost: 0 },
  {
    id: 'misc-book',
    slot: 'misc',
    name: '資料本',
    tier: 1,
    cost: 5_000_000,
    categoryMul: { scenario: 1.25 },
    sprite: 'book',
  },
  {
    id: 'misc-pentab',
    slot: 'misc',
    name: '液タブ',
    tier: 1,
    cost: 30_000_000,
    categoryMul: { graphics: 1.25 },
    sprite: 'pentab',
  },
  {
    id: 'misc-monitor-speaker',
    slot: 'misc',
    name: 'モニタースピーカー',
    tier: 1,
    cost: 30_000_000,
    categoryMul: { sound: 1.25 },
    sprite: 'plant',
  },
  {
    id: 'misc-plant',
    slot: 'misc',
    name: '観葉植物',
    tier: 1,
    cost: 8_000_000,
    categoryMul: { program: 1.03, graphics: 1.03, sound: 1.03, scenario: 1.03 },
    sprite: 'plant',
  },
];

export const ALL_EQUIPMENT: EquipmentDef[] = [...PC_ITEMS, ...CHAIR_ITEMS, ...MISC_ITEMS];

export const EQUIPMENT_BY_ID: Record<string, EquipmentDef> = ALL_EQUIPMENT.reduce(
  (acc, e) => {
    acc[e.id] = e;
    return acc;
  },
  {} as Record<string, EquipmentDef>,
);

export const ITEMS_BY_SLOT: Record<EquipSlot, EquipmentDef[]> = {
  pc: PC_ITEMS,
  chair: CHAIR_ITEMS,
  misc: MISC_ITEMS,
};

/** 各スロットの初期装備（tier 0・cost 0・効果なし）。未装備社員のフォールバック。 */
export const DEFAULT_LOADOUT = {
  pc: 'pc-laptop',
  chair: 'chair-basic',
  misc: 'misc-none',
} as const;
