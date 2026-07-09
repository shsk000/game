import { describe, expect, it } from 'vitest';
import {
  addWeeks,
  compareDate,
  dateToWeekIndex,
  formatGameDate,
  type GameDate,
  weekIndexToDate,
} from './types';

describe('dateToWeekIndex / weekIndexToDate', () => {
  it('相互変換で元に戻る（roundtrip）', () => {
    const dates: GameDate[] = [
      { year: 2026, month: 1, week: 1 },
      { year: 2026, month: 12, week: 4 },
      { year: 2030, month: 6, week: 3 },
    ];
    for (const d of dates) {
      expect(weekIndexToDate(dateToWeekIndex(d))).toEqual(d);
    }
  });

  it('1ヶ月 = 4週、1年 = 48週', () => {
    const base = dateToWeekIndex({ year: 2026, month: 1, week: 1 });
    expect(dateToWeekIndex({ year: 2026, month: 2, week: 1 }) - base).toBe(4);
    expect(dateToWeekIndex({ year: 2027, month: 1, week: 1 }) - base).toBe(48);
  });
});

describe('addWeeks', () => {
  it('月またぎを正しく処理する', () => {
    expect(addWeeks({ year: 2026, month: 1, week: 4 }, 1)).toEqual({
      year: 2026,
      month: 2,
      week: 1,
    });
  });

  it('年またぎを正しく処理する', () => {
    expect(addWeeks({ year: 2026, month: 12, week: 4 }, 1)).toEqual({
      year: 2027,
      month: 1,
      week: 1,
    });
  });

  it('負数で過去に戻れる', () => {
    expect(addWeeks({ year: 2027, month: 1, week: 1 }, -1)).toEqual({
      year: 2026,
      month: 12,
      week: 4,
    });
  });

  it('0 週で変化なし', () => {
    const d: GameDate = { year: 2026, month: 5, week: 2 };
    expect(addWeeks(d, 0)).toEqual(d);
  });
});

describe('compareDate', () => {
  it('過去 < 現在 < 未来', () => {
    const a: GameDate = { year: 2026, month: 1, week: 1 };
    const b: GameDate = { year: 2026, month: 1, week: 2 };
    expect(compareDate(a, b)).toBeLessThan(0);
    expect(compareDate(b, a)).toBeGreaterThan(0);
    expect(compareDate(a, a)).toBe(0);
  });
});

describe('formatGameDate', () => {
  it('「YYYY年 M月 第N週」形式', () => {
    expect(formatGameDate({ year: 2026, month: 4, week: 3 })).toBe('2026年 4月 第3週');
  });
});
