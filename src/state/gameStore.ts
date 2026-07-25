import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import {
  bugsClearedByAd,
  ensureMinBugsOnDevComplete,
  rollBugOnKeystroke,
  rollBugOnMiss,
} from '../core/bugs';
import { simulateAverageDevRun } from '../core/devSimulate';
import { computeBorrow, computeMonthlyTick, computeRepay, computeSpend } from '../core/economy';
import { canBuyEquipment, freeCopies, type OwnedItems } from '../core/equip';
import { gachaPrice, nextPityCount, rollRank } from '../core/gacha';
import type { LevelUp } from '../core/growth';
import { investPrice } from '../core/invest';
import { type Deps, defaultDeps } from '../core/ports';
import { evaluateAchievements } from '../core/progression';
import {
  applyLaunchAd as applyLaunchAdToWork,
  computeRelease,
  type ReleaseOpts,
} from '../core/release';
import { ACHIEVEMENTS } from '../data/achievements';
import { DEV_PHRASES_PER_WEEK, type GachaKind } from '../data/balance';
import type { CategoryId } from '../data/categories';
import { INITIAL_CATEGORY_IDS } from '../data/categories';
import { newCandidate, sumProgrammerSpeed } from '../data/employees';
import { DEFAULT_LOADOUT, EQUIPMENT_BY_ID, type EquipSlot } from '../data/equipment';
import type { GenreId } from '../data/genres';
import { GENRE_BY_ID, GENRES } from '../data/genres';
import { MAX_EMPLOYEES } from '../data/officeLayout';
import type { Scale } from '../data/scales';
import { nextLockedScale, SCALE_BY_ID, SCALES } from '../data/scales';
import type { ThemeId } from '../data/themes';
import { THEME_BY_ID, THEMES } from '../data/themes';
import { generateTitle } from '../data/titleGenerator';
import { ensureTrend, type Trend } from '../data/trend';
import { settlePool } from '../utils/sales';
import { setSfxMuted, setSfxVolume } from '../utils/sfx';
import type { Records } from '../utils/storage';
import * as storage from '../utils/storage';
import type {
  Achievement,
  Candidate,
  CurrentProject,
  DevAxis,
  DevPhase,
  Employee,
  GameDate,
  MonthlyFixedCost,
  OfflineReport,
  Screen,
  Work,
} from './types';
import { addWeeks, DEV_PHASE_ORDER, INITIAL_GAME_DATE, ZERO_AXES } from './types';

/**
 * v0.11：開発フェーズの「MISSION 名・見出し」を生成（演出専用）。
 * ジャンルごとに開発っぽいタスク見出しを 1 つ選ぶ。ゲームロジックには影響しない。
 */
const MISSION_FLAVORS: Record<string, string[]> = {
  action: ['敵を配置する', '当たり判定を実装する', 'コンボ処理を組む', '必殺技を実装する'],
  rpg: ['敵を配置する', '戦闘システムを実装する', '経験値処理を組む', 'マップを生成する'],
  puzzle: ['盤面を生成する', '判定ロジックを組む', '連鎖処理を実装する', 'ヒント機能を作る'],
  adventure: ['シナリオ分岐を組む', 'マップを生成する', 'アイテム処理を実装する', '会話を実装する'],
  simulation: ['経済ループを組む', 'AI 行動を実装する', 'パラメータ処理を作る', 'UI を組む'],
  shooter: ['弾幕を生成する', '当たり判定を実装する', 'ボスAIを組む', 'スコア処理を作る'],
  racing: ['物理挙動を実装する', 'コースを生成する', 'AI 走行を組む', 'タイム計測を作る'],
  horror: ['演出トリガーを組む', '敵AIを実装する', 'サウンド処理を作る', 'マップを生成する'],
  fighting: ['コンボ判定を組む', '当たり判定を実装する', '必殺技を作る', 'AI 行動を組む'],
  roguelike: ['ダンジョンを生成する', 'アイテム処理を組む', '敵を配置する', '永続化処理を作る'],
  rhythm: ['譜面を生成する', '判定ロジックを組む', 'コンボ処理を作る', 'スコア処理を組む'],
  sandbox: ['ブロック処理を組む', 'セーブ処理を作る', '物理挙動を実装する', '生成ロジックを組む'],
  strategy: ['敵AIを組む', 'ユニット移動処理を作る', '勝敗判定を実装する', 'マップデータを組む'],
  sports: ['選手の動きを組む', 'シュート判定を実装する', 'スコア集計を作る', 'AI対戦相手を組む'],
  survival: ['空腹度処理を組む', 'クラフト処理を作る', '天候システムを実装する', '敵AIを組む'],
  cardgame: ['カード効果を実装する', 'デッキ処理を組む', '勝敗判定を作る', 'シャッフル処理を組む'],
  towerdefense: [
    'タワー設置処理を組む',
    '敵ウェーブを実装する',
    '射程判定を作る',
    '経路探索を組む',
  ],
  partygame: ['ミニゲーム切替を組む', '得点集計を実装する', 'ランダムイベントを作る', 'UIを組む'],
  escapegame: [
    'ギミック判定を組む',
    'アイテム管理を実装する',
    'タイマー処理を作る',
    'フラグ管理を組む',
  ],
  romanceadventure: [
    '好感度処理を組む',
    '会話分岐を実装する',
    'エンディング分岐を作る',
    'UIを組む',
  ],
  boardgame: ['サイコロ処理を組む', 'コマ移動を実装する', '取引処理を作る', 'マス判定を組む'],
  quiz: ['出題処理を組む', '早押し判定を実装する', '正解判定を作る', 'スコア処理を組む'],
  platformer: ['ジャンプ処理を組む', '足場判定を実装する', 'コイン収集を作る', '当たり判定を組む'],
  visualnovel: ['テキスト表示を組む', '選択肢分岐を実装する', 'セーブ処理を作る', '演出処理を組む'],
  raisingsim: ['成長パラメータを組む', 'お世話処理を実装する', '進化判定を作る', 'UIを組む'],
  fishing: ['当たり判定を組む', 'リール処理を実装する', '図鑑記録を作る', '乱数処理を組む'],
  fps: ['エイム処理を組む', 'リロード処理を実装する', 'ヒット判定を作る', '敵AIを組む'],
};
let missionCounter = 3;
const buildMissionFlavor = (genreId: GenreId): { missionName: string; missionDesc: string } => {
  const pool = MISSION_FLAVORS[genreId] ?? MISSION_FLAVORS.action;
  missionCounter += 1;
  const desc = pool[Math.floor(deps.rng() * pool.length)];
  return {
    missionName: `MISSION_${String(missionCounter).padStart(2, '0')}`,
    missionDesc: desc,
  };
};

