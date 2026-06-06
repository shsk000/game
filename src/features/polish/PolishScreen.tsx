import { useMemo, useState } from 'react';
import { ads } from '../../ads/AdProvider';
import { ComboGauge } from '../../components/ComboGauge';
import { JacketView } from '../../components/JacketView';
import { TypingPanel } from '../../components/TypingPanel';
import { getPhrases } from '../../data/genres';
import { SCALE_BY_ID } from '../../data/scales';
import { useGameStore } from '../../state/gameStore';
import { polishToQuality } from '../../utils/metascore';
import { useTyping } from '../develop/useTyping';

export const PolishScreen = () => {
  const current = useGameStore((s) => s.current);
  const ghosts = useGameStore((s) => s.ghosts);
  const employees = useGameStore((s) => s.employees);
  const addPolishLoC = useGameStore((s) => s.addPolishLoC);
  const releaseWork = useGameStore((s) => s.releaseWork);
  const applyComboToPolish = useGameStore((s) => s.applyComboToPolish);
  const reportCombo = useGameStore((s) => s.reportCombo);
  const buyAdPolishBoost = useGameStore((s) => s.buyAdPolishBoost);

  const [adRunning, setAdRunning] = useState(false);

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
      const bonus = Math.min(0.5, c / 100);
      applyComboToPolish(bonus);
    },
  });

  if (!current) return null;

  const scaleDef = SCALE_BY_ID[current.scale];
  const designerBonus = employees
    .filter((e) => e.role === 'designer')
    .reduce((a, b) => a + b.power, 0);
  const projectedQ = polishToQuality(
    scaleDef.baseQuality,
    current.polishLoC,
    current.comboBonus,
    designerBonus,
  );
  const developSec =
    current.finishedAt !== null ? (current.finishedAt - current.startedAt) / 1000 : 0;
  const ghostBeaten =
    ghosts[current.scale] !== null && Math.abs((ghosts[current.scale] ?? 0) - developSec) < 0.001;
  const polishBoost = current.polishBoostRemainingSec > 0;

  const runPolishBoost = () => {
    if (adRunning || polishBoost) return;
    setAdRunning(true);
    ads.showRewarded({
      label: 'polish-boost',
      onComplete: () => {
        buyAdPolishBoost();
        setAdRunning(false);
      },
      onFail: () => setAdRunning(false),
    });
  };

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
            {designerBonus > 0 && (
              <span className="designer-bonus-note"> +デザイナー{designerBonus}</span>
            )}
            {polishBoost && (
              <span className="ad-active-note">
                {' '}
                📺×2 残{Math.ceil(current.polishBoostRemainingSec)}s
              </span>
            )}
          </div>
          <div className="progress-bar">
            <div className="progress-fill polish-fill" style={{ width: `${projectedQ}%` }} />
          </div>
        </div>
        <ComboGauge combo={combo} />
        <div className="aux-row aux-grid">
          <span>磨いた行数: {current.polishLoC}</span>
          <span>最大コンボ: {current.maxCombo}</span>
          <span className="aux-misses">ミス: {failCount}</span>
        </div>
        <div className="ad-block">
          <button
            className="link-btn ad-btn"
            disabled={adRunning || polishBoost}
            onClick={runPolishBoost}
          >
            {polishBoost
              ? `📺 ポリッシュ効率2倍（残${Math.ceil(current.polishBoostRemainingSec)}s）`
              : adRunning
                ? '広告再生中…'
                : '📺 広告でポリッシュ効率2倍（30秒）'}
          </button>
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
