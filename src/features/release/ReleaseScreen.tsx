import { useEffect, useRef, useState } from 'react';
import { ads } from '../../ads/AdProvider';
import { JacketView } from '../../components/JacketView';
import { PixelWindow } from '../../components/ui';
import { adviceFor } from '../../core/advice';
import { ACHIEVEMENT_BY_ID } from '../../data/achievements';
import { QUALITY_WEIGHTS } from '../../data/balance';
import { compatLabel, getCompat } from '../../data/compatibility';
import { sumMonthlySalaries } from '../../data/employees';
import { GENRE_BY_ID } from '../../data/genres';
import { SCALE_BY_ID } from '../../data/scales';
import { THEME_BY_ID } from '../../data/themes';
import { useGameStore } from '../../state/gameStore';
import type { Achievement } from '../../state/types';
import { formatRoi, formatWeeks, formatYen } from '../../utils/format';
import { scoreFlavor } from '../../utils/metascore';
import { computeProfit } from '../../utils/profit';

type RevealStage =
  | 'pre-ads'
  | 'reveal-character'
  | 'reveal-affinity'
  | 'reveal-performance'
  | 'reveal-luck'
  | 'reveal-total'
  | 'done';

const STAGE_SEQUENCE: RevealStage[] = [
  'reveal-character',
  'reveal-affinity',
  'reveal-performance',
  'reveal-luck',
  'reveal-total',
  'done',
];

const stageReached = (current: RevealStage, target: RevealStage): boolean => {
  const order: RevealStage[] = ['pre-ads', ...STAGE_SEQUENCE];
  return order.indexOf(current) >= order.indexOf(target);
};

/** 4 要素ウェイト（v0.14 で再配分。balance.ts の QUALITY_WEIGHTS と同期） */
const WEIGHTS = {
  charPower: QUALITY_WEIGHTS.charPower,
  genreAffinity: QUALITY_WEIGHTS.genreAffinity,
  performance: QUALITY_WEIGHTS.typingScore,
  luck: QUALITY_WEIGHTS.luck,
};

/**
 * v0.14 §5-3：開発完了（打ち上げ）のフレーバー追加評価。
 * リリース結果から該当するものを列挙（ランダム入力イベントではなく結果演出）。
 */
const completionAwards = (w: {
  isMasterpiece: boolean;
  metascore: number;
  fansGained: number;
}): { icon: string; title: string; note: string }[] => {
  const list: { icon: string; title: string; note: string }[] = [];
  if (w.isMasterpiece) list.push({ icon: '🏆', title: '神ゲー認定！', note: 'レビューで超高評価' });
  if (w.metascore >= 90)
    list.push({ icon: '🏅', title: 'アワードノミネート', note: '会社の名が業界に轟く' });
  if (w.metascore >= 80)
    list.push({ icon: '📈', title: '初週売上好調', note: '予想以上に売れている' });
  if (w.fansGained >= 40)
    list.push({ icon: '🎨', title: 'ファンアート投稿', note: 'ユーザーが作品を盛り上げている' });
  if (w.metascore >= 70)
    list.push({ icon: '💌', title: '続編希望の声', note: 'SNS で次回作を求める声' });
  if (list.length === 0) list.push({ icon: '🌱', title: '静かな船出', note: '次回作で巻き返そう' });
  return list;
};

