# v0.10 実装タスクリスト

> 凡例： `[x]` 実装済 / `[~]` 部分実装 / `[ ]` 未着手
> 優先度： **P0**（コア体験 / ゲームに見えない致命的欠落）/ **P1**（中毒性・モチベ強化）/ **P2**（磨き）/ **P3**（ローンチ整備）
> v0.10 で変えたこと: 時間進行（週単位）／経済の現実化（桁修正・固定費）／品質4要素リテイク（キャラ50%）／タイピング長尺化／設備投資発火
> 仕様: [spec.md](./spec.md) / 診断: [diagnosis.md](./diagnosis.md)

---

## 継承タスク（v0.9 から未完）

> v0.9 tasks.md で `[ ]` または `[~]` のまま残っている項目。v0.10 でも引き続き必要。

### v0.9 中核未完
- [ ] **B-3末尾** 開発中の社員ロック（他作品アサイン不可）【P1】※ v0.10 で複数ライン未実装でも、単一ライン中の表示固定として実装
- [ ] **C末尾** 社員のアサイン枠数を規模解放に連動（mini=1, mobile=2, indie/hit/aaa=3）【P1】
- [ ] **F末尾** バグ修正完了時の緑フラッシュ演出【P2】
- [ ] **G** リリース演出（CodeEditor の `building` モード発火・`Compiling sources...` ビルドログ）【P2】

### v0.8 から積み残しの主要項目（v0.10 で関連する優先のみ抜粋）
- [ ] **設備投資（恒常ボーナス）**【P1】※ v0.10 §6 / diagnosis §6 で再優先化
- [ ] ライバル会社の同時進行表示【P2】
- [ ] 「あと¥◯◯で次の解放」目標表示【P1】※ 桁修正と一緒に対応
- [ ] オフィス見た目の段階変化【P2】
- [ ] 主要ユーティリティのユニットテスト（metascore, sales, computeQuality, …）【P2】

---

## 追加タスク（v0.10）

### A. 時間進行（週単位） 【P0】

> spec.md §3 対応 / diagnosis §2-3, §3「時間の不在」を解消するコア機能

- [x] **A-1** `state/types.ts` に `GameDate = { year: number; month: number; week: number }` 型を追加
- [x] **A-2** `state/types.ts` の `Persisted`（`utils/storage.ts`）と `gameStore` に `currentDate: GameDate` を保持
- [x] **A-3** 日付ユーティリティ `utils/gameDate.ts` を新設（`addWeeks(date, n)` / `formatDate(date)` → `"2026年4月 第3週"` / `weeksBetween(a, b)` / `monthChanged(prev, next)`）※ types.ts 内に内包
- [x] **A-4** `data/scales.ts` に `requiredWeeks` を追加（mini=8 / mobile=12 / indie=20 / hit=28 / aaa=36）
- [x] **A-5** `gameStore` に `tickWeek()` アクション（1週進める＋月初判定＋固定費発生のフック呼び出し）
- [x] **A-6** 開発中タイマー：標準速度 **リアル 7.5 秒 = 1 週**。`useEffect` ベースで 7500ms ごとに `tickWeek()` を発火
- [x] **A-7** 開発開始時 `currentProject` に `targetWeeks`（規模の `requiredWeeks` を時短要素で調整）と `elapsedWeeks` を保持
- [x] **A-8** 完了判定：`elapsedWeeks >= targetWeeks` または `doneLoC >= requiredLoC` の早い方で完了（タイピング完了時点で完成週確定）
- [x] **A-9** 開発開始ゲーム開始時の初期日付 `2026年1月 第1週` を定数化
- [x] **A-10** タイピング非開発中もアイドル進行（OfficeScreen に「⏩ 1 週進める」PixelButton、300ms スロットル）
- [ ] **A-11** ユニットテスト：`addWeeks`, `formatDate`, `monthChanged` の境界条件（12月→1月、第4週→第1週）— vitest 導入時に対応

### B. 経済システム（桁修正・固定費・開発費） 【P0】

> spec.md §4 / diagnosis §5「経済の数値設計の説得力不足」を解消

