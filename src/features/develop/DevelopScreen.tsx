import { useEffect, useMemo, useRef, useState } from 'react';
import { PixelStatusBar, SegGauge } from '../../components/ui';
import {
  AXIS_META,
  type AxisDelta,
  type DevEvent,
  EVENT_CATEGORY_META,
  PHASE_BASE_MISSION,
  PHASE_EVENTS,
  formatAxisDelta,
} from '../../data/events';
import { GENRE_BY_ID, getPhrases } from '../../data/genres';
import { SCALE_BY_ID } from '../../data/scales';
import { THEME_BY_ID } from '../../data/themes';
import { useGameStore } from '../../state/gameStore';
import {
  DEV_PHASE_META,
  DEV_PHASE_ORDER,
  type DevAxes,
  type DevPhase,
  ZERO_AXES,
  dateToWeekIndex,
} from '../../state/types';
import {
  computeDevImpact,
  type ImpactRank,
  type KeystrokeRating,
  NORI_MAX_COMBO,
  noriMultiplier,
  progressGain,
  rankColor,
  ratingForInterval,
  toCharsPerMin,
} from './devImpact';
import { useTyping } from './useTyping';

type Toast = { id: number; text: string; tone: 'warn' | 'good' | 'info' };

/**
 * v0.14 開発フェーズ画面（3 カラム・テイクオーバー）。
 *
 * モック `ui/phase/development_ui.png` 準拠：
 * - 左：フェーズ進行リスト（1〜6・🔒/▶/✓）＋ 現在の作業 ＋ チーム状態
 * - 中央：現在の `current.phase` に応じたメインパネル（開発＝タイピング、他＝舞台＋次へ）
 * - 右：現在のプロジェクト（タイトル/ジャンル/フェーズ画像/完成度/開発期間）
 *
 * フェーズは `current.phase` の内部状態で進める（planning→development→testing→debugging）。
 * debugging から先（発売・開発完了）は既存リリースフローへ委譲（advancePhase → finishDevelopment）。
 */
