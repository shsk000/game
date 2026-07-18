/**
 * 遮蔽物（背景の家具）によるスプライトの部分遮蔽。
 *
 * もとは配置ツール（OfficeEditorTool）の⑤検証モード用に実装したものを、本番の OfficeView と
 * 共有するために切り出した（2026-07-16）。**検証ページの見え方が正**で、本番はこれを使う。
 * どちらかにロジックを複製しないこと（片方だけ直して見え方がズレる事故を防ぐ）。
 *
 * 遮蔽は必ず **OccluderMask と renderBandedSprite の2つで1組**。背景は1枚絵が最背面にあるだけで
 * 「机」という要素は存在しないので、帯の z を下げるだけでは何にも隠されない（背景より手前のまま）。
 * OccluderMask が家具の画素を baseline の z で描き直して初めて、低い z の帯がその下に潜る。
 * 片方だけ使っても遮蔽は成立しない。
 */

import { useEffect, useRef, useState } from 'react';

/**
 * 遮蔽物（④の塗り・キャラの部分遮蔽の帯）専用のセル解像度。歩行判定用の cell（既定20px、
 * ②で10〜80に調整可）とはあえて分離し、常にこの細かい値を使う。歩行グリッドと同じセルだと
 * ソファの曲線などで輪郭が階段状にガタつき、キャラの脚が隠れる境目もカクつく（ユーザー指摘）。
 */
export const OCCL_CELL = 5;

/** 遮蔽物セル "i,j"（OCCL_CELL 単位） → その物体の baseline。同じセルを複数物体が使わない前提。 */
export type OccluderLookup = Map<string, number>;

export function buildOccluderLookup(
  occluders: { cells: Iterable<string>; baseline: number }[],
): OccluderLookup {
  const map: OccluderLookup = new Map();
  for (const o of occluders) {
    for (const key of o.cells) {
      if (!map.has(key)) map.set(key, o.baseline);
    }
  }
  return map;
}

/**
 * 遮蔽物1個ぶんの「背景の描き直し」。その物体が占めるセルの背景画素だけを canvas に写し、
 * baseline の z-index で前面に置く。これが renderBandedSprite の相方で、低い z になった帯を
 * 実際に隠す役目を負う（→ モジュール冒頭の注意書き）。
 *
 * セルごとに div を置くと DOM が数千ノードになり、開いた直後から重く歩行がカクつく（実機で確認）。
 * 物体1個＝canvas1枚にまとめ、セル単位の描画は canvas 内部の drawImage に閉じ込める
 * （マウント時に1回描くだけで、歩行中の毎フレーム再生成も無い）。
 */
export function OccluderMask({ cells, bgSrc }: { cells: string[]; bgSrc: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [bgImg, setBgImg] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    const img = new Image();
    img.onload = () => setBgImg(img);
    img.src = bgSrc;
  }, [bgSrc]);

  let minI = Number.POSITIVE_INFINITY;
  let minJ = Number.POSITIVE_INFINITY;
  let maxI = Number.NEGATIVE_INFINITY;
  let maxJ = Number.NEGATIVE_INFINITY;
  for (const key of cells) {
    const [i, j] = key.split(',').map(Number);
    if (i < minI) minI = i;
    if (i > maxI) maxI = i;
    if (j < minJ) minJ = j;
    if (j > maxJ) maxJ = j;
  }
  const hasCells = Number.isFinite(minI);
  const width = hasCells ? (maxI - minI + 1) * OCCL_CELL : 0;
  const height = hasCells ? (maxJ - minJ + 1) * OCCL_CELL : 0;
  // baseline はセルから導く（= 物体の南端）。データ側の baseline と一致する。
  const baseline = hasCells ? (maxJ + 1) * OCCL_CELL : 0;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !bgImg || !hasCells) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const key of cells) {
      const [i, j] = key.split(',').map(Number);
      ctx.drawImage(
        bgImg,
        i * OCCL_CELL,
        j * OCCL_CELL,
        OCCL_CELL,
        OCCL_CELL,
        (i - minI) * OCCL_CELL,
        (j - minJ) * OCCL_CELL,
        OCCL_CELL,
        OCCL_CELL,
      );
    }
  }, [cells, bgImg, hasCells, minI, minJ]);

  if (!hasCells) return null;
  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{
        position: 'absolute',
        left: minI * OCCL_CELL,
        top: minJ * OCCL_CELL,
        width,
        height,
        zIndex: baseline,
        imageRendering: 'pixelated',
        pointerEvents: 'none',
      }}
    />
  );
}

