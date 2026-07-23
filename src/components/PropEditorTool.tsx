import {
  type CSSProperties,
  Fragment,
  type MouseEvent as ReactMouseEvent,
  useEffect,
  useState,
} from 'react';
import {
  bookSprite,
  chairSprite,
  desktopSprite,
  gamingRigSprite,
  laptopSprite,
  NATIVE_H,
  NATIVE_W,
  OFFICE_LAYOUT,
  officeBgSrc,
  pentabSprite,
  plantSprite,
  PROP_TRANSFORMS,
  type PropTransform,
  type SeatDir,
  sitFootOffset,
  sittingSprite,
} from '../data/officeLayout';

/**
 * 物体（PC・椅子…）配置ツール（dev専用、`/admin/props` で起動）。
 *
 * オフィス配置ツール（?layout / /admin/layout）から物体調整だけを切り出した専用ツール。
 * 背景・移動領域・座席・遮蔽物の編集は向こう、こちらは「着席キャラに対して物体をどこに
 * どの大きさで置くか」だけに集中する。物体は今後増える前提なので PROPS レジストリに
 * 1行足すだけで調整対象にできる構造にしてある。
 *
 * 座標の基準：キャラの「座り足元」（seat.y + sitFootOffset(dir)）。ここからの相対値なので
 * 座席を動かしてもキャラとの位置関係は保たれる（＝OfficeView.tsx の SeatedEmployee と同じ規約）。
 * 表示サイズは「スプライトの実ピクセル幅 × scale」で決める（決め打ち禁止の原則）。
 */

type PropDef = {
  id: keyof typeof PROP_TRANSFORMS;
  label: string;
  sprite: (dir: SeatDir) => string;
};

const CHAR_SCALE = OFFICE_LAYOUT.charScale;

/**
 * 調整対象の物体。増やす時はここに1行足す（sprite は向き→パスの関数）。
 * 既定値はここに持たず officeLayout.ts の PROP_TRANSFORMS（＝本番が使う値）を読む。
 * ツールに複製すると、素材差し替え時に本番だけ直ってツールが古い値を返す（実際に発生）。
 */
const PROPS: PropDef[] = [
  { id: 'laptop', label: 'ノートPC', sprite: laptopSprite },
  { id: 'chair', label: '椅子', sprite: chairSprite },
  // v0.25 装備プロップ（机上に置く単体オブジェクト）
  { id: 'desktop', label: 'デスクトップ', sprite: desktopSprite },
  { id: 'gaming_rig', label: 'ゲーミング', sprite: gamingRigSprite },
  { id: 'book', label: '技術書', sprite: bookSprite },
  { id: 'pentab', label: '液タブ', sprite: pentabSprite },
  { id: 'plant', label: '観葉植物', sprite: plantSprite },
];

const ROSTER = [
  { folder: 'engineer', label: 'プログラマー(男)' },
  { folder: 'programmer_f', label: 'プログラマー(女)' },
  { folder: 'designer_m', label: 'デザイナー(男)' },
  { folder: 'designer_f', label: 'デザイナー(女)' },
  { folder: 'pr_m', label: '広報(男)' },
  { folder: 'pr_f', label: '広報(女)' },
] as const;

// v1 には PROP_TRANSFORMS 統合前の古い既定値（椅子 scale 2.5 など）が保存されている。
// キーを上げて、開いた時に必ず現在の本番値から始まるようにする。
const STORAGE_KEY = 'office-prop-tool-v2';

type Transforms = Record<string, Record<SeatDir, PropTransform>>;

const defaultTransforms = (): Transforms =>
  Object.fromEntries(
    PROPS.map((p) => [
      p.id,
      {
        north: { ...PROP_TRANSFORMS[p.id].north },
        south: { ...PROP_TRANSFORMS[p.id].south },
      },
    ]),
  );