- [x] **B-1** `data/scales.ts` の `baseUnit` を v0.10 桁感に書き換え（検証スクショで ¥500万・¥1.98億等の桁を確認）
- [x] **B-2** `data/scales.ts` の `unlockCost` を新桁感に書き換え
- [x] **B-3** `data/scales.ts` に `devCost`（mini ¥10万）を追加 — Release 画面で確認
- [x] **B-4** `data/scales.ts` に `monthlyRent`（mini ¥5万/月）を追加 — Office/Plan 画面で確認
- [~] **B-5** `state/types.ts` の `Employee` に `monthlyWage` 追加 — `sumMonthlySalaries` 実装あり（旧 wage 互換維持）
- [~] **B-6** `gameStore` に `tickMonth()` → 給与＋賃料 — `lastFixedCost` 経由で HUD に出るが月次決算の発火タイミングは検証未
- [x] **B-7** `gameStore` に `lastFixedCost`（≒ lastMonthlyCost）— Office 画面で「先月の収支」欄として確認
- [x] **B-8** 開発開始時に `devCost` を `funds` から前払い — Release 画面の利益計算に -¥10万として反映
- [~] **B-9** `computeRevenue` の `baseUnit` 仕様変更 — Release 画面で初動売上 ¥39.7万 / 販売プール ¥158.9万 出現を確認
- [x] **B-10** ヒット帯の閾値（70=ヒット ×4 / 85=大ヒット ×10 / 95=神ゲー ×30）— `metascore.ts` `hitTierMultiplier`
- [~] **B-11** 神ゲーガチャ 5% — D-9 と統合（演出のみ確認、実プロブ未検証）
- [~] **B-12** 資金 0 でゲームオーバー画面 — `GameOverModal` 実装。借金枠は Phase 3 で追加予定
- [x] **B-13** 利益計算ユーティリティ `utils/profit.ts`（売上 − 開発費 − 期間月数 × 月固定費）を新設 — テストは K-4 で対応

### C. 品質計算式リテイク（4要素ウェイト） 【P0】

> spec.md §2 / diagnosis §1-3, §2-2「採用が効かない」を解消する最重要タスク

- [x] **C-1** `utils/metascore.ts` の `computeQualityV10` を `releaseWork` から呼び出し（旧 `computeQuality` から切替済み）
- [x] **C-2** `utils/character.ts`（新設）：`computeCharacterScore({ assignedEmployees, scale, selectedCategories })` 実装
- [x] **C-3** `utils/metascore.ts` `computePerformanceScore` を 0..100 スケールに拡張（WPM/コンボ/精度/バグなし）
- [x] **C-4** `utils/affinity.ts` 新設：`computeGenreAffinityScore` で compat × categoryAffinity を 0..100 正規化
- [~] **C-5** トレンド補正は `computeMetascore` 内で従来通り適用、新規開拓 `pioneerMul` は `computeRevenue` で乗算。`workBreakdown.trendMul/pioneer` も保存
- [x] **C-6** 運乱数 0.9〜1.1 と神ゲーガチャ ×1.5 は `computeQualityV10` 内で適用（既存実装）
- [x] **C-7** `Work.breakdown` を新型に拡張（`charPower/genreAffinity/performance/luck/luckMultiplier/isGodGame/trendMul/pioneer`）。旧フィールドは optional で互換
- [ ] **C-8** ユニットテスト：4要素ウェイトの組合せで「キャラのみ強い時」「演技のみ強い時」のスコア順位を assert（K-5 と統合）

### D. UI 桁数対応 / 表示刷新 【P0】

> spec.md §5 / diagnosis §2-4「数値の説得力不足」を解消

- [x] **D-1** 通貨フォーマッタ `utils/format.ts` に `formatYen(value)` を追加（¥1兆2,345億 等の単位付き表記）
- [x] **D-2** `OfficeScreen`（PixelStatusBar）の funds 表示を `formatYen` に置換
- [x] **D-3** `OfficeScreen` に **「今月の固定費」「先月の収支」** パネルを追加（PixelWindow）
- [x] **D-4** `OfficeScreen` の累計売上を兆円・億円単位で表示
- [x] **D-5** `LibraryScreen` の作品売上カードを `formatYen` に置換
- [x] **D-6** `ReleaseScreen` に **「利益計算ブレイクダウン」**（売上 − 開発費 − 固定費 = 利益）を新設
- [x] **D-7** `ReleaseScreen` に **ROI %** を表示（利益 / 開発費 × 100）
- [x] **D-8** `ReleaseScreen` で 4要素ウェイトの新内訳を表示（キャラ50% / 相性25% / 演技15% / 運10% の SVG レーダー）
- [x] **D-9** 神ゲーガチャ判定時の専用演出（背景フラッシュ＋テキスト）

