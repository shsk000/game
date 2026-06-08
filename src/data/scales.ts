export type Scale = 'mini' | 'mobile' | 'indie' | 'hit' | 'aaa';

export type ScaleDef = {
  id: Scale;
  name: string;
  requiredLoC: number;
  baseQuality: number;
  baseUnit: number;
  unlockCost: number;
  /**
   * v0.10：標準必要週数。タイピング/能力/広告で前後する。
   * 1ヶ月=4週、1年=48週。
   *  - mini   8週(2ヶ月)
   *  - mobile 12週(3ヶ月)
   *  - indie  20週(5ヶ月)
   *  - hit    28週(7ヶ月)
   *  - aaa    36週(9ヶ月)
   */
  neededWeeks: number;
  /**
   * v0.10：開発の基本開発費（円）。
   *  - mini   ¥100,000
   *  - mobile ¥1,000,000
   *  - indie  ¥10,000,000
   *  - hit    ¥100,000,000
   *  - aaa    ¥1,000,000,000
   */
  baseCost: number;
  /**
   * v0.10：オフィス賃料（月額・円）。
   * 規模が大きい開発を抱えるほど月々の固定費が膨らむ。
   */
  monthlyRent: number;
};

/**
 * 数値は設計書 7-E ベース。MVP の打鍵単位（1フレーズ = 1LoC）に合わせて 1/10 スケール。
 * 設計上の 80/200/500/1000/2000 を 8/20/50/100/200 にリスケール。
 *
 * v0.10：neededWeeks / baseCost / monthlyRent を追加。
 * baseUnit は v0.10 で × 10,000 倍にリスケール（売上規模の現実化のため）。
 */
export const SCALES: ScaleDef[] = [
  {
    id: 'mini',
    name: 'ミニゲーム',
    requiredLoC: 8,
    baseQuality: 30,
    baseUnit: 1_000_000,
    unlockCost: 0,
    neededWeeks: 8,
    baseCost: 100_000,
    monthlyRent: 50_000,
  },
  {
    id: 'mobile',
    name: 'スマホゲーム',
    requiredLoC: 20,
    baseQuality: 35,
    baseUnit: 3_000_000,
    unlockCost: 10_000_000,
    neededWeeks: 12,
    baseCost: 1_000_000,
    monthlyRent: 150_000,
  },
  {
    id: 'indie',
    name: 'インディー大作',
    requiredLoC: 50,
    baseQuality: 40,
    baseUnit: 8_000_000,
    unlockCost: 50_000_000,
    neededWeeks: 20,
    baseCost: 10_000_000,
    monthlyRent: 150_000,
  },
  {
    id: 'hit',
    name: '話題作',
    requiredLoC: 100,
    baseQuality: 45,
    baseUnit: 18_000_000,
    unlockCost: 200_000_000,
    neededWeeks: 28,
    baseCost: 100_000_000,
    monthlyRent: 500_000,
  },
  {
    id: 'aaa',
    name: 'AAAタイトル',
    requiredLoC: 200,
    baseQuality: 50,
    baseUnit: 40_000_000,
    unlockCost: 800_000_000,
    neededWeeks: 36,
    baseCost: 1_000_000_000,
    monthlyRent: 2_000_000,
  },
];

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
