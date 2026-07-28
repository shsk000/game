import { useEffect, useRef, useState } from 'react';
import { ads } from '../../ads/AdProvider';
import { JacketView } from '../../components/JacketView';
import { PixelWindow } from '../../components/ui';
import { adviceFor } from '../../core/advice';
import { ACHIEVEMENT_BY_ID } from '../../data/achievements';
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
import { normalizedWeightsFor, weightsFor } from '../../data/archetypes';
import { SCORE_TIER_LABEL, type ScoreTier } from '../../data/balance';
import type { FeatureId } from '../../state/types';
import { sfx } from '../../utils/sfx';

type RevealStage = 'pre-ads' | 'reveal-features' | 'reveal-bonus' | 'reveal-total' | 'done';

const STAGE_SEQUENCE: RevealStage[] = ['reveal-features', 'reveal-bonus', 'reveal-total', 'done'];

/** 内訳に出す特徴ポイント（docs/spec/score-model.md §2 の順） */
const FEATURE_ROWS: { id: FeatureId; emoji: string; label: string }[] = [
  { id: 'usabilityPt', emoji: '🕹', label: '操作性' },
  { id: 'graphicsPt', emoji: '🎨', label: 'グラフィック' },
  { id: 'soundPt', emoji: '🎵', label: 'サウンド' },
  { id: 'storyPt', emoji: '📖', label: 'ストーリー' },
  { id: 'innovationPt', emoji: '💡', label: '革新性' },
];

/** 実績・レベルアップの表示行数の上限（1280×720 スクロール禁止） */
const MAX_BADGE_ROWS = 1;

