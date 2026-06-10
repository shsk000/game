'use client';

import dynamic from 'next/dynamic';

/**
 * ゲーム本体は SSR 無効で読み込む。
 *
 * 理由：gameStore.ts がモジュールスコープで localStorage（セーブデータ）を
 * 読むため、サーバー側でモジュールを評価すると落ちる。完全クライアント
 * サイドのゲームなので prerender する意味もない。
 */
const App = dynamic(() => import('../src/App'), {
  ssr: false,
  loading: () => (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#000',
        color: '#ffd54a',
        fontWeight: 700,
        letterSpacing: '0.1em',
      }}
    >
      NOW LOADING...
    </div>
  ),
});

export default function Page() {
  return <App />;
}
