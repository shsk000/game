import { beforeEach, describe, expect, it } from 'vitest';
import { BUG_CONFIG } from '../data/balance';
import { useGameStore } from './gameStore';
import { resetStore } from './testing';
import type { CurrentProject } from './types';
import { ZERO_AXES } from './types';

const devProject = (over: Partial<CurrentProject> = {}): CurrentProject => ({
  title: 'テスト',
  genreId: 'puzzle',
  themeId: 'sushi',
  scale: 'mini',
  phase: 'development',
  axes: { ...ZERO_AXES },
  devStats: { program: 0, graphics: 0, sound: 0, design: 0 },
  requiredLoC: 100,
  doneLoC: 24,
  maxCombo: 0,
  devBoostRemainingSec: 0,
  bugCount: 0,
  startedAt: 0,
  finishedAt: null,
  adBoostActive: false,
  surveyedCompat: null,
  selectedCategories: [],
  assignedEmployeeIds: [],
  perf: { wpm: 100, maxCombo: 0, accuracy: 1 },
  startDate: { year: 2026, month: 1, week: 1 },
  timeShortcutsUnlocked: [],
  workTarget: 24,
  ...over,
});

describe('advancePhase（v0.17.1 バグ最低保証）', () => {
  beforeEach(() => resetStore());

  it('開発→テスト遷移でバグ 0 でも最低保証ぶんが見つかる', () => {
    resetStore({ current: devProject({ bugCount: 0 }) });
    useGameStore.getState().advancePhase();
    const cur = useGameStore.getState().current;
    expect(cur?.phase).toBe('testing');
    expect(cur?.bugCount).toBe(BUG_CONFIG.minBugsOnDevComplete);
  });

  it('すでに出ているバグは減らない', () => {
    resetStore({ current: devProject({ bugCount: 4 }) });
    useGameStore.getState().advancePhase();
    expect(useGameStore.getState().current?.bugCount).toBe(4);
  });

  it('テスト→デバッグ遷移では保証を適用しない（修正済みが復活しない）', () => {
    resetStore({ current: devProject({ phase: 'testing', bugCount: 2 }) });
    useGameStore.getState().advancePhase();
    const cur = useGameStore.getState().current;
    expect(cur?.phase).toBe('debugging');
    expect(cur?.bugCount).toBe(2);
  });
});
