import { useGameStore } from '../state/gameStore';
import { formatYen } from '../utils/format';
import { PixelButton, PixelModal } from './ui';

/**
 * v0.10 仕上げ §6-7：借入上限超過によるゲームオーバー画面。
 *
 *  発火条件は `monthlyTick`：
 *    - 月初固定費で資金がマイナス → 借金へ自動振替
 *    - 借金残高が借入上限（月固定費 × 12）を超え、かつ funds <= 0 で `triggerGameOver()`
 *
 *  単に資金が一時的に 0 だけではゲームオーバーにならない（借金枠で耐える）。
 */
export const GameOverModal = () => {
  const funds = useGameStore((s) => s.funds);
  const debt = useGameStore((s) => s.debt);
  const reset = useGameStore((s) => s.reset);
  const clearGameOver = useGameStore((s) => s.clearGameOver);

  return (
    <PixelModal
      open={true}
      onClose={() => {
        clearGameOver();
      }}
      title="💀 ゲームオーバー"
      maxWidth={420}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}>
          借入上限を超え、これ以上資金繰りができません。
          <br />
          残高: <strong style={{ color: '#ff6b6b' }}>{formatYen(funds)}</strong>
          <br />
          借金: <strong style={{ color: '#ff6b6b' }}>{formatYen(debt)}</strong>
        </p>
        <p style={{ margin: 0, fontSize: 12, color: '#9fb6d4' }}>
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
