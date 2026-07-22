import { useEffect, useMemo, useRef, useState } from 'react';
import {
  isOpenFloor,
  NATIVE_H,
  NATIVE_W,
  OFFICE_LAYOUT,
  officeBgSrc,
  spriteFolderFor,
  standingSprite,
  WALK_FRAMES,
  WALKABLE_POINTS,
  walkSheet,
} from '../data/officeLayout';
import { initWander, stepWander, type WanderEnv, type WanderState } from '../core/officeWander';
import type { Employee } from '../state/types';
import {
  buildOccluderLookup,
  type OccluderLookup,
  OccluderMask,
  renderBandedSprite,
} from './bandedSprite';

/**
 * オフィスの床ビュー（v0.19・正面向き素材／v0.26・社員がランダムに歩き回る）。
 * 世界観・座標系・素材規約は docs/v17/notes/office-front-facing-plan.md を参照。
 *
 * 背景は 1 枚絵（office_bg.png、机・壁・床・装飾を内蔵）。座標はすべて背景のネイティブ座標
 * （NATIVE_W×NATIVE_H）。表示コンポーネントはこの div をネイティブサイズのまま返し、
 * 呼び出し側（OfficeScreen）が既存の stageScale ロジックで 1280×720 に収まるよう縮小する。
 *
 * v0.26 A：待機オフィス表示中は社員を着席させず、歩行可能グリッド上をランダムに歩かせる
 * （生活感）。移動の状態遷移は core/officeWander の純粋関数 `stepWander` が持ち、ここは
 * requestAnimationFrame で dt を供給して描くだけ（時刻・乱数は View 側に閉じ込め、
 * ゲームロジックには一切影響しない表示専用の状態）。家具の前後の遮蔽は renderBandedSprite
 * ＋OccluderMask で成立（参照実装：OfficeEditorTool の `?walk`）。
 */

type Props = {
  /** 在籍社員。座席数を上限に歩かせる（未指定なら誰も居ない）。 */
  employees?: Employee[];
};

const CHAR_SCALE = OFFICE_LAYOUT.charScale;

/** うろつきの調整値（spec §5-1「ゆっくり歩いて、回りをちょっと」）。 */
const WANDER_ENV_BASE = {
  speedPxPerSec: 80,
  restMinMs: 1500,
  restMaxMs: 5000,
  arriveDist: 14,
  stuckLimitMs: 450,
} as const;
/** 目標を選ぶ範囲（native px）。現在地からこの半径内の開けた床だけを次の目標にする＝近所をうろつく。 */
const WANDER_RADIUS = 210;
/** 歩行スプライトの1コマ表示時間(ms)。全社員で共有する歩行アニメの位相。 */
const WALK_FRAME_MS = 120;

/** from の半径 WANDER_RADIUS 内の開けた床点を1つ選ぶ（無ければ全体から）。 */
function pickNearTarget(rng: () => number, from: { x: number; y: number }) {
  const r2 = WANDER_RADIUS * WANDER_RADIUS;
  const near = WALKABLE_POINTS.filter((p) => {
    const dx = p.x - from.x;
    const dy = p.y - from.y;
    return dx * dx + dy * dy <= r2;
  });
  const pool = near.length > 0 ? near : WALKABLE_POINTS;
  return pool[Math.floor(rng() * pool.length)];
}

