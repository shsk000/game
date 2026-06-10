import { GameOverModal } from './components/GameOverModal';
import { GlobalTicker } from './components/GlobalTicker';
import { ScreenOverlay } from './components/ui';
import { CollectionScreen } from './features/collection/CollectionScreen';
import { DevelopScreen } from './features/develop/DevelopScreen';
import { LibraryScreen } from './features/library/LibraryScreen';
import { OfficeScreen } from './features/office/OfficeScreen';
import { PlanScreen } from './features/plan/PlanScreen';
import { ReleaseScreen } from './features/release/ReleaseScreen';
import { useGameStore } from './state/gameStore';

/**
 * v0.11 G2：ゲーム UI の文法に基づく画面構成。
 *
 * - オフィス = 常に描画される「生きている世界」（ステージ）。時間・売上は裏で進み続ける
 * - 計画 / 作品 / 図鑑 / リリース = ステージの上に重なるオーバーレイ窓（ページ遷移しない）
 * - 開発 = タイピングに集中するフルスクリーンテイクオーバー（RPG の戦闘画面と同じ文法）
 */
export default function App() {
  const screen = useGameStore((s) => s.screen);
  const gameOver = useGameStore((s) => s.gameOver);
  const goTo = useGameStore((s) => s.goTo);

  // 開発中はフルスクリーンテイクオーバー（ステージは描画しない＝タイピング集中）
  if (screen === 'develop') {
    return (
      <div className="game-root">
        <GlobalTicker />
        <DevelopScreen />
        {gameOver && <GameOverModal />}
      </div>
    );
  }

  return (
    <div className="game-root">
      <GlobalTicker />

      {/* 世界ステージ（常時描画・常時進行） */}
      <OfficeScreen />

      {/* オーバーレイ窓：世界の上に重なる */}
      {screen === 'plan' && (
        <ScreenOverlay title="📐 企画会議" onClose={() => goTo('office')}>
          <PlanScreen />
        </ScreenOverlay>
      )}
      {screen === 'library' && (
        <ScreenOverlay title="📚 作品ライブラリ" onClose={() => goTo('office')}>
          <LibraryScreen />
        </ScreenOverlay>
      )}
      {screen === 'collection' && (
        <ScreenOverlay title="📖 ジャンル相性図鑑" onClose={() => goTo('office')}>
          <CollectionScreen />
        </ScreenOverlay>
      )}
      {screen === 'release' && (
        <ScreenOverlay title="📰 リリース">
          <ReleaseScreen />
        </ScreenOverlay>
      )}

      {gameOver && <GameOverModal />}
    </div>
  );
}
