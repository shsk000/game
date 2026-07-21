import { useEffect, useMemo, useRef, useState } from 'react';
import {
  type MeetingSpot,
  WHITEBOARD_BOARD_RECT,
  WHITEBOARD_MEETING_SPOTS,
} from '../data/meetingScene';
import { DIR8, type Dir8, NATIVE_H, NATIVE_W } from '../data/officeLayout';
import type { EmployeeRole } from '../state/types';
import { MeetingScene, WhiteboardNotes } from './MeetingScene';

// 付箋プレビュー用のサンプル文言（実際は企画のアイデアキーワードが入る）。
const SAMPLE_CARDS = ['疾走感', '高難度', '爽快コンボ', '2人協力', 'レトロ', '秘密の扉', '連鎖', 'ボス戦', '収集要素'];

/**
 * /admin/meeting：ホワイトボード会議シーンの配置プレビュー＆調整ツール。
 *
 * - 背景オフィス＋会議スポットの立ち絵を実サイズ縮小で表示。
 * - 各キャラの足元ハンドルをドラッグして位置を調整、向きは選択して「向き」ボタンで Dir8 を巡回。
 * - 「JSONコピー」で spots を出力 → src/data/meetingScene.ts の WHITEBOARD_MEETING_SPOTS へ転記する。
 *
 * dev 専用（本編 state と無関係）。main.tsx が /admin/meeting で描画。
 */

const ROLES: EmployeeRole[] = ['programmer', 'designer', 'pr'];
// 見た目の多様性用のモック社員（spriteFolderFor は id ハッシュで性別、role でフォルダを決める）。
const mockEmployees = (n: number): { id: string; role: EmployeeRole }[] =>
  Array.from({ length: n }, (_, i) => ({ id: `meet-${i}-${'abcdefgh'[i] ?? 'x'}`, role: ROLES[i % 3] }));

