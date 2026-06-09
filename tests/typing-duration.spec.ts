import { expect, test } from '@playwright/test';

/**
 * 検証：mini 1 本のタイピング時間（GlobalTicker による 7.5s/週 × 8週 = 60s）。
 * 計画 → 開発 → finishDevelopment まで何秒かかるか測る。
 */
test('mini の開発は ~60 秒で終わる', async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { __sfxMuted: boolean }).__sfxMuted = true;
    try {
      localStorage.clear();
      const persisted = {
        version: 5 as const,
        funds: 5_000_000,
        lifetimeRevenue: 0,
        fans: 0,
        employees: [
          { id: 'e1', name: 'P', role: 'programmer', power: 1.0, wage: 500_000, specialties: [] },
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
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.log('[browser-error]', msg.text());
  });
  page.on('pageerror', (err) => console.log('[page-error]', err.message));
  page.on('crash', () => console.log('[crash]'));
  await page.goto('http://localhost:5173');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    document.querySelectorAll('.tutorial-overlay').forEach((n) => n.remove());
  });

  // 計画画面へ
  await page.locator('text=計画').first().click({ force: true });
  await page.waitForTimeout(800);

  // 「開発開始」を押す（テキストでクリック）
  const startBtn = page
    .locator('button')
    .filter({ hasText: /開発(開始|スタート|を始める)/ })
    .first();
  await startBtn.scrollIntoViewIfNeeded();
  await startBtn.click({ force: true });

  // develop に遷移するのを待つ
  await page
    .waitForFunction(
      // @ts-ignore
      () => (window as any).__gs?.()?.screen === 'develop',
      { timeout: 5000 },
    )
    .catch(() => {});

  // 計測は develop 突入時刻からスタート（plan->develop の click 遅延を除外）
  const t0 = Date.now();
  console.log('[develop] entered develop');

  // 2 秒ごとに状況をスナップショット
  let checks = 0;
  let entered = false;
  while (!entered && checks < 60) {
    await page.waitForTimeout(2000);
    checks++;
    const snap = await page.evaluate(() => {
      // @ts-ignore
      const s = (window as any).__gs?.();
      if (!s) return null;
      return {
        screen: s.screen,
        currentDate: s.currentDate,
        doneLoC: s.current?.doneLoC ?? null,
        requiredLoC: s.current?.requiredLoC ?? null,
      };
    });
    console.log(`[t+${(2 * checks).toFixed(0)}s]`, JSON.stringify(snap));
    if (snap?.screen === 'release') entered = true;
  }
  const t1 = Date.now();
  const elapsedSec = (t1 - t0) / 1000;
  console.log(`[develop] elapsed sec: ${elapsedSec.toFixed(1)}`);
  expect(entered).toBe(true);
});
