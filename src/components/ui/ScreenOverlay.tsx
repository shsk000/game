import { type ReactNode, useEffect } from 'react';

/**
 * v0.11 G2：画面遷移の代わりに使う「オーバーレイ窓」。
 *
 * ゲーム UI の文法：メニュー画面はページ遷移ではなく、生きている世界
 * （オフィスステージ）の上に窓として重なる。背後では時間も売上も進み続ける。
 *
 * - backdrop：rgba 黒 62%、クリックで閉じる（closable のとき）
 * - 窓：1160×640 中央固定、steps() ポップイン
 * - ESC キーで閉じる（closable のとき）
 * - タイトルバー + ✕ ボタン
 */
type Props = {
  title: ReactNode;
  children: ReactNode;
  /** 閉じる操作（✕・ESC・背景クリック）を受けるか。リリース演出中などは false */
  onClose?: () => void;
  /** 窓のサイズ上書き */
  width?: number;
  height?: number;
};

export const ScreenOverlay = ({ title, children, onClose, width, height }: Props) => {
  useEffect(() => {
    if (!onClose) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="overlay-backdrop"
      onClick={(e) => {
        if (onClose && e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className="overlay-window" style={{ width, height }}>
        <div className="overlay-titlebar">
          <span>{title}</span>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="閉じる"
              style={{
                width: 26,
                height: 26,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#a03030',
                color: '#ffffff',
                border: '2px solid #0a1422',
                fontFamily: 'inherit',
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
                imageRendering: 'pixelated',
                lineHeight: 1,
              }}
            >
              ✕
            </button>
          )}
        </div>
        <div className="overlay-body">{children}</div>
      </div>
    </div>
  );
};
