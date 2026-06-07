# Plan: オフィス画面をゲーム UI ドット絵トップに改修

## Context

現状の UI は Web サイトの延長線（モダン CSS、カード列、テキストボタン）で、ゲーム世界観と乖離している。一方で `OfficeView` と `SpriteAnimation` だけドット絵スプライトで、両者が混在している。

ユーザー要望：
1. **オフィス画面をゲームのトップ画面**にする（現状トップは `PlanScreen`）
2. **オフィスから「計画」等のメニューを選択する形**にする
3. UI は **2D ドット絵**で統一（ゲーム UI 化）
4. 必要なら **専用 SKILL を新規作成**

これにより「Kairosoft Game Dev Story 風オフィスシム」としての世界観が一貫し、既存のドット絵スプライト資産（机・椅子・人物・床タイル）と UI が同じテイストで揃う。

## 推奨アプローチ

### Phase A: SKILL 新規作成（`game-ui-design`）

`/home/shsk/git/game/.claude/skills/game-ui-design/SKILL.md` を新規作成。内容：

- **基本方針**：すべての UI を「ドット絵 + 9-slice ウィンドウ + ピクセルフォント」で統一。`baseline-ui` SKILL（Tailwind 前提）は Web UI 用なのでこのプロジェクトでは適用しない
- **ピクセルフォント**：`DotGothic16`（日本語対応・Google Fonts）と `PressStart2P`（数字・英字）を使い分け
- **カラーパレット**：Kairosoft 風（office-visual-design §1 と統一）の制限パレット
- **9-slice ウィンドウ仕様**：4 種類（標準枠 / 強調枠 / モーダル枠 / ボタン）
- **ピクセルアイコン規格**：32×32px、メニュー用 7 種（計画・採用・規模・作品・図鑑・実績・設定）
- **`image-rendering: pixelated`** をすべてのスプライト・UI 画像に強制
- **アニメーション制約**：`step()` 関数で離散的に動かす（滑らかな ease は禁止）
- **入力**：マウスクリック必須、キーボード矢印+Enter 操作も対応
- **既存コンポーネントとの棲み分け**：`office-visual-design` SKILL は世界観・パース、`pixelart-prompting` は素材発注、こちらは **UI 実装**

### Phase B: 画面アーキテクチャの変更

1. **初期画面を `office` に変更**
   - `src/state/gameStore.ts` の `screen` の初期値を `'plan'` → `'office'` に
   - `src/App.tsx` の default を `OfficeScreen` に
2. **画面遷移の整理**
   - `office` → `plan` / `library` / `collection`（既存）
   - `office` 内のサブ機能（採用 / 規模解放 / 実績）は **モーダル**で表示（画面遷移しない）
3. **トップ階層**：オフィス画面に常駐するメニューバーから全機能にアクセス

### Phase C: 新規コンポーネント（ドット絵 UI 基盤）

`src/components/ui/` を新設し以下を作成：

- **`PixelWindow.tsx`**：9-slice ウィンドウ枠（タイトルバー付き / なし）。子要素を内包
- **`PixelButton.tsx`**：3 状態（idle / hover / press）。size = small / medium / large
- **`PixelMenuBar.tsx`**：オフィス画面下部のメニュー。アイコン横並び、選択中はハイライト
- **`PixelStatusBar.tsx`**：画面上部の常駐ステータス（💰資金 / 👥ファン / 🧑‍💻従業員 / 📚作品）
- **`PixelModal.tsx`**：採用・規模解放・実績用モーダル基盤
- **`PixelIcon.tsx`**：32×32px のアイコン描画（image-rendering: pixelated）

### Phase D: OfficeScreen 書き換え

`src/features/office/OfficeScreen.tsx` を以下のレイアウトに：