export const DevelopScreen = () => {
  const current = useGameStore((s) => s.current);
  const currentDate = useGameStore((s) => s.currentDate);
  const employees = useGameStore((s) => s.employees);
  const addDevelopLoC = useGameStore((s) => s.addDevelopLoC);
  const advancePhase = useGameStore((s) => s.advancePhase);
  const applyAxisDelta = useGameStore((s) => s.applyAxisDelta);
  const reportCombo = useGameStore((s) => s.reportCombo);
  const reportWPM = useGameStore((s) => s.reportWPM);
  const reportAccuracy = useGameStore((s) => s.reportAccuracy);

  const phase: DevPhase = current?.phase ?? 'development';
  const isDevelopment = phase === 'development';

  const [toasts, setToasts] = useState<Toast[]>([]);
  const wpmRef = useRef(0);
  // ノリゲージ：最新コンボ（progressGain の倍率に使う）
  const comboRef = useRef(0);
  // 直近フレーズ（開発ログ表示用。onPhraseComplete のクロージャ鮮度対策）
  const phraseRef = useRef('');
  // 開発ログ：フレーズ完了ごとの「見える成果」（最新 4 行）
  const [devLog, setDevLog] = useState<{ id: number; text: string }[]>([]);
  // v0.14：開発フェーズ中のイベント割り込み（発生中はイベント文を打ち切るまで通常フレーズを中断）
  const [devEvent, setDevEvent] = useState<DevEvent | null>(null);
  const devEventRef = useRef<DevEvent | null>(null);
  devEventRef.current = devEvent;

  const [rating, setRating] = useState<KeystrokeRating>(null);
  const lastCorrectAtRef = useRef<number>(0);
  const ratingTimerRef = useRef<number | null>(null);

  const pushToast = (text: string, tone: Toast['tone']) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, text, tone }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 1800);
  };

  const phrases = useMemo(() => {
    if (!current) return [];
    return getPhrases(current.genreId, current.requiredLoC * 3);
  }, [current?.genreId, current?.requiredLoC]);

  // イベント発生中はイベント文だけを出す（打ち切るまで通常フレーズを中断）
  const effectivePhrases = useMemo(() => {
    if (devEvent) return [devEvent.mission];
    return phrases;
  }, [phrases, devEvent]);

  // 開発フェーズ中のイベント抽選：8 秒ごとに 1 回、未発生時のみ判定
  useEffect(() => {
    if (!isDevelopment || !current) return;
    const timer = window.setInterval(() => {
      if (devEventRef.current) return;
      const pool = PHASE_EVENTS.development;
      for (const ev of pool) {
        // フェーズ間より頻度を抑える（rate × 0.5 / 8 秒判定）
        if (Math.random() < ev.rate * 0.5) {
          setDevEvent(ev);
          pushToast(`${EVENT_CATEGORY_META[ev.category].icon} ${ev.name}！ ${ev.missionLabel}`, 'warn');
          break;
        }
      }
    }, 8000);
    return () => window.clearInterval(timer);
  }, [isDevelopment, !current]);

  const { view, failCount, combo, wpm, accuracy } = useTyping({
    phrases: effectivePhrases,
    onPhraseComplete: () => {
      const ev = devEventRef.current;
      if (ev) {
        // イベントミッション打ち切り＝成功：新軸へ効果を適用し、通常フレーズに復帰
        applyAxisDelta(ev.success);
        const gain = progressGain(wpmRef.current, ev.category === 'trouble', comboRef.current);
        addDevelopLoC(gain);
        setDevLog((l) =>
          [
            {
              id: Date.now() + Math.random(),
              text: `${EVENT_CATEGORY_META[ev.category].icon} ${ev.name} 成功！ ${formatAxisDelta(ev.success)}`,
            },
            ...l,
          ].slice(0, 4),
        );
        setDevEvent(null);
      } else {
        // 通常フレーズ：ノリ倍率（コンボ）を乗せた進捗。打ち続けるほど 1 本の価値が上がる
        const gain = progressGain(wpmRef.current, false, comboRef.current);
        addDevelopLoC(gain);
        // 3 秒ループの成果可視化：何をいくら進めたかをログに流す
        setDevLog((l) =>
          [
            { id: Date.now() + Math.random(), text: `⚡ +${gain.toFixed(1)} 「${phraseRef.current}」実装完了！` },
            ...l,
          ].slice(0, 4),
        );
      }
      // v0.14：作業量目標に達したら「開発フェーズ完了」＝次フェーズ（テスト）へ進む。
      const s = useGameStore.getState();
      const done = s.current?.doneLoC ?? 0;
      const target = s.current?.workTarget ?? 1;
      if (done >= target && (s.current?.phase ?? 'development') === 'development') {
        advancePhase();
      }
    },
    // タイピングは開発フェーズ中のみ作動（他フェーズではキー入力を拾わない）
    paused: !current || !isDevelopment,
    onCorrect: (c) => {
      comboRef.current = c;
      reportCombo(c);
      const now = performance.now();
      const interval = now - lastCorrectAtRef.current;
      lastCorrectAtRef.current = now;
      const r = ratingForInterval(interval);
      if (r) {
        setRating(r);
        if (ratingTimerRef.current) window.clearTimeout(ratingTimerRef.current);
        ratingTimerRef.current = window.setTimeout(() => setRating(null), 600);
      }
    },
    onComboBreak: () => {
      comboRef.current = 0;
    },
    onWpm: (w) => {
      wpmRef.current = w;
      reportWPM(w);
    },
    onAccuracy: (a) => reportAccuracy(a),
  });

  // 直近フレーズを保持（完了ログ用）
  useEffect(() => {
    if (view.hiragana) phraseRef.current = view.hiragana;
  }, [view.hiragana]);

  const workTarget = current?.workTarget ?? 1;

  // 旧 bugPhrase 経路は v0.14 でイベント系「バグ発生」に一本化（devEvent 割り込み）

  if (!current) return null;
  const scaleDef = SCALE_BY_ID[current.scale];
  if (!scaleDef) return null;

  const impact = computeDevImpact({ wpm, accuracy });
  const charsPerMin = toCharsPerMin(wpm);
  const accuracyPct = Math.round(accuracy * 1000) / 10;
  const progressPct = Math.max(0, Math.min(100, (current.doneLoC / workTarget) * 100));

  // 開発期間（裏で進む時間。早く打つほど短く済む）
  const plannedWeeks = Math.max(1, scaleDef.neededWeeks);
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
  const phaseImage = `${import.meta.env.BASE_URL}phase/${phaseMeta.image}.png`;

  return (
    <div className="screen develop-screen" style={{ background: '#05080c' }}>
      <PixelStatusBar />

      {/* テロップ（バグ等） */}
      {toasts.length > 0 && (
        <div
          aria-live="polite"
          style={{
            position: 'absolute',
            top: 52,
            right: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            zIndex: 30,
            pointerEvents: 'none',
          }}
        >
          {toasts.map((t) => (
            <div
              key={t.id}
              style={{
                padding: '6px 12px',
                background: t.tone === 'warn' ? '#7a1d1d' : '#1e3a10',
                color: '#f4ecd9',
                border: `1px solid ${t.tone === 'warn' ? '#c84a3a' : DEV.greenLine}`,
                fontWeight: 700,
                fontSize: 13,
              }}
            >
              {t.text}
            </div>
          ))}
        </div>
      )}

      {/* 3 カラム本体 */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'grid',
          gridTemplateColumns: '240px 1fr 300px',
          gap: 12,
          padding: 12,
        }}
      >
        {/* 左：フェーズ進行 ＋ チーム */}
        <aside style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}>
          <PhaseProgressList phase={phase} />
          <div style={{ ...devBox(), gap: 4 }}>
            <span style={{ fontSize: 11, color: DEV.green, fontWeight: 700 }}>現在の作業</span>
            <span style={{ fontSize: 13, color: DEV.cream, fontWeight: 700 }}>
              {phaseMeta.label}フェーズ
            </span>
            <span style={{ fontSize: 11, color: DEV.sub }}>{PHASE_WORK_NOTE[phase]}</span>
          </div>
          <TeamStatus employeeIds={current.assignedEmployeeIds} allEmployees={employees} />
        </aside>

        {/* 中央：フェーズ別メインパネル */}
        <main style={{ minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          {isDevelopment ? (
            <DevelopCenter
              phaseLabel={phaseMeta.label}
              missionName={current.missionName}
              missionDesc={current.missionDesc}
              view={view}
              combo={combo}
              rating={rating}
              charsPerMin={charsPerMin}
              accuracyPct={accuracyPct}
              failCount={failCount}
              impact={impact}
              devLog={devLog}
              activeEvent={devEvent}
            />
          ) : (
            <MissionFlow
              key={phase}
              phase={phase}
              label={phaseMeta.label}
              onAllDone={advancePhase}
              applyDelta={applyAxisDelta}
            />
          )}
        </main>

        {/* 右：現在のプロジェクト（フェーズ画像＋情報） */}
        <aside style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}>
          <div style={{ ...devBox(), gap: 6 }}>
            <span style={{ fontSize: 11, color: DEV.sub }}>現在のプロジェクト</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: DEV.cream, lineHeight: 1.1 }}>
              {genre?.emoji} {current.title}
            </span>
            <span style={{ fontSize: 11, color: DEV.sub }}>
              {genre?.name} / {theme?.name} / {scaleDef.name}
            </span>
            <div
              style={{
                marginTop: 2,
                border: `1px solid ${DEV.panelBorder}`,
                background: '#0c1207',
                aspectRatio: '3 / 2',
                overflow: 'hidden',
              }}
            >
              <img
                src={phaseImage}
                alt={`${phaseMeta.label}フェーズ`}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  imageRendering: 'pixelated',
                }}
              />
            </div>
          </div>

          <div style={{ ...devBox(), gap: 6 }}>
            <span style={{ fontSize: 11, color: DEV.sub }}>現在の完成度</span>
            <span
              style={{
                fontSize: 32,
                fontWeight: 700,
                color: DEV.greenBright,
                fontVariantNumeric: 'tabular-nums',
                lineHeight: 1,
              }}
            >
              {Math.floor(progressPct)} <span style={{ fontSize: 13 }}>%</span>
            </span>
            <SegGauge pct={progressPct} color={DEV.greenBright} track="#0c1207" height={12} />
          </div>

          <div style={{ ...devBox(), gap: 6 }}>
            <span style={{ fontSize: 11, color: DEV.sub }}>開発期間（予定 {plannedWeeks} 週）</span>
            <span style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontSize: 11, color: DEV.sub }}>経過</span>
              <span style={{ fontSize: 28, fontWeight: 700, color: periodColor, lineHeight: 1 }}>
                {elapsedWeeks}
              </span>
              <span style={{ fontSize: 12, color: periodColor }}>週</span>
            </span>
            <SegGauge pct={budgetPct} color={periodColor} track="#0c1207" height={10} />
            <span style={{ fontSize: 11, fontWeight: 700, color: periodColor }}>{periodNote}</span>
          </div>

          {/* イベント効果の累計（新軸の見える化） */}
          <AxesSummary axes={current.axes ?? ZERO_AXES} />
        </aside>
      </div>

      {/* 下部：このフェーズで起こりうるイベント */}
      <EventBar phase={phase} />
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

