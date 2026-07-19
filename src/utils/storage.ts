import { computeStageUnlocks } from '../core/progression';
import { computeMonthlyWage, INITIAL_FUNDS, SCALE_BALANCE } from '../data/balance';
import type { CategoryId } from '../data/categories';
import { INITIAL_CATEGORY_IDS } from '../data/categories';
import type { GenreId } from '../data/genres';
import { INITIAL_GENRE_IDS } from '../data/genres';
import type { Scale } from '../data/scales';
import type { ThemeId } from '../data/themes';
import { INITIAL_THEME_IDS } from '../data/themes';
import type { Trend } from '../data/trend';
import type { Achievement, Employee, GameDate, Work, WorkBreakdown } from '../state/types';
import { INITIAL_GAME_DATE } from '../state/types';

/**
 * v7（v0.18）で導入：
 *  - 旧経済（v0.15 以前）で稼いだ lifetimeRevenue を ÷100 に圧縮し、
 *    規模・ジャンル・テーマの解放を圧縮後の累計で再計算（新バランスの進行カーブに乗せる）
 * v6（v0.16）で導入：
 *  - Employee の power を全役割共通の 0..1 正規化スケールに換算
 *    （旧: プログラマー0.3〜1.2 / デザイナー2〜10 / 広報5〜20）
 *  - Employee に basePower / level / exp を追加（社員成長システム）
 * v5 で導入：
 *  - currentDate（ゲーム内日付・週単位）
 *  - 金額を v0.10 の桁感に合わせて ×10,000（records.bestRevenue 含む）
 */
const KEY = 'typing-factory:v7';
const LEGACY_KEY_V6 = 'typing-factory:v6';
const LEGACY_KEY_V5 = 'typing-factory:v5';
const LEGACY_KEY_V4 = 'typing-factory:v4';
const LEGACY_KEY_V3 = 'typing-factory:v3';
const LEGACY_KEY_V2 = 'typing-factory:v2';
const LEGACY_KEY_V1 = 'typing-factory:v1';

/** v0.9→v0.10 の桁変換係数。spec.md §6 参照 */
const V10_MONEY_MULTIPLIER = 10_000;

export type Records = {
  bestMetascore: number;
  bestRevenue: number;
  bestCombo: number;
  bestWPM: number;
};

export type Persisted = {
  version: 7;
  funds: number;
  lifetimeRevenue: number;
  fans: number;
  employees: Employee[];
  unlockedScales: Scale[];
  unlockedGenres: GenreId[];
  unlockedThemes: ThemeId[];
  unlockedCategories: CategoryId[];
  ghosts: Record<Scale, number | null>;
  library: Work[];
  trend: Trend | null;
  records: Records;
  achievements: Achievement[];
  tutorialDone: boolean;
  lastSeenAt: number;
  currentDate: GameDate;
  /** v0.21 投資：先行購入した累計回数（価格の逓増カーブ計算に使う。旧セーブは 0 に既定） */
  investPurchaseCount: number;
  /** v0.24：効果音ミュート（旧セーブは false 既定） */
  muted: boolean;
  /** v0.24：効果音音量 0..1（旧セーブは 1 既定） */
  volume: number;
};

const emptyGhostsRecord = (): Record<Scale, number | null> => ({
  mini: null,
  mobile: null,
  indie: null,
  hit: null,
  aaa: null,
});

const defaultBreakdown = (): WorkBreakdown => ({
  base: 30,
  categories: 0,
  employees: 0,
  performance: 0,
  ads: 0,
  variance: 0,
});

export const defaults = (): Persisted => ({
  version: 7,
  // v0.10 仕上げ：初期資金は balance.ts INITIAL_FUNDS（¥500 万）に統一。
  // 失敗 2-3 本で詰む緊張感（balance-design §0、§5-4）。
  funds: INITIAL_FUNDS,
  lifetimeRevenue: 0,
  fans: 0,
  employees: [],
  unlockedScales: ['mini'],
  // v0.10 仕上げ：初期解放は「人気無い・単純」ジャンル / テーマのみ。
  // ファンタジー・SF・忍者などの人気テーマは終盤解放。
  unlockedGenres: [...INITIAL_GENRE_IDS],
  unlockedThemes: [...INITIAL_THEME_IDS],
  unlockedCategories: [...INITIAL_CATEGORY_IDS],
  ghosts: emptyGhostsRecord(),
  library: [],
  trend: null,
  records: { bestMetascore: 0, bestRevenue: 0, bestCombo: 0, bestWPM: 0 },
  achievements: [],
  tutorialDone: false,
  lastSeenAt: Date.now(),
  currentDate: { ...INITIAL_GAME_DATE },
  investPurchaseCount: 0,
  muted: false,
  volume: 1,
});

