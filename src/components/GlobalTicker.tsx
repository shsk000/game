import { useEffect } from 'react';
import { useGameStore } from '../state/gameStore';

/**
 * アプリ全体で時間進行・販売・バグイベントを駆動するグローバルタイマー。
 *
 * v0.10 仕上げ T-1：旧 DevelopScreen 内 setInterval から移行。
 * バグ修正 B-Crit-1/2/3（balance-design.md §0.0）を解消する：
 * - 販売中作品の売上（tickSales）が誰からも呼ばれなかった → 全画面 1 秒ごとに発火
 * - 開発中以外は時間が止まっていた → 全画面で常時進行
 * - アイドル中の時間進行速度を 30 秒/週に（タイピング中は 7.5 秒/週）
 *
 * 実装方針：
 *  - useEffect は **1 回だけ実行** し、interval を 250ms の高頻度ループにする
 *  - 内部で `useGameStore.getState()` を都度呼んで最新の screen / gameOver を見る
 *  - これにより screen 変化のたびに setInterval を張り直すことが無くなり、
 *    タイマー張り直しのタイミング揺れで開発時間が想定の 60 秒からブレる問題を解消
 */
const TICK_BASE_MS = 250; // 250ms 単位で集計（GC オーバーヘッド最小・精度十分）
const SALES_INTERVAL_MS = 1000;
const DEVELOP_WEEK_MS = 7500;
const IDLE_WEEK_MS = 30_000;
const AUTO_LOC_INTERVAL_MS = 1000;
const BUG_TRY_INTERVAL_MS = 10_000;

export const GlobalTicker = () => {
  useEffect(() => {
    let lastSalesAt = performance.now();
    let lastWeekAt = performance.now();
    let lastAutoAt = performance.now();
    let lastBugAt = performance.now();

    const t = setInterval(() => {
      const s = useGameStore.getState();
      if (s.gameOver) return;
      const now = performance.now();

      // 1) 販売 tick：1 秒ごと（全画面）
      if (now - lastSalesAt >= SALES_INTERVAL_MS) {
        s.tickSales(1);
        lastSalesAt = now;
      }

      // 2) 時間進行 tick：開発中 7.5s/週、アイドル中 30s/週
      const weekIntervalMs = s.screen === 'develop' ? DEVELOP_WEEK_MS : IDLE_WEEK_MS;
      if (now - lastWeekAt >= weekIntervalMs) {
        s.tickWeek();
        lastWeekAt = now;
      }

      // 3) 自動 LoC 進行：開発中のみ 1 秒ごと
      if (s.screen === 'develop' && now - lastAutoAt >= AUTO_LOC_INTERVAL_MS) {
        s.tickAuto(1);
        lastAutoAt = now;
      }

      // 4) バグ抽選：開発中のみ 10 秒ごと
      if (s.screen === 'develop' && now - lastBugAt >= BUG_TRY_INTERVAL_MS) {
        s.triggerBugIfDue();
        lastBugAt = now;
      }
    }, TICK_BASE_MS);

    return () => clearInterval(t);
  }, []);

  return null;
};
