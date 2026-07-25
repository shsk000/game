import { defineConfig, devices } from '@playwright/test';

/**
 * E2E はクリティカルジャーニーのみ（testing-rules §4）。
 * 開発時代の使い捨て検証 spec は tests/archive/（testDir 対象外）。
 * 決定化：spec 側で `?seed=NN` を使うと乱数が seed 固定になる（state/boot.ts）。
 *
 * ポート：`GAME_PORT` で切り替える（既定 5173＝メイン作業ツリー）。
 * worktree で作業するときは worktree 専用ポートを必ず指定すること（`GAME_PORT=5180 npm run test:e2e`）。
 * 指定しないと、別ツリーで動いている 5173 のサーバーを `reuseExistingServer` が掴み、
 * 変更が入っていないのに緑になる（偽グリーン）。`--strictPort` で取り違えを黙って通さない。
 */
const PORT = Number(process.env.GAME_PORT ?? 5173);
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './tests',
  testIgnore: '**/archive/**',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30_000,
  use: {
    baseURL: BASE_URL,
    headless: true,
    viewport: { width: 1280, height: 720 },
  },
  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], channel: undefined } }],
});
