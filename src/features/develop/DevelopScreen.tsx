import { useEffect, useMemo, useRef, useState } from 'react';
import { PixelStatusBar, SegGauge } from '../../components/ui';
import {
  AXIS_META,
  type AxisDelta,
  type DevEvent,
  EVENT_CATEGORY_META,
  LANE_BONUS,
  LANE_BUG,
  LANE_CRITICAL_BUG,
  type LaneSpawnDef,
  PHASE_EVENTS,
  formatAxisDelta,
} from '../../data/events';
import { sfx } from '../../utils/sfx';

/** v0.15：レーンを流れる出現物のインスタンス */
type LaneItem = {
  id: number;
  kind: LaneSpawnDef['kind'];
  icon: string;
  label: string;
  phrase: string;
  lifeMs: number;
  success: AxisDelta;
  expire: AxisDelta;
  erodePct?: number;
};

let laneSeq = 0;

const makeLaneItem = (def: LaneSpawnDef): LaneItem => ({
  id: ++laneSeq,
  kind: def.kind,
  icon: def.icon,
  label: def.label,
  phrase: def.phrases[Math.floor(Math.random() * def.phrases.length)],
  lifeMs: def.lifeMs,
  success: def.success,
  expire: def.expire,
  erodePct: def.erodePct,
});

/** v0.15 フィーバー定数（叩き台 🔧）：正打 60 打で MAX、15 秒間 進捗×2＋ボーナスラッシュ */
const FEVER_MAX = 60;
const FEVER_DURATION_MS = 15000;

