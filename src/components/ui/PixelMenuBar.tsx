import type { ReactNode } from 'react';
import { PixelIcon } from './PixelIcon';

/**
 * 画面下部の常駐 dock（v0.11 G5c：リファレンス実測準拠）。
 *
 * リファレンスの dock は「背景バーなし」— 床の上にタイルが直接浮く。
 * - 非選択タイル：白グレー #e8e6e0 + 黒枠 + 黒ラベル
 * - 選択中タイル：オレンジ #de934a + 白文字
 * - タイルは大きめ（88×60）、わずかな隙間で並ぶ
 */

export type PixelMenuItem = {
  id: string;
  label: string;
  /** アイコン画像のパス（無い場合は emoji フォールバック） */
  iconSrc?: string;
  emoji?: string;
  onClick?: () => void;
  disabled?: boolean;
  /** 未実装ティザー：薄グレー表示だがクリック可（disabled と違い onClick は生きる）。右上に「準備中」バッジを出す */
  dimmed?: boolean;
};

type Props = {
  items?: PixelMenuItem[];
  activeId?: string;
  children?: ReactNode;
  className?: string;
  style?: React.CSSProperties;
};

export const PixelMenuBar = ({ items, activeId, children, className, style }: Props) => {
  return (
    <nav
      className={className}
      aria-label="オフィスメニュー"
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-end',
        gap: 4,
        padding: '0 16px 6px',
        height: 72,
        // リファレンス準拠：dock に背景バーは無い（世界の上にタイルが浮く）
        background: 'transparent',
        imageRendering: 'pixelated',
        flexShrink: 0,
        pointerEvents: 'none',
        ...style,
      }}
    >
      {items?.map((item) => (
        <PixelMenuBarItem key={item.id} item={item} active={item.id === activeId} />
      ))}
      {children}
    </nav>
  );
};

type ItemProps = {
  item: PixelMenuItem;
  active: boolean;
};

const PixelMenuBarItem = ({ item, active }: ItemProps) => {
  const { label, iconSrc, emoji, onClick, disabled, dimmed } = item;
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      aria-label={dimmed ? `${label}（準備中）` : label}
      aria-pressed={active}
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        width: 88,
        height: 60,
        background: active ? '#de934a' : '#e8e6e0',
        border: '1px solid #10151c',
        color: active ? '#ffffff' : '#1c2228',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : dimmed ? 0.5 : 1,
        fontFamily: 'inherit',
        fontWeight: 700,
        fontSize: 11,
        letterSpacing: '0.04em',
        imageRendering: 'pixelated',
        userSelect: 'none',
        borderRadius: 0,
        boxShadow: '0 2px 4px rgba(0,0,0,0.35)',
        pointerEvents: 'auto',
        textShadow: active ? '1px 1px 0 rgba(0,0,0,0.3)' : 'none',
      }}
    >
      {dimmed && (
        <span
          style={{
            position: 'absolute',
            top: 2,
            right: 2,
            background: '#2e4568',
            color: '#ffffff',
            fontSize: 8,
            fontWeight: 700,
            letterSpacing: '0.02em',
            padding: '1px 3px',
            border: '1px solid #10151c',
            lineHeight: 1,
          }}
        >
          準備中
        </span>
      )}
      <PixelIcon src={iconSrc} emoji={emoji ?? ''} label={label} size={26} />
      <span>{label}</span>
    </button>
  );
};
