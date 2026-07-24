# v0.26「働く姿に息を」— 社員に動きを（企画書）

> オーナー要望②「社員の動き」。roadmap.md §v0.26 をこの spec に展開したもの。
> 位置づけ：ローンチ後のライブ更新（**純演出・ゲームロジック無変更**）。関連: `docs/roadmap.md`, [[office-visual-design]] / [[game-ui-design]] / [[playwright-verify]] スキル。

---

## 改訂履歴

- 2026-07-20 初版。roadmap §v0.26 を「着席アイドル1本」で詳細化（着席 person を静止→シート再生に差し替える案）。
- 2026-07-20 **全面改訂（オーナー追加要望「もうちょっと動きがほしい」）**。狙いを "置物を動かす" から **"生きたオフィス"** に広げ、画面ごとに社員の状態を分ける方針へ転換。3画面のビジュアル経路を実測し直して確定：
  - **① office画面（待機）＝ランダム歩行**（着席をやめて歩き回る）。
  - **② 企画フェーズ（開発画面内の planning・タイピング画面）＝ホワイトボードに集まって会議している図を表示**。
  - **旧「着席タイピングアイドル」は廃止**（office画面が歩行になり着席の居場所が無くなったため。改訂履歴として記録）。
  - 実測で判明した2大ショートカット：(a) 歩行素材 `walk_*.png`（6フォルダ×8方向×8コマ）は**既に全て存在**し本番未使用、(b) 企画会議の1枚絵 `public/phase/planning.png`（1536×1024）は**まさに要望どおりのホワイトボード会議の図で、既に存在するのに未描画**。→ **本版は新規素材ゼロで実装可能**。
- 2026-07-20 **歩行の実機フィードバック反映（オーナー）**。4点調整：①壁際で無限に歩き続ける→`stepWander` に「近づけない時間(stuckMs)が `stuckLimitMs` を超えたら目標を諦めて休む」を追加。②停止時に画像が一瞬ぐちゃっと広がる→歩行↔立ちで React key を変え `<img>` を作り直す（幅だけ先に変わる残像を排除）。③広範囲に歩きすぎ→目標を現在地の半径 `WANDER_RADIUS`(210px) 内の開けた床に限定＝近所うろつき。④机の上を歩いて見える→`WALKABLE_POINTS`/`canStand` を **grid.walkable から家具 footprint（occluder cells）を除いた「開けた床」**に変更（`isOverFurniture`/`isOpenFloor`）。184/961セルが家具上で除外。「layout で調整できるか」への答え＝**既存レイアウトデータから自動導出で解決**（手描き不要）。

---

## この版で変えたこと（要点・思想転換）

1. **狙いを広げる**：roadmap の「座りっぱなしの静止画＝置物」を、単なるアイドル追加ではなく**画面の文脈に応じて社員の“いる姿”を変える**方向に拡張する。
   - 待機している時（office画面）＝**オフィスをうろうろ歩き回る**（生活感）。
   - 企画している時（planning フェーズ）＝**ホワイトボードに集まってアイデア出ししている**（協働している感）。
2. 変更は **見た目レイヤーのみ**。ゲームロジック（品質・売上・経済・タイピング判定・フェーズ遷移・実績）には一切触れない。
3. **なぜ新規素材ゼロで作れるか**：
   - 歩行＝既存の `walk_<dir8>.png`（8方向×8コマ／6フォルダ全部）＋既存の歩行 API（`walkSheet`/`WALK_FRAMES`/`isWalkable`/`vectorToDir8`）。参照実装が admin ツール `OfficeEditorTool`（`?walk`）に既にある。
   - 会議図＝既存の `public/phase/planning.png` を wire up するだけ（`DEV_PHASE_META.planning.image` は定義済みだが**どこからも描画されていないデッドフィールド**だった）。
