import { useEffect, useMemo, useRef, useState } from 'react';
import { ads } from '../../ads/AdProvider';
import { CodeEditor } from '../../components/CodeEditor';
import { ComboGauge } from '../../components/ComboGauge';
import { GhostBar } from '../../components/GhostBar';
import { JacketView } from '../../components/JacketView';
import { TypingPanel } from '../../components/TypingPanel';
import { PixelStatusBar } from '../../components/ui';
import { buildLine } from '../../data/codeSnippets';
import { getPhrases } from '../../data/genres';
import { SCALE_BY_ID } from '../../data/scales';
import { trendLabel, trendMultiplier } from '../../data/trend';
import { useGameStore } from '../../state/gameStore';
import { addWeeks, compareDate, dateToWeekIndex, type GameDate } from '../../state/types';
import { formatWeeks } from '../../utils/format';
import { useTyping } from './useTyping';

const ROLE_LABEL: Record<string, string> = {
  programmer: 'プログラマー',
  designer: 'デザイナー',
  pr: '広報',
};

type Toast = { id: number; text: string; tone: 'warn' | 'good' | 'info' };

export const DevelopScreen = () => {
  const current = useGameStore((s) => s.current);
  const ghosts = useGameStore((s) => s.ghosts);
  const employees = useGameStore((s) => s.employees);
  const trend = useGameStore((s) => s.trend);
  const currentDate = useGameStore((s) => s.currentDate);
  const lastFixedCost = useGameStore((s) => s.lastFixedCost);
  const tickWeek = useGameStore((s) => s.tickWeek);
  const addDevelopLoC = useGameStore((s) => s.addDevelopLoC);
  const finishDevelopment = useGameStore((s) => s.finishDevelopment);
  const reportCombo = useGameStore((s) => s.reportCombo);
  const reportWPM = useGameStore((s) => s.reportWPM);
  const reportAccuracy = useGameStore((s) => s.reportAccuracy);
  const clearBug = useGameStore((s) => s.clearBug);
  const buyAdDevBoost = useGameStore((s) => s.buyAdDevBoost);

  const [elapsed, setElapsed] = useState(0);
  const [adRunning, setAdRunning] = useState(false);
  const [codeLines, setCodeLines] = useState<string[]>([]);
  const [bugLineIdx, setBugLineIdx] = useState<number | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const lineCounterRef = useRef(0);
  // 開発開始時点の日付。経過週数・必要週数の計算に使う
  const startDateRef = useRef<GameDate | null>(null);
  const projectScale = current?.scale;

  const pushToast = (text: string, tone: Toast['tone']) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, text, tone }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2000);
  };

  const phrases = useMemo(() => {
    if (!current) return [];
    return getPhrases(current.genreId, current.requiredLoC * 3);
  }, [current?.genreId, current?.requiredLoC]);

  // バグフレーズが乗っているときはそれを最優先に挿入
  const effectivePhrases = useMemo(() => {
    if (!current?.bugPhrase) return phrases;
    return [current.bugPhrase, ...phrases];
  }, [phrases, current?.bugPhrase]);

  const genreId = current?.genreId;
  const themeId = current?.themeId;

  const { view, failCount, combo, wpm } = useTyping({
    phrases: effectivePhrases,
    onPhraseComplete: () => {
      if (current?.bugPhrase) {
        addDevelopLoC(3); // バグ修正は3LoC相当
        clearBug();
        setBugLineIdx(null);
      } else {
        addDevelopLoC(1);
      }
      if (genreId && themeId) {
        const idx = lineCounterRef.current;
        lineCounterRef.current += 1;
        const line = buildLine({ genreId, themeId, idx });
        setCodeLines((prev) => [...prev, line]);
      }
    },
    paused: !current || current.finishedAt !== null,
    onCorrect: (c) => reportCombo(c),
    onWpm: (w) => reportWPM(w),
    onAccuracy: (a) => reportAccuracy(a),
  });

  // バグフレーズ発生時、最新行にバグマーク + 「+1 週」テロップ
  const bugPhrase = current?.bugPhrase ?? null;
  useEffect(() => {
    if (bugPhrase) {
      setBugLineIdx(codeLines.length > 0 ? codeLines.length - 1 : null);
      // バグは「開発が +1 週遅延」する想定。tickWeek を 1 回追加発火
      tickWeek();
      pushToast('🐛 バグ発生：+1 週', 'warn');
    }
  }, [bugPhrase, tickWeek]);

  // プロジェクトが切り替わったら開始日付・経過状態をリセット
  useEffect(() => {
    if (!current) {
      startDateRef.current = null;
      lineCounterRef.current = 0;
      setCodeLines([]);
      setBugLineIdx(null);
      setToasts([]);
    } else if (startDateRef.current === null) {
      startDateRef.current = currentDate;
    }
  }, [projectScale, current, currentDate]);

  // 月初固定費の発生をテロップに変換
  const lastFixedCostTotal = lastFixedCost?.total ?? null;
  useEffect(() => {
    if (lastFixedCostTotal === null) return;
    pushToast(`💸 月初固定費 -¥${lastFixedCostTotal.toLocaleString()}`, 'warn');
  }, [lastFixedCostTotal]);

  // v0.10 仕上げ：WPM ショートカット（-1/-2/-3 週）は廃止。
  //   設計（balance-design §1-3）で「タイピングは指定期間中ずっと打ち続けるもの」と定義。
  //   時間ベース完了と組み合わせると数語で完了してしまう（B-Crit-2 再発）ので削除。
  //   早く打てた場合は WPM 記録としてリリース時の品質（performance）寄与に反映される。

  const startedAt = current?.startedAt ?? null;
  useEffect(() => {
    if (startedAt === null) return;
    let raf = 0;
    const loop = () => {
      setElapsed((performance.now() - startedAt) / 1000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [startedAt]);

  // v0.10：週進行の進捗（ゲーム内時間）— 完了判定 useEffect から参照されるため先に算出。
  const scaleDef = current ? SCALE_BY_ID[current.scale] : null;
  const shortcutWeeks = (current?.timeShortcutsUnlocked ?? []).reduce((sum, wpm) => {
    if (wpm >= 200) return sum + 3;
    if (wpm >= 150) return sum + 2;
    if (wpm >= 100) return sum + 1;
    return sum;
  }, 0);
  const neededWeeks = scaleDef ? Math.max(1, scaleDef.neededWeeks - shortcutWeeks) : 1;
  const startDate = startDateRef.current ?? currentDate;
  const elapsedWeeks = Math.max(0, dateToWeekIndex(currentDate) - dateToWeekIndex(startDate));

  // v0.10 仕上げ T-3：自動 LoC tick / 時間進行 / バグ抽選は <GlobalTicker /> に移譲。
  // ここでは「開発完了判定」のみ責任を持つ。
  //
  // v0.10 仕上げ T-4：完了判定を時間ベースに変更。
  // 旧仕様：`doneLoC >= requiredLoC` で即完了 → 速い人だと 5 秒で 1 本完成（B-Crit-2）
  // 新仕様：`elapsedWeeks >= neededWeeks` で完了（時間ベース）
  // タイピングは「指定された開発期間中ずっと打ち続けるもの」として位置付け、
  // doneLoC は進捗の副指標に降格（達成しても自動完了しない）。
  useEffect(() => {
    if (!current) return;
    if (current.finishedAt !== null) return;
    if (elapsedWeeks >= neededWeeks) {
      finishDevelopment();
    }
  }, [current, elapsedWeeks, neededWeeks, finishDevelopment]);

  const assignedEmployees = useMemo(() => {
    if (!current) return [];
    const set = new Set(current.assignedEmployeeIds);
    return employees.filter((e) => set.has(e.id));
  }, [current?.assignedEmployeeIds, employees]);

  if (!current || !scaleDef) return null;

  const progressPct = Math.min(100, (current.doneLoC / current.requiredLoC) * 100);
  const progSpeed = employees
    .filter((e) => e.role === 'programmer')
    .reduce((a, b) => a + b.power, 0);
  const boost = current.devBoostRemainingSec > 0;
  const autoRate = progSpeed * (boost ? 2 : 1);
  const tMul = trendMultiplier(trend, current.genreId, current.themeId);
  const isHot = combo >= 15;

  const weekPct = Math.min(100, (elapsedWeeks / Math.max(1, neededWeeks)) * 100);
  const dueDate = addWeeks(startDate, neededWeeks);
  const overdue = compareDate(currentDate, dueDate) > 0;

  const runDevBoost = () => {
    if (adRunning || boost) return;
    setAdRunning(true);
    ads.showRewarded({
      label: 'dev-boost',
      onComplete: () => {
        buyAdDevBoost();
        setAdRunning(false);
      },
      onFail: () => setAdRunning(false),
    });
  };

  return (
    <div className={`screen develop-screen ${isHot ? 'is-hot' : ''}`}>
      {/* v0.11 L4：上部 HUD は PixelStatusBar に統合（日付+進捗込み）。
       *  さらに「📅 経過/予定週数」「⚠期日超過」を追加表示する細い帯を下に置く。 */}
      <PixelStatusBar />
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          padding: '6px 16px',
          height: 32,
          background: '#3a2a1e',
          color: '#fff8e0',
          fontSize: 12,
          borderBottom: '2px solid #1a0f08',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <JacketView
            genreId={current.genreId}
            themeId={current.themeId}
            title={current.title}
            size="sm"
          />
          <span style={{ fontWeight: 700 }}>💻 {current.title}</span>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontVariantNumeric: 'tabular-nums',
            color: overdue ? '#ff8888' : '#fff8e0',
          }}
        >
          <span>
            経過 {elapsedWeeks} 週 / 予定 {neededWeeks} 週（{formatWeeks(neededWeeks)}）
          </span>
          {overdue && <span style={{ color: '#ff5555', fontWeight: 700 }}>⚠ 期日超過</span>}
          <div
            role="progressbar"
            aria-label="開発期間プログレス"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(weekPct)}
            style={{
              width: 120,
              height: 8,
              background: '#0d0805',
              border: '2px solid #1a0f08',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${weekPct}%`,
                height: '100%',
                background: overdue ? '#a02828' : '#f5c84a',
                transition: 'width 200ms linear',
              }}
            />
          </div>
          {/* v0.11：開発中断ボタン（オフィスへ戻る） */}
          <button
            type="button"
            onClick={() => {
              if (confirm('開発を中断してオフィスに戻りますか？\n（進捗は失われます）')) {
                useGameStore.setState({ current: null, screen: 'office' });
              }
            }}
            style={{
              padding: '4px 10px',
              background: '#a02828',
              color: '#fff8e0',
              border: '2px solid #1a0f08',
              fontFamily: 'inherit',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
              imageRendering: 'pixelated',
              marginLeft: 8,
            }}
            aria-label="開発を中断してオフィスに戻る"
          >
            🚪 中断
          </button>
        </div>
      </div>

      {/* テロップ（バグ・固定費） */}
      {toasts.length > 0 && (
        <div
          aria-live="polite"
          style={{
            position: 'fixed',
            top: 80,
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
                background:
                  t.tone === 'warn' ? '#a02828' : t.tone === 'good' ? '#308040' : '#3a2a1e',
                color: '#fff8e0',
                border: '3px solid #1a0f08',
                boxShadow: '3px 3px 0 rgba(0,0,0,0.4)',
                fontWeight: 700,
                fontSize: 13,
                letterSpacing: '0.06em',
              }}
            >
              {t.text}
            </div>
          ))}
        </div>
      )}

      {assignedEmployees.length > 0 && (
        <section className="card assigned-strip">
          <div className="chip-row">
            {assignedEmployees.map((e) => (
              <span key={e.id} className="chip">
                👤 {e.name}（{ROLE_LABEL[e.role] ?? e.role}）
              </span>
            ))}
          </div>
        </section>
      )}

      <div className="develop-2col">
        <div>
          <section className="card progress-card">
            <div className="progress-row">
              <div className="progress-label">
                進捗 {current.doneLoC.toFixed(1)} / {current.requiredLoC} LoC
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${progressPct}%` }} />
              </div>
            </div>
            <GhostBar elapsedSec={elapsed} ghostSec={ghosts[current.scale]} />
            <ComboGauge combo={combo} />
            <div className="aux-row aux-grid">
              <span>WPM: {Math.round(wpm)}</span>
              <span>最大コンボ: {current.maxCombo}</span>
              <span className="aux-misses">ミス: {failCount}</span>
              {autoRate > 0 && (
                <span>
                  👥 自動生産: {autoRate.toFixed(1)} LoC/秒
                  {boost && ` 📺×2 残${Math.ceil(current.devBoostRemainingSec)}s`}
                </span>
              )}
              {tMul > 1 && <span className="aux-trend">📈 トレンド合致 ×{tMul.toFixed(1)}</span>}
            </div>
            {trend && <div className="aux-row trend-line">今月のトレンド: {trendLabel(trend)}</div>}
            <div className="ad-block">
              <button
                className="link-btn ad-btn"
                disabled={adRunning || boost}
                onClick={runDevBoost}
              >
                {boost
                  ? `📺 加速中（残${Math.ceil(current.devBoostRemainingSec)}秒）`
                  : adRunning
                    ? '広告再生中…'
                    : '📺 広告で開発加速（30秒・自動生産×2）'}
              </button>
            </div>
          </section>

          {current.bugPhrase && (
            <section className="card bug-card">
              <h2>🐛 緊急バグ発生！</h2>
              <p className="bug-msg">下のフレーズを打ち切れば +3 LoC 修正！</p>
            </section>
          )}

          <section className="card typing-card">
            <TypingPanel
              hiragana={view.hiragana}
              completed={view.completed}
              remained={view.remained}
            />
          </section>
          <p className="hint">物理キーボードで打鍵してください（日本語IMEはOFF）</p>
        </div>

        <div>
          <CodeEditor lines={codeLines} bugLineIdx={bugLineIdx} mode="develop" />
        </div>
      </div>
    </div>
  );
};
