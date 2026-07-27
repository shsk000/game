import { describe, expect, it } from 'vitest';
import { GENRES } from '../data/genres';
import { THEMES } from '../data/themes';
import type { Work } from '../state/types';
import {
  computeStageUnlocks,
  evaluateAchievements,
  HIT_METASCORE_THRESHOLD,
} from './progression';

const work = (over: Partial<Work> = {}): Work => ({
  id: 'w',
  title: 't',
  genreId: 'puzzle',
  themeId: 'sushi',
  scale: 'mini',
  metascore: 50,
  isMasterpiece: false,
  developSec: 1,
  initialRevenue: 0,
  salesPool: 0,
  initialSalesPool: 0,
  decayPerSec: 0,
  totalRevenue: 0,
  selling: false,
  fansGained: 0,
  ghostBeaten: false,
  launchAdUsed: false,
  pioneer: false,
  releasedAt: 0,
  createdAt: 0,
  breakdown: {},
  ...over,
});

const hit = (id: string) => work({ id, metascore: HIT_METASCORE_THRESHOLD });

const STAGE1_GENRES = GENRES.filter((g) => g.unlockStage === 1).map((g) => g.id);
const STAGE1_THEMES = THEMES.filter((t) => t.unlockStage === 1).map((t) => t.id);

describe('computeStageUnlocks', () => {
  it('条件未達（売上 ¥1000 万未満・ヒット 0）では何も解放されない', () => {
    const r = computeStageUnlocks(STAGE1_GENRES, STAGE1_THEMES, [], 9_999_999);
    expect(r.unlocked).toBe(0);
  });

  it('累計売上 ¥1000 万ちょうどで stage2 解放（境界値）', () => {
    const r = computeStageUnlocks(STAGE1_GENRES, STAGE1_THEMES, [], 10_000_000);
    const expected = [
      ...GENRES.filter((g) => g.unlockStage === 2),
      ...THEMES.filter((t) => t.unlockStage === 2),
    ].length;
    expect(r.unlocked).toBe(expected);
  });

  it('ヒット作 1 本でも stage2 に届く（ハイブリッド条件）', () => {
    const r = computeStageUnlocks(STAGE1_GENRES, STAGE1_THEMES, [hit('h1')], 0);
    expect(r.unlocked).toBeGreaterThan(0);
  });

  it('ヒット作 5 本で stage4（全ジャンル/テーマ解放）', () => {
    const lib = ['h1', 'h2', 'h3', 'h4', 'h5'].map(hit);
    const r = computeStageUnlocks(STAGE1_GENRES, STAGE1_THEMES, lib, 0);
    expect(r.newGenres.length + STAGE1_GENRES.length).toBe(GENRES.length);
    expect(r.newThemes.length + STAGE1_THEMES.length).toBe(THEMES.length);
  });

  it('解放済みは重複しない', () => {
    const all = GENRES.map((g) => g.id);
    const allT = THEMES.map((t) => t.id);
    const r = computeStageUnlocks(all, allT, [], 999_999_999);
    expect(r.unlocked).toBe(0);
  });
});


describe('evaluateAchievements', () => {
  const base = { library: [], fans: 0, lifetimeRevenue: 0, bestCombo: 0 };

  it('初リリースで first-release、既得は newly に入らない', () => {
    const first = evaluateAchievements([], { ...base, library: [work()] });
    expect(first.newly).toContain('first-release');
    const second = evaluateAchievements(first.unlocked, { ...base, library: [work()] });
    expect(second.newly).toEqual([]);
    expect(second.unlocked).toContain('first-release');
  });

  it('しきい値系：combo-100 / fan-1k / million-yen（境界値）', () => {
    const r = evaluateAchievements([], {
      ...base,
      bestCombo: 100,
      fans: 1000,
      lifetimeRevenue: 1_000_000,
    });
    expect(r.newly).toEqual(expect.arrayContaining(['combo-100', 'fan-1k', 'million-yen']));
    const under = evaluateAchievements([], {
      ...base,
      bestCombo: 99,
      fans: 999,
      lifetimeRevenue: 999_999,
    });
    expect(under.newly).toEqual([]);
  });

  it('名作リリースで first-masterpiece、AAA リリースで aaa-released', () => {
    const master = work({ isMasterpiece: true });
    const aaa = work({ scale: 'aaa' });
    const r = evaluateAchievements([], { ...base, library: [master, aaa], lastWork: master });
    expect(r.newly).toEqual(expect.arrayContaining(['first-masterpiece', 'aaa-released']));
  });
});
