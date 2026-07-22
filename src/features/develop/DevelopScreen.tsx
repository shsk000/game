import { useEffect, useMemo, useRef, useState } from 'react';
import { ads } from '../../ads/AdProvider';
import { PlanMeetingBoard } from '../../components/PlanMeetingBoard';
import { PixelStatusBar, SegGauge } from '../../components/ui';
import { bugSuppression, bugsClearedByAd, pickBugFixPhrase } from '../../core/bugs';
import {
  comboTitleAt,
  type Gear,
  gearFor,
  isCrunchActive,
  keyPitchStep,
  rollBoss,
  rollCrit,
  rollRare,
} from '../../core/juice';
import { splitMorae } from '../../core/kanaProgress';
import { BUG_CONFIG, JUICE_CONFIG, planWeeksAllowance } from '../../data/balance';
import { buildLine } from '../../data/codeSnippets';
import {
  ATTR_BASE_GAIN,
  CATEGORY_META,
  comboAttrMultiplier,
  getTicketAt,
  PHRASES_PER_TICKET,
  pickBossPhrase,
  pickPhrase,
  type SpeedRank,
  speedRank,
  type TicketCategory,
} from '../../data/devPhrases';
import {
  type AxisDelta,
  type DevEvent,
  EVENT_CATEGORY_META,
  formatAxisDelta,
  PHASE_EVENTS,
} from '../../data/events';
import { GENRE_BY_ID, type GenreId, genreBackgroundUrl, genreSpriteUrl } from '../../data/genres';
import {
  GENRE_PLAN_CONTENT,
  getPlanTicketAt,
  PHRASES_PER_PLAN_TICKET,
  PLAN_BASE_GAIN,
  PLAN_CATEGORY_META,
  PLAN_CATEGORY_ORDER,
  type PlanCategory,
  pickPlanMemo,
  pickPlanPhrase,
} from '../../data/planTickets';
import { SCALE_BY_ID } from '../../data/scales';
import { THEME_BY_ID } from '../../data/themes';
import { useGameStore } from '../../state/gameStore';
import {
  DEV_PHASE_META,
  DEV_PHASE_ORDER,
  type DevPhase,
  type EmployeeRole,
  dateToWeekIndex,
} from '../../state/types';
import { sfx } from '../../utils/sfx';
import { computeDevImpact, progressGain, toCharsPerMin } from './devImpact';
import { type TypingView, useTyping } from './useTyping';

/** v0.15.2 フィーバー定数（叩き台 🔧）：正打 60 打で MAX、15 秒間 進捗×2 */
const FEVER_MAX = 60;
const FEVER_DURATION_MS = 15000;

/** 開発全体の PHASE ドット総数（演出。overall progressPct に連動） */
const TOTAL_PHASE_DOTS = 6;

/** チケットカードの固定高さ（内容の長短で入力欄が上下しないように） */
const TICKET_CARD_HEIGHT = 76;

/**
 * v0.20 G：ボス文章の間だけ「RPGの戦闘っぽさ」を出すための挿絵（オーナー発注・PixelLab生成）。
 * ボス文章が選ばれるたびにランダムに1体選ぶ（表示専用。ゲームロジックには影響しない）。
 */
const BOSS_SPRITES = [
  { name: 'デスマーチゴーレム', url: '/sprites/boss/crunch-golem.png' },
  { name: '締め切りデーモン', url: '/sprites/boss/deadline-demon.png' },
  { name: 'バグロボット', url: '/sprites/boss/bug-robot.png' },
  { name: 'スパゲッティコードモンスター', url: '/sprites/boss/spaghetti-monster.png' },
] as const;

type LastResult =
  | {
      kind: 'ticket';
      rank: SpeedRank;
      speedPct: number;
      qualityDelta: number;
      bugPct: number;
      /** この 1 文で実際に進んだ完成度（進捗ゲージに入る値そのもの） */
      progress: number;
      /** v0.20 C：この1文がボス文章の完走だったか（画面シェイクの追加トリガーに使う） */
      boss?: boolean;
      ts: number;
    }
  | {
      kind: 'plan';
      rank: SpeedRank;
      funGain: number;
      hypeGain: number;
      /** 獲得量の実際の内訳（コンボ倍率・速度倍率） */
      comboMult: number;
      speedMult: number;
      ts: number;
    }
  | { kind: 'event'; event: DevEvent; ts: number };

/**
 * v0.15.2「作業チケット」UI（オーナー改修指示 2026-07-08）：
 * ゲージを並べる画面ではなく「作業チケットをタイピングで進める画面」。
 * プレイヤーが一目で理解すべきことを 3 つに絞る：
 *   1. 今なにを作っているか（作業チケット）
 *   2. なにを入力すればいいか（入力する文章）
 *   3. 入力した結果どう変わったか（今回の結果カード）
 *
 * モック `ui/phase/development_ui.png` 準拠の 3 カラム大枠は維持：
 * - 左：フェーズ進行・チーム状態・開発全体の進捗
 * - 中央：作業チケット・タイピング入力・実装中の様子・結果カード（開発フェーズのみ本改修）
 * - 右：現在のプロジェクト説明（ゲームプレビューは廃止）
 * - 下：イベント情報 ＋ BGM
 */
