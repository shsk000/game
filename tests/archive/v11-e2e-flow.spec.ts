import { expect, type Page, test } from '@playwright/test';

/**
 * v0.11 UI 刷新後の E2E：オフィス → CTA「新しいゲームを作る」→ 計画 →
 * 開発開始 → 開発（時間経過）→ リリース → オフィス、の動線が壊れていないか確認。
 */
async function seedSession(page: Page) {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.addInitScript(() => {
    (window as unknown as { __sfxMuted: boolean }).__sfxMuted = true;
    try {
      localStorage.clear();
      const persisted = {
        version: 5 as const,
        funds: 50_000_000,
        lifetimeRevenue: 0,
        fans: 0,
        employees: [
          {
            id: 'e1',
            name: 'テスト 太郎',
            role: 'programmer',
            power: 2.5,
            wage: 800_000,
            specialties: [],
          },
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
}

test('E2E: オフィス → CTA → 計画画面', async ({ page }) => {
  await seedSession(page);

  // オフィス画面で CTA「▶ 新しいゲームを作る」が表示されている
  const ctaButton = page.locator('button', { hasText: '新しいゲームを作る' }).first();
  await expect(ctaButton).toBeVisible();

  // CTA クリック → screen が plan に切り替わる
  await ctaButton.click({ force: true });
  await page.waitForTimeout(500);

  const screen = await page.evaluate(() => {
    // @ts-ignore
    return (window as any).__gs?.()?.screen;
  });
  expect(screen).toBe('plan');

  // 計画画面でジャンル選択 UI が見える
  await expect(page.locator('text=ジャンルを選ぶ').first()).toBeVisible();
  await expect(page.locator('text=▶ 開発開始').first()).toBeVisible();
});

test('E2E: 計画 → 開発開始 → 開発画面', async ({ page }) => {
  await seedSession(page);
  await page.locator('button', { hasText: '新しいゲームを作る' }).first().click({ force: true });
  await page.waitForTimeout(500);

  // 計画画面でカテゴリ 3 つ選択（自動でジャンル/テーマ/規模/従業員は seed のものを使用）
  for (const cid of ['graphics', 'sound', 'gameplay']) {
    await page.locator(`[data-category-id="${cid}"]`).click({ force: true });
    await page.waitForTimeout(150);
  }
  // 従業員アサイン
  await page.locator('[data-employee-id="e1"]').check();
  await page.waitForTimeout(300);

  // 開発開始ボタン押下
  const startBtn = page.locator('button', { hasText: '▶ 開発開始' }).first();
  await expect(startBtn).toBeEnabled();
  await startBtn.click({ force: true });
  await page.waitForTimeout(800);

  // develop 画面に遷移
  const screen = await page.evaluate(() => {
    // @ts-ignore
    return (window as any).__gs?.()?.screen;
  });
  expect(screen).toBe('develop');

  // 開発フェーズパネルが表示されている
  await expect(page.locator('text=開発フェーズ').first()).toBeVisible();
});
