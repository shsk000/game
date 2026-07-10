---
name: testing-rules
description: タイピング工場プロジェクトのテスト規約（unit=node / use-case=Vitest Browser Mode / e2e=Playwright の3層戦略）。テストを書く時・直す時、ロジックを追加/変更した時（unit テスト必須）、*.test.ts / *.test.tsx / tests/*.spec.ts を触る時、実装タスクを完了報告する前（検証4点セット）は必ずこのスキルを参照すること。戦略の理由と詳細は docs/testing.md。コード構造の規約は logic-architecture スキル。
---

# テスト規約（確定）

**3層戦略：ロジックは unit テスト（厚く）、画面はユースケーステスト（薄く）、e2e はジャーニー3本程度（最小）。**
配分の理由と詳細は `docs/testing.md` を参照。

## ⭐ クイックリファレンス（絶対規則）

| # | 規則 | 詳細 |
|---|---|---|
| 1 | ロジックを書いた/変えたら **unit テスト必須**（境界値優先） | §1 |
| 2 | テストは**コロケーション**：対象ファイルの隣に置く。`tests/` は Playwright 専用 | §1 |
| 3 | 拡張子で層が決まる：`*.test.ts`=unit（node）/ `*.test.tsx`=use-case（browser） | §1 |
| 4 | **非決定的なテスト禁止**：乱数は `mulberry32(seed)` か固定値を注入、時刻は固定値、実時間待ち禁止 | §2 |
| 5 | UI テストはユーザー操作シナリオ単位。コンポーネント単体の props 網羅は書かない | §3 |
| 6 | e2e を安易に増やさない（3本+smoke が目安）。スクショ比較を恒久テストにしない | §4 |
| 7 | 完了報告前の**検証4点セット**：`npm run build` → `npm test` → `npm run test:e2e` → ブラウザ目視 | §5 |

## §1 層の選び方と置き場所

| 検証したいこと | 層 / ファイル |
|---|---|
| 計算の境界値（クランプ・しきい値・月またぎ・下限0） | unit：`src/**/xxx.test.ts`（対象の隣） |
| store アクション呼び出しによる状態遷移 | unit：`resetStore()` で準備しアクション実行 |
| 画面での操作シナリオ（選択→開始→遷移、打鍵→進捗） | use-case：`src/**/Xxx.test.tsx` |
| ゲーム全体のジャーニー（起動→企画→開発→リリース→販売） | e2e：`tests/*.spec.ts` |

- `describe / it / expect` は vitest から**明示 import**（globals 不使用）。
- 期待値は `data/balance.ts` の定数を import して組み立てる（調整値の直書き禁止。バランス調整でテストが死ぬ）。ただし設計上の固定点（例：神ゲー95+）は直書きで固定してよい。

## §2 決定性（フレーキー禁止）

1. 乱数：対象関数の末尾引数に `mulberry32(seed)`（`src/core/ports.ts`）か `() => 0.5` を渡す。`Math.random` 依存の assert を書かない。
2. 時刻：`nowMs` / `Clock` を固定値で渡す。
3. 実時間 `setTimeout` で待つテストを書かない。unit で待ちたくなったら設計が誤り（logic-architecture 違反を疑う）。
4. e2e：`?seed=NN` + `page.clock.install()` で決定化。

## §3 use-case（UI）テストの書き方

- レンダラは `vitest-browser-react`（jsdom / React Testing Library は使わない）。viewport は 1280×720 固定（vitest.config.ts 設定済み）。
- 状態準備は `beforeEach` で `resetStore(partial)`（`src/state/testing.ts`）。localStorage 経由で仕込まない。
- `GlobalTicker` はマウントしない（実時間 interval が決定性を壊す）。効果音は必要なら `utils/sound` / `utils/sfx` を `vi.mock`。
- assert は「ユーザーに見えるもの」（テキスト・表示）と「store の結果状態」の2点。クラス名・DOM 階層に依存しない。

## §4 e2e（Playwright）

- dev server は `webServer` 設定で自動起動。状態確認は `window.__gs()`。
- 増やしたくなったら「unit / use-case に落とせないか」を先に検討。
- 開発時の使い捨て検証 spec は `tests/archive/` へ（testDir 対象外）。

## §5 検証4点セット（タスク完了の定義）

実装タスクを「完了」と報告する前に必ず：

1. `npm run build`（tsc -b + vite build）
2. `npm test`（unit + use-case が緑）
3. `npm run test:e2e`（ジャーニーが緑）
4. ブラウザ実機で該当画面を目視（MVP 要素チェック。playwright-verify スキル参照）

## テストしないもの（明示的な非対象）

効果音の再生 / ピクセルアートの見た目 / `data/` テーブルの値そのもの（整合性チェックは unit で行う）/ サードパーティ内部（nano-type-jp の判定そのもの）。詳細は docs/testing.md §7。
