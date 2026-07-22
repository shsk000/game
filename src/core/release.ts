import { AXIS_QUALITY_BONUS_CAP, STAT_QUALITY_BONUS_CAP } from '../data/balance';
import type { CategoryId } from '../data/categories';
import { sumPrBonus } from '../data/employees';
import type { GenreId } from '../data/genres';
import type { Scale } from '../data/scales';
import { SCALE_BY_ID } from '../data/scales';
import type { ThemeId } from '../data/themes';
import { type Trend, trendSalesMultiplier } from '../data/trend';
import type {
  Achievement,
  CurrentProject,
  Employee,
  GameDate,
  Work,
  WorkBreakdown,
} from '../state/types';
import { ZERO_AXES } from '../state/types';
import { computeGenreAffinityScore } from '../utils/affinity';
import { computeCharacterScore } from '../utils/character';
import {
  computeMetascore,
  computePerformanceScore,
  computeQualityV10,
  computeRevenue,
  fanDelta,
} from '../utils/metascore';
import { decayRateFor, INITIAL_SHARE } from '../utils/sales';
import type { Records } from '../utils/storage';
import { remainingBugPenalty } from './bugs';
import { applyReleaseGrowth, type LevelUp } from './growth';
import type { Deps } from './ports';
import { computeNewlyUnlockedCategories, evaluateAchievements } from './progression';

/**
 * リリースパイプライン（品質→メタスコア→売上→ファン→解放→実績）。
 * gameStore.releaseWork から抽出（P3c。ロジックは無変更の切り出し）。
 * 乱数（評価ブレ・運倍率・Work id）と時刻は deps 経由（logic-architecture §2）。
 */

export type ReleaseOpts = {
  launchAd?: boolean;
  /** 発売時のマーケティング広告：売上を +10%（スコアには影響しない・softBonus 上限の外）。 */
  marketingAd?: boolean;
};

/** リリース計算が読む状態のスナップショット */
export type ReleaseCtx = {
  current: CurrentProject;
  employees: Employee[];
  trend: Trend;
  library: Work[];
  fans: number;
  funds: number;
  lifetimeRevenue: number;
  ghosts: Record<Scale, number | null>;
  records: Records;
  achievements: Achievement[];
  newlyAchieved: Achievement[];
  unlockedGenres: GenreId[];
  unlockedThemes: ThemeId[];
  unlockedCategories: CategoryId[];
  currentDate: GameDate;
};

/** リリースが書き換える状態（store は set(patch) するだけ） */
export type ReleasePatch = {
  library: Work[];
  funds: number;
  lifetimeRevenue: number;
  fans: number;
  records: Records;
  achievements: Achievement[];
  newlyAchieved: Achievement[];
  unlockedGenres: GenreId[];
  unlockedThemes: ThemeId[];
  unlockedCategories: CategoryId[];
  /** v0.16：成長反映後の社員（参加者は exp/level/power/wage が更新される） */
  employees: Employee[];
  /** v0.16：このリリースで発生したレベルアップ（開封演出用） */
  lastLevelUps: LevelUp[];
  lastReleased: Work;
  current: null;
  screen: 'release';
};

