import { describe, expect, it } from 'vitest';
import { SALES_MULTIPLIER_BY_SCORE, SCALE_BALANCE } from '../data/balance';
import { estimateRevenueRange, formatRoi, formatWeeks, formatYen, formatYenShort } from './format';

describe('formatYen', () => {
  it('1 万未満は素の桁区切り表示', () => {
    expect(formatYen(0)).toBe('¥0');
    expect(formatYen(9_999)).toBe('¥9,999');
  });

  it('万・億・兆で単位を切り替える', () => {
    expect(formatYen(10_000)).toBe('¥1万');
    expect(formatYen(12_000)).toBe('¥1.2万');
    expect(formatYen(100_000_000)).toBe('¥1億');
    expect(formatYen(123_000_000)).toBe('¥1.23億');
    expect(formatYen(3_400_000_000_000)).toBe('¥3.4兆');
  });

  it('負値はマイナス記号付き', () => {
    expect(formatYen(-150_000_000)).toBe('-¥1.5億');
    expect(formatYen(-500)).toBe('-¥500');
  });

  it('非有限値は ¥—', () => {
    expect(formatYen(Number.NaN)).toBe('¥—');
    expect(formatYen(Number.POSITIVE_INFINITY)).toBe('¥—');
  });
});

describe('formatYenShort', () => {
  it('先頭の ¥ / -¥ を外した表記', () => {
    expect(formatYenShort(12_000)).toBe('1.2万');
    expect(formatYenShort(-12_000)).toBe('1.2万');
  });
});

describe('formatWeeks', () => {
  it('4 週 = 1 ヶ月、48 週 = 1 年で整形する', () => {
    expect(formatWeeks(0)).toBe('0 週');
    expect(formatWeeks(3)).toBe('3 週');
    expect(formatWeeks(4)).toBe('1 ヶ月');
    expect(formatWeeks(5)).toBe('1 ヶ月 1 週');
    expect(formatWeeks(48)).toBe('1 年');
    expect(formatWeeks(52)).toBe('1 年 1 ヶ月');
    expect(formatWeeks(53)).toBe('1 年 1 ヶ月 1 週');
  });

  it('負値は 0 週に、非有限値は — になる', () => {
    expect(formatWeeks(-5)).toBe('0 週');
    expect(formatWeeks(Number.NaN)).toBe('—');
  });
});

describe('formatRoi', () => {
  it('符号付きパーセント表示', () => {
    expect(formatRoi(450, 1000)).toBe('+45.0%');
    expect(formatRoi(-123, 1000)).toBe('-12.3%');
  });

  it('投資 0 や非有限値は —', () => {
    expect(formatRoi(100, 0)).toBe('—');
    expect(formatRoi(Number.NaN, 100)).toBe('—');
  });
});

describe('estimateRevenueRange（このチームで届く売上の範囲）', () => {
  const emp = (skills: Record<string, number>) =>
    ({
      id: 'e',
      name: 'e',
      role: 'designer',
      power: 0.2,
      basePower: 0.2,
      level: 1,
      exp: 0,
      wage: 0,
      specialties: [],
      rank: 'B',
      skills,
    }) as never;

  it('社員がいなければ最低帯（打てる分野が無いので致命的失敗）', () => {
    const r = estimateRevenueRange('mini', []);
    expect(r.mid).toBe(
      Math.round(SCALE_BALANCE.mini.baseRevenue * SALES_MULTIPLIER_BY_SCORE.catastrophic),
    );
  });

  it('チームが強いほど予測が上がる（固定の段ではない）', () => {
    const weak = estimateRevenueRange('mini', [emp({ programming: 10 })]);
    const strong = estimateRevenueRange('mini', [
      emp({ programming: 100 }),
      emp({ graphics: 100 }),
      emp({ sound: 100 }),
      emp({ scenario: 100 }),
    ]);
    expect(strong.mid).toBeGreaterThan(weak.mid);
  });

  it('low ≤ mid ≤ high（評価家のブレ ±5 の幅）', () => {
    const r = estimateRevenueRange('indie', [emp({ programming: 60 }), emp({ graphics: 60 })]);
    expect(r.low).toBeLessThanOrEqual(r.mid);
    expect(r.mid).toBeLessThanOrEqual(r.high);
  });

  it('実際に起こりうる売上の範囲を外さない（致命的失敗〜神ゲー）', () => {
    for (const scale of ['mini', 'mobile', 'indie', 'hit', 'aaa'] as const) {
      const base = SCALE_BALANCE[scale].baseRevenue;
      const r = estimateRevenueRange(scale, [emp({ programming: 50 })]);
      expect(r.low).toBeGreaterThanOrEqual(base * SALES_MULTIPLIER_BY_SCORE.catastrophic);
      expect(r.high).toBeLessThanOrEqual(base * SALES_MULTIPLIER_BY_SCORE.godGame);
    }
  });

  it('AAA を赤字帯で固定表示しない（旧実装は失敗帯固定で −¥70億 と出していた）', () => {
    const best = estimateRevenueRange('aaa', [
      emp({ programming: 100 }),
      emp({ graphics: 100 }),
      emp({ sound: 100 }),
      emp({ scenario: 100 }),
      emp({ programming: 100 }),
      emp({ graphics: 100 }),
    ]);
    // 開発費 ¥100億 を上回る予測が出る
    expect(best.mid).toBeGreaterThan(10_000_000_000);
  });
});
