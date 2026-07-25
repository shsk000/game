import { CATEGORY_ORDER, type TicketCategory } from '../data/devPhrases';
import {
  EQUIPMENT_BY_ID,
  type EquipLoadout,
  type EquipmentDef,
  type EquipSlot,
} from '../data/equipment';

export type { EquipLoadout };

/**
 * v0.25 装備システムの純粋計算（docs/v25/spec.md §4-2）。
 * 状態・乱数・時刻を持たない（logic-architecture §2）。
 *
 * 装備は社員単位（EquipLoadout）だが、devStats はプロジェクト単位の累積なので、
 * リリース時は「参加社員のロードアウトを集約した1組のカテゴリ倍率」を作って効かせる。
 */

/** カテゴリ別倍率（1.0 = 無強化）。 */
export type CategoryMul = Record<TicketCategory, number>;

const ONE_MUL = (): CategoryMul => ({ program: 1, graphics: 1, sound: 1, design: 1 });

/**
 * 社員1人のロードアウト → カテゴリ別倍率。
 * 各スロットの categoryMul を**カテゴリごとに掛け合わせる**（例 PC:program1.2 × チェア:program1.05）。
 * 不明IDは無視（1.0 扱い）＝旧セーブ・データ欠損に強い。
 */
export const loadoutCategoryMul = (
  loadout: EquipLoadout,
  byId: Record<string, EquipmentDef> = EQUIPMENT_BY_ID,
): CategoryMul => {
  const mul = ONE_MUL();
  for (const slot of ['pc', 'chair', 'misc'] as EquipSlot[]) {
    const id = loadout[slot];
    if (!id) continue;
    const def = byId[id];
    if (!def?.categoryMul) continue;
    for (const cat of CATEGORY_ORDER) {
      const m = def.categoryMul[cat];
      if (m) mul[cat] *= m;
    }
  }
  return mul;
};

/**
 * 参加社員のロードアウト群 → プロジェクト1組のカテゴリ倍率（集約）。
 * 集約は「増分(mul-1)の平均」= 1 + mean(perEmp - 1)。
 *  - チーム全員が良いPCなら program の増分が満額、半分だけなら半分になる（人数に依存しない）。
 *  - 空配列（誰もいない）は全カテゴリ 1.0。
 */
export const computeEquipCategoryMul = (
  loadouts: EquipLoadout[],
  byId: Record<string, EquipmentDef> = EQUIPMENT_BY_ID,
): CategoryMul => {
  if (loadouts.length === 0) return ONE_MUL();
  const acc: CategoryMul = { program: 0, graphics: 0, sound: 0, design: 0 };
  for (const lo of loadouts) {
    const m = loadoutCategoryMul(lo, byId);
    for (const cat of CATEGORY_ORDER) acc[cat] += m[cat] - 1;
  }
  const out = ONE_MUL();
  for (const cat of CATEGORY_ORDER) out[cat] = 1 + acc[cat] / loadouts.length;
  return out;
};

/** 装備の購入価格（現状はテーブルの cost をそのまま。将来ティア/規模連動を挟む余地）。 */
export const equipmentPrice = (def: EquipmentDef): number => def.cost;

/**
 * 購入できるか。初期装備（cost 0）は購入対象外、資金が価格以上あれば可。
 * v0.25 は実体方式（1個=1社員ぶん）なので、既に所有していても追加購入できる（＝ここでは所有数を見ない）。
 */
export const canBuyEquipment = (args: { def: EquipmentDef; funds: number }): boolean => {
  const price = equipmentPrice(args.def);
  if (price <= 0) return false;
  return args.funds >= price;
};

/** 装備の所有数マップ（itemId → 購入済み個数）。実体方式：1個=1社員ぶん。 */
export type OwnedItems = Record<string, number>;

/** その itemId を今どこかのスロットに割り当てている数（＝使用中の個数）。 */
export const countAssigned = (loadouts: EquipLoadout[], itemId: string): number =>
  loadouts.reduce(
    (n, lo) => n + (['pc', 'chair', 'misc'] as EquipSlot[]).filter((s) => lo[s] === itemId).length,
    0,
  );

/** 空き個数（購入済み − 使用中）。0 以下なら新たに別の社員へは装備できない。 */
export const freeCopies = (owned: OwnedItems, loadouts: EquipLoadout[], itemId: string): number =>
  (owned[itemId] ?? 0) - countAssigned(loadouts, itemId);
