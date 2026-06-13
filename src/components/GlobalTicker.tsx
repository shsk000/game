import { useEffect } from 'react';
import { TIME_RATE_MS_PER_WEEK } from '../data/balance';
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
const IDLE_WEEK_MS = 30_000;

export const GlobalTicker = () => {
  useEffect(() => {
    let lastSalesAt = performance.now();
    let lastWeekAt = performance.now();
    let lastScreen: string | null = null;

    const t = setInterval(() => {
      const s = useGameStore.getState();
      if (s.gameOver) return;
      const now = performance.now();

      // 画面が切り替わった瞬間に各 tick の lastAt をリセット
      // （アイドル中に貯めた 25 秒分を develop 突入時に即時消費してしまう問題を防ぐ）
      if (s.screen !== lastScreen) {
        lastSalesAt = now;
        lastWeekAt = now;
        lastScreen = s.screen;
      }

      // 1) 販売 tick：1 秒ごと（全画面・開発中も既存作品は売れる）
      if (now - lastSalesAt >= SALES_INTERVAL_MS) {
        s.tickSales(1);
        lastSalesAt = now;
      }

      // 2) 時間進行 tick：開発中は速く（7.5s/週）、それ以外はアイドル（30s/週）。
      // v0.11 後期：開発中も裏で時間を進める＝「速く打つほど少ない週で完成し固定費が安く
      // 早期リリースできる」プレッシャー型。手を止めても週は進み、月またぎで固定費が引かれる
      // （tickWeek → monthlyTick で借入上限超ならゲームオーバー）。
      // ※自動 LoC（tickAuto）は呼ばない＝進捗はタイピング入力のみで進む（放置で完成しない）。
      const weekIntervalMs =
        s.screen === 'develop' ? TIME_RATE_MS_PER_WEEK.typingActive : IDLE_WEEK_MS;
      if (now - lastWeekAt >= weekIntervalMs) {
        s.tickWeek();
        lastWeekAt = now;
      }
    }, TICK_BASE_MS);

    return () => clearInterval(t);
  }, []);

  return null;
};
