import { useEffect, useState } from 'react';
import { PixelButton } from '../../components/ui';
import type { Candidate, Employee } from '../../state/types';
import { monthsOfRunway, type EconomyCtx } from '../../core/economy';
import { jobTitleOf, skillsAtCap } from '../../core/skills';
import { formatRunway, formatYen, runwayColor } from '../../utils/format';
import { formatSkills, RANK_VISUAL } from './employeeDisplay';

/**
 * v0.22 採用ガチャのカード開封演出（spec v22 §6）。
 *
 * 裏面（クリックでスキップ可）→ 自動でめくり → ランク色フレーム＋候補情報。
 * S のみ全面フラッシュを重ねる。タイマーは演出専用（logic-architecture §5）。
 */

const REVEAL_DELAY_MS = 900;

type Props = {
  candidate: Candidate;
  funds: number;
  isFull: boolean;
  /** ランウェイ（採用前/採用後）の試算に使う。会社の今の状態 */
  economy: EconomyCtx;
  onHire: () => void;
  onDismiss: () => void;
};

export const GachaReveal = ({
  candidate,
  funds,
  isFull,
  economy,
  onHire,
  onDismiss,
}: Props) => {
  const [revealed, setRevealed] = useState(false);

  // マウント時に裏面→めくりの演出を1回走らせる。候補が変わったときの作り直しは
  // 呼び出し側が key={candidate.id} で remount することで担保する（deps は空でよい）。
  useEffect(() => {
    const t = setTimeout(() => setRevealed(true), REVEAL_DELAY_MS);
    return () => clearTimeout(t);
  }, []);

  const rank = candidate.rank ?? 'B';
  const rankVisual = RANK_VISUAL[rank];

  if (!revealed) {
    // カード裏面自体を button にしてキーボード到達・a11y を満たす（クリック/Enter でスキップ）
    return (
      <button
        type="button"
        className="gacha-card gacha-card-back"
        onClick={() => setRevealed(true)}
        data-testid="gacha-card-back"
      >
        <span className="gacha-card-back-mark">?</span>
        <span className="gacha-skip-note">クリックでスキップ</span>
      </button>
    );
  }

  return (
    <div
      className={`gacha-card gacha-card--${rank}`}
      style={{ position: 'relative' }}
      data-testid="gacha-card-front"
    >
      {rank === 'S' && <div className="gacha-s-flash" aria-hidden />}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span
          className={`gacha-rank-badge gacha-rank-badge--${rank}`}
          data-testid="gacha-rank-badge"
        >
          {rankVisual.label}
        </span>
        <span style={{ fontWeight: 700, fontSize: 16, flex: 1, marginLeft: 8, color: '#ffffff' }}>
          {candidate.name}
        </span>
        <span
          style={{
            fontSize: 12,
            padding: '2px 8px',
            background: '#2d6cb5',
            color: '#ffffff',
            borderRadius: 2,
          }}
        >
          {jobTitleOf(candidate.skills)}
        </span>
      </div>
      <div style={{ fontSize: 13, marginTop: 8, color: '#eef3fa' }}>
        {formatSkills(candidate.skills)}
      </div>
      {/* 育てきったときの値（docs/spec/score-model.md §1）。
          Lv1 はランクによらずほぼ同じなので、ここで初めてランクの意味が伝わる */}
      <div style={{ fontSize: 12, marginTop: 4, color: rankVisual.color, fontWeight: 700 }}>
        ▲ 育てば {formatSkills(skillsAtCap(candidate.skills, rank))}
      </div>
      {/* **採るとどうなるか**を採用前に出す（オーナー要望の「破産が理不尽」対策）。
          スキルだけ見て採ると月固定費が跳ね上がり、序盤は1〜2ヶ月で資金が尽きる。
          ランウェイの前後を並べれば「1人だけ採る」「先に数本回す」を選べる */}
      {(() => {
        const before = monthsOfRunway(economy);
        const after = monthsOfRunway(economy, [
          ...economy.employees,
          candidate as unknown as Employee,
        ]);
        const delta = after.monthly - before.monthly;
        // 雇用ボタンの額（`hireCandidate` が即座に引く）と月給は**同額だが別の支払い**。
        // 片方しか見えていないと「1回きり」と読めるので、両方を1行に書く
        return (
          <div style={{ fontSize: 12, marginTop: 8, color: '#c8d2e0', lineHeight: 1.6 }}>
            👛 いま <strong style={{ color: '#ffb454' }}>{formatYen(candidate.wage)}</strong>
            {' ＋ '}
            <strong style={{ color: '#ffb454' }}>毎月 {formatYen(delta)}</strong>
            <span style={{ opacity: 0.8 }}>
              {' '}
              （固定費 {formatYen(before.monthly)} → {formatYen(after.monthly)}/月）
            </span>
            <br />⏳ 資金がもつのは{' '}
            <span style={{ opacity: 0.8 }}>{formatRunway(before.months)}</span>
            {' → '}
            <strong
              style={{
                color:
                  runwayColor(after.months) === '#222a35' ? '#8fe0a0' : runwayColor(after.months),
              }}
            >
              {formatRunway(after.months)}
            </strong>
          </div>
        );
      })()}
      {isFull && (
        <div style={{ fontSize: 12, color: '#c66', marginTop: 6 }}>
          満席です（席を空けると雇用できます）
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
        <PixelButton variant="primary" disabled={funds < candidate.wage || isFull} onClick={onHire}>
          雇用する ¥{candidate.wage.toLocaleString()}
        </PixelButton>
        <PixelButton variant="secondary" onClick={onDismiss}>
          見送る
        </PixelButton>
      </div>
    </div>
  );
};