/** 左カラム：チーム状態（割り当て社員） */
const TeamStatus = ({
  employeeIds,
  allEmployees,
}: {
  employeeIds: string[];
  allEmployees: { id: string; name: string; role: string }[];
}) => {
  const team = allEmployees.filter((e) => employeeIds.includes(e.id));
  const roleEmoji: Record<string, string> = {
    programmer: '🧑‍💻',
    designer: '🎨',
    pr: '📣',
  };
  return (
    <div style={{ ...devBox(), gap: 6, flex: 1, minHeight: 0, overflow: 'auto' }}>
      <span style={{ fontSize: 11, color: DEV.green, fontWeight: 700 }}>チーム状態</span>
      {team.length === 0 && (
        <span style={{ fontSize: 11, color: DEV.sub }}>社員なし（あなた一人で開発中）</span>
      )}
      {team.map((e) => (
        <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>{roleEmoji[e.role] ?? '🧑‍💻'}</span>
          <span style={{ fontSize: 12, color: DEV.cream }}>{e.name}</span>
          <span style={{ marginLeft: 'auto', fontSize: 12 }}>🙂</span>
        </div>
      ))}
    </div>
  );
};

/** 中央：開発フェーズ（タイピング） */
const DevelopCenter = ({
  phaseLabel,
  missionName,
  missionDesc,
  view,
  combo,
  rating,
  charsPerMin,
  accuracyPct,
  failCount,
  impact,
  devLog,
  activeEvent,
}: {
  phaseLabel: string;
  missionName?: string;
  missionDesc?: string;
  view: { hiragana: string; completed: string; remained: string };
  combo: number;
  rating: KeystrokeRating;
  charsPerMin: number;
  accuracyPct: number;
  failCount: number;
  impact: ReturnType<typeof computeDevImpact>;
  devLog: { id: number; text: string }[];
  activeEvent: DevEvent | null;
}) => (
  <div
    style={{
      flex: 1,
      minHeight: 0,
      overflow: 'auto',
      background: DEV.panelBg,
      border: `2px solid ${DEV.panelBorder}`,
      boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
      imageRendering: 'pixelated',
      display: 'flex',
      flexDirection: 'column',
    }}
  >
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
    </div>

    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
      {(missionName || missionDesc) && (
        <div>
          {missionName && (
            <div style={{ fontSize: 11, color: DEV.green, fontWeight: 700 }}>{missionName}</div>
          )}
          {missionDesc && (
            <div style={{ fontSize: 22, color: DEV.cream, fontWeight: 700 }}>{missionDesc}</div>
          )}
        </div>
      )}

      {/* イベント割り込みバナー */}
      {activeEvent && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 10px',
            background: '#3a2a05',
            border: `2px solid ${DEV.orange}`,
          }}
        >
          <span style={{ fontSize: 16 }}>{EVENT_CATEGORY_META[activeEvent.category].icon}</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: DEV.orange }}>
            {activeEvent.name}
          </span>
          <span style={{ fontSize: 12, color: DEV.cream }}>
            {activeEvent.missionLabel} — 打ち切れば {formatAxisDelta(activeEvent.success)}
          </span>
        </div>
      )}

      <div>
        <div style={{ fontSize: 11, color: DEV.green, fontWeight: 700, marginBottom: 4 }}>
          入力する文章
        </div>
        <div
          className={activeEvent ? 'dev-event-active' : undefined}
          style={{
            background: '#0c1207',
            border: `2px solid ${activeEvent ? DEV.orange : DEV.panelBorder}`,
            padding: '14px 14px',
            fontSize: 34,
            color: DEV.cream,
            letterSpacing: '0.04em',
            minHeight: 40,
          }}
        >
          {view.hiragana}
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
            padding: '10px 14px',
            fontSize: 24,
            letterSpacing: '0.08em',
            minHeight: 30,
          }}
        >
          {/* 正打ジュース：最後に打った文字が一瞬光る */}
          <span style={{ color: DEV.green }}>{view.completed.slice(0, -1)}</span>
          {view.completed.length > 0 && (
            <span key={`glow-${view.completed.length}`} className="dev-key-glow">
              {view.completed.slice(-1)}
            </span>
          )}
          <span className="dev-cursor" style={{ color: DEV.white }}>
            |
          </span>
          <span style={{ color: '#5a6e3a' }}>{view.remained}</span>
        </div>
      </div>

      {/* COMBO ＋ ノリゲージ（コンボが進捗倍率に直結。切れると ×1.0 に戻る） */}
      <div
        style={{
          ...devBox(),
          flexDirection: 'row',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13, color: DEV.sub, letterSpacing: '0.1em' }}>COMBO</span>
          <span
            key={combo}
            className="dev-combo"
            style={{
              fontSize: 40,
              fontWeight: 700,
              color: DEV.orange,
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1,
            }}
          >
            {combo}
          </span>
          {rating && (
            <span
              className="dev-rating"
              style={{ fontSize: 16, fontWeight: 700, color: DEV.orange }}
            >
              +{rating}!
            </span>
          )}
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 11, color: DEV.sub }}>
            ノリゲージ（進捗倍率{' '}
            <span style={{ color: DEV.orange, fontWeight: 700 }}>
              ×{noriMultiplier(combo).toFixed(2)}
            </span>
            ・ミスで途切れる）
          </span>
          <SegGauge
            pct={Math.min(100, (combo / NORI_MAX_COMBO) * 100)}
            color={DEV.orange}
            track="#0c1207"
            height={10}
          />
        </div>
      </div>

      {/* 開発ログ：フレーズ完了＝見える成果 */}
      {devLog.length > 0 && (
        <div style={{ ...devBox(), gap: 2 }}>
          {devLog.map((line, idx) => (
            <span
              key={line.id}
              style={{
                fontSize: 12,
                color: idx === 0 ? DEV.greenBright : DEV.sub,
                fontWeight: idx === 0 ? 700 : 400,
              }}
            >
              {line.text}
            </span>
          ))}
        </div>
      )}

      {/* 3 メトリクス */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        <Metric label="入力速度" icon="⏩" value={`${charsPerMin}`} unit="文字/分" />
        <Metric label="正確さ" icon="🎯" value={`${accuracyPct}`} unit="%" />
        <Metric label="ミス回数" icon="❌" value={`${failCount}`} unit="回" />
      </div>

      {/* 開発への影響 */}
      <div>
        <div style={{ fontSize: 11, color: DEV.green, fontWeight: 700, marginBottom: 6 }}>
          開発への影響（この入力結果）
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          <ImpactBox
            icon="⚡"
            label="開発速度"
            value={`${impact.speedPct >= 0 ? '+' : ''}${impact.speedPct}%`}
            rank={impact.speedRank}
            pct={clampPct(impact.speedPct + 30, 70)}
          />
          <ImpactBox
            icon="💎"
            label="品質"
            value={`+${impact.qualityDelta}`}
            rank={impact.qualityRank}
            pct={impact.qualityDelta * 20}
          />
          <ImpactBox
            icon="🐛"
            label="バグ率"
            value={`${impact.bugPct}%`}
            rank={impact.bugRank}
            pct={Math.abs(impact.bugPct) * 20}
          />
        </div>
      </div>
    </div>
  </div>
);

