import { describe, it } from 'vitest';
import { getCompat, compatLabel } from '../../src/data/compatibility';
import { GENRES } from '../../src/data/genres';
import { THEMES } from '../../src/data/themes';

describe('compat distribution', () => {
  it('dump', () => {
    const vals: number[] = [];
    const byLabel: Record<string, number> = {};
    const rows: string[] = [];
    for (const g of GENRES) {
      const line: string[] = [];
      for (const t of THEMES) {
        const v = getCompat(g.id, t.id);
        vals.push(v);
        byLabel[compatLabel(v)] = (byLabel[compatLabel(v)] ?? 0) + 1;
        line.push(v.toFixed(2));
      }
      rows.push(g.id.padEnd(12) + line.join(' '));
    }
    const hist: Record<string, number> = {};
    for (const v of vals) hist[v.toFixed(2)] = (hist[v.toFixed(2)] ?? 0) + 1;
    console.log('総組合せ', vals.length);
    console.log('ラベル分布', byLabel);
    console.log('値の分布', Object.entries(hist).sort((a,b)=>Number(a[0])-Number(b[0])).map(([k,v])=>`${k}:${v}`).join(' '));
    console.log('ちょうど1.00', vals.filter(v=>v===1).length, `(${Math.round(vals.filter(v=>v===1).length/vals.length*100)}%)`);
    console.log('テーマ順', THEMES.map(t=>t.id).join(' '));
    console.log(rows.join('\n'));
  });
});
