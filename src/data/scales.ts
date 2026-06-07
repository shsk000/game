export type Scale = 'mini' | 'mobile' | 'indie' | 'hit' | 'aaa';

export type ScaleDef = {
  id: Scale;
  name: string;
  requiredLoC: number;
  baseQuality: number;
  baseUnit: number;
  unlockCost: number;
};

/**
 * 数値は設計書 7-E ベース。MVP の打鍵単位（1フレーズ = 1LoC）に合わせて 1/10 スケール。
 * 設計上の 80/200/500/1000/2000 を 8/20/50/100/200 にリスケール。
 */
export const SCALES: ScaleDef[] = [
  { id: 'mini', name: 'ミニゲーム', requiredLoC: 8, baseQuality: 30, baseUnit: 100, unlockCost: 0 },
  {
    id: 'mobile',
    name: 'スマホゲーム',
    requiredLoC: 20,
    baseQuality: 35,
    baseUnit: 300,
    unlockCost: 1000,
  },
  {
    id: 'indie',
    name: 'インディー大作',
    requiredLoC: 50,
    baseQuality: 40,
    baseUnit: 800,
    unlockCost: 5000,
  },
  {
    id: 'hit',
    name: '話題作',
    requiredLoC: 100,
    baseQuality: 45,
    baseUnit: 1800,
    unlockCost: 20000,
  },
  {
    id: 'aaa',
    name: 'AAAタイトル',
    requiredLoC: 200,
    baseQuality: 50,
    baseUnit: 4000,
    unlockCost: 80000,
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
