# テスト戦略資料（2026-07-09）

> **位置づけ**: エンジニアリング資料。前提となるコード構造は `docs/architecture.md`。
> テストを書くときの規則の要約はスキル `.claude/skills/testing-rules/`。

---

## 1. 戦略の骨子：3層に分け、下の層ほど厚くする

| 層 | 何を検証するか | ファイル | 実行環境 | コマンド |
|---|---|---|---|---|
| **unit** | ルール計算（core / utils / data の純粋関数） | `src/**/*.test.ts`（対象の隣） | node | `npm run test:unit` |
| **use-case** | 画面単位のユーザー操作シナリオ | `src/**/*.test.tsx`（対象の隣） | Vitest Browser Mode（実 Chromium・1280×720） | `npm run test:ui` |
| **e2e** | 起動→企画→開発→リリース→販売のジャーニー | `tests/*.spec.ts` | Playwright | `npm run test:e2e` |

### なぜこの配分か

- **unit を主体にする理由**：このゲームで一番壊れて困るのは経済・スコアのルール計算であり（architecture §2-a）、それは純粋関数なら1ケース数ミリ秒・完全決定的に検証できる。バランス調整のたびに全数回帰を回す使い方に耐えるのはこの層だけ。
- **UI を「ユースケース」粒度に留める理由**：UI は頻繁に作り替える（architecture §2-b）。ボタンの配置や文言に密結合したテストは作り替えのたびに死ぬ。「開発中に打鍵すると進捗が伸びる」のような**仕様として残る操作シナリオ**だけをテストすれば、画面のリニューアルを跨いで生き残る。コンポーネント単体の props 網羅テストは書かない。
- **e2e を3本程度に絞る理由**：最も遅く（1本数十秒）、最も壊れやすく、最も直しにくい層。実ブラウザ+実タイマー+乱数が絡むためである。「全体がつながっている」ことの確認だけに使い、個別ロジックの検証を持ち込まない。既存13本のうちスクショ確認系10本が資産にならなかったのがこの層の限界の実例。

### 各層の使い分けの判定

| 検証したいこと | 層 |
|---|---|
| 売上倍率のクランプ、解放のしきい値、日付計算の月またぎ | unit |
| store アクションを呼んだら状態がこう変わる | unit（P2 以降。resetStore + アクション呼び出し） |
| 企画画面でジャンルを選んで開始すると開発画面に遷移する | use-case |
| ニューゲームから1作リリースして販売まで到達できる | e2e |

## 2. 決定性の規則（フレーキーテスト禁止）

テストが「たまに落ちる」状態は、全テストの信頼を毀損して回帰検知の価値を消す。よって：

1. **乱数**：`Math.random` に依存する assert を書かない。対象関数に `mulberry32(seed)` か固定値 `() => 0.5` を渡す（architecture §5-1 のポート）。
2. **時刻**：`Date.now()` の実時刻に依存しない。`nowMs` や `Clock` を固定値で渡す。
3. **実時間待ち禁止**：`setTimeout` で待って assert するテストを書かない。unit は待つ必要がないはず（待ちたくなったら設計が誤り）。use-case は `vi.useFakeTimers` かリトライ付き locator（vitest-browser-react 標準）を使う。
4. **e2e の決定化**：`?seed=NN`（boot が mulberry32 に配線）+ `page.clock.install()` で乱数と時計を固定する。

## 3. unit テストの書き方

- 対象ファイルの隣に `xxx.test.ts` を置く（コロケーション）。**理由**：テストの有無・古さが対象を開いた瞬間に見え、移動・削除も一緒に行われる。`tests/` 配下への集約は Playwright（プロジェクトルート実行が必要）だけの例外。
- **境界値を優先する**：クランプの上下端・しきい値の両側・下限0・空配列。網羅より「壊れたら気付きたい重要分岐」を選ぶ。
- **balance.ts の値は import して使う**：`expect(x).toBe(40)` のように調整値をテストに直書きすると、バランス調整のたびにテストが死ぬ。`DEV_SPEED_GAIN.maxBonus` を import して期待値を組み立てれば、調整に自動追従し、テストは「式の構造」を守る。ただし SCORE_TIERS のような**設計上の固定点**（神ゲー95+等）は直書きで固定してよい（変わったら気付くべき値だから）。
- vitest の `describe / it / expect` を明示 import する（globals は使わない。tsconfig を汚さないため）。

## 4. use-case テストの書き方

- レンダラは `vitest-browser-react`。jsdom や React Testing Library は使わない。**理由**：ピクセルアート・canvas・固定 1280×720 前提の UI に jsdom は欠落 API が多すぎる。Browser Mode は実 Chromium で、しかも既存の Playwright インストールを流用できる。
- 状態の準備は `beforeEach` で `resetStore(partial)`（`src/state/testing.ts`）。localStorage 経由で仕込まない（セーブ形式に密結合するため）。
- `GlobalTicker` はマウントしない（実時間 interval が走り決定性を壊す）。効果音が邪魔なら `utils/sound` / `utils/sfx` を `vi.mock`。
- assert は**ユーザーに見えるもの**（テキスト・表示状態）と **store の結果状態**の2点。DOM 構造の詳細（クラス名・タグ階層）に依存しない。

## 5. e2e テストの書き方

- 3本 + smoke を上限の目安とする。増やしたくなったら「それは unit / use-case に落とせないか」を先に検討する。
- `playwright.config.ts` の `webServer` により dev server は自動起動（手動起動不要）。
- 状態の確認は `window.__gs()`（boot が DEV 時に設定する覗き窓）。
- スクリーンショット比較を恒久テストにしない。開発時の使い捨て検証 spec は `tests/archive/` へ（testDir 対象外）。

## 6. 実行と完了の定義

```bash
npm test          # unit + use-case（vitest projects 一括）
npm run test:unit # unit だけ（高速。ロジック変更中の反復用）
npm run test:ui   # use-case だけ
npm run test:e2e  # Playwright ジャーニー
```

**検証4点セット**（実装タスクを「完了」と報告する条件）：

1. `npm run build`（tsc -b + vite build が通る）
2. `npm test` が緑
3. `npm run test:e2e` が緑
4. ブラウザ実機で該当画面を目視（MVP 要素チェック。playwright-verify スキル参照）

## 7. 何をテストしないか（明示的な非対象）

- 効果音・BGM の再生（検証コスト > 価値）
- ピクセルアートの見た目（人間の目視 + 必要ならスクショを開発時に一時利用）
- `data/` の静的テーブルの中身そのもの（値はゲームデザインの領分。ただし「全ジャンル×全テーマで相性が定義域内」のような**整合性**は unit で守る）
- サードパーティの内部動作（nano-type-jp のローマ字判定そのもの。こちらは利用側の統計ロジックだけテストする）

## 改訂履歴

- 2026-07-09 初版（docs/architecture.md から分離）
