import { page } from '@vitest/browser/context';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import App from './App';
import { useGameStore } from './state/gameStore';
import { resetStore } from './state/testing';

// 実時間 interval を持つ GlobalTicker と、スプライト描画が重い OfficeScreen は
// 配線テストの対象外なのでスタブする（testing-rules §3）
vi.mock('./components/GlobalTicker', () => ({
  GlobalTicker: () => null,
}));
vi.mock('./features/office/OfficeScreen', () => ({
  OfficeScreen: () => <div>オフィスステージ（スタブ）</div>,
}));

describe('App（ユースケース：画面のオーバーレイ切り替え）', () => {
  beforeEach(() => {
    resetStore({ tutorialDone: true });
  });

  it('screen=plan で企画会議オーバーレイが開く', async () => {
    resetStore({ tutorialDone: true, screen: 'plan' });
    render(<App />);
    await expect.element(page.getByText('📐 企画会議')).toBeInTheDocument();
  });

  it('screen 切り替えでオーバーレイが差し替わる', async () => {
    resetStore({ tutorialDone: true, screen: 'library' });
    render(<App />);
    await expect.element(page.getByText('📚 作品ライブラリ', { exact: true })).toBeInTheDocument();

    useGameStore.getState().goTo('collection');
    await expect
      .element(page.getByText('📖 ジャンル相性図鑑', { exact: true }))
      .toBeInTheDocument();
  });

  it('ゲームオーバーでモーダルが表示される', async () => {
    render(<App />);
    useGameStore.getState().triggerGameOver();
    await expect.element(page.getByText('💀 ゲームオーバー')).toBeInTheDocument();
  });
});
