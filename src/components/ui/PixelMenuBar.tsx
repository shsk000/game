import type { ReactNode } from 'react';
import { PixelIcon } from './PixelIcon';

/**
 * 画面下部の常駐 dock（v0.11 G5：リファレンス準拠のタイル型ボタン）。
 *
 * - 各メニューは四角いタイル（紺 + 細枠）。選択中は黄色タイル + 紺文字
 * - アイコン上 + ラベル下の縦構成
 * - dock 背景はさらに暗い紺
 */

export type PixelMenuItem = {
  id: string;
  label: string;
  /** アイコン画像のパス（無い場合は emoji フォールバック） */
  iconSrc?: string;
  emoji?: string;
  onClick?: () => void;
  disabled?: boolean;
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
        alignItems: 'center',
        gap: 6,
        padding: '8px 16px',
        height: 72,
        background: '#101c30',
        borderTop: '1px solid #4a6a9a',
        imageRendering: 'pixelated',
        flexShrink: 0,
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
  const { label, iconSrc, emoji, onClick, disabled } = item;
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        width: 64,
        height: 56,
        background: active ? '#ffd54a' : '#1e2d49',
        border: active ? '1px solid #ffd54a' : '1px solid #4a6a9a',
        color: active ? '#0a1422' : '#ffffff',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        fontFamily: 'inherit',
        fontWeight: 700,
        fontSize: 10,
        letterSpacing: '0.04em',
        imageRendering: 'pixelated',
        userSelect: 'none',
        borderRadius: 0,
      }}
    >
      <PixelIcon src={iconSrc} emoji={emoji ?? ''} label={label} size={24} />
      <span>{label}</span>
    </button>
  );
};
