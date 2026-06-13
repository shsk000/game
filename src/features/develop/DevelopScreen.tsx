import { useEffect, useMemo, useRef, useState } from 'react';
import { PixelStatusBar, SegGauge } from '../../components/ui';
import { getPhrases } from '../../data/genres';
import { SCALE_BY_ID } from '../../data/scales';
import { useGameStore } from '../../state/gameStore';
import {
  computeDevImpact,
  type ImpactRank,
  type KeystrokeRating,
  progressGain,
  rankColor,
  ratingForInterval,
  toCharsPerMin,
} from './devImpact';
import { useTyping } from './useTyping';

type Toast = { id: number; text: string; tone: 'warn' | 'good' | 'info' };

/**
 * v0.11 開発フェーズ画面（中央パネル）。
 *
 * モックアップ（ui/phase/development.png）の中央「開発フェーズ」パネルを再現。
 * - 制限秒カウントダウン（neededWeeks 秒換算。0 で finishDevelopment → release）
 * - 入力文章（かな）/ ローマ字 / COMBO レーティング
 * - 入力速度（文字/分）/ 正確さ / ミス回数
 * - 開発への影響 4 枠（開発速度 / 品質 / バグ率 / EXP=準備中）
 * - PHASE ドット・MISSION は演出表示（中身は連続タイピング）
 *
 * 開発中はゲーム内時間停止（GlobalTicker 側）。周辺パネル（左/右/下）は今回スコープ外。
 */