export const DevelopScreen = () => {
  const current = useGameStore((s) => s.current);
  const currentDate = useGameStore((s) => s.currentDate);
  const employees = useGameStore((s) => s.employees);
  const addDevelopLoC = useGameStore((s) => s.addDevelopLoC);
  const addDevStat = useGameStore((s) => s.addDevStat);
  const advancePhase = useGameStore((s) => s.advancePhase);
  // DEV 検証用：タイピングを飛ばして発売フェーズへ即到達する（docs/qa/bug-hunt.md 参照）
  const finishDevelopment = useGameStore((s) => s.finishDevelopment);
  const noteBugOnMiss = useGameStore((s) => s.noteBugOnMiss);
  const noteBugOnKeystroke = useGameStore((s) => s.noteBugOnKeystroke);
  const fixBug = useGameStore((s) => s.fixBug);
  const bugCount = useGameStore((s) => s.current?.bugCount ?? 0);
  const applyAxisDelta = useGameStore((s) => s.applyAxisDelta);
  const reportCombo = useGameStore((s) => s.reportCombo);
  const reportWPM = useGameStore((s) => s.reportWPM);
  const reportAccuracy = useGameStore((s) => s.reportAccuracy);

  const phase: DevPhase = current?.phase ?? 'development';
  const isDevelopment = phase === 'development';
  const isPlanning = phase === 'planning';
  const genreId = current?.genreId ?? 'action';

  // v0.20 C：クランチタイム（全体完成度が閾値を超えたら自動発動。開発フェーズのみ）
  const overallProgressPct = current
    ? Math.max(0, Math.min(100, (current.doneLoC / (current.workTarget || 1)) * 100))
    : 0;
  const crunchActive = isDevelopment && isCrunchActive(overallProgressPct);

  const wpmRef = useRef(0);
  const accuracyRef = useRef(1);
  const comboRef = useRef(0);
  const phraseStartRef = useRef(performance.now());

  // ★作業チケット状態：ticketIndex が進むほど CATEGORY_ORDER を周回しながら次のチケットへ。
  const [ticketIndex, setTicketIndex] = useState(0);
  const ticketIndexRef = useRef(0);
  const [ticketPhraseCount, setTicketPhraseCount] = useState(0);
  const ticketPhraseCountRef = useRef(0);
  const [completedTickets, setCompletedTickets] = useState<
    { title: string; category: TicketCategory }[]
  >([]);
  const currentTicket = useMemo(() => getTicketAt(genreId, ticketIndex), [genreId, ticketIndex]);
  const nextTicket = useMemo(() => getTicketAt(genreId, ticketIndex + 1), [genreId, ticketIndex]);

  const [ticketPhrase, setTicketPhrase] = useState(() =>
    pickPhrase(currentTicket.category, undefined, current?.scale),
  );

  // ★企画チケット状態（v0.15.3）：固定 7 カテゴリを順に打ち切ると企画書が埋まり、開発フェーズへ。
  const [planIndex, setPlanIndex] = useState(0);
  const planIndexRef = useRef(0);
  const [planPhraseCount, setPlanPhraseCount] = useState(0);
  const planPhraseCountRef = useRef(0);
  const [planDecided, setPlanDecided] = useState<{ category: PlanCategory; decided: string }[]>([]);
  const [planMemos, setPlanMemos] = useState<string[]>([]);
  const [planCards, setPlanCards] = useState<string[]>([]);
  const planCtx = useMemo(
    () => ({ genreName: GENRE_BY_ID[genreId]?.name ?? '', projectTitle: current?.title ?? '' }),
    [genreId, current?.title],
  );
  const currentPlanTicket = useMemo(
    () => getPlanTicketAt(genreId, Math.min(planIndex, PLAN_CATEGORY_ORDER.length - 1), planCtx),
    [genreId, planIndex, planCtx],
  );
  const [planPhrase, setPlanPhrase] = useState(() => pickPlanPhrase(PLAN_CATEGORY_ORDER[0]));

  // ★プログラム作業中の「今まさに書かれているコード行」（打鍵に合わせて1文字ずつ伸びる）
  const themeId = current?.themeId ?? 'sushi';
  const codeLineIdx = ticketIndex * PHRASES_PER_TICKET + ticketPhraseCount;
  const fullCodeLine = useMemo(
    () => buildLine({ genreId, themeId, idx: codeLineIdx }),
    [genreId, themeId, codeLineIdx],
  );

  // ★実装中の様子（カテゴリ別）
  const [programLog, setProgramLog] = useState<string[]>([]);
  const [designNotes, setDesignNotes] = useState<string[]>([]);
  const [graphicsFrame, setGraphicsFrame] = useState(0);
  const [soundBeatKey, setSoundBeatKey] = useState(0);

  // ★今回の結果カード（ゲージの代わりにこれが主役）
  const [lastResult, setLastResult] = useState<LastResult | null>(null);

  // イベント割り込み：pending（発生を告知）→ 現在の文を打ち切ったら active（実際に入力対象になる）
  const [pendingEvent, setPendingEvent] = useState<DevEvent | null>(null);
  const [activeEvent, setActiveEvent] = useState<DevEvent | null>(null);
  const pendingRef = useRef<DevEvent | null>(null);
  const activeRef = useRef<DevEvent | null>(null);
  pendingRef.current = pendingEvent;
  activeRef.current = activeEvent;

  const [flash, setFlash] = useState(0);
  // v0.20 A：コンボ節目の称号ポップ（50/150/300。key で CSS アニメを再トリガー）
  const [comboTitle, setComboTitle] = useState<{ label: string; combo: number; key: number } | null>(
    null,
  );
  // v0.20 A-2：FEVER 突入バナー（発動の瞬間に1回だけ横切る）
  const [feverBannerKey, setFeverBannerKey] = useState(0);
  // v0.20 B：クリティカル打鍵のポップ（key で CSS アニメを再トリガー）
  const [critKey, setCritKey] = useState(0);
  // v0.20 B：レア文章（開発フェーズのみ。次の作業チケット文が「当たり」かどうか）
  const [isRarePhrase, setIsRarePhrase] = useState(() => rollRare());
  const [rareHitKey, setRareHitKey] = useState(0);
  // v0.20 C：クランチ突入バナー（80%到達の瞬間に1回だけ）
  const [crunchBannerKey, setCrunchBannerKey] = useState(0);
  const crunchAnnouncedRef = useRef(false);
  // v0.20 C：ボス文章（クランチ中のみ。次の作業チケット文が「ボス」かどうか）
  const [isBossPhrase, setIsBossPhrase] = useState(false);
  const [bossHitKey, setBossHitKey] = useState(0);
  // v0.20 G：ボス戦演出（表示専用）。出現時にランダムな1体＋一度きりの出現バナー
  const [bossSprite, setBossSprite] = useState<(typeof BOSS_SPRITES)[number]>(BOSS_SPRITES[0]);
  const [bossAppearKey, setBossAppearKey] = useState(0);
  // v0.20 E：ノーミスストリーク（開発フェーズのみ。今の文でミスがあったかを完走まで保持）
  const phraseMissRef = useRef(false);
  const [perfectStreak, setPerfectStreak] = useState(0);

  // フィーバー：正打で蓄積・ミスで減少、MAX で自動発動
  const [feverGauge, setFeverGauge] = useState(0);
  const [feverActive, setFeverActive] = useState(false);
  const feverActiveRef = useRef(false);
  feverActiveRef.current = feverActive;
  const addFever = (n: number) => {
    if (feverActiveRef.current) return;
    setFeverGauge((g) => Math.min(FEVER_MAX, g + n));
  };
  const decayFever = () => {
    if (feverActiveRef.current) return;
    setFeverGauge((g) => Math.floor(g * 0.8));
  };
  useEffect(() => {
    if (!feverActive && feverGauge >= FEVER_MAX) {
      setFeverActive(true);
      setFeverGauge(FEVER_MAX);
      sfx.success();
      setFlash((n) => n + 1);
      setFeverBannerKey((k) => k + 1); // v0.20 A-2：突入バナー
      const t = window.setTimeout(() => {
        setFeverActive(false);
        setFeverGauge(0);
        sfx.phase();
      }, FEVER_DURATION_MS);
      return () => window.clearTimeout(t);
    }
  }, [feverGauge, feverActive]);

  // v0.20 C：クランチタイム突入（80%到達の瞬間に1回だけ通知。以降 doneLoC は減らないため再発火しない）
  useEffect(() => {
    if (crunchActive && !crunchAnnouncedRef.current) {
      crunchAnnouncedRef.current = true;
      sfx.crunch();
      setCrunchBannerKey((k) => k + 1);
    }
  }, [crunchActive]);

  // イベント抽選：8 秒ごとに 1 回、企画/開発フェーズ中のみ（フェーズごとのイベント表から）
  useEffect(() => {
    if ((!isDevelopment && !isPlanning) || !current) return;
    const pool = PHASE_EVENTS[isDevelopment ? 'development' : 'planning'];
    const timer = window.setInterval(() => {
      if (pendingRef.current || activeRef.current) return;
      for (const ev of pool) {
        if (Math.random() < ev.rate * 0.5) {
          setPendingEvent(ev);
          sfx.alert();
          setFlash((n) => n + 1);
          break;
        }
      }
    }, 8000);
    return () => window.clearInterval(timer);
  }, [isDevelopment, isPlanning, !current]);

  const currentInputPhrase = activeEvent
    ? activeEvent.mission
    : isPlanning
      ? planPhrase
      : ticketPhrase;
  const phrases = useMemo(() => [currentInputPhrase], [currentInputPhrase]);

  const { view, failCount, wpm, accuracy } = useTyping({
    phrases,
    paused: !current || !(isDevelopment || isPlanning),
    onPhraseComplete: () => {
      if (activeRef.current) {
        // イベント文を打ち切り＝成功（スキップ無し。詰みが無い代わりに必ず打つ）
        const ev = activeRef.current;
        applyAxisDelta(ev.success);
        sfx.success();
        setLastResult({ kind: 'event', event: ev, ts: Date.now() });
        setActiveEvent(null);
      } else if (isPlanning) {
        // 企画チケット：打ち切るたびに面白さ/期待度が実際に積み上がり、企画書が埋まっていく
        const t = currentPlanTicket;
        const elapsed = performance.now() - phraseStartRef.current;
        const { rank, mult: speedMult } = speedRank(planPhrase.length, elapsed);
        const comboMult = comboAttrMultiplier(comboRef.current);
        const gain = Math.max(1, Math.round(PLAN_BASE_GAIN * comboMult * speedMult));
        const weights = PLAN_CATEGORY_META[t.category].effects;
        const funGain = weights.funFactor * gain;
        const hypeGain = weights.hype * gain;
        applyAxisDelta({ funFactor: funGain, hype: hypeGain });

        sfx[rank === 'PERFECT' ? 'success' : 'complete']();
        setLastResult({
          kind: 'plan',
          rank,
          funGain,
          hypeGain,
          comboMult,
          speedMult,
          ts: Date.now(),
        });

        // 企画中の様子：メモが増え、アイデアカード（付箋）が貼られていく
        // （枠は 96px 固定・スクロール禁止のため直近 4 行に丸める）
        setPlanMemos((l) => [...l, pickPlanMemo(t.category, planPhraseCountRef.current)].slice(-4));
        const keywords = (GENRE_PLAN_CONTENT[genreId] ?? GENRE_PLAN_CONTENT.action).ideaKeywords;
        setPlanCards((l) => (l.length < keywords.length ? [...l, keywords[l.length]] : l));

        const nextCount = planPhraseCountRef.current + 1;
        const finishing = nextCount >= PHRASES_PER_PLAN_TICKET;
        if (finishing) {
          setPlanDecided((l) => [...l, { category: t.category, decided: t.flavor.decided }]);
          planIndexRef.current += 1;
          setPlanIndex(planIndexRef.current);
          planPhraseCountRef.current = 0;
          setPlanPhraseCount(0);
          if (planIndexRef.current >= PLAN_CATEGORY_ORDER.length) {
            // 企画書が完成 → 開発フェーズへ
            sfx.phase();
            advancePhase();
          }
        } else {
          planPhraseCountRef.current = nextCount;
          setPlanPhraseCount(nextCount);
        }
        const nextPlanIdx = Math.min(planIndexRef.current, PLAN_CATEGORY_ORDER.length - 1);
        setPlanPhrase(pickPlanPhrase(PLAN_CATEGORY_ORDER[nextPlanIdx]));

        if (pendingRef.current) {
          setActiveEvent(pendingRef.current);
          setPendingEvent(null);
        }
      } else {
        const category = currentTicket.category;
        const elapsed = performance.now() - phraseStartRef.current;
        const { rank, mult: speedMult } = speedRank(ticketPhrase.length, elapsed);
        const comboMult = comboAttrMultiplier(comboRef.current);
        const feverMult = feverActiveRef.current ? 1.5 : 1;
        const gain = Math.max(1, Math.round(ATTR_BASE_GAIN * comboMult * speedMult * feverMult));
        addDevStat(category, gain);

        const impactNow = computeDevImpact({ wpm: wpmRef.current, accuracy: accuracyRef.current });
        const progressNow =
          progressGain(wpmRef.current, false, comboRef.current) *
          (feverActiveRef.current ? 2 : 1) *
          (crunchActive ? JUICE_CONFIG.crunch.progressMult : 1);
        sfx[rank === 'PERFECT' ? 'success' : 'complete']();
        setLastResult({
          kind: 'ticket',
          rank,
          speedPct: impactNow.speedPct,
          qualityDelta: impactNow.qualityDelta,
          bugPct: impactNow.bugPct,
          progress: Math.round(progressNow * 10) / 10,
          boss: isBossPhrase,
          ts: Date.now(),
        });

        // v0.20 B：レア文章の完走報酬（開発フェーズのみ。FEVERゲージにのみ加算＝新しい加点経路を作らない）
        if (isRarePhrase) {
          addFever(JUICE_CONFIG.rare.feverBonus);
          sfx.rare();
          setRareHitKey((k) => k + 1);
        }
        // v0.20 C：ボス文章の完走報酬（クランチタイム中のみ。FEVERゲージにのみ加算）
        if (isBossPhrase) {
          addFever(JUICE_CONFIG.crunch.bossFeverBonus);
          sfx.crunch();
          setBossHitKey((k) => k + 1);
        }
        // v0.20 E：ノーミスストリーク（ミスがあった文の完走で0に戻す。ノーミスなら+1しFEVERに加算）
        if (phraseMissRef.current) {
          setPerfectStreak(0);
        } else {
          setPerfectStreak((s) => s + 1);
          addFever(JUICE_CONFIG.perfect.feverBonus);
        }
        phraseMissRef.current = false;

        // 実装中の様子：カテゴリごとに違う見え方で反映
        const nextCount = ticketPhraseCountRef.current + 1;
        const finishing = nextCount >= PHRASES_PER_TICKET;
        if (category === 'program') {
          setProgramLog((l) => {
            const next = [...l, fullCodeLine];
            if (finishing) next.push(`// ✅ ${currentTicket.flavor.title} 完了`);
            return next.slice(-4);
          });
        } else if (category === 'design') {
          setDesignNotes((l) => [...l, currentTicket.flavor.title].slice(-4));
        } else if (category === 'graphics') {
          setGraphicsFrame((f) => f + 1);
        } else if (category === 'sound') {
          setSoundBeatKey((k) => k + 1);
        }

        if (finishing) {
          setCompletedTickets((l) =>
            [...l, { title: currentTicket.flavor.title, category }].slice(-6),
          );
          ticketIndexRef.current += 1;
          setTicketIndex(ticketIndexRef.current);
          ticketPhraseCountRef.current = 0;
          setTicketPhraseCount(0);
        } else {
          ticketPhraseCountRef.current = nextCount;
          setTicketPhraseCount(nextCount);
        }
        const newCategory = getTicketAt(genreId, ticketIndexRef.current).category;
        // v0.20 C：クランチタイム中は稀にボス文章（プール2文連結の長文）を出す
        // レア文章とは独立抽選だが、両方当たった場合はボスを優先（バッジ・報酬の二重表示を避ける）
        const nextIsBoss = crunchActive && rollBoss();
        setTicketPhrase(
          nextIsBoss
            ? pickBossPhrase(newCategory, undefined, current?.scale)
            : pickPhrase(newCategory, undefined, current?.scale),
        );
        setIsBossPhrase(nextIsBoss);
        setIsRarePhrase(nextIsBoss ? false : rollRare());
        // v0.20 G：ボス出現時にランダムな1体を選び、出現バナーを一度だけ流す
        if (nextIsBoss) {
          setBossSprite(BOSS_SPRITES[Math.floor(Math.random() * BOSS_SPRITES.length)]);
          setBossAppearKey((k) => k + 1);
          sfx.crunch();
        }

        // 進捗（完成度）は従来通り：速度＋コンボ倍率＋フィーバー×2
        const progress =
          progressGain(wpmRef.current, false, comboRef.current) *
          (feverActiveRef.current ? 2 : 1) *
          (crunchActive ? JUICE_CONFIG.crunch.progressMult : 1);
        addDevelopLoC(progress);

        // 待機中のイベントがあれば、次の文としてイベント文を投入（途中差し替えしない）
        if (pendingRef.current) {
          setActiveEvent(pendingRef.current);
          setPendingEvent(null);
        }
      }

      const s = useGameStore.getState();
      const done = s.current?.doneLoC ?? 0;
      const target = s.current?.workTarget ?? 1;
      if (done >= target && (s.current?.phase ?? 'development') === 'development') {
        advancePhase();
      }
    },
    onCorrect: (c) => {
      comboRef.current = c;
      // v0.20 A：コンボが乗るほど打鍵音の音階が上がる（切れると元に戻る）
      sfx.key(keyPitchStep(c));
      const title = comboTitleAt(c);
      if (title) {
        sfx.combo();
        setComboTitle((t) => ({ label: title, combo: c, key: (t?.key ?? 0) + 1 }));
      }
      if (isDevelopment) {
        // v0.20 B：クリティカル打鍵（正打の一定確率でFEVERゲージが大きく跳ねる）
        if (rollCrit()) {
          addFever(JUICE_CONFIG.crit.feverBonus);
          sfx.crit();
          setCritKey((k) => k + 1);
        } else {
          // v0.20 E：クリティカルでない打鍵は入力速度に応じたギアでフィーバーが溜まる
          addFever(gearFor(wpmRef.current).feverGain); // フィーバー（ノリ）は開発フェーズ専用
        }
        // v0.17.1：実装の打鍵のたびにバグ抽選（社員能力が高いほど発生率低下）
        if (noteBugOnKeystroke()) {
          sfx.alert();
          setFlash((n) => n + 1);
        }
      }
      reportCombo(c);
    },
    onComboBreak: () => {
      comboRef.current = 0;
      sfx.miss();
      decayFever();
    },
    // v0.17.1：バグの種はコンボ切れではなく「毎ミス」で判定（連続ミスも漏らさない）
    onFail: () => {
      if (isDevelopment) {
        // v0.20 E：ノーミスストリークの判定用（この文でミスがあったことを完走時まで保持）
        phraseMissRef.current = true;
        if (noteBugOnMiss()) {
          sfx.alert();
          setFlash((n) => n + 1);
        }
      }
    },
    onWpm: (w) => {
      wpmRef.current = w;
      reportWPM(w);
    },
    onAccuracy: (a) => {
      accuracyRef.current = a;
      reportAccuracy(a);
    },
  });

  useEffect(() => {
    phraseStartRef.current = performance.now();
  }, [currentInputPhrase]);

  // 打鍵の進み具合に合わせてコード行を1文字ずつ伸ばす（実装ログが「流れて見える」ように）
  const typedLen = view.completed.length;
  const totalLen = Math.max(1, typedLen + view.remained.length);
  const liveCodeLine = fullCodeLine.slice(
    0,
    Math.max(1, Math.ceil((typedLen / totalLen) * fullCodeLine.length)),
  );

  const workTarget = current?.workTarget ?? 1;

  if (!current) return null;
  const scaleDef = SCALE_BY_ID[current.scale];
  if (!scaleDef) return null;

  const charsPerMin = toCharsPerMin(wpm);
  const accuracyPct = Math.round(accuracy * 1000) / 10;
  const progressPct = Math.max(0, Math.min(100, (current.doneLoC / workTarget) * 100));
  const litPhaseDots = Math.max(
    1,
    Math.min(TOTAL_PHASE_DOTS, Math.ceil((progressPct / 100) * TOTAL_PHASE_DOTS)),
  );

  // 企画の進捗（企画書完成度）：完了チケット＋現在チケット内のフレーズ消化
  const planProgressPct = Math.min(
    100,
    ((planIndex + planPhraseCount / PHRASES_PER_PLAN_TICKET) / PLAN_CATEGORY_ORDER.length) * 100,
  );
  const planLitDots = Math.max(
    1,
    Math.min(TOTAL_PHASE_DOTS, Math.ceil((planProgressPct / 100) * TOTAL_PHASE_DOTS)),
  );

  // 予定週 = 開発ぶん（neededWeeks）＋企画・仕上げの猶予（v0.15.3）
  const plannedWeeks = Math.max(1, scaleDef.neededWeeks + planWeeksAllowance(scaleDef.neededWeeks));
  const elapsedWeeks = current.startDate
    ? Math.max(0, dateToWeekIndex(currentDate) - dateToWeekIndex(current.startDate))
    : 0;
  const weekDiff = elapsedWeeks - plannedWeeks;
  const weeksLeft = Math.max(0, plannedWeeks - elapsedWeeks);
  const budgetPct = Math.min(130, (elapsedWeeks / plannedWeeks) * 100);
  const overBudget = weekDiff > 0;
  const periodColor = overBudget ? '#ff6b6b' : weeksLeft <= 1 ? DEV.orange : DEV.timeGreen;
  const periodNote = overBudget
    ? `予定超過 +${weekDiff} 週（固定費がかさむ！）`
    : `予定内：残り ${weeksLeft} 週`;

  const genre = GENRE_BY_ID[current.genreId];
  const theme = THEME_BY_ID[current.themeId];
  const phaseMeta = DEV_PHASE_META[phase];

  return (
    <div
      className={`screen develop-screen${feverActive ? ' dev-fever' : ''}`}
      style={{ background: '#05080c', position: 'relative' }}
    >
      <PixelStatusBar />

      {flash > 0 && <div key={`flash-${flash}`} className="dev-flash-vignette" />}

      {/* v0.20 A：コンボ節目の称号ポップ（打鍵は止めない。目線の少し上に一瞬出て消える） */}
      {comboTitle && (
        <>
          <div key={`goldflash-${comboTitle.key}`} className="dev-gold-flash" />
          <div key={`combo-title-${comboTitle.key}`} className="dev-combo-title">
            <span>{comboTitle.label}</span>
            <span className="dev-combo-title-sub">{comboTitle.combo} COMBO</span>
          </div>
        </>
      )}

      {/* v0.20 A-2：FEVER 突入バナー（発動の瞬間に横切って消える。バッジは既存表示が継続） */}
      {feverBannerKey > 0 && feverActive && (
        <div key={`fever-banner-${feverBannerKey}`} className="dev-fever-banner">
          🔥FEVER!!🔥
        </div>
      )}

      {/* v0.20 B：クリティカル打鍵ポップ（打鍵は止めない。小さく速く出て消える）
          v0.20 F：オーナーFB「feverが溜まりやすくなったことが分かる仕組みが欲しい（ゲージ以外で）」
          を受け、実際にFEVERへ入った量を🔥+Nとして数字で見せる（新しいゲージは作らない） */}
      {critKey > 0 && (
        <div key={`crit-${critKey}`} className="dev-crit-pop">
          ⚡CRITICAL! 🔥+{JUICE_CONFIG.crit.feverBonus}
        </div>
      )}

      {/* v0.20 B：レア文章の完走ポップ */}
      {rareHitKey > 0 && (
        <div key={`rare-hit-${rareHitKey}`} className="dev-rare-pop">
          ★レア達成！ 🔥+{JUICE_CONFIG.rare.feverBonus}
        </div>
      )}

      {/* v0.20 C：クランチタイム突入バナー（80%到達の瞬間に1回だけ横切る） */}
      {crunchBannerKey > 0 && (
        <div key={`crunch-${crunchBannerKey}`} className="dev-crunch-banner">
          ⏰ラストスパート！！⏰
        </div>
      )}

      {/* v0.20 C：ボス文章の完走ポップ（画面シェイクは入力行側で付与） */}
      {bossHitKey > 0 && (
        <div key={`boss-hit-${bossHitKey}`} className="dev-rare-pop dev-boss-pop">
          ⚔BOSS撃破！ 🔥+{JUICE_CONFIG.crunch.bossFeverBonus}
        </div>
      )}

      {/* v0.20 G：ボス出現バナー（ボス文章に切り替わった瞬間だけ横切る） */}
      {bossAppearKey > 0 && isBossPhrase && (
        <div key={`boss-appear-${bossAppearKey}`} className="dev-crunch-banner dev-boss-appear">
          ⚔{bossSprite.name}が立ちはだかる！⚔
        </div>
      )}

      <div
        style={{
          flex: 1,
          minHeight: 0,
          minWidth: 0,
          display: 'grid',
          gridTemplateColumns: '240px minmax(0, 1fr) 300px',
          gap: 12,
          padding: 12,
        }}
      >
        {/* 左：フェーズ進行 ＋ チーム ＋ 開発全体の進捗 */}
        <aside
          style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0, minWidth: 0 }}
        >
          <PhaseProgressList phase={phase} />
          <TeamStatus
            employeeIds={current.assignedEmployeeIds}
            allEmployees={employees}
            currentCategory={isDevelopment ? currentTicket.category : null}
          />
          <div style={{ ...devBox(), gap: 6 }}>
            <span style={{ fontSize: 11, color: DEV.sub }}>
              {isPlanning ? '企画全体の進捗' : '開発全体の進捗'}
            </span>
            <span style={{ fontSize: 10, color: DEV.sub }}>
              {isPlanning ? '企画書完成度' : '全体完成度'}
            </span>
            <span
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: isPlanning ? PLAN.accent : DEV.greenBright,
                fontVariantNumeric: 'tabular-nums',
                lineHeight: 1,
              }}
            >
              {Math.floor(isPlanning ? planProgressPct : progressPct)}%
            </span>
            <SegGauge
              pct={isPlanning ? planProgressPct : progressPct}
              color={isPlanning ? PLAN.accent : DEV.greenBright}
              track="#0c1207"
              height={10}
            />
            <span style={{ fontSize: 10, color: DEV.sub, marginTop: 4 }}>
              開発期間：経過 {elapsedWeeks} / 予定 {plannedWeeks} 週
            </span>
            <SegGauge pct={budgetPct} color={periodColor} track="#0c1207" height={8} />
            <span style={{ fontSize: 10, fontWeight: 700, color: periodColor }}>{periodNote}</span>
          </div>

          {/* 開発ビルド限定：バグ検証用に発売フェーズへ即到達（タイピング律速＋リアルタイム
              固定費でAI検証が back-half に届かない問題への QA フック。docs/qa/bug-hunt.md） */}
          {import.meta.env.DEV && (
            <button
              type="button"
              onClick={() => finishDevelopment()}
              style={{
                marginTop: 'auto',
                padding: '6px 8px',
                border: '1px dashed #6a7686',
                background: '#141b26',
                color: '#c8d2e0',
                fontSize: 10,
                borderRadius: 2,
                cursor: 'pointer',
              }}
            >
              🛠 [DEV] 開発を即完了（発売へ）
            </button>
          )}
        </aside>

        {/* 中央：フェーズ別メインパネル */}
        <main style={{ minHeight: 0, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          {isDevelopment ? (
            <DevelopCenter
              phaseLabel={phaseMeta.label}
              litPhaseDots={litPhaseDots}
              progressPct={progressPct}
              ticket={currentTicket}
              ticketProgressPct={Math.min(
                100,
                ((ticketPhraseCount +
                  view.completed.length /
                    Math.max(1, view.completed.length + view.remained.length)) /
                  PHRASES_PER_TICKET) *
                  100,
              )}
              activeEvent={activeEvent}
              isRarePhrase={isRarePhrase}
              isBossPhrase={isBossPhrase}
              bossSprite={bossSprite}
              crunchActive={crunchActive}
              gear={gearFor(wpm)}
              perfectStreak={perfectStreak}
              view={view}
              failCount={failCount}
              charsPerMin={charsPerMin}
              bugCount={bugCount}
              accuracyPct={accuracyPct}
              programLog={programLog}
              liveCodeLine={liveCodeLine}
              designNotes={designNotes}
              graphicsFrame={graphicsFrame}
              ticketPhraseCount={ticketPhraseCount}
              soundBeatKey={soundBeatKey}
              genre={genre}
              lastResult={lastResult}
              feverActive={feverActive}
            />
          ) : isPlanning ? (
            <PlanningCenter
              litPhaseDots={planLitDots}
              progressPct={planProgressPct}
              ticket={currentPlanTicket}
              ticketProgressPct={Math.min(
                100,
                ((planPhraseCount +
                  view.completed.length /
                    Math.max(1, view.completed.length + view.remained.length)) /
                  PHRASES_PER_PLAN_TICKET) *
                  100,
              )}
              activeEvent={activeEvent}
              view={view}
              failCount={failCount}
              charsPerMin={charsPerMin}
              bugCount={bugCount}
              accuracyPct={accuracyPct}
              memos={planMemos}
              cards={planCards}
              team={employees}
              lastResult={lastResult}
            />
          ) : phase === 'debugging' ? (
            <DebugFlow key={phase} bugCount={bugCount} onFix={fixBug} onAllDone={advancePhase} />
          ) : (
            <MissionFlow
              key={phase}
              phase={phase}
              label={phaseMeta.label}
              bugCount={bugCount}
              onAllDone={advancePhase}
              applyDelta={applyAxisDelta}
            />
          )}
        </main>

        {/* 右：企画中は「現在の企画書」、開発中は「現在のプロジェクト＋開発内容」 */}
        <aside
          style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0, minWidth: 0 }}
        >
          {isPlanning ? (
            <PlanDocPanel
              title={current.title}
              genreEmoji={genre?.emoji ?? '🎮'}
              genreName={genre?.name ?? ''}
              themeName={theme?.name ?? ''}
              scaleName={scaleDef.name}
              decided={planDecided}
              currentTicket={currentPlanTicket}
              planDone={planIndex >= PLAN_CATEGORY_ORDER.length}
            />
          ) : (
            <>
              <div style={{ ...devBox(), gap: 4 }}>
                <span style={{ fontSize: 11, color: DEV.sub }}>現在のプロジェクト</span>
                <span style={{ fontSize: 17, fontWeight: 700, color: DEV.cream, lineHeight: 1.2 }}>
                  {genre?.emoji} {current.title}
                </span>
                <span style={{ fontSize: 11, color: DEV.sub }}>
                  ジャンル：{genre?.name} ／ テーマ：{theme?.name} ／ 規模：{scaleDef.name}
                </span>
              </div>

              <div style={{ ...devBox(), gap: 4, flex: 1, minHeight: 0, overflow: 'hidden' }}>
                <span style={{ fontSize: 11, color: DEV.green, fontWeight: 700 }}>
                  現在の開発内容
                </span>
                {completedTickets.length === 0 ? (
                  <span style={{ fontSize: 11, color: '#5a6e3a' }}>まだ着手した作業がない…</span>
                ) : (
                  completedTickets.map((t, i) => (
                    <span key={i} style={{ fontSize: 11, color: CATEGORY_META[t.category].color }}>
                      ✓ {t.title}
                    </span>
                  ))
                )}
                {isDevelopment && (
                  <span style={{ fontSize: 11, color: DEV.white, fontWeight: 700 }}>
                    ▶ {currentTicket.flavor.title}
                  </span>
                )}
                <span style={{ fontSize: 10, color: DEV.sub, marginTop: 6 }}>次の目標</span>
                <span style={{ fontSize: 12, color: DEV.cream, fontWeight: 700 }}>
                  {nextTicket.flavor.title}
                </span>
              </div>
            </>
          )}

          <TeamComments
            team={employees.filter((e) => current.assignedEmployeeIds.includes(e.id))}
            phase={phase}
            eventActive={!!activeEvent}
          />
        </aside>
      </div>

      {/* 下部：イベント情報 ＋ BGM */}
      <BottomBar phase={phase} />
    </div>
  );
};

