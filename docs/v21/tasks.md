# v0.21 実装タスク

> 仕様: [spec.md](./spec.md)　凡例: `[x]` 実装済 / `[~]` 部分実装 / `[ ]` 未着手
> 規約: logic-architecture / testing-rules / dev-flow スキル準拠

## 継承タスク（前版から）

- [ ] オーナー実プレイで「作業感」が減ったかを確認（v0.19〜v0.20から継続。本版とは別軸）

## 追加タスク（このバージョン）

### 0. 下ごしらえ: ジャンル・テーマの拡充と開発ツール（機能Aの購入対象を厚くする）— 完了

> オーナーの「ジャンル・テーマを今より増やせる？」から派生。購入できる対象が少ないと
> 機能A（先行投資購入）自体が成立しないため、先に素材を増やした。

- [x] 新ジャンル15種を追加（ストラテジー/スポーツ/サバイバル/カードゲーム/タワーディフェンス/
      パーティーゲーム/脱出ゲーム/恋愛アドベンチャー/ボードゲーム/クイズ/プラットフォーマー/
      ノベルゲーム/育成ゲーム/釣り/FPS）＝ 12種 → **27種**
- [x] 新テーマ13種を追加（学校/アイドル/侍/キャンプ/探偵/遊園地/南国リゾート/図書館/幽霊屋敷/
      サーカス/都市伝説/サイバーパンク/音楽フェス）＝ 15種 → **28種**
- [x] 各ジャンルの打鍵スニペット・`GENRE_TICKETS`・`GENRE_PLAN_CONTENT`・`PREFIX_BY_GENRE`・
      `GENRE_VERBS`/`GENRE_CLASSES`・`MISSION_FLAVORS` を執筆（genre-theme-content スキル準拠）
- [x] 各テーマの `THEME_NOUNS`/`THEME_PROPS`/`NOUN_BY_THEME` を執筆
- [x] PixelLab で新ジャンル15種のスプライト＋背景（計30枚）を発注・配置
- [x] 既存背景の作り直し（`shooter`/`fighting`/`roguelike`/`rhythm`/`horror`/`fps`/`fishing`）
      — 左右が透明でジャンル色の「帯」が出ていた・題材がジャンルに合っていなかったものを是正
- [x] `/admin/images`・`/admin/compat` を新設（`src/admin/`）。本編と同一コンポーネント・
      同一幅（実測588px）で素材と相性倍率を検証できる開発ツール
- [x] スプライト表示を 40px → 64px に拡大＋`WIP_HEIGHT` 74 → 110（素材が64/128混在で
      非整数倍表示になり絵が潰れていた問題の是正。1280×720 ではみ出し0を実測確認）
- [x] 派生バグ修正：`compatBg`/`compatFg` の「神」閾値が 1.7 のままで、v0.16 で `getCompat` の
      上限が 1.6 に圧縮されて以降「神」判定が理論上出せなくなっていた → 1.6 に是正
- [x] 派生バグ修正：`storage.ts` の `defaults()` が `unlockedGenres`/`unlockedThemes` を
      ハードコードしており、新規stage1素材が新規プレイヤーに解放されなかった →
      `INITIAL_GENRE_IDS`/`INITIAL_THEME_IDS` から導出するように是正
- [x] 4点セット（build / unit 245 / ui 14 / e2e 7）全緑
- [ ] `camping` のタグを `[chill, gourmet]`（当初案）→ `[chill, daily]` に変更した件の追認 →
      オーナー確認待ち（当初案だと `puzzle`/`simulation` との相性が 1.30 になり、
      「stage1 の相性は 0.85〜1.25 に収める」既存のバランスガードテストを破るため）
- [ ] 新27ジャンルを実プレイして企画→開発の文言・素材が破綻していないか確認 → オーナー確認待ち

### 1. 機能A: ジャンル・テーマの先行投資購入（spec §4-A）— 完了