export const DevelopScreen = () => {
  const current = useGameStore((s) => s.current);
  const addDevelopLoC = useGameStore((s) => s.addDevelopLoC);
  const finishDevelopment = useGameStore((s) => s.finishDevelopment);
  const reportCombo = useGameStore((s) => s.reportCombo);
  const reportWPM = useGameStore((s) => s.reportWPM);
  const reportAccuracy = useGameStore((s) => s.reportAccuracy);
  const clearBug = useGameStore((s) => s.clearBug);

  const [toasts, setToasts] = useState<Toast[]>([]);
  // 速度ボーナス算出用：最新 wpm を保持（onWpm で更新）
  const wpmRef = useRef(0);

  // 打鍵レーティング（COMBO +GREAT!）：直近正打の打鍵間隔から
  const [rating, setRating] = useState<KeystrokeRating>(null);
  const lastCorrectAtRef = useRef<number>(0);
  const ratingTimerRef = useRef<number | null>(null);

  const pushToast = (text: string, tone: Toast['tone']) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, text, tone }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 1800);
  };

  const phrases = useMemo(() => {
    if (!current) return [];
    return getPhrases(current.genreId, current.requiredLoC * 3);
  }, [current?.genreId, current?.requiredLoC]);

  const effectivePhrases = useMemo(() => {
    if (!current?.bugPhrase) return phrases;
    return [current.bugPhrase, ...phrases];
  }, [phrases, current?.bugPhrase]);

  const { view, failCount, combo, wpm, accuracy } = useTyping({
    phrases: effectivePhrases,
    onPhraseComplete: () => {
      // 進捗を加算（速く打つほど 1 本の寄与が増える＝ある程度早く完了）
      const isBug = !!current?.bugPhrase;
      addDevelopLoC(progressGain(wpmRef.current, isBug));
      if (isBug) clearBug();
      // 完了判定は「入力」起点のみ（残り時間＝締切は廃止）。
      // 作業量目標 workTarget に達したら finishDevelopment。打たなければ永遠に終わらない。
      const s = useGameStore.getState();
      const done = s.current?.doneLoC ?? 0;
      const target = s.current?.workTarget ?? 1;
      if (done >= target && s.current?.finishedAt == null) {
        finishDevelopment();
      }
    },
    paused: !current || current.finishedAt !== null,
    onCorrect: (c) => {
      reportCombo(c);
      // 打鍵レーティング：前回正打からの間隔
      const now = performance.now();
      const interval = now - lastCorrectAtRef.current;
      lastCorrectAtRef.current = now;
      const r = ratingForInterval(interval);
      if (r) {
        setRating(r);
        if (ratingTimerRef.current) window.clearTimeout(ratingTimerRef.current);
        ratingTimerRef.current = window.setTimeout(() => setRating(null), 600);
      }
    },
    onWpm: (w) => {
      wpmRef.current = w;
      reportWPM(w);
    },
    onAccuracy: (a) => reportAccuracy(a),
  });

  const workTarget = current?.workTarget ?? 1;

  // バグ発生をテロップに
  const bugPhrase = current?.bugPhrase ?? null;
  useEffect(() => {
    if (bugPhrase) pushToast('🐛 バグ発生：下の文を打ち切れ！', 'warn');
  }, [bugPhrase]);

  if (!current) return null;
  const scaleDef = SCALE_BY_ID[current.scale];
  if (!scaleDef) return null;

  // 開発への影響 4 指標
  const impact = computeDevImpact({ wpm, accuracy });
  const charsPerMin = toCharsPerMin(wpm);
  const accuracyPct = Math.round(accuracy * 1000) / 10;
  // 進捗（作業量）：打って workTarget まで埋めると完了。速く打つほど早く 100% に達する。
  const progressPct = Math.max(0, Math.min(100, (current.doneLoC / workTarget) * 100));
  // PHASE ドットは進捗に連動（演出）
  const TOTAL_PHASES = 6;
  const litDots = Math.max(1, Math.min(TOTAL_PHASES, Math.ceil((progressPct / 100) * TOTAL_PHASES)));

  return (
    <div className="screen develop-screen" style={{ background: '#05080c' }}>
      <PixelStatusBar />

      {/* テロップ（バグ等） */}
      {toasts.length > 0 && (
        <div
          aria-live="polite"
          style={{
            position: 'absolute',
            top: 52,
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
                background: t.tone === 'warn' ? '#7a1d1d' : '#1e3a10',
                color: '#f4ecd9',
                border: `1px solid ${t.tone === 'warn' ? '#c84a3a' : DEV.greenLine}`,
                fontWeight: 700,
                fontSize: 13,
              }}
            >
              {t.text}
            </div>
          ))}
        </div>
      )}

      {/* 中央パネル（ターミナル/コードエディタ風ダークテーマ） */}
      <main
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 0,
          padding: 12,
        }}
      >
        <div
          style={{
            width: 960,
            background: DEV.panelBg,
            border: `2px solid ${DEV.panelBorder}`,
            boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
            imageRendering: 'pixelated',
          }}
        >
          {/* タイトルバー */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              padding: '8px 12px',
              borderBottom: `2px solid ${DEV.panelBorder}`,
            }}
          >
            <span style={{ color: DEV.green, fontWeight: 700, fontSize: 16, letterSpacing: '0.06em' }}>
              {'</> 開発フェーズ'}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: DEV.sub }}>
              PHASE {litDots} / {TOTAL_PHASES}
              <span style={{ display: 'flex', gap: 4 }}>
                {Array.from({ length: TOTAL_PHASES }, (_, i) => (
                  <span
                    key={i}
                    style={{
                      width: 9,
                      height: 9,
                      borderRadius: '50%',
                      background: i < litDots ? DEV.green : '#1e2a14',
                      border: '1px solid #05080c',
                    }}
                  />
                ))}
              </span>
            </span>
          </div>

          <div style={{ padding: 16 }}>
            {/* 行1: 入力エリア（主役） + 残り時間 / 進捗 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 11, color: DEV.green, fontWeight: 700, marginBottom: 4 }}>
                    入力する文章
                  </div>
                  <div
                    style={{
                      background: '#0c1207',
                      border: `1px solid ${DEV.panelBorder}`,
                      padding: '14px 14px',
                      fontSize: 34,
                      color: DEV.cream,
                      letterSpacing: '0.04em',
                      minHeight: 40,
                    }}
                  >
                    {view.hiragana}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: DEV.green, fontWeight: 700, marginBottom: 4 }}>
                    ローマ字入力
                  </div>
                  <div
                    style={{
                      background: '#0c1207',
                      border: `1px solid ${DEV.panelBorder}`,
                      padding: '10px 14px',
                      fontSize: 24,
                      letterSpacing: '0.08em',
                      minHeight: 30,
                    }}
                  >
                    <span style={{ color: DEV.green }}>{view.completed}</span>
                    <span className="dev-cursor" style={{ color: DEV.white }}>
                      |
                    </span>
                    <span style={{ color: '#5a6e3a' }}>{view.remained}</span>
                  </div>
                </div>
              </div>
              {/* 進捗（打って埋めると完成。速いほど早く 100% に達する） */}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ ...devBox(), gap: 8, height: '100%', justifyContent: 'center' }}>
                  <span style={{ fontSize: 11, color: DEV.sub }}>進捗（速いほど早く完成）</span>
                  <span
                    style={{
                      fontSize: 44,
                      fontWeight: 700,
                      color: DEV.greenBright,
                      fontVariantNumeric: 'tabular-nums',
                      lineHeight: 1,
                    }}
                  >
                    {Math.floor(progressPct)} <span style={{ fontSize: 16 }}>%</span>
                  </span>
                  <SegGauge pct={progressPct} color={DEV.greenBright} track="#0c1207" height={12} />
                  <span style={{ fontSize: 11, color: DEV.sub }}>
                    完成まであと{' '}
                    <span style={{ color: DEV.cream, fontWeight: 700 }}>
                      {Math.max(0, Math.ceil(workTarget - current.doneLoC))}
                    </span>{' '}
                    本
                  </span>
                </div>
              </div>
            </div>

            {/* 行2: COMBO（横長） */}
            <div
              style={{
                ...devBox(),
                marginTop: 14,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 12,
              }}
            >
              <span style={{ fontSize: 13, color: DEV.sub, letterSpacing: '0.1em' }}>COMBO</span>
              <span
                key={combo}
                className="dev-combo"
                style={{
                  fontSize: 40,
                  fontWeight: 700,
                  color: DEV.orange,
                  fontVariantNumeric: 'tabular-nums',
                  lineHeight: 1,
                }}
              >
                {combo}
              </span>
              {rating && (
                <span
                  className="dev-rating"
                  style={{ fontSize: 16, fontWeight: 700, color: DEV.orange }}
                >
                  +{rating}!
                </span>
              )}
            </div>

            {/* 行3: 3メトリクス */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 10,
                marginTop: 14,
              }}
            >
              <Metric label="入力速度" icon="⏩" value={`${charsPerMin}`} unit="文字/分" />
              <Metric label="正確さ" icon="🎯" value={`${accuracyPct}`} unit="%" />
              <Metric label="ミス回数" icon="❌" value={`${failCount}`} unit="回" />
            </div>

            {/* 行4: 開発への影響 4枠 */}
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 11, color: DEV.green, fontWeight: 700, marginBottom: 6 }}>
                開発への影響（この入力結果）
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                <ImpactBox
                  icon="⚡"
                  label="開発速度"
                  value={`${impact.speedPct >= 0 ? '+' : ''}${impact.speedPct}%`}
                  rank={impact.speedRank}
                  pct={clampPct(impact.speedPct + 30, 70)}
                />
                <ImpactBox
                  icon="💎"
                  label="品質"
                  value={`+${impact.qualityDelta}`}
                  rank={impact.qualityRank}
                  pct={impact.qualityDelta * 20}
                />
                <ImpactBox
                  icon="🐛"
                  label="バグ率"
                  value={`${impact.bugPct}%`}
                  rank={impact.bugRank}
                  pct={Math.abs(impact.bugPct) * 20}
                />
                {/* EXP は今回未実装＝準備中枠 */}
                <div
                  style={{
                    ...devBox(),
                    border: `1px dashed ${DEV.panelBorder}`,
                    opacity: 0.55,
                  }}
                >
                  <span style={{ fontSize: 11, color: DEV.sub }}>✨ 獲得EXP</span>
                  <span style={{ fontSize: 12, color: '#5a6e3a' }}>準備中</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

