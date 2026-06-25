import { type ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { PixelWindow } from './PixelWindow';

/**
 * モーダル基盤：背景 dim + 中央 PixelWindow。
 *
 * 用途：採用 / 規模解放 / 実績 / 設定 などの全画面オーバーレイ。
 *
 * 仕様：
 * - ESC キーで閉じる
 * - 背景クリックでも閉じる（`closeOnBackdrop` で抑止可）
 * - SKILL `baseline-ui` の `h-dvh` 準拠：`100dvh` で safe-area に追従
 * - SKILL `office-visual-design` のテイスト：dim は濃い茶
 */

type Props = {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  /** モーダル本体の最大幅 */
  maxWidth?: number;
  /** 背景クリックで閉じるか（デフォルト true） */
  closeOnBackdrop?: boolean;
  className?: string;
  bodyClassName?: string;
  bodyStyle?: React.CSSProperties;
};

export const PixelModal = ({
  open,
  onClose,
  title,
  children,
  maxWidth = 520,
  closeOnBackdrop = true,
  className,
  bodyClassName,
  bodyStyle,
}: Props) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  // document.body へ portal する。ゲーム本体（.game-root）は CSS transform で拡縮しており、
  // transform 祖先の内側だと position:fixed がビューポートでなく game-root 基準になり画面外へズレる。
  // body 直下に出すことで fixed が本来のビューポート中央基準に戻る。
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={typeof title === 'string' ? title : undefined}
      onClick={closeOnBackdrop ? onClose : undefined}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100dvw',
        height: '100dvh',
        background: 'rgba(8, 14, 26, 0.72)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        zIndex: 50,
        // safe-area 対応（fixed 要素のため）
        paddingTop: 'max(16px, env(safe-area-inset-top))',
        paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={className}
        style={{
          width: '100%',
          maxWidth,
          maxHeight: '90dvh',
          overflow: 'auto',
          // v0.11 G3：開く時のポップイン（離散 3 ステップ）
          animation: 'g-window-pop 160ms steps(3) both',
        }}
      >
        <PixelWindow
          title={title}
          variant="modal"
          bodyClassName={bodyClassName}
          bodyStyle={bodyStyle}
        >
          {children}
        </PixelWindow>
      </div>
    </div>,
    document.body,
  );
};
