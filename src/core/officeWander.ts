import { type Dir8, vectorToDir8 } from '../data/officeLayout';

/**
 * v0.26 A：待機オフィス（OfficeScreen）で社員がランダムに歩き回るための純粋ロジック。
 *
 * ゲームロジック（品質・売上・進行）とは無関係の**表示専用**の状態。ここには時刻も乱数も持たず、
 * すべて引数で注入する（logic-architecture 準拠）。View 側が requestAnimationFrame の dt と rng を
 * 渡して `stepWander` を回し、返ってきた座標・向きで歩行スプライトを描くだけ。
 *
 * 動きの質は「ゆっくり歩いて、目標に着いたら少し止まり、また別のランダム地点へ」（spec §5-1）。
 */

export type WanderState = {
  /** 現在位置（背景ネイティブ座標）。 */
  x: number;
  y: number;
  /** 進行方向（停止時は最後に向いていた方向を保持）。 */
  dir: Dir8;
  /** 歩行中か（false＝立ち止まり）。歩行/立ちスプライトの出し分けに使う。 */
  moving: boolean;
  /** 目標地点。 */
  targetX: number;
  targetY: number;
  /** 立ち止まり残り時間(ms)。>0 の間は動かず、0 になったら次の目標へ歩き出す。 */
  restMs: number;
  /** 目標に近づけていない時間(ms)。壁沿いに進めないまま溜まったら目標を諦める（無限スライド防止）。 */
  stuckMs: number;
};

export type WanderEnv = {
  /** その座標に立てるか（開けた床の判定）。 */
  canStand: (x: number, y: number) => boolean;
  /** 初期位置＝開けた床のどこか1点（rng 注入）。 */
  pickSpawn: (rng: () => number) => { x: number; y: number };
  /** from の「回り」の開けた床を1点返す。遠くまで歩かせず近所をうろつかせる（rng 注入）。 */
  pickTarget: (rng: () => number, from: { x: number; y: number }) => { x: number; y: number };
  /** 歩行速度（px/秒・ネイティブ座標）。 */
  speedPxPerSec: number;
  /** 立ち止まり時間の下限/上限(ms)。 */
  restMinMs: number;
  restMaxMs: number;
  /** 目標にこの距離まで近づいたら「到着」とみなす(px)。1フレームの移動量より大きくして往復振動を防ぐ。 */
  arriveDist: number;
  /** 目標に近づけない時間がこれを超えたら、その目標を諦めて休む(ms)。壁沿いの無限スライドを止める。 */
  stuckLimitMs: number;
};

function pickRest(rng: () => number, env: WanderEnv): number {
  return env.restMinMs + rng() * (env.restMaxMs - env.restMinMs);
}

/**
 * うろつき状態を dtMs だけ進める。副作用なし・rng 注入で決定論的にテストできる。
 *
 * - 立ち止まり中（restMs>0）：restMs を減らし、尽きたら新しい目標を引いて歩き出す。
 * - 歩行中：目標へ向かって進む。到着したら少し休む。壁で詰まったら（軸ずらしでも進めない）
 *   その目標を諦めて休み、次のフレームで別目標を引き直す（スタック防止）。
 */
export function stepWander(
  s: WanderState,
  dtMs: number,
  rng: () => number,
  env: WanderEnv,
): WanderState {
  if (s.restMs > 0) {
    const restMs = s.restMs - dtMs;
    if (restMs > 0) return { ...s, restMs, moving: false };
    const t = env.pickTarget(rng, { x: s.x, y: s.y });
    return { ...s, restMs: 0, targetX: t.x, targetY: t.y, moving: true, stuckMs: 0 };
  }

  const dx = s.targetX - s.x;
  const dy = s.targetY - s.y;
  const dist = Math.hypot(dx, dy);
  if (dist <= env.arriveDist) {
    return { ...s, moving: false, restMs: pickRest(rng, env), stuckMs: 0 };
  }

  const dir = vectorToDir8(dx, dy);
  const stepLen = (env.speedPxPerSec * dtMs) / 1000;
  const nx = s.x + (dx / dist) * stepLen;
  const ny = s.y + (dy / dist) * stepLen;
  // 斜め→片軸(x)→片軸(y) の順に進める（壁沿いに回り込める。参照実装 OfficeEditorTool と同じ順）。
  let ax = s.x;
  let ay = s.y;
  if (env.canStand(nx, ny)) {
    ax = nx;
    ay = ny;
  } else if (env.canStand(nx, s.y)) {
    ax = nx;
  } else if (env.canStand(s.x, ny)) {
    ay = ny;
  }

  // 目標へ実際に近づけたか。ほとんど近づけない（壁沿いスライド／完全な詰まり）なら stuck を溜める。
  const distAfter = Math.hypot(s.targetX - ax, s.targetY - ay);
  const stuckMs = dist - distAfter < stepLen * 0.5 ? s.stuckMs + dtMs : 0;
  if (stuckMs >= env.stuckLimitMs) {
    // 近づけないまま時間切れ＝目標を諦めて休む。次に休みが明けたら別の近所を引き直す。
    return { ...s, x: ax, y: ay, dir, moving: false, restMs: pickRest(rng, env), stuckMs: 0 };
  }
  return { ...s, x: ax, y: ay, dir, moving: true, stuckMs };
}

/**
 * 初期状態を作る。歩行可能地点にスポーンし、目標を1つ引く。restMs は 0〜restMaxMs で散らして
 * 全員が同じ瞬間に歩き出す/止まるのを防ぐ（各社員で rng を消費して位相をずらす）。
 */
export function initWander(rng: () => number, env: WanderEnv): WanderState {
  const p = env.pickSpawn(rng);
  const t = env.pickTarget(rng, p);
  return {
    x: p.x,
    y: p.y,
    dir: 'south',
    moving: false,
    targetX: t.x,
    targetY: t.y,
    restMs: rng() * env.restMaxMs,
    stuckMs: 0,
  };
}
