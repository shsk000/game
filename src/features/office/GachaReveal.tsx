import { useEffect, useState } from 'react';
import { PixelButton } from '../../components/ui';
import type { Candidate, Employee } from '../../state/types';
import { jobTitleOf, primarySkillOf, skillLabel, skillsAtCap } from '../../core/skills';
import { SKILL_CONFIG } from '../../data/balance';
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
  /** 在籍社員。主スキルの重複（2人目は分業ロス）を知らせるのに使う */
  roster: Employee[];
  onHire: () => void;
  onDismiss: () => void;
};

export const GachaReveal = ({
  candidate,
  funds,
  isFull,
  roster,
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

  // 主スキルを既に持っている社員がいるか（2人目は分業ロスで効率が落ちる）
  const primary = primarySkillOf(candidate.skills);
  const holder = primary
    ? roster.find((e) => (e.skills?.[primary] ?? 0) > 0)
    : undefined;
  const duplicateNote =
    primary && holder
      ? `${skillLabel(primary)}は ${holder.name} が担当中。2人目は ${Math.round(
          SKILL_CONFIG.secondMemberEfficiency * 100,
        )}% しか足されない`
      : null;

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
      {/* いちばん判断が要る場所＝雇うかどうかの瞬間に、
          「その分野は既にいる（2人目は効率が落ちる）」を出す */}
      {duplicateNote && (
        <div style={{ fontSize: 12, marginTop: 4, color: '#ffb454' }}>⚠ {duplicateNote}</div>
      )}
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