type LegacyWork = Partial<Work> & {
  id: string;
  revenue?: number;
};

const ensureWorkBreakdown = (w: Work): Work => {
  if (w.breakdown) return w;
  return { ...w, breakdown: defaultBreakdown() };
};

const migrateWorkV2 = (w: LegacyWork): Work => {
  // v2 では revenue が一括加算で確定済 → v3 形式に合わせて販売は完売扱い
  const total = w.totalRevenue ?? w.revenue ?? 0;
  return {
    id: w.id,
    title: w.title ?? '',
    genreId: (w.genreId ?? 'action') as Work['genreId'],
    themeId: (w.themeId ?? 'fantasy') as Work['themeId'],
    scale: (w.scale ?? 'mini') as Work['scale'],
    quality: w.quality ?? 0,
    metascore: w.metascore ?? 0,
    isMasterpiece: w.isMasterpiece ?? false,
    developSec: w.developSec ?? 0,
    initialRevenue: total,
    salesPool: 0,
    initialSalesPool: 0,
    decayPerSec: 0,
    totalRevenue: total,
    selling: false,
    fansGained: w.fansGained ?? 0,
    ghostBeaten: w.ghostBeaten ?? false,
    launchAdUsed: w.launchAdUsed ?? false,
    pioneer: false,
    releasedAt: w.createdAt ?? Date.now(),
    createdAt: w.createdAt ?? Date.now(),
    breakdown: w.breakdown ?? defaultBreakdown(),
    selectedCategories: w.selectedCategories,
  };
};

/** v5 以前の Employee（power が旧・役割別スケール。成長フィールドなし） */
type LegacyEmployeeV5 = Omit<Employee, 'basePower' | 'level' | 'exp'> &
  Partial<Pick<Employee, 'basePower' | 'level' | 'exp'>>;

type LegacyEmployeeV3 = Omit<LegacyEmployeeV5, 'specialties'> & {
  specialties?: Employee['specialties'];
};

const migrateEmployeeFromV3 = (e: LegacyEmployeeV3): LegacyEmployeeV5 => ({
  ...e,
  specialties: e.specialties ?? [],
});

/**
 * v5→v6（v0.16）：旧 power（役割別スケール）を 0..1 に正規化し、成長フィールドを付与。
 * 既存社員は Lv1・素質＝正規化後の power として引き継ぐ。月給も新式で再計算。
 */
const OLD_POWER_MAX: Record<Employee['role'], number> = {
  programmer: 1.2,
  designer: 10,
  pr: 20,
};

const normalizeEmployeeV6 = (e: LegacyEmployeeV5): Employee => {
  if (e.basePower !== undefined && e.level !== undefined && e.exp !== undefined) {
    return e as Employee; // すでに v6 形式
  }
  const raw = e.power / (OLD_POWER_MAX[e.role] ?? 1);
  const power = Math.min(1, Math.max(0.05, Math.round(raw * 100) / 100));
  return {
    ...e,
    power,
    basePower: power,
    level: 1,
    exp: 0,
    wage: Math.round(computeMonthlyWage(power)),
  };
};

/** v0.9 → v0.10 用：work の金額を ×10,000 倍する */
const rescaleWorkForV10 = (w: Work): Work => ({
  ...w,
  initialRevenue: Math.round(w.initialRevenue * V10_MONEY_MULTIPLIER),
  salesPool: Math.round(w.salesPool * V10_MONEY_MULTIPLIER),
  initialSalesPool: Math.round(w.initialSalesPool * V10_MONEY_MULTIPLIER),
  totalRevenue: Math.round(w.totalRevenue * V10_MONEY_MULTIPLIER),
});

