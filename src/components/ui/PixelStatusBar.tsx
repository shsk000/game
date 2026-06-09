import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../../state/gameStore';
import { formatGameDate } from '../../state/types';
import { formatYen } from '../../utils/format';
import { PixelIcon } from './PixelIcon';

/**
 * 画面上部の常駐ステータスバー（v0.11 固定 56px 高）。
 *
 * 構造：
 *   左ゾーン：💰 資金 / 👥 ファン / 🧑 従業員 / 📚 作品
 *   右ゾーン：📅 ゲーム内日付 + 次の週まで進捗バー
 *
 * 仕様：
 * - 1280px 幅にフィット、左右余白 16px
 * - 高さ 56px 固定（layout-design.md §1）
 * - 黒板/レトロ電光掲示板風の濃い背景に明るい数字
 * - 数字は tabular-nums で揃える
 */

const formatNumber = (n: number): string => n.toLocaleString('ja-JP');

const IDLE_MS_PER_WEEK = 30_000;
const DEVELOP_MS_PER_WEEK = 7500;

type Props = {
  className?: string;
  style?: React.CSSProperties;
};

export const PixelStatusBar = ({ className, style }: Props) => {
  const funds = useGameStore((s) => s.funds);
  const fans = useGameStore((s) => s.fans);
  const employeeCount = useGameStore((s) => s.employees.length);
  const workCount = useGameStore((s) => s.library.length);
  const currentDate = useGameStore((s) => s.currentDate);
  const screen = useGameStore((s) => s.screen);

  // 次の週までの進捗（GlobalTicker の lastWeekAt と同期）
  const [weekProgress, setWeekProgress] = useState(0);
  const weekStartRef = useRef<number>(performance.now());

  useEffect(() => {
    weekStartRef.current = performance.now();
    setWeekProgress(0);
  }, [currentDate]);

  useEffect(() => {
    const intervalMs = screen === 'develop' ? DEVELOP_MS_PER_WEEK : IDLE_MS_PER_WEEK;
    const t = setInterval(() => {
      const elapsed = performance.now() - weekStartRef.current;
      setWeekProgress(Math.min(100, (elapsed / intervalMs) * 100));
    }, 250);
    return () => clearInterval(t);
  }, [screen]);

  return (
    <div
      className={className}
      aria-label="ステータスバー"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        padding: '8px 16px',
        height: 56,
        background: '#1a0f08',
        borderBottom: '4px solid #2c1f15',
        color: '#fff8e0',
        boxShadow: 'inset 0 -2px 0 #6b4f3a',
        fontWeight: 700,
        letterSpacing: '0.04em',
        imageRendering: 'pixelated',
        flexShrink: 0,
        ...style,
      }}
    >
      {/* 左ゾーン：会社ステータス 4 項目 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <StatusItem emoji="💰" label="資金" value={formatYen(funds)} color="#f5c84a" />
        <Divider />
        <StatusItem emoji="👥" label="ファン" value={formatNumber(fans)} color="#7adfff" />
        <Divider />
        <StatusItem emoji="🧑‍💻" label="従業員" value={`${employeeCount}人`} color="#9bff9b" />
        <Divider />
        <StatusItem emoji="📚" label="作品" value={`${workCount}本`} color="#ffb8d8" />
      </div>

      {/* 右ゾーン：日付 + 次の週進捗 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <PixelIcon emoji="📅" label="日付" size={20} />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
          <span style={{ fontSize: 13, color: '#fff8e0', fontVariantNumeric: 'tabular-nums' }}>
            {formatGameDate(currentDate)}
          </span>
          <div
            aria-label="次の週まで"
            style={{
              width: 120,
              height: 6,
              background: '#0d0805',
              border: '2px solid #2c1f15',
            }}
          >
            <div
              style={{
                width: `${weekProgress}%`,
                height: '100%',
                background: '#5aa84a',
                transition: 'width 250ms linear',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

type StatusItemProps = {
  emoji: string;
  label: string;
  value: string;
  color: string;
};

const StatusItem = ({ emoji, label, value, color }: StatusItemProps) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
    <PixelIcon emoji={emoji} label={label} size={22} />
    <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
      <span style={{ fontSize: 9, color: '#c8b58a' }}>{label}</span>
      <span
        style={{
          fontSize: 13,
          color,
          fontVariantNumeric: 'tabular-nums',
          textShadow: '1px 1px 0 rgba(0,0,0,0.7)',
        }}
      >
        {value}
      </span>
    </div>
  </div>
);

const Divider = () => (
  <div
    aria-hidden
    style={{
      width: 2,
      height: 20,
      background: '#6b4f3a',
    }}
  />
);
