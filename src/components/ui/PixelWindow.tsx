import type { ReactNode } from 'react';

/**
 * 9-slice ウィンドウ枠（タイトルバー付き / なし）。
 *
 * 仕様：
 * - SKILL `office-visual-design` §1 のカイロソフト風テイスト：
 *   太い黒アウトライン + クリーム系の背景 + 単色シェーディング
 * - 当面は CSS の `border` + 二重枠 で 9-slice 相当を表現
 * - 後で本素材ができたら `borderImage` プロパティで差し替えるだけ
 * - 子要素は `padding` 内に配置（`bodyClassName` でカスタム可）
 */

type Variant = 'standard' | 'emphasis' | 'modal' | 'navy';

type Props = {
  children: ReactNode;
  /** タイトル文字列（指定があればタイトルバー付きで描画） */
  title?: ReactNode;
  /** バリアント。標準 / 強調 / モーダル枠 */
  variant?: Variant;
  /** 9-slice 画像の URL（指定時のみ border-image を使う） */
  borderImageSrc?: string;
  className?: string;
  style?: React.CSSProperties;
  bodyClassName?: string;
  bodyStyle?: React.CSSProperties;
};

/**
 * v0.11 G4：Game Dev Story 風の濃紺パレットに全統一。
 * 濃紺 #1b2c47 / 暗紺 #0f1d33 / 枠 #0a1422 / ハイライト #3d5a85 / アクセント黄 #ffd54a
 */
const variantTokens: Record<Variant, { border: string; bg: string; title: string }> = {
  standard: {
    border: '3px solid #0a1422',
    bg: '#1b2c47',
    title: '#0f1d33',
  },
  emphasis: {
    border: '3px solid #0a1422',
    bg: '#24395c',
    title: '#2a4a73',
  },
  modal: {
    border: '4px solid #0a1422',
    bg: '#1b2c47',
    title: '#0f1d33',
  },
  navy: {
    border: '3px solid #0a1422',
    bg: '#1b2c47',
    title: '#0f1d33',
  },
};

export const PixelWindow = ({
  children,
  title,
  variant = 'standard',
  borderImageSrc,
  className,
  style,
  bodyClassName,
  bodyStyle,
}: Props) => {
  const tokens = variantTokens[variant];

  const frameStyle: React.CSSProperties = borderImageSrc
    ? {
        borderImage: `url("${borderImageSrc}") 8 fill / 8px / 0 round`,
        borderStyle: 'solid',
        borderWidth: 8,
        imageRendering: 'pixelated',
      }
    : {
        border: tokens.border,
        background: tokens.bg,
        boxShadow:
          variant === 'navy'
            ? 'inset 0 0 0 1px #3d5a85, 3px 3px 0 rgba(0,0,0,0.45)'
            : 'inset 0 0 0 1px #3d5a85, 4px 4px 0 rgba(0,0,0,0.35)',
        borderRadius: 2,
      };

  return (
    <div
      className={className}
      style={{
        position: 'relative',
        color: '#ffffff',
        ...frameStyle,
        ...style,
      }}
    >
      {title !== undefined && (
        <div
          style={{
            background: tokens.title,
            color: '#ffd54a',
            padding: '5px 10px',
            fontWeight: 700,
            letterSpacing: '0.08em',
            fontSize: 13,
            borderBottom: '2px solid #0a1422',
            // ピクセルフォント風にじにじ感を控えめに
            textShadow: '1px 1px 0 rgba(0,0,0,0.5)',
          }}
        >
          {title}
        </div>
      )}
      <div
        className={bodyClassName}
        style={{
          padding: 14,
          ...bodyStyle,
        }}
      >
        {children}
      </div>
    </div>
  );
};
