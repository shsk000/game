import { test } from '@playwright/test';

/**
 * v0.10 P0 検証用：4 画面のスクリーンショットを取得する。
 * tutorial を skip し、社員 1 名を seed して、計画→開発→リリースを進める。
 */
const seedV10Save = () => {
  (window as unknown as { __sfxMuted: boolean }).__sfxMuted = true;
  try {
    localStorage.clear();
    const persisted = {
      version: 5 as const,
      funds: 15_000_000,
      lifetimeRevenue: 250_000_000,
      fans: 1200,
      employees: [
        {
          id: 'e1',
          name: '佐藤 太郎',
          role: 'programmer',
          power: 1.6,
          wage: 600,
          specialties: [],
        },
        {
          id: 'e2',
          name: '田中 花子',
          role: 'designer',
          power: 6,
          wage: 400,
          specialties: [],
        },
      ],
      unlockedScales: ['mini', 'mobile'],
      unlockedGenres: ['action', 'puzzle', 'rpg'],
      unlockedThemes: ['fantasy', 'sf', 'sushi', 'ninja', 'onsen'],
      unlockedCategories: ['graphics', 'sound', 'gameplay'],
      ghosts: { mini: null, mobile: null, indie: null, hit: null, aaa: null },
      library: [
        {
          id: 'w1',
          title: 'パイロット作',
          genreId: 'action',
          themeId: 'fantasy',
          scale: 'mini',
          quality: 60,
          metascore: 72,
          isMasterpiece: false,
          developSec: 60,
          initialRevenue: 1_500_000,
          salesPool: 500_000,
          initialSalesPool: 1_000_000,
          decayPerSec: 0.05,
          totalRevenue: 2_000_000,
          selling: true,
          fansGained: 800,
          ghostBeaten: false,
          launchAdUsed: false,
          pioneer: false,
          releasedAt: Date.now() - 10000,
          createdAt: Date.now() - 20000,
          breakdown: { base: 30, categories: 18, employees: 12, performance: 6, ads: 0, variance: 0 },
          selectedCategories: ['graphics', 'sound', 'gameplay'],
        },
      ],
      trend: null,
      records: { bestMetascore: 72, bestRevenue: 2_000_000, bestCombo: 35, bestWPM: 80 },
      achievements: ['first-release'],
      tutorialDone: true,
      lastSeenAt: Date.now(),
      currentDate: { year: 2026, month: 1, week: 1 },
    };
    localStorage.setItem('typing-factory:v5', JSON.stringify(persisted));
  } catch {}
};

test('v10 office snapshot', async ({ page }) => {
  await page.addInitScript(seedV10Save);
  await page.goto('http://localhost:5173/');
  await page.waitForTimeout(1500);
  await page.screenshot({
    path: '/home/shsk/git/game/test-results/v10-office.png',
    fullPage: true,
  });
});

test('v10 plan snapshot', async ({ page }) => {
  await page.addInitScript(seedV10Save);
  await page.goto('http://localhost:5173/');
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: /^計画/ }).first().click();
  await page.waitForTimeout(800);
  // assign one employee + select 3 categories so estimate fully populates
  const empCheckboxes = page.locator('input[type="checkbox"][data-employee-id]');
  const empCount = await empCheckboxes.count();
  for (let i = 0; i < Math.min(empCount, 2); i++) {
    try {
      await empCheckboxes.nth(i).check({ force: true });
    } catch {}
  }
  await page.waitForTimeout(400);
  await page.screenshot({
    path: '/home/shsk/git/game/test-results/v10-plan.png',
    fullPage: true,
  });
});

const setupForDev = async (page: import('@playwright/test').Page) => {
  await page.getByRole('button', { name: /^計画/ }).first().click();
  await page.waitForTimeout(600);
  // assign employees so dev can start
  const empCheckboxes = page.locator('input[type="checkbox"][data-employee-id]');
  const empCount = await empCheckboxes.count();
  for (let i = 0; i < Math.min(empCount, 2); i++) {
    try {
      await empCheckboxes.nth(i).check({ force: true });
    } catch {}
  }
  // select 3 categories
  const catButtons = page.locator('button[data-category-id]');
  const catCount = await catButtons.count();
  for (let i = 0; i < Math.min(catCount, 3); i++) {
    try {
      await catButtons.nth(i).click({ force: true });
    } catch {}
  }
  await page.waitForTimeout(300);
};

test('v10 develop snapshot', async ({ page }) => {
  await page.addInitScript(seedV10Save);
  await page.goto('http://localhost:5173/');
  await page.waitForTimeout(800);
  await setupForDev(page);
  // press 開発開始
  const startBtn = page.getByRole('button', { name: /開発開始/ });
  if ((await startBtn.count()) > 0) {
    await startBtn.first().click({ force: true });
  }
  await page.waitForTimeout(3000);
  await page.screenshot({
    path: '/home/shsk/git/game/test-results/v10-develop.png',
    fullPage: true,
  });
});

test('v10 release snapshot', async ({ page }) => {
  test.setTimeout(180_000);
  await page.addInitScript(seedV10Save);
  await page.goto('http://localhost:5173/');
  await page.waitForTimeout(800);
  await setupForDev(page);
  const startBtn = page.getByRole('button', { name: /開発開始/ });
  if ((await startBtn.count()) > 0) {
    await startBtn.first().click({ force: true });
  }
  // type rapidly to finish dev session (mini=8LoC equivalent / shorter target)
  await page.waitForTimeout(800);
  // bash all alpha keys; the typing engine should accept whatever is required
  const phrases = 'const value = 42; function add(a, b) { return a + b; } if (value > 0) { console.log("ok"); } '.repeat(40);
  for (const ch of phrases) {
    await page.keyboard.type(ch, { delay: 2 });
    if (Math.random() < 0.01) {
      // check if release screen appeared via h1 containing リリース or 売上
      const h1Text = await page.locator('h1').first().textContent().catch(() => '');
      if (h1Text && /リリース|売上|完成/.test(h1Text)) break;
    }
  }
  await page.waitForTimeout(2000);
  // Pre-release ad boost screen → click 結果を発表 to reveal breakdown/ROI
  const revealBtn = page.getByRole('button', { name: /結果を発表/ });
  if ((await revealBtn.count()) > 0) {
    await revealBtn.first().click({ force: true });
    await page.waitForTimeout(8000); // wait for full metascore countup + reveal
  }
  await page.screenshot({
    path: '/home/shsk/git/game/test-results/v10-release.png',
    fullPage: true,
  });
});
