import { defineConfig, devices } from '@playwright/test';

/**
 * E2E はクリティカルジャーニーのみ（testing-rules §4）。
 * 開発時代の使い捨て検証 spec は tests/archive/（testDir 対象外）。
 * 決定化：spec 側で `?seed=NN` を使うと乱数が seed 固定になる（state/boot.ts）。
 */
export default defineConfig({
  testDir: './tests',
  testIgnore: '**/archive/**',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
    viewport: { width: 1280, height: 720 },
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], channel: undefined } }],
});
