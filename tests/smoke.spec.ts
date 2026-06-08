import { expect, type Page, test } from '@playwright/test';

const BASE = 'http://localhost:5173';

/**
 * v0.10 用スモークテスト：オフィス画面トップ + ピクセル UI 構造を確認する。
 *
 * 旧 v0.9 の「企画会議トップ」「オフィスへボタン」前提の E2E はオフィス画面化と
 * ピクセル UI 全面採用で大きく崩れたため、v0.10 では以下の最小確認に絞る：
 * - 起動時の初期画面がオフィスである
 * - PixelMenuBar の 7 項目（計画/採用/規模/作品/図鑑/実績/設定）が並ぶ
 * - 計画リンクで企画会議に遷移できる
 * - 図鑑リンクでジャンル相性図鑑に遷移できる
 *
 * リリースまでの通しシナリオ・採用フロー・データ永続性は v0.10 P0 完了時点の
 * v10-screens.spec.ts に移し、ここでは静的セレクタの存在確認のみに留める。
 */

async function dismissTutorial(page: Page) {
  // チュートリアル overlay があれば DOM から消す（クリックを邪魔するため）
  await page.evaluate(() => {
    document.querySelectorAll('.tutorial-overlay').forEach((n) => n.remove());
  });
}

async function resetAndOpen(page: Page) {
  await page.addInitScript(() => {
    (window as unknown as { __sfxMuted: boolean }).__sfxMuted = true;
    try {
      if (!sessionStorage.getItem('__cleared')) {
        localStorage.clear();
        sessionStorage.setItem('__cleared', '1');
      }
    } catch {
      /* ignore */
    }
  });
  await page.goto(BASE);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(800);
  await dismissTutorial(page);
}

test('起動時の初期画面はオフィス（ヘッダー「オフィス」を確認）', async ({ page }) => {
  await resetAndOpen(page);
  // PixelWindow タイトル「オフィス」を含む要素が存在する
  await expect(page.locator('text=オフィス').first()).toBeVisible();
});

test('PixelMenuBar に 7 項目が並ぶ', async ({ page }) => {
  await resetAndOpen(page);
  for (const label of ['計画', '採用', '規模', '作品', '図鑑', '実績', '設定']) {
    await expect(page.locator(`text=${label}`).first()).toBeVisible();
  }
});

test('「計画」クリックで企画会議画面に遷移', async ({ page }) => {
  await resetAndOpen(page);
  await page.locator('text=計画').first().click({ force: true });
  await page.waitForTimeout(800);
  await expect(page.locator('text=企画会議').first()).toBeVisible();
});

test('「図鑑」クリックでジャンル相性図鑑に遷移', async ({ page }) => {
  await resetAndOpen(page);
  await page.locator('text=図鑑').first().click({ force: true });
  await page.waitForTimeout(800);
  await expect(page.locator('text=ジャンル相性図鑑').first()).toBeVisible();
});

test('PixelStatusBar に資金・ファン・従業員・作品が表示される', async ({ page }) => {
  await resetAndOpen(page);
  for (const label of ['資金', 'ファン', '従業員', '作品']) {
    await expect(page.locator(`text=${label}`).first()).toBeVisible();
  }
});

// v0.10 のコアループ通しテストは tests/v10-screens.spec.ts に分離。
// 旧 typeUntil / pickPlanInputs / ensureOneEmployee 等のヘルパは
// PixelButton + PixelModal 構造に合わなくなったため、ここでは保持しない。
