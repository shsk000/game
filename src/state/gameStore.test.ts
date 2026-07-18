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
  adDebugUsed: false,
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

describe('adDebugAssist（v0.19 広告でバグ半減・1開発1回）', () => {
  beforeEach(() => resetStore());

  it('バグ残数の 50%（切り上げ）を即駆除し、使用済みになる', () => {
    resetStore({ current: devProject({ phase: 'debugging', bugCount: 5 }) });
    expect(useGameStore.getState().adDebugAssist()).toBe(true);
    const cur = useGameStore.getState().current;
    expect(cur?.bugCount).toBe(2); // 5 - ceil(5/2)=3
    expect(cur?.adDebugUsed).toBe(true);
  });

  it('1開発1回：2回目は false でバグは減らない', () => {
    resetStore({ current: devProject({ phase: 'debugging', bugCount: 8 }) });
    expect(useGameStore.getState().adDebugAssist()).toBe(true);
    expect(useGameStore.getState().current?.bugCount).toBe(4);
    expect(useGameStore.getState().adDebugAssist()).toBe(false);
    expect(useGameStore.getState().current?.bugCount).toBe(4);
  });

  it('バグ 0 のときは false（使用済みにもならない）', () => {
    resetStore({ current: devProject({ phase: 'debugging', bugCount: 0 }) });
    expect(useGameStore.getState().adDebugAssist()).toBe(false);
    expect(useGameStore.getState().current?.adDebugUsed).toBe(false);
  });

  it('プロジェクトが無ければ false', () => {
    resetStore({ current: null });
    expect(useGameStore.getState().adDebugAssist()).toBe(false);
  });
});
