import { expect, test } from '@playwright/test';

/**
 * 検証：販売中作品の売上が tickSales 経由で funds に積み上がるか。
 * v10-screens.spec.ts のシードと同じ形で 1 本販売中の library を仕込み、
 * 5 秒後に funds と totalRevenue が増えていることを確認する。
 */
test('販売中作品の売上が funds に積み上がる', async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { __sfxMuted: boolean }).__sfxMuted = true;
    try {
      localStorage.clear();
      const persisted = {
        version: 5 as const,
        funds: 1_000_000,
        lifetimeRevenue: 0,
        fans: 0,
        employees: [],
        unlockedScales: ['mini'] as const,
        unlockedGenres: ['action'],
        unlockedThemes: ['fantasy'],
        unlockedCategories: ['graphics', 'sound', 'gameplay'],
        ghosts: { mini: null, mobile: null, indie: null, hit: null, aaa: null },
        library: [
          {
            id: 'w1',
            title: 'テスト作',
            genreId: 'action',
            themeId: 'fantasy',
            scale: 'mini',
            quality: 70,
            metascore: 72,
            isMasterpiece: false,
            developSec: 60,
            initialRevenue: 500_000,
            salesPool: 4_000_000,
            initialSalesPool: 4_000_000,
            decayPerSec: 0.012,
            totalRevenue: 500_000,
            selling: true,
            fansGained: 40,
            ghostBeaten: false,
            launchAdUsed: false,
            pioneer: false,
            releasedAt: Date.now(),
            createdAt: Date.now(),
            breakdown: { charPower: 60, genreAffinity: 60, performance: 60, luck: 50 },
            selectedCategories: ['graphics', 'sound', 'gameplay'],
            developWeeks: 8,
          },
        ],
        trend: null,
        records: { bestMetascore: 72, bestRevenue: 500000, bestCombo: 0, bestWPM: 0 },
        achievements: [],
        tutorialDone: true,
        lastSeenAt: Date.now(),
        currentDate: { year: 2026, month: 1, week: 1 },
      };
      localStorage.setItem('typing-factory:v5', JSON.stringify(persisted));
      sessionStorage.setItem('__cleared', '1');
    } catch {}
  });
  // 相対 URL（baseURL＝GAME_PORT に解決）。絶対 URL を書くと別ツリーのサーバーを見て偽グリーンになる。
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    document.querySelectorAll('.tutorial-overlay').forEach((n) => n.remove());
  });

  // 初期値（座席への描画後の値を取得）
  const fundsLocator = page.locator('text=/¥\\s*\\d/').first();
  const before = await fundsLocator.textContent();
  console.log('[sales] before:', before);

  // 5 秒待って tickSales が 5 回発火するのを観察
  await page.waitForTimeout(5000);

  const after = await fundsLocator.textContent();
  console.log('[sales] after :', after);

  expect(after).not.toBe(before);
});
