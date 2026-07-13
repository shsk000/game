import { page, userEvent } from '@vitest/browser/context';
import { beforeEach, describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-react';
import { useGameStore } from '../../state/gameStore';
import { resetStore } from '../../state/testing';
import type { CurrentProject } from '../../state/types';
import { ZERO_AXES } from '../../state/types';
import { ReleaseScreen } from './ReleaseScreen';

/** 開発完了直後（finishDevelopment 済み・リリース前）の状態 */
const finishedProject: CurrentProject = {
  title: 'テスト大作',
  genreId: 'puzzle',
  themeId: 'sushi',
  scale: 'mini',
  phase: 'release',
  axes: { ...ZERO_AXES },
  devStats: { program: 0, graphics: 0, sound: 0, design: 0 },
  requiredLoC: 100,
  doneLoC: 24,
  maxCombo: 50,
  devBoostRemainingSec: 0,
  bugCount: 0,
  adDebugUsed: false,
  startedAt: 0,
  finishedAt: 60_000,
  adBoostActive: false,
  surveyedCompat: null,
  selectedCategories: [],
  assignedEmployeeIds: [],
  perf: { wpm: 120, maxCombo: 50, accuracy: 1 },
  startDate: { year: 2026, month: 1, week: 1 },
  timeShortcutsUnlocked: [],
  workTarget: 24,
};

describe('ReleaseScreen（ユースケース：結果を発表して作品が世に出る）', () => {
  beforeEach(() => {
    resetStore({ screen: 'release', tutorialDone: true, current: finishedProject });
  });

  it('発表前は広告選択と「結果を発表」が表示される', async () => {
    render(<ReleaseScreen />);
    await expect.element(page.getByText('🎬 結果を発表')).toBeInTheDocument();
    // まだリリースされていない
    expect(useGameStore.getState().library).toHaveLength(0);
  });

  it('「結果を発表」でリリースが確定し、開封演出の後にメタスコアが表示される', async () => {
    render(<ReleaseScreen />);
    await userEvent.click(page.getByText('🎬 結果を発表'));

    // store 側：作品がライブラリに積まれ、進行中プロジェクトは消える
    const s = useGameStore.getState();
    expect(s.library).toHaveLength(1);
    expect(s.lastReleased?.title).toBe('テスト大作');
    expect(s.current).toBeNull();

    // UI 側：開封演出（約 3.8 秒）の後にメタスコアのラベルが出る
    await expect.element(page.getByText('メタスコア'), { timeout: 8000 }).toBeInTheDocument();
  });

  it('参加社員がレベルアップすると開封画面に「⬆ Lv up」が出る（v0.16）', async () => {
    // exp をしきい値直前にした社員をアサインしてリリース → 必ず Lv2 になる
    resetStore({
      screen: 'release',
      tutorialDone: true,
      current: { ...finishedProject, assignedEmployeeIds: ['e-lv'] },
      employees: [
        {
          id: 'e-lv',
          name: '育成 花子',
          role: 'programmer',
          power: 0.4,
          basePower: 0.4,
          level: 1,
          exp: 19, // nextExpFor(1)=20。リリースで +10 以上入る
          wage: 540_000,
          specialties: [],
        },
      ],
    });
    render(<ReleaseScreen />);
    await userEvent.click(page.getByText('🎬 結果を発表'));

    expect(useGameStore.getState().employees[0].level).toBe(2);
    await expect
      .element(page.getByText('⬆ 育成 花子 が Lv2 になった！'), { timeout: 8000 })
      .toBeInTheDocument();
  });
});
