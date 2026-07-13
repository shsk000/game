# v0.20 実装タスク

> 仕様: [spec.md](./spec.md)　凡例: `[x]` 実装済 / `[~]` 部分実装 / `[ ]` 未着手
> 規約: logic-architecture / testing-rules / dev-flow スキル準拠

## 継承タスク（前版から）

- [ ] オーナー実プレイで「作業感」が減ったかを確認（v0.19 から継続）

## 追加タスク（このバージョン）

### 1. パターンA: ジュース強化（spec §2）— 完了
- [x] `core/juice.ts`：`keyPitchStep` / `comboTitleAt`（純粋関数・unit テスト6件）
- [x] コンボ数に応じた打鍵SEの音階変化（`sfx.key(pitchStep)`）
- [x] コンボ50/150/300で称号ポップ

### 2. パターンA-2: 入力アクション増量（spec §2）— 完了
- [x] かな1モーラごとのポップ/バウンス/スパーク演出（`KanaActionLine`）
- [x] 進捗フライアウト数字（`.dev-progress-fly`）
- [x] PERFECT文字数達成時の画面シェイク（`.dev-perfect-shake`）
- [x] FEVER突入バナー（`.dev-fever-banner`）
- [x] `@shsk002/nano-type-jp` 0.7.0 更新・`resolvedUnitCount` 実値ベースへの置き換え
      （近似ロジック `kanaProgressFromRomaji` を全廃。`splitMorae` のみ表示グルーピング用に残す）
- [x] 実機バグ修正：FEVERバナーのサイズ/表示時間、TeamStatusのflex制御（画面外押し出し回帰）

### 3. パターンB: 間欠サプライズ（spec §3）— 完了
- [x] `JUICE_CONFIG.rare` の数値見直し（`statMult` 撤去・`feverBonus: 20` に統一）
- [x] クリティカル打鍵：開発フェーズの正打時に `rollCrit()` で判定 → `addFever(crit.feverBonus)`
- [x] クリティカル演出：`sfx.crit()`・`.dev-crit-pop`ポップ
- [x] レア文章：`pickPhrase` 呼び出し時に `rollRare()` で判定・文章カードに★レアバッジ表示（開発フェーズのみ）
- [x] レア文章報酬：完走時に FEVERゲージへ `rare.feverBonus` を加算のみ（devStats/funFactorへの直接倍率は行わない）
- [x] レア文章演出：完走時「★レア達成！」ポップ（`.dev-rare-pop`）・`sfx.rare()`
- [x] unit テスト：crit判定・rare判定の境界値（`core/juice.ts` に `rollCrit`/`rollRare` を追加、`core/juice.test.ts` に4件）
- [x] 4点セット（build/unit 236/ui 14/e2e 7）＋Playwright MCPでの実打鍵検証（RNGをcrit/rare発生確率未満に固定し、実キー入力で `.dev-crit-pop`/`.dev-rare-badge`/`.dev-rare-pop` のDOM出現とFEVER早期発動を確認。spec §7 チェックリスト消し込み済み）
- [ ] SE（`sfx.crit()`/`sfx.rare()`）の心地よさ・「間欠サプライズ」としての体感 → オーナー確認待ち

### 4. パターンC: 自動の山場（spec §5）— 完了
- [x] `JUICE_CONFIG.crunch` に `bossRate: 0.15`・`bossFeverBonus: 30` を追加
- [x] `data/devPhrases.ts` に `pickBossPhrase(category, rng)` を追加（プールから2文連結）
- [x] クランチタイム自動発動：`overallProgressPct >= crunch.startPct` で `addDevelopLoC` の乗数に `crunch.progressMult` を追加（feverMultと併用）
- [x] クランチ突入演出：`sfx.crunch()`・「⏰ラストスパート！！⏰」バナー（1回のみ）・常時バッジ表示（画面表示名は「ラストスパート」。オーナーFBで「クランチ」から変更）
- [x] ボス文章：クランチ中の文章選択時に `crunch.bossRate` で判定・「⚔BOSS」バッジ表示（レアと同時当選時はボス優先）
- [x] ボス文章報酬：完走時に FEVERゲージへ `crunch.bossFeverBonus` を加算のみ
- [x] ボス文章演出：完走時「⚔BOSS撃破！」ポップ・画面シェイク（`LastResult.boss` フラグ経由）
- [x] unit テスト：クランチ判定・ボス判定の境界値（`core/juice.test.ts`）、`pickBossPhrase` の連結ロジック（`data/devPhrases.test.ts`）
- [x] 4点セット（build/unit 242/ui 14/e2e 7）＋Playwright MCPでの実打鍵検証（80%到達バナー・ボス文章の誘発と完走報酬・1280×720オーバーフローなしを実機確認。spec §8 チェックリスト消し込み済み）
- [ ] クランチの高揚感・ボスの「山場」体感 → オーナー確認待ち

