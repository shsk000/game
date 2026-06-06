import { useEffect, useState } from 'react';
import { ads } from '../../ads/AdProvider';
import { JacketView } from '../../components/JacketView';
import { ACHIEVEMENT_BY_ID } from '../../data/achievements';
import { compatLabel, getCompat } from '../../data/compatibility';
import { GENRE_BY_ID } from '../../data/genres';
import { THEME_BY_ID } from '../../data/themes';
import { useGameStore } from '../../state/gameStore';
import type { Achievement } from '../../state/types';
import { scoreFlavor } from '../../utils/metascore';

export const ReleaseScreen = () => {
  const work = useGameStore((s) => s.lastReleased);
  const goTo = useGameStore((s) => s.goTo);
  const clearNewlyAchieved = useGameStore((s) => s.clearNewlyAchieved);

  const [displayScore, setDisplayScore] = useState(0);
  const [phase, setPhase] = useState<'count' | 'done'>('count');
  const [launchAdApplied, setLaunchAdApplied] = useState(false);
  const [adRunning, setAdRunning] = useState(false);
  const [bonusRevenue, setBonusRevenue] = useState(0);
  const [newAchievements, setNewAchievements] = useState<Achievement[]>([]);

  useEffect(() => {
    if (!work) return;
    setDisplayScore(0);
    setPhase('count');
    setLaunchAdApplied(false);
    setBonusRevenue(0);
    setNewAchievements(useGameStore.getState().newlyAchieved);
    const target = work.metascore;
    const totalMs = 1600;
    const start = performance.now();
    let raf = 0;
    const loop = () => {
      const t = Math.min(1, (performance.now() - start) / totalMs);
      const eased = 1 - (1 - t) ** 3;
      setDisplayScore(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(loop);
      else setPhase('done');
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [work?.id]);

  if (!work) return null;

  const genre = GENRE_BY_ID[work.genreId];
  const theme = THEME_BY_ID[work.themeId];
  const compat = getCompat(work.genreId, work.themeId);

  const runLaunchAd = () => {
    if (launchAdApplied || adRunning) return;
    setAdRunning(true);
    ads.showRewarded({
      label: 'launch-ad',
      onComplete: () => {
        const extra = Math.round(work.initialRevenue * 0.5);
        // 直接 store を編集せず売上補填のみ加算
        setBonusRevenue(extra);
        setLaunchAdApplied(true);
        setAdRunning(false);
        // 資金/累計売上にも反映（簡易：releaseWork は済んでいるのでここで上乗せ）
        const s = useGameStore.getState();
        useGameStore.setState({
          funds: s.funds + extra,
          lifetimeRevenue: s.lifetimeRevenue + extra,
        });
      },
      onFail: () => setAdRunning(false),
    });
  };

  const handleNext = () => {
    clearNewlyAchieved();
    goTo('office');
  };

  return (
    <div className="screen release-screen">
      <header className="topbar">
        <h1>📰 リリース</h1>
      </header>

      <section className="card release-card">
        <JacketView genreId={work.genreId} themeId={work.themeId} title={work.title} size="lg" />
        <div className="release-info">
          <h2>{work.title}</h2>
          <div className="release-tags">
            <span>
              {genre.emoji} {genre.name}
            </span>
            <span>×</span>
            <span>
              {theme.emoji} {theme.name}
            </span>
            {work.pioneer && <span className="pioneer-pill">🌱 新規開拓ボーナス</span>}
          </div>
          <div className={`meta-score ${work.isMasterpiece ? 'masterpiece' : ''}`}>
            <span className="meta-label">メタスコア</span>
            <span className="meta-value">{displayScore}</span>
            <span className="meta-max">/100</span>
          </div>
          {phase === 'done' && (
            <>
              <div className="meta-flavor">『{scoreFlavor(work.metascore)}』</div>
              {work.isMasterpiece && <div className="masterpiece-badge">🌟 神ゲー認定！</div>}
              {work.ghostBeaten && <div className="ghost-update-badge">🏁 ゴースト記録更新！</div>}
              {newAchievements.length > 0 && (
                <div className="achievement-badge-stack">
                  {newAchievements.map((a) => {
                    const def = ACHIEVEMENT_BY_ID[a];
                    return (
                      <div key={a} className="achievement-badge">
                        🏆 実績解除 {def.emoji} {def.name}
                      </div>
                    );
                  })}
                </div>
              )}
              <ul className="release-stats">
                <li>品質 Q {work.quality}</li>
                <li>
                  相性 {compatLabel(compat)} ({compat.toFixed(2)}x)
                </li>
                <li>開発タイム {work.developSec.toFixed(2)}秒</li>
                <li>👥 ファン +{work.fansGained}</li>
                <li className="revenue">
                  💰 初動売上 ¥{(work.initialRevenue + bonusRevenue).toLocaleString()}
                  {bonusRevenue > 0 && (
                    <span className="revenue-bonus"> (+¥{bonusRevenue.toLocaleString()})</span>
                  )}
                </li>
                <li className="sales-pool">
                  📦 販売プール ¥{work.salesPool.toLocaleString()}
                  <span className="sales-pool-note">（残りはオフィスで時間経過で売れる）</span>
                </li>
              </ul>

              <div className="ad-block">
                {launchAdApplied ? (
                  <p className="ad-applied">✅ ローンチ広告キャンペーン適用済（売上 ×1.5）</p>
                ) : (
                  <button className="primary-btn ad-btn" disabled={adRunning} onClick={runLaunchAd}>
                    {adRunning ? '広告再生中…' : '📺 広告を見て売上 +50%（ローンチキャンペーン）'}
                  </button>
                )}
              </div>

              <button className="primary-btn" onClick={handleNext}>
                次へ（オフィス）
              </button>
            </>
          )}
        </div>
      </section>
    </div>
  );
};
