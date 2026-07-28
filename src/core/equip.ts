import { CATEGORY_ORDER, type TicketCategory } from '../data/devPhrases';
import type { Employee, SkillSet } from '../state/types';
import { DEV_SKILL_IDS } from '../state/types';
import { SKILL_TO_TICKET } from './features';
import {
  EQUIPMENT_BY_ID,
  type EquipLoadout,
  type EquipmentDef,
  type EquipSlot,
} from '../data/equipment';

export type { EquipLoadout };

/**
 * v0.25 装備システムの純粋計算（v0.25（資料は削除済み） §4-2）。
 * 状態・乱数・時刻を持たない（logic-architecture §2）。
 *
 * 装備は社員単位（EquipLoadout）だが、devStats はプロジェクト単位の累積なので、
 * リリース時は「参加社員のロードアウトを集約した1組のカテゴリ倍率」を作って効かせる。
 */

/** カテゴリ別倍率（1.0 = 無強化）。 */
export type CategoryMul = Record<TicketCategory, number>;

const ONE_MUL = (): CategoryMul => ({ program: 1, graphics: 1, sound: 1, scenario: 1 });

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


/**
 * 装備を掛けた**実効スキル**（docs/spec/score-model.md §1）。
 *
 * ```
 * その分野の実効スキル ＝ スキル値 × 装備の倍率（3スロットの積）
 * ```
 *
 * **実効スキルは 100 を超えてよい。** スキル値そのものの上限は 100 だが、
 * ここに上限を置くとスキル100 の社員（S級Lv10）に装備が無意味になり、
 * 終盤に装備を買う理由が消える。特徴ポイント側が 0〜100 で頭打ちなので
 * スコアは壊れず、効果は「**特徴ポイントを速く積める**」＝開発が早く終わる＝固定費が安い、に出る。
 *
 * 固定値を足す方式は不採用：弱い社員に装備を回すのが効率的になり、育成と競合するため。
 * 倍率なら**育った社員に良い装備を持たせるほど効く**ので投資の方向が一致する。
 */
export const effectiveSkillsOf = (employee: Employee): SkillSet => {
  const mul = loadoutCategoryMul(employee.equipped ?? {});
  const out: SkillSet = { ...(employee.skills ?? {}) };
  for (const field of DEV_SKILL_IDS) {
    const v = out[field];
    if (!v) continue;
    out[field] = Math.round(v * mul[SKILL_TO_TICKET[field]] * 10) / 10;
  }
  return out;
};

/** 装備込みの社員一覧（特徴ポイントの計算はこれを通す） */
export const withEffectiveSkills = (employees: Employee[]): Employee[] =>
  employees.map((e) => ({ ...e, skills: effectiveSkillsOf(e) }));
