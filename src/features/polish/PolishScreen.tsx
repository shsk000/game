import { useMemo } from 'react';
import { useGameStore } from '../../state/gameStore';
import { getPhrases } from '../../data/genres';
import { JacketView } from '../../components/JacketView';
import { TypingPanel } from '../../components/TypingPanel';
import { ComboGauge } from '../../components/ComboGauge';
import { useTyping } from '../develop/useTyping';
import { SCALE_BY_ID } from '../../data/scales';
import { polishToQuality } from '../../utils/metascore';

export const PolishScreen = () => {
  const current = useGameStore((s) => s.current);
  const ghosts = useGameStore((s) => s.ghosts);
  const addPolishLoC = useGameStore((s) => s.addPolishLoC);
  const releaseWork = useGameStore((s) => s.releaseWork);
  const applyComboToPolish = useGameStore((s) => s.applyComboToPolish);
  const reportCombo = useGameStore((s) => s.reportCombo);

  const phrases = useMemo(() => {
    if (!current) return [];
    return getPhrases(current.genreId, 80);
  }, [current?.genreId]);

  const { view, failCount, combo } = useTyping({
    phrases,
    onPhraseComplete: () => addPolishLoC(1),
    paused: !current,
    onCorrect: (c) => {
      reportCombo(c);
      // ノリ中はポリッシュ効率に加点（最大 +0.5）
      const bonus = Math.min(0.5, c / 100);
      applyComboToPolish(bonus);
    },
  });

  if (!current) return null;

  const scaleDef = SCALE_BY_ID[current.scale];
  const projectedQ = polishToQuality(scaleDef.baseQuality, current.polishLoC, current.comboBonus);
  const developSec =
    current.finishedAt !== null ? (current.finishedAt - current.startedAt) / 1000 : 0;
  // ゴースト更新判定（完成時点で更新済みのため、ghosts[scale] === developSec の近似で判定）
  const ghostBeaten =
    ghosts[current.scale] !== null &&
    Math.abs((ghosts[current.scale] ?? 0) - developSec) < 0.001;

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
          🎉 完成！開発タイム {developSec.toFixed(2)}秒
          {ghostBeaten && <span className="ghost-update"> 🏁 ゴースト更新！</span>}
        </p>
        <div className="progress-row">
          <div className="progress-label">
            品質予感 Q {projectedQ} / 100
            {current.comboBonus > 0 && (
              <span className="combo-bonus-note"> ×{(1 + current.comboBonus).toFixed(2)}</span>
            )}
          </div>
          <div className="progress-bar">
            <div
              className="progress-fill polish-fill"
              style={{ width: `${projectedQ}%` }}
            />
          </div>
        </div>
        <ComboGauge combo={combo} />
        <div className="aux-row aux-grid">
          <span>磨いた行数: {current.polishLoC}</span>
          <span>最大コンボ: {current.maxCombo}</span>
          <span className="aux-misses">ミス: {failCount}</span>
        </div>
        <button className="primary-btn" onClick={() => releaseWork()}>
          🚀 リリースする
        </button>
        <p className="hint">磨くほどQが上がりますが、Qが高いほど上がりにくくなります（逓減）。</p>
      </section>

      <section className="card typing-card">
        <TypingPanel
          hiragana={view.hiragana}
          completed={view.completed}
          remained={view.remained}
          hint="（追加で打って品質アップ／コンボ中は効率もUP）"
        />
      </section>
    </div>
  );
};
