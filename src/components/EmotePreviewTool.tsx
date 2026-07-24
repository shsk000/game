import { useEffect, useState } from 'react';
import { DEV_DONE_EMOTES, DEV_FOCUS_EMOTES, type DevEmoteEvent } from '../core/devEmote';
import type { PlanEmoteDef } from '../core/planEmote';
import { DevDeskScene } from './DevDeskScene';
import { EmoteBubble } from './EmoteBubble';

/**
 * /admin/emotes：開発フェーズのエモート吹き出しを一覧＋実シーンで確認するプレビュー。
 * 「適用しないと分からない」ため、着席デスクシーンに各エモートを巡回で当てて実機の見え方を出す。
 * 本編ゲームの state とは無関係（dev 専用）。
 */

const ALL: { def: PlanEmoteDef; kind: string }[] = [
  ...DEV_FOCUS_EMOTES.map((def) => ({ def, kind: '集中(ambient)' })),
  ...DEV_DONE_EMOTES.map((def) => ({ def, kind: '完了(done)' })),
];

// プレビュー用ダミー社員（役職で見た目が決まる）。3席ぶん。
const DUMMY_TEAM = [
  { id: 'prev-1', role: 'programmer' as const },
  { id: 'prev-2', role: 'designer' as const },
  { id: 'prev-3', role: 'pr' as const },
];

export function EmotePreviewTool() {
  // 着席シーンに巡回で当てるエモート
  const [idx, setIdx] = useState(0);
  const [keyN, setKeyN] = useState(0);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    if (!playing) return;
    const t = window.setInterval(() => {
      setIdx((i) => (i + 1) % ALL.length);
      setKeyN((k) => k + 1);
    }, 1300);
    return () => window.clearInterval(t);
  }, [playing]);

  const current = ALL[idx];
  const emote: DevEmoteEvent = { seat: 0, def: current.def, key: keyN };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0d1626',
        color: '#e6e9ef',
        fontFamily: 'monospace',
        padding: 20,
      }}
    >
      <h1 style={{ fontSize: 18, color: '#a6e138' }}>
        開発エモート プレビュー（/admin/emotes）
      </h1>
      <p style={{ fontSize: 12, color: '#8a93a4' }}>
        全 {ALL.length} 種。既存 6（…❓💤✨❗💡）＋ v0.32 新規 8（☕⚙💦🎵🔥💪✓❤）。
      </p>

      {/* ① 実シーンに適用（着席デスクシーンにエモートを巡回で当てる） */}
      <section style={{ marginTop: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <h2 style={{ fontSize: 14, color: '#a6e138', margin: 0 }}>① 着席シーンに適用</h2>
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            style={{
              fontFamily: 'inherit',
              fontSize: 12,
              padding: '3px 10px',
              background: '#141f14',
              color: '#c8e0c8',
              border: '1px dashed #7aa06a',
              cursor: 'pointer',
            }}
          >
            {playing ? '⏸ 停止' : '▶ 再生'}
          </button>
          <button
            type="button"
            onClick={() => {
              setIdx((i) => (i + 1) % ALL.length);
              setKeyN((k) => k + 1);
            }}
            style={{
              fontFamily: 'inherit',
              fontSize: 12,
              padding: '3px 10px',
              background: '#141b26',
              color: '#c8d2e0',
              border: '1px dashed #6a7686',
              cursor: 'pointer',
            }}
          >
            ⏭ 次へ
          </button>
          <span style={{ fontSize: 13, color: '#ffd166' }}>
            今：{current.def.id}（{current.kind}）
          </span>
        </div>
        {/* 開発フェーズ中央と同じ横幅・高さ感（約 590×150）で表示 */}
        <div style={{ width: 590, height: 150, border: '2px solid #2b3a1c' }}>
          <DevDeskScene employees={DUMMY_TEAM} emote={emote} />
        </div>
      </section>

      {/* ② 全エモート一覧（吹き出し枠つき） */}
      <section style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 14, color: '#a6e138' }}>② 全エモート一覧</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {ALL.map(({ def, kind }) => (
            <div
              key={def.id}
              style={{
                width: 96,
                height: 108,
                position: 'relative',
                background: '#111a26',
                border: '1px solid #2a3445',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'flex-end',
                paddingBottom: 6,
              }}
            >
              {/* 吹き出しは絶対配置なのでセル中央上に置く */}
              <div style={{ position: 'absolute', left: 0, top: 6, width: 96, height: 60 }}>
                <EmoteBubble def={def} animKey={0} x={48} top={4} size={52} />
              </div>
              <span style={{ fontSize: 11, color: '#e6e9ef' }}>{def.id}</span>
              <span style={{ fontSize: 9, color: '#8a93a4' }}>{kind}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
