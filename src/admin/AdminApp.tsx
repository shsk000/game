import { AdminCompatMatrix } from './AdminCompatMatrix';
import { AdminEcon } from './AdminEcon';
import { AdminEmotes } from './AdminEmotes';
import { AdminImageGallery } from './AdminImageGallery';

/**
 * /admin/* 専用のミニアプリ（dev 専用・本編ゲームとは無関係）。
 * main.tsx で pathname を見て ReactDOM 直下に差し込む（ゲーム側の store/screen 遷移とは独立）。
 * ?tuner= / ?layout= と同じく「切替時はページ遷移で読み込み直す」前提の簡易ツール群。
 */

const NAV_STYLE: React.CSSProperties = {
  display: 'flex',
  gap: 12,
  padding: '10px 16px',
  background: '#12202e',
  borderBottom: '2px solid #2a3f52',
  fontFamily: 'monospace',
  fontSize: 13,
};

const linkStyle: React.CSSProperties = { color: '#9fd6ff' };

const AdminNav = () => (
  <nav style={NAV_STYLE}>
    <strong style={{ color: '#fff' }}>🛠 admin</strong>
    <a href="/admin/images" style={linkStyle}>
      画像一覧
    </a>
    <a href="/admin/compat" style={linkStyle}>
      相性表
    </a>
    <a href="/admin/econ" style={linkStyle}>
      お金デバッグ
    </a>
    <a href="/admin/emotes" style={linkStyle}>
      吹き出し一覧
    </a>
  </nav>
);

const AdminIndex = () => (
  <div style={{ padding: 20, fontFamily: 'monospace', color: '#dce8f2' }}>
    <p>開発用ツール一覧：</p>
    <ul>
      <li>
        <a href="/admin/images" style={linkStyle}>
          /admin/images
        </a>
        　ジャンル別スプライト/背景画像の一覧（欠落チェック用）
      </li>
      <li>
        <a href="/admin/compat" style={linkStyle}>
          /admin/compat
        </a>
        　ジャンル×テーマ相性倍率の全組み合わせ一覧（バランス確認用）
      </li>
      <li>
        <a href="/admin/econ" style={linkStyle}>
          /admin/econ
        </a>
        　お金デバッグ（セーブの資金を追加/セット。リロードで反映）
      </li>
      <li>
        <a href="/admin/emotes" style={linkStyle}>
          /admin/emotes
        </a>
        　企画会議の吹き出し（エモート）一覧プレビュー
      </li>
    </ul>
  </div>
);

export const AdminApp = () => {
  const path = window.location.pathname.replace(/\/+$/, '') || '/admin';

  let body: React.ReactNode;
  if (path === '/admin/images') {
    body = <AdminImageGallery />;
  } else if (path === '/admin/compat') {
    body = <AdminCompatMatrix />;
  } else if (path === '/admin/econ') {
    body = <AdminEcon />;
  } else if (path === '/admin/emotes') {
    body = <AdminEmotes />;
  } else {
    body = <AdminIndex />;
  }

  // global.css は本編ゲーム用に html/body/#root を overflow:hidden で固定している
  // （1280×720に収める設計）。admin は縦に長い一覧を出すツールなのでここだけ縦スクロールを戻す。
  return (
    <div style={{ height: '100%', overflowY: 'auto', background: '#0a1420' }}>
      <AdminNav />
      {body}
    </div>
  );
};
