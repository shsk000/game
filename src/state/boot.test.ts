import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../core/ports';
import { INITIAL_CATEGORY_IDS } from '../data/categories';
import * as storage from '../utils/storage';
import { buildBootPatch, resolveBootDeps } from './boot';
import type { Work } from './types';

const NOW = 1_800_000_000_000; // 固定時刻
const deps = () => ({ rng: mulberry32(42), now: () => NOW });

const sellingWork = (over: Partial<Work> = {}): Work => ({
  id: 'w1',
  title: 'テスト作',
  genreId: 'puzzle',
  themeId: 'sushi',
  scale: 'mini',
  metascore: 60,
  isMasterpiece: false,
  developSec: 60,
  initialRevenue: 1000,
  salesPool: 100_000,
  initialSalesPool: 100_000,
  decayPerSec: 0.02,
  totalRevenue: 1000,
  selling: true,
  fansGained: 0,
  ghostBeaten: false,
  launchAdUsed: false,
  pioneer: false,
  releasedAt: 0,
  createdAt: 0,
  breakdown: {},
  ...over,
});

describe('buildBootPatch', () => {
  it('新規データ（離席なし）：オフラインレポートなし・トレンドが埋まる・候補はガチャ前なので空', () => {
    const p = { ...storage.defaults(), lastSeenAt: NOW };
    const patch = buildBootPatch(p, deps());
    expect(patch.offlineReport).toBeNull();
    expect(patch.funds).toBe(p.funds);
    // v0.22：無料の自動候補は廃止。ガチャを引くまで候補は無い
    expect(patch.candidate).toBeNull();
    expect(patch.gachaPity).toBe(0);
    expect(patch.trend?.expiresAt).toBeGreaterThan(NOW);
  });

  it('v0.22：セーブに残った開封済み候補・ピティは復元される', () => {
    const cand = { ...storage.defaults() };
    const saved = {
      ...cand,
      lastSeenAt: NOW,
      candidate: {
        id: 'c-saved',
        name: 'テスト 太郎',
        role: 'programmer' as const,
        rank: 'S' as const,
        power: 0.6,
        basePower: 0.6,
        level: 1,
        exp: 0,
        wage: 660_000,
        specialties: [], skills: {},
      },
      gachaPity: 13,
    };
    const patch = buildBootPatch(saved, deps());
    expect(patch.candidate?.id).toBe('c-saved');
    expect(patch.gachaPity).toBe(13);
  });

  it('離席中の販売分が資金・累計売上に合算され、レポートが付く', () => {
    const p = {
      ...storage.defaults(),
      funds: 1_000_000,
      lifetimeRevenue: 5_000_000,
      library: [sellingWork()],
      lastSeenAt: NOW - 100_000, // 100 秒離席
    };
    const patch = buildBootPatch(p, deps());
    expect(patch.offlineReport).not.toBeNull();
    const earned = patch.offlineReport?.earned ?? 0;
    expect(earned).toBeGreaterThan(0);
    expect(patch.funds).toBe(1_000_000 + earned);
    expect(patch.lifetimeRevenue).toBe(5_000_000 + earned);
    expect(patch.library?.[0].salesPool).toBeLessThan(100_000);
  });

  it('離席 60 秒未満はレポートなし・資金も増えない', () => {
    const p = {
      ...storage.defaults(),
      funds: 1_000_000,
      library: [sellingWork()],
      lastSeenAt: NOW - 30_000, // 30 秒
    };
    const patch = buildBootPatch(p, deps());
    expect(patch.offlineReport).toBeNull();
    expect(patch.funds).toBe(1_000_000);
  });

  it('旧データ防御：カテゴリが空なら初期3カテゴリを補完', () => {
    const p = { ...storage.defaults(), unlockedCategories: [], lastSeenAt: NOW };
    const patch = buildBootPatch(p, deps());
    expect(patch.unlockedCategories).toEqual([...INITIAL_CATEGORY_IDS]);
  });

  it('期限切れトレンドは補充され、有効なトレンドは維持される', () => {
    const expired = { genreId: 'puzzle', themeId: 'sushi', expiresAt: NOW - 1 } as const;
    const alive = { genreId: 'puzzle', themeId: 'sushi', expiresAt: NOW + 60_000 } as const;
    const base = { ...storage.defaults(), lastSeenAt: NOW };
    expect(buildBootPatch({ ...base, trend: expired }, deps()).trend?.expiresAt).toBeGreaterThan(
      NOW,
    );
    expect(buildBootPatch({ ...base, trend: alive }, deps()).trend).toEqual(alive);
  });

  it('同じ seed なら同じ結果（決定性）', () => {
    const p = { ...storage.defaults(), library: [sellingWork()], lastSeenAt: NOW - 100_000 };
    expect(buildBootPatch(p, deps())).toEqual(buildBootPatch(p, deps()));
  });
});

describe('resolveBootDeps', () => {
  it('?seed=NN で seed 固定乱数になる', () => {
    const a = resolveBootDeps('?seed=42');
    const b = resolveBootDeps('?seed=42');
    expect(a.rng()).toBe(b.rng());
    expect(a.rng).not.toBe(Math.random);
  });

  it('seed なし・不正な seed は本番乱数のまま', () => {
    expect(resolveBootDeps('').rng).toBe(Math.random);
    expect(resolveBootDeps('?seed=abc').rng).toBe(Math.random);
  });
});
