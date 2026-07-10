import { expect, test } from '@playwright/test';

test('L3 計画画面：2 カラム化', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.addInitScript(() => {
    (window as unknown as { __sfxMuted: boolean }).__sfxMuted = true;
    try {
      localStorage.clear();
      sessionStorage.setItem('__cleared', '1');
    } catch {}
  });
  await page.goto('http://localhost:5173');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    document.querySelectorAll('.tutorial-overlay').forEach((n) => n.remove());
  });
  await page.locator('text=計画').first().click({ force: true });
  await page.waitForTimeout(800);

  await expect(page.locator('text=ジャンルを選ぶ').first()).toBeVisible();
  await expect(page.locator('text=企画プレビュー').first()).toBeVisible();
  await expect(page.locator('text=▶ 開発開始').first()).toBeVisible();

  await page.screenshot({ path: 'test-results/v11-l3-plan.png', fullPage: false });
});
