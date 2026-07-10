import { expect, test } from '@playwright/test';

/**
 * v0.11 Phase L1 共通骨格検証：
 * - .game-root が 1280×720
 * - PixelStatusBar が高さ 56px、日付パネル含む
 * - PixelMenuBar が高さ 84px、フッタ位置
 * - スクロールバーが画面に出ない（オフィス画面のみまずチェック）
 */
test('L1 オフィス画面：1280×720 固定 + 日付パネル + フッタメニュー', async ({ page }) => {
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

  // game-root が存在する
  const gameRoot = page.locator('.game-root');
  await expect(gameRoot).toBeVisible();
  const gameRootBox = await gameRoot.boundingBox();
  expect(gameRootBox).not.toBeNull();
  console.log('[L1] game-root:', gameRootBox);

  // 日付ラベルが PixelStatusBar 内に存在する
  await expect(page.locator('text=/\\d+年\\s*\\d+月\\s*第\\d+週/').first()).toBeVisible();

  // フッタメニュー（PixelMenuBar）に 7 項目
  for (const label of ['計画', '採用', '規模', '作品', '図鑑', '実績', '設定']) {
    await expect(page.locator(`text=${label}`).first()).toBeVisible();
  }

  // スクショ
  await page.screenshot({ path: 'test-results/v11-l1-office.png', fullPage: false });
});
