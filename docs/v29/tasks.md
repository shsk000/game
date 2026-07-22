# v0.29 タスク — 規模で打鍵の重みを変える

凡例：`[x]` 実装済 / `[~]` 部分実装 / `[ ]` 未着手。spec: [spec.md](./spec.md)。

> 方針（確定）：総量（`workTarget`）は既に規模連動＝触らない。**1文の長さを規模で偏らせる**（抽選の重み付けのみ／データ追加なし）。

## 1. 抽選ロジック（`src/data/devPhrases.ts`）

- [x] 1-1 `splitMorae` を import し、モーラ数で長さを測る
- [x] 1-2 `BANDED_POOLS`：各カテゴリのプールをモーラ昇順で三分位に分割（short/mid/long・必ず非空）
- [x] 1-3 `SCALE_BAND_WEIGHTS`：規模別バンド重み（叩き台 🔧）
- [x] 1-4 `pickWeighted`：空バンド除外＋再正規化つき重み抽選
- [x] 1-5 `pickPhrase(category, rng, scale?)`：scale 指定時は重み抽選、省略時は従来の一様抽選（後方互換）
- [x] 1-6 `pickBossPhrase(category, rng, scale?)`：連結元の各文も規模重みに従う（連結本数は 2 のまま）

## 2. 呼び出し側（`src/features/develop/DevelopScreen.tsx`）

- [x] 2-1 初期フレーズ生成（:169）に `current?.scale` を渡す
- [x] 2-2 次フレーズ生成（:446 boss/通常の両分岐）に `current?.scale` を渡す

## 3. テスト（`src/data/devPhrases.test.ts`）

- [x] 3-1 各カテゴリのプールが三分位に割れる幅を持つ（前提チェック）
- [x] 3-2 規模が上がるほど平均モーラ数が単調増（全カテゴリ集計・決定的PRNG）
- [x] 3-3 カテゴリ単位でも aaa は mini より平均が長い
- [x] 3-4 scale 省略時は従来どおり（一様抽選）

## 3.5 打鍵プールの増量（1.5倍・反復対策）

- [x] 3.5-1 `CATEGORY_PHRASE_POOLS` 各カテゴリ 80→120 件（＋40件×4＝160件追加）
- [x] 3.5-2 追加分もひらがな＋長音符のみ・プール内重複なし（`phrasePools.test.ts` 緑）
- [x] 3.5-3 追加分は短/中/長に分散（三分位バンドの均衡維持）
- [x] 3.5-4 `pickBossPhrase` テストをプール件数非依存に修正（`0.99`→`0.999999`）
- [x] 3.5-5 実測で反復改善を確認（連続重複 aaa 1.62%→1.08%、40本ユニーク 30→35）

## 4. 検証

- [x] 4-1 `npx vitest run`（全370+件 緑）
- [x] 4-2 `npx tsc --noEmit`（型エラーなし）
- [x] 4-3 `npm run build`（成功）
- [~] 4-4 ブラウザ実機：開発フェーズで打鍵が回帰なく動く／1280×720固定・スクロールなし・コントラスト維持

## 5. follow-up（このバージョンでは対応しない 🔧）

- [ ] 5-1 企画フェーズ打鍵（`planTickets.ts`）の規模連動
- [ ] 5-2 ボス文の連結本数を規模で増やす
- [ ] 5-3 `SCALE_BAND_WEIGHTS` / バンドしきい値の本チューニング（プレイFB反映）
