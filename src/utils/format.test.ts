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

describe('estimateRevenueRange', () => {
  it('実売上式（baseRevenue × 段倍率）と同じ数列を返す', () => {
    const base = SCALE_BALANCE.mini.baseRevenue;
    expect(estimateRevenueRange('mini')).toEqual({
      low: Math.round(base * SALES_MULTIPLIER_BY_SCORE.catastrophic),
      mid: Math.round(base * SALES_MULTIPLIER_BY_SCORE.failure),
      high: Math.round(base * SALES_MULTIPLIER_BY_SCORE.bigHit),
    });
  });

  it('予測レンジは実際に起こりうる売上の範囲を外さない（詐称の再発防止）', () => {
    // 旧実装は scales.ts の baseUnit という別数列を使っていたため、インディー以上で
    // 「予測の中央値」が「実際の最悪帯（致命的失敗）」すら下回っていた。
    for (const scale of ['mini', 'mobile', 'indie', 'hit', 'aaa'] as const) {
      const base = SCALE_BALANCE[scale].baseRevenue;
      const worst = base * SALES_MULTIPLIER_BY_SCORE.catastrophic;
      const best = base * SALES_MULTIPLIER_BY_SCORE.godGame;
      const r = estimateRevenueRange(scale);
      expect(r.low).toBeGreaterThanOrEqual(Math.round(worst));
      expect(r.mid).toBeGreaterThan(r.low);
      expect(r.high).toBeGreaterThan(r.mid);
      expect(r.high).toBeLessThanOrEqual(Math.round(best));
    }
  });
});
