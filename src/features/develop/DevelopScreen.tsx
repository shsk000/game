import { useEffect, useMemo, useState } from 'react';
import { useGameStore } from '../../state/gameStore';
import { getPhrases } from '../../data/genres';
import { JacketView } from '../../components/JacketView';
import { TypingPanel } from '../../components/TypingPanel';
import { GhostBar } from '../../components/GhostBar';
import { useTyping } from './useTyping';

export const DevelopScreen = () => {
  const current = useGameStore((s) => s.current);
  const ghosts = useGameStore((s) => s.ghosts);
  const employees = useGameStore((s) => s.employees);
  const tickEmployees = useGameStore((s) => s.tickEmployees);
  const addDevelopLoC = useGameStore((s) => s.addDevelopLoC);
  const finishDevelopment = useGameStore((s) => s.finishDevelopment);

  const [elapsed, setElapsed] = useState(0);

  const phrases = useMemo(() => {
    if (!current) return [];
    return getPhrases(current.genreId, current.requiredLoC * 3);
  }, [current?.genreId, current?.requiredLoC]);

  const { view, failCount } = useTyping({
    phrases,
    onPhraseComplete: () => addDevelopLoC(1),
    paused: !current || current.finishedAt !== null,
  });

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

  useEffect(() => {
    if (!current) return;
    if (employees <= 0 && !current.adBoostActive) return;
    const t = setInterval(() => tickEmployees(1), 1000);
    return () => clearInterval(t);
  }, [current?.scale, current?.adBoostActive, employees, tickEmployees]);

  useEffect(() => {
    if (!current) return;
    if (current.finishedAt === null && current.doneLoC >= current.requiredLoC) {
      finishDevelopment();
    }
  }, [current?.doneLoC, current?.requiredLoC, current?.finishedAt, finishDevelopment]);

  if (!current) return null;

  const progressPct = Math.min(100, (current.doneLoC / current.requiredLoC) * 100);
  const autoRate = employees * 0.5 + (current.adBoostActive ? 0.5 : 0);

  return (
    <div className="screen develop-screen">
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
        {autoRate > 0 && (
          <div className="aux-row">
            👥 自動生産: {autoRate.toFixed(1)} LoC/秒
            {current.adBoostActive && ' (📺 広告ブースト中)'}
          </div>
        )}
        <div className="aux-row aux-misses">ミス: {failCount}</div>
      </section>

      <section className="card typing-card">
        <TypingPanel
          hiragana={view.hiragana}
          completed={view.completed}
          remained={view.remained}
        />
      </section>
      <p className="hint">物理キーボードで打鍵してください（日本語IMEはOFF）</p>
    </div>
  );
};
