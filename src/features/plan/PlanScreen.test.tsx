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
  specialties: [], skills: {},
};

describe('PlanScreen（ユースケース：企画を立てて開発を開始する）', () => {
  beforeEach(() => {
    resetStore({ screen: 'plan', tutorialDone: true, employees: [emp] });
  });

  it('従業員が 1 人もいないと開発開始できない（v0.17：全員参加制）', async () => {
    resetStore({ screen: 'plan', tutorialDone: true, employees: [] });
    render(<PlanScreen />);
    const start = page.getByRole('button', { name: '▶ 開発開始' });
    await expect.element(start).toBeDisabled();
  });

  it('ジャンル・テーマを選ぶだけで開始できる（アサイン操作なし・全員参加）', async () => {
    render(<PlanScreen />);

    // 開発チームは全員参加として表示される
    await expect.element(page.getByText('全員参加（1人）')).toBeInTheDocument();

    await userEvent.click(page.getByRole('button', { name: 'アドベンチャー' }));
    await userEvent.click(page.getByRole('button', { name: '温泉' }));

    const start = page.getByRole('button', { name: '▶ 開発開始' });
    await expect.element(start).toBeEnabled();
    await userEvent.click(start);

    const s = useGameStore.getState();
    expect(s.screen).toBe('develop');
    expect(s.current?.genreId).toBe('adventure');
    expect(s.current?.themeId).toBe('onsen');
    // 全員参加
    expect(s.current?.assignedEmployeeIds).toEqual([emp.id]);
  });

  it('タイトルを自分で入力でき、そのまま作品名になる（v0.17）', async () => {
    render(<PlanScreen />);
    const input = page.getByRole('textbox', { name: 'ゲームタイトル' });
    await input.fill('じぶんのげーむ');
    await userEvent.click(page.getByRole('button', { name: '▶ 開発開始' }));
    expect(useGameStore.getState().current?.title).toBe('じぶんのげーむ');
  });

  it('🎲 でランダムタイトルに差し替えられる', async () => {
    render(<PlanScreen />);
    const input = page.getByRole('textbox', { name: 'ゲームタイトル' });
    await input.fill('');
    await userEvent.click(page.getByRole('button', { name: 'タイトルをランダム生成' }));
    // 組み合わせ生成で何かしらのタイトルが入る
    const el = input.element() as HTMLInputElement;
    expect(el.value.length).toBeGreaterThan(0);
  });

  it('未解放のジャンルは選択肢に出ない', async () => {
    render(<PlanScreen />);
    await expect.element(page.getByRole('button', { name: 'パズル' })).toBeInTheDocument();
    expect(page.getByRole('button', { name: 'アクション' }).elements()).toHaveLength(0);
  });
});
