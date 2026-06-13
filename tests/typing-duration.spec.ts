import { expect, test } from '@playwright/test';

/**
 * 検証：v0.11 後期の開発フェーズ＝進捗オンリーモデル。
 * 締切（残り時間）は廃止。作業量目標 workTarget まで打って初めて完了する。
 * mini は neededWeeks 8 週 × DEV_PHRASES_PER_WEEK(3) = workTarget 24 本。
 * 開発開始 → develop 遷移 → workTarget=24 が設定され、進捗 UI が出ることを確認する。
 */
test('mini の開発は進捗オンリー（workTarget 24・残り時間なし）', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.addInitScript(() => {
    (window as unknown as { __sfxMuted: boolean }).__sfxMuted = true;
    try {
      localStorage.clear();
      const persisted = {
        version: 5 as const,
        funds: 5_000_000,
        lifetimeRevenue: 0,
        fans: 0,
        employees: [
          { id: 'e1', name: 'P', role: 'programmer', power: 1.0, wage: 500_000, specialties: [] },
        ],
        unlockedScales: ['mini'],
        unlockedGenres: ['puzzle'],
        unlockedThemes: ['sushi'],
        unlockedCategories: ['graphics', 'sound', 'gameplay'],
        ghosts: { mini: null, mobile: null, indie: null, hit: null, aaa: null },
        library: [],
        trend: null,
        records: { bestMetascore: 0, bestRevenue: 0, bestCombo: 0, bestWPM: 0 },
        achievements: [],
        tutorialDone: true,
        lastSeenAt: Date.now(),
        currentDate: { year: 2026, month: 1, week: 1 },
      };
      localStorage.setItem('typing-factory:v5', JSON.stringify(persisted));
      sessionStorage.setItem('__cleared', '1');
    } catch {}
  });
  await page.goto('http://localhost:5173');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    document.querySelectorAll('.tutorial-overlay').forEach((n) => n.remove());
  });

  // 計画 → カテゴリ 3 + 従業員 → 開発開始
  await page.locator('button', { hasText: '新しいゲームを作る' }).first().click({ force: true });
  await page.waitForTimeout(500);
  for (const cid of ['graphics', 'sound', 'gameplay']) {
    await page.locator(`[data-category-id="${cid}"]`).click({ force: true });
    await page.waitForTimeout(120);
  }
  await page.locator('[data-employee-id="e1"]').check();
  await page.waitForTimeout(200);
  await page.locator('button', { hasText: '▶ 開発開始' }).first().click({ force: true });

  await page
    .waitForFunction(
      // @ts-ignore
      () => (window as any).__gs?.()?.screen === 'develop',
      { timeout: 5000 },
    )
    .catch(() => {});

  const target = await page.evaluate(() => {
    // @ts-ignore
    return (window as any).__gs?.()?.current?.workTarget;
  });
  expect(target).toBe(24);

  // 締切は廃止：残り時間表示は無い。進捗 UI が出ている
  await expect(page.locator('text=進捗（速いほど早く完成）').first()).toBeVisible();
  await expect(page.locator('text=完成まであと').first()).toBeVisible();
  const hasCountdown = await page
    .locator('text=/\\d+\\.\\d 秒/')
    .first()
    .isVisible()
    .catch(() => false);
  expect(hasCountdown).toBe(false);
});
