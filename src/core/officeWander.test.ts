import { describe, expect, it } from 'vitest';
import { initWander, stepWander, type WanderEnv, type WanderState } from './officeWander';

/** どこでも立てる env（歩行の基本挙動を見る用）。 */
const openEnv = (over: Partial<WanderEnv> = {}): WanderEnv => ({
  canStand: () => true,
  pickSpawn: () => ({ x: 0, y: 0 }),
  pickTarget: () => ({ x: 100, y: 100 }),
  speedPxPerSec: 100,
  restMinMs: 1000,
  restMaxMs: 3000,
  arriveDist: 8,
  stuckLimitMs: 500,
  ...over,
});

const baseState = (over: Partial<WanderState> = {}): WanderState => ({
  x: 0,
  y: 0,
  dir: 'south',
  moving: false,
  targetX: 300,
  targetY: 0,
  restMs: 0,
  stuckMs: 0,
  ...over,
});

const rngConst = (v: number) => () => v;

describe('stepWander — 立ち止まり', () => {
  it('restMs>0 の間は dtMs だけ減らして動かない（moving=false）', () => {
    const s = baseState({ restMs: 500, moving: true, x: 10 });
    const next = stepWander(s, 100, rngConst(0.5), openEnv());
    expect(next.restMs).toBe(400);
    expect(next.moving).toBe(false);
    expect(next.x).toBe(10); // 位置は変わらない
  });

  it('restMs が尽きたら新しい目標を引いて歩き出す', () => {
    const s = baseState({ restMs: 50 });
    const env = openEnv({ pickTarget: () => ({ x: 777, y: 555 }) });
    const next = stepWander(s, 100, rngConst(0.5), env);
    expect(next.restMs).toBe(0);
    expect(next.targetX).toBe(777);
    expect(next.targetY).toBe(555);
    expect(next.moving).toBe(true);
  });
});

describe('stepWander — 歩行', () => {
  it('目標へ向かって進み、距離が縮む・向きが入る', () => {
    const s = baseState({ x: 0, y: 0, targetX: 300, targetY: 0 });
    const next = stepWander(s, 100, rngConst(0.5), openEnv({ speedPxPerSec: 100 }));
    // 100px/s × 0.1s = 10px 前進
    expect(next.x).toBeCloseTo(10, 5);
    expect(next.moving).toBe(true);
    expect(next.dir).toBe('east'); // +x 方向
  });

  it('目標に arriveDist 以内まで来たら到着＝休みに入る', () => {
    const s = baseState({ x: 295, y: 0, targetX: 300, targetY: 0 }); // 距離5 ≤ arriveDist8
    const next = stepWander(s, 100, rngConst(0), openEnv());
    expect(next.moving).toBe(false);
    expect(next.restMs).toBe(1000); // restMin + 0*(max-min)
    expect(next.x).toBe(295); // 到着扱いで位置は動かさない
  });

  it('斜めが塞がれていても片軸が空いていれば壁沿いに進む', () => {
    const s = baseState({ x: 0, y: 0, targetX: 100, targetY: 100 });
    // x 方向のみ立てる env（nx,ny は不可・nx,y は可）
    const env = openEnv({
      canStand: (_x, y) => y === 0,
      speedPxPerSec: 100,
    });
    const next = stepWander(s, 100, rngConst(0.5), env);
    expect(next.y).toBe(0); // y は据え置き
    expect(next.x).toBeGreaterThan(0); // x だけ進む
    expect(next.moving).toBe(true);
  });

  it('進めない間は stuckMs を溜め、まだ限界前なら押し続ける（moving=true）', () => {
    const s = baseState({ x: 0, y: 0, targetX: 100, targetY: 100, stuckMs: 0 });
    const env = openEnv({ canStand: () => false, stuckLimitMs: 500 });
    const next = stepWander(s, 100, rngConst(0), env);
    expect(next.stuckMs).toBe(100);
    expect(next.moving).toBe(true); // まだ諦めない
    expect(next.x).toBe(0); // 動けてはいない
    expect(next.y).toBe(0);
  });

  it('近づけない時間が stuckLimit を超えたら目標を諦めて休む（壁沿い無限スライド防止）', () => {
    const s = baseState({ x: 0, y: 0, targetX: 100, targetY: 100, stuckMs: 450 });
    const env = openEnv({ canStand: () => false, stuckLimitMs: 500 });
    const next = stepWander(s, 100, rngConst(0), env); // 450+100=550 ≥ 500
    expect(next.moving).toBe(false);
    expect(next.restMs).toBe(1000); // restMin + 0*(max-min)
    expect(next.stuckMs).toBe(0);
  });

  it('壁沿いに進めても目標に近づけていなければ stuck が溜まる', () => {
    // 目標は右下(100,100)だが y 方向しか空いていない＝x に近づけないのに y を動いても target 距離は縮まない
    const s = baseState({ x: 0, y: 0, targetX: 100, targetY: 0, stuckMs: 0 });
    // x が塞がれ y のみ可。target は真右(100,0)なので y に動いても近づかない。
    const env = openEnv({ canStand: (x, _y) => x === 0, stuckLimitMs: 500 });
    const next = stepWander(s, 100, rngConst(0.5), env);
    expect(next.stuckMs).toBe(100); // 近づけていない＝stuck 加算
  });
});

describe('stepWander — 決定論', () => {
  it('同じ入力・同じ rng なら同じ結果（副作用なし）', () => {
    const s = baseState({ x: 0, y: 0, targetX: 300, targetY: 0 });
    const a = stepWander(s, 100, rngConst(0.3), openEnv());
    const b = stepWander(s, 100, rngConst(0.3), openEnv());
    expect(a).toEqual(b);
  });
});

describe('initWander', () => {
  it('スポーンは pickSpawn、restMs は [0, restMaxMs) に散る、stuckMs=0', () => {
    const env = openEnv({ pickSpawn: () => ({ x: 42, y: 24 }), restMaxMs: 3000 });
    const s = initWander(rngConst(0.5), env);
    expect(s.x).toBe(42);
    expect(s.y).toBe(24);
    expect(s.restMs).toBe(1500); // 0.5 * 3000
    expect(s.restMs).toBeGreaterThanOrEqual(0);
    expect(s.restMs).toBeLessThan(env.restMaxMs);
    expect(s.stuckMs).toBe(0);
  });
});
