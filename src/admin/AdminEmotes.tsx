import { useState } from 'react';
import { EmoteBubble } from '../components/EmoteBubble';
import {
  ALL_PLAN_EMOTES,
  PLAN_IDEA_EMOTES,
  type PlanEmoteDef,
  PLAN_THINKING_EMOTES,
} from '../core/planEmote';
import { OFFICE_LAYOUT, standingSprite, spriteFolderFor } from '../data/officeLayout';
import type { EmployeeRole } from '../state/types';

/**
 * /admin/emotes：企画会議で社員の頭上に出す「吹き出し一覧」プレビュー。
 * 実際の描画コンポーネント（EmoteBubble）と実素材（/sprites/ui/emote_*.png）を、
 * **ゲームと同じ縮尺**で描く。会議シーンは native を transform:scale で縮小しているため
 * （PlanMeetingBoard の PANEL_H/FOCUS_H）、ここでも native サイズで組んでから scale で縮める。
 * 素材を直接小さい px にすると 9-slice の border-width(13px 固定) が崩れるので必ず scale で縮める。
 */

// ゲーム内の会議シーン縮尺・寸法（出典を固定：手で当て推量しない）
const GAME_SCALE = 210 / 400; // PlanMeetingBoard: PANEL_H / FOCUS_H
const CHAR_SCALE = OFFICE_LAYOUT.charScale; // 2.5
const STANDING_PX = 124; // 立ち絵 rotations/*.png の実ピクセル
const CHAR_NATIVE = STANDING_PX * CHAR_SCALE; // 310（renderBandedSprite の charSize と同じ）
const BUBBLE_NATIVE = 52; // MeetingScene の EMOTE_BUBBLE_SIZE
const HEAD_FRAC = 0.25; // MeetingScene の HEAD_TOP_FRAC（立ち絵の実頭頂の実測値）
const HEAD_GAP = 16; // MeetingScene の EMOTE_HEAD_GAP
const BOX_W = CHAR_NATIVE; // native コンテンツ幅
const BOX_H = 360; // native コンテンツ高（頭上の吹き出し〜足元が収まる）

const DEMO_ROLES: EmployeeRole[] = ['programmer', 'designer', 'pr'];
const demoEmployee = (i: number) => ({ id: `emote-demo-${'abcdef'[i] ?? 'x'}`, role: DEMO_ROLES[i % 3] });

function EmoteCell({ def, charIndex, zoom }: { def: PlanEmoteDef; charIndex: number; zoom: number }) {
  const emp = demoEmployee(charIndex);
  const src = standingSprite(spriteFolderFor(emp), 'south');
  const scale = GAME_SCALE * zoom;
  const spriteTop = BOX_H - CHAR_NATIVE;
  const headTop = spriteTop + CHAR_NATIVE * HEAD_FRAC;
  const bubbleTop = headTop - BUBBLE_NATIVE - HEAD_GAP;
  return (
    <div style={{ display: 'inline-block' }}>
      <div
        style={{
          position: 'relative',
          width: BOX_W * scale,
          height: BOX_H * scale,
          overflow: 'hidden',
          background: '#14202c',
          border: '1px solid #2a3f52',
          borderRadius: 4,
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: BOX_W,
            height: BOX_H,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
          }}
        >
          <img
            src={src}
            width={CHAR_NATIVE}
            height={CHAR_NATIVE}
            style={{ position: 'absolute', left: 0, top: spriteTop, imageRendering: 'pixelated' }}
            alt={`${emp.role} のプレビュー立ち絵`}
          />
          <EmoteBubble def={def} animKey={0} x={BOX_W / 2} top={bubbleTop} size={BUBBLE_NATIVE} />
        </div>
      </div>
      <div style={{ textAlign: 'center', fontSize: 12, color: '#cfe4f2', marginTop: 4 }}>
        {def.id} <span style={{ color: '#7f96a6' }}>{def.emoji}</span>
      </div>
    </div>
  );
}

function Section({
  title,
  defs,
  from,
  zoom,
}: {
  title: string;
  defs: readonly PlanEmoteDef[];
  from: number;
  zoom: number;
}) {
  return (
    <section style={{ marginBottom: 8 }}>
      <h3 style={{ margin: '4px 0 10px' }}>{title}</h3>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        {defs.map((def, i) => (
          <EmoteCell key={def.id} def={def} charIndex={from + i} zoom={zoom} />
        ))}
      </div>
    </section>
  );
}

const ZOOMS = [
  { label: '実寸（ゲームと同じ）', v: 1 },
  { label: '×2', v: 2 },
  { label: '×3', v: 3 },
];

export const AdminEmotes = () => {
  const [zoom, setZoom] = useState(1);
  return (
    <div style={{ padding: 20, fontFamily: 'monospace', color: '#dce8f2' }}>
      <h2 style={{ marginTop: 0 }}>吹き出し一覧プレビュー（/admin/emotes）</h2>
      <p style={{ fontSize: 13, color: '#9fb8c8', lineHeight: 1.6 }}>
        企画会議で社員の頭上に出るエモート（全 {ALL_PLAN_EMOTES.length} 種）。
        枠は 9-slice のドット絵フキダシ、中身はドット絵アイコン（素材が無い環境では絵文字フォールバック）。
        <br />
        キャラ・吹き出しは<strong>ゲームと同じ縮尺（{Math.round(GAME_SCALE * 1000) / 1000}）</strong>
        で描画（＝実寸）。細部を見たい時は下のボタンで拡大。
      </p>
      <div style={{ display: 'flex', gap: 8, margin: '8px 0 16px' }}>
        {ZOOMS.map((z) => (
          <button
            key={z.v}
            type="button"
            onClick={() => setZoom(z.v)}
            style={{
              padding: '4px 10px',
              fontFamily: 'monospace',
              fontSize: 12,
              cursor: 'pointer',
              color: zoom === z.v ? '#0a1420' : '#cfe4f2',
              background: zoom === z.v ? '#9fd6ff' : '#12202e',
              border: '1px solid #2a3f52',
              borderRadius: 3,
            }}
          >
            {z.label}
          </button>
        ))}
      </div>
      <Section title="💡 ひらめき（idea：ワード確定時）" defs={PLAN_IDEA_EMOTES} from={0} zoom={zoom} />
      <Section title="💭 考え中（thinking：アンビエント）" defs={PLAN_THINKING_EMOTES} from={3} zoom={zoom} />
    </div>
  );
};
