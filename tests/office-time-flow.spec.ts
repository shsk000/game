import { expect, test } from '@playwright/test';

/**
 * 検証：office 画面でアイドル中、30 秒ごとに「ゲーム内時間」が進むか。
 * GlobalTicker（30000ms/週）の挙動を 35 秒待って観察する。
 */
test('office アイドル中に 30 秒で 1 週進む', async ({ page }) => {
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

  const dateLocator = page.locator('text=/\\d+年\\s*\\d+月\\s*第\\d+週/').first();
  const before = await dateLocator.textContent();
  console.log('[time] before:', before);

  // 35 秒待つ（30 秒/週 + 余裕）
  await page.waitForTimeout(35000);

  const after = await dateLocator.textContent();
  console.log('[time] after :', after);

  expect(after).not.toBe(before);
});
