# v0.9 実装タスクリスト

> 凡例： `[x]` 実装済 / `[~]` 部分実装 / `[ ]` 未着手
> v0.9 で変えたこと: ポリッシュ廃止／4レバー品質計算／開発カテゴリ／社員アサイン／コード雰囲気エディタ
> 仕様: [spec.md](./spec.md)

---

## A. ポリッシュ廃止（破壊的変更）

- [x] **A-1** `state/types.ts` の CurrentProject から `polishLoC` / `comboBonus` / `polishBoostRemainingSec` を削除
- [x] **A-2** `state/gameStore.ts` の `addPolishLoC` / `applyComboToPolish` / `buyAdPolishBoost` アクションを削除
- [x] **A-3** `utils/metascore.ts` の `polishToQuality` を削除
- [~] **A-4** `features/polish/PolishScreen.tsx` を **stub化**（rm 不可のため `export const PolishScreen = (): null => null;` のスタブを残置）
- [x] **A-5** `state/types.ts` の Screen 型から `'polish'` を削除
- [x] **A-6** `App.tsx` の polish ルーティングを削除
- [x] **A-7** `finishDevelopment` 完了時の遷移先を `'polish'` → `'release'` 直行に変更
- [x] **A-8** Playwright テストの「ポリッシュ中」期待を削除/更新

---

## B. 4レバー品質計算（中核）

### B-1. 開発カテゴリ
- [x] `data/categories.ts` を新設：6カテゴリ定義（id/name/emoji/genreAffinity/themeAffinity）
- [x] `state/types.ts` の `CurrentProject` に `selectedCategories: CategoryId[]` 追加
- [x] `state/gameStore.ts` の `startProject` で 3カテゴリを受け取る
- [x] アンロック設計：初期3カテゴリ → リリース 5/10/20 本で +1 ずつ解放
- [x] `state` に `unlockedCategories: CategoryId[]` 追加＋ストレージ反映

### B-2. 社員の得意カテゴリ拡張
- [x] `state/types.ts` の `Employee` に `specialties: { categoryId: CategoryId; bonus: number }[]` 追加
- [x] `data/employees.ts` の `newCandidate` で職種に応じた得意カテゴリを生成
  - programmer: gameplay/innovation
  - designer: graphics/sound
  - pr: story/presentation
  - 40% で副カテゴリも追加
- [x] 旧 `power` フィールドを総合パワーとして維持（自動生産・品質基礎+・売上%は既存）
- [x] セーブマイグレーション v3→v4（`typing-factory:v4`、旧 employee に specialties を空配列で補完）

### B-3. 社員アサイン
- [x] `state/types.ts` の `CurrentProject` に `assignedEmployeeIds: string[]` 追加
- [x] PlanScreen でドラフト管理（ローカル state）→ `startProject` に渡す
- [x] `startProject` で `selectedCategories` と `assignedEmployeeIds` を受け取る
- [ ] 開発中の社員は他作品に投入不可（複数ライン未実装のため後段）

### B-4. 品質計算式の置換
- [x] `utils/metascore.ts` に `computeQuality({ scaleBase, categoryHit, employeeHit, performance, adBonus })` を新設
- [x] `releaseWork` で `polishToQuality` の呼び出しを `computeQuality` に置換
- [x] 4レバー内訳を `Work.breakdown` に保存（リリース画面でブレイクダウン表示用）

### B-5. タイピング演技スコア
- [x] `useTyping` で WPM・最大コンボ・精度を集計（`onAccuracy` 追加）
- [x] `current.perf: { wpm, maxCombo, accuracy }` で保持
- [x] `computeQuality` の performance 引数に利用（`computePerformanceScore` で 0〜20 点に正規化）

---

## C. 企画画面（PlanScreen）改修

- [x] カテゴリ選択UI（最大3つ・チップ選択・解放済みのみ・`data-category-id` 属性付き）
- [x] 社員アサインUI（候補リストから2〜3人チェック・`data-employee-id` 属性付き）
- [x] 「開発開始」ボタンの活性化条件：カテゴリ3つ + 社員1人以上
- [x] カテゴリ × ジャンル/テーマ の相性ヒント表示（categoryAffinity 合計プレビュー）
- [ ] 社員のアサイン枠数を規模解放に連動（現状は1〜3で固定上限）

---

## D. 開発画面（DevelopScreen）拡張

