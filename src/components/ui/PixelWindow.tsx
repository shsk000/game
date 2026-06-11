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
 * v0.11 G5：リファレンス画像準拠の窓スタイル。
 * - 枠は細い 1px の明るい青グレー（太い黒枠 + ハード影は使わない）
 * - 本体 #1e2d49 / タイトルバー #15223a + 白文字（黄色ではない）
 */
const variantTokens: Record<Variant, { border: string; bg: string; title: string }> = {
  standard: {
    border: '1px solid #4a6a9a',
    bg: '#1e2d49',
    title: '#15223a',
  },
  emphasis: {
    border: '1px solid #5a7aac',
    bg: '#22335a',
    title: '#1a2a4a',
  },
  modal: {
    border: '1px solid #4a6a9a',
    bg: '#1e2d49',
    title: '#15223a',
  },
  navy: {
    border: '1px solid #4a6a9a',
    bg: '#1e2d49',
    title: '#15223a',
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
        boxShadow: '0 2px 6px rgba(0,0,0,0.35)',
        borderRadius: 0,
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
            color: '#ffffff',
            padding: '4px 8px',
            fontWeight: 700,
            letterSpacing: '0.06em',
            fontSize: 12,
            borderBottom: '1px solid #4a6a9a',
            textShadow: '1px 1px 0 rgba(0,0,0,0.5)',
          }}
        >
          {title}
        </div>
      )}
      <div
        className={bodyClassName}
        style={{
          padding: 10,
          ...bodyStyle,
        }}
      >
        {children}
      </div>
    </div>
  );
};