type QueuedMission = {
  kind: 'base' | 'event';
  name?: string;
  label: string;
  flavor?: string;
  mission: string;
  success: AxisDelta;
  fail: AxisDelta;
};

/** フェーズ入場時にミッション列を組む：必ずベース 1 件＋発生率で当たったイベント */
const buildMissionQueue = (phase: DevPhase): QueuedMission[] => {
  const q: QueuedMission[] = [];
  const base = PHASE_BASE_MISSION[phase];
  if (base) q.push({ kind: 'base', label: base.label, mission: base.mission, success: {}, fail: {} });
  for (const ev of PHASE_EVENTS[phase]) {
    if (Math.random() < ev.rate) {
      q.push({
        kind: 'event',
        name: ev.name,
        label: ev.missionLabel,
        flavor: ev.flavor,
        mission: ev.mission,
        success: ev.success,
        fail: ev.fail,
      });
    }
  }
  return q;
};

/** 中央：開発以外のフェーズ（ベース入力ミッション＋発生イベントを順に打つ） */
const MissionFlow = ({
  phase,
  label,
  onAllDone,
  applyDelta,
}: {
  phase: DevPhase;
  label: string;
  onAllDone: () => void;
  applyDelta: (delta: AxisDelta) => void;
}) => {
  const [queue] = useState(() => buildMissionQueue(phase));
  const [i, setI] = useState(0);
  const [log, setLog] = useState<string[]>([]);
  const cur = queue[i];

  const resolve = (delta: AxisDelta, label2: string, ok: boolean) => {
    applyDelta(delta);
    setLog((l) => [`${ok ? '✓' : '✕'} ${label2}：${formatAxisDelta(delta)}`, ...l].slice(0, 5));
    if (i + 1 >= queue.length) onAllDone();
    else setI((n) => n + 1);
  };

  if (!cur) {
    // 念のため（base も event も無い）：そのまま次フェーズへ
    return (
      <PhaseShell label={label}>
        <button type="button" onClick={onAllDone} style={advanceBtnStyle}>
          ▶ 次のフェーズへ
        </button>
      </PhaseShell>
    );
  }

  return (
    <PhaseShell label={label}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 11, color: DEV.sub }}>
          ミッション {i + 1} / {queue.length}
          {cur.kind === 'event' && (
            <span style={{ color: DEV.orange, fontWeight: 700, marginLeft: 8 }}>⚡ イベント発生</span>
          )}
        </div>
        {cur.name && (
          <div style={{ fontSize: 14, color: DEV.orange, fontWeight: 700 }}>{cur.name}</div>
        )}
        <div style={{ fontSize: 22, color: DEV.cream, fontWeight: 700 }}>{cur.label}</div>
        {cur.flavor && <div style={{ fontSize: 12, color: DEV.sub }}>{cur.flavor}</div>}

        <MissionTyping
          key={i}
          phrase={cur.mission}
          onComplete={() => resolve(cur.success, cur.label, true)}
        />

        <button
          type="button"
          onClick={() => resolve(cur.fail, cur.label, false)}
          style={{
            alignSelf: 'flex-start',
            padding: '6px 14px',
            background: 'transparent',
            border: `1px solid ${DEV.panelBorder}`,
            color: DEV.sub,
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          スキップ（打たない）
        </button>

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

/** フェーズ中央の外枠 */
const PhaseShell = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div
    style={{
      flex: 1,
      minHeight: 0,
      overflow: 'auto',
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
  const { view } = useTyping({ phrases, onPhraseComplete: onComplete });
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
        {view.hiragana}
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

/** 右カラム：イベントで蓄積した新軸の見える化（0 でない軸だけ表示） */
const AxesSummary = ({ axes }: { axes: DevAxes }) => {
  const entries = (Object.keys(axes) as (keyof DevAxes)[])
    .filter((k) => axes[k] !== 0)
    .map((k) => ({ key: k, v: axes[k], meta: AXIS_META[k] }));
  return (
    <div style={{ ...devBox(), gap: 4 }}>
      <span style={{ fontSize: 11, color: DEV.sub }}>イベント効果（この作品に蓄積）</span>
      {entries.length === 0 ? (
        <span style={{ fontSize: 11, color: '#5a6e3a' }}>まだなし（イベントを打ち切ると貯まる）</span>
      ) : (
        entries.map(({ key, v, meta }) => (
          <span
            key={key}
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: v > 0 !== (key === 'bugRate' || key === 'reputationRisk' || key === 'devWeeksDelta' || key === 'costMod')
                ? DEV.greenBright
                : '#ff6b6b',
            }}
          >
            {meta.label} {v > 0 ? '+' : ''}
            {v}
            {meta.unit}
          </span>
        ))
      )}
    </div>
  );
};

/** 下部バー：そのフェーズで起こりうるイベントだけを表示（spec §5-4） */
const EventBar = ({ phase }: { phase: DevPhase }) => {
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
        overflowX: 'auto',
      }}
    >
      <span style={{ fontSize: 11, color: DEV.sub, whiteSpace: 'nowrap' }}>
        このフェーズで起こりうるイベント
      </span>
      {events.length === 0 && (
        <span style={{ fontSize: 12, color: '#5a6e3a' }}>（このフェーズはイベントなし）</span>
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
  );
};

const advanceBtnStyle: React.CSSProperties = {
  marginTop: 8,
  padding: '12px 28px',
  background: '#234012',
  border: '2px solid #8fd02a',
  color: '#fffdf2',
  fontWeight: 700,
  fontSize: 15,
  cursor: 'pointer',
};

/** v0.14 開発フェーズのダークパレット（ターミナル風）。 */
const DEV = {
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

const PHASE_WORK_NOTE: Record<DevPhase, string> = {
  planning: '企画を固める：ジャンル・テーマ・コンセプトの確認',
  development: 'ゲームシステムを実装する（コードを打つ）',
  testing: 'プレイテストでテストケースを消化する',
  debugging: 'バグを駆除して品質を仕上げる',
  release: '発売して売上を監視する',
  complete: '開発完了・打ち上げ',
};

const devBox = (): React.CSSProperties => ({
  background: '#0a0f08',
  border: `1px solid ${DEV.panelBorder}`,
  padding: 10,
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
});

const clampPct = (v: number, max: number) => Math.max(0, Math.min(100, (v / max) * 100));

const Metric = ({
  label,
  icon,
  value,
  unit,
}: {
  label: string;
  icon: string;
  value: string;
  unit: string;
}) => (
  <div style={{ ...devBox(), gap: 2 }}>
    <span style={{ fontSize: 11, color: DEV.sub }}>{label}</span>
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
      <span style={{ fontSize: 14 }}>{icon}</span>
      <span
        style={{
          fontSize: 22,
          fontWeight: 700,
          color: DEV.cream,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </span>
      <span style={{ fontSize: 11, color: DEV.sub }}>{unit}</span>
    </div>
  </div>
);

const ImpactBox = ({
  icon,
  label,
  value,
  rank,
  pct,
}: {
  icon: string;
  label: string;
  value: string;
  rank: ImpactRank;
  pct: number;
}) => (
  <div style={{ ...devBox(), gap: 4 }}>
    <span style={{ fontSize: 11, color: DEV.sub }}>
      {icon} {label}
    </span>
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
      <span
        style={{
          fontSize: 18,
          fontWeight: 700,
          color: DEV.cream,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </span>
      <span style={{ fontSize: 16, fontWeight: 700, color: rankColor(rank) }}>{rank}</span>
    </div>
    <SegGauge pct={pct} color={rankColor(rank)} track="#0c1207" height={6} />
  </div>
);
