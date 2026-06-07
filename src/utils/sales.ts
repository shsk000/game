import type { Work } from '../state/types';

/**
 * メタスコアに応じた1秒あたりの販売減衰率。
 *  - 低スコア（30）: 速く尻すぼみ
 *  - 高スコア（100）: ロングテール（ゆっくり長く売れる）
 *
 *  メタ30 → 0.020/sec（半減期 ~35秒）
 *  メタ70 → 0.012/sec（半減期 ~58秒）
 *  メタ100 → 0.006/sec（半減期 ~115秒）
 */
export const decayRateFor = (metascore: number): number => {
  const m = Math.max(0, Math.min(100, metascore));
  const raw = 0.022 - (m / 100) * 0.018;
  return Math.max(0.005, raw);
};

/** 初動売上の割合（残りは販売プールに入って時間で減衰しつつ流れる） */
export const INITIAL_SHARE = 0.2;

/**
 * 残り販売プール = pool * exp(-decay * t) という連続減衰モデル。
 * t 秒間の取り出し額（一括）= pool * (1 - exp(-decay * t))
 * 時間が `cap` を超える場合は cap で打ち切り（無限ループ防止）。
 */
export const settlePool = (
  pool: number,
  decay: number,
  awaySec: number,
  capSec = 6 * 60 * 60,
): { payout: number; remaining: number; sold: boolean } => {
  if (pool <= 0 || decay <= 0 || awaySec <= 0) {
    return { payout: 0, remaining: pool, sold: pool <= 0.5 };
  }
  const t = Math.min(awaySec, capSec);
  const ratio = 1 - Math.exp(-decay * t);
  const payout = Math.round(pool * ratio);
  const remaining = Math.max(0, pool - payout);
  return { payout, remaining, sold: remaining < 0.5 };
};

/** ライブラリの販売中作品から、awaySec 経過後に得られる総額と更新済みコピーを返す */
export const settleAllWorks = (
  library: Work[],
  awaySec: number,
): { earned: number; library: Work[] } => {
  let earned = 0;
  const updated = library.map((w) => {
    if (!w.selling || w.salesPool <= 0) return w;
    const r = settlePool(w.salesPool, w.decayPerSec, awaySec);
    earned += r.payout;
    return {
      ...w,
      salesPool: r.remaining,
      totalRevenue: w.totalRevenue + r.payout,
      selling: !r.sold,
    };
  });
  return { earned, library: updated };
};
