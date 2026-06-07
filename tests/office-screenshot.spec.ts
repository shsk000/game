import { test } from '@playwright/test';

test('オフィス画面スクリーンショット（4人）', async ({ page }) => {
  // localStorage に4人ぶんの社員データを直接シード
  await page.addInitScript(() => {
    (window as unknown as { __sfxMuted: boolean }).__sfxMuted = true;
    try {
      localStorage.clear();
      const seed = {
        version: 4,
        funds: 5000,
        lifetimeRevenue: 0,
        fans: 0,
        employees: [
          { id: 'e1', name: '佐藤 太郎', role: 'programmer', power: 0.8, wage: 600, specialties: [] },
          { id: 'e2', name: '田中 花子', role: 'designer', power: 5, wage: 400, specialties: [] },
          { id: 'e3', name: '鈴木 ハル', role: 'pr', power: 12, wage: 750, specialties: [] },
          { id: 'e4', name: '山田 ソラ', role: 'programmer', power: 1.0, wage: 750, specialties: [] },
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
      };
      localStorage.setItem('typing-factory:v4', JSON.stringify(seed));
    } catch {}
  });
  await page.goto('http://localhost:5173/');
  await page.getByRole('button', { name: 'オフィスへ' }).click();
  await page.waitForTimeout(800); // animation 開始まで待つ
  await page.screenshot({ path: '/tmp/office-4ppl.png', fullPage: true });
  // 画面の office-view 部分だけのトリミングも撮る
  const officeBox = await page.locator('.office-view').boundingBox();
  if (officeBox) {
    await page.screenshot({
      path: '/tmp/office-only.png',
      clip: {
        x: officeBox.x - 10,
        y: officeBox.y - 10,
        width: officeBox.width + 20,
        height: officeBox.height + 20,
      },
    });
  }
});