/** 左カラム：フェーズ進行リスト（1〜6・🔒/▶/✓） */
const PhaseProgressList = ({ phase }: { phase: DevPhase }) => {
  const activeIdx = DEV_PHASE_ORDER.indexOf(phase);
  return (
    <div style={{ ...devBox(), gap: 6 }}>
      <span style={{ fontSize: 11, color: DEV.green, fontWeight: 700, letterSpacing: '0.06em' }}>
        フェーズ進行
      </span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {DEV_PHASE_ORDER.map((p, i) => {
          const state = i < activeIdx ? 'done' : i === activeIdx ? 'active' : 'locked';
          const mark = state === 'done' ? '✓' : state === 'active' ? '▶' : '🔒';
          const color = state === 'active' ? DEV.white : state === 'done' ? DEV.green : '#5a6e3a';
          return (
            <div
              key={p}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 8px',
                background: state === 'active' ? '#234012' : 'transparent',
                border: `1px solid ${state === 'active' ? DEV.green : 'transparent'}`,
              }}
            >
              <span style={{ fontSize: 11, color: DEV.sub, width: 12 }}>{i + 1}</span>
              <span
                style={{ fontSize: 13, fontWeight: state === 'active' ? 700 : 400, color, flex: 1 }}
              >
                {DEV_PHASE_META[p].label}
              </span>
              <span style={{ fontSize: 12 }}>{mark}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/** 役職が今のチケットカテゴリに乗っているかで気分を変える（相性演出） */
const ROLE_EXCITED_BY: Record<string, TicketCategory[]> = {
  programmer: ['program'],
  designer: ['graphics', 'sound'],
  pr: ['design'],
};

/** 左カラム：チーム状態（割り当て社員＋スキルバー＋気分） */
const TeamStatus = ({
  employeeIds,
  allEmployees,
  currentCategory,
}: {
  employeeIds: string[];
  allEmployees: { id: string; name: string; role: string; power: number }[];
  currentCategory: TicketCategory | null;
}) => {
  const team = allEmployees.filter((e) => employeeIds.includes(e.id));
  const roleEmoji: Record<string, string> = { programmer: '🧑‍💻', designer: '🎨', pr: '📣' };
  const roleColor: Record<string, string> = {
    programmer: CATEGORY_META.program.color,
    designer: CATEGORY_META.graphics.color,
    pr: CATEGORY_META.design.color,
  };
  return (
    <div
      style={{
        ...devBox(),
        gap: 6,
        // v0.20 A-2 修正：flex:1 で残りスペース全部を占有すると、社員が少ない時に
        // 下の「開発全体の進捗」ボックスを画面外まで押し出してしまう回帰があった
        // （オーナー実プレイで発見）。社員数に応じた実測に近い上限で頭打ちし、
        // それ以上は overflow:hidden でクリップする（MAX_EMPLOYEES=12 想定）
        flex: '0 1 auto',
        maxHeight: 210,
        minHeight: 0,
        overflow: 'hidden',
      }}
    >
      <span style={{ fontSize: 11, color: DEV.green, fontWeight: 700 }}>チーム状態</span>
      {team.length === 0 && (
        <span style={{ fontSize: 11, color: DEV.sub }}>社員なし（あなた一人で開発中）</span>
      )}
      {team.map((e) => {
        const excited = currentCategory && ROLE_EXCITED_BY[e.role]?.includes(currentCategory);
        return (
          <div key={e.id} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16 }}>{roleEmoji[e.role] ?? '🧑‍💻'}</span>
              <span style={{ fontSize: 12, color: DEV.cream }}>{e.name}</span>
              <span style={{ marginLeft: 'auto', fontSize: 12 }}>{excited ? '😄' : '🙂'}</span>
            </div>
            <SegGauge
              pct={Math.min(100, (e.power / 1.5) * 100)}
              color={roleColor[e.role] ?? DEV.green}
              track="#0c1207"
              height={5}
            />
          </div>
        );
      })}
    </div>
  );
};

/**
 * v0.20 A-2：「入力する文章」（かな表示）に打鍵アクションを付ける（オーナーFB 2026-07-12）。
 * かな進捗は nano-type-jp@0.7 が公開する resolvedUnitCount（何個目の入力単位＝モーラまで
 * 確定したか）をそのまま使う。近似（文字数比→固定長テーブル→ライブ比率）を3回試して
 * すべて実プレイで破綻したため、ライブラリ側にAPIを追加してもらい正確な値を取得する形にした
 * （経緯は core/kanaProgress.ts 参照）。
 * - 消化済みモーラ：ポップして沈む（打つそばから文章が片付いていく手応え）
 * - いま打っているモーラ：バウンス＋発光
 * - 正打のたび：現在モーラの位置でピクセルスパーク（completedLen の変化で再トリガー）
 */
const KanaActionLine = ({
  hiragana,
  completedLen,
  resolvedUnitCount,
  doneColor,
  currentColor,
}: {
  hiragana: string;
  completedLen: number;
  resolvedUnitCount: number;
  doneColor: string;
  currentColor: string;
}) => {
  const morae = useMemo(() => splitMorae(hiragana), [hiragana]);
  const doneMorae = Math.min(morae.length, resolvedUnitCount);
  return (
    <>
      {morae.map((m, i) => {
        if (i < doneMorae) {
          return (
            <span key={i} className="dev-kana-done" style={{ color: doneColor }}>
              {m}
            </span>
          );
        }
        if (i === doneMorae) {
          return (
            <span key={i} className="dev-kana-current" style={{ color: currentColor }}>
              {m}
              <span key={`spark-${completedLen}`} className="dev-kana-spark" />
            </span>
          );
        }
        return <span key={i}>{m}</span>;
      })}
    </>
  );
};

/** 中央：開発フェーズ本体 */
const DevelopCenter = ({
  phaseLabel,
  litPhaseDots,
  progressPct,
  ticket,
  ticketProgressPct,
  activeEvent,
  isRarePhrase,
  isBossPhrase,
  bossSprite,
  crunchActive,
  gear,
  perfectStreak,
  view,
  failCount,
  charsPerMin,
  bugCount,
  accuracyPct,
  programLog,
  liveCodeLine,
  designNotes,
  graphicsFrame,
  ticketPhraseCount,
  soundBeatKey,
  genre,
  lastResult,
  feverActive,
}: {
  phaseLabel: string;
  litPhaseDots: number;
  /** v0.20 D：開発全体の完成度%（左サイドバーと同じ値。ヘッダーに主役として表示する） */
  progressPct: number;
  ticket: ReturnType<typeof getTicketAt>;
  ticketProgressPct: number;
  activeEvent: DevEvent | null;
  /** v0.20 B：次に打つ文章が「レア」かどうか（開発フェーズのみ） */
  isRarePhrase: boolean;
  /** v0.20 C：次に打つ文章が「ボス」かどうか（クランチタイム中のみ） */
  isBossPhrase: boolean;
  /** v0.20 G：出現中のボスの挿絵（表示専用） */
  bossSprite: { name: string; url: string };
  /** v0.20 C：クランチタイム中かどうか */
  crunchActive: boolean;
  /** v0.20 E：現在の入力速度から求めたギア（feverGain 1 なら未到達） */
  gear: Gear;
  /** v0.20 E：ノーミスで連続完走した文数 */
  perfectStreak: number;
  view: TypingView;
  failCount: number;
  charsPerMin: number;
  bugCount: number;
  accuracyPct: number;
  programLog: string[];
  liveCodeLine: string;
  designNotes: string[];
  graphicsFrame: number;
  ticketPhraseCount: number;
  soundBeatKey: number;
  genre: { id: GenreId; emoji: string; bgColor: string } | undefined;
  lastResult: LastResult | null;
  feverActive: boolean;
}) => {
  const catMeta = CATEGORY_META[ticket.category];
  const inputColor = activeEvent ? '#ff8a3c' : catMeta.color;
  // v0.20 G：ボス戦中かどうか（イベント優先。イベント中はボス演出を出さない）
  const isBossBattle = isBossPhrase && !activeEvent;
  const bossHpPct = isBossBattle
    ? Math.max(0, 100 - (view.resolvedUnitCount / Math.max(1, view.totalUnitCount)) * 100)
    : 0;
  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        background: DEV.panelBg,
        border: `2px solid ${DEV.panelBorder}`,
        boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
        imageRendering: 'pixelated',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* ヘッダー：フェーズ名 ＋ PHASE ドット（＋発動中はフィーバーバッジ） */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '8px 12px',
          borderBottom: `2px solid ${DEV.panelBorder}`,
        }}
      >
        <span style={{ color: DEV.green, fontWeight: 700, fontSize: 16, letterSpacing: '0.06em' }}>
          {'</> '}
          {phaseLabel}フェーズ
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {feverActive && (
            <span
              className="dev-fever-text"
              style={{ fontSize: 12, fontWeight: 700, color: '#ff5a3c' }}
            >
              🔥FEVER 進捗×2
            </span>
          )}
          {crunchActive && (
            <span style={{ fontSize: 12, fontWeight: 700, color: '#ffb84d' }}>
              ⏰ラストスパート 進捗×{JUICE_CONFIG.crunch.progressMult}
            </span>
          )}
          {/* v0.20 F：ギアバッジ。オーナーFB「feverが溜まりやすくなったことが分かる仕組みが欲しい
              （ゲージ以外で）」を受け、「たまりやすい」と直接言葉にする（wpmがgears閾値未満なら非表示） */}
          {gear.feverGain > 1 && (
            <span style={{ fontSize: 12, fontWeight: 700, color: '#4de1ff' }}>
              🔥たまりやすい ×{gear.feverGain}
            </span>
          )}
          {/* v0.20 E：ノーミスストリーク（1文だけでは目立たせず、2文目以降で表示） */}
          {perfectStreak >= 2 && (
            <span style={{ fontSize: 12, fontWeight: 700, color: '#8fd02a' }}>
              🎯ノーミス継続 {perfectStreak}文
            </span>
          )}
          {/* v0.20 D：「PHASE X/6」表記は左サイドバーの6段階フェーズ進行リスト（企画→開発→…→完了）
              と同じ「6」を使っていて紛らわしく、実際は現フェーズ内の完成度を6分割しただけの別物
              だった（オーナーFB「完成までの進捗があることを理解してなかった」の一因と判断）。
              パーセンテージを主役に出し、ドットは補助の目盛りとして残す。 */}
          <span style={{ fontSize: 11, color: DEV.sub, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: DEV.greenBright,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              開発 {Math.floor(progressPct)}%
            </span>
            <span style={{ display: 'inline-flex', gap: 3, verticalAlign: 'middle' }}>
              {Array.from({ length: 6 }, (_, i) => (
                <span
                  key={i}
                  style={{
                    width: 7,
                    height: 7,
                    display: 'inline-block',
                    borderRadius: 0,
                    background: i < litPhaseDots ? DEV.green : '#1e2a14',
                    border: '1px solid #05080c',
                  }}
                />
              ))}
            </span>
          </span>
        </div>
      </div>

      <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 }}>
        {/* ①作業チケット／イベント／ボス戦（今なにを作っているか）。内容の長短で下の入力欄が動かないよう高さ固定 */}
        <div
          className={activeEvent ? 'dev-event-active' : undefined}
          style={{
            ...devBox(),
            gap: 4,
            borderColor: isBossBattle ? '#ff3c3c' : activeEvent ? '#ff8a3c' : DEV.panelBorder,
            flexDirection: 'row',
            alignItems: 'flex-start',
            height: TICKET_CARD_HEIGHT,
            overflow: 'hidden',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 10, color: DEV.sub }}>
              {isBossBattle ? '⚔ ボス戦' : activeEvent ? '⚠ イベント発生' : '作業チケット'}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <span
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: isBossBattle ? '#ff9d4d' : DEV.cream,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {isBossBattle ? bossSprite.name : activeEvent ? activeEvent.name : ticket.flavor.title}
              </span>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '2px 8px',
                  color: inputColor,
                  border: `1px solid ${inputColor}`,
                  background: activeEvent ? '#3a2205' : catMeta.dim,
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                {isBossBattle
                  ? '⚔ 渾身の一撃'
                  : activeEvent
                    ? '⚡ イベント作業'
                    : `${catMeta.icon} ${catMeta.label}作業`}
              </span>
            </div>
            <span
              style={{
                fontSize: 11,
                color: DEV.sub,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {isBossBattle
                ? '長文を打ち切って撃破しろ！'
                : activeEvent
                  ? activeEvent.flavor
                  : ticket.flavor.desc}
            </span>
          </div>
          {/* v0.20 G：ボス戦の挿絵・HPバーは下の「実装中の様子」パネルに表示する（ここはテキストのみ） */}
          {!activeEvent && !isBossBattle && (
            <div
              style={{
                width: 84,
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                alignItems: 'flex-end',
              }}
            >
              <span style={{ fontSize: 10, color: DEV.sub, whiteSpace: 'nowrap' }}>
                チケット進捗
              </span>
              <span
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  color: catMeta.color,
                  fontVariantNumeric: 'tabular-nums',
                  lineHeight: 1,
                }}
              >
                {Math.floor(ticketProgressPct)}%
              </span>
            </div>
          )}
        </div>
        {/* ゲージ枠も常設（イベント中に消えると下が動くため） */}
        <div style={{ height: 6 }}>
          {!activeEvent && !isBossBattle && (
            <SegGauge pct={ticketProgressPct} color={catMeta.color} track="#0c1207" height={6} />
          )}
        </div>

        {/* ②入力する文章（なにを入力すればいいか）＋ 入力進度/正確さ */}
        {/* v0.20 A-2：文完了（ticket 結果）ごとに key 再マウントで PERFECT シェイクと +進捗 フライアウトを再トリガー */}
        <div
          key={`inrow-${lastResult?.kind === 'ticket' ? lastResult.ts : 0}`}
          className={
            lastResult?.kind === 'ticket' && (lastResult.rank === 'PERFECT' || lastResult.boss)
              ? 'dev-perfect-shake'
              : undefined
          }
          style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
        >
          <div style={{ position: 'relative' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 11,
                color: DEV.green,
                fontWeight: 700,
                marginBottom: 4,
              }}
            >
              入力する文章
              {/* v0.20 B：レア文章バッジ（打ち始める前から見えるので、打っている間ずっと期待感が続く） */}
              {!activeEvent && isRarePhrase && <span className="dev-rare-badge">★レア</span>}
              {/* v0.20 C：ボス文章バッジ */}
              {!activeEvent && isBossPhrase && <span className="dev-boss-badge">⚔BOSS</span>}
            </div>
            <div
              style={{
                background: '#0c1207',
                border: `2px solid ${inputColor}`,
                padding: '10px 12px',
                fontSize: 26,
                color: inputColor,
                letterSpacing: '0.04em',
                minHeight: 38,
                overflowWrap: 'anywhere',
                wordBreak: 'break-word',
              }}
            >
              <KanaActionLine
                hiragana={view.hiragana}
                completedLen={view.completed.length}
                resolvedUnitCount={view.resolvedUnitCount}
                doneColor="#57703a"
                currentColor={DEV.white}
              />
            </div>
            {lastResult?.kind === 'ticket' && (
              <span key={`fly-${lastResult.ts}`} className="dev-progress-fly">
                +{lastResult.progress}
              </span>
            )}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 11, color: DEV.green, fontWeight: 700, marginBottom: 4 }}>
            ローマ字入力
          </div>
          <div
            key={`miss-${failCount}`}
            className={failCount > 0 ? 'dev-miss-shake' : undefined}
            style={{
              background: '#0c1207',
              border: `1px solid ${DEV.panelBorder}`,
              padding: '7px 12px',
              fontSize: 18,
              letterSpacing: '0.08em',
              minHeight: 26,
              overflowWrap: 'anywhere',
              wordBreak: 'break-word',
            }}
          >
            <span style={{ color: DEV.green }}>{view.completed}</span>
            <span className="dev-cursor" style={{ color: DEV.white }}>
              |
            </span>
            {view.remained.length > 0 && (
              <span className="dev-next-key">{view.remained.slice(0, 1)}</span>
            )}
            <span style={{ color: '#5a6e3a' }}>{view.remained.slice(1)}</span>
          </div>
          {/* ローマ字入力の「下」に、入力速度・正確さ・バグを横並びで置く */}
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            <div style={{ ...devBox(), flex: 1, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 5, padding: '5px 6px' }}>
              <span style={{ fontSize: 9, color: DEV.sub, whiteSpace: 'nowrap' }}>⏩入力速度</span>
              <span
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: DEV.cream,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {charsPerMin}
              </span>
              <span style={{ fontSize: 8, color: DEV.sub }}>文字/分</span>
            </div>
            <div style={{ ...devBox(), flex: 1, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 5, padding: '5px 6px' }}>
              <span style={{ fontSize: 9, color: DEV.sub, whiteSpace: 'nowrap' }}>🎯正確さ</span>
              <span
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: DEV.cream,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {accuracyPct}%
              </span>
            </div>
            <div
              key={`bug-${bugCount}`}
              style={{ ...devBox(), flex: 1, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 5, padding: '5px 6px' }}
            >
              <span style={{ fontSize: 9, color: DEV.sub, whiteSpace: 'nowrap' }}>🐛バグ</span>
              <span
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: bugCount > 0 ? DEV.orange : DEV.greenBright,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                ×{bugCount}
              </span>
              <span style={{ fontSize: 8, color: DEV.sub, whiteSpace: 'nowrap' }}>デバッグで返済</span>
            </div>
          </div>
        </div>

        {/* 実装中の様子（カテゴリで見た目が変わる） */}
        <WorkInProgressPanel
          category={ticket.category}
          programLog={programLog}
          liveCodeLine={liveCodeLine}
          designNotes={designNotes}
          graphicsFrame={graphicsFrame}
          ticketPhraseCount={ticketPhraseCount}
          soundBeatKey={soundBeatKey}
          genre={genre}
          ticketTitle={ticket.flavor.title}
          isBossBattle={isBossBattle}
          bossSprite={bossSprite}
          bossHpPct={bossHpPct}
          bossHitKey={view.completed.length}
        />

        {/* ③今回の結果（入力した結果どう変わったか） */}
        <ResultCard result={lastResult} />
      </div>
    </div>
  );
};

