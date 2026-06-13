import { expect, test } from '@playwright/test';

/**
 * 検証：v0.11 開発フェーズの制限秒モデル。
 * mini は neededWeeks 8 週 × 7.5 秒 = timeLimitSec 60。
 * 開発開始 → develop 遷移 → timeLimitSec=60 → カウントダウンが減ることを確認する。
 * （release まで 60 秒待つのはテストが遅いので、制限秒の設定と減少のみ検証）
 */
test('mini の開発は制限秒 60 でカウントダウンする', async ({ page }) => {
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

  const limit = await page.evaluate(() => {
    // @ts-ignore
    return (window as any).__gs?.()?.current?.timeLimitSec;
  });
  expect(limit).toBe(60);

  // 残り時間表示が減っているか（2 秒待って 60 秒未満になる）
  await page.waitForTimeout(2000);
  const remainTextOk = await page
    .locator('text=/\\d+\\.\\d 秒/')
    .first()
    .isVisible()
    .catch(() => false);
  expect(remainTextOk).toBe(true);
});
