import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AdminApp } from './admin/AdminApp.tsx';
import App from './App.tsx';
import { OfficeEditorTool } from './components/OfficeEditorTool.tsx';
import { PropEditorTool } from './components/PropEditorTool.tsx';
import { bootGameStore } from './state/boot.ts';
import './styles/global.css';

// 起動時副作用（セーブ読込・オフライン収益・自動保存・window.__gs）はここで1回だけ配線する。
// ?seed=NN があれば乱数を seed 固定にする（e2e 決定化）。render の外で同期実行。
bootGameStore();

// dev 専用ツール（本編ゲームの state/screen とは無関係）。すべて /admin/* に集約：
// /admin/layout = オフィス配置ツール（背景基準：サイズ・移動領域・座席・遮蔽物＋歩行検証）。
//   スタンドアロン office-layout-tool.html（port 8931）と旧 ?walk（OfficeWalkTool）はこれに統合され廃止。
//   ?layout / ?walk は後方互換のエイリアス（2026-07-16 に /admin/layout へ移動）。
// /admin/props = 物体配置ツール（キャラ基準：PC・椅子などの位置/大きさ/奥行き）。
//   物体は今後増えるため、背景基準の layout ツールから切り出した専用ツール（2026-07-16）。
// /admin/images・/admin/compat 等 = 素材プレビュー／相性表（AdminApp が pathname で分岐。v0.21）。
const params = new URLSearchParams(window.location.search);
const path = window.location.pathname;
const dev =
  path === '/admin/props' ? (
    <PropEditorTool />
  ) : path === '/admin/layout' || params.has('layout') || params.has('walk') ? (
    <OfficeEditorTool />
  ) : path.startsWith('/admin') ? (
    <AdminApp />
  ) : null;

createRoot(document.getElementById('root')!).render(<StrictMode>{dev ?? <App />}</StrictMode>);
