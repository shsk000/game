# v0.17 実装タスク

> 仕様: [spec.md](./spec.md)　凡例: `[x]` 実装済 / `[~]` 部分実装 / `[ ]` 未着手
> 規約: logic-architecture（ロジックは core/ に純粋関数＋rng/clock 注入）／testing-rules（ロジック変更は unit テスト必須・スクロール禁止）

## 継承タスク（前版から）

- [x] v0.16 バランス再設計（実装済み。オーナープレイ確認で本タスクの FB を受領）

## 追加タスク（このバージョン）

### 1. リリース結果の 2 画面分割（spec §1）
- [x] ReleaseScreen を STEP1「評価」/ STEP2「売上」に分割（広告・打ち上げは STEP2 へ移設、STEP2 は2カラム）
- [x] 両ステップが 1280×720 に収まる（実測 overflow 0px。レーダー図は情報重複のため撤去）
- [x] ジャーニー e2e 更新（STEP1 メタスコア → 売上を見る → STEP2 → オフィス）

### 2. 全員参加（spec §2）
- [x] startProject(genre, theme, scale, title?) に変更。参加は常に全社員
- [x] PlanScreen のアサイン UI 削除 →「👥 開発チーム 全員参加（N人）」表示
- [x] computeCharacterScore の超過ペナルティ廃止（未満 -10 は維持）＋テスト更新
- [x] 分布シミュレーション：帯は維持（序盤 70+ 0% / 終盤 95+ ≤15% のまま緑）

### 3. 能力・レベルの可視化（spec §3）
- [x] 役割効果の表示を ROLE_EFFECT から生成（採用/社員リスト。プログラマーは🐛バグ抑制も明記）
- [x] PlanScreen にチーム効果プレビュー（⚡開発速度/🎨品質/📣売上/🐛バグ抑制）
- [x] Lvアップバッジに効果差分（power 前後・給与増）を併記
- [x] 社員リストに「Lv・次まで exp N」表示
- [x] 月給式にレベル項：+ (level−1)×¥5万（balance.ts / growth.ts / テスト更新）

### 3.5 タイトル命名（spec §3.5）
- [x] PlanScreen にタイトル入力欄（16字）＋🎲 再抽選＋ UI テスト
- [x] startProject の title 引数（空はランダム補完）

### 4. バグ発生システム（spec §4）
- [x] `core/bugs.ts` 新設：抑制率・発生判定・デバッグ工数・残バグペナルティ・修正フレーズ（テスト9件）
- [x] CurrentProject.bugCount。開発中の蓄積（onComboBreak / フレーズ完走にフック、store の noteBugOnMiss/OnPhrase）
- [x] HUD の 🐛×N カウンタ（発生時 SE＋フラッシュ）
- [x] テストフェーズ：既存ミッションフロー完了時に「🐛 バグが N 匹みつかった！」発覚表示
- [x] デバッグフェーズ：DebugFlow 新設（バグ×2文の修正、全滅で「バグゼロ +5」／[このまま発売] で品質−2・炎上+2/匹）
- [x] 旧バグ抽選（triggerBugIfDue / bugPhrase）を廃止し一本化（死にコードを削除）
- [x] release への合流（quality 減点・炎上→売上/ファン減）＋テスト2件

### 5. 検証（spec §6）
- [x] リリース2画面 overflow 0px 実測 / アサイン操作なしで開始（実機） / 可視化一式表示確認
- [x] 分布シミュレーション緑のまま / vitest 204件 / e2e 7本 / build 緑
- [ ] オーナーへプレイ依頼
