import { expect, type Page, test } from '@playwright/test';

const BASE = 'http://localhost:5173';

/**
 * 次の打鍵を `.typing-remained` から読んで1文字ずつ送る。
 * NanoType-JP は keypress イベントで判定するため、表示中の先頭1文字を
 * 順に押下していけば必ず進む（ローマ字の複数許容は最初に提示されたパターンに従えばよい）。
 */
async function typeUntil(page: Page, doneLocator: string, maxKeys = 1500): Promise<boolean> {
  for (let i = 0; i < maxKeys; i++) {
    const done = await page.locator(doneLocator).count();
    if (done > 0) return true;
    const remained = await page.locator('.typing-remained').textContent();
    if (!remained || remained.length === 0) {
      // 一瞬の遷移待ち
      await page.waitForTimeout(50);
      continue;
    }
    const ch = remained[0];
    if (!/^[a-zA-Z0-9\-,. ?!]$/.test(ch)) {
      // 想定外の制御文字。スキップ
      break;
    }
    await page.keyboard.press(ch);
  }
  const done = await page.locator(doneLocator).count();
  return done > 0;
}

async function resetAndOpen(page: Page) {
  // localStorage を初回のみクリア（リロードでは保持）
  await page.addInitScript(() => {
    (window as unknown as { __sfxMuted: boolean }).__sfxMuted = true;
    try {
      if (!sessionStorage.getItem('__cleared')) {
        localStorage.clear();
        sessionStorage.setItem('__cleared', '1');
      }
    } catch {}
  });
  await page.goto(BASE);
  await dismissTutorial(page);
}

async function dismissTutorial(page: Page) {
  const skip = page.getByRole('button', { name: /スキップ|始める/ });
  if ((await skip.count()) > 0) {
    await skip.first().click({ trial: false });
  }
}

test('localStorageリセット → トップが企画画面で表示される', async ({ page }) => {
  await resetAndOpen(page);
  await expect(page.locator('h1')).toContainText('企画会議');
  await expect(page.getByRole('heading', { name: /今月のトレンド/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: /ジャンルを選ぶ/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: /テーマを選ぶ/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: /規模を選ぶ/ })).toBeVisible();
});

test('ジャンル12種・テーマ15種・規模5種が画面に存在', async ({ page }) => {
  await resetAndOpen(page);
  const expectedGenres = [
    'アクション',
    'パズル',
    'RPG',
    'シューティング',
    'アドベンチャー',
    'シミュレーション',
    'レース',
    'ホラー',
    '格闘',
    'ローグライク',
    'リズム',
    'サンドボックス',
  ];
  for (const name of expectedGenres) {
    await expect(page.getByRole('button', { name: new RegExp(name) })).toBeVisible();
  }
  const expectedThemes = [
    'ファンタジー',
    'SF',
    '寿司',
    '忍者',
    '温泉',
    '中世',
    '現代',
    '農業',
    '動物',
    '戦争',
    '会社員',
    'コンビニ',
    'ゾンビ',
    '海賊',
    '宇宙人',
  ];
  for (const name of expectedThemes) {
    await expect(page.getByRole('button', { name: new RegExp(name) })).toBeVisible();
  }
  for (const name of ['ミニゲーム', 'スマホゲーム', 'インディー大作', '話題作', 'AAAタイトル']) {
    await expect(page.getByRole('button', { name: new RegExp(name) })).toBeVisible();
  }
});

test('企画→開発→ポリッシュ→リリースのコアループが回る', async ({ page }) => {
  await resetAndOpen(page);
  await page.getByRole('button', { name: '▶ 開発開始' }).click();
  await expect(page.locator('h1')).toContainText('開発中');
  await expect(page.locator('.combo-gauge')).toBeVisible();

  const reachedPolish = await typeUntil(page, 'h1:has-text("ポリッシュ中")');
  expect(reachedPolish).toBe(true);
  await expect(page.getByText(/開発タイム/)).toBeVisible();

  await page.getByRole('button', { name: '🚀 リリースする' }).click();
  await expect(page.locator('h1')).toContainText('リリース');
  await expect(page.locator('.meta-value')).toBeVisible();
  await expect(page.getByRole('button', { name: /広告を見て売上.*\+50%/ })).toBeVisible({
    timeout: 6000,
  });
  await page.getByRole('button', { name: /広告を見て売上.*\+50%/ }).click();
  await expect(page.getByText('ローンチ広告キャンペーン適用済')).toBeVisible({ timeout: 4000 });

  await page.getByRole('button', { name: '次へ（オフィス）' }).click();
  await expect(page.locator('h1')).toContainText('オフィス');
  await expect(page.getByText(/累計売上:/)).toBeVisible();
});

test('図鑑画面がリリース後に発見済み1マスを表示する', async ({ page }) => {
  await resetAndOpen(page);
  await page.getByRole('button', { name: '▶ 開発開始' }).click();
  const reached = await typeUntil(page, 'h1:has-text("ポリッシュ中")');
  expect(reached).toBe(true);
  await page.getByRole('button', { name: '🚀 リリースする' }).click();
  await expect(page.locator('h1')).toContainText('リリース');
  await page.getByRole('button', { name: '次へ（オフィス）' }).click();
  await page.getByRole('button', { name: '図鑑' }).click();
  await expect(page.locator('h1')).toContainText('ジャンル相性図鑑');
  await expect(page.locator('.ct-known').first()).toBeVisible();
});

test('セーブが永続化されてリロードでも累計が残る', async ({ page }) => {
  await resetAndOpen(page);
  await page.getByRole('button', { name: '▶ 開発開始' }).click();
  const reached = await typeUntil(page, 'h1:has-text("ポリッシュ中")');
  expect(reached).toBe(true);
  await page.getByRole('button', { name: '🚀 リリースする' }).click();
  await page.getByRole('button', { name: '次へ（オフィス）' }).click();
  const beforeText = await page.getByText(/累計売上:/).textContent();
  expect(beforeText).toBeTruthy();
  await page.reload();
  await dismissTutorial(page);
  await expect(page.locator('h1')).toContainText('企画会議');
  await page.getByRole('button', { name: 'オフィスへ' }).click();
  const afterText = await page.getByText(/累計売上:/).textContent();
  expect(afterText).toBe(beforeText);
});

test('採用候補が表示されオフィスで雇用できる', async ({ page }) => {
  await resetAndOpen(page);
  await page.getByRole('button', { name: 'オフィスへ' }).click();
  await expect(page.locator('h1')).toContainText('オフィス');
  await expect(page.getByRole('heading', { name: '採用' })).toBeVisible();
  // Candidate card present
  await expect(page.locator('.candidate-card')).toBeVisible();
});