### E. PlanScreen 予想表示 【P0】

> spec.md §5-1 / diagnosis §1-5「次に何を目指せばいいか分からない」を緩和

- [x] **E-1** 規模選択 UI に **「予想開発費」** を表示（`scale.devCost` を `formatYen`）
- [x] **E-2** 規模選択 UI に **「予想開発期間」**（規模の `requiredWeeks` を月数換算で表示、例：「約 6 ヶ月」）
- [x] **E-3** アサイン社員＋カテゴリ組合せから **「予想売上レンジ」** を粗く計算して表示（最低/中央/最高の3点）
- [x] **E-4** 「予想売上 − 開発費 − 固定費」で **「予想利益」** を出して赤字なら警告色（`computeProfitForScale` 利用）

### F. DevelopScreen 時間表示 【P0】

> spec.md §5-2 / §3-2

- [x] **F-1** 画面上部に **ピクセル風カレンダー**コンポーネント `components/PixelCalendar.tsx` を新設（`2026年4月 第3週` 表示）※ PixelWindow 内インライン実装 — 検証 OK
- [x] **F-2** 進捗バーを「経過週数 / 想定週数」に置換（既存の LoC バーは併記 or 置換）— 検証 OK（経過 0週 / 予定 8週 表示）
- [x] **F-3** 月初（次月第1週移行時）に **固定費発生テロップ**（給与・賃料）を 1.5 秒表示
- [x] **F-4** バグ発生時に **「+1 週」** のテロップ表示＋ `targetWeeks` を +1
- [x] **F-5** 時短発生（WPM 100/150/200 で -1/-2/-3 週）テロップ＋必要週数調整（`applyTimeShortcut`）
- [x] **F-6** 完成時に **「開発期間 X ヶ月 Y 週」** のサマリ表示（`work.developWeeks` + `formatWeeks`）

### G. タイピング長尺化 【P1】

> spec.md §1-2 / §3-1 / diagnosis §4「タイピング体験そのものの薄さ」を解消

- [ ] **G-1** `data/codeSnippets.ts` のスニペット数を mini=30行 / mobile=50行 / indie=80行 / hit=120行 / aaa=180行 想定で増量
- [ ] **G-2** タイピング時間の目標値を spec §3-1 表に合わせて調整（mini 60秒 / mobile 90秒 / indie 150秒 / hit 210秒 / aaa 270秒）
- [ ] **G-3** （オプション）タイピングを **複数フェーズ**（企画 → 設計 → 実装 → テスト）に分割（規模に応じてフェーズ数 2〜4）
- [ ] **G-4** フェーズ遷移時のアニメーションと小報酬（コンボ持続ボーナス等）
- [ ] **G-5** 長尺化に伴う集中力配慮：休憩区切り（規模が hit/aaa の時のみ短いインターバル）

### H. 設備投資の発火 【P1】

> diagnosis §6「投資する」フェーズの欠落を解消 / 既存 `src/data/equipment.ts` を活用

- [ ] **H-1** 既存 `data/equipment.ts` のデータ定義を読み込んで OfficeScreen に **「設備投資パネル」** を追加
- [ ] **H-2** 各設備に効果を実装（例：高性能PC = WPM +10% / 防音室 = 集中時間 +30秒 / マーケ部 = 売上 +10%）
- [ ] **H-3** 設備購入アクション `gameStore.buyEquipment(id)` を追加（`funds` 減算＋ `ownedEquipment: string[]` 追加）
- [ ] **H-4** セーブマイグレーション v4→v5（`ownedEquipment` 初期空配列）
- [ ] **H-5** 設備の効果を品質・売上・期間計算に反映（hooks 用ユーティリティ）

### I. 採用ガチャ強化（中期モチベ） 【P1】

> diagnosis §1-3「採用ガチャの感動なし」を解消

- [ ] **I-1** 採用候補に **レアリティ表示**（N / R / SR / SSR）を導入（power と specialty 数で決まる）
- [ ] **I-2** SR/SSR の候補出現確率を 5% / 1% に設定（既存 newCandidate 拡張）
- [ ] **I-3** SR/SSR 引いた時の演出（PixelModal でフルスクリーン演出）
- [ ] **I-4** 候補リストに「給与」「期待寄与（カテゴリ別）」を表示して採用判断を支援