/**
 * アクションが使う乱数・時刻の供給元。既定は本番実装（Math.random / Date.now）。
 * boot が `?seed=NN` を検出したとき setGameDeps で seed 固定乱数に差し替える（e2e 決定化）。
 */
let deps: Deps = defaultDeps;
export const setGameDeps = (d: Deps): void => {
  deps = d;
};

const now = () => deps.now();

type Actions = {
  goTo: (screen: Screen) => void;
  /**
   * v0.17：従業員は常に全員参加（オーナー指示）。title 省略時はランダム生成。
   */
  startProject: (genreId: GenreId, themeId: ThemeId, scale: Scale, title?: string) => void;
  tickAuto: (deltaSec: number) => void;
  tickSales: (deltaSec: number) => void;
  /**
   * v0.10：ゲーム内時間を1週進める。
   * 月またぎ（次月第1週へ）になったときは monthlyTick も実行され、固定費が引かれる。
   */
  tickWeek: () => void;
  /**
   * v0.10：月初固定費（給与＋賃料）を funds から引く。
   * 通常は tickWeek 内部から月またぎ時に呼ばれるが、テストや初期化のため公開。
   */
  monthlyTick: () => MonthlyFixedCost;
  addDevelopLoC: (n: number) => void;
  /** v0.15：バグ侵食（完成度じわ減り。0 未満にならない） */
  erodeDevelopLoC: (n: number) => void;
  /** v0.15：ビルドアップ・タイピングの属性ポイント加算 */
  addDevStat: (key: 'program' | 'graphics' | 'sound' | 'design', n: number) => void;
  reportCombo: (combo: number) => void;
  reportWPM: (wpm: number) => void;
  reportAccuracy: (acc: number) => void;
  finishDevelopment: () => void;
  /**
   * DEV 専用：タイピングを飛ばし、平均的な開発プレイ相当の成績（perf/devStats）を
   * 積んでから発売フェーズへ即到達する。品質ほぼ0のまま発売する finishDevelopment 単体と違い、
   * “それなりの品質”で発売できる（バランス／発売フロー検証用）。docs/qa/bug-hunt.md 参照。
   */
  devSkipDevelopment: () => void;
  /**
   * v0.14：開発フェーズを次へ進める。
   * planning→development→testing→debugging の遷移はテイクオーバー内で完結。
   * debugging から先（release 相当）に進むときは既存リリースフロー finishDevelopment に委譲する。
   */
  advancePhase: () => void;
  /** v0.14：イベント/ミッション結果の新軸デルタを current.axes に適用 */
  applyAxisDelta: (delta: Partial<Record<DevAxis, number>>) => void;
  releaseWork: (opts?: ReleaseOpts) => Work;
  /**
   * ローンチ広告（発売後のリワード広告）を直近リリース作に適用し、初動売上を ×1.5 する。
   * 返り値は即入金されたボーナス額（適用不可＝未リリース/二重適用なら 0）。
   */
  applyLaunchAd: () => number;
  buyAdDevBoost: () => void;
  buyAdSurvey: (g: GenreId, t: ThemeId) => void;
  /** v0.17.1：ミス打鍵はバグ確定（開発フェーズ中のみ。発生したら true） */
  noteBugOnMiss: () => boolean;
  /** v0.17.1：正打 1 打鍵ごとのバグ判定（発生したら true。社員能力で抑制） */
  noteBugOnKeystroke: () => boolean;
  /** v0.17：デバッグフェーズでバグを 1 匹修正 */
  fixBug: () => void;
  /**
   * v0.19：広告「デバッグ応援」。バグ残数の 50%（切り上げ）を即駆除する。
   * 1開発1回。使用済み・バグ 0・プロジェクト無しのときは false。
   */
  adDebugAssist: () => boolean;
  hireCandidate: () => boolean;
  /**
   * v0.22：採用ガチャを1回引く（spec v22 §3〜4）。v0.22.1：種類（normal/premium）を指定。
   * 価格は種類 × 解放済み最高規模に連動（gachaPrice）。資金不足なら false。
   * premium のみ天井カウンタ（gachaPity）を更新する。normal は S を出さず pity 不変。
   * 未処理の候補が残っていても引き直せる（前の候補は上書き＝実質見送り）。
   */
  pullGacha: (kind: GachaKind) => boolean;
  /** v0.22：開封済み候補を見送る（破棄。ガチャ料は返らない） */
  dismissCandidate: () => void;
  fireEmployee: (id: string) => void;
  unlockNextScale: () => boolean;
  /** v0.21 投資：未解放ジャンルを資金で先行購入（unlockedGenres に追加）。成立で true。 */
  buyGenre: (id: GenreId) => boolean;
  /** v0.21 投資：未解放テーマを資金で先行購入（unlockedThemes に追加）。成立で true。 */
  buyTheme: (id: ThemeId) => boolean;
  /**
   * v0.25 装備：装備アイテムを資金で購入（ownedItems に追加＝ライセンス方式）。
   * 既所有・初期装備（cost0）・資金不足・不明IDは false。
   */
  buyEquipment: (itemId: string) => boolean;
  /**
   * v0.25 装備：社員のスロットに装備/解除する。itemId=null または初期装備で解除。
   * 未所有アイテム・スロット不一致・不明社員は false。
   */
  equipItem: (empId: string, slot: EquipSlot, itemId: string | null) => boolean;
  clearOfflineReport: () => void;
  finishTutorial: () => void;
  clearNewlyAchieved: () => void;
  /** v0.10 §9-2：資金不足でゲームオーバー状態に入る。borrow 機構ができたら条件を緩める */
  triggerGameOver: () => void;
  clearGameOver: () => void;
  /** v0.10 F-5：WPM しきい値クロスで -X 週短縮した記録（重複防止）。週短縮も即時反映 */
  applyTimeShortcut: (thresholdWpm: number, weeksDelta: number) => boolean;
  /** v0.10 仕上げ §6-7：借入。borrowing limit 内なら成立。 */
  borrowMoney: (amount: number) => boolean;
  /** v0.10 仕上げ §6-7：返済。funds の範囲で debt を返す。 */
  repayDebt: (amount: number) => boolean;
  /** v0.24：効果音ミュート切替（sfx へ即反映＋永続化） */
  setMuted: (m: boolean) => void;
  /** v0.24：効果音音量 0..1（範囲外はクランプ。sfx へ即反映＋永続化） */
  setVolume: (v: number) => void;
  reset: () => void;
};