const stageReached = (current: RevealStage, target: RevealStage): boolean => {
  const order: RevealStage[] = ['pre-ads', ...STAGE_SEQUENCE];
  return order.indexOf(current) >= order.indexOf(target);
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
  const applyLaunchAd = useGameStore((s) => s.applyLaunchAd);
  const goTo = useGameStore((s) => s.goTo);
  const clearNewlyAchieved = useGameStore((s) => s.clearNewlyAchieved);

  const [stage, setStage] = useState<RevealStage>('pre-ads');
  // v0.17：結果は 2 画面（score=評価 / sales=売上）に分割（スクロール禁止の回復。spec v17 §1）
  const [resultStep, setResultStep] = useState<'score' | 'sales'>('score');
  const [displayQ, setDisplayQ] = useState(0);
  const [displayMeta, setDisplayMeta] = useState(0);
  // 発売前のマーケティング広告（売上 +10%。スコアには影響しない）
  const [marketingApplied, setMarketingApplied] = useState(false);
  const [adRunning, setAdRunning] = useState<null | 'marketing' | 'debug' | 'launch'>(null);
  /** 直前に加算されたボーナス額（`(+¥○○)` の演出用。正の額は work 側に既に反映済み） */
  const [bonusRevenue, setBonusRevenue] = useState(0);
  // 適用済み判定は store の作品データが唯一の真実（ローカル state だと画面を出入りすると
  // 「未適用」に戻り、二重視聴できてしまう）。
  const launchAdApplied = work?.launchAdUsed ?? false;
  const [newAchievements, setNewAchievements] = useState<Achievement[]>([]);
  const timersRef = useRef<number[]>([]);

  // 開発完了直後（lastReleased がまだ無く current が残っている）は ad ピッカーを表示
  useEffect(() => {
    if (!work && current) {
      setStage('pre-ads');
      setMarketingApplied(false);
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
    sfx.complete(); // 開封（評価ブレイクダウン再生）の合図
    setStage('reveal-features');
    setResultStep('score');
    setDisplayQ(Math.round(work.breakdown.base ?? 0));

    const timers: number[] = [];
    const schedule = (ms: number, fn: () => void) => {
      timers.push(window.setTimeout(fn, ms));
    };

    schedule(700, () => {
      setStage('reveal-bonus');
      setDisplayQ(
        (q) =>
          q +
          Math.round(
            (work.breakdown.compatBonus ?? 0) +
              (work.breakdown.trendBonus ?? 0) +
              (work.breakdown.criticVariance ?? 0),
          ),
      );
    });
    schedule(1500, () => {
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
        else {
          setStage('done');
          // メタスコア確定のファンファーレ。神ゲー認定はさらに特別音を重ねる
          sfx.success();
          if (work.isMasterpiece) sfx.rare();
        }
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

  const revealResults = () => {
    // current が無い＝既に releaseWork 済み。二度押し（結果発表ボタンの高速ダブルクリック）で
    // releaseWork が `no current project` を throw しクラッシュするのを防ぐ。
    if (adRunning || !current) return;
    releaseWork({ marketingAd: marketingApplied });
  };

  const runLaunchAd = () => {
    if (!work || launchAdApplied || adRunning) return;
    setAdRunning('launch');
    ads.showRewarded({
      label: 'launch-ad',
      onComplete: () => {
        // 加算は store のアクションに一本化（初動・累計・記録・ライブラリをまとめて更新）。
        // 旧実装は funds/lifetimeRevenue だけを setState 直叩きしていたため、ボーナスが
        // work.totalRevenue に載らずライブラリ「累計」や図鑑の最高売上から消えていた。
        setBonusRevenue(applyLaunchAd());
        setAdRunning(null);
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
            <p className="meta-flavor">発売前にマーケティング広告で売上を伸ばせます。</p>
            <div className="ad-row">
              <button
                className="primary-btn ad-btn"
                disabled={marketingApplied || adRunning !== null}
                onClick={runMarketingAd}
              >
                {marketingApplied
                  ? '✅ マーケティング適用済（売上+10%）'
                  : adRunning === 'marketing'
                    ? '広告再生中…'
                    : '📺 マーケティング広告（売上+10%）'}
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
  const bd = work.breakdown;
  const weights = normalizedWeightsFor(work.genreId);
  const labels = weightsFor(work.genreId);
  const isDone = stage === 'done';

  return (
    <div
      className="release-screen"
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: 8,
        minHeight: 0,
        // 1280×720 に収める（スクロール禁止）。内訳が7行に増えたぶん余白を詰めてある
        overflow: 'hidden',
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
              {/* 内訳の読み方（docs/spec/score-model.md §4：この一本以外でスコアは動かない） */}
              <p style={{ margin: '0 0 2px', fontSize: 10, opacity: 0.7 }}>
                特徴（0〜100）× ジャンルの重み ＝ メタスコアへの加点
              </p>
              {stageReached(stage, 'reveal-features') &&
                FEATURE_ROWS.filter(
                  // 0点の分野は畳む（1280×720 に収める。伸ばす余地は「次の一手」で伝える）
                  (row) => (bd.features?.[row.id] ?? 0) > 0,
                ).map((row) => {
                  const contrib = bd.features?.[row.id] ?? 0;
                  const weight = weights[row.id];
                  const point = weight > 0 ? Math.round(contrib / weight) : 0;
                  return (
                    <div className="breakdown-row" key={row.id}>
                      <span className="breakdown-emoji">{row.emoji}</span>
                      <span className="breakdown-label">
                        {row.label} {point}点 × {labels[row.id]}（{Math.round(weight * 100)}%）
                      </span>
                      <span className="breakdown-value">+{contrib.toFixed(1)}</span>
                    </div>
                  );
                })}
              {stageReached(stage, 'reveal-bonus') && (bd.compatBonus ?? 0) !== 0 && (
                <div className="breakdown-row">
                  <span className="breakdown-emoji">🧩</span>
                  <span className="breakdown-label">
                    相性 {compatLabel(compat)}（{compat.toFixed(2)}x）
                  </span>
                  <span className="breakdown-value">
                    {(bd.compatBonus ?? 0) > 0 ? '+' : ''}
                    {bd.compatBonus}
                  </span>
                </div>
              )}
              {stageReached(stage, 'reveal-bonus') && (bd.trendBonus ?? 0) !== 0 && (
                <div className="breakdown-row">
                  <span className="breakdown-emoji">📈</span>
                  <span className="breakdown-label">トレンド合致</span>
                  <span className="breakdown-value">+{bd.trendBonus}</span>
                </div>
              )}
              {stageReached(stage, 'reveal-bonus') && (
                <div className="breakdown-row">
                  <span className="breakdown-emoji">🎲</span>
                  <span className="breakdown-label">評価家のブレ</span>
                  <span className="breakdown-value">
                    {(bd.criticVariance ?? 0) > 0 ? '+' : ''}
                    {bd.criticVariance}
                  </span>
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
                  {newAchievements.slice(0, MAX_BADGE_ROWS).map((a) => {
                    const def = ACHIEVEMENT_BY_ID[a];
                    return (
                      <div key={a} className="achievement-badge">
                        🏆 実績解除 {def.emoji} {def.name}
                      </div>
                    );
                  })}
                  {newAchievements.length > MAX_BADGE_ROWS && (
                    <div className="achievement-badge">
                      🏆 ほか {newAchievements.length - MAX_BADGE_ROWS} 件の実績
                    </div>
                  )}
                </div>
              )}
              {/* v0.16：社員成長。参加社員のレベルアップを開封演出に同居させる。
                  件数が可変なので**行数上限を切る**（1280×720 スクロール禁止） */}
              {lastLevelUps.length > 0 && (
                <div className="achievement-badge-stack">
                  {lastLevelUps.slice(0, MAX_BADGE_ROWS).map((lu) => (
                    <div key={`${lu.employeeId}-${lu.level}`} className="achievement-badge">
                      ⬆ {lu.name} が Lv{lu.level} になった！（給与 +{formatYen(lu.wageDelta)}/月）
                    </div>
                  ))}
                  {lastLevelUps.length > MAX_BADGE_ROWS && (
                    <div className="achievement-badge">
                      ⬆ ほか {lastLevelUps.length - MAX_BADGE_ROWS} 人が成長した
                    </div>
                  )}
                </div>
              )}
              <ul className="release-stats">
                <li>
                  相性 {compatLabel(compat)} ({compat.toFixed(2)}x) ／ 👥
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
                  {/* 売上がどう決まったか（docs/spec/scoring.md §3）。
                      「この数値がどこから来たか」を全部見せる。効かない項は出さない */}
                  <PixelWindow title="🧮 売上の計算" variant="standard" bodyStyle={{ padding: 8 }}>
                    <div className="sales-formula">
                      <div className="sales-formula-row">
                        <span>基準売上（{SCALE_BY_ID[work.scale].name}）</span>
                        <span>{formatYen(bd.baseRevenue ?? 0)}</span>
                      </div>
                      <div className="sales-formula-row">
                        <span>
                          × ヒット区分{' '}
                          {bd.tier ? SCORE_TIER_LABEL[bd.tier as ScoreTier] : ''}（メタ
                          {work.metascore}）
                        </span>
                        <span>×{bd.tierMul ?? 1}</span>
                      </div>
                      {(bd.prBonus ?? 0) > 0 && (
                        <div className="sales-formula-row">
                          <span>× 📣 広報スキル</span>
                          <span>+{Math.round((bd.prBonus ?? 0) * 100)}%</span>
                        </div>
                      )}
                      {(bd.fanBonus ?? 0) > 0 && (
                        <div className="sales-formula-row">
                          <span>× 👥 ファン{' '}
                            {Math.round((bd.fanBonus ?? 0) * 400 * ((bd.fanBonus ?? 0) * 400)).toLocaleString()}
                            人</span>
                          <span>+{Math.round((bd.fanBonus ?? 0) * 100)}%</span>
                        </div>
                      )}
                      {(bd.pioneerBonus ?? 0) > 0 && (
                        <div className="sales-formula-row">
                          <span>× 🆕 初めての組合せ</span>
                          <span>+{Math.round((bd.pioneerBonus ?? 0) * 100)}%</span>
                        </div>
                      )}
                      {(bd.trendMul ?? 1) !== 1 && (
                        <div className="sales-formula-row">
                          <span>× 📈 トレンド合致</span>
                          <span>×{bd.trendMul}</span>
                        </div>
                      )}
                      {(bd.marketingMul ?? 1) !== 1 && (
                        <div className="sales-formula-row">
                          <span>× 📺 マーケティング広告</span>
                          <span>×{bd.marketingMul}</span>
                        </div>
                      )}
                      {(bd.axisSalesMul ?? 1) !== 1 && (
                        <div className="sales-formula-row">
                          <span>× 🔥 話題性 − 炎上リスク</span>
                          <span>×{(bd.axisSalesMul ?? 1).toFixed(2)}</span>
                        </div>
                      )}
                      <div className="sales-formula-row sales-formula-total">
                        <span>= 総売上</span>
                        <span>{formatYen(work.initialRevenue + work.salesPool)}</span>
                      </div>
                      <div className="sales-formula-note">
                        総売上の 20% が初動で即入金、残り 80% は時間をかけて売れる
                      </div>
                    </div>
                  </PixelWindow>
                  <ul className="release-stats" style={{ marginTop: 8 }}>
                    <li className="revenue">
                      {/* ローンチ広告のボーナスは work.initialRevenue に既に加算済み（二重計上しない） */}
                      💰 初動売上 {formatYen(work.initialRevenue)}
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
                    const projectedTotal = work.initialRevenue + work.salesPool;
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
                    {/* ラベルは必ず「初動売上」と明記する。初動は総売上の 20%（INITIAL_SHARE）なので
                        「売上 +50%」と書くと実効 +10% との詐称になる（オーナー指摘 2026-07-25）。 */}
                    {launchAdApplied ? (
                      <p className="ad-applied">
                        ✅ ローンチ広告キャンペーン適用済（初動売上 ×1.5）
                      </p>
                    ) : (
                      <button
                        className="primary-btn ad-btn"
                        disabled={adRunning !== null}
                        onClick={runLaunchAd}
                      >
                        {adRunning === 'launch' ? '広告再生中…' : '📺 ローンチ広告 初動売上 +50%'}
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
