import { test } from '@playwright/test';

/**
 * v0.10 用：オフィス画面のスクリーンショットを取得する。
 *
 * v0.10 で：
 * - 初期画面が OfficeScreen（→「オフィスへ」ボタンは廃止）
 * - localStorage キーが `typing-factory:v5` で `version: 5` 必須
 * - 桁感が ×10,000（旧 ¥5,000 → 新 ¥5,000万 相当）
 */

test('オフィス画面スクリーンショット（v0.10、社員4人）', async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { __sfxMuted: boolean }).__sfxMuted = true;
    try {
      localStorage.clear();
      const seed = {
        version: 5,
        funds: 50_000_000,
        lifetimeRevenue: 0,
        fans: 0,
        employees: [
          {
            id: 'e1',
            name: '佐藤 太郎',
            role: 'programmer',
            power: 0.8,
            wage: 600_000,
            specialties: [],
          },
          {
            id: 'e2',
            name: '田中 花子',
            role: 'designer',
            power: 5,
            wage: 400_000,
            specialties: [],
          },
          {
            id: 'e3',
            name: '鈴木 ハル',
            role: 'pr',
            power: 12,
            wage: 750_000,
            specialties: [],
          },
          {
            id: 'e4',
            name: '山田 ソラ',
            role: 'programmer',
            power: 1.0,
            wage: 750_000,
            specialties: [],
          },
        ],
        unlockedScales: ['mini'],
        unlockedGenres: ['action', 'puzzle', 'rpg'],
        unlockedThemes: ['fantasy', 'sf', 'sushi', 'ninja', 'onsen'],
        unlockedCategories: ['graphics', 'sound', 'gameplay'],
        ghosts: { mini: null, mobile: null, indie: null, hit: null, aaa: null },
        library: [],
        trend: null,
        records: { bestMetascore: 0, bestRevenue: 0, bestCombo: 0, bestWPM: 0 },
        achievements: [],
        tutorialDone: true,
        lastSeenAt: Date.now(),
        currentDate: { year: 2026, month: 1, week: 1 },
        lastFixedCost: null,
        newlyAchieved: [],
        offlineReport: null,
        candidate: null,
      };
      localStorage.setItem('typing-factory:v5', JSON.stringify(seed));
    } catch {
      /* ignore */
    }
  });

  await page.goto('http://localhost:5173/');
  await page.waitForLoadState('networkidle');
  // チュートリアル overlay を消す
  await page.evaluate(() => {
    document.querySelectorAll('.tutorial-overlay').forEach((n) => n.remove());
  });
  await page.waitForTimeout(800);
  await page.screenshot({ path: '/tmp/office-v10-4ppl.png', fullPage: true });

  // OfficeView 部分のトリミング
  const officeBox = await page.locator('.office-view').boundingBox();
  if (officeBox) {
    await page.screenshot({
      path: '/tmp/office-v10-only.png',
      clip: {
        x: officeBox.x - 10,
        y: officeBox.y - 10,
        width: officeBox.width + 20,
        height: officeBox.height + 20,
      },
    });
  }
});
