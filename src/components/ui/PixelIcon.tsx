import { useEffect, useState } from 'react';

/**
 * 32×32px のピクセルアイコン。
 *
 * - `src` 指定があれば PNG を `image-rendering: pixelated` で描画
 * - 画像が無ければ `emoji` (fallback) を表示
 * - 後から本素材ができたら `src` を差し替えるだけ
 *
 * 仕様：
 * - SKILL `pixelart-prompting` §10 の 32×32 規格に準拠
 * - SKILL `office-visual-design` §1 のカイロソフト風テイストに合わせ、
 *   emoji フォールバックも太枠（CSS）に乗せて統一感を出す
 */

type Props = {
  /** アイコン画像のパス（無い場合は emoji フォールバック） */
  src?: string;
  /** 画像が無い時に表示する絵文字 */
  emoji?: string;
  /** ラベル（aria-label に使う） */
  label?: string;
  /** 表示サイズ（px）。32 がデフォルト */
  size?: number;
  className?: string;
  style?: React.CSSProperties;
};

const iconCache = new Map<string, boolean>();
const checkIcon = async (path: string): Promise<boolean> => {
  if (iconCache.has(path)) return iconCache.get(path) ?? false;
  try {
    const res = await fetch(path, { method: 'HEAD' });
    // Vite dev サーバーは存在しないパスにも 200 + index.html を返すため、
    // Content-Type が text/html なら「スプライト無し」と判定する
    const contentType = res.headers.get('content-type') ?? '';
    const ok = res.ok && !contentType.includes('text/html');
    iconCache.set(path, ok);
    return ok;
  } catch {
    iconCache.set(path, false);
    return false;
  }
};

export const PixelIcon = ({ src, emoji = '', label, size = 32, className, style }: Props) => {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!src) {
      setLoaded(false);
      return;
    }
    checkIcon(src).then(setLoaded);
  }, [src]);

  if (src && loaded) {
    return (
      <img
        src={src}
        alt={label ?? ''}
        width={size}
        height={size}
        className={className}
        style={{
          imageRendering: 'pixelated',
          display: 'inline-block',
          verticalAlign: 'middle',
          ...style,
        }}
      />
    );
  }

  return (
    <span
      aria-label={label}
      role={label ? 'img' : undefined}
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        fontSize: Math.round(size * 0.78),
        lineHeight: 1,
        // emoji を粗くピクセル風に寄せるためのフィルタ（控えめ）
        filter: 'contrast(1.05) saturate(1.1)',
        ...style,
      }}
    >
      {emoji}
    </span>
  );
};
