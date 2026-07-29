import { expect, type Page, test } from '@playwright/test';

const BASE = 'http://localhost:5173';

/**
 * リリース画面が 1280×720 に収まるかのガード。
 *
 * **これは見た目の粗ではなく進行不能バグ。** リリース画面は `overflow: hidden` なので
 * （スクロール禁止・`docs/CLAUDE.md` の UI 規約）、中身が縦にあふれると
 * 「💰 売上を見る ▶」がクリップされて**押せなくなり、そこから先に進めない**。
 *
 * 実際に起きた事故（オーナー報告 2026-07-29）：
 * メタ99 で神ゲー認定の枠（58px）が積み増しになり、ボタンが top 691 / bottom 730 ＝
 * ビューポート 720 の外へ出た。`.release-screen` は scrollHeight 690 / clientHeight 612。
 *
 * 神ゲーは一番背が高くなる組合せ（認定バッジ＋ゴースト更新＋実績＋昇格が全部乗る）なので、
 * ここを固定しておけば通常のリリースは自動的に収まる。
 */

async function openWithFreshSave(page: Page) {
  await page.addInitScript(() => {
    (window as unknown as { __sfxMuted: boolean }).__sfxMuted = true;
    try {
      localStorage.clear();
    } catch {
      /* ignore */
    }
  });
  await page.goto(BASE);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    document.querySelectorAll('.tutorial-overlay').forEach((n) => n.remove());
  });
}

/**
 * 神ゲー（メタ95+）が出るまでリリースを回す。
 * 特徴ポイントを全分野 100 に振り切っても評価家のブレ（±5）で 95 を割ることがあるので、
 * 出るまで引き直す（打鍵は本筋ではないのでストア操作で作る）。
 */
async function releaseMasterpiece(page: Page): Promise<number> {
  for (let attempt = 0; attempt < 40; attempt++) {
    const meta = await page.evaluate(() => {
      type Store = {
        screen: string;
        unlockedGenres: string[];
        unlockedThemes: string[];
        goTo: (s: string) => void;
        startProject: (g: string, t: string, scale: string) => void;
        advancePhase: () => void;
        addFeaturePoint: (f: string, n: number) => void;
        releaseWork: () => { metascore: number; isMasterpiece: boolean };
      };
      const gs = (window as unknown as { __gs: () => Store }).__gs;
      const s = gs();
      s.goTo('office');
      gs().startProject(gs().unlockedGenres[0], gs().unlockedThemes[0], 'mini');
      gs().advancePhase();
      for (const f of ['programming', 'graphics', 'sound', 'scenario']) {
        gs().addFeaturePoint(f, 200);
      }
      for (let i = 0; i < 4 && gs().screen === 'develop'; i++) gs().advancePhase();
      const w = gs().releaseWork();
      return w.isMasterpiece ? w.metascore : -1;
    });
    if (meta > 0) return meta;
  }
  throw new Error('神ゲーが40回引いても出なかった（メタスコアの分布が壊れている可能性）');
}

test('神ゲーのリリース画面が 1280×720 に収まり「売上を見る」が押せる', async ({ page }) => {
  await openWithFreshSave(page);
  const meta = await releaseMasterpiece(page);
  expect(meta).toBeGreaterThanOrEqual(95);

  // 開封演出（内訳→ボーナス→スコア）が終わるまで待つ
  const btn = page.locator('button', { hasText: '売上を見る' });
  await expect(btn).toBeVisible({ timeout: 15_000 });

  const box = await btn.boundingBox();
  expect(box, 'ボタンの座標が取れる').not.toBeNull();
  const viewport = page.viewportSize();
  expect(
    box!.y + box!.height,
    `「売上を見る」の下端 ${Math.round(box!.y + box!.height)}px が画面（${viewport!.height}px）の外に出ている`,
  ).toBeLessThanOrEqual(viewport!.height);

  // overflow:hidden でクリップされていないこと（あふれ＝押せない予備軍）
  const overflow = await page.evaluate(() => {
    const el = document.querySelector('.release-screen');
    return el ? el.scrollHeight - el.clientHeight : -1;
  });
  expect(overflow, `.release-screen が ${overflow}px あふれている`).toBeLessThanOrEqual(0);

  // クリックして実際に次へ進めることまで見る（座標が画面内でも overlay で塞がれていないか）
  await btn.click();
  await page.waitForTimeout(600);
  await expect(page.locator('text=利益計算').first(), '売上ステップに進めた').toBeVisible();

  // 売上ステップ（内訳＋利益計算＋次の一手）も同じ枠に収まっていること。
  // ここも overflow:hidden なので、あふれると次のボタンが押せなくなる
  const salesOverflow = await page.evaluate(() => {
    const el = document.querySelector('.release-screen');
    return el ? el.scrollHeight - el.clientHeight : -1;
  });
  expect(salesOverflow, `売上ステップで ${salesOverflow}px あふれている`).toBeLessThanOrEqual(0);

  const nextBtn = page.locator('button', { hasText: '新しいゲームを作る' }).first();
  await expect(nextBtn).toBeVisible();
  const nextBox = await nextBtn.boundingBox();
  expect(
    nextBox!.y + nextBox!.height,
    `「新しいゲームを作る」の下端 ${Math.round(nextBox!.y + nextBox!.height)}px が画面外`,
  ).toBeLessThanOrEqual(viewport!.height);
});
