import type { ReactNode } from 'react';
import { PixelIcon } from './PixelIcon';

/**
 * オフィス画面下部の常駐メニューバー。アイコン横並び、選択中はハイライト。
 *
 * 使い方：
 *   <PixelMenuBar
 *     items={[
 *       { id: 'plan', label: '計画', emoji: '📋', onClick: () => goTo('plan') },
 *       ...
 *     ]}
 *     activeId="plan"
 *   />
 *
 * もしくは `children` で自由に PixelMenuBarItem を並べる。
 *
 * 仕様：
 * - SKILL `office-visual-design` §1 のカイロソフト風テイスト
 * - 選択中アイテムは黄色ハイライト + 上方向に少し浮き出す（transform）
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
        gap: 8,
        padding: '10px 16px',
        height: 84,
        background: '#0f1d33',
        borderTop: '4px solid #0a1422',
        boxShadow: 'inset 0 2px 0 #3d5a85',
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
        gap: 2,
        padding: '6px 10px 4px',
        background: active ? '#ffd54a' : 'transparent',
        border: active ? '3px solid #0a1422' : '3px solid transparent',
        color: active ? '#1a0f08' : '#fff8e0',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        fontFamily: 'inherit',
        fontWeight: 700,
        fontSize: 11,
        letterSpacing: '0.04em',
        transform: active ? 'translate(0, -2px)' : 'translate(0, 0)',
        transition: 'transform 80ms steps(1)',
        imageRendering: 'pixelated',
        boxShadow: active ? 'inset 0 0 0 1px #fff8e0' : 'none',
        userSelect: 'none',
        minWidth: 56,
      }}
    >
      <PixelIcon src={iconSrc} emoji={emoji ?? ''} label={label} size={28} />
      <span style={{ textShadow: active ? 'none' : '1px 1px 0 rgba(0,0,0,0.6)' }}>{label}</span>
    </button>
  );
};