export const ReleaseScreen = () => {
  const work = useGameStore((s) => s.lastReleased);
  const current = useGameStore((s) => s.current);
  const lastLevelUps = useGameStore((s) => s.lastLevelUps);
  const employees = useGameStore((s) => s.employees);
  const releaseWork = useGameStore((s) => s.releaseWork);
  const goTo = useGameStore((s) => s.goTo);
  const clearNewlyAchieved = useGameStore((s) => s.clearNewlyAchieved);

  const [stage, setStage] = useState<RevealStage>('pre-ads');
  // v0.17：結果は 2 画面（score=評価 / sales=売上）に分割（スクロール禁止の回復。spec v17 §1）
  const [resultStep, setResultStep] = useState<'score' | 'sales'>('score');
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
    const charContrib = (work.breakdown.charPower ?? 0) * WEIGHTS.charPower;
    setStage('reveal-character');
    setResultStep('score');
    setDisplayQ(Math.round(charContrib));

    const timers: number[] = [];
    const schedule = (ms: number, fn: () => void) => {
      timers.push(window.setTimeout(fn, ms));
    };

    schedule(500, () => {
      setStage('reveal-affinity');
      setDisplayQ(
        (q) => q + Math.round((work.breakdown.genreAffinity ?? 0) * WEIGHTS.genreAffinity),
      );
    });
    schedule(1100, () => {
      setStage('reveal-performance');
      setDisplayQ((q) => q + Math.round((work.breakdown.performance ?? 0) * WEIGHTS.performance));
    });
    schedule(1700, () => {
      setStage('reveal-luck');
      setDisplayQ((q) => q + Math.round((work.breakdown.luck ?? 50) * WEIGHTS.luck));
    });
    schedule(2300, () => {
      setStage('reveal-total');
    });
    schedule(2900, () => {
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

  // pre-ads 段階の表示（v0.11 G2：ScreenOverlay の中身として描画）
  if (stage === 'pre-ads' || !work) {
    return (
      <div
        className="release-screen"
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          padding: 12,
          minHeight: 0,
          overflow: 'auto',
          background: '#c9ccd0',
        }}
      >
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
  const charContrib = (work.breakdown.charPower ?? 0) * WEIGHTS.charPower;
  const affContrib = (work.breakdown.genreAffinity ?? 0) * WEIGHTS.genreAffinity;
  const perfContrib = (work.breakdown.performance ?? 0) * WEIGHTS.performance;
  const luckContrib = (work.breakdown.luck ?? 50) * WEIGHTS.luck;
  const total = Math.max(
    0,
    Math.min(100, Math.round(charContrib + affContrib + perfContrib + luckContrib)),
  );
  const isDone = stage === 'done';

  return (
    <div
      className="release-screen"
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        padding: 12,
        minHeight: 0,
        overflow: 'auto',
        background: '#c9ccd0',
      }}
    >
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

          <div style={{ display: resultStep === 'score' ? undefined : 'none' }}>
            <div className="breakdown-list">
              {/* v0.14：内訳の読み方を明示（「41 → +14」が何なのか分からない問題への対応） */}
              <p style={{ margin: '0 0 4px', fontSize: 11, opacity: 0.75 }}>
                各要素の実力（0〜100 点）× 重み ＝ 品質 Q への加点。合計が Q になる
              </p>
              {stageReached(stage, 'reveal-character') && (
                <div className="breakdown-row">
                  <span className="breakdown-emoji">🧑‍💻</span>
                  <span className="breakdown-label">
                    キャラ能力 {work.breakdown.charPower ?? 0}点 ×{' '}
                    {Math.round(WEIGHTS.charPower * 100)}%
                  </span>
                  <span className="breakdown-value">品質 +{Math.round(charContrib)}</span>
                </div>
              )}
              {stageReached(stage, 'reveal-affinity') && (
                <div className="breakdown-row">
                  <span className="breakdown-emoji">🧩</span>
                  <span className="breakdown-label">
                    ジャンル相性 {work.breakdown.genreAffinity ?? 0}点 ×{' '}
                    {Math.round(WEIGHTS.genreAffinity * 100)}%
                  </span>
                  <span className="breakdown-value">品質 +{Math.round(affContrib)}</span>
                </div>
              )}
              {stageReached(stage, 'reveal-performance') && (
                <div className="breakdown-row">
                  <span className="breakdown-emoji">⚡</span>
                  <span className="breakdown-label">
                    タイピング演技 {work.breakdown.performance ?? 0}点 ×{' '}
                    {Math.round(WEIGHTS.performance * 100)}%
                  </span>
                  <span className="breakdown-value">品質 +{Math.round(perfContrib)}</span>
                </div>
              )}
              {stageReached(stage, 'reveal-luck') && (
                <div className="breakdown-row">
                  <span className="breakdown-emoji">🎲</span>
                  <span className="breakdown-label">
                    運 {work.breakdown.luck ?? 50}点 × {Math.round(WEIGHTS.luck * 100)}%
                  </span>
                  <span className="breakdown-value">品質 +{Math.round(luckContrib)}</span>
                </div>
              )}
              {/* v0.14：開発中イベントの成果（面白さ/操作性/バランス−バグ率）を品質加点として開示 */}
              {stageReached(stage, 'reveal-luck') && (work.breakdown.axisBonus ?? 0) !== 0 && (
                <div className="breakdown-row">
                  <span className="breakdown-emoji">🎪</span>
                  <span className="breakdown-label">イベント成果（開発中に稼いだ面白さ等）</span>
                  <span className="breakdown-value">
                    品質 {(work.breakdown.axisBonus ?? 0) > 0 ? '+' : ''}
                    {work.breakdown.axisBonus}
                  </span>
                </div>
              )}
              {stageReached(stage, 'reveal-total') && (
                <div className="breakdown-row breakdown-total">
                  <span className="breakdown-emoji">🎯</span>
                  <span className="breakdown-label">品質 Q</span>
                  <span className="breakdown-value">{total}</span>
                </div>
              )}
              {stageReached(stage, 'reveal-total') &&
                work.breakdown.luckMultiplier !== undefined &&
                work.breakdown.luckMultiplier !== 1 && (
                  <div className="breakdown-row" style={{ fontSize: 11, opacity: 0.85 }}>
                    <span className="breakdown-emoji">✨</span>
                    <span className="breakdown-label">
                      運揺らぎ ×{work.breakdown.luckMultiplier}
                    </span>
                    <span className="breakdown-value">適用済</span>
                  </div>
                )}
            </div>

            {/* v0.17：レーダー図は内訳行と情報重複のため撤去（1280×720 スクロール禁止を優先） */}

            <div className={`meta-score ${work.isMasterpiece ? 'masterpiece' : ''}`}>
              <span className="meta-label">メタスコア</span>
              <span className="meta-value">{displayMeta}</span>
              <span className="meta-max">/100</span>
            </div>
          </div>

          {isDone && resultStep === 'score' && (
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
                      background: '#24395c',
                      border: '3px solid #0a1422',
                    }}
                  >
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#a85a28' }}>
                      🏆 名作認定！（メタ {work.metascore}）
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
              {/* v0.16：社員成長。参加社員のレベルアップを開封演出に同居させる */}
              {lastLevelUps.length > 0 && (
                <div className="achievement-badge-stack">
                  {lastLevelUps.map((lu) => (
                    <div key={`${lu.employeeId}-${lu.level}`} className="achievement-badge">
                      ⬆ {lu.name} が Lv{lu.level} になった！（power {lu.powerBefore.toFixed(2)}→
                      {lu.powerAfter.toFixed(2)}・給与 +{formatYen(lu.wageDelta)}/月）
                    </div>
                  ))}
                </div>
              )}
              <ul className="release-stats">
                <li>
                  品質 Q {work.quality} ／ 相性 {compatLabel(compat)} ({compat.toFixed(2)}x) ／ 👥
                  ファン +{work.fansGained}
                </li>
                <li>
                  ⏱ {work.developSec.toFixed(1)}秒
                  {work.developWeeks !== undefined && (
                    <span style={{ marginLeft: 6, color: '#9fb6d4' }}>
                      ／ ゲーム内 {formatWeeks(work.developWeeks)}（{work.developWeeks} 週）
                    </span>
                  )}
                </li>
              </ul>

              <button className="primary-btn" onClick={() => setResultStep('sales')}>
                💰 売上を見る ▶
              </button>
            </>
          )}

          {isDone && resultStep === 'sales' && (
            <>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 10,
                  alignItems: 'start',
                }}
              >
                <div>
                  <ul className="release-stats">
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

                  {/* v0.10：利益ブレイクダウン
                      v0.17.1：月固定費に給与を含める（賃料だけだと実際の月次徴収と食い違う。オーナー指摘） */}
                  {(() => {
                    const scaleDef = SCALE_BY_ID[work.scale];
                    const projectedTotal = work.initialRevenue + bonusRevenue + work.salesPool;
                    const salaries = sumMonthlySalaries(employees);
                    const monthlyFixed = salaries + scaleDef.monthlyRent;
                    const devMonths = Math.max(
                      1,
                      Math.round((work.developWeeks ?? scaleDef.neededWeeks) / 4),
                    );
                    const result = computeProfit({
                      totalRevenue: projectedTotal,
                      devCost: scaleDef.baseCost,
                      monthlyFixedCost: monthlyFixed,
                      developMonths: devMonths,
                    });
                    const devCost = result.devCost;
                    const fixedCostTotal = result.fixedCostTotal;
                    const profit = result.profit;
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
                          <strong style={{ color: '#ff6b6b' }}>-{formatYen(devCost)}</strong>
                          <span>
                            − 月固定費 × {devMonths} ヶ月（給与 {formatYen(salaries)} + 賃料{' '}
                            {formatYen(scaleDef.monthlyRent)} /月）
                          </span>
                          <strong style={{ color: '#ff6b6b' }}>-{formatYen(fixedCostTotal)}</strong>
                          <span
                            style={{
                              gridColumn: '1 / 3',
                              height: 1,
                              background: '#16263e',
                              margin: '4px 0',
                            }}
                          />
                          <span style={{ fontWeight: 700 }}>利益見込</span>
                          <strong
                            style={{
                              color: positive ? '#308040' : '#a03030',
                              fontSize: 16,
                            }}
                          >
                            {formatYen(profit)}
                          </strong>
                          <span style={{ fontWeight: 700 }}>ROI</span>
                          <strong
                            style={{
                              color: positive ? '#308040' : '#a03030',
                            }}
                          >
                            {roi}
                          </strong>
                        </div>
                      </PixelWindow>
                    );
                  })()}
                </div>
                <div>
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

                  {/* v0.14 開発完了フェーズ：打ち上げ（結果演出。spec §5-3） */}
                  <PixelWindow
                    title="🎉 開発完了！ 打ち上げ"
                    variant="emphasis"
                    style={{ marginTop: 10 }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div
                        style={{
                          border: '2px solid #2b3a1c',
                          overflow: 'hidden',
                          aspectRatio: '6 / 1',
                        }}
                      >
                        <img
                          src={`${import.meta.env.BASE_URL}phase/complete.png`}
                          alt="打ち上げ"
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            objectPosition: 'center 30%',
                            imageRendering: 'pixelated',
                          }}
                        />
                      </div>
                      <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>
                        リリースおめでとう！！ チーム全員おつかれさまでした！
                      </p>
                      <ul
                        style={{
                          listStyle: 'none',
                          margin: 0,
                          padding: 0,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 4,
                        }}
                      >
                        {completionAwards(work).map((a) => (
                          <li key={a.title} style={{ fontSize: 13 }}>
                            {a.icon} <strong>{a.title}</strong>
                            <span style={{ fontSize: 11, opacity: 0.8, marginLeft: 6 }}>
                              {a.note}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </PixelWindow>
                </div>
              </div>

              {/* v0.18：次の一手（最大のボトルネックを1つだけ翻訳。core/advice.ts） */}
              <p
                style={{
                  margin: '8px 0 0',
                  fontSize: 13,
                  fontWeight: 700,
                  color: '#24395c',
                  textAlign: 'center',
                }}
              >
                📈 {adviceFor(work)}
              </p>

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