export function PropEditorTool() {
  const [dir, setDir] = useState<SeatDir>('north');
  const [folder, setFolder] = useState<string>(ROSTER[0].folder);
  const [seatIndex, setSeatIndex] = useState(0);
  const [zoom, setZoom] = useState(0.66);
  const [selected, setSelected] = useState<string>(PROPS[0].id);
  const [showBg, setShowBg] = useState(true);
  const [showChar, setShowChar] = useState(true); // キャラの裏に隠れた物体を見るために消せる
  // v0.25：既定で「選択中の物体だけ」表示。laptop/desktop 等は排他（実ゲームでPCは1つ）なので
  // 全部同時に出すと重なって編集しづらい。OFF で全物体を重ねて相対位置も確認できる。
  // v0.25：同時表示する物体（編集中の物体は常に表示、ここでチェックした物体を重ねて表示）。
  // 既定は空＝編集中のみ（laptop/desktop など排他プロップが重ならない）。
  const [coShow, setCoShow] = useState<Record<string, boolean>>({});
  // 全席に ROSTER 6人を並べて、調整値がどのキャラでも破綻しないかまとめて確認する。
  // 1席1キャラだけだと「そのキャラでは合っているが他で浮く」に気づけない。
  const [allSeats, setAllSeats] = useState(true);
  const [transforms, setTransforms] = useState<Transforms>(defaultTransforms);
  const [io, setIo] = useState('');
  const [drag, setDrag] = useState<{
    id: string;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);

  // 復元 / 保存
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (d?.transforms) setTransforms((prev) => ({ ...prev, ...d.transforms }));
    } catch {
      /* 壊れていたら既定値のまま */
    }
  }, []);
  useEffect(() => {
    const t = window.setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ transforms }));
    }, 300);
    return () => window.clearTimeout(t);
  }, [transforms]);

  const seat = OFFICE_LAYOUT.seats[seatIndex] ?? OFFICE_LAYOUT.seats[0];
  const footY = seat.y + sitFootOffset(dir);

  const update = (id: string, key: keyof PropTransform, value: number) => {
    setTransforms((prev) => ({
      ...prev,
      [id]: { ...prev[id], [dir]: { ...prev[id][dir], [key]: value } },
    }));
  };
  const resetOne = (id: string) => {
    const def = PROPS.find((p) => p.id === id);
    if (!def) return;
    setTransforms((prev) => ({
      ...prev,
      [id]: { ...prev[id], [dir]: { ...PROP_TRANSFORMS[def.id][dir] } },
    }));
  };

  // ドラッグ移動（数値入力より速く当たりを付けるため）
  useEffect(() => {
    if (!drag) return;
    const onMove = (e: MouseEvent) => {
      const dx = (e.clientX - drag.startX) / zoom;
      const dy = (e.clientY - drag.startY) / zoom;
      setTransforms((prev) => ({
        ...prev,
        [drag.id]: {
          ...prev[drag.id],
          [dir]: {
            ...prev[drag.id][dir],
            x: Math.round(drag.origX + dx),
            y: Math.round(drag.origY + dy),
          },
        },
      }));
    };
    const onUp = () => setDrag(null);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [drag, zoom, dir]);

  const startDrag = (e: ReactMouseEvent, id: string) => {
    e.preventDefault();
    setSelected(id);
    const t = transforms[id][dir];
    setDrag({ id, startX: e.clientX, startY: e.clientY, origX: t.x, origY: t.y });
  };

  const cur = transforms[selected]?.[dir];

  return (
    <div
      style={{ background: '#1b1b1b', color: '#eee', minHeight: '100vh', font: '13px system-ui' }}
    >
      <div style={bar}>
        <strong>物体配置ツール</strong>
        <div style={group}>
          <span style={{ color: '#aaa' }}>向き</span>
          <button type="button" onClick={() => setDir('north')} style={btn(dir === 'north')}>
            ⬆ north（背中）
          </button>
          <button type="button" onClick={() => setDir('south')} style={btn(dir === 'south')}>
            ⬇ south（正面）
          </button>
        </div>
        <div style={group}>
          <label style={lbl}>
            <input
              type="checkbox"
              checked={allSeats}
              onChange={(e) => setAllSeats(e.target.checked)}
            />
            全席に全員
          </label>
          <label style={lbl}>
            キャラ
            <select
              value={folder}
              onChange={(e) => setFolder(e.target.value)}
              disabled={allSeats}
              title={allSeats ? '全席モードでは各席に全員を自動で割り当てます' : undefined}
            >
              {ROSTER.map((r) => (
                <option key={r.folder} value={r.folder}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          <label style={lbl}>
            {allSeats ? '編集する席' : '座席'}
            <select value={seatIndex} onChange={(e) => setSeatIndex(Number(e.target.value))}>
              {OFFICE_LAYOUT.seats.map((s, i) => (
                <option key={`${s.x},${s.y}`} value={i}>
                  #{i + 1}
                  {allSeats ? `（${ROSTER[i % ROSTER.length].label}）` : `（${s.x},${s.y}）`}
                </option>
              ))}
            </select>
          </label>
          <label style={lbl}>
            <input type="checkbox" checked={showBg} onChange={(e) => setShowBg(e.target.checked)} />
            背景
          </label>
          <label style={lbl}>
            <input
              type="checkbox"
              checked={showChar}
              onChange={(e) => setShowChar(e.target.checked)}
            />
            キャラ
          </label>
          <span style={{ color: '#aaa', marginLeft: 6 }}>同時表示</span>
          {PROPS.map((p) => (
            <label key={p.id} style={lbl}>
              <input
                type="checkbox"
                checked={p.id === selected || !!coShow[p.id]}
                disabled={p.id === selected}
                onChange={(e) => setCoShow((m) => ({ ...m, [p.id]: e.target.checked }))}
              />
              {p.label}
            </label>
          ))}
          <label style={lbl}>
            表示 <span style={val}>{Math.round(zoom * 100)}%</span>
            <input
              type="range"
              min={40}
              max={300}
              value={Math.round(zoom * 100)}
              onChange={(e) => setZoom(Number(e.target.value) / 100)}
            />
          </label>
        </div>
      </div>

      <div style={{ ...bar, borderTop: '1px solid #333' }}>
        <div style={group}>
          <span style={{ color: '#aaa' }}>物体</span>
          {PROPS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelected(p.id)}
              style={btn(selected === p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>
        {cur && (
          <div style={group}>
            <label style={lbl}>
              X
              <input
                type="number"
                value={cur.x}
                onChange={(e) => update(selected, 'x', Number(e.target.value))}
                style={{ width: 64 }}
              />
            </label>
            <label style={lbl}>
              Y
              <input
                type="number"
                value={cur.y}
                onChange={(e) => update(selected, 'y', Number(e.target.value))}
                style={{ width: 64 }}
              />
            </label>
            <label style={lbl}>
              倍率
              <input
                type="number"
                step={0.05}
                min={0.1}
                value={cur.scale}
                onChange={(e) => update(selected, 'scale', Number(e.target.value))}
                style={{ width: 64 }}
              />
            </label>
            <label style={lbl}>
              奥行き(z)
              <input
                type="number"
                value={cur.z}
                onChange={(e) => update(selected, 'z', Number(e.target.value))}
                style={{ width: 56 }}
              />
            </label>
            <label style={lbl}>
              傾き°
              <input
                type="number"
                step={1}
                value={cur.tiltX ?? 0}
                onChange={(e) => update(selected, 'tiltX', Number(e.target.value))}
                style={{ width: 56 }}
              />
            </label>
            <label style={lbl}>
              縦scale
              <input
                type="number"
                step={0.05}
                min={0.1}
                value={cur.scaleY ?? 1}
                onChange={(e) => update(selected, 'scaleY', Number(e.target.value))}
                style={{ width: 56 }}
              />
            </label>
            <label style={lbl}>
              回転°
              <input
                type="number"
                step={1}
                value={cur.rotate ?? 0}
                onChange={(e) => update(selected, 'rotate', Number(e.target.value))}
                style={{ width: 56 }}
              />
            </label>
            <span style={{ color: '#888' }}>z: 負=奥 / 正=手前｜傾き(パース)/縦scale/回転で平面物を机の面に寝かせる</span>
            <button type="button" onClick={() => resetOne(selected)} style={btn(false)}>
              ↺ この物体を既定値
            </button>
          </div>
        )}
        <div style={group}>
          <button
            type="button"
            onClick={() => setIo(JSON.stringify(transforms, null, 2))}
            style={btn(false)}
          >
            📋 JSON出力
          </button>
          <button
            type="button"
            onClick={() => {
              try {
                setTransforms(JSON.parse(io));
              } catch {
                alert('JSON を解釈できませんでした');
              }
            }}
            style={btn(false)}
          >
            読込
          </button>
          <button
            type="button"
            onClick={() => setTransforms(defaultTransforms())}
            style={btn(false)}
          >
            ↺ 全部既定値
          </button>
        </div>
      </div>

      <p style={{ margin: '8px 12px', color: '#aaa' }}>
        物体をドラッグして移動、または上の数値で調整。位置はキャラの座り足元が基準なので、座席を変えても相対位置は保たれます。
        {allSeats
          ? '「全席に全員」ON：全席に6キャラを並べ、同じ調整値の見え方をまとめて確認できます（ドラッグできるのは「編集する席」だけ）。'
          : ''}
      </p>

      <div style={{ padding: 12, overflow: 'auto' }}>
        <div style={{ width: NATIVE_W * zoom, height: NATIVE_H * zoom }}>
          <div
            style={{
              position: 'relative',
              width: NATIVE_W,
              height: NATIVE_H,
              transform: `scale(${zoom})`,
              transformOrigin: 'top left',
              background: showBg ? undefined : '#2a2a2a',
              outline: '1px solid #444',
            }}
          >
            {showBg && (
              <img
                src={officeBgSrc}
                alt=""
                width={NATIVE_W}
                height={NATIVE_H}
                style={{ position: 'absolute', left: 0, top: 0, imageRendering: 'pixelated' }}
              />
            )}

            {/* 基準線：キャラの座り足元 */}
            <div
              style={{
                position: 'absolute',
                left: seat.x - 60,
                top: footY,
                width: 120,
                height: 1,
                background: 'rgba(255,80,80,0.9)',
                zIndex: 100000,
                pointerEvents: 'none',
              }}
            />

            {(allSeats ? OFFICE_LAYOUT.seats : [seat]).map((s, i) => {
              // 全席モードでは席ごとに別のキャラを座らせる（1人ずつ確認する手間を無くす）。
              const seatFolder = allSeats ? ROSTER[i % ROSTER.length].folder : folder;
              const seatFootY = s.y + sitFootOffset(dir);
              // ドラッグできるのは編集中の1席だけ。他席は同じ調整値の見え方を確認するための表示。
              const editable = !allSeats || i === seatIndex;
              // 席どうしの前後は OfficeView と同じく y 順（南＝手前）。
              const baseZ = Math.round(s.y);
              return (
                <Fragment key={i}>
                  {showChar && (
                    <Sprite
                      src={sittingSprite(seatFolder, dir)}
                      x={s.x}
                      footY={seatFootY}
                      scale={CHAR_SCALE}
                      z={baseZ}
                    />
                  )}
                  {PROPS.map((p) => {
                    if (p.id !== selected && !coShow[p.id]) return null;
                    const t = transforms[p.id][dir];
                    return (
                      <Sprite
                        key={p.id}
                        src={p.sprite(dir)}
                        x={s.x + t.x}
                        footY={seatFootY + t.y}
                        scale={t.scale}
                        z={baseZ + t.z}
                        tiltX={t.tiltX}
                        scaleY={t.scaleY}
                        rotate={t.rotate}
                        outline={editable && selected === p.id}
                        onMouseDown={editable ? (e) => startDrag(e, p.id) : undefined}
                      />
                    );
                  })}
                </Fragment>
              );
            })}
          </div>
        </div>
      </div>

      <textarea
        value={io}
        onChange={(e) => setIo(e.target.value)}
        placeholder="ここに JSON が出ます / 貼り付けて「読込」も可"
        style={{
          width: 'calc(100% - 24px)',
          margin: 12,
          height: 140,
          background: '#111',
          color: '#ddd',
          border: '1px solid #333',
          font: '12px monospace',
        }}
      />
    </div>
  );
}

/**
 * PixelLab 出力は要求サイズより大きいキャンバス（余白込み）で返るため、表示幅は
 * 「実ピクセル数 × scale」で決める（固定値の決め打ち禁止）。倍率をUIで変えた時に
 * 即反映させたいので、確定した表示幅ではなく実ピクセル幅だけを state に持つ。
 */
function Sprite({
  src,
  x,
  footY,
  scale,
  z,
  outline,
  onMouseDown,
  tiltX,
  scaleY,
  rotate,
}: {
  src: string;
  x: number;
  footY: number;
  scale: number;
  z: number;
  outline?: boolean;
  onMouseDown?: (e: ReactMouseEvent) => void;
  tiltX?: number;
  scaleY?: number;
  rotate?: number;
}) {
  const [natural, setNatural] = useState<number | null>(null);
  const width = natural == null ? undefined : natural * scale;
  const style: CSSProperties = {
    position: 'absolute',
    left: x,
    top: footY,
    width,
    // perspective + rotateX で「奥行きに寝かせる」＝上辺が中央に寄るパース（skew の平行四辺形ではない）
    transform: `translate(-50%, -100%) perspective(600px) rotateX(${tiltX ?? 0}deg) rotate(${rotate ?? 0}deg) scaleY(${scaleY ?? 1})`,
    zIndex: z,
    imageRendering: 'pixelated',
    visibility: width === undefined ? 'hidden' : 'visible',
    outline: outline ? '2px dashed rgba(90,190,255,0.9)' : undefined,
    cursor: onMouseDown ? 'move' : undefined,
  };
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: dev専用ツールの物体ドラッグ。位置は数値入力でも編集できるのでキーボード代替は確保されている
    <img
      src={src}
      alt=""
      style={style}
      draggable={false}
      onMouseDown={onMouseDown}
      onLoad={(e) => setNatural(e.currentTarget.naturalWidth)}
    />
  );
}

const bar: CSSProperties = {
  display: 'flex',
  gap: 16,
  alignItems: 'center',
  flexWrap: 'wrap',
  padding: '8px 12px',
  background: '#232323',
};
const group: CSSProperties = { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' };
const lbl: CSSProperties = { display: 'flex', gap: 4, alignItems: 'center' };
const val: CSSProperties = { color: '#ffd479', minWidth: 40, display: 'inline-block' };
const btn = (active: boolean): CSSProperties => ({
  padding: '4px 10px',
  borderRadius: 4,
  border: '1px solid #555',
  background: active ? '#2f6fd0' : '#333',
  color: '#eee',
  cursor: 'pointer',
});
