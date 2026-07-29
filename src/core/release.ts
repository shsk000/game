import { SCALE_BALANCE, salesMultiplierForScore, scoreTierFor } from '../data/balance';
import { getCompat } from '../data/compatibility';
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
  FeaturePoints,
  GameDate,
  Work,
  WorkBreakdown,
} from '../state/types';
import { ZERO_AXES, ZERO_FEATURES } from '../state/types';
import { computeRevenue, fanDelta } from '../utils/metascore';
import { computeMetascore } from './metascore';
import { decayRateFor, INITIAL_SHARE } from '../utils/sales';
import type { Records } from '../utils/storage';
import { remainingBugPenalty } from './bugs';
import { applyReleaseGrowth, type LevelUp } from './growth';
import type { Deps } from './ports';
import { evaluateAchievements } from './progression';

/**
 * リリースパイプライン（品質→メタスコア→売上→ファン→解放→実績）。
 * gameStore.releaseWork から抽出（P3c。ロジックは無変更の切り出し）。
 * 乱数（評価ブレ・運倍率・Work id）と時刻は deps 経由（logic-architecture §2）。
 */

export type ReleaseOpts = {
  /** 発売時のマーケティング広告：売上を +10%（スコアには影響しない・softBonus 上限の外）。 */
  marketingAd?: boolean;
};

/**
 * ローンチ広告（発売**後**のリワード広告）で初動売上に掛かる倍率。
 *
 * ラベルは「初動売上 +50%」＝この値。総売上に対しては INITIAL_SHARE(20%) 分にしか掛からないので
 * 実効は総売上 +10% になる。**表示は「初動」と明記すること**（総売上 +50% と書くと詐称になる）。
 * 販売プール（総売上の 80%）には掛けない＝オーナー判断「総売上+50%は大きすぎる」。
 */
export const LAUNCH_AD_INITIAL_MULTIPLIER = 1.5;

export type LaunchAdResult = {
  /** ボーナス適用後の作品（initialRevenue / totalRevenue / launchAdUsed を更新） */
  work: Work;
  /** 即入金されるボーナス額（funds / lifetimeRevenue にこの額を加算する） */
  bonus: number;
};

/**
 * 確定済みの作品にローンチ広告ボーナスを適用する純粋関数。
 *
 * 発売後に視聴するリワードなので computeRevenue の経路には乗せられない（乗せた旧実装は
 * `releaseWork` が launchAd を渡さずデッドコード化していた）。ここで**確定値に後から**掛ける。
 *
 * 初動を増やすだけでなく totalRevenue（入金累計）も同額増やす：これを忘れると
 * ライブラリの「累計」・図鑑の最高売上・records に載らず、ボーナスが記録から消える。
 *
 * 二重適用は launchAdUsed で弾く（null を返す）。
 */