export function MeetingPreviewTool() {
  const [spots, setSpots] = useState<MeetingSpot[]>(() =>
    WHITEBOARD_MEETING_SPOTS.map((s) => ({ ...s })),
  );
  const [selected, setSelected] = useState(0);
  const [noteCount, setNoteCount] = useState(6);
  const [boardRect, setBoardRect] = useState<[number, number, number, number]>(
    () => [...WHITEBOARD_BOARD_RECT] as [number, number, number, number],
  );
  const dragRef = useRef<number | null>(null);
  const rectDrag = useRef<null | { mode: 'move' | 'resize'; ox: number; oy: number }>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

  // ビューポートに収まる縮小率。ツールバー分の余白を引く。
  useEffect(() => {
    const fit = () =>
      setScale(Math.min((window.innerWidth - 32) / NATIVE_W, (window.innerHeight - 120) / NATIVE_H));
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  // ドラッグでスポットの足元座標（native）を更新。
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const r = stageRef.current?.getBoundingClientRect();
      if (!r) return;
      const nx = Math.round((e.clientX - r.left) / scale);
      const ny = Math.round((e.clientY - r.top) / scale);
      const rd = rectDrag.current;
      if (rd) {
        setBoardRect(([x, y, w, h]) =>
          rd.mode === 'move'
            ? [clamp(nx - rd.ox, 0, NATIVE_W - w), clamp(ny - rd.oy, 0, NATIVE_H - h), w, h]
            : [x, y, Math.max(24, nx - x), Math.max(18, ny - y)],
        );
        return;
      }
      const idx = dragRef.current;
      if (idx == null) return;
      setSpots((prev) =>
        prev.map((s, i) =>
          i === idx
            ? { ...s, x: clamp(nx, 0, NATIVE_W), y: clamp(ny, 0, NATIVE_H) }
            : s,
        ),
      );
    };
    const onUp = () => {
      dragRef.current = null;
      rectDrag.current = null;
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [scale]);

  const employees = useMemo(() => mockEmployees(spots.length), [spots.length]);

  const cycleDir = (i: number, delta: number) =>
    setSpots((prev) =>
      prev.map((s, k) =>
        k === i ? { ...s, dir: DIR8[(DIR8.indexOf(s.dir) + delta + 8) % 8] as Dir8 } : s,
      ),
    );

  const addPerson = () =>
    setSpots((prev) => [...prev, { x: NATIVE_W / 2, y: NATIVE_H / 2, dir: 'north' }]);
  const removeSelected = () =>
    setSpots((prev) => prev.filter((_, i) => i !== selected).map((s) => ({ ...s })));

  const json = JSON.stringify(spots, null, 2);
  const rectJson = `[${boardRect.join(', ')}]`;

  return (
    <div style={{ background: '#111', color: '#eee', minHeight: '100vh', fontFamily: 'monospace' }}>
      {/* ツールバー */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          padding: 8,
          flexWrap: 'wrap',
          borderBottom: '1px solid #333',
        }}
      >
        <strong style={{ color: '#8fd' }}>会議シーン配置 /admin/meeting</strong>
        <span>選択: #{selected}</span>
        <button type="button" onClick={() => cycleDir(selected, -1)} style={btn}>
          ◀ 向き
        </button>
        <span style={{ minWidth: 90 }}>{spots[selected]?.dir}</span>
        <button type="button" onClick={() => cycleDir(selected, 1)} style={btn}>
          向き ▶
        </button>
        <button type="button" onClick={addPerson} style={btn}>
          ＋人を追加
        </button>
        <button type="button" onClick={removeSelected} style={btn} disabled={spots.length <= 1}>
          − 選択を削除
        </button>
        <span style={{ color: '#888' }}>｜付箋</span>
        <button
          type="button"
          onClick={() => setNoteCount((n) => Math.max(0, n - 1))}
          style={btn}
        >
          −
        </button>
        <span style={{ minWidth: 60 }}>{noteCount}枚</span>
        <button
          type="button"
          onClick={() => setNoteCount((n) => Math.min(SAMPLE_CARDS.length, n + 1))}
          style={btn}
        >
          ＋
        </button>
        <button
          type="button"
          onClick={() => navigator.clipboard?.writeText(json)}
          style={{ ...btn, background: '#264' }}
        >
          配置JSONコピー
        </button>
        <button
          type="button"
          onClick={() => navigator.clipboard?.writeText(rectJson)}
          style={{ ...btn, background: '#642' }}
        >
          ボード枠JSONコピー
        </button>
        <span style={{ color: '#888' }}>○＝人（ドラッグ移動）、黄枠＝ボード枠（移動・右下で拡縮）。</span>
      </div>

      {/* ステージ（native を scale で縮小） */}
      <div style={{ padding: 16, overflow: 'auto' }}>
        <div
          style={{
            position: 'relative',
            width: NATIVE_W * scale,
            height: NATIVE_H * scale,
            outline: '1px solid #333',
          }}
        >
          <div
            ref={stageRef}
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: NATIVE_W,
              height: NATIVE_H,
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
            }}
          >
            <MeetingScene employees={employees} spots={spots} />
            {/* 付箋プレビュー（編集中のボード枠内に収まる） */}
            <WhiteboardNotes cards={SAMPLE_CARDS.slice(0, noteCount)} rect={boardRect} />
            {/* ボード枠エディタ（黄枠：本体ドラッグで移動、右下ハンドルで拡縮） */}
            <div
              onPointerDown={(e) => {
                e.preventDefault();
                const r = stageRef.current?.getBoundingClientRect();
                if (!r) return;
                const nx = (e.clientX - r.left) / scale;
                const ny = (e.clientY - r.top) / scale;
                rectDrag.current = { mode: 'move', ox: nx - boardRect[0], oy: ny - boardRect[1] };
              }}
              style={{
                position: 'absolute',
                left: boardRect[0],
                top: boardRect[1],
                width: boardRect[2],
                height: boardRect[3],
                border: '2px dashed #ff5',
                background: 'rgba(255,255,80,0.06)',
                boxSizing: 'border-box',
                cursor: 'move',
                zIndex: 90000,
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  top: -18,
                  left: 0,
                  fontSize: 12,
                  color: '#ff5',
                  whiteSpace: 'nowrap',
                }}
              >
                ボード枠 [{boardRect.join(',')}]
              </span>
              <div
                onPointerDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  rectDrag.current = { mode: 'resize', ox: 0, oy: 0 };
                }}
                style={{
                  position: 'absolute',
                  right: -8,
                  bottom: -8,
                  width: 16,
                  height: 16,
                  background: '#ff5',
                  border: '1px solid #000',
                  cursor: 'nwse-resize',
                }}
              />
            </div>
            {/* ドラッグ用ハンドル（足元） */}
            {spots.map((s, i) => (
              <button
                type="button"
                key={i}
                onPointerDown={(e) => {
                  e.preventDefault();
                  setSelected(i);
                  dragRef.current = i;
                }}
                title={`#${i} (${s.x},${s.y}) ${s.dir}`}
                style={{
                  position: 'absolute',
                  left: s.x,
                  top: s.y,
                  width: 26,
                  height: 26,
                  transform: 'translate(-50%, -50%)',
                  borderRadius: '50%',
                  border: `3px solid ${i === selected ? '#ffd166' : '#4af'}`,
                  background: 'rgba(0,0,0,0.35)',
                  color: '#fff',
                  cursor: 'grab',
                  fontSize: 12,
                  zIndex: 100000,
                  padding: 0,
                }}
              >
                {i}
              </button>
            ))}
          </div>
        </div>

        {/* JSON 出力（転記用） */}
        <div style={{ marginTop: 8, color: '#ff5', fontSize: 12 }}>
          WHITEBOARD_BOARD_RECT = {rectJson}
        </div>
        <pre
          style={{
            marginTop: 8,
            background: '#000',
            padding: 10,
            maxHeight: 160,
            overflow: 'auto',
            fontSize: 12,
          }}
        >
          {json}
        </pre>
      </div>
    </div>
  );
}

const btn: React.CSSProperties = {
  background: '#333',
  color: '#eee',
  border: '1px solid #555',
  padding: '4px 8px',
  cursor: 'pointer',
  fontFamily: 'monospace',
};
