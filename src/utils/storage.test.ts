import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { computeMonthlyWage, INITIAL_FUNDS } from '../data/balance';
import { INITIAL_CATEGORY_IDS } from '../data/categories';
import { INITIAL_GENRE_IDS } from '../data/genres';
import { INITIAL_THEME_IDS } from '../data/themes';
import * as storage from './storage';

/** node 環境用のインメモリ localStorage（testing-rules：storage はスタブで差し替える） */
const makeMemoryStorage = () => {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    get length() {
      return map.size;
    },
  } satisfies Storage;
};

let mem: ReturnType<typeof makeMemoryStorage>;

beforeEach(() => {
  mem = makeMemoryStorage();
  vi.stubGlobal('localStorage', mem);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('defaults', () => {
  it('初期資金は balance.ts の INITIAL_FUNDS、初期解放は stage1 のみ', () => {
    const d = storage.defaults();
    expect(d.funds).toBe(INITIAL_FUNDS);
    expect(d.unlockedScales).toEqual(['mini']);
    expect(d.unlockedGenres).toEqual([...INITIAL_GENRE_IDS]);
    expect(d.unlockedThemes).toEqual([...INITIAL_THEME_IDS]);
    expect(d.unlockedCategories).toEqual([...INITIAL_CATEGORY_IDS]);
    expect(d.version).toBe(7);
  });
});

describe('save / load（v5 往復）', () => {
  it('保存したデータがそのまま読み戻せる', () => {
    const d = { ...storage.defaults(), funds: 123_456, fans: 42 };
    storage.save(d);
    const loaded = storage.load();
    expect(loaded?.funds).toBe(123_456);
    expect(loaded?.fans).toBe(42);
  });

  it('セーブが無ければ null', () => {
    expect(storage.load()).toBeNull();
  });

  it('カテゴリが空の旧 v5 データは初期3カテゴリに補完される', () => {
    const d = { ...storage.defaults(), unlockedCategories: [] };
    storage.save(d as ReturnType<typeof storage.defaults>);
    expect(storage.load()?.unlockedCategories).toEqual([...INITIAL_CATEGORY_IDS]);
  });

  it('ライブラリで使用済みのジャンル/テーマは解放が維持される（v0.10 再ロック仕様）', () => {
    const d = storage.defaults();
    const work = {
      id: 'w',
      title: 't',
      genreId: 'action',
      themeId: 'ninja',
      scale: 'mini',
      quality: 50,
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
    } as const;
    storage.save({
      ...d,
      library: [work],
      unlockedGenres: ['action', 'puzzle'],
      unlockedThemes: ['ninja'],
    });
    const loaded = storage.load();
    // 初期解放 + 使用済み（action/ninja）は残る
    expect(loaded?.unlockedGenres).toContain('action');
    expect(loaded?.unlockedThemes).toContain('ninja');
    expect(loaded?.unlockedGenres).toContain('puzzle');
  });

  it('ステージ解放したジャンル/テーマはリロードで巻き戻らない（v0.17.1 回帰）', () => {
    const d = storage.defaults();
    storage.save({
      ...d,
      unlockedGenres: [...d.unlockedGenres, 'action'],
      unlockedThemes: [...d.unlockedThemes, 'ninja'],
    });
    const loaded = storage.load();
    expect(loaded?.unlockedGenres).toContain('action');
    expect(loaded?.unlockedThemes).toContain('ninja');
  });

  it('reset で消える', () => {
    storage.save(storage.defaults());
    storage.reset();
    expect(storage.load()).toBeNull();
  });
});

describe('v5 → v7 マイグレーション（v0.16 power 正規化 + v0.18 累計圧縮）', () => {
  it('旧 power が役割別スケールから 0..1 に正規化され、成長フィールドが付く', () => {
    mem.setItem(
      'typing-factory:v5',
      JSON.stringify({
        ...storage.defaults(),
        version: 5,
        employees: [
          { id: 'p', name: 'プログラマ', role: 'programmer', power: 1.2, wage: 0, specialties: [] },
          { id: 'd', name: 'デザイナ', role: 'designer', power: 5, wage: 0, specialties: [] },
          { id: 'r', name: '広報', role: 'pr', power: 20, wage: 0, specialties: [] },
        ],
      }),
    );
    const loaded = storage.load();
    expect(loaded).not.toBeNull();
    const [p, d, r] = loaded?.employees ?? [];
    expect(p.power).toBe(1); // 1.2 / 1.2
    expect(d.power).toBe(0.5); // 5 / 10
    expect(r.power).toBe(1); // 20 / 20
    for (const e of [p, d, r]) {
      expect(e.level).toBe(1);
      expect(e.exp).toBe(0);
      expect(e.basePower).toBe(e.power);
      expect(e.wage).toBe(Math.round(computeMonthlyWage(e.power)));
    }
    // v7 として保存し直され、旧キーは消える
    expect(mem.getItem('typing-factory:v5')).toBeNull();
    expect(mem.getItem('typing-factory:v7')).not.toBeNull();
    expect(loaded?.version).toBe(7);
  });

  it('資金・ライブラリ等の進行は保持される', () => {
    mem.setItem(
      'typing-factory:v5',
      JSON.stringify({
        ...storage.defaults(),
        version: 5,
        funds: 123_456,
        fans: 42,
        employees: [],
      }),
    );
    const loaded = storage.load();
    expect(loaded?.funds).toBe(123_456);
    expect(loaded?.fans).toBe(42);
  });
});

describe('v6 → v7 マイグレーション（v0.18 旧経済の圧縮）', () => {
  it('累計売上が ÷100 され、解放が圧縮後の累計で再計算される', () => {
    const d = storage.defaults();
    mem.setItem(
      'typing-factory:v6',
      JSON.stringify({
        ...d,
        version: 6,
        lifetimeRevenue: 150_000_000, // 旧経済の ¥1.5 億 → ¥150 万
        unlockedScales: ['mini', 'mobile', 'indie', 'hit', 'aaa'],
        unlockedGenres: ['puzzle', 'adventure', 'simulation', 'action', 'rpg', 'horror'],
        unlockedThemes: ['sushi', 'onsen', 'farming', 'ninja', 'zombie'],
      }),
    );
    const loaded = storage.load();
    expect(loaded?.version).toBe(7);
    expect(loaded?.lifetimeRevenue).toBe(1_500_000);
    // ¥150 万では mobile（¥3000 万）に届かない → mini のみに再ロック
    expect(loaded?.unlockedScales).toEqual(['mini']);
    // ジャンル/テーマも stage1 に戻る（library 未使用のため）
    expect(loaded?.unlockedGenres).toEqual(d.unlockedGenres);
    expect(loaded?.unlockedThemes).toEqual(d.unlockedThemes);
    expect(mem.getItem('typing-factory:v6')).toBeNull();
  });
});

describe('v4 → v7 マイグレーション', () => {
  it('金額が ×10,000 → 累計は ÷100 圧縮され、v4 キーは削除される', () => {
    mem.setItem(
      'typing-factory:v4',
      JSON.stringify({
        version: 4,
        funds: 500, // 旧単位 → ¥500 万
        lifetimeRevenue: 1000,
        fans: 10,
        employees: [],
        library: [],
        records: { bestMetascore: 70, bestRevenue: 200, bestCombo: 50, bestWPM: 120 },
      }),
    );
    const loaded = storage.load();
    expect(loaded).not.toBeNull();
    expect(loaded?.funds).toBe(5_000_000);
    // 旧経済圧縮込み：×10,000 → ÷100 = ×100
    expect(loaded?.lifetimeRevenue).toBe(100_000);
    expect(loaded?.records.bestRevenue).toBe(2_000_000);
    expect(loaded?.fans).toBe(10);
    // v7 として保存し直され、旧キーは消える
    expect(mem.getItem('typing-factory:v4')).toBeNull();
    expect(mem.getItem('typing-factory:v7')).not.toBeNull();
  });

  it('壊れた JSON は null（クラッシュしない）', () => {
    mem.setItem('typing-factory:v7', '{broken json');
    expect(storage.load()).toBeNull();
  });
});