4. **旧 §4-1「着席タイピングアイドル」は廃止**。office画面を歩行にすると着席スプライトの出番が無くなるため（開発画面は元々オフィス床を描かない）。着席アイドルは将来 office に「座って作業中の席」を再導入する版で復活余地。

---

## 1. 事業目的と前提

- 最上位の目的：「速さと品質を競うゲーム会社経営シム／作業感をなくす」（[[game-design]] スキル）。本版はコア体験を変えず、**オフィスの生命感**だけを底上げする磨き版（v0.25 机アイテムと同じ「生活感」系列）。
- 前提：オフィス描画は v0.19 の正面向き素材・アイソメ規格（[[office-visual-design]]）。roadmap 判断ゲート「**純演出・ロジック無変更（安全）**」を厳守。
- 制約：1280×720 固定・スクロール禁止（[[feedback_no_scroll_game_ui]]）。多人数同時アニメ・移動のパフォーマンスに注意（roadmap 明記）。濃色背景に暗い文字を置かない（[[feedback_dark_bg_light_text]]）＝会議図を敷く時の可読性ゲート。

## 2. 現状の実測（着手前のベースライン）

### 2-1. 画面と社員ビジュアルの対応（探索で確定）

| 画面 | 表示条件 | 今の社員ビジュアル | オフィス床(OfficeView) |
|---|---|---|---|
| **OfficeScreen**（待機/ホーム） | `screen==='office'` ほか非develop全画面の土台（App.tsx:35-66） | `OfficeView` が **着席スプライト**（sitting）で6席固定描画。移動なし | あり（`office_bg.png` 1445×1088＋着席社員） |
| **DevelopScreen 企画フェーズ** | `screen==='develop'` かつ `phase==='planning'`（タイピング画面） | ドット絵社員は**出ない**。社員は左カラムの絵文字＋名前のみ。中央は 企画チケット／かな入力／ローマ字欄／企画メモ・アイデア付箋（96px固定）／結果カード | **無し**（開発画面は床を描かない） |
| **DevelopScreen 開発フェーズ** | 同上 `phase==='development'` | ボス・ジャンル背景・sparkle 等（社員ドット絵は無し） | 無し |
| **PlanScreen**（企画会議・設定選択） | `screen==='plan'`（OfficeScreen 上のオーバーレイ） | 開発前にジャンル/テーマ/規模を選ぶ画面。タイピング無し。社員は絵文字＋名前 | 背後に透ける |

- 「ゲーム実装以外のオフィス画面」＝**OfficeScreen**（待機・時間が裏で進む常設ステージ）。ここが要望①「デスクに座らず歩く」の対象。
- 「企画フェーズ」＝**DevelopScreen の planning フェーズ**（タイピングで企画書を埋める工程）。ここが要望②「ホワイトボード会議の図」の対象。※`PlanScreen`（企画会議＝設定選択）とは別物。

### 2-2. 歩行の足場（既存・本番未使用）

- `officeLayout.ts`：`walkSheet(folder, dir8)`（`/sprites/office/<folder>/walk_<dir8>.png`、992×124＝124×124×8コマ）、`WALK_FRAMES=8`、`isWalkable(nativeX, nativeY)`（`grid.walkable` セル集合）、`vectorToDir8(dx, dy)`（入力ベクトル→8方向量子化）、`standingSprite(folder, dir8)`。
- 歩行シートは6フォルダ全部に実在（`engineer`/`programmer_f`/`designer_m`/`designer_f`/`pr_m`/`pr_f`）。
- **本番（OfficeView）では未使用**。実使用は admin ツール `OfficeEditorTool.tsx`（`?walk`＝`/admin/layout`）のみ＝**歩行アニメの参照実装が既にある**（`vectorToDir8`/`walkSheet`/`WALK_FRAMES`/walkable判定の使い方）。
- occluder（遮蔽物）データと `BandedSprite` の帯分割は既存。歩き回ると社員が家具の手前/奥を横切るため、**歩行では occlusion 帯分割が実際に効く**（着席時より重要）。