export type GameState = {
  screen: Screen;
  funds: number;
  lifetimeRevenue: number;
  fans: number;
  employees: Employee[];
  candidate: Candidate | null;
  unlockedScales: Scale[];
  unlockedGenres: GenreId[];
  unlockedThemes: ThemeId[];
  unlockedCategories: CategoryId[];
  ghosts: Record<Scale, number | null>;
  library: Work[];
  trend: Trend;
  records: Records;
  achievements: Achievement[];
  newlyAchieved: Achievement[];
  tutorialDone: boolean;
  current: CurrentProject | null;
  lastReleased: Work | null;
  /** v0.16：直近リリースで発生した社員レベルアップ（ReleaseScreen 開封演出用） */
  lastLevelUps: LevelUp[];
  offlineReport: OfflineReport | null;
  /** v0.21 投資：先行購入した累計回数（価格の逓増カーブに使う） */
  investPurchaseCount: number;
  /** v0.10：ゲーム内日付（週単位） */
  currentDate: GameDate;
  /** v0.10：直近に発生した月初固定費（UI 表示用。発生していなければ null） */
  lastFixedCost: MonthlyFixedCost | null;
  /** v0.10 §9-2：資金枯渇でゲームオーバー */
  gameOver: boolean;
  /**
   * v0.10 仕上げ §6-7：借金残高（円）。
   * 月初の固定費で資金がマイナスになった分は自動的に借金へ振替。
   * 月利は monthlyTick 時に乗る。借入上限超 + 資金 0 でゲームオーバー。
   */
  debt: number;
  /** v0.24：効果音ミュート */
  muted: boolean;
  /** v0.24：効果音音量 0..1 */
  volume: number;
  /**
   * v0.22：採用ガチャのピティ（天井）カウンタ。S 非排出の連続回数。
   * pityThreshold（20）到達で次の 1 回が S 確定。S 排出でリセット。セーブに永続化。
   */
  gachaPity: number;
  /** v0.25 装備：購入済み装備の個数（itemId→個数・実体方式で1個=1社員ぶん）。割当は Employee.equipped。 */
  ownedItems: OwnedItems;
} & Actions;