/** v0.9（version=4）→ v0.10（version=5）の移行。 */
const migrateFromV4 = (raw: string): Persisted | null => {
  try {
    const old = JSON.parse(raw) as Partial<Persisted> & {
      version?: number;
      employees?: LegacyEmployeeV3[];
      library?: LegacyWork[];
    };
    const base = defaults();
    const employees: Employee[] = Array.isArray(old.employees)
      ? (old.employees as LegacyEmployeeV3[]).map(migrateEmployeeFromV3).map(normalizeEmployeeV6)
      : [];
    const library: Work[] = Array.isArray(old.library)
      ? (old.library as LegacyWork[])
          .map((w) => ensureWorkBreakdown(migrateWorkV2(w)))
          .map(rescaleWorkForV10)
      : [];
    const oldRecords = old.records ?? base.records;
    const records: Records = {
      ...oldRecords,
      bestRevenue: Math.round((oldRecords.bestRevenue ?? 0) * V10_MONEY_MULTIPLIER),
    };
    return {
      ...base,
      funds: Math.round((old.funds ?? 0) * V10_MONEY_MULTIPLIER),
      lifetimeRevenue: Math.round((old.lifetimeRevenue ?? 0) * V10_MONEY_MULTIPLIER),
      fans: old.fans ?? 0,
      employees,
      unlockedScales: (old.unlockedScales ?? base.unlockedScales) as Scale[],
      unlockedGenres: (old.unlockedGenres ?? base.unlockedGenres) as GenreId[],
      unlockedThemes: (old.unlockedThemes ?? base.unlockedThemes) as ThemeId[],
      unlockedCategories:
        old.unlockedCategories && old.unlockedCategories.length > 0
          ? (old.unlockedCategories as CategoryId[])
          : [...INITIAL_CATEGORY_IDS],
      ghosts: { ...base.ghosts, ...(old.ghosts ?? {}) } as Record<Scale, number | null>,
      library,
      trend: old.trend ?? null,
      records,
      achievements: old.achievements ?? base.achievements,
      tutorialDone: old.tutorialDone ?? false,
      lastSeenAt: old.lastSeenAt ?? Date.now(),
      currentDate: { ...INITIAL_GAME_DATE },
    };
  } catch {
    return null;
  }
};

const migrateFromV3 = (raw: string): Persisted | null => {
  // v3 はまず v4 形式へ寄せて、その後 v5 へ
  try {
    const old = JSON.parse(raw) as Partial<Persisted> & {
      employees?: LegacyEmployeeV3[];
      library?: LegacyWork[];
    };
    const base = defaults();
    const employees: Employee[] = Array.isArray(old.employees)
      ? old.employees.map(migrateEmployeeFromV3).map(normalizeEmployeeV6)
      : [];
    const library: Work[] = Array.isArray(old.library)
      ? old.library.map((w) => ensureWorkBreakdown(migrateWorkV2(w))).map(rescaleWorkForV10)
      : [];
    const oldRecords = old.records ?? base.records;
    const records: Records = {
      ...oldRecords,
      bestRevenue: Math.round((oldRecords.bestRevenue ?? 0) * V10_MONEY_MULTIPLIER),
    };
    return {
      ...base,
      funds: Math.round((old.funds ?? 0) * V10_MONEY_MULTIPLIER),
      lifetimeRevenue: Math.round((old.lifetimeRevenue ?? 0) * V10_MONEY_MULTIPLIER),
      fans: old.fans ?? 0,
      employees,
      unlockedScales: (old.unlockedScales ?? base.unlockedScales) as Scale[],
      unlockedGenres: (old.unlockedGenres ?? base.unlockedGenres) as GenreId[],
      unlockedThemes: (old.unlockedThemes ?? base.unlockedThemes) as ThemeId[],
      unlockedCategories: [...INITIAL_CATEGORY_IDS],
      ghosts: { ...base.ghosts, ...(old.ghosts ?? {}) } as Record<Scale, number | null>,
      library,
      trend: old.trend ?? null,
      records,
      achievements: old.achievements ?? base.achievements,
      tutorialDone: old.tutorialDone ?? false,
      lastSeenAt: old.lastSeenAt ?? Date.now(),
      currentDate: { ...INITIAL_GAME_DATE },
    };
  } catch {
    return null;
  }
};

const migrateFromV2 = (raw: string): Persisted | null => {
  try {
    const old = JSON.parse(raw) as Partial<Persisted> & {
      employees?: number | LegacyEmployeeV5[];
      library?: LegacyWork[];
    };
    const base = defaults();
    const employees: Employee[] = Array.isArray(old.employees)
      ? (old.employees as LegacyEmployeeV5[])
          .map((e) => ({ ...e, specialties: e.specialties ?? [] }))
          .map(normalizeEmployeeV6)
      : [];
    const library: Work[] = (old.library ?? []).map(migrateWorkV2).map(rescaleWorkForV10);
    const oldRecords = old.records ?? base.records;
    const records: Records = {
      ...oldRecords,
      bestRevenue: Math.round((oldRecords.bestRevenue ?? 0) * V10_MONEY_MULTIPLIER),
    };
    return {
      ...base,
      funds: Math.round((old.funds ?? 0) * V10_MONEY_MULTIPLIER),
      lifetimeRevenue: Math.round((old.lifetimeRevenue ?? 0) * V10_MONEY_MULTIPLIER),
      fans: old.fans ?? 0,
      employees,
      unlockedScales: (old.unlockedScales ?? ['mini']) as Scale[],
      unlockedGenres: (old.unlockedGenres ?? base.unlockedGenres) as GenreId[],
      unlockedThemes: (old.unlockedThemes ?? base.unlockedThemes) as ThemeId[],
      unlockedCategories: [...INITIAL_CATEGORY_IDS],
      ghosts: { ...base.ghosts, ...(old.ghosts ?? {}) } as Record<Scale, number | null>,
      library,
      trend: old.trend ?? null,
      records,
      currentDate: { ...INITIAL_GAME_DATE },
    };
  } catch {
    return null;
  }
};

