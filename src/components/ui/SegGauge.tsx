/**
 * セグメント式ゲージ（ブロック分割バー）。
 * リファレンス（Game Dev Story 風）のブロックゲージを repeating-linear-gradient で再現。
 * OfficeScreen / DevelopScreen など各所で共用。
 */
type Props = {
  /** 0..100 */
  pct: number;
  /** 埋まり部分の色 */
  color?: string;
  /** トラック（背景・セグメント隙間）の色 */
  track?: string;
  /** 高さ px */
  height?: number;
};

export const SegGauge = ({ pct, color = '#2e9e4f', track = '#c6ccd4', height = 8 }: Props) => (
  <div
    style={{
      height,
      background: track,
      border: '1px solid #9aa3ae',
      overflow: 'hidden',
    }}
  >
    <div
      style={{
        width: `${Math.max(0, Math.min(100, pct))}%`,
        height: '100%',
        background: `repeating-linear-gradient(to right, ${color} 0 6px, ${track} 6px 8px)`,
      }}
    />
  </div>
);
