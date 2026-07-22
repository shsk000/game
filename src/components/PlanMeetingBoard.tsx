import { useEffect, useRef, useState } from 'react';
import { WHITEBOARD_MEETING_SPOTS } from '../data/meetingScene';
import type { EmployeeRole } from '../state/types';
import { MeetingScene, WhiteboardNotes } from './MeetingScene';

/**
 * v0.26 B：企画フェーズの「企画中の様子」を、ホワイトボードを社員が取り囲むオフィス会議シーンにする。
 * 打鍵で増える**アイデア付箋（cards）をホワイトボード板面に貼り付け**、企画メモ（memos）は
 * 左下に半透明ノートで重ねる。旧 PlanBoard（メモ紙＋コルクボード）を置き換える。
 *
 * 背景シーン（native 1445×1088）を、ホワイトボード周辺だけが見えるように transform で寄せて表示。
 * 付箋は同じ transform 空間（native 座標）の子として置くので、板面にピタリと乗る。
 */

const PANEL_H = 210;
// 表示の中心（native）と縦に見せる高さ。ホワイトボード＋社員の全身（足元）まで入る範囲。
const FOCUS_CX = 812;
const FOCUS_CY = 285;
const FOCUS_H = 400;

export const PlanMeetingBoard = ({
  employees,
  memos,
  cards,
}: {
  employees: { id: string; role: EmployeeRole }[];
  memos: string[];
  cards: string[];
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelW, setPanelW] = useState(680);

  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setPanelW(el.clientWidth));
    ro.observe(el);
    setPanelW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const k = PANEL_H / FOCUS_H; // 縦を PANEL_H に合わせる縮小率
  const tx = panelW / 2 - k * FOCUS_CX;
  const ty = PANEL_H / 2 - k * FOCUS_CY;

  // 5スポットぶんを社員で埋める（少なければ巡回して満席に見せる）。
  const cast =
    employees.length > 0
      ? WHITEBOARD_MEETING_SPOTS.map((_, i) => employees[i % employees.length])
      : [];

  return (
    <div
      ref={panelRef}
      style={{
        position: 'relative',
        height: PANEL_H,
        width: '100%',
        overflow: 'hidden',
        border: '2px solid #2b3a1c',
        background: '#05080c',
        imageRendering: 'pixelated',
      }}
    >
      {/* ラベル */}
      <span
        style={{
          position: 'absolute',
          top: 4,
          left: 6,
          zIndex: 5,
          fontSize: 10,
          fontWeight: 700,
          color: '#ffd166',
          textShadow: '0 1px 2px #000',
        }}
      >
        💡 企画会議（ホワイトボード）
      </span>

      {/* 会議シーン（native）を transform で寄せて表示。付箋は同じ空間の子。 */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: 1445,
          height: 1088,
          transform: `translate(${tx}px, ${ty}px) scale(${k})`,
          transformOrigin: 'top left',
        }}
      >
        <MeetingScene employees={cast} />
        {/* アイデア付箋：ホワイトボード板面に貼る（native 座標） */}
        <WhiteboardNotes cards={cards} />
      </div>

      {/* 企画メモ（左下に半透明ノート、直近数件） */}
      <div
        style={{
          position: 'absolute',
          left: 6,
          bottom: 6,
          width: '46%',
          maxHeight: PANEL_H - 30,
          overflow: 'hidden',
          background: 'rgba(244,236,217,0.9)',
          border: '1px solid #cdbd97',
          borderRadius: 2,
          padding: '4px 8px',
          zIndex: 10,
        }}
      >
        <span style={{ fontSize: 9, fontWeight: 700, color: '#6b5b34' }}>📝 企画メモ</span>
        {memos.length === 0 ? (
          <div style={{ fontSize: 10, color: '#8a7a52' }}>会議中…</div>
        ) : (
          memos.slice(-3).map((m, i) => (
            <div
              key={`${i}-${m}`}
              style={{
                fontSize: 10,
                color: '#3a3016',
                lineHeight: '13px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              ・{m}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