export const applyLaunchAd = (work: Work): LaunchAdResult | null => {
  if (work.launchAdUsed) return null;
  const bonus = Math.round(work.initialRevenue * (LAUNCH_AD_INITIAL_MULTIPLIER - 1));
  return {
    work: {
      ...work,
      initialRevenue: work.initialRevenue + bonus,
      totalRevenue: work.totalRevenue + bonus,
      launchAdUsed: true,
    },
    bonus,
  };
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

  // === 特徴ポイント → メタスコア（docs/spec/score-model.md §2〜§4）===
  // 打鍵で積んだ特徴ポイント5種を、ジャンルの型が決める重みで合成する。
  // **この一本以外の経路でスコアは動かない。** 旧 4要素品質（キャラ能力・ジャンル相性・
  // タイピング演技・運の基底50）と、それに乗っていた加点群（イベント軸・devStats・装備）は
  // すべて廃止した。「打たなくてもスコアが出る」「表示された数値が効かない」の元凶だったため。
  const features = cur.features ?? ZERO_FEATURES;
  const remainingBugs = cur.bugCount ?? 0;
  // 残バグは特徴ポイントから引く（発売してから効く減点ではなく、作品の出来そのものを下げる）
  const bugPenalty = remainingBugPenalty(remainingBugs);
  const penalized: FeaturePoints = { ...features };
  if (bugPenalty.qualityPenalty > 0) {
    // 操作性がいちばん傷む（バグは触り心地に出る）
    penalized.usabilityPt = Math.max(0, penalized.usabilityPt - bugPenalty.qualityPenalty);
  }

  const axes = cur.axes ?? ZERO_AXES;
  const compat = getCompat(cur.genreId, cur.themeId);

  const trend = ctx.trend;
  const meta = computeMetascore(
    {
      features: penalized,
      genreId: cur.genreId,
      themeId: cur.themeId,
      compat,
      trend: trend ? { genreId: trend.genreId, themeId: trend.themeId } : null,
    },
    deps.rng,
  );
  const pioneer = !ctx.library.some((w) => w.genreId === cur.genreId && w.themeId === cur.themeId);
  const pioneerBonus = pioneer ? 0.05 : 0;
  const baseTotalRevenue = computeRevenue(
    meta.metascore,
    cur.genreId,
    cur.themeId,
    cur.scale,
    trend,
    ctx.fans,
    prBonus,
    pioneerBonus,
  );
  // 市場系軸（話題性 − 炎上リスク）で売上を補正（0.5〜2.0 倍にクランプ）。
  // 旧 salesForecast（売上予測%）は削除済み。buzz と同じ式・同じ分母に足すだけで役割が重複し、
  // 「予測」という名前なのに実売上を増やす＝プレイヤーに意味が伝わらなかった（オーナー判断 2026-07-25）。
  const effectiveReputationRisk = axes.reputationRisk + bugPenalty.reputationRisk;
  const axisSalesMul = Math.max(
    0.5,
    Math.min(2, 1 + axes.buzz / 100 - effectiveReputationRisk / 100),
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
  // ファン増加の内訳（画面に出す。企画フェーズで積んだ期待度がどこに効いたかを見せる）
  const fanBase = fanDelta(meta.metascore, prBonus);
  const fanFromHype = Math.round(axes.hype);
  const fanFromBuzz = Math.round(axes.buzz * 0.5 + axes.trust - effectiveReputationRisk);
  const axisFans = fanFromHype + fanFromBuzz;
  const gainedFans = Math.max(0, fanBase + axisFans);
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
    features: meta.contributions as WorkBreakdown['features'],
    base: meta.base,
    compatBonus: meta.compatBonus,
    trendBonus: meta.trendBonus,
    criticVariance: meta.criticVariance,
    // 売上の内訳（画面で式そのものを見せる。docs/spec/scoring.md §3）
    baseRevenue: SCALE_BALANCE[cur.scale].baseRevenue,
    tierMul: salesMultiplierForScore(meta.metascore),
    tier: scoreTierFor(meta.metascore),
    prBonus,
    fanBonus: Math.sqrt(Math.max(0, ctx.fans)) / 400,
    pioneerBonus,
    axisSalesMul,
    marketingMul,
    fanBase,
    fanFromHype,
    fanFromBuzz,
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
    metascore: meta.metascore,
    isMasterpiece: scoreTierFor(meta.metascore) === 'godGame',
    developSec,
    initialRevenue,
    salesPool,
    initialSalesPool: salesPool,
    decayPerSec,
    totalRevenue: initialRevenue, // 初動はすでに加算した分のみ。販売で積み上がる
    selling: salesPool > 0,
    fansGained: gainedFans,
    ghostBeaten,
    // ローンチ広告は発売後に視聴するので、この時点では常に false。applyLaunchAd で true になる。
    launchAdUsed: false,
    pioneer,
    releasedAt: nowMs,
    createdAt: nowMs,
    breakdown: workBreakdown,
    developWeeks,
    // 開発中に実際に払った固定費（推定ではない。`monthlyTick` が積んだ実額）
    fixedCostPaid: cur.fixedCostPaid ?? 0,
    fixedCostTicks: cur.fixedCostTicks ?? 0,
  };

  const newLibrary = [work, ...ctx.library];
  // v0.29：ジャンル/テーマの発売時自動解放（computeStageUnlocks）を廃止。
  // stage2+ の解放は buyGenre/buyTheme（購入）が唯一の経路。
  // 実装ステップ3：カテゴリ6種一式を削除（企画で選ぶ枠はジャンル×テーマだけになった）。

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
  const growth = applyReleaseGrowth(
    ctx.employees,
    cur.assignedEmployeeIds,
    meta.metascore,
    cur.scale,
  );

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
    employees: growth.employees,
    lastLevelUps: growth.levelUps,
    lastReleased: work,
    current: null,
    screen: 'release',
  };

  return { work, patch };
};
