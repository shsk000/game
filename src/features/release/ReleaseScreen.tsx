import { useEffect, useRef, useState } from 'react';
import { ads } from '../../ads/AdProvider';
import { JacketView } from '../../components/JacketView';
import { PixelWindow } from '../../components/ui';
import { ACHIEVEMENT_BY_ID } from '../../data/achievements';
import { compatLabel, getCompat } from '../../data/compatibility';
import { GENRE_BY_ID } from '../../data/genres';
import { SCALE_BY_ID } from '../../data/scales';
import { THEME_BY_ID } from '../../data/themes';
import { useGameStore } from '../../state/gameStore';
import type { Achievement } from '../../state/types';
import { formatRoi, formatYen } from '../../utils/format';
import { scoreFlavor } from '../../utils/metascore';

type RevealStage =
  | 'pre-ads'
  | 'reveal-base'
  | 'reveal-categories'
  | 'reveal-employees'
  | 'reveal-performance'
  | 'reveal-ads'
  | 'reveal-variance'
  | 'reveal-total'
  | 'done';

const STAGE_SEQUENCE: RevealStage[] = [
  'reveal-base',
  'reveal-categories',
  'reveal-employees',
  'reveal-performance',
  'reveal-ads',
  'reveal-variance',
  'reveal-total',
  'done',
];

const stageReached = (current: RevealStage, target: RevealStage): boolean => {
  const order: RevealStage[] = ['pre-ads', ...STAGE_SEQUENCE];
  return order.indexOf(current) >= order.indexOf(target);
};

