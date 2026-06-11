import { useEffect, useRef, useState } from 'react';
import { SCALE_BY_ID } from '../../data/scales';
import { useGameStore } from '../../state/gameStore';
import { formatGameDate } from '../../state/types';
import { formatYen } from '../../utils/format';

/**
 * v0.11 G3：数値の離散カウントアップ。
 * 値が変わったら 8 ステップ（~400ms）で段階的に追いつく。
 * ピクセル UI の文法：滑らかな ease ではなく、カクカク数字が回る。
 */
const useAnimatedNumber = (target: number): number => {
  const [display, setDisplay] = useState(target);
  const displayRef = useRef(target);

  useEffect(() => {
    if (displayRef.current === target) return;
    const start = displayRef.current;
    const diff = target - start;
    const STEPS = 8;
    const INTERVAL = 50;
    let step = 0;
    const t = setInterval(() => {
      step++;
      if (step >= STEPS) {
        displayRef.current = target;
        setDisplay(target);
        clearInterval(t);
      } else {
        const v = Math.round(start + (diff * step) / STEPS);
        displayRef.current = v;
        setDisplay(v);
      }
    }, INTERVAL);
    return () => clearInterval(t);
  }, [target]);

  return display;
};

type MoneyFloat = { id: number; delta: number };

/**
 * 画面上部の常駐ヘッダーバー（v0.11 G5：リファレンス準拠の薄い 1 行構成、40px）。
 *
 *   [🏭 タイピング工場 (規模バッジ)]   [2026年 1月 1週]   [¥12,500,000] [ファン 125,680人]
 *
 * - 会社名 + 現在規模の黄色バッジ（リファレンスの Lv.12 バッジ相当）
 * - 日付は中央
 * - 資金は黄色、ファンは白。仕切り線は使わない（余白で区切る）
 * - 「次の週まで」進捗は下部ティッカーに移動（ここには置かない）
 */

const formatNumber = (n: number): string => n.toLocaleString('ja-JP');

type Props = {
  className?: string;
  style?: React.CSSProperties;
};

export const PixelStatusBar = ({ className, style }: Props) => {
  const funds = useGameStore((s) => s.funds);
  const fans = useGameStore((s) => s.fans);
  const unlocked = useGameStore((s) => s.unlockedScales);
  const currentDate = useGameStore((s) => s.currentDate);

  const currentScale = unlocked[unlocked.length - 1] ?? 'mini';
  const scaleName = SCALE_BY_ID[currentScale]?.name ?? 'ミニゲーム';

  // G3：資金カウントアップ + 増減フラッシュ + 浮き「+¥」
  const displayFunds = useAnimatedNumber(funds);
  const prevFundsRef = useRef(funds);
  const [fundsFlash, setFundsFlash] = useState<'gain' | 'loss' | null>(null);
  const [moneyFloats, setMoneyFloats] = useState<MoneyFloat[]>([]);
  const floatIdRef = useRef(0);

  useEffect(() => {
    const delta = funds - prevFundsRef.current;
    prevFundsRef.current = funds;
    if (delta === 0) return;

    setFundsFlash(delta > 0 ? 'gain' : 'loss');
    const flashT = setTimeout(() => setFundsFlash(null), 450);

    floatIdRef.current += 1;
    const id = floatIdRef.current;
    setMoneyFloats((prev) => [...prev.slice(-2), { id, delta }]);
    const floatT = setTimeout(() => {
      setMoneyFloats((prev) => prev.filter((f) => f.id !== id));
    }, 950);

    return () => {
      clearTimeout(flashT);
      clearTimeout(floatT);
    };
  }, [funds]);

  return (
    <div
      className={className}
      aria-label="ステータスバー"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 20,
        padding: '0 12px',
        height: 40,
        background: '#161d28',
        borderBottom: '1px solid #10151c',
        color: '#ffffff',
        fontWeight: 700,
        letterSpacing: '0.04em',
        fontSize: 13,
        imageRendering: 'pixelated',
        flexShrink: 0,
        ...style,
      }}
    >
      {/* 会社名 + 規模バッジ（リファレンス：枠付き左ブロック） */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '3px 10px 3px 4px',
          border: '1px solid #3a4a60',
          background: '#1b2433',
        }}
      >
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 26,
            height: 26,
            background: '#e0dfda',
            border: '1px solid #10151c',
            fontSize: 14,
          }}
        >
          🏭
        </span>
        <span>タイピング工場</span>
        <span
          style={{
            padding: '1px 8px',
            background: '#f5c33e',
            color: '#161d28',
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          {scaleName}
        </span>
      </div>

      {/* 日付（中央寄せ） */}
      <div
        style={{
          flex: 1,
          textAlign: 'center',
          fontVariantNumeric: 'tabular-nums',
          color: '#e8f0ff',
        }}
      >
        {formatGameDate(currentDate)}
      </div>

      {/* 資金（黄色、カウントアップ + 浮き文字） */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span
          className={
            fundsFlash === 'gain' ? 'funds-gain' : fundsFlash === 'loss' ? 'funds-loss' : undefined
          }
          style={{
            color: '#f5c33e',
            fontVariantNumeric: 'tabular-nums',
            fontSize: 14,
          }}
        >
          ¥{formatNumber(displayFunds)}
        </span>
        {moneyFloats.map((f) => (
          <span
            key={f.id}
            className="money-float"
            style={{ color: f.delta > 0 ? '#6cff95' : '#ff6b6b' }}
          >
            {f.delta > 0 ? '+' : ''}
            {formatYen(f.delta)}
          </span>
        ))}
      </div>

      {/* ファン数 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 11, color: '#8a96a8' }}>ファン数</span>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatNumber(fans)}人</span>
      </div>
    </div>
  );
};
