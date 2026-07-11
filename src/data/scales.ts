import { MONTHLY_RENT, SCALE_BALANCE } from './balance';

export type Scale = 'mini' | 'mobile' | 'indie' | 'hit' | 'aaa';

export type ScaleDef = {
  id: Scale;
  name: string;
  requiredLoC: number;
  baseQuality: number;
  baseUnit: number;
  unlockCost: number;
  /** v0.18：解放に必要な累計売上（これまで未参照の死に設定だったのを有効化） */
  unlockSalesRequired: number;
  /** v0.10：標準必要週数。balance.ts から引く */
  neededWeeks: number;
  /** v0.10：開発の基本開発費（円）。balance.ts から引く（旧 baseCost） */
  baseCost: number;
  /** v0.10 仕上げ：賃料は規模に関係なく一律（balance.ts MONTHLY_RENT）。
   *  互換のため ScaleDef にも残す（全規模で同じ値）。 */
  monthlyRent: number;
};

/**
 * v0.10 仕上げ：balance.ts に集約された数値を SCALES に展開する。
 *
 * 旧バージョンでは scales.ts に数値が直接書かれていたが、ゲームバランス調整を
 * 1 ファイルに集約するため balance.ts に移行。ScaleDef の型は互換維持。
 *
 * - requiredLoC, baseQuality, baseUnit は scales.ts ローカルで保持（balance に未含）
 *   ※ requiredLoC は時間ベース完了の現在は副指標、進捗バー表示用
 * - neededWeeks, baseCost, monthlyRent は balance.ts から引く
 * - unlockCost は balance.ts の unlockCost を踏襲
 */
export const SCALES: ScaleDef[] = (['mini', 'mobile', 'indie', 'hit', 'aaa'] as Scale[]).map(
  (id) => {
    const b = SCALE_BALANCE[id];
    const meta: Record<
      Scale,
      { name: string; requiredLoC: number; baseQuality: number; baseUnit: number }
    > = {
      mini: { name: 'ミニゲーム', requiredLoC: 8, baseQuality: 30, baseUnit: 1_000_000 },
      mobile: { name: 'スマホゲーム', requiredLoC: 20, baseQuality: 35, baseUnit: 3_000_000 },
      indie: { name: 'インディー大作', requiredLoC: 50, baseQuality: 40, baseUnit: 8_000_000 },
      hit: { name: '話題作', requiredLoC: 100, baseQuality: 45, baseUnit: 18_000_000 },
      aaa: { name: 'AAAタイトル', requiredLoC: 200, baseQuality: 50, baseUnit: 40_000_000 },
    };
    return {
      id,
      name: meta[id].name,
      requiredLoC: meta[id].requiredLoC,
      baseQuality: meta[id].baseQuality,
      baseUnit: meta[id].baseUnit,
      unlockCost: b.unlockCost,
      unlockSalesRequired: b.unlockSalesRequired,
      neededWeeks: b.neededWeeks,
      baseCost: b.devCost,
      monthlyRent: MONTHLY_RENT, // 一律
    };
  },
);

export const SCALE_BY_ID: Record<Scale, ScaleDef> = SCALES.reduce(
  (acc, s) => {
    acc[s.id] = s;
    return acc;
  },
  {} as Record<Scale, ScaleDef>,
);

export const nextLockedScale = (unlocked: Scale[]): ScaleDef | null => {
  for (const s of SCALES) {
    if (!unlocked.includes(s.id)) return s;
  }
  return null;
};