/**
 * v0.11 開発フェーズのダークパレット（リファレンス ui/phase/development.png から実測）。
 * ターミナル/コードエディタ風：ほぼ黒の本体 + 緑系アクセント + オフホワイト文字 + オレンジ COMBO。
 */
const DEV = {
  panelBg: '#06090e',
  panelBorder: '#2b3a1c',
  greenLine: '#3a5020',
  green: '#8fd02a',
  greenBright: '#a6e138',
  timeGreen: '#79c11b',
  cream: '#f4ecd9',
  white: '#fffdf2',
  orange: '#e29001',
  sub: '#7f9a52',
} as const;

/** ダーク内枠の共通スタイル */
const devBox = (): React.CSSProperties => ({
  background: '#0a0f08',
  border: `1px solid ${DEV.panelBorder}`,
  padding: 10,
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
});

const clampPct = (v: number, max: number) => Math.max(0, Math.min(100, (v / max) * 100));

/** 行3 の 1 メトリクス（入力速度・正確さ・ミス） */
const Metric = ({
  label,
  icon,
  value,
  unit,
}: {
  label: string;
  icon: string;
  value: string;
  unit: string;
}) => (
  <div style={{ ...devBox(), gap: 2 }}>
    <span style={{ fontSize: 11, color: DEV.sub }}>{label}</span>
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
      <span style={{ fontSize: 14 }}>{icon}</span>
      <span
        style={{
          fontSize: 22,
          fontWeight: 700,
          color: DEV.cream,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </span>
      <span style={{ fontSize: 11, color: DEV.sub }}>{unit}</span>
    </div>
  </div>
);

/** 行4 の 1 影響枠（開発速度・品質・バグ率） */
const ImpactBox = ({
  icon,
  label,
  value,
  rank,
  pct,
}: {
  icon: string;
  label: string;
  value: string;
  rank: ImpactRank;
  pct: number;
}) => (
  <div style={{ ...devBox(), gap: 4 }}>
    <span style={{ fontSize: 11, color: DEV.sub }}>
      {icon} {label}
    </span>
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
      <span
        style={{ fontSize: 18, fontWeight: 700, color: DEV.cream, fontVariantNumeric: 'tabular-nums' }}
      >
        {value}
      </span>
      <span style={{ fontSize: 16, fontWeight: 700, color: rankColor(rank) }}>{rank}</span>
    </div>
    <SegGauge pct={pct} color={rankColor(rank)} track="#0c1207" height={6} />
  </div>
);