### 2-3. 会議図の足場（既存・未描画）

- `state/types.ts`：`DEV_PHASE_META[phase] = { label, image }`。planning は `image:'planning'`。だが **`.image` は src 全体で一度も読まれていないデッドフィールド**（`label` のみ使用）。
- 対応アセット `public/phase/planning.png`（1536×1024）＝**ホワイトボード（GAME IDEA / CONCEPT）に社員5人が集まりアイデア出ししている1枚絵**。要望②の「みんなで集まってアイデア出ししている図」に完全一致。
- 兄弟画像 `public/phase/{development,testing,debugging,release,complete}.png`（各1536×1024）も同様に実在・未使用＝**全フェーズぶんのテーマ背景が揃っている**。

## 3. 目的（オーナーの言葉で1行）

**「オフィスに社員が“いて働いている”実感を出す」**。手段（歩行／会議図／どこまで凝るか）はこの1行への距離で採否を決める。凝ったモーションや自律AIは目的を超えるので持ち込まない。

## 4. やること（2フィーチャ）

### 4-A. 待機オフィスでランダム歩行（要望①）

- **対象画面**：OfficeScreen（`screen==='office'` を土台とする待機表示）。
- **やること**：在籍社員が**着席をやめてオフィス内を歩き回る**。各社員が walkable グリッド上のランダムな目標地点へ歩き、着いたら少し止まって（立ち／小休止）、また次のランダム地点へ。移動方向に応じて `walkSheet` の8方向を切替え、止まったら `standingSprite` を出す。
- **描画**：`OfficeView` の `SeatedEmployee` を「歩行する社員」に置換（席固定描画をやめる）。occlusion は既存 `BandedSprite`＋occluder で家具の前後を維持（`OfficeEditorTool` の実装を参照）。
- **動きの質 🔧**（§5-1）：全員つねに歩く／一部は止まって雑談ポーズ／速度・休止時間の叩き台。まず「ゆっくり歩いて時々止まる」を推奨。
- **設計（[[logic-architecture]] 準拠）**：移動は時間と乱数を持つ。**うろつきの状態遷移を core の純粋関数** `stepWander(state, dtMs, rng) → state`（席・目標・座標・向き・休止残りを進める）に切り出し、rng/clock を注入して unit テスト可能にする。View 側は `requestAnimationFrame` で dt を渡して描くだけ（`Date.now()`/`Math.random()` を View に直書きしない）。
- **判断ゲート**：ゲームロジック無変更（座標は表示専用。売上・進行に一切影響しない）。満席（6人）同時歩行でカクつかない。1280×720・スクロールなし。

### 4-B. 企画フェーズにホワイトボード会議の図（要望②）

- **対象画面**：DevelopScreen の planning フェーズ（タイピング画面）。
- **やること**：**既存 `public/phase/planning.png` を planning フェーズの背景/シーンとして表示**する（デッドフィールド `DEV_PHASE_META.planning.image` を実描画に繋ぐ）。「ホワイトボードに集まって会議している図」はこの1枚絵で成立＝**新規素材不要**。
- **「できる？」への答え**：**はい。しかも要望どおりの絵が既に repo にあり**（`phase/planning.png`＝ホワイトボード会議）、繋ぐだけ。
- **表示方法 🔧**（§5-2・レイアウトが no-scroll でみっちりのため要判断）：
  - **案(a)（推奨）背景レイヤー**：planning 中央の単色背景（`#05080c`）を会議図に差し替え、暗めにディム＋入力パネル（紙色 `PLAN.paper` の不透明カード）を手前に浮かせる。レイアウト改変ゼロ・可読性は既存パネルの不透明背景で担保（[[feedback_dark_bg_light_text]]）。
  - **案(b) 上部シーン帯**：ヘッダー付近に会議図の帯を1本置く。既存要素を圧縮する必要あり（no-scroll ゲートに注意）。
  - **案(c) フェーズ導入の一枚**：planning に入った瞬間だけ全面表示→数秒でUIへ。演出強いが打鍵開始が遅れる。
  - まず案(a)で差し込み、可読性を実機確認して確定。
