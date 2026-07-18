import { useState } from 'react';
import { GENRES, genreBackgroundUrl, genreSpriteUrl } from '../data/genres';
import { GraphicsCanvasPanel } from '../features/develop/DevelopScreen';

/**
 * ジャンル別の「実装中の様子」デザイン画面パネル（GraphicsCanvasPanel）を、本編と全く同じ
 * コンポーネントでプレビューする。生の画像サムネイルではなく実際の合成結果（objectFit:cover
 * のクロップ・bgColorとのグラデーション馴染ませ・キラキラ演出込み）でないと素材の見え方は
 * 検証できないため、DevelopScreen.tsx からコンポーネントをそのままexportして再利用している。
 */

/**
 * 本編でパネルが実際に描画される幅。**ブラウザ実測値**（開発フェーズの DevelopScreen で
 * getBoundingClientRect したもの。`.develop-screen` が 1280 ではなく 1200px である等、
 * 机上計算では追えない差があるため必ず実測で合わせる）。
 * ここがズレると objectFit:cover のクロップの見え方が変わって素材の検証にならない。
 */
const PANEL_WIDTH = 588;

/** 画像が404の場合だけ小さく警告を出す（実パネル自体は壊れたimgのまま表示させる＝実際の見え方）*/
const MissingProbe = ({ label, url }: { label: string; url: string }) => {
  const [missing, setMissing] = useState(false);
  return (
    <>
      <img src={url} alt="" style={{ display: 'none' }} onError={() => setMissing(true)} />
      {missing && (
        <div style={{ fontSize: 10, color: '#ff8a8a' }}>
          ❌ {label} 未配置: <code>{url}</code>
        </div>
      )}
    </>
  );
};

export const AdminImageGallery = () => {
  return (
    <div style={{ padding: 20, fontFamily: 'monospace', color: '#dce8f2' }}>
      <h2 style={{ fontSize: 16, marginBottom: 4 }}>
        ジャンル画像プレビュー（{GENRES.length}種・実表示コンポーネント使用）
      </h2>
      <p style={{ fontSize: 12, color: '#9fb6d4', marginBottom: 16 }}>
        DevelopScreen「🎨デザイン画面」パネルと同一コンポーネント・同一幅（{PANEL_WIDTH}px＝実測値）
        で描画 ＝ 本編での実際の見え方そのもの
      </p>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(auto-fill, ${PANEL_WIDTH + 20}px)`,
          gap: 16,
        }}
      >
        {GENRES.map((g) => (
          <div
            key={g.id}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              padding: 10,
              background: '#101c2a',
              border: '2px solid #223448',
            }}
          >
            <div style={{ fontSize: 13 }}>
              {g.emoji} {g.name} <span style={{ color: '#5a7086' }}>({g.id})</span>
            </div>
            <div style={{ width: PANEL_WIDTH }}>
              <GraphicsCanvasPanel frame={4} stage={2} genre={g} />
            </div>
            <MissingProbe label="sprite" url={genreSpriteUrl(g.id)} />
            <MissingProbe label="bg" url={genreBackgroundUrl(g.id)} />
          </div>
        ))}
      </div>
    </div>
  );
};
