import { type GameState, useGameStore } from './gameStore';

/**
 * テスト専用ヘルパー（testing-rules §3）。プロダクションコードから import しない。
 *
 * store を初期状態に戻し、partial で任意の状態を注入する。
 * getInitialState() はアクション込みの完全な初期オブジェクトを返すため、
 * replace（第2引数 true）で置き換えても安全。
 */
export const resetStore = (partial?: Partial<GameState>): void => {
  useGameStore.setState({ ...useGameStore.getInitialState(), ...partial }, true);
};
