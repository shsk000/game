import { useGameStore } from '../state/gameStore';
import { formatYen } from '../utils/format';
import { PixelButton, PixelModal } from './ui';

/**
 * v0.10 §9-2：資金枯渇によるゲームオーバー画面。
 *
 *  - `funds < 0` で `gameStore.triggerGameOver()` が立てた gameOver フラグを描画契機にする
 *  - Phase 0 では「資金 0 = 即ゲームオーバー」とだけ表示
 *  - Phase 3-E の借金 UI 完成後は「借入上限超過」ケースだけがここに来る
 */
export const GameOverModal = () => {
  const funds = useGameStore((s) => s.funds);
  const reset = useGameStore((s) => s.reset);
  const clearGameOver = useGameStore((s) => s.clearGameOver);

  return (
    <PixelModal
      open={true}
      onClose={() => {
        // 閉じるだけでは復活しない。リセットボタン経由のみ。
        clearGameOver();
      }}
      title="💀 ゲームオーバー"
      maxWidth={420}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}>
          資金が尽きました。
          <br />
          現在の残高: <strong style={{ color: '#a02828' }}>{formatYen(funds)}</strong>
        </p>
        <p style={{ margin: 0, fontSize: 12, color: '#6b4f3a' }}>
          セーブデータをリセットして新規に再開してください。
        </p>
        <PixelButton
          variant="danger"
          onClick={() => {
            reset();
            clearGameOver();
          }}
        >
          リセットして再開
        </PixelButton>
      </div>
    </PixelModal>
  );
};
