import { type Page, test } from '@playwright/test';

/** v0.11 L1〜L7 完了後の全画面スクショ取得 */
async function seedAndGo(page: Page) {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.addInitScript(() => {
    (window as unknown as { __sfxMuted: boolean }).__sfxMuted = true;
    try {
      localStorage.clear();
      // tutorialDone=true + 軽い library を仕込んで全画面の見栄えを良くする
      const persisted = {
        version: 5 as const,
        funds: 50_000_000,
        lifetimeRevenue: 80_000_000,
        fans: 800,
        employees: [
          { id: 'e1', name: '佐藤 太郎', role: 'programmer', power: 2.5, wage: 800_000, specialties: [] },
          { id: 'e2', name: '田中 花子', role: 'designer', power: 4, wage: 1_100_000, specialties: [] },
        ],
        unlockedScales: ['mini', 'mobile'],
        unlockedGenres: ['puzzle', 'adventure', 'simulation'],
        unlockedThemes: ['sushi', 'onsen', 'farming'],
        unlockedCategories: ['graphics', 'sound', 'gameplay'],
        ghosts: { mini: null, mobile: null, indie: null, hit: null, aaa: null },
        library: [
          {
            id: 'w1',
            title: 'すしパズル',
            genreId: 'puzzle',
            themeId: 'sushi',
            scale: 'mini',
            quality: 72,
            metascore: 75,
            isMasterpiece: false,
            developSec: 60,
            initialRevenue: 5_000_000,
            salesPool: 12_000_000,
            initialSalesPool: 12_000_000,
            decayPerSec: 0.022,
            totalRevenue: 5_000_000,
            selling: true,
            fansGained: 60,
            ghostBeaten: false,
            launchAdUsed: false,
            pioneer: true,
            releasedAt: Date.now() - 60000,
            createdAt: Date.now() - 60000,
            breakdown: { charPower: 70, genreAffinity: 65, performance: 60, luck: 50 },
            selectedCategories: ['graphics', 'sound', 'gameplay'],
            developWeeks: 8,
          },
          {
            id: 'w2',
            title: '温泉ぬるぬる経営',
            genreId: 'simulation',
            themeId: 'onsen',
            scale: 'mini',
            quality: 55,
            metascore: 58,
            isMasterpiece: false,
            developSec: 60,
            initialRevenue: 2_500_000,
            salesPool: 3_000_000,
            initialSalesPool: 3_000_000,
            decayPerSec: 0.030,
            totalRevenue: 2_500_000,
            selling: true,
            fansGained: 20,
            ghostBeaten: false,
            launchAdUsed: false,
            pioneer: true,
            releasedAt: Date.now() - 120000,
            createdAt: Date.now() - 120000,
            breakdown: { charPower: 50, genreAffinity: 55, performance: 50, luck: 50 },
            selectedCategories: ['graphics', 'sound', 'gameplay'],
            developWeeks: 8,
          },
        ],
        trend: null,
        records: { bestMetascore: 75, bestRevenue: 17000000, bestCombo: 45, bestWPM: 90 },
        achievements: ['first-release'],
        tutorialDone: true,
        lastSeenAt: Date.now(),
        currentDate: { year: 2026, month: 2, week: 1 },
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

test('v11 office', async ({ page }) => {
  await seedAndGo(page);
  await page.screenshot({ path: 'test-results/v11-office.png', fullPage: false });
});

test('v11 plan', async ({ page }) => {
  await seedAndGo(page);
  await page.locator('text=計画').first().click({ force: true });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'test-results/v11-plan.png', fullPage: false });
});

test('v11 library', async ({ page }) => {
  await seedAndGo(page);
  await page.locator('text=作品').first().click({ force: true });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'test-results/v11-library.png', fullPage: false });
});

test('v11 collection', async ({ page }) => {
  await seedAndGo(page);
  await page.locator('text=図鑑').first().click({ force: true });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'test-results/v11-collection.png', fullPage: false });
});