/** 実装中の様子：カテゴリごとに完全に違う見た目に切り替える */
const WorkInProgressPanel = (props: {
  category: TicketCategory;
  programLog: string[];
  liveCodeLine: string;
  designNotes: string[];
  graphicsFrame: number;
  ticketPhraseCount: number;
  soundBeatKey: number;
  genre: { id: GenreId; emoji: string; bgColor: string } | undefined;
  ticketTitle: string;
  /** v0.20 G：ボス戦中は担当カテゴリに関わらずこのパネルを表示する */
  isBossBattle: boolean;
  bossSprite: { name: string; url: string };
  bossHpPct: number;
  bossHitKey: number;
}) => {
  const { category } = props;
  if (props.isBossBattle)
    return (
      <BossBattlePanel sprite={props.bossSprite} hpPct={props.bossHpPct} hitKey={props.bossHitKey} />
    );
  if (category === 'program')
    return <ProgramLogPanel lines={props.programLog} liveLine={props.liveCodeLine} />;
  if (category === 'graphics')
    return (
      <GraphicsCanvasPanel
        frame={props.graphicsFrame}
        stage={props.ticketPhraseCount}
        genre={props.genre}
      />
    );
  if (category === 'sound')
    return <SoundMeterPanel beatKey={props.soundBeatKey} title={props.ticketTitle} />;
  return <DesignMemoPanel notes={props.designNotes} />;
};

