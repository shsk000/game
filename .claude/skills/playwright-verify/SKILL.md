---
name: playwright-verify
description: Playwright MCP（mcp__playwright__browser_*）でこのプロジェクト（タイピング工場）の画面を実際にブラウザで開いて検証する手順。UI/ビジュアルの変更を入れた後、スクショで見た目を確認する時、「ちゃんと表示されるか／壊れていないか」を確かめる時、修正がブラウザで効いているか確認する時、コミット/プッシュ前に動作確認する時、before/after を見比べる時は必ずこの skill を参照すること。自前のスクショ用 script や playwright test を新規に書かず、接続済みの Playwright MCP のツールを直接使う。OfficeView など見た目の変更を検証する場面では、設計が合っているかを office-visual-design / game-ui-design の規格と照合する。
---

# Playwright 検証スキル（MCP 版・script 不要）

このプロジェクトの画面を **実際のブラウザで開いて目視検証**するための手順。
接続済みの **Playwright MCP** を直接使う。**自前のスクショ script も playwright test も書かない**
（MCP が `browser_navigate` / `browser_take_screenshot` / `browser_snapshot` 等を提供するため）。

> 関連：検証は実機で行う（[[feedback_verification]]）。見た目の正否は office-visual-design / game-ui-design の規格で判定する。

---

## 0. 使う MCP ツール（mcp__playwright__*）

| ツール | 用途 |
|---|---|
| `browser_resize` | viewport を **1280×800** に（このゲームは 1280×720 固定設計） |
| `browser_navigate` | URL を開く |
| `browser_take_screenshot` | 見た目を撮る → Read で目視 |
| `browser_snapshot` | アクセシビリティツリー（**クリック対象の ref 取得・要素検証はこっち**） |
| `browser_click` / `browser_type` / `browser_press_key` | 操作（採用する・画面遷移する等） |
| `browser_wait_for` | テキスト出現/消滅を待つ（**固定 sleep の代わり**） |
| `browser_console_messages` | JS エラー確認（白画面の切り分け） |
| `browser_evaluate` | 状態を仕込む/読む（例：zustand ストアを直接操作） |

---

## 1. 手順（基本フロー）

1. **dev サーバーが起きているか・ポートを確認する**（§2 の落とし穴を必ず読む）
2. `browser_resize` で **1280×800**
3. `browser_navigate` で対象 URL（例 `http://localhost:5173/`）
4. `browser_console_messages` でエラーが出ていないか確認（白画面の早期切り分け）
5. `browser_take_screenshot` → 保存された PNG を **Read で目視**
6. 必要なら `browser_snapshot` で要素を取り、`browser_click` 等で目的の画面まで操作
7. **設計規格と照合**して合否を述べる（office-visual-design §9 / game-ui-design / MVP 要素）

---

## 2. このプロジェクト固有の落とし穴（重要）

### 2-1. ポート違い（最頻のハマり）
- Vite は **5173 が使用中なら自動で 5174…** とずらす。
- **worktree で作業中は、main リポジトリの dev サーバーと worktree の dev サーバーが両方起動しがち** → 5173=main(古い) / 5174=worktree(変更あり) のように分かれ、「変わってない」の原因になる。
- 対処：起動ログ（`Local: http://localhost:PORT/`）で**実ポートを必ず確認**してから navigate する。どのディレクトリがどのポートかを取り違えない。

### 2-2. worktree は依存が未インストールのことがある
- `EnterWorktree` 直後の worktree は **node_modules 無し**。dev サーバー起動前に `npm install` が要る。

### 2-3. 到達する画面（App の構成）
- **OfficeScreen は常時描画される「世界ステージ」**＝ルート URL を開けば出る（`screen==='develop'` の時だけフルスクリーンに切替）。
- 計画/作品/図鑑/リリースは **ストア state 駆動のオーバーレイ窓**（ページ遷移ではない）。
- 直接その画面を出したい時は `browser_evaluate` で zustand の `goTo(...)` を叩くか、`browser_click` でメニューを押す。

### 2-4. スクショの保存先
- `browser_take_screenshot` は **MCP サーバーの cwd**（このプロジェクトでは main リポジトリ）配下に保存される。`filename` を省くと `.playwright-mcp/` に入る。撮ったら**その PNG を Read** して中身を見る（パスは結果に出る）。

---

## 3. ベストプラクティス（Playwright 一般・調査済み）

- **固定 sleep を避け、web-first / auto-wait を使う**：要素は actionable になるまで自動で待たれる。明示待ちが要る時は `browser_wait_for`(テキスト出現等）を使う。`waitForTimeout` の連打はフレークの元。
- **ユーザー視点の locator**：role / ラベル / テキストで掴む（深い CSS パスより壊れにくい）。`browser_snapshot` の ref はこの思想。
- **スクショを安定させる（視覚回帰のコツ）**：アニメ無効化・フォント ready 待ち・networkidle 待ち・**動的要素（日付/売上/トレンド等）はマスク**して、毎回違う差分（フレーク）を減らす。
- **環境を揃える**：viewport・スケール・OS を固定。比較は同条件で。
- **しきい値**：ピクセル比較するなら `maxDiffPixels` / `maxDiffPixelRatio` で許容差を持たせる。
- **白画面が出たら**：まず `browser_console_messages` でエラーを見る（ビルド/import エラーの早期発見）。

---

## 4. よくある検証パターン（このゲーム）

- **オフィスの見た目検証**：ルートを開く → スクショ → office-visual-design §2/§9（アイソメ 30°×30°・立方体規格・向かい合わせペア・比率）と照合。
- **HUD/ウィンドウ検証**：game-ui-design（9-slice・ピクセルフォント・サイズスケール）と照合。
- **回帰**：変更前に before を撮り、変更後に after を撮って Read で見比べる（同じ URL/viewport）。

---

## 5. やらないこと
- 自前のスクショ用 `.cjs`/`.mjs` script を新規に書く（MCP で足りる）。
- 検証目的だけのために playwright test ファイルを増やす（恒久的な e2e を足したい時は別途 `tests/` に置く判断をユーザーと共有してから）。
- 固定 `sleep`/`waitForTimeout` で「待てば直る」式の対処をする。

---

## 6. 参考（調査ソース）
- Playwright 公式 Best Practices / Auto-waiting / Visual comparisons（toHaveScreenshot, maxDiffPixels, masking）
- Agent Skills の公式ライブラリ：`github.com/anthropics/skills`
