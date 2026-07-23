# v0.26「働く姿に息を」— タスクリスト

> 凡例：`[x]` 実装済 / `[~]` 部分実装 / `[ ]` 未着手。spec: [spec.md](./spec.md)。
> **実装・検証完了（2026-07-20）**。実装順：Stage B（会議図）→ Stage A（歩行）。

## 0. 計画ゲート

- [x] roadmap §v0.26 を spec に展開
- [x] worktree 作成（`worktree-v26-employee-motion`）
- [x] オーナー追加要望「もっと動きがほしい」を反映し spec 全面改訂（3画面のビジュアル経路を実測）
- [x] 実測：歩行素材 `walk_*.png`（6フォルダ）・会議図 `phase/planning.png` とも既存＝新規素材ゼロと確認
- [x] オーナー明示GO（「実装開始して」）

## Stage B. 企画フェーズにホワイトボード会議の図（要望②・素材ゼロ）

- [x] `DevelopScreen.tsx` の planning Center に `public/phase/planning.png` を背景レイヤーで追加（案(a)＝ディム背景＋入力パネル手前）。デッドフィールド `DEV_PHASE_META.planning.image` を wire up
- [x] 入力欄・お題・ローマ字欄の可読性を担保（上濃/下薄の縦グラデ scrim＋不透明入力カード）
- [~] 他フェーズ背景（development 等）の wire up は**本版では見送り**（development center が高密度で可読性の個別調整が要るため。§5-3・follow-up 候補）
- [x] 検証：4点セット緑／planning で会議図が実描画／実機スクショで会議図＋可読性＋打鍵継続確認／1280×720・スクロールなし

## Stage A. 待機オフィスでランダム歩行（要望①）

- [x] `src/core/officeWander.ts` 新規：`stepWander`/`initWander` 純粋関数＋型（席撤廃・ランダム目標・座標/向き/休止を進める・rng注入）
- [x] `src/core/officeWander.test.ts`：unit 8件（休止減算／目標到達で休む／新目標抽選／壁沿い片軸移動／詰まりで諦め／決定論／init 位相散らし）
- [x] `officeLayout.ts`：`WALKABLE_POINTS`（歩行可能セル中心）を追加
- [x] `OfficeView.tsx`：着席描画を撤廃し歩行描画へ（RAF ループで全社員 stepWander・`walkSheet` 8方向再生・`standingSprite` 停止時・`renderBandedSprite` で occlusion）
- [x] 検証：`stepWander` unit 緑／4点セット緑／実機で社員が歩き回る（t1→t2 で位置移動確認）・家具の前後遮蔽が正しい（棚裏に潜る）・5人同時でエラーなし／1280×720・スクロールなし
- [x] 実機FB反映：①壁際で歩き続けすぎ→stuck 諦め（`stuckLimitMs`）②停止時のぐちゃ広がり→歩行↔立ちで key 変え img 再生成 ③広範囲→半径 `WANDER_RADIUS` 内うろつき ④机の上→`WALKABLE_POINTS`/`canStand` を家具 footprint 除外の「開けた床」に（`isOverFurniture`/`isOpenFloor`・184セル除外）。再検証：unit 334緑・4点緑・実機3フレームで近所うろつき/机上に立たない/遮蔽OK確認
- [ ]（オーナー確認待ち）「生きている／働いている」体感・歩行速度/休止/うろつき範囲の気持ちよさ

## 仕上げ

- [x] roadmap §v0.26 に「実装・検証完了」注記
- [ ] コミット・PR（オーナー確認後）