export const WIP_HEIGHT = 110;

/**
 * ジャンル代表スプライトの表示サイズ。素材は 64×64（v0.15 の既存12種）と 128×128（v0.21 の新規15種）が
 * 混在するため、64 にすると両方が整数倍（等倍／1/2）になり imageRendering:pixelated でドットが崩れない。
 * 40px 時代は 0.625倍／0.3125倍の非整数倍で絵が潰れていた（オーナー指摘 2026-07-16）。
 */
const GENRE_SPRITE_PX = 64;

/**
 * v0.20 G：ボス戦パネル（オーナー指示：「実装中の様子」欄をボス戦の表示に差し替え、
 * 打つたびに斬撃が入ってHPが削れるイメージ）。担当カテゴリに関わらずこの見た目で統一する。
 */
const BossBattlePanel = ({
  sprite,
  hpPct,
  hitKey,
}: {
  sprite: { name: string; url: string };
  hpPct: number;
  hitKey: number;
}) => (
  <div style={{ ...devBox(), gap: 4 }}>
    <span style={{ fontSize: 11, color: '#ff5a3c', fontWeight: 700 }}>⚔ ボス戦：{sprite.name}</span>
    <div
      style={{
        background: `linear-gradient(rgba(4, 6, 10, 0.45), rgba(4, 6, 10, 0.45)), url(/sprites/boss/battle-bg.png)`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        imageRendering: 'pixelated',
        border: '1px solid #ff3c3c',
        padding: '5px 8px',
        height: WIP_HEIGHT,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div style={{ position: 'relative', width: GENRE_SPRITE_PX, height: GENRE_SPRITE_PX }}>
        <img
          // v0.20 G：正打のたびに再マウントしてヒットシェイクを再トリガー（.dev-kana-spark と同じ手法）
          key={`boss-battle-sprite-${hitKey}`}
          src={sprite.url}
          alt={sprite.name}
          className="dev-boss-sprite"
          style={{ width: GENRE_SPRITE_PX, height: GENRE_SPRITE_PX, imageRendering: 'pixelated' }}
        />
        {hitKey > 0 && <div key={`boss-slash-${hitKey}`} className="dev-boss-slash" />}
      </div>
      <div style={{ width: '70%' }}>
        <SegGauge pct={hpPct} color="#ff3c3c" track="#2a0d0d" height={6} />
      </div>
    </div>
  </div>
);

/** 疑似シンタックスハイライト：IDE風に予約語/関数名/クラス名/文字列/数値/記号を色分け */
const CODE_KEYWORDS = new Set([
  'function',
  'const',
  'let',
  'var',
  'return',
  'async',
  'await',
  'class',
  'extends',
  'interface',
  'private',
  'public',
  'for',
  'of',
  'new',
  'export',
  'if',
  'else',
  'void',
]);

const CODE_COLORS: Record<string, string> = {
  keyword: '#4db3ff',
  func: '#ffd166',
  class: '#d8a5ff',
  string: '#ffa657',
  number: '#b5cea8',
  punct: '#5a7a45',
  default: '#6fe07a',
};

const tokenizeCode = (code: string): { text: string; kind: string }[] => {
  const raw = code.match(/[A-Za-z_$][\w$]*|'[^']*'|"[^"]*"|\d+|[{}()[\];,.:<>=]|\s+|./g) ?? [];
  return raw.map((t, i) => {
    if (/^\s+$/.test(t)) return { text: t, kind: 'default' };
    if (/^['"]/.test(t)) return { text: t, kind: 'string' };
    if (/^\d+$/.test(t)) return { text: t, kind: 'number' };
    if (/^[{}()[\];,.:<>=]$/.test(t)) return { text: t, kind: 'punct' };
    if (/^[A-Za-z_$][\w$]*$/.test(t)) {
      if (CODE_KEYWORDS.has(t)) return { text: t, kind: 'keyword' };
      let j = i + 1;
      while (j < raw.length && /^\s+$/.test(raw[j])) j++;
      if (raw[j] === '(') return { text: t, kind: 'func' };
      if (/^[A-Z]/.test(t)) return { text: t, kind: 'class' };
      return { text: t, kind: 'default' };
    }
    return { text: t, kind: 'default' };
  });
};

const CodeText = ({ code }: { code: string }) => (
  <>
    {tokenizeCode(code).map((tok, i) => (
      <span key={i} style={{ color: CODE_COLORS[tok.kind] }}>
        {tok.text}
      </span>
    ))}
  </>
);

/**
 * 実装ログの中身。短いうちは左上から詰まり、伸びて枠に収まらなくなったら
 * 常にカーソル（打っている位置）が見えるよう自動で下へ追従する（プレイヤー操作のスクロールは無し）。
 */
const ProgramLogPanel = ({ lines, liveLine }: { lines: string[]; liveLine: string }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [liveLine, lines]);

  return (
    <div style={{ ...devBox(), gap: 4 }}>
      <span style={{ fontSize: 11, color: CATEGORY_META.program.color, fontWeight: 700 }}>
        {'</> '}プログラム
      </span>
      <div
        ref={scrollRef}
        className="dev-code-scroll"
        style={{
          background: '#04060a',
          border: `1px solid ${DEV.panelBorder}`,
          padding: '5px 8px',
          height: WIP_HEIGHT,
          overflowY: 'auto',
          overflowX: 'hidden',
          fontSize: 11,
          lineHeight: '14px',
          whiteSpace: 'pre-wrap',
          overflowWrap: 'anywhere',
          tabSize: 2,
        }}
      >
        {lines.length === 0 && !liveLine ? (
          <span style={{ color: '#3f5226' }}>実装はまだ始まっていない…</span>
        ) : (
          lines.slice(-1).map((l, i) => (
            <span key={i}>
              <CodeText code={l} />
              {'\n'}
            </span>
          ))
        )}
        {liveLine && (
          <span className="dev-code-line">
            <CodeText code={liveLine} />
            <span className="dev-cursor" style={{ color: '#6fe07a' }}>
              ▌
            </span>
          </span>
        )}
      </div>
    </div>
  );
};

const GRAPHICS_FRAME_TOTAL = 4;

export const GraphicsCanvasPanel = ({
  frame,
  stage,
  genre,
}: {
  frame: number;
  /** このチケット内の進み具合（0=アイコンのみ／1=背景も／2=キラキラも） */
  stage: number;
  genre: { id: GenreId; emoji: string; bgColor: string } | undefined;
}) => {
  const litFrames = frame === 0 ? 0 : ((frame - 1) % GRAPHICS_FRAME_TOTAL) + 1;
  const showBackground = stage >= 1;
  const showSparkles = stage >= 2;
  const sparkleSpots = [
    { top: '12%', left: '14%', delay: '0ms' },
    { top: '20%', left: '80%', delay: '300ms' },
    { top: '66%', left: '10%', delay: '600ms' },
    { top: '70%', left: '82%', delay: '150ms' },
  ];
  return (
    <div style={{ ...devBox(), gap: 4 }}>
      <span style={{ fontSize: 11, color: CATEGORY_META.graphics.color, fontWeight: 700 }}>
        🎨 デザイン画面
      </span>
      <div
        style={{
          position: 'relative',
          background: genre?.bgColor ?? '#12180a',
          border: `1px solid ${DEV.panelBorder}`,
          height: WIP_HEIGHT - 18,
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* ①背景（チケット内1問目を打ち終えると登場） */}
        {genre && showBackground && (
          <img
            key="bg"
            className="dev-stat-pop"
            src={genreBackgroundUrl(genre.id)}
            alt=""
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'center',
              imageRendering: 'pixelated',
            }}
          />
        )}
        {/* 背景素材の左右端が塗り切れていない場合に備え、パネル色へなめらかに馴染ませる */}
        {genre && showBackground && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: `linear-gradient(to right, ${genre.bgColor} 0%, transparent 18%, transparent 82%, ${genre.bgColor} 100%)`,
            }}
          />
        )}
        {/* ②装飾のキラキラ（チケット内2問目を打ち終えると登場） */}
        {showSparkles &&
          sparkleSpots.slice(0, litFrames).map((pos, i) => (
            <img
              key={`${frame}-${i}`}
              src="/sprites/effects/sparkle.png"
              alt=""
              className="dev-sparkle-twinkle"
              style={{
                position: 'absolute',
                width: 12,
                height: 12,
                imageRendering: 'pixelated',
                top: pos.top,
                left: pos.left,
                animationDelay: pos.delay,
              }}
            />
          ))}
        {genre ? (
          <span className="dev-sprite-idle" style={{ position: 'relative' }}>
            <img
              key={frame}
              className="dev-stat-pop"
              src={genreSpriteUrl(genre.id)}
              alt={genre.emoji}
              style={{
                width: GENRE_SPRITE_PX,
                height: GENRE_SPRITE_PX,
                imageRendering: 'pixelated',
                filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.5))',
              }}
            />
          </span>
        ) : (
          <span key={frame} className="dev-stat-pop" style={{ fontSize: 30, position: 'relative' }}>
            🎮
          </span>
        )}
      </div>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <span style={{ fontSize: 9, color: DEV.sub }}>フレーム</span>
        {Array.from({ length: GRAPHICS_FRAME_TOTAL }, (_, i) => (
          <span
            key={i}
            style={{
              width: 7,
              height: 7,
              display: 'inline-block',
              background: i < litFrames ? CATEGORY_META.graphics.color : '#1c2410',
              border: `1px solid ${DEV.panelBorder}`,
            }}
          />
        ))}
      </div>
    </div>
  );
};