### 5. パターンD: 合計値ライブ表示（spec §6）— 完了
- [x] 原因調査：中央パネルの「PHASE X/6」表記が左サイドバーの6段階フェーズ進行リストと
      紛らわしい別概念（現フェーズ内%を6分割しただけ）だったことを特定
- [x] `DevelopCenter`/`PlanningCenter` に `progressPct` prop を追加
- [x] ヘッダーの「PHASE X/6」文字表記を撤去し、「開発 {pct}%」／「企画書 {pct}%」を主役表示に（ドット目盛りは残す）
- [x] 4点セット（build/unit 242/ui 14/e2e 7）＋実機で左サイドバーとの数値一致・リアルタイム連動・1280×720オーバーフローなしを確認（spec §9 チェックリスト消し込み済み）
- [ ] 「完成までの進捗を理解できるようになったか」→ オーナー確認待ち

### 6. パターンE: ギアシフト＋ノーミスストリーク（spec §7）— 完了
- [x] `JUICE_CONFIG.gears` の `label` を日本語化（`'GEAR 2'`→`'高速'`、`'GEAR 3'`→`'超高速'`）
- [x] `core/juice.ts` に `gearFor(wpm)` を追加（rng不要の純粋関数。unit テスト3件）
- [x] ギアシフト：開発フェーズの正打（クリティカルでない場合）で `addFever(1)` を `addFever(gearFor(wpmRef.current).feverGain)` に置き換え
- [x] ギアバッジ：ギア2以上でヘッダーに「⚡{label} ×{feverGain}」表示
- [x] ノーミスストリーク：フレーズ内ミスの有無を `phraseMissRef` で追跡し、完走時にストリーク+1／ミスがあれば0にリセット
- [x] ストリークバッジ：2以上でヘッダーに「🎯ノーミス継続 N文」表示
- [x] ノーミス完走報酬：FEVERゲージへ `perfect.feverBonus` を加算のみ
- [x] 画面表示に「PERFECT」「GEAR」等の英語ジャーゴンを使っていないことを確認
- [x] unit テスト：ギア判定（`core/juice.test.ts`）
- [x] 4点セット（build/unit 245/ui 14/e2e 7）＋実機打鍵で検証：ノーミスストリークのバッジ出現／ミスでのリセットを実キー入力で確認。ギアバッジはコード確認のみ（Playwright MCPの入力レイテンシでwpm150に到達できないため実機確認はオーナー待ち。spec §9 チェックリスト消し込み済み）

### 7. FEVER可視化（ゲージ以外で「溜まりやすさ」を分かるように。spec §13 changelog）— 完了
- [x] クリティカル／レア文章／ボス文章の完走ポップに実際のFEVER加算量「🔥+N」を追記
- [x] ギアバッジの文言を「⚡高速 ×2」→「🔥たまりやすい ×2」に変更
- [x] 未使用になった `JUICE_CONFIG.gears`/`Gear` 型の `label` フィールドを削除
- [x] 4点セット（build/unit 245/ui 14/e2e 7）＋実機でクリティカル・レア達成ポップの実加算量表示を確認
- [ ] ボス文章の出現率（80%以上×15%）をチューニングするか → オーナー判断待ち

### 8. パターンG: ボス戦の挿絵演出（spec §7-2）— 完了
- [x] PixelLabでボス挿絵4コンセプト生成・オーナー選定（`public/sprites/boss/*.png`）
- [x] `BossBattlePanel` を新設：「実装中の様子」欄をボス文章の間だけ差し替え（カテゴリ非依存）
- [x] ボスHPバー（`resolvedUnitCount/totalUnitCount` 由来）・被弾シェイク・斬撃エフェクト（`.dev-boss-slash`）
- [x] ボス出現バナー「⚔{名前}が立ちはだかる！⚔」
- [x] 背景素材（`battle-bg.png`）をPixelLabで生成・オーナー承認・組み込み
- [x] 4点セット（build/unit 245/ui 14/e2e 7）＋実機で出現→HP減少→撃破の一連を実キー入力で確認

## 積み残し（次版へ）

- オーナー実プレイでの作業感の再確認（B・C・D・E・G実装後）
