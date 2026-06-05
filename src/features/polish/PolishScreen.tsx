import { useMemo } from 'react';
import { useGameStore } from '../../state/gameStore';
import { getPhrases } from '../../data/genres';
import { JacketView } from '../../components/JacketView';
import { TypingPanel } from '../../components/TypingPanel';
import { useTyping } from '../develop/useTyping';
import { SCALE_BY_ID } from '../../data/scales';
import { polishToQuality } from '../../utils/metascore';

export const PolishScreen = () => {
  const current = useGameStore((s) => s.current);
  const addPolishLoC = useGameStore((s) => s.addPolishLoC);
  const releaseWork = useGameStore((s) => s.releaseWork);

  const phrases = useMemo(() => {
    if (!current) return [];
    return getPhrases(current.genreId, 40);
  }, [current?.genreId]);

  const { view, failCount } = useTyping({
    phrases,
    onPhraseComplete: () => addPolishLoC(1),
    paused: !current,
  });

  if (!current) return null;

  const scaleDef = SCALE_BY_ID[current.scale];
  const projectedQ = polishToQuality(scaleDef.baseQuality, current.polishLoC);
  const developSec =
    current.finishedAt !== null ? (current.finishedAt - current.startedAt) / 1000 : 0;

  return (
    <div className="screen polish-screen">
      <header className="topbar">
        <h1>✨ ポリッシュ中</h1>
        <div className="topbar-meta">
          <JacketView
            genreId={current.genreId}
            themeId={current.themeId}
            title={current.title}
            size="sm"
          />
        </div>
      </header>

      <section className="card">
        <p className="completed-msg">
          🎉 完成！開発タイム {developSec.toFixed(2)}秒。打った分だけ品質が上がります。
        </p>
        <div className="progress-row">
          <div className="progress-label">品質予感 Q {projectedQ} / 100</div>
          <div className="progress-bar">
            <div
              className="progress-fill polish-fill"
              style={{ width: `${projectedQ}%` }}
            />
          </div>
        </div>
        <div className="aux-row">磨いた行数: {current.polishLoC} ／ ミス: {failCount}</div>
        <button className="primary-btn" onClick={() => releaseWork()}>
          🚀 リリースする
        </button>
      </section>

      <section className="card typing-card">
        <TypingPanel
          hiragana={view.hiragana}
          completed={view.completed}
          remained={view.remained}
          hint="（追加で打って品質アップ）"
        />
      </section>
    </div>
  );
};