/**
 * import 時副作用ゼロの初期状態（logic-architecture §3）。
 * セーブ読込・オフライン収益・採用候補・トレンド補充は boot.ts の bootGameStore() が
 * アプリ起動時に上書きする。テストは boot を呼ばず、この決定的な初期状態から始められる。
 * トレンドは expiresAt: 0（期限切れ）のプレースホルダ。boot / tick 側の ensureTrend が差し替える。
 */
const pureDefaults = storage.defaults();

export const useGameStore = create<GameState>()(
  subscribeWithSelector((set, get) => ({
    screen: 'office',
    funds: pureDefaults.funds,
    lifetimeRevenue: 0,
    fans: 0,
    employees: [],
    candidate: null,
    unlockedScales: pureDefaults.unlockedScales,
    unlockedGenres: pureDefaults.unlockedGenres,
    unlockedThemes: pureDefaults.unlockedThemes,
    unlockedCategories: [...INITIAL_CATEGORY_IDS],
    ghosts: pureDefaults.ghosts,
    library: [],
    trend: { genreId: GENRES[0].id, themeId: THEMES[0].id, expiresAt: 0 },
    records: pureDefaults.records,
    achievements: [],
    newlyAchieved: [],
    tutorialDone: false,
    current: null,
    lastReleased: null,
    lastLevelUps: [],
    offlineReport: null,
    investPurchaseCount: pureDefaults.investPurchaseCount,
    currentDate: pureDefaults.currentDate ?? INITIAL_GAME_DATE,
    lastFixedCost: null,
    gameOver: false,
    debt: 0,
    muted: pureDefaults.muted,
    volume: pureDefaults.volume,
    gachaPity: pureDefaults.gachaPity,
    ownedItems: pureDefaults.ownedItems,

    goTo: (screen) => set({ screen }),

    startProject: (genreId, themeId, scale, titleInput) => {
      const def = SCALE_BY_ID[scale];
      const title = titleInput?.trim() || generateTitle(genreId, themeId, deps.rng);
      // v0.11 後期：締切（残り時間）を廃止し進捗オンリーに。
      // 作業量目標 workTarget（完走フレーズ数）まで打って初めて完了する（AFK では終わらない）。
      // 例：mini neededWeeks 8 × 3 = 24 フレーズ。速く打つほど少ない本数で到達＝早期完了。
      const workTarget = Math.max(3, Math.round(def.neededWeeks * DEV_PHRASES_PER_WEEK));
      const project: CurrentProject = {
        title,
        genreId,
        themeId,
        scale,
        phase: 'planning',
        axes: { ...ZERO_AXES },
        devStats: { program: 0, graphics: 0, sound: 0, design: 0 },
        requiredLoC: def.requiredLoC,
        doneLoC: 0,
        maxCombo: 0,
        devBoostRemainingSec: 0,
        bugCount: 0,
        adDebugUsed: false,
        startedAt: performance.now(),
        finishedAt: null,
        adBoostActive: false,
        surveyedCompat: null,
        // v0.14：開発カテゴリ選択は廃止（オーナー決定）。型は後方互換のため残し空配列固定
        selectedCategories: [],
        // v0.17：常に全員参加
        assignedEmployeeIds: get().employees.map((e) => e.id),
        perf: { wpm: 0, maxCombo: 0, accuracy: 1 },
        startDate: get().currentDate,
        timeShortcutsUnlocked: [],
        workTarget,
        ...buildMissionFlavor(genreId),
      };
      // v0.x：前払い開発費 devCost（=規模の baseCost）を企画開始時に徴収する。
      // 資金不足分は自動で借金へ振替（computeSpend は monthlyTick と同じ規則）。
      const spend = computeSpend({ funds: get().funds, debt: get().debt }, def.baseCost);
      set({
        current: project,
        screen: 'develop',
        trend: ensureTrend(get().trend, now(), deps.rng),
        funds: spend.funds,
        debt: spend.debt,
      });
    },

    tickAuto: (deltaSec) => {
      const cur = get().current;
      if (!cur) return;
      const progSpeed = sumProgrammerSpeed(get().employees);
      const boost = cur.devBoostRemainingSec > 0 ? 2 : 1;
      const add = progSpeed * deltaSec * boost;
      if (cur.finishedAt === null) {
        const newDone = Math.min(cur.requiredLoC, cur.doneLoC + add);
        set({
          current: {
            ...cur,
            doneLoC: newDone,
            devBoostRemainingSec: Math.max(0, cur.devBoostRemainingSec - deltaSec),
          },
        });
      }
    },

    tickWeek: () => {
      const s = get();
      const prev = s.currentDate;
      const next = addWeeks(prev, 1);
      // 月またぎ判定：month が変わったら固定費発生
      const monthChanged = prev.month !== next.month || prev.year !== next.year;
      set({ currentDate: next });
      if (monthChanged) {
        get().monthlyTick();
      }
    },

    monthlyTick: () => {
      const r = computeMonthlyTick(get());
      set({ funds: r.funds, debt: r.debt, lastFixedCost: r.cost });
      if (r.gameOver) get().triggerGameOver();
      return r.cost;
    },

    triggerGameOver: () => {
      if (get().gameOver) return;
      set({ gameOver: true });
    },

    clearGameOver: () => set({ gameOver: false }),

    applyTimeShortcut: (thresholdWpm, _weeksDelta) => {
      const cur = get().current;
      if (!cur) return false;
      const list = cur.timeShortcutsUnlocked ?? [];
      if (list.includes(thresholdWpm)) return false;
      // 期間短縮の実態は DevelopScreen 側の表示（経過 / 必要週数）に反映する。
      // ここではフラグだけ立てて重複通知を防ぐ。
      set({
        current: {
          ...cur,
          timeShortcutsUnlocked: [...list, thresholdWpm],
        },
      });
      return true;
    },

    tickSales: (deltaSec) => {
      if (deltaSec <= 0) return;
      const lib = get().library;
      let earned = 0;
      const updated = lib.map((w) => {
        if (!w.selling) return w;
        const r = settlePool(w.salesPool, w.decayPerSec, deltaSec);
        earned += r.payout;
        return {
          ...w,
          salesPool: r.remaining,
          totalRevenue: w.totalRevenue + r.payout,
          selling: !r.sold,
        };
      });
      if (earned <= 0) {
        // selling 状態が変わったケースだけ反映
        const changed = updated.some((w, i) => w.selling !== lib[i].selling);
        if (changed) set({ library: updated });
        return;
      }
      const s = get();
      const newAch = evaluateAchievements(s.achievements, {
        library: updated,
        fans: s.fans,
        lifetimeRevenue: s.lifetimeRevenue + earned,
        bestCombo: s.records.bestCombo,
      });
      set({
        library: updated,
        funds: s.funds + earned,
        lifetimeRevenue: s.lifetimeRevenue + earned,
        achievements: newAch.unlocked,
        newlyAchieved: [...s.newlyAchieved, ...newAch.newly],
      });
    },

    addDevelopLoC: (n) => {
      const cur = get().current;
      if (!cur || cur.finishedAt !== null) return;
      // v0.11 後期：進捗の上限は workTarget（作業量目標）。doneLoC が達したら完了。
      const cap = cur.workTarget ?? cur.requiredLoC;
      const newDone = Math.min(cap, cur.doneLoC + n);
      set({ current: { ...cur, doneLoC: newDone } });
    },

    erodeDevelopLoC: (n) => {
      // v0.15：バグ侵食。完成度をじわ減りさせる（0 未満にはならない＝詰まない）。
      const cur = get().current;
      if (!cur || cur.finishedAt !== null) return;
      set({ current: { ...cur, doneLoC: Math.max(0, cur.doneLoC - n) } });
    },

    addDevStat: (key, n) => {
      const cur = get().current;
      if (!cur || cur.finishedAt !== null) return;
      const stats = cur.devStats ?? { program: 0, graphics: 0, sound: 0, design: 0 };
      set({ current: { ...cur, devStats: { ...stats, [key]: stats[key] + n } } });
    },

    reportCombo: (combo) => {
      const cur = get().current;
      if (cur && combo > cur.maxCombo) {
        set({
          current: {
            ...cur,
            maxCombo: combo,
            perf: { ...cur.perf, maxCombo: Math.max(cur.perf.maxCombo, combo) },
          },
        });
      }
      const rec = get().records;
      if (combo > rec.bestCombo) {
        set({ records: { ...rec, bestCombo: combo } });
      }
    },

    reportWPM: (wpm) => {
      const cur = get().current;
      if (cur) {
        set({ current: { ...cur, perf: { ...cur.perf, wpm: Math.max(cur.perf.wpm, wpm) } } });
      }
      const rec = get().records;
      if (wpm > rec.bestWPM) {
        set({ records: { ...rec, bestWPM: Math.round(wpm) } });
      }
    },

    reportAccuracy: (acc) => {
      const cur = get().current;
      if (!cur) return;
      const clamped = Math.max(0, Math.min(1, acc));
      set({ current: { ...cur, perf: { ...cur.perf, accuracy: clamped } } });
    },

    finishDevelopment: () => {
      const cur = get().current;
      if (!cur || cur.finishedAt !== null) return;
      const nowMs = performance.now();
      const developSec = (nowMs - cur.startedAt) / 1000;
      const prevGhost = get().ghosts[cur.scale];
      const beat = prevGhost === null || developSec < prevGhost;
      const newGhost = beat ? developSec : prevGhost;

      // v0.11 後期：開発中は GlobalTicker が裏で週を進め固定費も精算済み。
      // よってここでは週の一括進行や固定費精算は行わない（二重計上を防ぐ）。
      // 実際にかかった週数（startDate→currentDate）は releaseWork の developWeeks に反映される。
      set({
        current: {
          ...cur,
          finishedAt: nowMs,
          doneLoC: cur.workTarget ?? cur.requiredLoC,
          // v0.14：発売フェーズへ（ReleaseScreen の広告選択＝発売作業に対応）
          phase: 'release',
        },
        ghosts: { ...get().ghosts, [cur.scale]: newGhost },
        screen: 'release',
      });
    },

    devSkipDevelopment: () => {
      const cur = get().current;
      if (!cur || cur.finishedAt !== null) return;
      // DEV 専用：平均的な開発プレイ相当の成績を積む（乱数なし・決定的）。
      const sim = simulateAverageDevRun();
      set({ current: { ...cur, perf: sim.perf, devStats: sim.devStats } });
      // 発売遷移（doneLoC 充填・phase=release・ゴースト更新）は既存フローに委譲。
      get().finishDevelopment();
    },

    advancePhase: () => {
      const cur = get().current;
      if (!cur) return;
      const phase: DevPhase = cur.phase ?? 'development';
      const idx = DEV_PHASE_ORDER.indexOf(phase);
      const next = DEV_PHASE_ORDER[idx + 1];
      if (!next) return;
      // 発売以降は既存リリースフロー（finishDevelopment → ReleaseScreen）に委譲。
      if (next === 'release' || next === 'complete') {
        get().finishDevelopment();
        return;
      }
      // v0.17.1：開発完了時はバグの最低保証（どんなコードにもバグはいる）
      const bugCount =
        phase === 'development' ? ensureMinBugsOnDevComplete(cur.bugCount) : cur.bugCount;
      set({ current: { ...cur, phase: next, bugCount } });
    },

    applyAxisDelta: (delta) => {
      const cur = get().current;
      if (!cur) return;
      const axes = { ...(cur.axes ?? ZERO_AXES) };
      (Object.keys(delta) as DevAxis[]).forEach((k) => {
        axes[k] = (axes[k] ?? 0) + (delta[k] ?? 0);
      });
      set({ current: { ...cur, axes } });
    },

    releaseWork: (opts) => {
      const s = get();
      const cur = s.current;
      if (!cur) throw new Error('no current project');
      const { work, patch } = computeRelease({ ...s, current: cur }, opts, deps);
      set(patch);
      return work;
    },

    applyLaunchAd: () => {
      const s = get();
      const released = s.lastReleased;
      if (!released) return 0;
      // lastReleased と library の同一作品は**別の役割**を持つので、それぞれに適用する。
      //  - lastReleased … 発売時点のスナップショット（リリース画面の「初動／販売プール／売上見込」）。
      //                   tickSales は触らないので、ここに library の減衰済み salesPool を
      //                   持ち込むと「広告を見たら売上見込が減った」ように見えてしまう。
      //  - library      … 販売中の現物（totalRevenue が積み上がり salesPool が減衰していく）。
      //                   ここを lastReleased で上書きすると販売ぶんが巻き戻る。
      // initialRevenue は tickSales で変化しないため、両者のボーナス額は必ず一致する。
      const snapshot = applyLaunchAdToWork(released);
      if (!snapshot) return 0; // 二重適用ガード
      const live = s.library.find((w) => w.id === released.id);
      const liveApplied = live ? applyLaunchAdToWork(live) : null;
      const bonus = snapshot.bonus;
      set({
        lastReleased: snapshot.work,
        library: liveApplied
          ? s.library.map((w) => (w.id === released.id ? liveApplied.work : w))
          : s.library,
        funds: s.funds + bonus,
        lifetimeRevenue: s.lifetimeRevenue + bonus,
        records: {
          ...s.records,
          // computeRelease と同じ意味（発売時点の総売上見込）で最高記録を更新。
          // salesPool は減衰するので initialSalesPool を使う。
          bestRevenue: Math.max(
            s.records.bestRevenue,
            snapshot.work.initialRevenue + snapshot.work.initialSalesPool,
          ),
        },
      });
      return bonus;
    },

    buyAdDevBoost: () => {
      const cur = get().current;
      if (!cur || cur.finishedAt !== null) return;
      set({ current: { ...cur, devBoostRemainingSec: cur.devBoostRemainingSec + 30 } });
    },

    buyAdSurvey: (g, t) => {
      const cur = get().current;
      const surveyed = +getCompatPublic(g, t).toFixed(2);
      if (cur) {
        set({ current: { ...cur, surveyedCompat: surveyed } });
      } else {
        // 企画中：ストアにスナップショットを残すために state を借りる手段がないため、
        // PlanScreen 側で setState 呼び出しに頼る（このアクションは経由しない）
      }
    },

    noteBugOnMiss: () => {
      const cur = get().current;
      if (!cur || cur.finishedAt !== null) return false;
      if (!rollBugOnMiss()) return false;
      set({ current: { ...cur, bugCount: cur.bugCount + 1 } });
      return true;
    },

    noteBugOnKeystroke: () => {
      const cur = get().current;
      if (!cur || cur.finishedAt !== null) return false;
      if (!rollBugOnKeystroke(get().employees, deps.rng)) return false;
      set({ current: { ...cur, bugCount: cur.bugCount + 1 } });
      return true;
    },

    fixBug: () => {
      const cur = get().current;
      if (!cur) return;
      set({ current: { ...cur, bugCount: Math.max(0, cur.bugCount - 1) } });
    },

    adDebugAssist: () => {
      const cur = get().current;
      if (!cur || cur.adDebugUsed || cur.bugCount <= 0) return false;
      const cleared = bugsClearedByAd(cur.bugCount);
      set({ current: { ...cur, bugCount: cur.bugCount - cleared, adDebugUsed: true } });
      return true;
    },

    hireCandidate: () => {
      const cand = get().candidate;
      if (!cand) return false;
      if (get().employees.length >= MAX_EMPLOYEES) return false; // 席数=最大人数で打ち止め
      if (get().funds < cand.wage) return false;
      const emp: Employee = {
        ...cand,
        id: `e-${now()}-${deps.rng().toString(36).slice(2, 6)}`,
      };
      set({
        funds: get().funds - cand.wage,
        employees: [...get().employees, emp],
        candidate: null,
      });
      return true;
    },

    pullGacha: (kind) => {
      const price = gachaPrice(kind, get().unlockedScales);
      if (get().funds < price) return false;
      const pity = get().gachaPity;
      const rank = rollRank(kind, deps.rng, pity);
      set({
        funds: get().funds - price,
        candidate: newCandidate(deps, rank),
        // premium のみ天井を更新。normal は S を出さないので pity は据え置き。
        gachaPity: kind === 'premium' ? nextPityCount(pity, rank) : pity,
      });
      return true;
    },

    dismissCandidate: () => set({ candidate: null }),

    fireEmployee: (id) => {
      set({ employees: get().employees.filter((e) => e.id !== id) });
    },

    unlockNextScale: () => {
      const next = nextLockedScale(get().unlockedScales);
      if (!next) return false;
      // v0.18：累計売上ゲートを有効化（実績を積まないと金だけでは解放できない）
      if (get().lifetimeRevenue < next.unlockSalesRequired) return false;
      if (get().funds < next.unlockCost) return false;
      set({
        funds: get().funds - next.unlockCost,
        unlockedScales: [...get().unlockedScales, next.id],
      });
      return true;
    },

    // v0.21 投資：未解放ジャンル/テーマを資金で先行購入する。unlockedGenres/Themes は
    // セーブされる単調増加の union（解放済みが消えない蓄積配列）なので、そこへ追加するだけで
    // 永続化され、以後は自動解放分と同一扱いになる（computeStageUnlocks は無改修）。
    // 価格は investPurchaseCount による逓増カーブ。購入のたびにカウントを +1 する。
    buyGenre: (id) => {
      const s = get();
      if (s.unlockedGenres.includes(id)) return false;
      const price = investPrice(GENRE_BY_ID[id].unlockStage, s.investPurchaseCount);
      if (price === null || s.funds < price) return false;
      set({
        funds: s.funds - price,
        unlockedGenres: [...s.unlockedGenres, id],
        investPurchaseCount: s.investPurchaseCount + 1,
      });
      return true;
    },

    buyTheme: (id) => {
      const s = get();
      if (s.unlockedThemes.includes(id)) return false;
      const price = investPrice(THEME_BY_ID[id].unlockStage, s.investPurchaseCount);
      if (price === null || s.funds < price) return false;
      set({
        funds: s.funds - price,
        unlockedThemes: [...s.unlockedThemes, id],
        investPurchaseCount: s.investPurchaseCount + 1,
      });
      return true;
    },

    // v0.25 装備：購入（実体方式。1個=1社員ぶん。既に所有していても追加購入して個数を増やせる）。
    buyEquipment: (itemId) => {
      const s = get();
      const def = EQUIPMENT_BY_ID[itemId];
      if (!def) return false;
      if (!canBuyEquipment({ def, funds: s.funds })) return false;
      set({
        funds: s.funds - def.cost,
        ownedItems: { ...s.ownedItems, [itemId]: (s.ownedItems[itemId] ?? 0) + 1 },
      });
      return true;
    },

    // v0.25 装備：社員のスロットに割当/解除。null・初期装備で解除（equipped からキー削除）。
    // 実体方式：別の社員へ新規装備するには「空き個数（購入済み−使用中）」が要る。
    equipItem: (empId, slot, itemId) => {
      const s = get();
      const emp = s.employees.find((e) => e.id === empId);
      if (!emp) return false;
      const isDefault = itemId !== null && DEFAULT_LOADOUT[slot] === itemId;
      if (itemId !== null && !isDefault) {
        const def = EQUIPMENT_BY_ID[itemId];
        if (!def || def.slot !== slot) return false;
        const already = emp.equipped?.[slot] === itemId; // 同じ物を着け直すのは空き不要
        const loadouts = s.employees.map((e) => e.equipped ?? {});
        if (!already && freeCopies(s.ownedItems, loadouts, itemId) <= 0) return false;
      }
      const employees = s.employees.map((e) => {
        if (e.id !== empId) return e;
        const equipped = { ...(e.equipped ?? {}) };
        if (itemId === null || isDefault) delete equipped[slot];
        else equipped[slot] = itemId;
        return { ...e, equipped };
      });
      set({ employees });
      return true;
    },

    clearOfflineReport: () => set({ offlineReport: null }),
    finishTutorial: () => set({ tutorialDone: true }),
    clearNewlyAchieved: () => set({ newlyAchieved: [] }),

    setMuted: (m) => {
      setSfxMuted(m);
      set({ muted: m });
    },
    setVolume: (v) => {
      const vol = Math.min(1, Math.max(0, v));
      setSfxVolume(vol);
      set({ volume: vol });
    },

    borrowMoney: (amount) => {
      const patch = computeBorrow(get(), amount);
      if (!patch) return false;
      set(patch);
      return true;
    },

    repayDebt: (amount) => {
      const patch = computeRepay(get(), amount);
      if (!patch) return false;
      set(patch);
      return true;
    },

    reset: () => {
      storage.reset();
      const d = storage.defaults();
      set({
        screen: 'plan',
        funds: d.funds,
        lifetimeRevenue: d.lifetimeRevenue,
        fans: d.fans,
        employees: d.employees,
        candidate: null,
        unlockedScales: d.unlockedScales,
        unlockedGenres: d.unlockedGenres,
        unlockedThemes: d.unlockedThemes,
        unlockedCategories: d.unlockedCategories,
        ghosts: d.ghosts,
        library: d.library,
        trend: ensureTrend(null, now(), deps.rng),
        records: d.records,
        achievements: [],
        newlyAchieved: [],
        tutorialDone: false,
        current: null,
        lastReleased: null,
        lastLevelUps: [],
        offlineReport: null,
        investPurchaseCount: d.investPurchaseCount,
        currentDate: d.currentDate,
        lastFixedCost: null,
        gameOver: false,
        debt: 0,
        muted: d.muted,
        volume: d.volume,
        gachaPity: 0,
        ownedItems: d.ownedItems,
      });
      setSfxMuted(d.muted);
      setSfxVolume(d.volume);
    },
  })),
);

// 自動保存・window.__gs 等の起動時副作用は state/boot.ts の bootGameStore() に集約
// （logic-architecture §3。main.tsx が render 前に1回だけ呼ぶ）

// 内部利用：相性の安全な取得（循環依存回避のため lazy require）
import { getCompat } from '../data/compatibility';

const getCompatPublic = (g: GenreId, t: ThemeId) => getCompat(g, t);

export const ALL_SCALES = SCALES;
export const ALL_ACHIEVEMENTS = ACHIEVEMENTS;
