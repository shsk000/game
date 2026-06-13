import { expect, type Page, test } from '@playwright/test';

/**
 * v0.11 開発フェーズ中央パネルの検証。
 * シードで従業員 1 人 + 解放済みを仕込み、計画→開発開始→develop でスクショ + 挙動確認。
 */
async function seedAndStartDevelop(page: Page) {
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
  // 計画へ
  await page.locator('button', { hasText: '新しいゲームを作る' }).first().click({ force: true });
  await page.waitForTimeout(500);
  // カテゴリ 3 つ
  for (const cid of ['graphics', 'sound', 'gameplay']) {
    await page.locator(`[data-category-id="${cid}"]`).click({ force: true });
    await page.waitForTimeout(120);
  }
  // 従業員アサイン
  await page.locator('[data-employee-id="e1"]').check();
  await page.waitForTimeout(200);
  // 開発開始
  await page.locator('button', { hasText: '▶ 開発開始' }).first().click({ force: true });
  await page.waitForTimeout(600);
}

test('v11 develop panel スクショ + 主要要素', async ({ page }) => {
  await seedAndStartDevelop(page);

  const screen = await page.evaluate(() => {
    // @ts-ignore
    return (window as any).__gs?.()?.screen;
  });
  expect(screen).toBe('develop');

  await expect(page.locator('text=開発フェーズ').first()).toBeVisible();
  await expect(page.locator('text=進捗（速いほど早く完成）').first()).toBeVisible();
  await expect(page.locator('text=COMBO').first()).toBeVisible();
  await expect(page.locator('text=入力する文章').first()).toBeVisible();
  await expect(page.locator('text=開発への影響（この入力結果）').first()).toBeVisible();

  await page.screenshot({ path: 'test-results/v11-develop.png', fullPage: false });
});

test('v11 develop: 進捗オンリー（入力しないと終わらない・時間で完了しない）', async ({ page }) => {
  await seedAndStartDevelop(page);

  // workTarget（作業量目標）が設定され、進捗オンリーで動く
  const target = await page.evaluate(() => {
    // @ts-ignore
    return (window as any).__gs?.()?.current?.workTarget;
  });
  expect(target).toBeGreaterThan(0);
  console.log('[develop] workTarget =', target);

  // 入力しないまま放置 → 締切が無いので開発は完了せず develop のまま
  // （かつゲーム内時間も止まっている）
  const d1 = await page.evaluate(() => {
    // @ts-ignore
    const c = (window as any).__gs?.()?.currentDate;
    return `${c.year}-${c.month}-${c.week}`;
  });
  await page.waitForTimeout(3000);
  const after = await page.evaluate(() => {
    // @ts-ignore
    const s = (window as any).__gs?.();
    return { screen: s?.screen, date: `${s.currentDate.year}-${s.currentDate.month}-${s.currentDate.week}` };
  });
  expect(after.screen).toBe('develop'); // 放置では終わらない
  expect(after.date).toBe(d1); // 開発中は週が進まない
});
