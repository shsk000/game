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

type Variant = 'standard' | 'emphasis' | 'modal';

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

const variantTokens: Record<Variant, { border: string; bg: string; title: string }> = {
  standard: {
    border: '4px solid #2c1f15',
    bg: '#f5e8c8',
    title: '#3a2a1e',
  },
  emphasis: {
    border: '4px solid #2c1f15',
    bg: '#fff4d0',
    title: '#a86a1e',
  },
  modal: {
    border: '5px solid #1a0f08',
    bg: '#f8ecc8',
    title: '#2c1f15',
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
        boxShadow: 'inset 0 0 0 2px #fff8e0, 4px 4px 0 rgba(0,0,0,0.35)',
        borderRadius: 2,
      };

  return (
    <div
      className={className}
      style={{
        position: 'relative',
        color: '#1a0f08',
        ...frameStyle,
        ...style,
      }}
    >
      {title !== undefined && (
        <div
          style={{
            background: tokens.title,
            color: '#fff8e0',
            padding: '6px 12px',
            fontWeight: 700,
            letterSpacing: '0.08em',
            fontSize: 14,
            borderBottom: '3px solid #1a0f08',
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