### J. データ移行・後方互換 【P0】

> spec.md §6 / 既存セーブを壊さない

- [x] **J-1** `utils/storage.ts` の `KEY` を `typing-factory:v5` にアップグレード（v4 を LEGACY_KEY_V4 として保持）— 既存実装
- [x] **J-2** `migrateFromV4` を実装：funds/lifetimeRevenue/library 金額 ×10,000、currentDate 付与 — 既存実装
- [x] **J-3** マイグレーション後の `Persisted` を `version: 5` で再保存 — 既存実装
- [x] **J-4** マイグレーション失敗時のフォールバック（try/catch で null 返却 → defaults() に） — 既存実装
- [ ] **J-5** ユニットテスト：v0.9 セーブ→v0.10 マイグレーション後の桁数・初期日付を assert

### K. テスト整備 【P0/P2】

- [ ] **K-1** 既存 `tests/smoke.spec.ts` の売上桁期待値を v0.10 仕様に合わせて修正【P0】 ※ 検証で全 8 件 FAIL（「オフィスへ」ボタン消失等で UI 互換破綻）
- [ ] **K-2** 既存 `tests/office-screenshot.spec.ts` の funds 表示文字列を新フォーマットに合わせて修正【P0】 ※ 検証で FAIL（同上）
- [ ] **K-3** `utils/gameDate.ts` のユニットテスト【P0】
- [ ] **K-4** `utils/profit.ts` のユニットテスト【P0】
- [ ] **K-5** `utils/character.ts`（キャラ能力スコア）のユニットテスト【P1】
- [ ] **K-6** マイグレーション v4→v5 のユニットテスト【P0】
- [ ] **K-7** E2E：ゲーム開始 → 開発開始 → 週進行 → リリース → 利益確認のスモーク【P1】

### L. 演出強化 【P2】

> diagnosis §4-3 / §7-7「演出強化」

- [ ] **L-1** コンボ 50/100/200 到達時に画面エフェクト（フラッシュ・ピクセルパーティクル）
- [ ] **L-2** バグ修正完了時の緑フラッシュ（v0.9 継承タスク F末尾）
- [ ] **L-3** 月初固定費発生時の効果音
- [ ] **L-4** 神ゲーガチャ当選時の専用 BGM/SE と背景アニメ

### M. 多層モチベ設計 【P1】

> diagnosis §2-5「モチベ設計の単層構造」

- [ ] **M-1** 中間実績の追加（神ゲー 1 本 / 累計売上 1 億 / 累計売上 1 兆 / 全カテゴリ解放 / 設備フル装備）
- [ ] **M-2** 「あと¥XX で次の解放」を OfficeScreen に常時表示（v0.8 継承）
- [ ] **M-3** 中期目標カード（PixelWindow）：「3 ヶ月以内に黒字化」「半年で indie 解放」等
- [ ] **M-4** 殿堂入り画面（v0.9 から継承）：歴代最高売上・最高メタスコアを並べる

### N. ドキュメント保守 【P3】

- [x] **N-1** v0.10 spec.md を作成
- [x] **N-2** v0.10 diagnosis.md を作成
- [x] **N-3** v0.10 tasks.md を作成（このファイル）
- [ ] **N-4** 実装進捗に応じてセクションを `[x]` に更新
- [ ] **N-5** 大きな差分が出たら `docs/v10/gaps.md` を新設
- [ ] **N-6** ルート `README.md` から v0.10 spec.md へのリンクを更新

---

## O. Phase 4 検証で発覚した補修タスク（2026-06-08 workflow w327lwfx1 完了後）【P0】