- [x] ポリッシュ予感バー削除
- [x] アサイン社員の表示（名前 + 役職タグを上部に表示）
- [x] パフォーマンス指標（WPM・コンボ・精度）の常時可視化
- [x] 2カラムレイアウト（左：打鍵、右：CodeEditor）

---

## E. リリース画面（ReleaseScreen）刷新

- [x] 4レバーの個別寄与をブレイクダウン表示（base / categories / employees / performance / ads / variance）
- [x] 段階的なフェードイン演出（カテゴリ→社員→演技→広告→揺らぎ→合計）
- [x] **マーケティング広告**（+カテゴリ寄与5）：リリース前に選択
- [x] **デバッグチーム広告**（+演技寄与5）：リリース前に選択
- [x] ローンチ広告（売上×1.5）は既存維持（リリース後）

---

## F. コード雰囲気エディタ（新規）

- [x] `data/codeSnippets.ts`：10テンプレ＋ジャンル/テーマ別単語プール（verbs/classes/nouns/props）
- [x] `data/codeSnippets.ts`：`buildLine({genreId, themeId, idx})` を実装
- [x] `components/CodeEditor.tsx` を新規作成
  - props: `lines: string[]`, `currentlyTyping?: string`, `bugLineIdx?: number | null`, `mode?: 'develop'|'building'`
  - 行番号・等幅フォント（GitHub Dark配色）
  - シンタックスハイライト（keywords/strings/comments）
  - 自動スクロール
- [x] `DevelopScreen.tsx` のレイアウトを2カラムに変更
- [x] バグイベント時、CodeEditor の該当行に赤波線＋エラー文字列を表示
- [~] バグ修正完了で赤を消す（緑フラッシュは未実装）

---

## G. リリース演出（コードエディタ連動）

- [ ] リリースボタン押下 → CodeEditor 上に `> Compiling sources...` 等のビルドログ表示
- [ ] 順次4〜5行のビルドメッセージ（200〜400ms間隔）
- [ ] 完了後にジャケットへ視覚的にフェードイン

> 注：CodeEditor 自体に `mode='building'` 対応は入っているが、Release画面からの発火は未実装。

---

## H. テスト

- [x] Playwright スモークテスト更新：ポリッシュ画面遷移期待を削除、4レバーブレイクダウン表示を確認
- [x] カテゴリ3つ選択 → リリースまでのフロー確認（新規テスト追加）
- [x] 採用候補に specialties が表示されるか確認（既存テスト維持・候補テスト pass）
- [x] **7/7 pass**

---

## I. ドキュメント保守

- [x] v0.9 spec.md を作成
- [x] v0.9 tasks.md を作成
- [x] 実装完了後、各セクションを `[x]` に更新

---

## 継承タスク（v0.8 から引き継ぐ未完）

> v0.9 でも残り、影響を受けないもの。

### コアループ／開発
- [ ] ミス時のロス挙動（時間／品質への影響）
- [ ] ライバル会社の同時進行表示

### 経営／オフィス
- [ ] 設備投資（恒常ボーナス）
- [ ] オフィス見た目の段階変化
- [ ] ターン区切りインタースティシャル広告

### 図鑑／実績
- [ ] 全マス埋め／神全発見の実績

### トレンド
- [ ] 逆張りペナルティ
- [ ] 「トレンド×高相性×高品質」特大ヒット演出

### ビジュアル
- [ ] ジャンル背景パーツ12種（ドット絵）
- [ ] テーマシンボルパーツ15種（ドット絵）
- [ ] 社員アバター組み合わせ
- [ ] オフィス見た目変化

### メタ進行
- [ ] オフィス段階アップ演出
- [ ] 「あと¥◯◯で次の解放」目標表示
- [ ] 殿堂入りの専用画面

### 広告
- [ ] スキップ/在庫なし/ブロッカーのフォールバック詳細
- [ ] インタースティシャル
- [ ] バナー
- [ ] 1セッションの強制広告回数上限
- [ ] 実SDK組み込み

### UX
- [ ] 効果音の各画面への発火統合
- [ ] BGM
- [ ] 結果画面シェア導線

### 基盤
- [ ] エラーバウンダリ／想定外データのリセット導線
- [ ] レスポンシブ最低保証（1280×720以上）

### テスト
- [ ] 主要ユーティリティのユニットテスト（metascore, compatibility, title, sales, categoryAffinity, computeQuality）

### ローンチ準備
- [ ] パフォーマンス計測
- [ ] ブラウザ互換確認
- [ ] 利用規約／プライバシー／広告開示
- [ ] 配信ポータル要件確認
- [ ] アナリティクス
