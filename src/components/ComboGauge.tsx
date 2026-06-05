type Props = {
  combo: number;
  /** 演出強度。1.0 をベースに表示色が変わる閾値 */
};

const TIERS: Array<{ at: number; label: string; cls: string }> = [
  { at: 50, label: '🔥 FEVER', cls: 'tier-fever' },
  { at: 30, label: '⚡ HOT', cls: 'tier-hot' },
  { at: 15, label: '✨ Good', cls: 'tier-good' },
  { at: 5, label: 'Combo', cls: 'tier-soft' },
];

const labelFor = (c: number) => {
  for (const t of TIERS) if (c >= t.at) return t;
  return null;
};

export const ComboGauge = ({ combo }: Props) => {
  const tier = labelFor(combo);
  const pct = Math.min(100, (combo / 60) * 100);
  return (
    <div className={`combo-gauge ${tier?.cls ?? ''}`}>
      <div className="combo-row">
        <span className="combo-label">{tier ? tier.label : 'コンボ'}</span>
        <span className="combo-value">{combo}</span>
      </div>
      <div className="combo-bar">
        <div className="combo-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};
