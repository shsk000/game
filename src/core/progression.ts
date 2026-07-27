import type { GenreId } from '../data/genres';
import { GENRES } from '../data/genres';
import type { ThemeId } from '../data/themes';
import { THEMES } from '../data/themes';
import type { Achievement, Work } from '../state/types';

/**
 * 進行系のルール計算（純粋関数）：ジャンル/テーマ/カテゴリの解放と実績判定。
 * gameStore.ts の私有ヘルパーから移設（P3a。ロジックは無変更）。
 */

/** ヒット作とみなすメタスコア下限（解放・実績の共通しきい値） */
export const HIT_METASCORE_THRESHOLD = 70;

export type StageUnlock = {
  unlocked: number;
  newGenres: GenreId[];
  newThemes: ThemeId[];
};

/**
 * v0.10 仕上げ §6-8：解放テンポ（ハイブリッド）。
 *   - 基本軸：累計売上（駄作量産では解放されない）
 *   - 加速軸：ヒット作（メタ 70+）の本数
 *   - 段階的に：stage 2/3/4 へ進める
 *
 * stage しきい値（balance-design §6-8 解放テーブル準拠）：
 *   - stage 2：累計売上 ¥1000 万 OR ヒット作 1 本
 *   - stage 3：累計売上 ¥5000 万 OR ヒット作 3 本
 *   - stage 4：累計売上 ¥1 億 OR ヒット作 5 本
 *
 * 「累計売上だけ」「ヒット作だけ」のどちらでも解放できる二段構え。
 */
export const computeStageUnlocks = (
  currentGenres: GenreId[],
  currentThemes: ThemeId[],
  library: Work[],
  lifetimeRevenue: number,
): StageUnlock => {
  const hitCount = library.filter((w) => w.metascore >= HIT_METASCORE_THRESHOLD).length;
  let stage: 1 | 2 | 3 | 4 = 1;
  if (lifetimeRevenue >= 10_000_000 || hitCount >= 1) stage = 2;
  if (lifetimeRevenue >= 50_000_000 || hitCount >= 3) stage = 3;
  if (lifetimeRevenue >= 100_000_000 || hitCount >= 5) stage = 4;
  const newGenres = GENRES.filter(
    (g) => g.unlockStage <= stage && !currentGenres.includes(g.id),
  ).map((g) => g.id);
  const newThemes = THEMES.filter(
    (t) => t.unlockStage <= stage && !currentThemes.includes(t.id),
  ).map((t) => t.id);
  return { unlocked: newGenres.length + newThemes.length, newGenres, newThemes };
};

/**
 * v0.10 仕上げ §6-8：カテゴリ解放（ハイブリッド条件）。
 *  - story: 初期 3 カテゴリ（graphics, sound, gameplay）全てで作品リリース
 *  - presentation: ヒット作 5 本（メタ 70+）
 *  - innovation: 累計売上 ¥1 億
 */

export type AchievementContext = {
  library: Work[];
  fans: number;
  lifetimeRevenue: number;
  bestCombo: number;
  lastWork?: Work;
};

/** 実績の一括評価。unlocked は現状+新規の全リスト、newly は今回新たに達成した分 */
export const evaluateAchievements = (
  current: Achievement[],
  ctx: AchievementContext,
): { unlocked: Achievement[]; newly: Achievement[] } => {
  const set = new Set(current);
  const candidates: Achievement[] = [];
  if (ctx.library.length >= 1) candidates.push('first-release');
  if (ctx.lastWork?.isMasterpiece || ctx.library.some((w) => w.isMasterpiece)) {
    candidates.push('first-masterpiece');
  }
  if (ctx.lastWork?.ghostBeaten || ctx.library.some((w) => w.ghostBeaten)) {
    candidates.push('ghost-killer');
  }
  if (ctx.bestCombo >= 100) candidates.push('combo-100');
  if (ctx.fans >= 1000) candidates.push('fan-1k');
  if (ctx.lifetimeRevenue >= 1_000_000) candidates.push('million-yen');
  const discovered = new Set(ctx.library.map((w) => `${w.genreId}|${w.themeId}`));
  if (discovered.size >= 90) candidates.push('collector-half');
  if (ctx.library.some((w) => w.scale === 'aaa')) candidates.push('aaa-released');
  const newly: Achievement[] = [];
  for (const a of candidates) {
    if (!set.has(a)) {
      set.add(a);
      newly.push(a);
    }
  }
  return { unlocked: Array.from(set), newly };
};
