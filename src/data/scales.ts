export type Scale = 'mini' | 'mobile' | 'indie';

export type ScaleDef = {
  id: Scale;
  name: string;
  requiredLoC: number;
  baseQuality: number;
  baseUnit: number;
  unlockCost: number;
};

export const SCALES: ScaleDef[] = [
  { id: 'mini',   name: 'ミニゲーム',     requiredLoC: 5,  baseQuality: 30, baseUnit: 100,  unlockCost: 0 },
  { id: 'mobile', name: 'スマホゲーム',   requiredLoC: 10, baseQuality: 35, baseUnit: 300,  unlockCost: 1000 },
  { id: 'indie',  name: 'インディー大作', requiredLoC: 20, baseQuality: 40, baseUnit: 1000, unlockCost: 3000 },
];

export const SCALE_BY_ID: Record<Scale, ScaleDef> = SCALES.reduce((acc, s) => {
  acc[s.id] = s;
  return acc;
}, {} as Record<Scale, ScaleDef>);

export const nextLockedScale = (unlocked: Scale[]): ScaleDef | null => {
  for (const s of SCALES) {
    if (!unlocked.includes(s.id)) return s;
  }
  return null;
};
