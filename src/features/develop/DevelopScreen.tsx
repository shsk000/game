import { useEffect, useMemo, useRef, useState } from 'react';
import { ads } from '../../ads/AdProvider';
import { CodeEditor } from '../../components/CodeEditor';
import { ComboGauge } from '../../components/ComboGauge';
import { GhostBar } from '../../components/GhostBar';
import { JacketView } from '../../components/JacketView';
import { TypingPanel } from '../../components/TypingPanel';
import { buildLine } from '../../data/codeSnippets';
import { getPhrases } from '../../data/genres';
import { trendLabel, trendMultiplier } from '../../data/trend';
import { useGameStore } from '../../state/gameStore';
import { useTyping } from './useTyping';

const ROLE_LABEL: Record<string, string> = {
  programmer: 'プログラマー',
  designer: 'デザイナー',
  pr: '広報',
};

export const DevelopScreen = () => {
  const current = useGameStore((s) => s.current);
  const ghosts = useGameStore((s) => s.ghosts);
  const employees = useGameStore((s) => s.employees);
  const trend = useGameStore((s) => s.trend);
  const tickAuto = useGameStore((s) => s.tickAuto);
  const addDevelopLoC = useGameStore((s) => s.addDevelopLoC);
  const finishDevelopment = useGameStore((s) => s.finishDevelopment);
  const reportCombo = useGameStore((s) => s.reportCombo);
  const reportWPM = useGameStore((s) => s.reportWPM);
  const reportAccuracy = useGameStore((s) => s.reportAccuracy);
  const triggerBugIfDue = useGameStore((s) => s.triggerBugIfDue);
  const clearBug = useGameStore((s) => s.clearBug);
  const buyAdDevBoost = useGameStore((s) => s.buyAdDevBoost);

  const [elapsed, setElapsed] = useState(0);
  const [adRunning, setAdRunning] = useState(false);
  const [codeLines, setCodeLines] = useState<string[]>([]);
  const [bugLineIdx, setBugLineIdx] = useState<number | null>(null);
  const lineCounterRef = useRef(0);

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

  // バグフレーズ発生時、最新行にバグマーク
  const bugPhrase = current?.bugPhrase ?? null;
  useEffect(() => {
    if (bugPhrase) {
      setBugLineIdx(codeLines.length > 0 ? codeLines.length - 1 : null);
    }
  }, [bugPhrase]);

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

  // 自動生産 tick
  useEffect(() => {
    if (!current) return;
    const t = setInterval(() => tickAuto(1), 1000);
    return () => clearInterval(t);
  }, [current?.scale, tickAuto]);

  // バグイベント抽選（10秒に1回）
  useEffect(() => {
    if (!current) return;
    const t = setInterval(() => triggerBugIfDue(), 10000);
    return () => clearInterval(t);
  }, [current?.scale, triggerBugIfDue]);

  useEffect(() => {
    if (!current) return;
    if (current.finishedAt === null && current.doneLoC >= current.requiredLoC) {
      finishDevelopment();
    }
  }, [current?.doneLoC, current?.requiredLoC, current?.finishedAt, finishDevelopment]);

  const assignedEmployees = useMemo(() => {
    if (!current) return [];
    const set = new Set(current.assignedEmployeeIds);
    return employees.filter((e) => set.has(e.id));
  }, [current?.assignedEmployeeIds, employees]);

  if (!current) return null;

  const progressPct = Math.min(100, (current.doneLoC / current.requiredLoC) * 100);
  const progSpeed = employees
    .filter((e) => e.role === 'programmer')
    .reduce((a, b) => a + b.power, 0);
  const boost = current.devBoostRemainingSec > 0;
  const autoRate = progSpeed * (boost ? 2 : 1);
  const tMul = trendMultiplier(trend, current.genreId, current.themeId);
  const isHot = combo >= 15;

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
      <header className="topbar">
        <h1>💻 開発中</h1>
        <div className="topbar-meta">
          <JacketView
            genreId={current.genreId}
            themeId={current.themeId}
            title={current.title}
            size="sm"
          />
        </div>
      </header>

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