- [x] `balance.ts`に`INVEST_CONFIG`（基礎額 stage2=¥30万/3=¥300万/4=¥3000万＋公比`priceGrowth`=1.8）を追加
- [x] 価格を「買うほど高くなる」逓増カーブに（オーナー指示 2026-07-19）：`価格 = 基礎額 × 1.8^(先行購入数)`。
      購入回数`investPurchaseCount`を永続フィールドとして追加（storage/boot/gameStore/reset）。実機でリロード後も保持を確認
- [x] ワンクリック即購入をやめ、確認モーダル（PixelModal）を挟む（誤操作防止・オーナー指示 2026-07-19）
- [x] 初期解放（stage 1）を 3ジャンル・3テーマに戻す（オーナー指示 2026-07-19。外した分は stage 2 へ→購入対象が増加）
- [x] ~~`gameStore`に購入済み永続フィールド（`purchasedGenres`/`purchasedThemes`）を追加~~
      → **設計変更**：別フィールドは作らず、既存の`unlockedGenres`/`unlockedThemes`（既にセーブされる
      単調増加のunion配列）へ直接追加。購入後は自動解放分と同一扱いというspec §4-Aの方針と一致し、
      永続化も既存の merge ロジックで自動。`computeStageUnlocks`は無改修。spec §7も同旨に更新済み
- [x] 購入価格・可否判定を純粋関数として`core/invest.ts`に切り出し（`investPriceForStage`/`canBuyUnlock`）
- [x] `gameStore`に`buyGenre`/`buyTheme`アクション（資金チェック→減算→解放配列に追加）
- [x] 企画画面（PlanScreen）に購入UI（`LockedShop`：既定折りたたみ「🔒未解放を購入(N)」→展開で鍵＋価格）
- [x] 自動解放済み素材は購入UIに出さない（`GENRES.filter(g => !unlockedGenres.includes(g.id))`）
- [x] unitテスト：価格境界（stage1=null/2/3/4）・資金ちょうど/不足の境界・解放済み除外（`core/invest.test.ts` 7件）
- [x] 4点セット（build/unit 254/ui 14/e2e 7）＋Playwright MCP実機検証：
      レース¥30万・学校¥30万を実クリック購入→資金がちょうど-¥30万→即選択行に移動→未解放カウント減少を実測。
      ¥800万素材が資金不足でグレーアウトも確認。1280×720：ショップ閉で overflow 0
- [ ] ショップ展開時は左パネル内スクロールが要る（既定は閉。左パネルは元々overflow:auto）→ 提示方法の要否 オーナー確認待ち
- [ ] 未解放の全ジャンル/テーマ名が購入UIで見えるようになる（v0.10「未解放は隠す」の反転）→ 意図どおりか オーナー確認待ち
- [ ] 価格の最終チューニング（叩き台。進行シミュレーションで調整）→ オーナー判断待ち

### 2. 機能B: 社員研修（お金でexp付与）（spec §4-B）— 着手保留（オーナー指示 2026-07-15）

- [ ] `core/growth.ts`から単一社員向け`applyExpGain`を切り出し（`applyReleaseGrowth`と共有）
- [ ] `gameStore`に研修アクション（資金チェック→減算→`applyExpGain`呼び出し）を追加
- [ ] レベルキャップ到達済み社員には研修不可のガードを追加
- [ ] TeamStatus（社員一覧）に研修ボタンUIを追加
- [ ] unitテスト：`applyExpGain`のレベルアップ境界（複数レベル一気/levelCap到達で頭打ち）
- [ ] 4点セット＋Playwright MCP実機検証（研修→exp/level/power/wage反映を実測）

### 3. 判断ゲート・検証（spec §8-9）

- [ ] 進行シミュレーションでの再検証方法を決定（自動テスト化 or 手動確認）
- [ ] spec §9 検証チェックリストの消し込み

## 積み残し・スコープ外（次版検討）

- オフィス設備（備品）投資（equipment.ts活用判断）
- REFRESH_COSTとの統合（v0.22採用ガチャで判断）
- 上位研修の階段設計
