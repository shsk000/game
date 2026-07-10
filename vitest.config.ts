import react from '@vitejs/plugin-react';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

/**
 * テスト3層戦略（docs/testing.md 参照）：
 *  - unit: 純粋ロジック（src/core・utils・data 等）を node 環境で単体テスト
 *  - ui:   画面単位のユースケーステストを Vitest Browser Mode（実 Chromium）で実行
 *  - e2e:  クリティカルジャーニーのみ Playwright（tests/、playwright.config.ts）
 */
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          environment: 'node',
          include: ['src/**/*.test.ts'],
        },
      },
      {
        plugins: [react()],
        test: {
          name: 'ui',
          include: ['src/**/*.test.tsx'],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            // ゲーム UI は固定 1280×720 前提（スクロール禁止）なので viewport を一致させる
            instances: [{ browser: 'chromium', viewport: { width: 1280, height: 720 } }],
          },
        },
      },
    ],
  },
});
