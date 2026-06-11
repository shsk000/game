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
 * v0.11 G5c：リファレンス画像から実測した色（PIL でサンプリング）。
 * - タイトルバー：#214577（落ち着いた青）+ 白文字
 * - コンテンツ部分：#e0dfda（暖色オフホワイト）+ 黒系文字 #1c2228
 * - 枠：#10151c の細枠 1px
 */
const variantTokens: Record<Variant, { border: string; bg: string; title: string }> = {
  standard: {
    border: '1px solid #10151c',
    bg: '#e0dfda',
    title: '#214577',
  },
  emphasis: {
    border: '1px solid #10151c',
    bg: '#e0dfda',
    title: '#1a3a66',
  },
  modal: {
    border: '1px solid #10151c',
    bg: '#e0dfda',
    title: '#214577',
  },
  navy: {
    border: '1px solid #10151c',
    bg: '#e0dfda',
    title: '#214577',
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
        color: '#1c2228',
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
            borderBottom: '1px solid #10151c',
            textShadow: '1px 1px 0 rgba(0,0,0,0.4)',
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