const migrateFromV1 = (raw: string): Persisted | null => {
  try {
    const old = JSON.parse(raw) as {
      funds?: number;
      employees?: number;
      unlockedScales?: Scale[];
      ghosts?: Record<string, number | null>;
      library?: LegacyWork[];
    };
    const base = defaults();
    return {
      ...base,
      funds: Math.round((old.funds ?? 0) * V10_MONEY_MULTIPLIER),
      unlockedScales: (old.unlockedScales ?? ['mini']) as Scale[],
      unlockedCategories: [...INITIAL_CATEGORY_IDS],
      ghosts: { ...base.ghosts, ...(old.ghosts ?? {}) } as Record<Scale, number | null>,
      library: (old.library ?? []).map(migrateWorkV2).map(rescaleWorkForV10),
      currentDate: { ...INITIAL_GAME_DATE },
    };
  } catch {
    return null;
  }
};

/**
 * v6→v7（v0.18）：旧経済の荒稼ぎ圧縮と解放の再計算。
 * v0.15 以前は初手メタ95で1本¥1.5億が可能で、その累計を引き継ぐと
 * 新バランスでは絶対に届かない解放条件（累計売上ゲート）を即満たしてしまう。
 * lifetimeRevenue を ÷100 し、解放は「初期 ∪ 圧縮後累計のステージ解放 ∪ 使用済み」で作り直す。
 */
const toV7 = (p: Omit<Persisted, 'version'> & { version: number }): Persisted => {
  const lifetimeRevenue = Math.round(p.lifetimeRevenue / 100);
  const base = defaults();
  const stage = computeStageUnlocks(
    base.unlockedGenres,
    base.unlockedThemes,
    p.library,
    lifetimeRevenue,
  );
  const usedGenres = p.library.map((w) => w.genreId);
  const usedThemes = p.library.map((w) => w.themeId);
  const unlockedScales = (['mini', 'mobile', 'indie', 'hit', 'aaa'] as Scale[]).filter(
    (sc) => sc === 'mini' || lifetimeRevenue >= SCALE_BALANCE[sc].unlockSalesRequired,
  );
  return {
    ...p,
    version: 7,
    lifetimeRevenue,
    unlockedScales,
    unlockedGenres: Array.from(
      new Set([...base.unlockedGenres, ...stage.newGenres, ...usedGenres]),
    ),
    unlockedThemes: Array.from(
      new Set([...base.unlockedThemes, ...stage.newThemes, ...usedThemes]),
    ),
  };
};

/**
 * 読込データの共通整形：defaults とのマージ・欠損フィールドの防御・
 * v0.10 の人気ジャンル/テーマ再ロック（達成済みは維持）。
 */
const shapeLoaded = (parsed: Persisted): Persisted => {
  const merged: Persisted = { ...defaults(), ...parsed };
  merged.library = merged.library.map(ensureWorkBreakdown);
  merged.employees = merged.employees.map((e) =>
    normalizeEmployeeV6({ ...e, specialties: e.specialties ?? [] }),
  );
  merged.unlockedCategories =
    parsed.unlockedCategories && parsed.unlockedCategories.length > 0
      ? parsed.unlockedCategories
      : [...INITIAL_CATEGORY_IDS];
  merged.currentDate = parsed.currentDate ?? { ...INITIAL_GAME_DATE };

  // v0.17.1 修正：保存済みの解放（ステージ解放含む）を尊重する。
  // 旧実装は v0.10 時代の「人気ジャンル再ロック」を毎回適用しており、
  // セッション中に解放したジャンル/テーマがリロードで巻き戻っていた（オーナー報告）。
  // 初期解放 ∪ 保存済み解放 ∪ ライブラリ使用済み の和集合で防御だけ行う。
  const usedGenres = merged.library.map((w) => w.genreId);
  const usedThemes = merged.library.map((w) => w.themeId);
  merged.unlockedGenres = Array.from(
    new Set([...defaults().unlockedGenres, ...(parsed.unlockedGenres ?? []), ...usedGenres]),
  );
  merged.unlockedThemes = Array.from(
    new Set([...defaults().unlockedThemes, ...(parsed.unlockedThemes ?? []), ...usedThemes]),
  );
  return merged;
};

