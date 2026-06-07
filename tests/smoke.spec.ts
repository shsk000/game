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

/**
 * 企画画面で「3カテゴリ」と「1社員」を選ぶ。
 * - カテゴリチップは data-category-id を持つボタン。ロック解除済みのものを最大3つ選択。
 * - 社員チェックボックスはラベルに社員名を含む。最低1人にチェック。
 */
async function pickPlanInputs(page: Page) {
  // カテゴリ：解除済みチップから先頭3つ
  const chips = page.locator('[data-category-id]:not([disabled])');
  const count = await chips.count();
  const toPick = Math.min(3, count);
  for (let i = 0; i < toPick; i++) {
    await chips.nth(i).click();
  }
  // 社員：1人目のチェックボックス
  const empBox = page.locator('input[type="checkbox"][data-employee-id]').first();
  if ((await empBox.count()) > 0) {
    await empBox.check();
  }
}

/**
 * 企画→開発に進む前提となる「社員1名以上」を保証する。
 * オフィスに移動して採用→企画に戻る。
 */
async function ensureOneEmployee(page: Page) {
  // 企画画面前提
  await page.getByRole('button', { name: 'オフィスへ' }).click();
  await expect(page.locator('h1')).toContainText('オフィス');
  const hireBtn = page.getByRole('button', { name: /^採用 ¥/ });
  if ((await hireBtn.count()) > 0) {
    await hireBtn.first().click();
  }
  // 企画に戻る
  const backBtn = page.getByRole('button', { name: /新規開発|企画|戻る/ });
  if ((await backBtn.count()) > 0) {
    await backBtn.first().click();
  } else {
    // フォールバック：ストアから goTo('plan')
    await page.evaluate(() => {
      const w = window as unknown as {
        __store?: { getState?: () => { goTo?: (s: string) => void } };
      };
      w.__store?.getState?.()?.goTo?.('plan');
    });
  }
  await expect(page.locator('h1')).toContainText('企画会議');
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

test('企画→開発→リリースのコアループが回る', async ({ page }) => {
  await resetAndOpen(page);
  await ensureOneEmployee(page);
  await pickPlanInputs(page);
  await page.getByRole('button', { name: '▶ 開発開始' }).click();
  await expect(page.locator('h1')).toContainText('開発中');
  await expect(page.locator('.combo-gauge')).toBeVisible();

  const reachedRelease = await typeUntil(page, 'h1:has-text("リリース")');
  expect(reachedRelease).toBe(true);
  await expect(page.locator('h1')).toContainText('リリース');
  // pre-ads ステージから「結果を発表」で演出を開始
  await page.getByRole('button', { name: /結果を発表/ }).click();
  await expect(page.locator('.meta-value')).toBeVisible();
  await expect(page.getByRole('button', { name: /ローンチ広告.*\+50%/ })).toBeVisible({
    timeout: 8000,
  });
  await page.getByRole('button', { name: /ローンチ広告.*\+50%/ }).click();
  await expect(page.getByText(/ローンチ広告キャンペーン適用済/)).toBeVisible({ timeout: 4000 });

  await page.getByRole('button', { name: '次へ（オフィス）' }).click();
  await expect(page.locator('h1')).toContainText('オフィス');
  await expect(page.getByText(/累計売上:/)).toBeVisible();
});

test('図鑑画面がリリース後に発見済み1マスを表示する', async ({ page }) => {
  await resetAndOpen(page);
  await ensureOneEmployee(page);
  await pickPlanInputs(page);
  await page.getByRole('button', { name: '▶ 開発開始' }).click();
  const reached = await typeUntil(page, 'h1:has-text("リリース")');
  expect(reached).toBe(true);
  await expect(page.locator('h1')).toContainText('リリース');
  await page.getByRole('button', { name: /結果を発表/ }).click();
  await page.getByRole('button', { name: '次へ（オフィス）' }).click();
  await page.getByRole('button', { name: '図鑑' }).click();
  await expect(page.locator('h1')).toContainText('ジャンル相性図鑑');
  await expect(page.locator('.ct-known').first()).toBeVisible();
});

test('セーブが永続化されてリロードでも累計が残る', async ({ page }) => {
  await resetAndOpen(page);
  await ensureOneEmployee(page);
  await pickPlanInputs(page);
  await page.getByRole('button', { name: '▶ 開発開始' }).click();
  const reached = await typeUntil(page, 'h1:has-text("リリース")');
  expect(reached).toBe(true);
  await page.getByRole('button', { name: /結果を発表/ }).click();
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

test('カテゴリ3つ＋社員1人選んで開発開始', async ({ page }) => {
  await resetAndOpen(page);
  await ensureOneEmployee(page);

  // 開発開始ボタンは最初は無効
  const startBtn = page.getByRole('button', { name: '▶ 開発開始' });
  await expect(startBtn).toBeDisabled();

  // カテゴリを3つ選ぶ
  const chips = page.locator('[data-category-id]:not([disabled])');
  const total = await chips.count();
  const toPick = Math.min(3, total);
  for (let i = 0; i < toPick; i++) {
    await chips.nth(i).click();
  }
  // この時点でも社員未選択なので無効のはず
  await expect(startBtn).toBeDisabled();

  // 社員を1人選ぶ
  const empBox = page.locator('input[type="checkbox"][data-employee-id]').first();
  await empBox.check();

  // 3カテゴリ＋1社員でボタンが有効化
  await expect(startBtn).toBeEnabled();
  await startBtn.click();
  await expect(page.locator('h1')).toContainText('開発中');
});

test('2件連続でリリースできる（回帰：lastReleasedの取り違い）', async ({ page }) => {
  await resetAndOpen(page);
  await ensureOneEmployee(page);

  // 1作目
  await pickPlanInputs(page);
  await page.getByRole('button', { name: '▶ 開発開始' }).click();
  await expect(page.locator('h1')).toContainText('開発中');
  expect(await typeUntil(page, 'h1:has-text("リリース")')).toBe(true);
  await page.getByRole('button', { name: /結果を発表/ }).click();
  await expect(page.locator('.meta-value')).toBeVisible();
  await page.getByRole('button', { name: '次へ（オフィス）' }).click();
  await expect(page.locator('h1')).toContainText('オフィス');

  // 2作目
  await page.getByRole('button', { name: '▶ 新規開発へ' }).click();
  await expect(page.locator('h1')).toContainText('企画会議');
  await pickPlanInputs(page);
  await page.getByRole('button', { name: '▶ 開発開始' }).click();
  await expect(page.locator('h1')).toContainText('開発中');
  expect(await typeUntil(page, 'h1:has-text("リリース")')).toBe(true);

  // pre-ads ステージで「結果を発表」が表示されていることを確認（=2件目のreveal演出が前作のworkで誤発火していない）
  const revealBtn = page.getByRole('button', { name: /結果を発表/ });
  await expect(revealBtn).toBeVisible({ timeout: 3000 });
  await revealBtn.click();
  await expect(page.locator('.meta-value')).toBeVisible();
  await page.getByRole('button', { name: '次へ（オフィス）' }).click();

  // ライブラリに2本入っているか確認
  await page.getByRole('button', { name: 'ライブラリ' }).click();
  const cards = page.locator('.library-card');
  await expect(cards).toHaveCount(2);
});
