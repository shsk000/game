import { type ReactNode, useState } from 'react';

/**
 * ピクセルアート風ボタン（3状態：idle / hover / press）。
 *
 * 仕様：
 * - SKILL `office-visual-design` §1 のカイロソフト風テイスト
 * - press 時は `translate(0, 2px)` で「沈み込む」感を出す
 *   （SKILL `baseline-ui` の compositor props 制約に準拠）
 * - 当面は CSS だけで描画。後で `backgroundImage` で 3状態スプライトに差し替え可能
 */

type Size = 'small' | 'medium' | 'large';
type Variant = 'primary' | 'secondary' | 'danger';

type Props = {
  children: ReactNode;
  onClick?: () => void;
  size?: Size;
  variant?: Variant;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  className?: string;
  style?: React.CSSProperties;
  /** 3状態スプライト画像の URL（指定時のみ画像背景） */
  spriteSrc?: string;
  /** スプライトの 1状態あたりの幅 px（spriteSrc 指定時のみ） */
  spriteFrameWidth?: number;
  /** スプライトの高さ px（spriteSrc 指定時のみ） */
  spriteFrameHeight?: number;
  ariaLabel?: string;
};

const sizeTokens: Record<Size, { padX: number; padY: number; font: number }> = {
  small: { padX: 10, padY: 4, font: 12 },
  medium: { padX: 16, padY: 8, font: 14 },
  large: { padX: 22, padY: 12, font: 18 },
};

const variantTokens: Record<
  Variant,
  { bg: string; bgHover: string; border: string; text: string }
> = {
  primary: {
    bg: '#5aa84a',
    bgHover: '#6dbc5a',
    border: '#1a0f08',
    text: '#fff8e0',
  },
  secondary: {
    bg: '#d8c089',
    bgHover: '#e8d09a',
    border: '#1a0f08',
    text: '#1a0f08',
  },
  danger: {
    bg: '#c84a3a',
    bgHover: '#d85a4a',
    border: '#1a0f08',
    text: '#fff8e0',
  },
};

export const PixelButton = ({
  children,
  onClick,
  size = 'medium',
  variant = 'primary',
  disabled = false,
  type = 'button',
  className,
  style,
  spriteSrc,
  spriteFrameWidth,
  spriteFrameHeight,
  ariaLabel,
}: Props) => {
  const [hover, setHover] = useState(false);
  const [pressed, setPressed] = useState(false);
  const tokens = sizeTokens[size];
  const colors = variantTokens[variant];

  // スプライト指定時の状態別位置：idle=0, hover=1, press=2
  const spriteState = disabled ? 0 : pressed ? 2 : hover ? 1 : 0;

  const spriteBg: React.CSSProperties =
    spriteSrc && spriteFrameWidth && spriteFrameHeight
      ? {
          backgroundImage: `url("${spriteSrc}")`,
          backgroundRepeat: 'no-repeat',
          backgroundSize: `${spriteFrameWidth * 3}px ${spriteFrameHeight}px`,
          backgroundPosition: `-${spriteState * spriteFrameWidth}px 0`,
          width: spriteFrameWidth,
          height: spriteFrameHeight,
          imageRendering: 'pixelated',
          border: 'none',
          background: undefined,
        }
      : {};

  const cssBg: React.CSSProperties = spriteSrc
    ? {}
    : {
        background: hover && !disabled ? colors.bgHover : colors.bg,
        border: `3px solid ${colors.border}`,
        color: colors.text,
        padding: `${tokens.padY}px ${tokens.padX}px`,
        fontSize: tokens.font,
        boxShadow: pressed
          ? 'inset 2px 2px 0 rgba(0,0,0,0.35)'
          : 'inset 0 0 0 2px rgba(255,255,255,0.35), 3px 3px 0 rgba(0,0,0,0.5)',
      };

  return (
    <button
      type={type}
      onClick={disabled ? undefined : onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => {
        setHover(false);
        setPressed(false);
      }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') setPressed(true);
      }}
      onKeyUp={() => setPressed(false)}
      disabled={disabled}
      aria-label={ariaLabel}
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        fontFamily: 'inherit',
        fontWeight: 700,
        letterSpacing: '0.06em',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        transform: pressed && !disabled ? 'translate(2px, 2px)' : 'translate(0, 0)',
        transition: 'transform 60ms steps(1)',
        imageRendering: 'pixelated',
        userSelect: 'none',
        ...cssBg,
        ...spriteBg,
        ...style,
      }}
    >
      {children}
    </button>
  );
};