export const load = (): Persisted | null => {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Persisted;
      if (parsed && parsed.version === 7) {
        return shapeLoaded(parsed);
      }
    }
    // v6 → v7：旧経済の累計を圧縮し解放を再計算（v0.18）
    const v6 = localStorage.getItem(LEGACY_KEY_V6);
    if (v6) {
      const parsed = JSON.parse(v6) as Omit<Persisted, 'version'> & { version: number };
      if (parsed && parsed.version === 6) {
        const migrated = shapeLoaded(toV7(parsed));
        save(migrated);
        try {
          localStorage.removeItem(LEGACY_KEY_V6);
        } catch {
          /* ignore */
        }
        return migrated;
      }
    }
    // v5 → v6：employees の power 正規化＋成長フィールド付与（v0.16）
    const v5 = localStorage.getItem(LEGACY_KEY_V5);
    if (v5) {
      const parsed = JSON.parse(v5) as Omit<Persisted, 'version' | 'employees'> & {
        version: number;
        employees: LegacyEmployeeV5[];
      };
      if (parsed && parsed.version === 5) {
        const migrated = shapeLoaded(
          toV7({
            ...parsed,
            version: 6,
            employees: (parsed.employees ?? []).map(normalizeEmployeeV6),
          }),
        );
        save(migrated);
        try {
          localStorage.removeItem(LEGACY_KEY_V5);
        } catch {
          /* ignore */
        }
        return migrated;
      }
    }
    const v4 = localStorage.getItem(LEGACY_KEY_V4);
    if (v4) {
      const legacyV4 = migrateFromV4(v4);
      if (legacyV4) {
        // 旧経済セーブは v7 圧縮を通して新カーブに乗せる
        const migrated = shapeLoaded(toV7(legacyV4));
        save(migrated);
        try {
          localStorage.removeItem(LEGACY_KEY_V4);
        } catch {
          /* ignore */
        }
        return migrated;
      }
    }
    const v3 = localStorage.getItem(LEGACY_KEY_V3);
    if (v3) {
      const legacyV3 = migrateFromV3(v3);
      if (legacyV3) {
        // 旧経済セーブは v7 圧縮を通して新カーブに乗せる
        const migrated = shapeLoaded(toV7(legacyV3));
        save(migrated);
        try {
          localStorage.removeItem(LEGACY_KEY_V3);
        } catch {
          /* ignore */
        }
        return migrated;
      }
    }
    const v2 = localStorage.getItem(LEGACY_KEY_V2);
    if (v2) {
      const legacyV2 = migrateFromV2(v2);
      if (legacyV2) {
        // 旧経済セーブは v7 圧縮を通して新カーブに乗せる
        const migrated = shapeLoaded(toV7(legacyV2));
        save(migrated);
        try {
          localStorage.removeItem(LEGACY_KEY_V2);
        } catch {
          /* ignore */
        }
        return migrated;
      }
    }
    const legacy = localStorage.getItem(LEGACY_KEY_V1);
    if (legacy) {
      const legacyV1 = migrateFromV1(legacy);
      if (legacyV1) {
        // 旧経済セーブは v7 圧縮を通して新カーブに乗せる
        const migrated = shapeLoaded(toV7(legacyV1));
        save(migrated);
        try {
          localStorage.removeItem(LEGACY_KEY_V1);
        } catch {
          /* ignore */
        }
        return migrated;
      }
    }
    return null;
  } catch {
    return null;
  }
};

export const save = (p: Persisted): void => {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* quota or disabled storage — ignore */
  }
};

export const reset = (): void => {
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem(LEGACY_KEY_V6);
    localStorage.removeItem(LEGACY_KEY_V5);
    localStorage.removeItem(LEGACY_KEY_V4);
    localStorage.removeItem(LEGACY_KEY_V3);
    localStorage.removeItem(LEGACY_KEY_V2);
    localStorage.removeItem(LEGACY_KEY_V1);
  } catch {
    /* ignore */
  }
};
