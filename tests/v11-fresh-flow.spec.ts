import { type Page, test } from '@playwright/test';

/**
 * 新規プレイヤー（従業員 0 人）状態でオフィス画面の CTA がどう振る舞うかを検証。
 */
async function freshSession(page: Page) {
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
}

test('fresh: 従業員 0 人で起動', async ({ page }) => {
  await freshSession(page);

  // 現在の state を確認
  const state = await page.evaluate(() => {
    // @ts-ignore
    const s = (window as any).__gs?.();
    return { screen: s?.screen, employees: s?.employees?.length, funds: s?.funds };
  });
  console.log('[fresh] state:', state);

  await page.screenshot({ path: 'test-results/v11-fresh-office.png', fullPage: false });

  // CTA「新しいゲームを作る」のクリック挙動
  const cta = page.locator('button', { hasText: '新しいゲームを作る' }).first();
  const isDisabled = await cta.isDisabled();
  console.log('[fresh] CTA disabled?', isDisabled);

  // CTA をクリックしてみる（disabled なら何も起きないはず）
  await cta.click({ force: true });
  await page.waitForTimeout(500);
  const stateAfterClick = await page.evaluate(() => {
    // @ts-ignore
    return (window as any).__gs?.()?.screen;
  });
  console.log('[fresh] screen after CTA click:', stateAfterClick);

  // 「👥 従業員を雇う」ボタンの存在確認
  const hireBtn = page.locator('button', { hasText: '従業員を雇う' }).first();
  const hireVisible = await hireBtn.isVisible();
  console.log('[fresh] hire button visible?', hireVisible);
});
