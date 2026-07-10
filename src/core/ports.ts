/**
 * ポート定義：このプロジェクトで注入可能にする非決定性は「乱数」と「時刻」の2つだけ
 * （docs/architecture.md §3 案B/C・§5-1）。
 *
 * ロジック関数は末尾デフォルト引数（`rng: Rng = Math.random`）で受け取る。
 * プロダクションの呼び出し側は無変更、テストだけ mulberry32(seed) や固定値を渡す。
 */

/** 乱数：[0, 1) を返す。テストでは mulberry32(seed) か固定値 `() => 0.5` を渡す */
export type Rng = () => number;

/** 時刻：epoch ms を返す。テストでは固定値 `() => 0` などを渡す */
export type Clock = () => number;

export type Deps = {
  rng: Rng;
  now: Clock;
};

/** 本番用の既定実装 */
export const defaultDeps: Deps = {
  rng: Math.random,
  now: Date.now,
};

/**
 * seed 付き疑似乱数（mulberry32）。同じ seed なら同じ系列を返す。
 * テストと e2e（?seed=NN）の決定化に使う。暗号用途には使わない。
 */
export const mulberry32 = (seed: number): Rng => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
