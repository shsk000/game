# v0.29 タスク — 解放は購入で（ジャンル/テーマ自動解放の廃止）

凡例：`[x]` 実装済 / `[~]` 部分実装 / `[ ]` 未着手。spec は [spec.md](./spec.md)。

> ゲート：本タスクは **オーナーの明示 GO 後に着手**（dev-flow [1]→[2]）。GO 前は docs のみ。

## 1. 発売時の自動解放を外す（コア）

- [x] 1-1 `src/core/release.ts`：`computeStageUnlocks` 呼び出しを削除。
- [x] 1-2 `src/core/release.ts`：`ReleasePatch` の `unlockedGenres`/`unlockedThemes` を現状値パススルー（`[...ctx.unlockedGenres]` / `[...ctx.unlockedThemes]`）にした。
- [x] 1-3 `src/core/release.ts`：未使用の `computeStageUnlocks`/`StageUnlock` の import を整理。
- [x] 1-4 カテゴリ解放（`computeNewlyUnlockedCategories`）は無改修（実機で innovation が¥1億自動解放を確認）。

## 2. 維持の確認（変更しない＝回帰させない）

- [x] 2-1 `src/core/progression.ts` の `computeStageUnlocks` は残した（`storage.ts:382` toV7 が使用）。関数・`progression.test.ts` 維持。
- [x] 2-2 `src/utils/storage.ts`：`toV7`・`shapeLoaded` は無改修（リロードでしきい値再解放しないことを実機確認）。
- [x] 2-3 `buyGenre`/`buyTheme`・`invest.ts`・`PlanScreen`/`LockedShop` は無改修で購入解放が機能（実機確認）。

## 3. テスト（testing-rules）

- [x] 3-1 `src/core/release.test.ts`：回帰追加。累計¥2億＋ヒット作5本の ctx で `computeRelease` しても `patch.unlockedGenres`/`unlockedThemes` が ctx と同一。緑。
- [x] 3-2 既存 `release.test.ts` の 52-53 は ctx セットアップのみ＝影響なしを確認（全 test 緑）。
- [x] 3-3 `gameStore.test.ts`・`progression.test.ts` 緑のまま（unit 353 passed）。
- [~] 3-4 use-case：既存 `PlanScreen.test.tsx:72`「未解放は選択肢に出ない」でフィルタ担保。購入→選択の追加シナリオは実機で消し込み済みのため今回は見送り（必要なら追加可）。

## 4. QA ユースケース定義（本版の主要 deliverable）

- [x] 4-1 `docs/qa/usecases.md` に **UC-14 ジャンル/テーマ解放（購入制）** を追加（手順＋オラクル）。※docs 先行で記載済み。
- [ ] 4-2 UC-07（購入）の注記を「自動解放との併存」から「購入が唯一の解放経路」に更新。

## 5. 検証（レビュー依頼前・全項目必須）

- [x] 5-1 検証4点セット：build 緑 / test:unit 353 緑 / test:ui 14 緑 / test:e2e 7 緑。
- [x] 5-2 Playwright MCP 実機（5174）：初期 stage1 のみ(3/3) → DEV累計売上¥2億で実発売しても解放 0 増（企画は3/3のまま・購入ショップ24/25） → `buyGenre('action')` で選択肢に追加＆資金¥3000万減＆ショップ(24→23) → リロードで購入 action 保持・しきい値解放なし。spec §7 全消し込み。
- [x] 5-3 `console.error` 0。カテゴリは innovation が¥1億で自動解放され回帰なし。

## 6. ドキュメント/後続

- [x] 6-1 `docs/roadmap.md` に v0.29 を1行追記（予約ブロック外の新規要望）。
- [ ] 6-2 価格バランス 🔧（spec §4）は v0.28 総合バランスへ申し送り（本版は据え置き）。