- **発展（ほぼ無料）🔧**（§5-3）：同じ仕組みで `development/testing/debugging/release/complete` の各 `phase/*.png` も対応フェーズ背景に繋ぎ、**全フェーズにテーマ背景**を与える。planning だけでなく開発全体の画面充実に効く。本版でやるかは §5-3 で判断。
- **判断ゲート**：純表示。タイピング入力欄・お題・判定に無干渉。可読性（濃色地に暗字を作らない）。1280×720・スクロールなし。

## 5. 未決点（🔧・オーナーレビューで確定）

| # | 論点 | 叩き台／推奨 |
|---|---|---|
| 5-1 | 歩行の質（速度・休止・雑談ポーズ） | **「ゆっくり歩いて時々止まる」を推奨**。全員常時歩行から始め、雑談ペアや小休止は手応えを見て足す |
| 5-2 | 会議図の出し方（planning） | **案(a)＝背景ディム＋入力パネル手前**を推奨（レイアウト改変ゼロ・可読性担保）。実機で可読性確認して確定 |
| 5-3 | 他フェーズ背景も繋ぐか | **本版で全6フェーズ繋ぐのを推奨**（同じ実装でほぼ無料・画面が一気に充実）。planning だけに絞る選択も可 |
| 5-4 | 実装順（下記 §7 と対応） | **B（会議図）を先・A（歩行）を後**を推奨。B は素材ゼロ・ロジックゼロ・数行で高い視覚効果＝早く見せられる。A は移動ロジック＋occlusion で重い |
| 5-5 | 着席の扱い | 旧「着席タイピングアイドル」は**廃止**（office が歩行になるため）。将来 office に「作業席」を再導入する版で検討 |

## 6. やらないこと（この版のスコープ外）

- **自律AI・凝ったモーション**（会話バブル、経路探索の高度化、席取り合い等）。うろつきは単純なランダム目標で十分。
- **状態連動の作り込み**（バグ発生で慌てる、締切前は急ぐ等）。まず基本の2状態の手応えを見てから別版。
- **新規ドット絵素材の発注**（歩行・会議図とも既存で足りる）。会議図を静止1枚絵でなくドット社員の集合アニメにするのは新規大量発注になるため本版ではやらない。
- **south 向き・座席レイアウトの変更、着席アイドルの新規制作**（§5-5）。
- **ゲームロジック**（品質・売上・経済・タイピング判定・フェーズ・実績）の変更。roadmap 判断ゲート最遵守。
- レイアウト骨格・1280×720固定・スクロール禁止の変更。

## 7. 完成条件（検証チェックリスト＝[3]検証の消し込み）

推奨実装順：**Stage B（会議図）→ Stage A（歩行）**（§5-4）。各 Stage 完了時に検証を消し込む。

### Stage B（会議図・要望②）

機械検証:
- [ ] 4点セット（build / test:unit / test:ui / test:e2e）全緑。ロジック無改修で既存テストが緑のまま。
- [ ] planning フェーズで `phase/planning.png` が実際に描画される（ui or e2e で背景要素の存在を確認）。

実機検証（[[playwright-verify]]）:
- [ ] `screen==='develop'` の planning フェーズをブラウザで開き、**ホワイトボード会議の図が背景に出ている**ことをスクショで確認。
- [ ] かな入力欄・ローマ字欄・お題が**会議図の上でもはっきり読める**（可読性ゲート／濃色地に暗字なし）。
- [ ] 実際にキーを打って企画フェーズが問題なく進む（背景追加が入力の邪魔をしない）。
- [ ] 1280×720・スクロールなし・表示崩れなし。
- [ ]（§5-3採用時）他フェーズでも対応する `phase/*.png` が出る。

