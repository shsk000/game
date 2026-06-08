import { useGameStore } from '../../state/gameStore';
import { formatYen } from '../../utils/format';
import { PixelIcon } from './PixelIcon';

/**
 * 画面上部の常駐ステータスバー。
 *
 * 表示項目（Zustand store から取得）：
 * - 💰 資金 (funds)
 * - 👥 ファン (fans)
 * - 🧑‍💻 従業員数 (employees.length)
 * - 📚 作品数 (library.length)
 *
 * 仕様：
 * - SKILL `office-visual-design` §1 のカイロソフト風テイスト
 * - 黒板/レトロ電光掲示板風の濃い背景に明るい数字
 * - 数字は tabular-nums で揃える（SKILL `baseline-ui` 準拠）
 */

const formatNumber = (n: number): string => n.toLocaleString('ja-JP');

type Props = {
  className?: string;
  style?: React.CSSProperties;
};

export const PixelStatusBar = ({ className, style }: Props) => {
  const funds = useGameStore((s) => s.funds);
  const fans = useGameStore((s) => s.fans);
  const employeeCount = useGameStore((s) => s.employees.length);
  const workCount = useGameStore((s) => s.library.length);

  return (
    <div
      className={className}
      aria-label="ステータスバー"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 18,
        padding: '8px 16px',
        background: '#1a0f08',
        border: '4px solid #2c1f15',
        borderRadius: 2,
        color: '#fff8e0',
        boxShadow: 'inset 0 0 0 2px #6b4f3a, 4px 4px 0 rgba(0,0,0,0.45)',
        fontWeight: 700,
        letterSpacing: '0.06em',
        imageRendering: 'pixelated',
        ...style,
      }}
    >
      <StatusItem emoji="💰" label="資金" value={formatYen(funds)} color="#f5c84a" />
      <Divider />
      <StatusItem emoji="👥" label="ファン" value={formatNumber(fans)} color="#7adfff" />
      <Divider />
      <StatusItem emoji="🧑‍💻" label="従業員" value={`${employeeCount}人`} color="#9bff9b" />
      <Divider />
      <StatusItem emoji="📚" label="作品" value={`${workCount}本`} color="#ffb8d8" />
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
    <PixelIcon emoji={emoji} label={label} size={24} />
    <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
      <span style={{ fontSize: 10, color: '#c8b58a' }}>{label}</span>
      <span
        style={{
          fontSize: 14,
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
      width: 3,
      height: 24,
      background: '#6b4f3a',
      boxShadow: 'inset 0 0 0 1px #2c1f15',
    }}
  />
);
