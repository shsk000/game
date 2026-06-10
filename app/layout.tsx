import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import '../src/styles/global.css';

export const metadata: Metadata = {
  title: 'タイピング工場',
  description: 'タイピングでゲームを作る経営シミュレーション',
  icons: { icon: '/favicon.svg' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
