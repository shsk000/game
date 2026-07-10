import { expect, type Page, test } from '@playwright/test';

/**
 * クリティカルジャーニー E2E（testing-rules §4）：
 *   オフィス → CTA → 企画（選択・アサイン）→ 開発開始 → 開発完了 → 発表 → オフィス帰還 → 販売
 *
 * 決定化：`?seed=42` で乱数を seed 固定（state/boot.ts が mulberry32 に配線）。
 * タイピング本体は Vitest 側（typingEngine.test / DevelopScreen.test）で検証済みのため、
 * 開発の進行は store アクションでショートカットし、動線の接続だけを検証する。
 */

const SEED = 42;

async function seedSession(page: Page) {
  await page.addInitScript(() => {
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
    } catch {}
  });
  await page.goto(`/?seed=${SEED}`);
  await page.waitForLoadState('networkidle');
}

// biome-ignore lint/suspicious/noExplicitAny: e2e 専用の覗き窓
const gs = (page: Page) => page.evaluate(() => (window as any).__gs?.());

test('ジャーニー: 企画 → 開発 → 発表 → 販売 の一本道が通る', async ({ page }) => {
  await seedSession(page);

  // 1) オフィス：CTA から企画へ
  const cta = page.locator('button', { hasText: '新しいゲームを作る' }).first();
  await expect(cta).toBeVisible();
  await cta.click({ force: true });
  await expect(page.locator('text=ジャンルを選ぶ').first()).toBeVisible();
  expect((await gs(page)).screen).toBe('plan');

  // 2) 企画：v0.17 から全員参加（アサイン操作なし）でそのまま開発開始
  const startBtn = page.locator('button', { hasText: '▶ 開発開始' }).first();
  await expect(startBtn).toBeEnabled();
  await startBtn.click({ force: true });
  await expect.poll(async () => (await gs(page)).screen).toBe('develop');

  // 3) 開発：進行は store でショートカット（タイピング検証は Vitest 側の責務）
  await page.evaluate(() => {
    // biome-ignore lint/suspicious/noExplicitAny: e2e 専用の覗き窓
    const s = (window as any).__gs();
    s.finishDevelopment();
  });
  await expect.poll(async () => (await gs(page)).screen).toBe('release');

  // 4) 発表：結果を発表 → メタスコア開封
  await page.locator('text=🎬 結果を発表').first().click({ force: true });
  await expect(page.locator('text=メタスコア').first()).toBeVisible({ timeout: 10_000 });
  const afterRelease = await gs(page);
  expect(afterRelease.library.length).toBe(1);
  expect(afterRelease.lastReleased.metascore).toBeGreaterThanOrEqual(0);
  expect(afterRelease.lastReleased.metascore).toBeLessThanOrEqual(100);

  // 5) v0.17：評価（STEP1）→ 売上（STEP2）→ オフィスへ戻る
  await page
    .locator('button', { hasText: '売上を見る' })
    .first()
    .click({ force: true, timeout: 10_000 });
  await page
    .locator('button', { hasText: '次へ（オフィス）' })
    .first()
    .click({ force: true, timeout: 10_000 });
  await expect.poll(async () => (await gs(page)).screen).toBe('office');

  // 6) 販売：売れ行きがあれば資金が初動から積み上がる（販売プールの精算が動く）
  const fundsAfterRelease = afterRelease.funds;
  if (afterRelease.library[0].selling) {
    await expect
      .poll(async () => (await gs(page)).funds, { timeout: 15_000 })
      .toBeGreaterThan(fundsAfterRelease);
  }
});
