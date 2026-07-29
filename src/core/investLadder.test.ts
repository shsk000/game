import { describe, it } from 'vitest';
import { GENRES } from '../data/genres';
import { THEMES } from '../data/themes';
import { investPrice } from './invest';

/**
 * 解放価格のラダーを**目に見える形で残す**ためのスナップショット。
 * 落ちることはない（`expect` を持たない）。数値を変えたときにここの出力を読んで判断する。
 * 実際のガードは `invest.test.ts`（壁にならないこと）にある。
 */
const yen = (v: number) =>
  v >= 1e8 ? `${(v / 1e8).toFixed(2)}億` : `${Math.round(v / 1e4).toLocaleString()}万`;

describe('解放価格ラダー（読むための出力）', () => {
  it('stage 別の価格と総額', () => {
    const counts: Record<number, number> = {};
    for (const x of [...GENRES, ...THEMES]) {
      if (x.unlockStage >= 2) counts[x.unlockStage] = (counts[x.unlockStage] ?? 0) + 1;
    }
    let grand = 0;
    for (const stage of [2, 3, 4]) {
      const n = counts[stage] ?? 0;
      let total = 0;
      const marks: string[] = [];
      for (let i = 0; i < n; i++) {
        const price = investPrice(stage, i) ?? 0;
        total += price;
        if (i === 0 || i === Math.floor(n / 2) || i === n - 1) {
          marks.push(`${i + 1}個目 ${yen(price)}`);
        }
      }
      grand += total;
      console.log(`stage${stage}（${n}個）: ${marks.join(' / ')} … 合計 ${yen(total)}`);
    }
    console.log(`全部そろえる総額: ${yen(grand)}`);
  });
});