/**
 * キャラ画像を cell 高さの帯に分割し、帯ごとに z-index を計算して積む。
 * スプライト全体を1つの z-index（trueFootY）で扱うと、キャラより低い家具（ソファ等）の裏に
 * 立った時に足元だけでなく頭まで隠れてしまう。帯ごとに独立した z-index を持たせることで
 * 「脚は隠れるが頭は見える」という部分遮蔽が成立する（§sofa occlusion fix）。
 *
 * ただし帯の z を「その行の画面上の位置」だけで決めると、キャラの真の足元（trueFootY）が
 * 遮蔽物より南（手前）にいる＝本来は絶対に隠れてはいけない場面でも、キャラの頭が画面上で
 * 別の遮蔽物（例: 奥の壁の棚）の行と重なるとその頭だけ誤って隠れてしまう（実機で発覚）。
 * 「南から見ている＝南側は常に手前」という前提を守るため、帯ごとに「その (i,j) に遮蔽物が
 * あり、かつ trueFootY がその物体の baseline より北（＝本当にその物体の裏にいる）」場合だけ
 * 行固有の低い z を使い、それ以外（遮蔽物が無い／自分はその物体より南にいる）は常に
 * zBase を使ってどの遮蔽物にも絶対に負けないようにする。
 *
 * 帯は「スプライト自身の上端」ではなく「ワールド座標のグリッド線」に揃えて切る。footY は
 * OCCL_CELL の倍数とは限らないため、スプライト基準で割ると帯が遮蔽物セルの行と数px単位で
 * ズレてほぼ重ならなくなる（実機で発覚：帯の大半が遮蔽物セルの外側にはみ出し、隠れなかった）。
 * 帯の高さは歩行判定の cell ではなく OCCL_CELL 固定（②のセルサイズ変更に左右されない）。
 *
 * @param trueFootY スプライトの「接地点」のワールドY。遮蔽物の baseline と比較して前後を決める。
 * @param marginNative 接地点より下にあるキャンバス余白（canvasBottom = trueFootY + marginNative）。
 * @param zBase 遮蔽されない帯に使う z。省略時は trueFootY（＝立ち位置順）。同じ座席のキャラ・
 *   椅子・PC のように「接地点は違うが重ね順は決め打ちしたい」場合に明示する。
 */
export function renderBandedSprite(
  key: string,
  x: number,
  trueFootY: number,
  marginNative: number,
  width: number,
  height: number,
  src: string,
  innerLeft: number,
  innerWidth: number,
  occluderLookup: OccluderLookup,
  zBase?: number,
) {
  const cell = OCCL_CELL;
  const canvasBottom = trueFootY + marginNative;
  const spriteTop = canvasBottom - height;
  const jTop = Math.floor(spriteTop / cell);
  const jBottom = Math.floor((canvasBottom - 0.001) / cell);
  const i = Math.floor(x / cell);
  const front = zBase ?? trueFootY;
  const bands = [];
  for (let j = jTop; j <= jBottom; j++) {
    const rowWorldTop = Math.max(spriteTop, j * cell);
    const rowWorldBottom = Math.min(canvasBottom, (j + 1) * cell);
    const rowH = rowWorldBottom - rowWorldTop;
    if (rowH <= 0) continue;
    const imgTopOffset = rowWorldTop - spriteTop;
    const baseline = occluderLookup.get(`${i},${j}`);
    const hiddenHere = baseline != null && trueFootY < baseline;
    const z = hiddenHere ? Math.round(rowWorldBottom) : Math.round(front);
    bands.push(
      <div
        key={`${key}-${j}`}
        style={{
          position: 'absolute',
          left: x,
          top: rowWorldTop,
          width,
          height: rowH,
          transform: 'translateX(-50%)',
          zIndex: z,
          clipPath: 'inset(0px)',
          imageRendering: 'pixelated',
        }}
      >
        <img
          src={src}
          alt=""
          style={{
            position: 'absolute',
            left: innerLeft,
            top: -imgTopOffset,
            width: innerWidth,
            height,
            imageRendering: 'pixelated',
          }}
        />
      </div>,
    );
  }
  return bands;
}