const SoundMeterPanel = ({ beatKey, title }: { beatKey: number; title: string }) => (
  <div style={{ ...devBox(), gap: 4 }}>
    <span style={{ fontSize: 11, color: CATEGORY_META.sound.color, fontWeight: 700 }}>
      🎵 サウンド画面
    </span>
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: 2,
        height: WIP_HEIGHT - 24,
        background: '#04060a',
        border: `1px solid ${DEV.panelBorder}`,
        padding: '4px 6px',
      }}
    >
      {Array.from({ length: 48 }, (_, i) => (
        <span
          key={`${beatKey}-${i}`}
          className="dev-wave-bar"
          style={{
            flex: 1,
            background: CATEGORY_META.sound.color,
            animationDelay: `${i * 30}ms`,
            height: 6 + ((i * 37 + beatKey * 13) % 26),
          }}
        />
      ))}
    </div>
    <span style={{ fontSize: 10, color: DEV.sub, overflowWrap: 'anywhere' }}>♪ {title}</span>
  </div>
);

const DesignMemoPanel = ({ notes }: { notes: string[] }) => (
  <div style={{ ...devBox(), gap: 4 }}>
    <span style={{ fontSize: 11, color: CATEGORY_META.design.color, fontWeight: 700 }}>
      📋 企画メモ
    </span>
    <div
      style={{
        background: '#04060a',
        border: `1px solid ${DEV.panelBorder}`,
        padding: '5px 8px',
        height: WIP_HEIGHT,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        gap: 2,
      }}
    >
      {notes.length === 0 ? (
        <span style={{ fontSize: 11, color: '#3f5226' }}>まだメモはない…</span>
      ) : (
        notes.map((n, i) => (
          <span key={i} style={{ fontSize: 11, color: DEV.cream, overflowWrap: 'anywhere' }}>
            ・{n}
          </span>
        ))
      )}
    </div>
  </div>
);

const RANK_COLOR: Record<SpeedRank, string> = {
  PERFECT: '#ffd54a',
  GREAT: '#5fe08a',
  GOOD: '#7adfff',
};

/** ③今回の結果カード（ゲージの代わりの主役。入力するたびに更新される） */
const ResultCard = ({ result }: { result: LastResult | null }) => {
  if (!result) {
    return (
      <div
        style={{
          ...devBox(),
          gap: 4,
          minHeight: 58,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span style={{ fontSize: 11, color: '#3f5226' }}>まだ入力していない…</span>
      </div>
    );
  }
  if (result.kind === 'event') {
    const color = '#5fe08a';
    return (
      <div
        key={result.ts}
        className="dev-result-pop"
        style={{ ...devBox(), gap: 4, borderColor: color }}
      >
        <span style={{ fontSize: 13, fontWeight: 700, color }}>
          {EVENT_CATEGORY_META[result.event.category].icon} {result.event.name} 解決！
        </span>
        <span style={{ fontSize: 11, color: DEV.cream }}>
          {formatAxisDelta(result.event.success)}
        </span>
      </div>
    );
  }
  if (result.kind === 'plan') {
    return (
      <div key={result.ts} className="dev-result-pop" style={{ ...devBox(), gap: 6 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: RANK_COLOR[result.rank] }}>
          {result.rank}!
        </span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          <ResultChip icon="💡" label="面白さ" value={`+${result.funGain}`} color="#ffd166" />
          <ResultChip icon="⭐" label="期待度" value={`+${result.hypeGain}`} color="#7adfff" />
          <ResultChip icon="🔥" label="コンボ倍率" value={`×${result.comboMult}`} color="#ff9d4d" />
          <ResultChip icon="⚡" label="速度倍率" value={`×${result.speedMult}`} color="#d8a5ff" />
        </div>
      </div>
    );
  }
  return (
    <div key={result.ts} className="dev-result-pop" style={{ ...devBox(), gap: 6 }}>
      <span style={{ fontSize: 14, fontWeight: 700, color: RANK_COLOR[result.rank] }}>
        {result.rank}!
      </span>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        <ResultChip
          icon="⚡"
          label="開発速度"
          value={`${result.speedPct >= 0 ? '+' : ''}${result.speedPct}%`}
          color="#4db3ff"
        />
        <ResultChip icon="💎" label="品質" value={`+${result.qualityDelta}`} color="#ffd54a" />
        <ResultChip
          icon="🐛"
          label="バグリスク"
          value={`${result.bugPct}%`}
          color={result.bugPct <= 0 ? '#5fe08a' : '#ff6b6b'}
        />
        <ResultChip icon="🏗" label="進捗" value={`+${result.progress}`} color="#d8a5ff" />
      </div>
    </div>
  );
};

const ResultChip = ({
  icon,
  label,
  value,
  color,
}: {
  icon: string;
  label: string;
  value: string;
  color: string;
}) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
    <span style={{ fontSize: 9, color: DEV.sub, whiteSpace: 'nowrap' }}>
      {icon} {label}
    </span>
    <span style={{ fontSize: 15, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>
      {value}
    </span>
  </div>
);

/** 企画フェーズの明るめアクセント（会議・紙・付箋の世界観） */
const PLAN = {
  accent: '#ffd166',
  paper: '#f4ecd9',
  paperLine: '#d8c8a0',
  ink: '#202840',
  inkSub: '#706048',
  cork: '#4a3520',
} as const;

/** 中央：企画フェーズ本体（v0.15.3 企画チケット UI） */
const PlanningCenter = ({
  litPhaseDots,
  progressPct,
  ticket,
  ticketProgressPct,
  activeEvent,
  view,
  failCount,
  charsPerMin,
  bugCount,
  accuracyPct,
  memos,
  cards,
  team,
  lastResult,
}: {
  litPhaseDots: number;
  /** v0.20 D：企画書完成度%（左サイドバーと同じ値。ヘッダーに主役として表示する） */
  progressPct: number;
  ticket: ReturnType<typeof getPlanTicketAt>;
  ticketProgressPct: number;
  activeEvent: DevEvent | null;
  view: TypingView;
  failCount: number;
  charsPerMin: number;
  bugCount: number;
  accuracyPct: number;
  memos: string[];
  cards: string[];
  team: { id: string; role: EmployeeRole }[];
  lastResult: LastResult | null;
}) => {
  const catMeta = PLAN_CATEGORY_META[ticket.category];
  const accent = activeEvent ? '#ff8a3c' : catMeta.color;
  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        background: DEV.panelBg,
        border: `2px solid ${DEV.panelBorder}`,
        boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
        imageRendering: 'pixelated',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* ヘッダー：企画フェーズ ＋ PHASE ドット */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '8px 12px',
          borderBottom: `2px solid ${DEV.panelBorder}`,
        }}
      >
        <span
          style={{ color: PLAN.accent, fontWeight: 700, fontSize: 16, letterSpacing: '0.06em' }}
        >
          💡 企画フェーズ
        </span>
        {/* v0.20 D：「PHASE X/6」表記は左サイドバーの6段階フェーズ進行リストと紛らわしいため撤去し、
            パーセンテージを主役に出す（DevelopCenter と同じ方針） */}
        <span style={{ fontSize: 11, color: DEV.sub, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: PLAN.accent,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            企画書 {Math.floor(progressPct)}%
          </span>
          <span style={{ display: 'inline-flex', gap: 3, verticalAlign: 'middle' }}>
            {Array.from({ length: 6 }, (_, i) => (
              <span
                key={i}
                style={{
                  width: 7,
                  height: 7,
                  display: 'inline-block',
                  background: i < litPhaseDots ? PLAN.accent : '#2a2414',
                  border: '1px solid #05080c',
                }}
              />
            ))}
          </span>
        </span>
      </div>

      <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 }}>
        {/* ①企画チケット／イベント（今なにを決めようとしているか）。高さ固定で下の入力欄を動かさない */}
        <div
          className={activeEvent ? 'dev-event-active' : undefined}
          style={{
            ...devBox(),
            gap: 4,
            borderColor: activeEvent ? '#ff8a3c' : DEV.panelBorder,
            flexDirection: 'row',
            alignItems: 'flex-start',
            height: TICKET_CARD_HEIGHT,
            overflow: 'hidden',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 10, color: DEV.sub }}>
              {activeEvent ? '⚠ イベント発生' : '企画チケット'}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <span
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: DEV.cream,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {activeEvent ? activeEvent.name : ticket.flavor.title}
              </span>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '2px 8px',
                  color: accent,
                  border: `1px solid ${accent}`,
                  background: activeEvent ? '#3a2205' : catMeta.dim,
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                {activeEvent ? '⚡ イベント対応' : `${catMeta.icon} ${catMeta.label}`}
              </span>
            </div>
            <span
              style={{
                fontSize: 11,
                color: DEV.sub,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {activeEvent ? activeEvent.flavor : ticket.flavor.desc}
            </span>
          </div>
          {!activeEvent && (
            <div
              style={{
                width: 84,
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                alignItems: 'flex-end',
              }}
            >
              <span style={{ fontSize: 10, color: DEV.sub, whiteSpace: 'nowrap' }}>
                チケット進捗
              </span>
              <span
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  color: catMeta.color,
                  fontVariantNumeric: 'tabular-nums',
                  lineHeight: 1,
                }}
              >
                {Math.floor(ticketProgressPct)}%
              </span>
            </div>
          )}
        </div>
        <div style={{ height: 6 }}>
          {!activeEvent && (
            <SegGauge pct={ticketProgressPct} color={catMeta.color} track="#0c1207" height={6} />
          )}
        </div>

        {/* ②入力する文章（企画は紙っぽい明るい入力枠で会議感を出す） */}
        {/* v0.20 A-2：文完了ごとに PERFECT シェイクと +💡⭐ フライアウト（開発側と同じ骨格） */}
        <div
          key={`inrow-${lastResult?.kind === 'plan' ? lastResult.ts : 0}`}
          className={
            lastResult?.kind === 'plan' && lastResult.rank === 'PERFECT'
              ? 'dev-perfect-shake'
              : undefined
          }
          style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
        >
          <div style={{ position: 'relative' }}>
            <div style={{ fontSize: 11, color: PLAN.accent, fontWeight: 700, marginBottom: 4 }}>
              入力する文章
            </div>
            <div
              style={{
                background: PLAN.paper,
                border: `2px solid ${accent}`,
                padding: '10px 12px',
                fontSize: 26,
                color: PLAN.ink,
                letterSpacing: '0.04em',
                minHeight: 38,
                overflowWrap: 'anywhere',
                wordBreak: 'break-word',
              }}
            >
              <KanaActionLine
                hiragana={view.hiragana}
                completedLen={view.completed.length}
                resolvedUnitCount={view.resolvedUnitCount}
                doneColor="#b3a37e"
                currentColor={accent}
              />
            </div>
            {lastResult?.kind === 'plan' && (
              <span key={`fly-${lastResult.ts}`} className="dev-progress-fly dev-progress-fly-plan">
                +💡{lastResult.funGain} ⭐{lastResult.hypeGain}
              </span>
            )}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 11, color: PLAN.accent, fontWeight: 700, marginBottom: 4 }}>
            ローマ字入力
          </div>
          <div
            key={`miss-${failCount}`}
            className={failCount > 0 ? 'dev-miss-shake' : undefined}
            style={{
              background: '#0c1207',
              border: `1px solid ${DEV.panelBorder}`,
              padding: '7px 12px',
              fontSize: 18,
              letterSpacing: '0.08em',
              minHeight: 26,
              overflowWrap: 'anywhere',
              wordBreak: 'break-word',
            }}
          >
            <span style={{ color: PLAN.accent }}>{view.completed}</span>
            <span className="dev-cursor" style={{ color: DEV.white }}>
              |
            </span>
            {view.remained.length > 0 && (
              <span className="dev-next-key">{view.remained.slice(0, 1)}</span>
            )}
            <span style={{ color: '#5a6e3a' }}>{view.remained.slice(1)}</span>
          </div>
          {/* ローマ字入力の「下」に、入力速度・正確さ・バグを横並びで置く */}
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            <div style={{ ...devBox(), flex: 1, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 5, padding: '5px 6px' }}>
              <span style={{ fontSize: 9, color: DEV.sub, whiteSpace: 'nowrap' }}>⏩入力速度</span>
              <span
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: DEV.cream,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {charsPerMin}
              </span>
              <span style={{ fontSize: 8, color: DEV.sub }}>文字/分</span>
            </div>
            <div style={{ ...devBox(), flex: 1, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 5, padding: '5px 6px' }}>
              <span style={{ fontSize: 9, color: DEV.sub, whiteSpace: 'nowrap' }}>🎯正確さ</span>
              <span
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: DEV.cream,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {accuracyPct}%
              </span>
            </div>
            <div
              key={`bug-${bugCount}`}
              style={{ ...devBox(), flex: 1, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 5, padding: '5px 6px' }}
            >
              <span style={{ fontSize: 9, color: DEV.sub, whiteSpace: 'nowrap' }}>🐛バグ</span>
              <span
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: bugCount > 0 ? DEV.orange : DEV.greenBright,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                ×{bugCount}
              </span>
              <span style={{ fontSize: 8, color: DEV.sub, whiteSpace: 'nowrap' }}>デバッグで返済</span>
            </div>
          </div>
        </div>

        {/* 企画中の様子：ホワイトボードを社員が囲む会議シーン。付箋は板面に増える */}
        <PlanMeetingBoard employees={team} memos={memos} cards={cards} />

        {/* ③今回の結果（入力した結果、企画がどう良くなったか） */}
        <ResultCard result={lastResult} />
      </div>
    </div>
  );
};

