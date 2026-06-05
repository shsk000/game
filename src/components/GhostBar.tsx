type Props = {
  elapsedSec: number;
  ghostSec: number | null;
};

const fmt = (s: number) => `${s.toFixed(2)}秒`;

export const GhostBar = ({ elapsedSec, ghostSec }: Props) => {
  if (ghostSec === null) {
    return (
      <div className="ghost-bar">
        <div className="ghost-label">経過</div>
        <div className="ghost-value">{fmt(elapsedSec)}</div>
        <div className="ghost-ghost">ゴースト: —（初挑戦）</div>
      </div>
    );
  }
  const diff = elapsedSec - ghostSec;
  const ahead = diff < 0;
  return (
    <div className="ghost-bar">
      <div className="ghost-label">経過</div>
      <div className="ghost-value">{fmt(elapsedSec)}</div>
      <div className={`ghost-diff ${ahead ? 'ahead' : 'behind'}`}>
        {ahead
          ? `ゴーストより ${Math.abs(diff).toFixed(2)}秒 速い！`
          : `ゴーストより ${diff.toFixed(2)}秒 遅れ`}
      </div>
      <div className="ghost-ghost">ゴースト: {fmt(ghostSec)}</div>
    </div>
  );
};