- [ ] **O-1** `tests/smoke.spec.ts` を v0.10 トップ（OfficeScreen）から始まる UI に書き換え（「オフィスへ」ボタン期待→「計画」アイコンクリック等）
- [ ] **O-2** `tests/office-screenshot.spec.ts` を v0.10 用に書き換え（h1 期待値・セレクタ・初期画面差し替え）
- [ ] **O-3** `tests/smoke.spec.ts` の localStorage シードキーを `typing-factory:v4` → `typing-factory:v5` に変更、データ構造も v0.10 桁感（×10,000）に
- [x] **O-4** OfficeView のスプライト 404 修正：既に emoji fallback 実装済み（🪟/🪴/🖥️/💺/🧑‍💻）。素材未到着でも黒くならない
- [ ] **O-5** `npx playwright test` 全件 GREEN 確認（v10-screens.spec.ts + 既存 smoke + office-screenshot）
- [x] **O-6** C-1 を [x] へ更新（`releaseWork` を `computeQualityV10` に切替）
- [x] **O-7** B-10（ヒット帯倍率 70/85/95 × 4/10/30）を `metascore.ts` `hitTierMultiplier` に実装
- [ ] **O-8** B-12（資金 0 → ゲームオーバー）を実装。借金システム（spec §9-2）とセットで
- [x] **O-8** B-12（資金 0 → ゲームオーバー）の最小実装。借金枠は Phase 3 で
- [x] **O-9** D-2 / D-5 / D-8（StatusBar に formatYen、Library 売上 formatYen、Release のレーダー）完成
- [x] **O-10** F-5（-X 週テロップ）/ F-6（developWeeks 表示）完成。F-3/F-4 は既存実装で発火

### O-11 以降：2026-06-08 評価レポート（notes/evaluation-post-p0.md）で発覚した追加課題

- [ ] **O-11** ⚠ **localStorage シード読込問題**（評価 §2-2）：Playwright で `typing-factory:v5` キーに seed を入れても画面が defaults を表示する。storage.ts のロード時スキーマ検証 or マイグレ処理で seed が無効化される疑い。seed 構造を Persisted 型に厳密に合わせるテストを追加
- [ ] **O-12** ⚠ **Library 画面への遷移失敗**（評価 §2-4）：PixelMenuBar の「作品」クリックが効かないかセレクタ問題。Playwright か実装側の判定見直し
- [ ] **O-13** OfficeView の emoji fallback（O-4 で実装済とのこと）が**実機ブラウザで効いていないように見える**：スクショで黒い枠表示が残る。キャッシュか、CSS 適用範囲の問題か再確認
- [ ] **O-14** 資金表示の桁数フォーマッタ統一：OfficeScreen は `¥1500万`、PlanScreen は `¥15,000,000` と混在。`formatYen` を全箇所に
- [ ] **O-15** OfficeScreen の累計売上 ¥0 / 最高WPM 0 等の「未経験時サマリ」見直し：「—」「未挑戦」のような表示にする
- [ ] **O-16** ピクセルフォント（DotGothic16）の数値 monospace 化：PlanScreen の `¥15,000,000` などで数字フォントが揺れる
- [ ] **O-17** vitest 導入：A-11/J-5/C-8/K-3/K-4/K-5 をまとめて単体テスト化（package.json scripts 追加）

---

## 評価レポート

- **2026-06-08 P0 完了直後**: [notes/evaluation-post-p0.md](./notes/evaluation-post-p0.md)
  - 良点 5 件（時間 PixelWindow / 固定費パネル / 予想表示 / 桁数 / ピクセル UI 完成度）
  - 問題点 5 件（スプライト 404 ※実機確認要 / シード読込 / 既存テスト / Library 遷移 / Collection 発見 0）
  - プロデューサー判断：P0 のコアは ◎、表面の素材と CI が ×

---

## 実装順序の推奨（diagnosis §7 と spec §7 を統合）

1. **J（マイグレーション骨格）→ A（時間進行）→ B（経済桁）** ：基盤を v0.10 仕様に切り替える【P0】 ✅ 完了
2. **C（4要素品質）→ D（UI 桁数）→ E（Plan 予想）→ F（Develop 時間表示）** ：コア体験を v0.10 化【P0】 ✅ 完了
3. **O（補修）→ K（テスト修正）** ：既存テストを通す【P0】 ← **次にやる**
4. **G（タイピング長尺化）→ H（設備投資）→ I（採用ガチャ）→ M（多層モチベ）** ：中毒性強化【P1】
5. **L（演出強化）** ：磨き【P2】

---

## 関連ドキュメント
- 仕様: [spec.md](./spec.md)
- 診断: [diagnosis.md](./diagnosis.md)
- v0.9 旧仕様: [../v09/spec.md](../v09/spec.md) / [../v09/tasks.md](../v09/tasks.md)