/** 右ペイン：現在の企画書（企画フェーズ中）。決定事項が埋まっていく紙のドキュメント */
const PlanDocPanel = ({
  title,
  genreEmoji,
  genreName,
  themeName,
  scaleName,
  decided,
  currentTicket,
  planDone,
}: {
  title: string;
  genreEmoji: string;
  genreName: string;
  themeName: string;
  scaleName: string;
  decided: { category: PlanCategory; decided: string }[];
  currentTicket: ReturnType<typeof getPlanTicketAt>;
  planDone: boolean;
}) => {
  const decidedOf = (c: PlanCategory) => decided.find((d) => d.category === c)?.decided;
  const row = (label: string, value: string | undefined) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <span style={{ fontSize: 9, color: PLAN.inkSub }}>{label}</span>
      <span
        style={{
          fontSize: value ? 12 : 11,
          fontWeight: value ? 700 : 400,
          color: value ? PLAN.ink : PLAN.inkSub,
          overflowWrap: 'anywhere',
        }}
      >
        {value ?? '検討中…'}
      </span>
    </div>
  );
  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        overflow: 'hidden',
        background: PLAN.paper,
        border: `2px solid ${PLAN.paperLine}`,
        padding: 10,
        display: 'flex',
        flexDirection: 'column',
        gap: 7,
      }}
    >
      <span style={{ fontSize: 12, fontWeight: 700, color: PLAN.ink }}>📋 現在の企画書</span>
      {row('タイトル案', `${genreEmoji} ${title}`)}
      <span style={{ fontSize: 10, color: PLAN.inkSub }}>
        ジャンル：{genreName} ／ テーマ：{themeName} ／ 規模：{scaleName}
      </span>
      {row('ターゲット', decidedOf('target'))}
      {row('ゲームの核', decidedOf('concept'))}

      <div
        style={{
          borderTop: `1px dashed ${PLAN.paperLine}`,
          paddingTop: 6,
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
        }}
      >
        <span style={{ fontSize: 9, color: PLAN.inkSub }}>現在決まっている内容</span>
        {PLAN_CATEGORY_ORDER.map((c) => {
          const done = decided.some((d) => d.category === c);
          const meta = PLAN_CATEGORY_META[c];
          return (
            <span
              key={c}
              style={{
                fontSize: 11,
                fontWeight: done ? 700 : 400,
                color: done ? PLAN.ink : PLAN.inkSub,
              }}
            >
              {done ? '✓' : '□'} {meta.docLabel}
              {done && (
                <span style={{ fontWeight: 400, color: PLAN.inkSub }}>
                  ：{decided.find((d) => d.category === c)?.decided}
                </span>
              )}
            </span>
          );
        })}
      </div>

      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 1 }}>
        <span style={{ fontSize: 9, color: PLAN.inkSub }}>次に決めること</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: PLAN.ink }}>
          {planDone ? '🎉 企画完了！開発へ！' : currentTicket.flavor.title}
        </span>
      </div>
    </div>
  );
};

/**
 * フェーズ入場時に発生率で当たったイベントだけを積む（development 以外のフェーズ用）。
 */
const buildMissionQueue = (phase: DevPhase): DevEvent[] =>
  PHASE_EVENTS[phase].filter((ev) => Math.random() < ev.rate);

/**
 * 中央：開発以外のフェーズ。
 * イベントが発生していれば入力ミッションで対応、無ければ「✓ 完了」演出で自動進行。
 */
/**
 * v0.17 デバッグフェーズ：たまったバグを修正フレーズで返済する（spec v17 §4-3）。
 * バグが多いほど打つ量が線形に増える。全部潰すと「バグゼロ」ボーナス（noBugs +5）、
 * [このまま発売] で残バグ 1 匹につき 品質−2・炎上リスク+2 を背負って先へ進める。
 */
/** バグ列の表示上限（1280×720 内・折返し 2 行まで。超過分は +N 表記） */
const BUG_ROW_MAX = 30;

const DebugFlow = ({
  bugCount,
  onFix,
  onAllDone,
}: {
  bugCount: number;
  onFix: () => void;
  onAllDone: () => void;
}) => {
  const employees = useGameStore((s) => s.employees);
  const adDebugUsed = useGameStore((s) => s.current?.adDebugUsed ?? false);
  const adDebugAssist = useGameStore((s) => s.adDebugAssist);

  // マウント時（デバッグ突入時）の総バグ数。以降は減る一方なので「駆除 N/M」の分母になる
  const totalRef = useRef(bugCount);
  const total = totalRef.current;
  const killed = Math.max(0, total - bugCount);

  // バグ 1 匹 = PHRASES_PER_BUG 文。打ち切るごとに progress、満了で駆除
  const [phraseInBug, setPhraseInBug] = useState(0);
  const [phrase, setPhrase] = useState(() => pickBugFixPhrase());
  /** 修正ログ（直近3件） */
  const [fixLog, setFixLog] = useState<string[]>([]);
  /** 駆除演出：💥 を n 個、key で再トリガー。時間切れで消えて列が詰まる */
  const [squash, setSquash] = useState<{ n: number; key: number } | null>(null);
  const squashTimer = useRef<number | null>(null);
  const [adRunning, setAdRunning] = useState(false);

  const triggerSquash = (n: number) => {
    setSquash((s) => ({ n, key: (s?.key ?? 0) + 1 }));
    if (squashTimer.current !== null) window.clearTimeout(squashTimer.current);
    squashTimer.current = window.setTimeout(() => setSquash(null), 500);
  };
  useEffect(
    () => () => {
      if (squashTimer.current !== null) window.clearTimeout(squashTimer.current);
    },
    [],
  );

  useEffect(() => {
    if (bugCount > 0) return;
    sfx.phase();
    const t = window.setTimeout(onAllDone, 1200);
    return () => window.clearTimeout(t);
  }, [bugCount]);

  const suppressionPct = Math.round(bugSuppression(employees) * 100);

  const runDebugAssistAd = () => {
    if (adRunning || adDebugUsed || bugCount <= 0) return;
    setAdRunning(true);
    ads.showRewarded({
      label: 'debug-assist-ad',
      onComplete: () => {
        const before = useGameStore.getState().current?.bugCount ?? 0;
        if (adDebugAssist()) {
          const cleared = bugsClearedByAd(before);
          sfx.success();
          setFixLog((l) => [`✓ 広告応援 — ${cleared}匹まとめて駆除`, ...l].slice(0, 3));
          triggerSquash(Math.min(cleared, BUG_ROW_MAX));
          setPhraseInBug(0);
        }
        setAdRunning(false);
      },
      onFail: () => setAdRunning(false),
    });
  };

  if (bugCount <= 0) {
    return (
      <PhaseShell label="デバッグ">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
          <span style={{ fontSize: 26, fontWeight: 700, color: DEV.greenBright }}>
            ✓ バグゼロ！
          </span>
          <span style={{ fontSize: 13, color: DEV.cream }}>
            {total > 0
              ? `${total} 匹すべて駆除した。品質ボーナスを獲得（バグゼロ +5）`
              : 'もともとバグが無かった。品質ボーナスを獲得（バグゼロ +5）'}
          </span>
        </div>
      </PhaseShell>
    );
  }

  const shownBugs = Math.min(bugCount, BUG_ROW_MAX);

  return (
    <PhaseShell label="デバッグ">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* 進捗バー「駆除 N/M」＋ バグ抑制（プログラマー育成の効果をここでも見せる） */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 12, color: DEV.cream, fontWeight: 700 }}>
              駆除 <span style={{ color: DEV.greenBright }}>{killed}</span>/{total}
            </span>
            <SegGauge
              pct={(killed / Math.max(1, total)) * 100}
              color={DEV.greenBright}
              track="#0c1207"
              height={8}
            />
          </div>
          <span
            style={{ fontSize: 11, color: DEV.sub, whiteSpace: 'nowrap' }}
            title="プログラマーの能力が高いほど開発中のバグ発生が抑えられる"
          >
            🧑‍💻 バグ抑制{' '}
            <span style={{ color: DEV.greenBright, fontWeight: 700 }}>{suppressionPct}%</span>
            （プログラマー）
          </span>
        </div>

        {/* 残バグの列：1匹駆除で 💥 → 消えて列が詰まる */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 2,
            minHeight: 22,
            padding: '4px 8px',
            background: '#0a0f08',
            border: `1px solid ${DEV.panelBorder}`,
            fontSize: 16,
            lineHeight: 1,
          }}
        >
          {squash &&
            Array.from({ length: squash.n }, (_, i) => (
              <span key={`squash-${squash.key}-${i}`} className="debug-bug-squash">
                💥
              </span>
            ))}
          {Array.from({ length: shownBugs }, (_, i) => (
            <span
              key={`bug-${i}`}
              className="debug-bug"
              style={{ animationDelay: `${(i % 5) * 160}ms` }}
            >
              🐛
            </span>
          ))}
          {bugCount > BUG_ROW_MAX && (
            <span style={{ fontSize: 11, color: DEV.orange, fontWeight: 700 }}>
              +{bugCount - BUG_ROW_MAX}
            </span>
          )}
        </div>

        <div style={{ fontSize: 16, color: DEV.cream, fontWeight: 700 }}>
          🐛 バグを修正する（{killed + 1} 匹目）
          <span style={{ fontSize: 12, color: DEV.sub, fontWeight: 400, marginLeft: 8 }}>
            修正 {phraseInBug}/{BUG_CONFIG.phrasesPerBug} 文
          </span>
        </div>

        <MissionTyping
          key={`${killed}-${phraseInBug}`}
          phrase={phrase}
          onComplete={() => {
            const done = phrase;
            const next = phraseInBug + 1;
            if (next >= BUG_CONFIG.phrasesPerBug) {
              onFix();
              sfx.success();
              setPhraseInBug(0);
              setFixLog((l) => [`✓ ${done} — 1匹駆除`, ...l].slice(0, 3));
              triggerSquash(1);
            } else {
              setPhraseInBug(next);
            }
            setPhrase(pickBugFixPhrase());
          }}
        />

        {/* 修正ログ（直近3件・高さ固定でレイアウトを揺らさない） */}
        <div style={{ ...devBox(), gap: 2, minHeight: 52 }}>
          <span style={{ fontSize: 10, color: DEV.green, fontWeight: 700 }}>修正ログ</span>
          {fixLog.length === 0 ? (
            <span style={{ fontSize: 11, color: '#5a6e3a' }}>（まだ駆除していない）</span>
          ) : (
            fixLog.map((line, idx) => (
              <span
                key={idx}
                style={{ fontSize: 11, color: idx === 0 ? DEV.greenBright : DEV.cream }}
              >
                {line}
              </span>
            ))
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {!adDebugUsed && (
            <button
              type="button"
              onClick={runDebugAssistAd}
              disabled={adRunning}
              style={{
                fontFamily: 'inherit',
                fontSize: 11,
                fontWeight: 700,
                padding: '4px 10px',
                background: '#12240f',
                color: adRunning ? DEV.sub : DEV.greenBright,
                border: `1px solid ${adRunning ? DEV.sub : DEV.greenBright}`,
                cursor: adRunning ? 'wait' : 'pointer',
              }}
            >
              {adRunning ? '📺 広告を再生中…' : '📺 広告を見てデバッグ応援（バグ半減）'}
            </button>
          )}
          <button
            type="button"
            onClick={onAllDone}
            style={{
              fontFamily: 'inherit',
              fontSize: 11,
              padding: '4px 10px',
              background: '#3a2a12',
              color: DEV.orange,
              border: `1px solid ${DEV.orange}`,
              cursor: 'pointer',
            }}
          >
            ⚠ このまま発売する（残バグ 1 匹につき 品質−{BUG_CONFIG.qualityPenaltyPerBug}・炎上+
            {BUG_CONFIG.reputationRiskPerBug}）
          </button>
        </div>
      </div>
    </PhaseShell>
  );
};