```
┌────────────────────────────────────┐
│ PixelStatusBar （資金・ファン等）        │ ← 画面上部固定
├────────────────────────────────────┤
│                                    │
│    OfficeView（既存・無変更）              │ ← アイソメトリック画面、中央メイン
│                                    │
├────────────────────────────────────┤
│ [計画][採用][規模][作品][図鑑][実績][設定]    │ ← PixelMenuBar 下部固定
└────────────────────────────────────┘
```

各メニュー選択時：
- **計画** → `goTo('plan')`（既存画面遷移）
- **採用** → PixelModal でモーダル表示（既存 candidate UI の中身をピクセル化）
- **規模解放** → PixelModal でモーダル表示
- **作品** → `goTo('library')`
- **図鑑** → `goTo('collection')`
- **実績** → PixelModal でモーダル表示
- **設定** → PixelModal でセーブリセット等

販売中作品・会社サマリは PixelWindow 内に。

### Phase E: アセット発注（PixelLab）

`pixelart-prompting` SKILL の `create_map_object`（1gen / 方向句効く）で発注：

- **メニューアイコン 7 種**（各 32×32）：📋 計画 / 👥 採用 / 🏆 規模 / 📚 作品 / 📖 図鑑 / 🌟 実績 / ⚙️ 設定
- **9-slice ウィンドウ枠**：標準・モーダル 2 種（境界は手動で 9-slice に分割）
- **PixelButton 3 状態スプライト**：normal / hover / press
- **カーソル / 選択枠**：8×8px の点線アニメ枠（CSS でも可）

合計コスト概算：**20〜30 gen**（`create_map_object` 単発 1gen × 各 1〜2 候補）

### Phase F: CSS の整理

`src/styles/global.css` をピクセルアート用に書き換え：

- `image-rendering: pixelated` をすべての sprite/UI 画像に強制（グローバル指定）
- `@font-face` で `DotGothic16` と `PressStart2P` をインポート
- 既存の `.card`, `.primary-btn`, `.link-btn` 等の Web UI 系クラスは段階的に削除
- 旧 UI コンポーネント（TypingPanel, CodeEditor 等）は Develop 画面用なので保持、別途ピクセル化を後追い

### Phase G: 段階実装の順序

ユーザーが見える形で進めるため：

1. **SKILL 作成**（変更が見えるドキュメント、即実行可）
2. **OfficeScreen を新レイアウトに**（仮素材で UI 骨格を組む。後で本素材に差し替え）
3. **アセット発注**（PixelLab で 7 アイコン + 枠を順次）
4. **PixelWindow / PixelButton / PixelMenuBar の実装**
5. **モーダル系（採用・規模・実績・設定）**
6. **初期画面切り替え** + 画面遷移整理
7. **ブラウザ実機検証**（dev server で触る）

## 影響を受ける主要ファイル

| ファイル | 変更内容 |
|---|---|
| `.claude/skills/game-ui-design/SKILL.md` | **新規作成**（ドット絵 UI 規約） |
| `src/components/ui/PixelWindow.tsx` | **新規作成** |
| `src/components/ui/PixelButton.tsx` | **新規作成** |
| `src/components/ui/PixelMenuBar.tsx` | **新規作成** |
| `src/components/ui/PixelStatusBar.tsx` | **新規作成** |
| `src/components/ui/PixelModal.tsx` | **新規作成** |
| `src/components/ui/PixelIcon.tsx` | **新規作成** |
| `src/features/office/OfficeScreen.tsx` | **大規模書き換え**（ゲーム UI レイアウトに） |
| `src/state/gameStore.ts` | `screen` 初期値を `'office'` に |
| `src/App.tsx` | default を `OfficeScreen` に |
| `src/styles/global.css` | ピクセルフォント・image-rendering 追加、旧クラス整理 |
| `public/sprites/ui/*.png` | **新規アセット 10+ 個** |

## 重要な既存コードの再利用