export const computeRelease = (
  ctx: ReleaseCtx,
  opts: ReleaseOpts | undefined,
  deps: Deps,
): { work: Work; patch: ReleasePatch } => {
  const cur = ctx.current;
  const employees = ctx.employees;
  const prBonus = sumPrBonus(employees);
  const assignedEmployees = employees.filter((e) => cur.assignedEmployeeIds.includes(e.id));

  // === 4 要素品質（v0.14：カテゴリ選択廃止に伴い category 依存を撤去）===
  // 1) キャラ能力スコア（0..100）
  const charResult = computeCharacterScore({
    assignedEmployees,
    scale: cur.scale,
  });
  // 2) ジャンル相性スコア（0..100）＝ compat 連続マッピング
  const affResult = computeGenreAffinityScore({
    genreId: cur.genreId,
    themeId: cur.themeId,
  });
  // 3) タイピング演技スコア（0..100）— spec §2-2
  // 発売時の広告（マーケ/デバッグチーム）でスコアを +5 する旧仕様は撤去。
  // 広告はスコアに影響させない（バグ削減はデバッグフェーズ、売上はローンチ広告で扱う）。
  // v0.17：バグゼロ（開発〜デバッグで残バグ 0）でタイピング演技 +5（既存 noBugs 判定に接続）
  const remainingBugs = cur.bugCount ?? 0;
  const performance = Math.min(
    100,
    computePerformanceScore({ ...cur.perf, noBugs: remainingBugs === 0 }),
  );

  // 4) computeQualityV10 で合成（運の基底 50 ± 揺らぎ）。神ゲーガチャは v0.10 で廃止。
  const { Q: quality0, breakdown: qBreakdown } = computeQualityV10(
    {
      charPower: charResult.score,
      genreAffinity: affResult.score,
      typingScore: performance,
    },
    deps.rng,
  );

  // v0.14：イベント新軸の合流（品質系 + バグ罰）。既存 4 要素は不変、加点/減点として上乗せ。
  const axes = cur.axes ?? ZERO_AXES;
  // v0.15：ビルドアップ・タイピングの開発パラメータ（文を打って積んだ 4 属性）も品質へ合流。
  // 「打った文がどこに効いたか」の因果をリリース結果まで一本で繋ぐ（重みは叩き台 🔧）
  // v0.16：上限 STAT_QUALITY_BONUS_CAP を導入（旧実装は青天井で序盤の難易度崩壊要因）
  const stats = cur.devStats ?? { program: 0, graphics: 0, sound: 0, design: 0 };
  const statQualityBonus = Math.min(
    STAT_QUALITY_BONUS_CAP,
    stats.program * 0.12 + stats.graphics * 0.08 + stats.sound * 0.08 + stats.design * 0.05,
  );
  // v0.17：残バグを抱えたまま発売した場合のペナルティ（品質減点＋炎上リスク）
  const bugPenalty = remainingBugPenalty(remainingBugs);
  // v0.17.1：正のボーナス合計は AXIS_QUALITY_BONUS_CAP で頭打ち
  // （企画・イベント・ビルドアップはタイピングの腕で増えるため、0.15 ウェイトの迂回路にしない）
  const positiveAxisBonus = Math.min(
    AXIS_QUALITY_BONUS_CAP,
    (axes.funFactor + axes.usability + axes.balance) * 0.3 + statQualityBonus,
  );
  const axisQualityBonus = positiveAxisBonus - axes.bugRate * 0.2 - bugPenalty.qualityPenalty;
  const quality = Math.max(0, Math.min(100, Math.round(quality0 + axisQualityBonus)));

  const trend = ctx.trend;
  const meta = computeMetascore(quality, cur.genreId, cur.themeId, trend, deps.rng);
  const launchAdActive = !!opts?.launchAd;
  const pioneer = !ctx.library.some((w) => w.genreId === cur.genreId && w.themeId === cur.themeId);
  const pioneerBonus = pioneer ? 0.05 : 0;
  const baseTotalRevenue = computeRevenue(
    meta.metascore,
    cur.genreId,
    cur.themeId,
    cur.scale,
    trend,
    ctx.fans,
    launchAdActive,
    prBonus,
    pioneerBonus,
  );
  // v0.14：市場系新軸（売上予測・話題性 − 炎上リスク）で売上を補正（0.5〜2.0 倍にクランプ）。
  const effectiveReputationRisk = axes.reputationRisk + bugPenalty.reputationRisk;
  const axisSalesMul = Math.max(
    0.5,
    Math.min(2, 1 + (axes.salesForecast + axes.buzz) / 100 - effectiveReputationRisk / 100),
  );
  // マーケティング広告：売上 +10%（スコアには効かせず売上のみ。上限の外で確実に効く）
  const marketingMul = opts?.marketingAd ? 1.1 : 1;
  // トレンド売上倍率（両方 ×1.10 / 片方 ×1.05）。スコア側 trendScoreBonus とは別枠で上限の外。
  const trendSalesMul = trendSalesMultiplier(trend, cur.genreId, cur.themeId);
  const totalRevenue = Math.round(baseTotalRevenue * axisSalesMul * marketingMul * trendSalesMul);
  const initialRevenue = Math.round(totalRevenue * INITIAL_SHARE);
  const salesPool = totalRevenue - initialRevenue;
  const decayPerSec = decayRateFor(meta.metascore);
  // v0.14：期待/話題/信頼でファン上乗せ、炎上リスクで減（spec §5-6）。
  const axisFans = Math.round(axes.hype + axes.buzz * 0.5 + axes.trust - effectiveReputationRisk);
  const gainedFans = Math.max(0, fanDelta(meta.metascore, prBonus) + axisFans);
  const newFans = Math.max(0, ctx.fans + gainedFans);
  const developSec = cur.finishedAt !== null ? (cur.finishedAt - cur.startedAt) / 1000 : 0;
  const prevGhost = ctx.ghosts[cur.scale];
  const ghostBeaten = prevGhost !== null && developSec <= prevGhost;

  // ゲーム内週数：開始日 → 現在日 の差 ＋ イベントのスケジュール効果（devWeeksDelta）
  const startDate = cur.startDate ?? ctx.currentDate;
  const developWeeks = Math.max(
    0,
    (ctx.currentDate.year - startDate.year) * 48 +
      (ctx.currentDate.month - startDate.month) * 4 +
      (ctx.currentDate.week - startDate.week) +
      Math.round(axes.devWeeksDelta),
  );

  // イベントのコスト効果（costMod%）：開発費に対する追加徴収/返金をリリース時に精算
  const costAdjust = Math.round(SCALE_BY_ID[cur.scale].baseCost * (axes.costMod / 100));

  const trendMul = trendSalesMul;
  const workBreakdown: WorkBreakdown = {
    ...qBreakdown,
    // v0.14 修正：Work.breakdown のフィールド名は performance。
    // 旧実装は typingScore のままスプレッドしていたため、開封演出の
    // 「タイピング演技」寄与が常に 0 表示になっていた（v0.10 からの潜在バグ）。
    performance: qBreakdown.typingScore,
    axisBonus: Math.round(axisQualityBonus),
    trendMul,
    pioneer,
  };

  const nowMs = deps.now();
  const work: Work = {
    id: `${nowMs}-${deps.rng().toString(36).slice(2, 8)}`,
    title: cur.title,
    genreId: cur.genreId,
    themeId: cur.themeId,
    scale: cur.scale,
    quality,
    metascore: meta.metascore,
    isMasterpiece: meta.isMasterpiece,
    developSec,
    initialRevenue,
    salesPool,
    initialSalesPool: salesPool,
    decayPerSec,
    totalRevenue: initialRevenue, // 初動はすでに加算した分のみ。販売で積み上がる
    selling: salesPool > 0,
    fansGained: gainedFans,
    ghostBeaten,
    launchAdUsed: launchAdActive,
    pioneer,
    releasedAt: nowMs,
    createdAt: nowMs,
    breakdown: workBreakdown,
    selectedCategories: [...cur.selectedCategories],
    developWeeks,
  };

  const newLibrary = [work, ...ctx.library];
  // v0.29：ジャンル/テーマの発売時自動解放（computeStageUnlocks）を廃止。
  // stage2+ の解放は buyGenre/buyTheme（購入）が唯一の経路（案A→案B）。
  // カテゴリの自動解放は据え置き（対象外）。docs/v29/spec.md。
  const projectedLifetimeRevenue = ctx.lifetimeRevenue + initialRevenue;
  const newCategoryUnlocks = computeNewlyUnlockedCategories(
    ctx.unlockedCategories,
    newLibrary,
    projectedLifetimeRevenue,
  );

  const rec = ctx.records;
  const newRec: Records = {
    bestMetascore: Math.max(rec.bestMetascore, meta.metascore),
    bestRevenue: Math.max(rec.bestRevenue, totalRevenue),
    bestCombo: rec.bestCombo,
    bestWPM: rec.bestWPM,
  };

  const newAch = evaluateAchievements(ctx.achievements, {
    library: newLibrary,
    fans: newFans,
    lifetimeRevenue: ctx.lifetimeRevenue + initialRevenue,
    bestCombo: rec.bestCombo,
    lastWork: work,
  });

  // v0.16：社員成長。参加社員に exp を一括付与し、レベルアップを反映（spec v16 §1）
  const growth = applyReleaseGrowth(ctx.employees, cur.assignedEmployeeIds, meta.metascore);

  const patch: ReleasePatch = {
    library: newLibrary,
    funds: ctx.funds + initialRevenue - costAdjust,
    lifetimeRevenue: ctx.lifetimeRevenue + initialRevenue,
    fans: newFans,
    records: newRec,
    achievements: newAch.unlocked,
    newlyAchieved: [...ctx.newlyAchieved, ...newAch.newly],
    unlockedGenres: [...ctx.unlockedGenres],
    unlockedThemes: [...ctx.unlockedThemes],
    unlockedCategories: [...ctx.unlockedCategories, ...newCategoryUnlocks],
    employees: growth.employees,
    lastLevelUps: growth.levelUps,
    lastReleased: work,
    current: null,
    screen: 'release',
  };

  return { work, patch };
};
