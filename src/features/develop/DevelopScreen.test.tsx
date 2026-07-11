import { page, userEvent } from '@vitest/browser/context';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { defaultDeps } from '../../core/ports';
import { setGameDeps, useGameStore } from '../../state/gameStore';
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
  devStats: { program: 0, graphics: 0, sound: 0, design: 0 },
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
  selectedCategories: [],
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

/**
 * v0.19：手札3枚の提示を待って 1 キーで選ぶ（1枚目は常に標準チケット）。
 * v0.19.1：手札が全部標準（実質選択肢なし）だと選択画面ごと自動通過するため、
 * このヘルパーを使うテストは beforeEach で Math.random を低く固定し、
 * チャレンジ枠（出現率30%）を必ず引かせて「選択画面が出る」前提を保証する。
 */
const selectFirstHandTicket = async () => {
  await expect.element(page.getByText('つぎの作業を選ぶ', { exact: false })).toBeInTheDocument();
  await userEvent.keyboard('1');
  await vi.waitFor(() => expect(nextKey()).toBeTruthy());
};

describe('DevelopScreen（ユースケース：手札を選んで打鍵すると開発が進む）', () => {
  beforeEach(() => {
    resetStore({ screen: 'develop', tutorialDone: true, current: devProject });
    // チャレンジ枠を必ず引かせて手札に実質的な選択肢を作る（v0.19.1 の自動通過を避ける）
    vi.spyOn(Math, 'random').mockReturnValue(0.01);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('開発フェーズはまず手札選択が出て、選ぶまでタイピングが始まらない', async () => {
    render(<DevelopScreen />);
    await expect.element(page.getByText('テスト開発中')).toBeInTheDocument();
    // 手札3枚の選択UIが提示され、入力行はまだ無い
    await expect.element(page.getByText('つぎの作業を選ぶ', { exact: false })).toBeInTheDocument();
    expect(nextKey()).toBeNull();
  });

  it('キー1で手札を選ぶと入力行（次に打つキー）が表示される', async () => {
    render(<DevelopScreen />);
    await selectFirstHandTicket();
    expect(nextKey()).toBeTruthy();
  });

  it('手札を選んで提示どおりに打鍵するとコンボと正打が積み上がる', async () => {
    render(<DevelopScreen />);
    await selectFirstHandTicket();

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

  it('キー1で選択→1文打ち切りで属性報酬（devStats）が入る', async () => {
    render(<DevelopScreen />);
    // 1枚目は常に標準チケット。puzzle の ticketIndex 0 はプログラム作業
    await selectFirstHandTicket();

    // 1文（かな十数文字）を打ち切るまで提示キーを打ち続ける
    for (let i = 0; i < 120; i++) {
      const s = useGameStore.getState().current;
      if ((s?.devStats?.program ?? 0) > 0) break;
      const k = nextKey();
      if (!k) {
        await vi.waitFor(() => expect(nextKey()).toBeTruthy());
        continue;
      }
      await userEvent.keyboard(k);
    }

    const cur = useGameStore.getState().current;
    expect(cur?.devStats?.program ?? 0).toBeGreaterThan(0);
    expect(cur?.doneLoC ?? 0).toBeGreaterThan(0);
  });

  it('間違ったキーを打つと、その数だけバグが積まれる（v0.17.1 ミス＝バグ確定）', async () => {
    render(<DevelopScreen />);
    await selectFirstHandTicket();

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

describe('DevelopScreen（v0.19.1：手札に実質的な選択肢が無ければ自動で通過する）', () => {
  beforeEach(() => {
    resetStore({ screen: 'develop', tutorialDone: true, current: devProject });
    // チャレンジ（30%）も即修（bugCount=0 のため無条件で無し）も外れさせ、手札を全部標準にする
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('手札が全部標準チケットのときは選択画面を出さず即入力行が表示される', async () => {
    render(<DevelopScreen />);
    await expect.element(page.getByText('テスト開発中')).toBeInTheDocument();
    await vi.waitFor(() => expect(nextKey()).toBeTruthy());
    expect(document.body.textContent).not.toContain('つぎの作業を選ぶ');
  });
});

describe('DevelopScreen（v0.19.1：チャレンジの報酬は進捗ブースト＋完遂でバグ-1）', () => {
  beforeEach(() => {
    resetStore({ screen: 'develop', tutorialDone: true, current: { ...devProject, bugCount: 2 } });
    // チャレンジ枠を必ず引かせる（即修枠も bugCount>=1 のため同時に出るが本テストとは無関係）
    vi.spyOn(Math, 'random').mockReturnValue(0.01);
    // v0.17.1 の正打バグ抽選（noteBugOnKeystroke）は deps.rng 経由＝Math.random スパイの
    // 影響を受けない（gameStore の defaultDeps.rng は import 時に束縛済み）。本テストは
    // チャレンジ完遂ボーナスだけを見たいので、setGameDeps で確実に外れる rng に差し替える。
    setGameDeps({ rng: () => 0.99, now: Date.now });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    setGameDeps(defaultDeps);
  });

  it('チャレンジを選んでミスなく5文打ち切ると、バグが1匹減り「チャレンジ達成」の注記が出る', async () => {
    render(<DevelopScreen />);
    await expect.element(page.getByText('つぎの作業を選ぶ', { exact: false })).toBeInTheDocument();
    await userEvent.keyboard('2'); // 2枚目＝チャレンジ（1枚目は常に標準）
    await vi.waitFor(() => expect(nextKey()).toBeTruthy());

    // 5文をミスなく打ち切るまで、提示キーをそのまま打ち続ける
    for (let i = 0; i < 400; i++) {
      if ((useGameStore.getState().current?.bugCount ?? 2) < 2) break;
      const k = nextKey();
      if (!k) {
        await vi.waitFor(() => expect(nextKey()).toBeTruthy());
        continue;
      }
      await userEvent.keyboard(k);
    }

    const cur = useGameStore.getState().current;
    expect(cur?.bugCount).toBe(1);
    expect(document.body.textContent).toContain('チャレンジ達成');
  });
});