export const ReleaseScreen = () => {
  const work = useGameStore((s) => s.lastReleased);
  const current = useGameStore((s) => s.current);
  const releaseWork = useGameStore((s) => s.releaseWork);
  const goTo = useGameStore((s) => s.goTo);
  const clearNewlyAchieved = useGameStore((s) => s.clearNewlyAchieved);

  const [stage, setStage] = useState<RevealStage>('pre-ads');
  const [displayQ, setDisplayQ] = useState(0);
  const [displayMeta, setDisplayMeta] = useState(0);
  const [marketingApplied, setMarketingApplied] = useState(false);
  const [debugApplied, setDebugApplied] = useState(false);
  const [launchAdApplied, setLaunchAdApplied] = useState(false);
  const [adRunning, setAdRunning] = useState<null | 'marketing' | 'debug' | 'launch'>(null);
  const [bonusRevenue, setBonusRevenue] = useState(0);
  const [newAchievements, setNewAchievements] = useState<Achievement[]>([]);
  const timersRef = useRef<number[]>([]);

  // 開発完了直後（lastReleased がまだ無く current が残っている）は ad ピッカーを表示
  useEffect(() => {
    if (!work && current) {
      setStage('pre-ads');
      setMarketingApplied(false);
      setDebugApplied(false);
      setLaunchAdApplied(false);
      setBonusRevenue(0);
      setDisplayQ(0);
      setDisplayMeta(0);
    }
  }, [work, current]);

  // work が確定したらブレイクダウン演出を順次再生
  // ただし current がまだ残っている＝ユーザーがまだ「結果を発表」を押していない状態では発火させない
  // （前回作のリリース直後に新作開発を完了した場合、lastReleased には前回作が残っているため
  //  そのままだと前回作のreveal演出が再生され、新作の pre-ads 画面が出ない問題への対策）
  useEffect(() => {
    if (!work) return;
    if (current) return;
    setNewAchievements(useGameStore.getState().newlyAchieved);
    setStage('reveal-base');
    setDisplayQ(work.breakdown.base);

    const timers: number[] = [];
    const schedule = (ms: number, fn: () => void) => {
      timers.push(window.setTimeout(fn, ms));
    };

    schedule(400, () => {
      setStage('reveal-categories');
      setDisplayQ((q) => q + work.breakdown.categories);
    });
    schedule(900, () => {
      setStage('reveal-employees');
      setDisplayQ((q) => q + work.breakdown.employees);
    });
    schedule(1400, () => {
      setStage('reveal-performance');
      setDisplayQ((q) => q + work.breakdown.performance);
    });
    schedule(1900, () => {
      setStage('reveal-ads');
      setDisplayQ((q) => q + work.breakdown.ads);
    });
    schedule(2400, () => {
      setStage('reveal-variance');
      setDisplayQ((q) => q + work.breakdown.variance);
    });
    schedule(2900, () => {
      setStage('reveal-total');
    });
    schedule(3400, () => {
      // メタスコアのカウントアップ
      const target = work.metascore;
      const start = performance.now();
      const totalMs = 900;
      let raf = 0;
      const loop = () => {
        const t = Math.min(1, (performance.now() - start) / totalMs);
        const eased = 1 - (1 - t) ** 3;
        setDisplayMeta(Math.round(target * eased));
        if (t < 1) raf = requestAnimationFrame(loop);
        else setStage('done');
      };
      raf = requestAnimationFrame(loop);
      timers.push(raf);
    });

    timersRef.current = timers;
    return () => {
      for (const t of timers) {
        window.clearTimeout(t);
      }
    };
  }, [work?.id, current]);

  if (!work && !current) return null;

  // pre-ads 段階は「いま開発を終えたばかりの作品」を表示するため current 優先。
  // それ以外（既にreleaseWork済み）は work を表示する。
  const showCurrent = stage === 'pre-ads' && !!current;
  const planGenreId = showCurrent ? current?.genreId : (work?.genreId ?? current?.genreId);
  const planThemeId = showCurrent ? current?.themeId : (work?.themeId ?? current?.themeId);
  const planTitle = showCurrent ? (current?.title ?? '') : (work?.title ?? current?.title ?? '');
  if (!planGenreId || !planThemeId) return null;
  const genre = GENRE_BY_ID[planGenreId];
  const theme = THEME_BY_ID[planThemeId];
  const compat = getCompat(planGenreId, planThemeId);

  const runMarketingAd = () => {
    if (marketingApplied || adRunning) return;
    setAdRunning('marketing');
    ads.showRewarded({
      label: 'marketing-ad',
      onComplete: () => {
        setMarketingApplied(true);
        setAdRunning(null);
      },
      onFail: () => setAdRunning(null),
    });
  };

  const runDebugAd = () => {
    if (debugApplied || adRunning) return;
    setAdRunning('debug');
    ads.showRewarded({
      label: 'debug-ad',
      onComplete: () => {
        setDebugApplied(true);
        setAdRunning(null);
      },
      onFail: () => setAdRunning(null),
    });
  };

  const revealResults = () => {
    if (adRunning) return;
    releaseWork({ marketingAd: marketingApplied, debugAd: debugApplied });
  };

  const runLaunchAd = () => {
    if (!work || launchAdApplied || adRunning) return;
    setAdRunning('launch');
    ads.showRewarded({
      label: 'launch-ad',
      onComplete: () => {
        const extra = Math.round(work.initialRevenue * 0.5);
        setBonusRevenue(extra);
        setLaunchAdApplied(true);
        setAdRunning(null);
        const s = useGameStore.getState();
        useGameStore.setState({
          funds: s.funds + extra,
          lifetimeRevenue: s.lifetimeRevenue + extra,
        });
      },
      onFail: () => setAdRunning(null),
    });
  };

  const handleNext = () => {
    clearNewlyAchieved();
    goTo('office');
  };

  // pre-ads 段階の表示
  if (stage === 'pre-ads' || !work) {
    return (
      <div className="screen release-screen">
        <header className="topbar">
          <h1>📰 リリース</h1>
        </header>
        <section className="card release-card">
          <JacketView genreId={planGenreId} themeId={planThemeId} title={planTitle} size="lg" />
          <div className="release-info">
            <h2>{planTitle}</h2>
            <div className="release-tags">
              <span>
                {genre.emoji} {genre.name}
              </span>
              <span>×</span>
              <span>
                {theme.emoji} {theme.name}
              </span>
            </div>
            <p className="meta-flavor">発売前に広告でブーストできます。</p>
            <div className="ad-row">
              <button
                className="primary-btn ad-btn"
                disabled={marketingApplied || adRunning !== null}
                onClick={runMarketingAd}
              >
                {marketingApplied
                  ? '✅ マーケティング適用済 (+5 カテゴリ)'
                  : adRunning === 'marketing'
                    ? '広告再生中…'
                    : '📺 マーケティング広告 +5 カテゴリ'}
              </button>
              <button
                className="primary-btn ad-btn"
                disabled={debugApplied || adRunning !== null}
                onClick={runDebugAd}
              >
                {debugApplied
                  ? '✅ デバッグチーム適用済 (+5 パフォ)'
                  : adRunning === 'debug'
                    ? '広告再生中…'
                    : '📺 デバッグチーム広告 +5 パフォーマンス'}
              </button>
            </div>
            <button className="primary-btn" disabled={adRunning !== null} onClick={revealResults}>
              🎬 結果を発表
            </button>
          </div>
        </section>
      </div>
    );
  }

  // ブレイクダウン演出後の表示
  const total =
    work.breakdown.base +
    work.breakdown.categories +
    work.breakdown.employees +
    work.breakdown.performance +
    work.breakdown.ads +
    work.breakdown.variance;
  const isDone = stage === 'done';

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

          <div className="breakdown-list">
            {stageReached(stage, 'reveal-base') && (
              <div className="breakdown-row">
                <span className="breakdown-emoji">🧱</span>
                <span className="breakdown-label">ベース</span>
                <span className="breakdown-value">{work.breakdown.base}</span>
              </div>
            )}
            {stageReached(stage, 'reveal-categories') && (
              <div className="breakdown-row">
                <span className="breakdown-emoji">🎨</span>
                <span className="breakdown-label">カテゴリ</span>
                <span className="breakdown-value">+{work.breakdown.categories}</span>
              </div>
            )}
            {stageReached(stage, 'reveal-employees') && (
              <div className="breakdown-row">
                <span className="breakdown-emoji">👥</span>
                <span className="breakdown-label">従業員</span>
                <span className="breakdown-value">+{work.breakdown.employees}</span>
              </div>
            )}
            {stageReached(stage, 'reveal-performance') && (
              <div className="breakdown-row">
                <span className="breakdown-emoji">⚡</span>
                <span className="breakdown-label">パフォーマンス</span>
                <span className="breakdown-value">+{work.breakdown.performance}</span>
              </div>
            )}
            {stageReached(stage, 'reveal-ads') && (
              <div className="breakdown-row">
                <span className="breakdown-emoji">📺</span>
                <span className="breakdown-label">広告</span>
                <span className="breakdown-value">+{work.breakdown.ads}</span>
              </div>
            )}
            {stageReached(stage, 'reveal-variance') && (
              <div className="breakdown-row">
                <span className="breakdown-emoji">✨</span>
                <span className="breakdown-label">バリアンス</span>
                <span className="breakdown-value">
                  {work.breakdown.variance >= 0 ? '+' : ''}
                  {work.breakdown.variance}
                </span>
              </div>
            )}
            {stageReached(stage, 'reveal-total') && (
              <div className="breakdown-row breakdown-total">
                <span className="breakdown-emoji">🎯</span>
                <span className="breakdown-label">品質 Q</span>
                <span className="breakdown-value">{Math.max(0, Math.min(100, total))}</span>
              </div>
            )}
          </div>

          <div className={`meta-score ${work.isMasterpiece ? 'masterpiece' : ''}`}>
            <span className="meta-label">メタスコア</span>
            <span className="meta-value">{displayMeta}</span>
            <span className="meta-max">/100</span>
          </div>

          {isDone && (
            <>
              {work.isMasterpiece && (
                <PixelWindow variant="emphasis" style={{ marginBottom: 8 }}>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 4,
                      padding: 6,
                      background:
                        'repeating-linear-gradient(45deg,#f5c84a,#f5c84a 6px,#fff4d0 6px,#fff4d0 12px)',
                      border: '3px solid #1a0f08',
                      animation: 'godgame-flash 800ms ease-out 1',
                    }}
                  >
                    <div style={{ fontSize: 20, fontWeight: 700, color: '#a02828' }}>
                      🌟 神ゲー認定！ 🌟
                    </div>
                    <div style={{ fontSize: 12, color: '#3a2a1e' }}>
                      品質 ×1.5・売上 ×3 のジャックポット！
                    </div>
                  </div>
                </PixelWindow>
              )}
              <div className="meta-flavor">『{scoreFlavor(work.metascore)}』</div>
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
                  💰 初動売上 {formatYen(work.initialRevenue + bonusRevenue)}
                  {bonusRevenue > 0 && (
                    <span className="revenue-bonus"> (+{formatYen(bonusRevenue)})</span>
                  )}
                </li>
                <li className="sales-pool">
                  📦 販売プール {formatYen(work.salesPool)}
                  <span className="sales-pool-note">（残りはオフィスで時間経過で売れる）</span>
                </li>
              </ul>

              {/* v0.10：利益ブレイクダウン */}
              {(() => {
                const scaleDef = SCALE_BY_ID[work.scale];
                const devCost = scaleDef.baseCost;
                // 開発期間（月数）= neededWeeks / 4 を四捨五入
                const devMonths = Math.max(1, Math.round(scaleDef.neededWeeks / 4));
                const monthlyRent = scaleDef.monthlyRent;
                const fixedCostTotal = monthlyRent * devMonths;
                const projectedTotal = work.initialRevenue + bonusRevenue + work.salesPool;
                const profit = projectedTotal - devCost - fixedCostTotal;
                const roi = formatRoi(profit, devCost + fixedCostTotal);
                const positive = profit >= 0;
                return (
                  <PixelWindow
                    title="💹 利益計算（見込）"
                    variant="emphasis"
                    style={{ marginTop: 10 }}
                  >
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr auto',
                        rowGap: 4,
                        fontSize: 13,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      <span>売上見込（初動＋販売プール）</span>
                      <strong>{formatYen(projectedTotal)}</strong>
                      <span>− 開発費（{scaleDef.name}）</span>
                      <strong style={{ color: '#a02828' }}>-{formatYen(devCost)}</strong>
                      <span>
                        − 月固定費 × {devMonths} ヶ月（{formatYen(monthlyRent)}/月）
                      </span>
                      <strong style={{ color: '#a02828' }}>-{formatYen(fixedCostTotal)}</strong>
                      <span
                        style={{
                          gridColumn: '1 / 3',
                          height: 1,
                          background: '#2c1f15',
                          margin: '4px 0',
                        }}
                      />
                      <span style={{ fontWeight: 700 }}>利益見込</span>
                      <strong
                        style={{
                          color: positive ? '#308040' : '#a02828',
                          fontSize: 16,
                        }}
                      >
                        {formatYen(profit)}
                      </strong>
                      <span style={{ fontWeight: 700 }}>ROI</span>
                      <strong
                        style={{
                          color: positive ? '#308040' : '#a02828',
                        }}
                      >
                        {roi}
                      </strong>
                    </div>
                  </PixelWindow>
                );
              })()}

              <div className="ad-block">
                {launchAdApplied ? (
                  <p className="ad-applied">✅ ローンチ広告キャンペーン適用済（売上 ×1.5）</p>
                ) : (
                  <button
                    className="primary-btn ad-btn"
                    disabled={adRunning !== null}
                    onClick={runLaunchAd}
                  >
                    {adRunning === 'launch' ? '広告再生中…' : '📺 ローンチ広告 売上 +50%'}
                  </button>
                )}
              </div>

              <button className="primary-btn" onClick={handleNext}>
                次へ（オフィス）
              </button>
            </>
          )}

          <div className="release-debug-info" hidden>
            displayQ={displayQ}
          </div>
        </div>
      </section>
    </div>
  );
};