export const OfficeView = ({ employees = [] }: Props) => {
  const walkers = employees.slice(0, OFFICE_LAYOUT.seats.length);
  // 背景の家具に手前を横切られた時に隠れるための遮蔽物。レイアウトは不変なので一度だけ構築する。
  const occluderLookup = useMemo(() => buildOccluderLookup(OFFICE_LAYOUT.occluders), []);

  const env = useMemo<WanderEnv>(
    () => ({
      canStand: (x, y) => isOpenFloor(x, y),
      pickSpawn: (rng) => WALKABLE_POINTS[Math.floor(rng() * WALKABLE_POINTS.length)],
      pickTarget: pickNearTarget,
      ...WANDER_ENV_BASE,
    }),
    [],
  );

  // 社員ごとのうろつき状態。id で引けるよう Map に持ち、採用/離職で位置がリセットされないようにする。
  const statesRef = useRef<Map<string, WanderState>>(new Map());
  const frameRef = useRef(0);
  // 最新の walkers/env を RAF ループから参照する（ループ自体は張り替えず、毎フレームの再購読を避ける）。
  const walkersRef = useRef(walkers);
  walkersRef.current = walkers;
  const envRef = useRef(env);
  envRef.current = env;
  // 毎フレーム再描画を起こすためのティック（値自体は使わない）。
  const [, setTick] = useState(0);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const rng = Math.random; // 表示専用の揺らぎ。ゲーム状態には触れないので注入不要。
    const tick = (now: number) => {
      const dt = Math.min(50, now - last); // ms。タブ復帰などの巨大 dt をクランプ。
      last = now;
      const m = statesRef.current;
      const alive = new Set<string>();
      for (const w of walkersRef.current) {
        alive.add(w.id);
        const cur = m.get(w.id);
        m.set(w.id, cur ? stepWander(cur, dt, rng, envRef.current) : initWander(rng, envRef.current));
      }
      for (const id of m.keys()) if (!alive.has(id)) m.delete(id);
      frameRef.current = Math.floor(now / WALK_FRAME_MS) % WALK_FRAMES;
      setTick((n) => (n + 1) & 0xffff);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      className="office-view"
      style={{
        position: 'relative',
        width: NATIVE_W,
        height: NATIVE_H,
        overflow: 'hidden',
      }}
    >
      <img
        src={officeBgSrc}
        alt=""
        width={NATIVE_W}
        height={NATIVE_H}
        style={{ position: 'absolute', left: 0, top: 0, imageRendering: 'pixelated' }}
      />
      {/* 家具の画素を baseline の z で描き直す。これが無いと帯の z を下げても背景（最背面の1枚絵）
          より手前のままで何にも隠されない。renderBandedSprite と必ず対で使う。 */}
      {OFFICE_LAYOUT.occluders.map((o) => (
        <OccluderMask key={`${o.baseline}-${o.cells[0]}`} cells={o.cells} bgSrc={officeBgSrc} />
      ))}
      {walkers.map((employee) => {
        const state = statesRef.current.get(employee.id);
        if (!state) return null; // 初回 RAF 前は未初期化（1フレームだけ非表示）。
        return (
          <WalkingEmployee
            key={employee.id}
            employee={employee}
            state={state}
            frame={frameRef.current}
            occluderLookup={occluderLookup}
          />
        );
      })}
    </div>
  );
};

/**
 * 歩行/立ちスプライトを1人ぶん描く。歩行シートの実フレーム幅を計測してから
 * renderBandedSprite に渡す（PixelLab 出力サイズを決め打ちしない）。移動中は walk シートの
 * 現在コマを、停止中は立ち絵を出す。遮蔽（家具の前後）は renderBandedSprite が担う。
 */
function WalkingEmployee({
  employee,
  state,
  frame,
  occluderLookup,
}: {
  employee: Employee;
  state: WanderState;
  frame: number;
  occluderLookup: OccluderLookup;
}) {
  const folder = spriteFolderFor(employee);
  const [frameW, setFrameW] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setFrameW(null);
    const img = new Image();
    img.onload = () => {
      if (!cancelled) setFrameW(img.naturalWidth / WALK_FRAMES);
    };
    img.src = walkSheet(folder, 'south');
    return () => {
      cancelled = true;
    };
  }, [folder]);

  if (frameW == null) return null;
  const charSize = frameW * CHAR_SCALE;
  const { x, y, dir, moving } = state;
  return (
    <>
      {renderBandedSprite(
        // 歩行↔立ちで key を変え、img を作り直させる。使い回すと幅だけ先に変わって画像デコードが
        // 遅れ、8コマの歩行シートが1コマ幅に潰れて広がる残像が一瞬出る（stop 時のちらつき対策）。
        `${employee.id}-${moving ? 'walk' : 'stand'}`,
        x,
        y,
        OFFICE_LAYOUT.footOffsets.stand,
        charSize,
        charSize,
        moving ? walkSheet(folder, dir) : standingSprite(folder, dir),
        moving ? -frame * charSize : 0,
        moving ? charSize * WALK_FRAMES : charSize,
        occluderLookup,
      )}
    </>
  );
}
