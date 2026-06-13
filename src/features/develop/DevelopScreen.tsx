import { useEffect, useMemo, useRef, useState } from 'react';
import { PixelStatusBar, PixelWindow, SegGauge } from '../../components/ui';
import { getPhrases } from '../../data/genres';
import { SCALE_BY_ID } from '../../data/scales';
import { useGameStore } from '../../state/gameStore';
import {
  computeDevImpact,
  type ImpactRank,
  type KeystrokeRating,
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

  const [remainingSec, setRemainingSec] = useState(0);
  const [toasts, setToasts] = useState<Toast[]>([]);

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
      if (current?.bugPhrase) {
        addDevelopLoC(3);
        clearBug();
      } else {
        addDevelopLoC(1);
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
    onWpm: (w) => reportWPM(w),
    onAccuracy: (a) => reportAccuracy(a),
  });

  // 制限秒カウントダウン（rAF）。0 到達で finishDevelopment（多重ガード）
  const startedAt = current?.startedAt ?? null;
  const timeLimitSec = current?.timeLimitSec ?? 60;
  const finishedAt = current?.finishedAt ?? null;
  useEffect(() => {
    if (startedAt === null) return;
    let raf = 0;
    const loop = () => {
      const elapsedSec = (performance.now() - startedAt) / 1000;
      const rem = Math.max(0, timeLimitSec - elapsedSec);
      setRemainingSec(rem);
      if (rem <= 0 && finishedAt === null) {
        finishDevelopment();
        return; // 以降ループ停止
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [startedAt, timeLimitSec, finishedAt, finishDevelopment]);

  // バグ発生をテロップに
  const bugPhrase = current?.bugPhrase ?? null;
  useEffect(() => {
    if (bugPhrase) pushToast('🐛 バグ発生：下の文を打ち切れ！', 'warn');
  }, [bugPhrase]);

  if (!current) return null;
  const scaleDef = SCALE_BY_ID[current.scale];
  if (!scaleDef) return null;

  // 残り時間の割合・PHASE ドット
  const timePct = Math.max(0, Math.min(100, (remainingSec / timeLimitSec) * 100));
  const TOTAL_PHASES = 6;
  const litDots = Math.max(
    1,
    Math.min(TOTAL_PHASES, Math.ceil((1 - remainingSec / timeLimitSec) * TOTAL_PHASES)),
  );

  // 開発への影響 4 指標
  const impact = computeDevImpact({ wpm, accuracy });
  const charsPerMin = toCharsPerMin(wpm);
  const accuracyPct = Math.round(accuracy * 1000) / 10;

  return (
    <div className="screen develop-screen" style={{ background: '#0d1626' }}>
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
                background: t.tone === 'warn' ? '#a03030' : '#214577',
                color: '#ffffff',
                border: '1px solid #10151c',
                fontWeight: 700,
                fontSize: 13,
              }}
            >
              {t.text}
            </div>
          ))}
        </div>
      )}

      {/* 中央パネル */}
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
        <PixelWindow
          title={
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <span>{'</> 開発フェーズ'}</span>
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 11,
                  color: '#bcd0e8',
                }}
              >
                PHASE {litDots} / {TOTAL_PHASES}
                <span style={{ display: 'flex', gap: 3 }}>
                  {Array.from({ length: TOTAL_PHASES }, (_, i) => (
                    <span
                      key={i}
                      style={{
                        width: 9,
                        height: 9,
                        borderRadius: '50%',
                        background: i < litDots ? '#5fd75f' : '#3a4a60',
                        border: '1px solid #10151c',
                      }}
                    />
                  ))}
                </span>
              </span>
            </div>
          }
          style={{ width: 960 }}
          bodyStyle={{ padding: 16 }}
        >
          {/* 行1: ミッション見出し + 残り時間 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 16 }}>
            <div>
              <div style={{ fontSize: 12, color: '#1d8a3c', fontWeight: 700 }}>
                {current.missionName ?? 'MISSION_01'}
              </div>
              <div style={{ fontSize: 26, fontWeight: 700, color: '#1c2228', margin: '2px 0 6px' }}>
                {current.missionDesc ?? 'コードを書く'}
              </div>
              <p style={{ margin: 0, fontSize: 12, color: '#3a4148', lineHeight: 1.5 }}>
                制限時間内にできるだけ速く正確に打ち込もう。
                <br />
                打鍵の出来が作品の品質・バグ率に直結する。
              </p>
            </div>
            <div
              style={{
                background: '#0d1626',
                border: '1px solid #10151c',
                padding: 10,
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              <span style={{ fontSize: 11, color: '#9fb6d4' }}>残り時間</span>
              <span
                style={{
                  fontSize: 30,
                  fontWeight: 700,
                  color: remainingSec <= 10 ? '#ff6b6b' : '#5fd75f',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {remainingSec.toFixed(1)} <span style={{ fontSize: 14 }}>秒</span>
              </span>
              <SegGauge pct={timePct} color={remainingSec <= 10 ? '#ff6b6b' : '#43c059'} track="#0a1422" />
            </div>
          </div>

          {/* 行2: 入力エリア + COMBO */}
          <div
            style={{ display: 'grid', gridTemplateColumns: '1fr 200px', gap: 16, marginTop: 14 }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <div style={{ fontSize: 11, color: '#1668a8', fontWeight: 700, marginBottom: 4 }}>
                  入力する文章
                </div>
                <div
                  style={{
                    background: '#f7f7f4',
                    border: '1px solid #10151c',
                    padding: '10px 12px',
                    fontSize: 26,
                    color: '#1c2228',
                    letterSpacing: '0.04em',
                    minHeight: 30,
                  }}
                >
                  {view.hiragana}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#1668a8', fontWeight: 700, marginBottom: 4 }}>
                  ローマ字入力
                </div>
                <div
                  style={{
                    background: '#0d1626',
                    border: '1px solid #10151c',
                    padding: '8px 12px',
                    fontSize: 20,
                    letterSpacing: '0.08em',
                    minHeight: 26,
                  }}
                >
                  <span style={{ color: '#5fd75f' }}>{view.completed}</span>
                  <span className="dev-cursor" style={{ color: '#ffffff' }}>
                    |
                  </span>
                  <span style={{ color: '#7a8aa0' }}>{view.remained}</span>
                </div>
              </div>
            </div>
            {/* COMBO ボックス */}
            <div
              style={{
                background: '#0d1626',
                border: '1px solid #10151c',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                padding: 8,
              }}
            >
              <span style={{ fontSize: 12, color: '#9fb6d4', letterSpacing: '0.1em' }}>COMBO</span>
              <span
                key={combo}
                className="dev-combo"
                style={{
                  fontSize: 40,
                  fontWeight: 700,
                  color: '#f5a623',
                  fontVariantNumeric: 'tabular-nums',
                  lineHeight: 1,
                }}
              >
                {combo}
              </span>
              {rating && (
                <span className="dev-rating" style={{ fontSize: 14, fontWeight: 700, color: '#ffd54a' }}>
                  +{rating}!
                </span>
              )}
            </div>
          </div>

          {/* 行3: 3メトリクス */}
          <div
            style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 14 }}
          >
            <Metric label="入力速度" icon="⏩" value={`${charsPerMin}`} unit="文字/分" />
            <Metric label="正確さ" icon="🎯" value={`${accuracyPct}`} unit="%" />
            <Metric label="ミス回数" icon="❌" value={`${failCount}`} unit="回" />
          </div>

          {/* 行4: 開発への影響 4枠 */}
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 11, color: '#1668a8', fontWeight: 700, marginBottom: 6 }}>
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
                  background: '#0d1626',
                  border: '1px dashed #3a4a60',
                  padding: 8,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  opacity: 0.6,
                }}
              >
                <span style={{ fontSize: 11, color: '#9fb6d4' }}>✨ 獲得EXP</span>
                <span style={{ fontSize: 12, color: '#7a8aa0' }}>準備中</span>
              </div>
            </div>
          </div>
        </PixelWindow>
      </main>
    </div>
  );
};

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
  <div
    style={{
      background: '#f2f1ed',
      border: '1px solid #10151c',
      padding: '8px 10px',
      display: 'flex',
      flexDirection: 'column',
      gap: 2,
    }}
  >
    <span style={{ fontSize: 11, color: '#3a4148' }}>{label}</span>
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
      <span style={{ fontSize: 14 }}>{icon}</span>
      <span
        style={{
          fontSize: 22,
          fontWeight: 700,
          color: '#1c2228',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </span>
      <span style={{ fontSize: 11, color: '#6b7280' }}>{unit}</span>
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
  <div
    style={{
      background: '#0d1626',
      border: '1px solid #10151c',
      padding: 8,
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
    }}
  >
    <span style={{ fontSize: 11, color: '#9fb6d4' }}>
      {icon} {label}
    </span>
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
      <span
        style={{ fontSize: 18, fontWeight: 700, color: '#ffffff', fontVariantNumeric: 'tabular-nums' }}
      >
        {value}
      </span>
      <span style={{ fontSize: 16, fontWeight: 700, color: rankColor(rank) }}>{rank}</span>
    </div>
    <SegGauge pct={pct} color={rankColor(rank)} track="#0a1422" height={6} />
  </div>
);
