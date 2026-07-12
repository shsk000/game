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

### 3. パターンB: 間欠サプライズ（spec §3）— 計画済み・実装はこれから
- [ ] `JUICE_CONFIG.crit` / `JUICE_CONFIG.rare` の数値見直し（`rare.statMult`→`rare.mult`、適用先を進捗/hypeに変更）
- [ ] クリティカル打鍵：開発フェーズの正打時に `crit.rate` で判定 → `addFever(crit.feverBonus)`
- [ ] クリティカル演出：`sfx.crit()`・金色スパーク（`.dev-crit-spark`）・画面フラッシュ
- [ ] レア文章：`pickPhrase`/`pickPlanPhrase` 呼び出し時に `rare.rate` で判定・文章カードに★レア表示
- [ ] レア文章報酬：開発＝進捗（`doneLoC`）× `rare.mult`、企画＝期待度（`hype`）× `rare.mult`、両方＋FEVERゲージ
- [ ] レア文章演出：完走時「★レア達成！」ポップ
- [ ] unit テスト：crit判定率・rare判定率・報酬計算の境界値（`core/juice.ts` に判定関数を追加）
- [ ] 4点セット＋実機打鍵で検証（spec §7 チェックリスト消し込み）

## 積み残し（次版へ）

- **パターンC**（自動の山場：クランチタイム・ボス文章）— `JUICE_CONFIG.crunch` は叩き台のみ、未実装
- **パターンD**（合計値ライブ表示：積み上げの主役化）— オーナーFB「完成までの進捗を理解してなかった」を受け優先度上昇
- **パターンE**（ギアシフト＋パーフェクトストリーク）— `JUICE_CONFIG.gears` / `perfect` は叩き台のみ、未実装
- オーナー実プレイでの作業感の再確認（B実装後）
