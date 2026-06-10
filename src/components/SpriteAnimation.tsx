import { useEffect, useId, useState } from 'react';

/**
 * 横並びスプライトシートを CSS animation で再生するコンポーネント。
 *
 * 使い方:
 *   <SpriteAnimation sheet="/sprites/office/worker_walk_south.png" frames={6} fps={10} frameSize={48} />
 *
 * フレームは横一列に並んだPNG（width = frames × frameSize、height = frameSize）を前提。
 * シートが存在しない場合は fallback（emoji 等）を描画。
 */

type Props = {
  sheet: string;
  frames: number;
  fps?: number;
  /** 1フレームの実ピクセルサイズ（正方形を想定） */
  frameSize: number;
  /** 表示倍率（CSS拡大） */
  scale?: number;
  fallback?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
};

/** スプライト存在確認の簡易キャッシュ */
const sheetCache = new Map<string, boolean>();
const checkSheet = async (path: string): Promise<boolean> => {
  if (sheetCache.has(path)) return sheetCache.get(path) ?? false;
  try {
    const res = await fetch(path, { method: 'HEAD' });
    // Vite dev サーバーは存在しないパスにも 200 + index.html を返すため、
    // Content-Type が text/html なら「スプライト無し」と判定する
    const contentType = res.headers.get('content-type') ?? '';
    const ok = res.ok && !contentType.includes('text/html');
    sheetCache.set(path, ok);
    return ok;
  } catch {
    sheetCache.set(path, false);
    return false;
  }
};

export const SpriteAnimation = ({
  sheet,
  frames,
  fps = 10,
  frameSize,
  scale = 1,
  fallback,
  className,
  style,
}: Props) => {
  const [loaded, setLoaded] = useState(false);
  const animId = useId().replace(/[^a-zA-Z0-9_-]/g, '');

  useEffect(() => {
    checkSheet(sheet).then(setLoaded);
  }, [sheet]);

  const displaySize = frameSize * scale;
  const totalWidth = frames * frameSize;
  const totalWidthScaled = totalWidth * scale;
  const durationSec = frames / fps;
  const keyframesName = `sa-${animId}`;

  if (!loaded) {
    return (
      <div className={className} style={{ width: displaySize, height: displaySize, ...style }}>
        {fallback}
      </div>
    );
  }

  return (
    <>
      <style>{`
        @keyframes ${keyframesName} {
          from { background-position-x: 0; }
          to   { background-position-x: -${totalWidthScaled}px; }
        }
      `}</style>
      <div
        className={className}
        style={{
          width: displaySize,
          height: displaySize,
          backgroundImage: `url("${sheet}")`,
          backgroundRepeat: 'no-repeat',
          backgroundSize: `${totalWidthScaled}px ${displaySize}px`,
          imageRendering: 'pixelated',
          animation: `${keyframesName} ${durationSec}s steps(${frames}) infinite`,
          ...style,
        }}
      />
    </>
  );
};
