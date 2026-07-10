import { page, userEvent } from '@vitest/browser/context';
import { beforeEach, describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-react';
import { useGameStore } from '../../state/gameStore';
import { resetStore } from '../../state/testing';
import type { Employee } from '../../state/types';
import { PlanScreen } from './PlanScreen';

const emp: Employee = {
  id: 'e-test-1',
  name: 'テスト 太郎',
  role: 'programmer',
  power: 0.5,
  basePower: 0.5,
  level: 1,
  exp: 0,
  wage: 500_000,
  specialties: [],
};

describe('PlanScreen（ユースケース：企画を立てて開発を開始する）', () => {
  beforeEach(() => {
    resetStore({ screen: 'plan', tutorialDone: true, employees: [emp] });
  });

  it('従業員を1人もアサインしないと開発開始できない', async () => {
    render(<PlanScreen />);
    const start = page.getByRole('button', { name: '▶ 開発開始' });
    await expect.element(start).toBeDisabled();
    await expect.element(page.getByText('※従業員 1 人以上のアサインが必要')).toBeInTheDocument();
  });

  it('ジャンル・テーマを選び従業員をアサインして開始すると開発画面へ遷移する', async () => {
    render(<PlanScreen />);

    // ジャンル「アドベンチャー」・テーマ「温泉」を選ぶ
    await userEvent.click(page.getByRole('button', { name: 'アドベンチャー' }));
    await userEvent.click(page.getByRole('button', { name: '温泉' }));

    // 従業員をアサイン
    await userEvent.click(page.getByRole('checkbox'));

    const start = page.getByRole('button', { name: '▶ 開発開始' });
    await expect.element(start).toBeEnabled();
    await userEvent.click(start);

    const s = useGameStore.getState();
    expect(s.screen).toBe('develop');
    expect(s.current).not.toBeNull();
    expect(s.current?.genreId).toBe('adventure');
    expect(s.current?.themeId).toBe('onsen');
    expect(s.current?.phase).toBe('planning');
    expect(s.current?.assignedEmployeeIds).toEqual([emp.id]);
  });

  it('未解放のジャンルは選択肢に出ない', async () => {
    render(<PlanScreen />);
    // 初期解放はパズル/アドベンチャー/シミュレーションのみ。アクションは stage2 以降
    await expect.element(page.getByRole('button', { name: 'パズル' })).toBeInTheDocument();
    expect(page.getByRole('button', { name: 'アクション' }).elements()).toHaveLength(0);
  });
});