- `OfficeView`（src/components/OfficeView.tsx）：そのまま流用、画面中央に配置
- `SpriteAnimation`（src/components/SpriteAnimation.tsx）：UI アイコンアニメにも転用可
- Zustand store（src/state/gameStore.ts）：状態管理ロジックは無変更、UI 側だけ書き換え
- `office-visual-design` SKILL §1（テイスト）：UI のカラーパレット・線質指針はここに合わせる

## 検証方法

1. **dev server 起動**：`npm run dev`
2. **画面遷移確認**：起動時に OfficeScreen が表示されるか
3. **メニュー操作**：各アイコンクリックで適切な画面・モーダルが開くか
4. **ピクセル感**：すべての UI が `image-rendering: pixelated` で粗いドット表示になっているか
5. **キーボード操作**：矢印 + Enter で選択できるか（accessibility）
6. **既存機能の保持**：採用・規模解放・実績などのロジックが壊れていないか
7. **Playwright スクリーンショット**：`tests/office-screenshot.spec.ts` に新 UI 用テスト追加

---

## 進捗状況（2026-06-08 時点・このプラン着手前のセッション成果）

### 完了済み
- **座標系の確定**：アイソメワールド標準（N=画面左上 / E=画面右上 / S=画面右下 / W=画面左下）。2Dトップダウン座標で読まないこと
- **`pixelart-prompting` SKILL 修正**：
  - §7-0 新規（失敗・成功パターン一覧）
  - §7-5-1 書き換え（方向制御をツール別に整理）
  - §7-5-2 強化（2D 反転・回転絶対禁止）
  - §10-0 ツール選定指針（`create_map_object` 第一選択、`create_1_direction_object` は方向句効かないので非推奨）
  - §10-0b 強制 prompt テンプレ新規（CRITICAL / MUST / NEVER / 大文字 / 除外指定）
  - §10-1, 10-2, 10-2b テンプレ書き換え（map_object ベース）
  - §5-5-2 物体ごとの方向作り方表（すべて新規発注）
- **`office-visual-design` SKILL 修正**：クイックリファレンス、§2-B-0、§2-B-5 を書き換え
- **memory 追加**：`feedback_no_2d_flip_for_direction.md`（2D 反転禁止を永続化）
- **生成済み資産**（残存）：
  - 床タイル候補 16種（`public/sprites/office/tile_pro_0〜15.png`）
  - 人物 8方向静止画（`OfficeView` 用、`worker_walking/` `worker_sit_*/` `worker_typing_*/` `worker_cheering_south/` `worker_sad_south/` 配下）
  - 検証用グリッド画像（`worker_8dir_grid.png` `desk2_grid_labeled.png` `row*.png`）
  - 植物（`plant.png`）

### 進行中（このプラン着手時点）
- **座り姿 character_state（id: 35e94543）**：椅子なし・人だけの座りポーズ静止画 8方向
- **sitting アニメ**（35e94543 ベース、SE/NW、4フレーム）
- **typing アニメ**（35e94543 ベース、SE/NW、6フレーム）

### 失われた素材（PixelLab の object id で再ダウンロード可能・0gen）
ユーザーが手動で不要画像を削除整理した際に、採用候補の SE/NW 物体も消えた。再ダウンロード対象：
- 机 SW / NE / SE / NW（8方向 object id: `68d87707`）
- 椅子（8方向 object id: `19408c43`）
- ノートパソコン SW（`8580991a`）/ SE（`e51616bd`）/ MacBook 風（`4a5b8547`）
- 床カーペット（採用色を確定後、`tile_pro_*.png` の該当 index をリネーム）

これらは PixelLab に object として残っているので、`https://api.pixellab.ai/mcp/map-objects/<id>/download` 等で再取得可能。

### このプラン着手前に決めるべきこと
- **採用するタイル色**（tile_pro 16種から1つ選ぶ）
- **机・椅子・ノートパソコンを再ダウンロードするか**（UI改修の前？後？）
- **本プランの実装着手順序**（Phase G に記載済み）
