import type { OfflineReport, Work } from '../state/types';
import { settleAllWorks } from '../utils/sales';

/**
 * 経済系のルール計算（純粋関数）。
 * 時刻は nowMs 引数で受け取る（logic-architecture §2）。
 */

/** オフライン収益の反映猶予：これ未満の離席はレポートしない */
const MIN_AWAY_SEC = 60;

/**
 * 離席中の販売精算。lastSeenAt からの経過時間ぶん、販売中作品のプールを取り崩す。
 * 60 秒未満の離席・収益ゼロのときは report: null（モーダルを出さない）。
 */
export const computeOfflineEarnings = (
  lastSeenAt: number,
  library: Work[],
  nowMs: number,
): { report: OfflineReport | null; library: Work[] } => {
  if (!lastSeenAt) return { report: null, library };
  const awaySec = Math.max(0, (nowMs - lastSeenAt) / 1000);
  if (awaySec < MIN_AWAY_SEC) return { report: null, library };
  const { earned, library: updated } = settleAllWorks(library, awaySec);
  if (earned <= 0) return { report: null, library: updated };
  return { report: { earned, awaySec }, library: updated };
};