/** v0.14 ランダムイベントを「特別な出現物」としてレーンに統合（spec §1-2） */
const makeLaneItemFromEvent = (ev: DevEvent): LaneItem => ({
  id: ++laneSeq,
  kind: 'event',
  icon: EVENT_CATEGORY_META[ev.category].icon,
  label: ev.name,
  phrase: ev.mission,
  lifeMs: 12000,
  success: ev.success,
  expire: ev.fail,
});
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
  const erodeDevelopLoC = useGameStore((s) => s.erodeDevelopLoC);
  const advancePhase = useGameStore((s) => s.advancePhase);
  const applyAxisDelta = useGameStore((s) => s.applyAxisDelta);
  const reportCombo = useGameStore((s) => s.reportCombo);
  const reportWPM = useGameStore((s) => s.reportWPM);
  const reportAccuracy = useGameStore((s) => s.reportAccuracy);

  const phase: DevPhase = current?.phase ?? 'development';
  const isDevelopment = phase === 'development';

  const wpmRef = useRef(0);
  // ノリゲージ：最新コンボ（progressGain の倍率に使う）
  const comboRef = useRef(0);
  // 直近フレーズ（開発ログ表示用。onPhraseComplete のクロージャ鮮度対策）
  const phraseRef = useRef('');
  // 開発ログ：フレーズ完了ごとの「見える成果」（最新 4 行）
  const [devLog, setDevLog] = useState<{ id: number; text: string }[]>([]);
  // v0.15：出現レーン（spec §1-2）。バグ/ボーナス/イベントがスプライトとして右→左に流れる。
  // Space でメイン⇄出現物ターゲット切替（メイン文の進行はエンジンごと保持＝ずれない）。
  const [laneItems, setLaneItems] = useState<LaneItem[]>([]);
  const [laneTargetId, setLaneTargetId] = useState<number | null>(null);
  const laneItemsRef = useRef<LaneItem[]>([]);
  const laneTargetRef = useRef<number | null>(null);
  laneItemsRef.current = laneItems;
  laneTargetRef.current = laneTargetId;
  // スポーンまでの残秒（1 秒ティックで減算）
  const spawnTimersRef = useRef({ bug: 10, bonus: 14, event: 20 });
  // イベント/バグ発生の全画面フラッシュ（オレンジ）と侵食被弾フラッシュ（赤）
  const [flash, setFlash] = useState(0);
  const [damageFlash, setDamageFlash] = useState(0);
  // フレーズ完了の「+N」フロート（視線の先＝入力枠のそばに出す）
  const [gainPop, setGainPop] = useState<{ id: number; text: string } | null>(null);

  // v0.15 フィーバー（spec §1-4）：正打で蓄積・ミスで減少、MAX で自動発動 15 秒（叩き台 🔧）
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
  // MAX 到達で自動発動
  useEffect(() => {
    if (!feverActive && feverGauge >= FEVER_MAX) {
      setFeverActive(true);
      setFeverGauge(FEVER_MAX);
      sfx.success();
      setFlash((n) => n + 1);
      const t = window.setTimeout(() => {
        setFeverActive(false);
        setFeverGauge(0);
        sfx.phase();
      }, FEVER_DURATION_MS);
      return () => window.clearTimeout(t);
    }
  }, [feverGauge, feverActive]);

  const [rating, setRating] = useState<KeystrokeRating>(null);
  const lastCorrectAtRef = useRef<number>(0);
  const ratingTimerRef = useRef<number | null>(null);

  const phrases = useMemo(() => {
    if (!current) return [];
    return getPhrases(current.genreId, current.requiredLoC * 3);
  }, [current?.genreId, current?.requiredLoC]);

  // レーンのスポーナー（1 秒ティック）：バグ/ボーナス/イベントを時間差で流す。同時最大 3。
  useEffect(() => {
    if (!isDevelopment || !current) return;
    const timer = window.setInterval(() => {
      const st = spawnTimersRef.current;
      st.bug -= 1;
      st.bonus -= 1;
      st.event -= 1;
      if (laneItemsRef.current.length >= 3) return;
      // フィーバー中はボーナスラッシュ（毎秒 35% で追加スポーン）
      if (feverActiveRef.current && Math.random() < 0.35) {
        setLaneItems((l) => [...l, makeLaneItem(LANE_BONUS)]);
        return;
      }
      if (st.bug <= 0) {
        // 20% でクリティカル。進捗 50% 超で湧きが加速（叩き台 🔧）
        const def = Math.random() < 0.2 ? LANE_CRITICAL_BUG : LANE_BUG;
        setLaneItems((l) => [...l, makeLaneItem(def)]);
        const s = useGameStore.getState();
        const prog = (s.current?.doneLoC ?? 0) / (s.current?.workTarget ?? 1);
        st.bug = (prog > 0.5 ? 8 : 11) + Math.random() * 4;
        sfx.alert();
        setFlash((n) => n + 1);
      } else if (st.bonus <= 0) {
        setLaneItems((l) => [...l, makeLaneItem(LANE_BONUS)]);
        st.bonus = 12 + Math.random() * 6;
        sfx.complete();
      } else if (st.event <= 0) {
        st.event = 8;
        for (const ev of PHASE_EVENTS.development) {
          if (Math.random() < ev.rate * 0.5) {
            setLaneItems((l) => [...l, makeLaneItemFromEvent(ev)]);
            sfx.alert();
            setFlash((n) => n + 1);
            break;
          }
        }
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isDevelopment, !current]);

  // Space：メイン⇄出現物のターゲット切替（プレイヤー主導。レーンが空なら何もしない）
  useEffect(() => {
    if (!isDevelopment) return;
    const h = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      e.preventDefault();
      if (laneTargetRef.current !== null) {
        setLaneTargetId(null);
      } else {
        const first = laneItemsRef.current[0];
        if (first) setLaneTargetId(first.id);
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [isDevelopment]);

  // 出現物の解決/期限切れ
  const targetItem = laneItems.find((i) => i.id === laneTargetId) ?? null;

  const removeLaneItem = (id: number) => {
    setLaneItems((l) => l.filter((x) => x.id !== id));
    if (laneTargetRef.current === id) setLaneTargetId(null);
  };

  const handleItemExpire = (id: number) => {
    const item = laneItemsRef.current.find((x) => x.id === id);
    if (!item) return;
    if (item.erodePct) {
      // バグ到達＝完成度じわ減り（打てば取り返せる量。0 未満にならない＝詰まない）
      const s = useGameStore.getState();
      const erode = (s.current?.workTarget ?? 1) * item.erodePct;
      erodeDevelopLoC(erode);
      applyAxisDelta(item.expire);
      sfx.miss();
      setDamageFlash((n) => n + 1);
      setDevLog((l) =>
        [
          {
            id: Date.now() + Math.random(),
            text: `${item.icon} ${item.label}がコードを蝕んだ！ 完成度 -${Math.round((item.erodePct ?? 0) * 100)}%`,
          },
          ...l,
        ].slice(0, 2),
      );
    } else if (Object.keys(item.expire).length > 0) {
      applyAxisDelta(item.expire);
      setDevLog((l) =>
        [
          { id: Date.now() + Math.random(), text: `${item.icon} ${item.label}を逃した… ${formatAxisDelta(item.expire)}` },
          ...l,
        ].slice(0, 2),
      );
    } else {
      setDevLog((l) =>
        [{ id: Date.now() + Math.random(), text: `${item.icon} ${item.label}が流れていった…` }, ...l].slice(0, 2),
      );
    }
    removeLaneItem(id);
  };

  // 出現物用タイピング（第 2 エンジン）。ターゲット中のみ作動。メインは paused で進行保持
  const targetPhrases = useMemo(() => (targetItem ? [targetItem.phrase] : []), [targetItem?.id]);
  const { view: laneView } = useTyping({
    phrases: targetPhrases,
    paused: !current || !isDevelopment || !targetItem,
    onPhraseComplete: () => {
      const item = laneItemsRef.current.find((x) => x.id === laneTargetRef.current);
      if (!item) return;
      applyAxisDelta(item.success);
      sfx.success();
      const verb = item.kind === 'bonus' ? 'ゲット' : '駆除';
      setGainPop({ id: Date.now(), text: `${item.icon} ${item.label} ${verb}！` });
      setDevLog((l) =>
        [
          {
            id: Date.now() + Math.random(),
            text: `${item.icon} ${item.label} ${verb}！ ${formatAxisDelta(item.success)}`,
          },
          ...l,
        ].slice(0, 2),
      );
      removeLaneItem(item.id);
    },
    onCorrect: () => {
      sfx.key();
      addFever(1);
    },
    onComboBreak: () => {
      sfx.miss();
      decayFever();
    },
  });

  const { view, failCount, combo, wpm, accuracy } = useTyping({
    phrases,
    onPhraseComplete: () => {
      // 通常フレーズ：ノリ倍率（コンボ）＋フィーバー×2 を乗せた進捗
      const gain =
        progressGain(wpmRef.current, false, comboRef.current) * (feverActiveRef.current ? 2 : 1);
      addDevelopLoC(gain);
      sfx.complete();
      // 成果は視線の先（入力枠のそば）にフロート表示＋ログにも残す
      setGainPop({ id: Date.now(), text: `+${gain.toFixed(1)}` });
      setDevLog((l) =>
        [
          { id: Date.now() + Math.random(), text: `⚡ +${gain.toFixed(1)} 「${phraseRef.current}」実装完了！` },
          ...l,
        ].slice(0, 2),
      );
      // v0.14：作業量目標に達したら「開発フェーズ完了」＝次フェーズ（テスト）へ進む。
      const s = useGameStore.getState();
      const done = s.current?.doneLoC ?? 0;
      const target = s.current?.workTarget ?? 1;
      if (done >= target && (s.current?.phase ?? 'development') === 'development') {
        advancePhase();
      }
    },
    // 開発フェーズ中＆メインをターゲットしている間のみ作動（出現物打ち中は進行保持のまま停止）
    paused: !current || !isDevelopment || laneTargetId !== null,
    onCorrect: (c) => {
      comboRef.current = c;
      sfx.key();
      addFever(1);
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
      sfx.miss();
      decayFever();
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
    <div
      className={`screen develop-screen${feverActive ? ' dev-fever' : ''}`}
      style={{ background: '#05080c', position: 'relative' }}
    >
      <PixelStatusBar />

      {/* 出現/被弾の全画面フラッシュ（key 再生・操作は透過） */}
      {flash > 0 && <div key={`flash-${flash}`} className="dev-flash-vignette" />}
      {damageFlash > 0 && <div key={`dmg-${damageFlash}`} className="dev-flash-damage" />}

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
        <aside style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 }}>
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
              laneItems={laneItems}
              laneTargetId={laneTargetId}
              targetItem={targetItem}
              laneView={laneView}
              onItemExpire={handleItemExpire}
              gainPop={gainPop}
              feverGauge={feverGauge}
              feverActive={feverActive}
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
        <aside style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 }}>
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
                height: 110,
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
                fontSize: 24,
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
              <span style={{ fontSize: 22, fontWeight: 700, color: periodColor, lineHeight: 1 }}>
                {elapsedWeeks}
              </span>
              <span style={{ fontSize: 12, color: periodColor }}>週</span>
            </span>
            <SegGauge pct={budgetPct} color={periodColor} track="#0c1207" height={10} />
            <span style={{ fontSize: 11, fontWeight: 700, color: periodColor }}>{periodNote}</span>
          </div>

          {/* イベント効果の累計（新軸の見える化） */}
          <AxesSummary axes={current.axes ?? ZERO_AXES} />

          {/* チームからのコメント（フェーズ連動のフレーバー） */}
          <TeamComments
            team={employees.filter((e) => current.assignedEmployeeIds.includes(e.id))}
            phase={phase}
          />

          {/* BGM 枠（表示のみ。音源は別版） */}
          <div style={{ ...devBox(), flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14 }}>🎵</span>
            <span style={{ fontSize: 12, color: DEV.sub }}>BGM: 8bit Factory（準備中）</span>
          </div>
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
    <div style={{ ...devBox(), gap: 6, flex: 1, minHeight: 0, overflow: 'hidden' }}>
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
  laneItems,
  laneTargetId,
  targetItem,
  laneView,
  onItemExpire,
  gainPop,
  feverGauge,
  feverActive,
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
  laneItems: LaneItem[];
  laneTargetId: number | null;
  targetItem: LaneItem | null;
  laneView: { hiragana: string; completed: string; remained: string };
  onItemExpire: (id: number) => void;
  gainPop: { id: number; text: string } | null;
  feverGauge: number;
  feverActive: boolean;
}) => (
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

    <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {(missionName || missionDesc) && (
        <div>
          {missionName && (
            <div style={{ fontSize: 11, color: DEV.green, fontWeight: 700 }}>{missionName}</div>
          )}
          {missionDesc && (
            <span style={{ fontSize: 15, color: DEV.cream, fontWeight: 700, marginLeft: 8 }}>{missionDesc}</span>
          )}
        </div>
      )}

      {/* v0.15 出現レーン：バグ/ボーナス/イベントが右→左へ流れる（常時同じ高さ＝ずれない） */}
      <div
        style={{
          position: 'relative',
          height: 56,
          overflow: 'hidden',
          background: 'repeating-linear-gradient(90deg, #0a1006 0 24px, #0c1207 24px 48px)',
          border: `2px solid ${DEV.panelBorder}`,
        }}
      >
        {laneItems.length === 0 && (
          <span
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 11,
              color: '#3f5226',
            }}
          >
            開発は順調…（バグ・ひらめきが流れてきたら Space で対応）
          </span>
        )}
        {laneItems.map((item) => (
          <div
            key={item.id}
            className={`lane-item ${item.kind === 'bug' || item.kind === 'critical-bug' ? 'lane-item-bug' : ''}`}
            onAnimationEnd={(e) => {
              // 横断アニメ終了＝期限切れ（バグの這い揺れ infinite は無視）
              if (e.animationName === 'lane-cross-kf') onItemExpire(item.id);
            }}
            style={{
              animationDuration:
                item.kind === 'bug' || item.kind === 'critical-bug'
                  ? `${item.lifeMs}ms, 400ms`
                  : `${item.lifeMs}ms`,
              border: `2px solid ${
                laneTargetId === item.id
                  ? '#ffd54a'
                  : item.kind === 'bonus'
                    ? DEV.greenBright
                    : '#c84a3a'
              }`,
              background: laneTargetId === item.id ? '#3a2a05' : '#11180b',
            }}
          >
            <span style={{ fontSize: 22, lineHeight: 1 }}>{item.icon}</span>
            <span style={{ fontSize: 10, color: DEV.cream, whiteSpace: 'nowrap' }}>
              {item.label}
            </span>
          </div>
        ))}
        <span
          style={{
            position: 'absolute',
            right: 6,
            top: 4,
            fontSize: 10,
            color: DEV.sub,
            background: 'rgba(5,8,12,0.7)',
            padding: '1px 6px',
          }}
        >
          [Space] 対象切替
        </span>
      </div>

      <div style={{ position: 'relative' }}>
        <div style={{ fontSize: 11, color: DEV.green, fontWeight: 700, marginBottom: 4 }}>
          {targetItem ? (
            <span style={{ color: DEV.orange }}>
              {targetItem.icon} {targetItem.label}に対応中！（Space でコードに戻る）
            </span>
          ) : (
            '入力する文章'
          )}
        </div>
        <div
          style={{
            background: '#0c1207',
            border: `2px solid ${targetItem ? DEV.orange : DEV.panelBorder}`,
            padding: '10px 12px',
            fontSize: 28,
            // 出現物対応中はテキスト自体をオレンジに（視線の先で伝える）
            color: targetItem ? DEV.orange : DEV.cream,
            letterSpacing: '0.04em',
            minHeight: 40,
          }}
        >
          {targetItem ? laneView.hiragana : view.hiragana}
        </div>
        {/* フレーズ完了の成果を視線の先にフロート表示（レイアウトに影響しない absolute） */}
        {gainPop && (
          <span key={gainPop.id} className="dev-gain-float">
            {gainPop.text}
          </span>
        )}
      </div>

      <div>
        <div style={{ fontSize: 11, color: DEV.green, fontWeight: 700, marginBottom: 4 }}>
          ローマ字入力
        </div>
        {(() => {
          // 対応中は出現物の入力状態を、それ以外はメインの入力状態を表示（枠の形は同一＝ずれない）
          const v = targetItem ? laneView : view;
          return (
            <div
              key={`miss-${failCount}`}
              className={failCount > 0 ? 'dev-miss-shake' : undefined}
              style={{
                background: '#0c1207',
                border: `1px solid ${targetItem ? DEV.orange : DEV.panelBorder}`,
                padding: '8px 12px',
                fontSize: 20,
                letterSpacing: '0.08em',
                minHeight: 30,
              }}
            >
              {/* 正打ジュース：最後に打った文字が一瞬光る */}
              <span style={{ color: DEV.green }}>{v.completed.slice(0, -1)}</span>
              {v.completed.length > 0 && (
                <span key={`glow-${v.completed.length}`} className="dev-key-glow">
                  {v.completed.slice(-1)}
                </span>
              )}
              <span className="dev-cursor" style={{ color: DEV.white }}>
                |
              </span>
              <span style={{ color: '#5a6e3a' }}>{v.remained}</span>
            </div>
          );
        })()}
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
              fontSize: 30,
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
        {/* フィーバーゲージ：正打で蓄積、MAX で自動発動（15 秒 進捗×2＋ボーナスラッシュ） */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {feverActive ? (
            <span className="dev-fever-text" style={{ fontSize: 13, fontWeight: 700, color: '#ff5a3c' }}>
              🔥 FEVER!! 進捗×2＋ひらめきラッシュ！
            </span>
          ) : (
            <span style={{ fontSize: 11, color: DEV.sub }}>
              フィーバーゲージ（正打で蓄積・MAXで発動）
            </span>
          )}
          <SegGauge
            pct={feverActive ? 100 : Math.min(100, (feverGauge / FEVER_MAX) * 100)}
            color={feverActive ? '#ff5a3c' : '#ffd54a'}
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

/**
 * フェーズ入場時に発生率で当たったイベントだけを積む。
 * v0.14 後期：ベース固定文（「企画書を書く」等）は廃止（効果ゼロの打鍵は意味が無い＝オーナーFB）。
 */
const buildMissionQueue = (phase: DevPhase): DevEvent[] =>
  PHASE_EVENTS[phase].filter((ev) => Math.random() < ev.rate);

/**
 * 中央：開発以外のフェーズ。
 * イベントが発生していれば入力ミッションで対応、無ければ「✓ 完了」演出で自動進行。
 */
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

  // イベント無し（or 全消化）→ 完了チャイム＋✓ を見せて自動で次フェーズへ
  useEffect(() => {
    if (cur) return;
    sfx.phase();
    const t = window.setTimeout(onAllDone, 900);
    return () => window.clearTimeout(t);
  }, [cur]);

  const resolve = (delta: AxisDelta, label2: string, ok: boolean) => {
    applyDelta(delta);
    if (ok) sfx.success();
    setLog((l) => [`${ok ? '✓' : '✕'} ${label2}：${formatAxisDelta(delta)}`, ...l].slice(0, 5));
    setI((n) => n + 1);
  };

  if (!cur) {
    return (
      <PhaseShell label={label}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
          <span style={{ fontSize: 26, fontWeight: 700, color: DEV.greenBright }}>
            ✓ {label}フェーズ 完了
          </span>
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
          onComplete={() => resolve(cur.success, cur.missionLabel, true)}
        />

        <button
          type="button"
          onClick={() => resolve(cur.fail, cur.missionLabel, false)}
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

/** フェーズ別のチームコメント候補（フレーバー。社員名と組み合わせて表示） */
const PHASE_COMMENTS: Record<DevPhase, string[]> = {
  planning: ['この企画いけそう！', '方向性が見えてきたね', 'ターゲットは誰にする？'],
  development: ['いい感じに進んでるね！', '処理がきれいにまとまった！', 'この調子でいこう！'],
  testing: ['操作感チェック中…', 'ここのバランス、どう思う？', 'テストケース消化中！'],
  debugging: ['このバグ、手強い…！', '再現手順わかったかも', 'あと少しで直せそう'],
  release: ['売上どうなるかな…！', 'SNS の反応が気になる', 'ストア公開ヨシ！'],
  complete: ['おつかれさま！', '最高のチームだった！', '次も作ろう！'],
};

/** 右カラム：チームからのコメント（アサイン社員×フェーズのフレーバー） */
const TeamComments = ({
  team,
  phase,
}: {
  team: { id: string; name: string; role: string }[];
  phase: DevPhase;
}) => {
  const comments = PHASE_COMMENTS[phase];
  if (team.length === 0) return null;
  return (
    <div style={{ ...devBox(), gap: 4 }}>
      <span style={{ fontSize: 11, color: DEV.green, fontWeight: 700 }}>チームからのコメント</span>
      {team.slice(0, 3).map((e, i) => (
        <span key={e.id} style={{ fontSize: 11, color: DEV.cream }}>
          💬 {e.name}：{comments[i % comments.length]}
        </span>
      ))}
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
  padding: 7,
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
