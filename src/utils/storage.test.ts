import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { INITIAL_FUNDS } from '../data/balance';
import { INITIAL_CATEGORY_IDS } from '../data/categories';
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
    expect(d.unlockedGenres).toEqual(['puzzle', 'adventure', 'simulation']);
    expect(d.unlockedThemes).toEqual(['sushi', 'onsen', 'farming']);
    expect(d.unlockedCategories).toEqual([...INITIAL_CATEGORY_IDS]);
    expect(d.version).toBe(5);
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

  it('reset で消える', () => {
    storage.save(storage.defaults());
    storage.reset();
    expect(storage.load()).toBeNull();
  });
});

describe('v4 → v5 マイグレーション', () => {
  it('金額が ×10,000 され、v4 キーは削除される', () => {
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
    expect(loaded?.lifetimeRevenue).toBe(10_000_000);
    expect(loaded?.records.bestRevenue).toBe(2_000_000);
    expect(loaded?.fans).toBe(10);
    // v5 として保存し直され、旧キーは消える
    expect(mem.getItem('typing-factory:v4')).toBeNull();
    expect(mem.getItem('typing-factory:v5')).not.toBeNull();
  });

  it('壊れた JSON は null（クラッシュしない）', () => {
    mem.setItem('typing-factory:v5', '{broken json');
    expect(storage.load()).toBeNull();
  });
});