### Stage A（ランダム歩行・要望①）

機械検証:
- [ ] `stepWander` の unit テスト（rng/clock 注入・境界値：目標到達で次目標へ／walkable 外を目標にしない／休止残りの減算）。testing-rules の unit=node 層。
- [ ] 4点セット全緑。座標が表示専用でゲーム state に影響しないこと（既存ロジックテストが緑のまま＝副作用ゼロの証明）。

実機検証（[[playwright-verify]]・**本物の描画を目視**）:
- [ ] OfficeScreen（待機）をブラウザで開き、**社員が着席せず歩き回っている**ことをスクショ/連続観察で確認。
- [ ] 歩行が walkable 内に収まり、家具の**前後の遮蔽（occlusion）が正しい**（家具にめり込まない・すり抜けない）。
- [ ] 満席6人同時歩行で**カクつき・処理落ちが無い**。
- [ ] 1280×720・スクロールなし・表示崩れなし。
- [ ]（オーナー確認待ちラベル）動きが「生きている／働いている」に見えるかの**体感**は自分で判定不可＝レビューに回す（[[feedback_verification]] / dev-flow [3]-4）。

## 8. 技術メモ

- 変更ファイル（想定）：
  - **Stage B**：`DevelopScreen.tsx`（planning 中央に `phase/planning.png` を背景レイヤーとして追加、案(a)なら数行）。任意で `state/types.ts` の `.image` を実パス（`/phase/<image>.png`）に使う小ヘルパ、または `DevelopScreen` 側でパス生成。§5-3 採用時は他フェーズ Center にも同様の背景を適用。
  - **Stage A**：`src/core/officeWander.ts`（新規・`stepWander` 純粋関数＋型）、`OfficeView.tsx`（`SeatedEmployee`→歩行描画へ。RAF ループ・`SpriteAnimation` か直接 background-position で walk シート再生・`BandedSprite` で occlusion）、必要なら `officeLayout.ts` に補助（ランダム目標セル抽選のヘルパ等）。参照実装＝`OfficeEditorTool.tsx`。
- **ロジック層（`src/core` の既存ゲーム計算／`src/state`）は触らない**（[[logic-architecture]]）。歩行の座標・向き・休止は表示専用の別 state（core に純粋 stepper だけ置く）。CSS/RAF の周期以外で `Date.now()`/`Math.random()` を新規に持ち込まない（stepper には rng を注入）。
- テスト（[[testing-rules]]）：Stage A は `stepWander` に unit 必須（3層戦略の unit=node）。Stage B はロジック追加が無いので unit 不要、描画繋ぎ込みは ui/e2e か実機目視。
- 素材（[[office-visual-design]]／[[pixelart-prompting]]）：**本版は新規発注ゼロ**（歩行 `walk_*.png`・会議図 `phase/planning.png` とも既存）。将来 south 歩行や着席作業席を足す時のみ発注（承認制）。

## 9. 参照

- タスク: [tasks.md](./tasks.md)
- 上位計画: `docs/roadmap.md` §v0.26
- スキル: [[game-design]]（最上位の目的）／[[office-visual-design]]（オフィス規格）／[[game-ui-design]]（planning画面のUI規格）／[[playwright-verify]]（実機検証）／[[logic-architecture]]（層分離・rng注入）／[[testing-rules]]（3層）
- 足場コード: `OfficeView.tsx`（`SeatedEmployee`/`BandedSprite`）／`OfficeEditorTool.tsx`（歩行参照実装・`?walk`）／`officeLayout.ts`（`walkSheet`/`isWalkable`/`vectorToDir8`）／`DevelopScreen.tsx`（planning Center）／`state/types.ts`（`DEV_PHASE_META`）
- 既存アセット: `public/sprites/office/<folder>/walk_<dir8>.png`（歩行）／`public/phase/planning.png` ほか（会議図・全フェーズ背景）
