import { page, userEvent } from '@vitest/browser/context';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { useGameStore } from '../../state/gameStore';
import { resetStore } from '../../state/testing';
import type { CurrentProject } from '../../state/types';
import { ZERO_AXES } from '../../state/types';
import { DevelopScreen } from './DevelopScreen';

/** 開発フェーズ進行中のプロジェクト */
const devProject: CurrentProject = {
  title: 'テスト開発中',
  genreId: 'puzzle',
  themeId: 'sushi',
  scale: 'mini',
  phase: 'development',
  axes: { ...ZERO_AXES },
  devStats: { program: 0, graphics: 0, sound: 0, scenario: 0 },
  requiredLoC: 100,
  doneLoC: 0,
  maxCombo: 0,
  devBoostRemainingSec: 0,
  bugCount: 0,
  adDebugUsed: false,
  startedAt: 0,
  finishedAt: null,
  adBoostActive: false,
  surveyedCompat: null,
  assignedEmployeeIds: [],
  perf: { wpm: 0, maxCombo: 0, accuracy: 1 },
  startDate: { year: 2026, month: 1, week: 1 },
  timeShortcutsUnlocked: [],
  workTarget: 24,
};

/** 画面が提示している「次に打つキー」を読み取る */
const nextKey = (): string | null => {
  const el = document.querySelector('.dev-next-key');
  return el?.textContent?.trim() || null;
};

describe('DevelopScreen（ユースケース：正しく打鍵すると開発が進む）', () => {
  beforeEach(() => {
    resetStore({ screen: 'develop', tutorialDone: true, current: devProject });
  });

  it('開発フェーズの画面に入力行（次に打つキー）が表示される', async () => {
    render(<DevelopScreen />);
    await expect.element(page.getByText('テスト開発中')).toBeInTheDocument();
    // 入力行のネクストキーが提示される
    await vi.waitFor(() => expect(nextKey()).toBeTruthy());
  });

  it('提示どおりに打鍵するとコンボと正打が積み上がる', async () => {
    render(<DevelopScreen />);
    await vi.waitFor(() => expect(nextKey()).toBeTruthy());

    // 画面が提示するネクストキーをそのまま 10 打鍵
    for (let i = 0; i < 10; i++) {
      const k = nextKey();
      if (!k) break;
      await userEvent.keyboard(k);
    }

    const cur = useGameStore.getState().current;
    expect(cur?.maxCombo).toBeGreaterThanOrEqual(5);
    expect(cur?.perf.accuracy).toBe(1);
  });

  it('間違ったキーを打つと、その数だけバグが積まれる（v0.17.1 ミス＝バグ確定）', async () => {
    render(<DevelopScreen />);
    await vi.waitFor(() => expect(nextKey()).toBeTruthy());

    // 提示キーと必ず違うキーを 5 回打つ（実 CDP 入力＝本物の入力経路）
    for (let i = 0; i < 5; i++) {
      const k = nextKey();
      if (!k) break;
      await userEvent.keyboard(k === 'q' ? 'w' : 'q');
    }

    const cur = useGameStore.getState().current;
    expect(cur?.bugCount).toBe(5);
    expect(cur?.perf.accuracy).toBeLessThan(1);
  });
});