const MissionFlow = ({
  phase,
  label,
  bugCount,
  onAllDone,
  applyDelta,
}: {
  phase: DevPhase;
  label: string;
  /** v0.17：テストフェーズ完了時に「発覚」させる残バグ数 */
  bugCount: number;
  onAllDone: () => void;
  applyDelta: (delta: AxisDelta) => void;
}) => {
  const [queue] = useState(() => buildMissionQueue(phase));
  const [i, setI] = useState(0);
  const [log, setLog] = useState<string[]>([]);
  const cur = queue[i];

  useEffect(() => {
    if (cur) return;
    sfx.phase();
    const t = window.setTimeout(onAllDone, 900);
    return () => window.clearTimeout(t);
  }, [cur]);

  const resolve = (delta: AxisDelta, label2: string) => {
    applyDelta(delta);
    sfx.success();
    setLog((l) => [`✓ ${label2}：${formatAxisDelta(delta)}`, ...l].slice(0, 5));
    setI((n) => n + 1);
  };

  if (!cur) {
    return (
      <PhaseShell label={label}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
          <span style={{ fontSize: 26, fontWeight: 700, color: DEV.greenBright }}>
            ✓ {label}フェーズ 完了
          </span>
          {phase === 'testing' && (
            <span
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: bugCount > 0 ? DEV.orange : DEV.greenBright,
              }}
            >
              {bugCount > 0
                ? `🐛 バグが ${bugCount} 匹みつかった！ デバッグで直そう`
                : '🎉 バグは見つからなかった！'}
            </span>
          )}
          {log.length > 0 ? (
            <div style={{ ...devBox(), gap: 2, alignSelf: 'stretch' }}>
              {log.map((line, idx) => (
                <span key={idx} style={{ fontSize: 12, color: DEV.cream }}>
                  {line}
                </span>
              ))}
            </div>
          ) : (
            <span style={{ fontSize: 12, color: DEV.sub }}>問題なし。次の工程へ…</span>
          )}
        </div>
      </PhaseShell>
    );
  }

  return (
    <PhaseShell label={label}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 11, color: DEV.sub }}>
          イベント {i + 1} / {queue.length}
          <span style={{ color: DEV.orange, fontWeight: 700, marginLeft: 8 }}>⚡ 発生中</span>
        </div>
        <div style={{ fontSize: 14, color: DEV.orange, fontWeight: 700 }}>
          {EVENT_CATEGORY_META[cur.category].icon} {cur.name}
        </div>
        <div style={{ fontSize: 22, color: DEV.cream, fontWeight: 700 }}>{cur.missionLabel}</div>
        <div style={{ fontSize: 12, color: DEV.sub }}>
          {cur.flavor} — 打ち切れば {formatAxisDelta(cur.success)}
        </div>

        <MissionTyping
          key={i}
          phrase={cur.mission}
          onComplete={() => resolve(cur.success, cur.missionLabel)}
        />

        {log.length > 0 && (
          <div style={{ ...devBox(), gap: 2 }}>
            {log.map((line, idx) => (
              <span key={idx} style={{ fontSize: 12, color: DEV.cream }}>
                {line}
              </span>
            ))}
          </div>
        )}
      </div>
    </PhaseShell>
  );
};

/** フェーズ中央の外枠（development 以外用） */
const PhaseShell = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div
    style={{
      flex: 1,
      minHeight: 0,
      background: DEV.panelBg,
      border: `2px solid ${DEV.panelBorder}`,
      display: 'flex',
      flexDirection: 'column',
    }}
  >
    <div style={{ padding: '8px 12px', borderBottom: `2px solid ${DEV.panelBorder}` }}>
      <span style={{ color: DEV.green, fontWeight: 700, fontSize: 16, letterSpacing: '0.06em' }}>
        {'</> '}
        {label}フェーズ
      </span>
    </div>
    <div style={{ padding: 16 }}>{children}</div>
  </div>
);

/** ミッション 1 件分のタイピング（打ち切りで onComplete） */
const MissionTyping = ({ phrase, onComplete }: { phrase: string; onComplete: () => void }) => {
  const phrases = useMemo(() => [phrase], [phrase]);
  const { view } = useTyping({
    phrases,
    onPhraseComplete: onComplete,
    onCorrect: () => sfx.key(),
    onComboBreak: () => sfx.miss(),
  });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 11, color: DEV.green, fontWeight: 700 }}>入力する文章</div>
      <div
        style={{
          background: '#0c1207',
          border: `1px solid ${DEV.panelBorder}`,
          padding: '14px',
          fontSize: 30,
          color: DEV.cream,
          letterSpacing: '0.04em',
        }}
      >
        <KanaActionLine
          hiragana={view.hiragana}
          completedLen={view.completed.length}
          resolvedUnitCount={view.resolvedUnitCount}
          doneColor="#57703a"
          currentColor={DEV.white}
        />
      </div>
      <div
        style={{
          background: '#0c1207',
          border: `1px solid ${DEV.panelBorder}`,
          padding: '10px 14px',
          fontSize: 22,
          letterSpacing: '0.08em',
        }}
      >
        <span style={{ color: DEV.green }}>{view.completed}</span>
        <span className="dev-cursor" style={{ color: DEV.white }}>
          |
        </span>
        <span style={{ color: '#5a6e3a' }}>{view.remained}</span>
      </div>
    </div>
  );
};

/** フェーズ別のチームコメント候補（フレーバー。社員名と組み合わせて表示） */
const PHASE_COMMENTS: Record<DevPhase, string[]> = {
  planning: ['この企画いけそう！', '方向性が見えてきたね', 'ターゲットは誰にする？'],
  development: ['いい感じに進んでるね！', '処理がきれいにまとまった！', 'この調子でいこう！'],
  testing: ['操作感チェック中…', 'ここのバランス、どう思う？', 'テストケース消化中！'],
  debugging: ['このバグ、手強い…！', '再現手順わかったかも', 'あと少しで直せそう'],
  release: ['売上どうなるかな…！', 'SNS の反応が気になる', 'ストア公開ヨシ！'],
  complete: ['おつかれさま！', '最高のチームだった！', '次も作ろう！'],
};

/** イベント発生中のチームコメント（焦り） */
const EVENT_PANIC_COMMENTS = ['えっ、ちょっと待って！', '急いで対応しよう！', 'これはまずいかも…'];

/** 右カラム：チームからのコメント（アサイン社員×フェーズ/イベントのフレーバー） */
const TeamComments = ({
  team,
  phase,
  eventActive,
}: {
  team: { id: string; name: string; role: string }[];
  phase: DevPhase;
  eventActive: boolean;
}) => {
  const comments = eventActive ? EVENT_PANIC_COMMENTS : PHASE_COMMENTS[phase];
  if (team.length === 0) return null;
  return (
    <div style={{ ...devBox(), gap: 4 }}>
      <span style={{ fontSize: 11, color: DEV.green, fontWeight: 700 }}>チームからのコメント</span>
      {team.slice(0, 3).map((e, i) => (
        <span key={e.id} style={{ fontSize: 11, color: eventActive ? '#ff8a3c' : DEV.cream }}>
          💬 {e.name}：{comments[i % comments.length]}
        </span>
      ))}
    </div>
  );
};

/** 下部バー：そのフェーズで起こりうるイベント ＋ BGM */
const BottomBar = ({ phase }: { phase: DevPhase }) => {
  const events = PHASE_EVENTS[phase];
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 12px',
        margin: '0 12px 12px',
        background: '#0a0f08',
        border: `1px solid ${DEV.panelBorder}`,
        minHeight: 44,
      }}
    >
      <span style={{ fontSize: 11, color: DEV.sub, whiteSpace: 'nowrap' }}>
        次に発生しそうなイベント
      </span>
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', flex: 1 }}>
        {events.length === 0 && (
          <span style={{ fontSize: 12, color: '#5a6e3a', whiteSpace: 'nowrap' }}>
            （このフェーズはイベントなし）
          </span>
        )}
        {events.map((ev) => (
          <div
            key={ev.id}
            title={ev.flavor}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 10px',
              background: '#11180b',
              border: `1px solid ${DEV.panelBorder}`,
              whiteSpace: 'nowrap',
            }}
          >
            <span style={{ fontSize: 14 }}>{EVENT_CATEGORY_META[ev.category].icon}</span>
            <span style={{ fontSize: 12, color: DEV.cream }}>{ev.name}</span>
            <span style={{ fontSize: 11, color: DEV.orange, fontWeight: 700 }}>
              {Math.round(ev.rate * 100)}%
            </span>
          </div>
        ))}
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          paddingLeft: 10,
          borderLeft: `1px solid ${DEV.panelBorder}`,
          whiteSpace: 'nowrap',
        }}
      >
        <span style={{ fontSize: 14 }}>🎵</span>
        <span style={{ fontSize: 11, color: DEV.sub }}>BGM: 8bit Factory（準備中）</span>
      </div>
    </div>
  );
};

/** v0.14 開発フェーズのダークパレット（ターミナル風）。 */
export const DEV = {
  panelBg: '#06090e',
  panelBorder: '#2b3a1c',
  greenLine: '#3a5020',
  green: '#8fd02a',
  greenBright: '#a6e138',
  timeGreen: '#79c11b',
  cream: '#f4ecd9',
  white: '#fffdf2',
  orange: '#e29001',
  sub: '#7f9a52',
} as const;

export const devBox = (): React.CSSProperties => ({
  background: '#0a0f08',
  border: `1px solid ${DEV.panelBorder}`,
  padding: 7,
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
});
