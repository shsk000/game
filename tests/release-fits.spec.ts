import { expect, type Page, test } from '@playwright/test';

const BASE = 'http://localhost:5173';

/**
 * **リリース画面から必ず次へ進めることのガード。**
 *
 * この画面は内容量が**プレイの結果で変わる**：売上の計算は補正が乗るほど行が増え
 * （広報・ファン・初組合せ・トレンド・マーケ広告・話題性で最大6行）、
 * 打ち上げの評価も最大5件、実績と昇格のバッジも出たり出なかったりする。
 *
 * 以前は `overflow: hidden` だったため、あふれた瞬間にボタンがクリップされて
 * **そこから先に進めなくなっていた**（オーナー報告 2026-07-29。実測でメタ99の神ゲーで
 * ボタンが top 691 ＝ ビューポート 720 の外。その後、売上ステップでも 36px あふれた）。
 *
 * オーナー判断でこの画面だけスクロールを許した。よってここで守るのは
 * **「収まっているか」ではなく「押せるか」**。縦にあふれてもスクロールで到達できればよい。
 * 横方向のあふれだけは許さない（横スクロールは操作を壊す）。
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

test('神ゲーのリリース画面から最後まで進める', async ({ page }) => {
  await openWithFreshSave(page);
  const meta = await releaseMasterpiece(page);
  expect(meta).toBeGreaterThanOrEqual(95);

  // 開封演出（内訳→ボーナス→スコア）が終わるまで待つ
  const btn = page.locator('button', { hasText: '売上を見る' });
  await expect(btn).toBeVisible({ timeout: 15_000 });

  // 縦にあふれてもよい（スクロールで届く）。**横**にあふれるのは許さない
  const horizontal = await page.evaluate(() => {
    const el = document.querySelector('.release-screen');
    return el ? el.scrollWidth - el.clientWidth : -1;
  });
  expect(horizontal, `.release-screen が横に ${horizontal}px あふれている`).toBeLessThanOrEqual(0);

  // 実際に押して次へ進めること（Playwright は必要ならスクロールしてから押す＝実プレイと同じ）
  await btn.click();
  await page.waitForTimeout(600);
  await expect(page.locator('text=利益計算').first(), '売上ステップに進めた').toBeVisible();

  // 売上ステップ（内訳＋利益計算＋打ち上げ＋次の一手）からオフィスへ抜けられること。
  // **ここが押せないと詰む**ので、あふれの有無ではなく到達できるかを見る
  const nextBtn = page.locator('button', { hasText: '次へ（オフィス）' }).first();
  await expect(nextBtn).toBeVisible();
  await nextBtn.click();
  await page.waitForTimeout(700);
  const screen = await page.evaluate(
    () => (window as unknown as { __gs: () => { screen: string } }).__gs().screen,
  );
  expect(screen, 'リリース画面から先に進めた').toBe('office');
});

test('売上の補正が全部乗ってもリリース画面から抜けられる', async ({ page }) => {
  // 補正が乗るほど「売上の計算」の行が増える。実測で 36px あふれた構成
  // （AAA・神ゲー・広報・ファン25万・初組合せ・トレンド合致・マーケ広告・話題性・長いタイトル）
  await openWithFreshSave(page);
  await page.evaluate(() => {
    type Emp = Record<string, unknown>;
    const mk = (id: string, name: string, f: string, g: number): Emp => ({
      id, name, role: 'designer', power: 0.5, basePower: 0.5, level: 1, exp: 0,
      wage: 600000, specialties: [], rank: 'S', skills: { [f]: g },
    });
    const raw = localStorage.getItem('typing-factory:v7');
    const base = raw ? JSON.parse(raw) : {};
    localStorage.setItem('typing-factory:v7', JSON.stringify({
      ...base, version: 7, funds: 50_000_000_000, screen: 'office', fans: 250_000,
      unlockedScales: ['mini', 'mobile', 'indie', 'hit', 'aaa'],
      trend: { genreId: 'puzzle', themeId: 'sushi', expiresAt: 9_999_999_999_999 },
      employees: [
        mk('a', '組 太郎', 'programming', 60), mk('b', '絵 花子', 'graphics', 60),
        mk('c', '音 次郎', 'sound', 60), mk('d', '物 三郎', 'scenario', 60),
        mk('e', '広 四郎', 'pr', 80),
      ],
    }));
  });
  await page.reload();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1200);
  await page.evaluate(() => {
    type Store = {
      screen: string;
      goTo: (s: string) => void;
      startProject: (g: string, t: string, sc: string, title?: string) => void;
      advancePhase: () => void;
      addFeaturePoint: (f: string, n: number) => void;
      applyAxisDelta: (d: Record<string, number>) => void;
      releaseWork: (o?: { marketingAd?: boolean }) => unknown;
    };
    const gs = (window as unknown as { __gs: () => Store }).__gs;
    gs().goTo('office');
    gs().startProject('puzzle', 'sushi', 'aaa', 'とてつもなく長いタイトルをつけた場合に何が起きるかを確かめるための検証用の作品名 完全版 リマスター');
    gs().advancePhase();
    for (const f of ['programming', 'graphics', 'sound', 'scenario']) gs().addFeaturePoint(f, 200);
    gs().applyAxisDelta({ buzz: 60, trust: 20 });
    for (let k = 0; k < 4 && gs().screen === 'develop'; k++) gs().advancePhase();
    gs().releaseWork({ marketingAd: true });
  });

  const salesBtn = page.locator('button', { hasText: '売上を見る' });
  await expect(salesBtn).toBeVisible({ timeout: 15_000 });
  await salesBtn.click();
  await page.waitForTimeout(700);

  const nextBtn = page.locator('button', { hasText: '次へ（オフィス）' }).first();
  await expect(nextBtn).toBeVisible();
  await nextBtn.click();
  await page.waitForTimeout(700);
  const screen = await page.evaluate(
    () => (window as unknown as { __gs: () => { screen: string } }).__gs().screen,
  );
  expect(screen, '補正が全部乗った状態でも抜けられる').toBe('office');
});
