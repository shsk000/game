---
name: game-ui-design
description: タイピング工場プロジェクトのゲーム UI（メニュー・ウィンドウ・ボタン・ステータスバー・モーダル・アイコン）の確定実装仕様。すべての UI を「ドット絵 + 9-slice ウィンドウ + ピクセルフォント」で統一する Kairosoft Game Dev Story 風ゲーム UI。Web の Tailwind/モダン CSS 系（baseline-ui SKILL）はこのプロジェクトでは使わない。OfficeScreen を含むトップ画面・モーダル・メニューバー・各種 UI コンポーネント（PixelWindow / PixelButton / PixelMenuBar / PixelStatusBar / PixelModal / PixelIcon）を実装する時、global.css のフォント・image-rendering を変更する時、UI 用ピクセル素材を発注する時は必ずこのスキルを最初に参照すること。office-visual-design スキルと棲み分け：あちらは**オフィス世界観（パース・配置・家具）**、こちらは**UI レイヤー（HUD・ウィンドウ・操作系）**。pixelart-prompting と棲み分け：あちらは**PixelLab 発注テクニック汎用**、こちらは**UI 固有の実装規格**。
---

# ゲーム UI 実装スキル

このスキルは「タイピング工場」プロジェクトのゲーム UI（HUD・メニュー・ウィンドウ・モーダル・ボタン・アイコン）の**実装規格**を保持する生きたドキュメント。UI コンポーネントを作る前・スタイル変更する前に必ず参照する。

## ⭐ クイックリファレンス（決定事項一覧）

| 項目 | 確定値 | 詳細 |
|---|---|---|
| **基本方針** | ドット絵 + 9-slice ウィンドウ + ピクセルフォント | §1 |
| **Tailwind/モダン CSS** | ❌ 使わない（`baseline-ui` SKILL は対象外） | §1-2 |
| **日本語フォント** | DotGothic16（Google Fonts） | §2-1 |
| **英数字フォント** | PressStart2P（Google Fonts） | §2-1 |
| **フォントサイズスケール** | 8 / 12 / 16 / 24 px（4の倍数のみ） | §2-3 |
| **カラーパレット** | Kairosoft 風 16 色（`office-visual-design` §1 と統一） | §3 |
| **9-slice ウィンドウ** | 4 種類（標準 / 強調 / モーダル / ボタン） | §4 |
| **9-slice slice size** | 8 px（角・辺・中央） | §4-2 |
| **ピクセルアイコン規格** | 32×32 px（メニュー 7 種） | §5 |
| **image-rendering** | `pixelated` を全 sprite/UI 画像に強制 | §6 |
| **scale 倍率** | 整数倍（×1 / ×2 / ×3）のみ | §6-3 |
| **アニメ関数** | `steps(N)` で離散 | §7 |
| **アニメ duration** | 100ms / 200ms / 400ms（離散） | §7-2 |
| **入力** | マウスクリック + 矢印キー + Enter | §8 |
| **メニュー 7 種** | 計画 / 採用 / 規模 / 作品 / 図鑑 / 実績 / 設定 | §5-2 |

---

## 0. このスキルが必要になる理由

現状の UI は Web サイトの延長線（モダン CSS、カード列、テキストボタン）で、ゲーム世界観と乖離している。一方で `OfficeView` と `SpriteAnimation` だけドット絵スプライトで、両者が混在している。

このスキルは「UI を何で作るか」を**先に**決めて、コンポーネント実装・CSS・アセット発注の全段階で一貫した基準を提供する。

過去の失敗：
- Tailwind の utility-first で `rounded-lg`, `shadow-md`, `transition-all` を多用 → ピクセルアートと噛み合わない
- Google Fonts の Inter/Noto Sans を使う → ドット絵の中で浮く
- `font-size: 14px` 等の半端な値で文字がにじむ → ピクセル感が崩れる

---

## 1. 基本方針

### 1-1. すべての UI を「ドット絵 + 9-slice + ピクセルフォント」で統一

このプロジェクトの UI は以下 3 要素で構成する：

1. **ピクセルフォント**：DotGothic16（日本語）+ PressStart2P（英数字）
2. **9-slice ウィンドウ**：ピクセル枠を引き伸ばさずに矩形を拡張
3. **ピクセルアイコン**：32×32 / 16×16 / 8×8 の整数倍 PNG

これら 3 要素ですべての UI（HUD・メニュー・ボタン・モーダル・ステータスバー）を構築する。

### 1-2. ❌ Tailwind / モダン CSS / baseline-ui SKILL は対象外

このプロジェクトでは **`baseline-ui` SKILL を適用しない**。理由：

- `baseline-ui` は Tailwind CSS プロジェクト用（utility classes・8pt grid・ease-out transition 前提）
- 本プロジェクトはピクセルアートゲームなので **整数倍ピクセル・離散アニメ・ピクセルフォント**で統一する必要がある
- `rounded-*` / `shadow-*` / `transition-all` 等の滑らかな表現はピクセルアートを壊す

→ UI 実装時は本スキル（`game-ui-design`）のみ参照する。`baseline-ui` の指針は無視。

### 1-3. 既存 SKILL との棲み分け

| スキル | 担当領域 |
|---|---|
| **`office-visual-design`** | オフィス世界観・パース・家具/人物の配置・アイソメ規格 |
| **`pixelart-prompting`** | PixelLab MCP の発注テクニック・コスト・方向制御・失敗パターン |
| **`game-ui-design`（本スキル）** | UI レイヤー実装（HUD・ウィンドウ・ボタン・モーダル・メニュー・アイコン） |
| ~~`baseline-ui`~~ | ❌ このプロジェクトでは使わない（Web 用） |

新しい UI を作る時は **本スキル + pixelart-prompting**（アイコン発注時）を併用。
オフィス画面そのものの絵（机・人物）は **office-visual-design** を参照。

---

## 2. ピクセルフォント

### 2-1. 採用フォント

| 言語 | フォント | 提供元 | weight |
|---|---|---|---|
| 日本語 | **DotGothic16** | Google Fonts | 400 |
| 英数字 | **PressStart2P** | Google Fonts | 400 |

### 2-2. CSS 設定（`src/styles/global.css` に追加）

```css
@import url('https://fonts.googleapis.com/css2?family=DotGothic16&family=Press+Start+2P&display=swap');

:root {
  --font-jp: 'DotGothic16', 'Hiragino Maru Gothic ProN', monospace;
  --font-en: 'Press Start 2P', 'Courier New', monospace;
}

body {
  font-family: var(--font-jp);
  font-smooth: never;
  -webkit-font-smoothing: none;
  -moz-osx-font-smoothing: none;
  font-feature-settings: 'kern' off, 'liga' off;
}

/* 数字・英字専用クラス */
.pixel-num,
.pixel-en {
  font-family: var(--font-en);
}
```

⚠ **`font-smooth: never` を必ず指定**。デフォルトのアンチエイリアスが効くと文字がぼやけてドット感が消える。

### 2-3. フォントサイズスケール（4 の倍数のみ）

| 用途 | サイズ | 使い所 |
|---|---|---|
| **xs** | 8 px | 補足情報・小数字 |
| **sm** | 12 px | 本文（メニューラベル・説明文） |
| **md** | 16 px | 標準（ステータス値・ボタン） |
| **lg** | 24 px | 見出し（モーダルタイトル・大型数字） |

```css
.pixel-text-xs { font-size: 8px; line-height: 8px; }
.pixel-text-sm { font-size: 12px; line-height: 12px; }
.pixel-text-md { font-size: 16px; line-height: 16px; }
.pixel-text-lg { font-size: 24px; line-height: 24px; }
```

⚠ **half-pixel な値（10px / 14px / 18px）は禁止**。文字のグリッドがにじむ。
⚠ **line-height は font-size と同値か整数倍**。1.5 などの少数倍率は禁止。

### 2-4. 文字色（Kairosoft 風）

| 用途 | カラー | hex |
|---|---|---|
| 通常テキスト | dark navy | `#202840` |
| 強調テキスト | dark red | `#a02828` |
| サブテキスト | grey | `#606878` |
| 反転（暗背景上） | cream | `#f0e8d0` |
| 注意・警告 | orange | `#e07020` |
| 金額・数値 | bright yellow | `#f0c020` |

---

## 3. カラーパレット

### 3-1. Kairosoft 風 16 色（`office-visual-design` §1 と統一）

| ロール | hex | 用途 |
|---|---|---|
| **bg-dark** | `#202840` | UI 文字色・モーダルオーバーレイ |
| **bg-mid** | `#506880` | サブ UI 背景・無効化要素 |
| **bg-light** | `#f0e8d0` | ウィンドウ背景（クリーム色） |
| **bg-lighter** | `#fff8e0` | ハイライト |
| **frame-brown** | `#704028` | 9-slice 枠の外側ライン |
| **frame-tan** | `#c89858` | 9-slice 枠の中間 |
| **accent-red** | `#a02828` | 強調枠・警告 |
| **accent-orange** | `#e07020` | 通知・ホバー強調 |
| **accent-yellow** | `#f0c020` | 金額・コイン |
| **accent-green** | `#308040` | 成功・OK |
| **accent-blue** | `#3870c0` | 情報・選択中 |
| **accent-cyan** | `#60c0d0` | リンク・ハイライト |
| **wood-1** | `#806040` | 木目濃い |
| **wood-2** | `#a08050` | 木目薄い |
| **shadow** | `#000000aa` | 影（半透明黒） |
| **transparent** | `transparent` | 抜き |

```css
:root {
  --c-bg-dark: #202840;
  --c-bg-mid: #506880;
  --c-bg-light: #f0e8d0;
  --c-bg-lighter: #fff8e0;
  --c-frame-brown: #704028;
  --c-frame-tan: #c89858;
  --c-accent-red: #a02828;
  --c-accent-orange: #e07020;
  --c-accent-yellow: #f0c020;
  --c-accent-green: #308040;
  --c-accent-blue: #3870c0;
  --c-accent-cyan: #60c0d0;
  --c-wood-1: #806040;
  --c-wood-2: #a08050;
  --c-shadow: rgba(0, 0, 0, 0.67);
}
```

### 3-2. NG な色

- ❌ グラデーション（`linear-gradient`）— ピクセルアート世界では存在しない
- ❌ rgba の中途半端な透明度（0.3, 0.7 等）— `shadow` の 0.67 以外は禁止
- ❌ Material Design / Tailwind の `blue-500` 等の色 — 彩度が違いすぎる
- ❌ パステル系（薄ピンク・水色）— Kairosoft 系には合わない

---

## 4. 9-slice ウィンドウ仕様

### 4-1. 9-slice とは

矩形を 4 隅・4 辺・中央の **9 領域**に分割し、辺と中央のみ引き伸ばす技法。角は固定なのでピクセル枠が崩れない。

```
┌──┬────────┬──┐
│TL│   T    │TR│   ← 角（固定）と上辺（横に伸びる）
├──┼────────┼──┤
│ L│        │ R│   ← 左右辺（縦に伸びる） + 中央（縦横に伸びる）
├──┼────────┼──┤
│BL│   B    │BR│   ← 下辺
└──┴────────┴──┘
```

CSS の `border-image` で実現する。

### 4-2. 確定仕様

| 種類 | 用途 | 枠色 | 背景色 | アイコン | slice size |
|---|---|---|---|---|---|
| **standard** | 通常ウィンドウ・販売中作品 etc | `frame-brown` | `bg-light` | なし | 8 px |
| **emphasis** | 重要情報・統計・実績進捗 | `accent-red` | `bg-lighter` | あり（左上） | 8 px |
| **modal** | モーダル基盤（採用・規模・設定） | `frame-brown` 2 重 | `bg-light` | 中央 X ボタン | 12 px |
| **button** | クリッカブル要素 | `frame-tan` | `bg-light` / hover で `accent-yellow` | あり | 4 px |

### 4-3. アセット仕様

各 9-slice 用 PNG：
- **ファイル名**：`/public/sprites/ui/window_<type>.png`
- **サイズ**：24×24 px（standard / emphasis / button）または 36×36 px（modal）
- **slice size**：CSS の `border-image-slice` と一致させる

例：standard（24×24, slice 8px）
```
+--------+--------+--------+
|  8x8   |  8x8   |  8x8   |
|   TL   |   T    |   TR   |
+--------+--------+--------+
|  8x8   |  8x8   |  8x8   |
|   L    | center |   R    |
+--------+--------+--------+
|  8x8   |  8x8   |  8x8   |
|   BL   |   B    |   BR   |
+--------+--------+--------+
```

### 4-4. CSS 実装

```css
.pixel-window {
  border-image-source: url('/sprites/ui/window_standard.png');
  border-image-slice: 8 fill;    /* fill で中央も使う */
  border-image-width: 16px;       /* 表示時は 2x scale */
  border-image-repeat: stretch;   /* 辺は引き伸ばし */
  border-style: solid;
  border-width: 16px;
  image-rendering: pixelated;
  padding: 8px;                   /* 内容と枠の隙間 */
}

.pixel-window--emphasis {
  border-image-source: url('/sprites/ui/window_emphasis.png');
}

.pixel-window--modal {
  border-image-source: url('/sprites/ui/window_modal.png');
  border-image-slice: 12 fill;
  border-image-width: 24px;
  border-width: 24px;
}
```

⚠ `border-image-repeat: stretch` を必ず指定。`round` や `repeat` だとピクセル感が崩れる。
⚠ `border-image-slice` の `fill` を忘れない（無いと中央が透明になる）。

### 4-5. PixelWindow コンポーネント仕様

`src/components/ui/PixelWindow.tsx`

```tsx
type PixelWindowProps = {
  variant?: 'standard' | 'emphasis' | 'modal';
  title?: string;
  children: React.ReactNode;
  className?: string;
};
```

実装方針：
- `variant` で `border-image-source` を切り替え
- `title` ありなら上端にタイトルバー（高さ 24px、`bg-frame-brown` 背景・`bg-light` 文字）
- `padding` と `border-width` で内側余白を確保
- ❌ `border-radius` 一切なし（角が丸まる = ピクセル感破壊）

---

## 5. ピクセルアイコン規格

### 5-1. サイズ規格

| サイズ | 用途 | 表示倍率 |
|---|---|---|
| **8×8 px** | カーソル・小バッジ | 2x 表示 = 16px |
| **16×16 px** | ステータスバー内アイコン | 2x 表示 = 32px |
| **32×32 px** | **メニューバー用（標準）** | 2x 表示 = 64px |

### 5-2. メニューアイコン 7 種（32×32 px）

オフィス画面下部のメニューバー用。確定リスト：

| ID | 名前 | モチーフ | アクション | ファイル |
|---|---|---|---|---|
| 1 | **計画** | クリップボード + ペン | `goTo('plan')` | `/sprites/ui/icon_plan.png` |
| 2 | **採用** | 履歴書 + ハート | `openModal('recruit')` | `/sprites/ui/icon_recruit.png` |
| 3 | **規模** | オフィスビル | `openModal('scale')` | `/sprites/ui/icon_scale.png` |
| 4 | **作品** | カートリッジ / ゲーム箱 | `goTo('library')` | `/sprites/ui/icon_library.png` |
| 5 | **図鑑** | 開いた本 | `goTo('collection')` | `/sprites/ui/icon_collection.png` |
| 6 | **実績** | トロフィー | `openModal('achievements')` | `/sprites/ui/icon_achievements.png` |
| 7 | **設定** | 歯車 | `openModal('settings')` | `/sprites/ui/icon_settings.png` |

### 5-3. ステータスバーアイコン 4 種（16×16 px）

画面上部の常駐ステータス用：

| ID | 名前 | モチーフ | ファイル |
|---|---|---|---|
| money | 資金 | コイン / 札束 | `/sprites/ui/icon_money.png` |
| fans | ファン | ハート / 人 | `/sprites/ui/icon_fans.png` |
| employees | 従業員 | 人シルエット | `/sprites/ui/icon_employees.png` |
| works | 作品数 | ゲーム箱小 | `/sprites/ui/icon_works.png` |

### 5-4. PixelLab 発注プロンプト（アイコン用）

`pixelart-prompting` §10-0 に従い `create_map_object` を使う（1 gen / 方向句不要）。

```
pixel art game UI icon of a [モチーフ], 32x32 pixels,
single object centered with transparent background,
Kairosoft Game Dev Story style game menu icon,
thick black outline, flat shading,
bright saturated palette (matching the project palette: cream background, brown frame, dark navy text),
no perspective, no isometric (this is a flat UI icon, not an isometric world object),
clear silhouette readable at small size,
clean pixel grid no anti-aliasing
```

⚠ **オフィス画面の家具と違い、UI アイコンは「アイソメではなくフラット」**。`isometric` 句は入れない（入れると 3D 見せが混じる）。
⚠ **`single object centered`** を明示しないと装飾が散る。
⚠ **`readable at small size`** で 32px サイズでもシルエットが読めるよう誘導。

### 5-5. PixelIcon コンポーネント仕様

`src/components/ui/PixelIcon.tsx`

```tsx
type PixelIconProps = {
  src: string;       // /sprites/ui/icon_*.png
  size?: 8 | 16 | 32;  // ベースサイズ（実表示は 2x）
  scale?: 1 | 2 | 3;  // 倍率（デフォルト 2）
  alt: string;       // アクセシビリティ必須
};
```

```css
.pixel-icon {
  image-rendering: pixelated;
  display: inline-block;
  object-fit: none;  /* スケーリング歪み防止 */
}
```

---

## 6. image-rendering: pixelated 強制

### 6-1. グローバル強制

`src/styles/global.css` の冒頭で全 img / sprite に強制：

```css
img,
canvas,
[class*='sprite'],
[class*='pixel-'],
.pixel-icon,
.pixel-window {
  image-rendering: pixelated;
  image-rendering: -moz-crisp-edges;        /* Firefox */
  image-rendering: -webkit-crisp-edges;     /* 古い WebKit */
  -ms-interpolation-mode: nearest-neighbor; /* 古い IE */
}
```

### 6-2. background-image にも適用

```css
.with-pixel-bg {
  background-image: url('/sprites/ui/...');
  image-rendering: pixelated;
}
```

### 6-3. スケール倍率は整数のみ

| ✅ OK | ❌ NG |
|---|---|
| transform: scale(2) | transform: scale(1.5) |
| width: 64px（32px の 2x） | width: 50px |
| zoom: 3 | zoom: 1.7 |

⚠ 1.5x や 2.5x は **必ずアンチエイリアスが発生**してピクセル感が崩れる。
⚠ メディアクエリでもサイズを倍率で持ち、`min-width: 1280px → scale 3, else scale 2` のように分岐。

---

## 7. アニメーション制約

### 7-1. step() 関数で離散

```css
@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

.cursor-blink {
  animation: blink 600ms steps(2) infinite;
}
```

✅ `steps(N)` で N コマ離散表示
❌ `ease-out` / `ease-in` / `cubic-bezier` 系は禁止（滑らかすぎる）
❌ `transition: all 300ms` 系も禁止（指定プロパティ + steps で）

### 7-2. duration スケール

| 用途 | duration | 関数 |
|---|---|---|
| hover ハイライト | 100ms | `steps(1)` または瞬時切替 |
| ボタン押下フィードバック | 200ms | `steps(2)` |
| モーダル開閉 | 200ms | `steps(4)`（4 コマ） |
| アイコン揺れ・点滅 | 400ms | `steps(2)` |
| カーソル点滅 | 600ms | `steps(2)` |

```css
.pixel-button {
  transition: background-color 100ms steps(1), transform 200ms steps(2);
}

.modal-enter {
  animation: modal-pop-in 200ms steps(4) forwards;
}

@keyframes modal-pop-in {
  0%   { transform: scale(0); }
  25%  { transform: scale(0.5); }
  50%  { transform: scale(1); }
  75%  { transform: scale(1.1); }
  100% { transform: scale(1); }
}
```

### 7-3. ❌ 禁止リスト

- `transition: all` — 指定プロパティを明示
- `ease-*` / `cubic-bezier()` — `steps()` のみ
- `transform: scale(1.05)` 等の半端な拡大率 — 整数倍 or 大胆な変化のみ
- `opacity: 0.5` のフェード — 完全 0 or 完全 1 を切り替える
- `box-shadow` のソフトな影 — `0 2px 0 #000` のようにハードに

---

## 8. 入力（マウス + キーボード）

### 8-1. マウスクリック必須

- 全 UI 要素は **クリック / タップで操作可能**
- メニュー / ボタン / モーダル閉じる X / 一覧の項目選択
- `cursor: pointer` を全クリッカブル要素に

### 8-2. キーボード操作対応

| キー | 動作 |
|---|---|
| **矢印キー（←↑→↓）** | フォーカス移動（メニュー / リスト） |
| **Enter** | 決定・選択 |
| **Esc** | モーダル閉じる・戻る |
| **Tab** | フォーカス移動（標準） |

実装方針：
- 各 UI コンポーネントに `tabIndex={0}` を必須
- フォーカス時に **ピクセル枠でハイライト**（`outline` ではなく専用クラスで枠を切り替え）
- `onKeyDown` でキー操作を捕捉
- Zustand store にフォーカス位置を持って画面遷移をまたいでも復帰可

```tsx
// PixelMenuBar の例
const [focusIndex, setFocusIndex] = useState(0);

const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'ArrowRight') setFocusIndex(i => Math.min(i + 1, menuItems.length - 1));
  if (e.key === 'ArrowLeft')  setFocusIndex(i => Math.max(i - 1, 0));
  if (e.key === 'Enter')      menuItems[focusIndex].action();
};
```

### 8-3. フォーカスハイライト

```css
.pixel-button:focus-visible,
.pixel-menu-item--focused {
  /* outline ではなく専用枠スプライトを背景に重ねる */
  background-image: url('/sprites/ui/focus_frame.png');
  background-size: 100% 100%;
  image-rendering: pixelated;
  outline: none;  /* デフォルトの outline は消す */
}
```

⚠ ブラウザデフォルトの `outline: 2px solid blue` は禁止（ピクセル感破壊）。専用フレームスプライトに置き換える。

---

## 9. コンポーネント実装サマリ

### 9-1. 新規作成するコンポーネント

| ファイル | 役割 | 主要 props |
|---|---|---|
| `src/components/ui/PixelWindow.tsx` | 9-slice ウィンドウ枠 | `variant`, `title`, `children` |
| `src/components/ui/PixelButton.tsx` | 3 状態ボタン | `variant`, `size`, `onClick`, `children` |
| `src/components/ui/PixelMenuBar.tsx` | オフィス下部メニュー | `items`, `onSelect` |
| `src/components/ui/PixelStatusBar.tsx` | 上部常駐ステータス | `money`, `fans`, `employees`, `works` |
| `src/components/ui/PixelModal.tsx` | モーダル基盤 | `open`, `onClose`, `title`, `children` |
| `src/components/ui/PixelIcon.tsx` | アイコン描画 | `src`, `size`, `scale`, `alt` |

### 9-2. PixelButton の 3 状態

| 状態 | スプライト | 文字色 | スタイル |
|---|---|---|---|
| **idle** | `/sprites/ui/btn_idle.png` | `dark navy` | 通常 |
| **hover** | `/sprites/ui/btn_hover.png` | `accent-red` | 1 px 上にせり出し |
| **press** | `/sprites/ui/btn_press.png` | `dark navy` | 1 px 下に沈む |

```tsx
type PixelButtonProps = {
  variant?: 'default' | 'primary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
};
```

```css
.pixel-button {
  background-image: url('/sprites/ui/btn_idle.png');
  /* 9-slice for button */
  border-image-slice: 4 fill;
  border-image-width: 8px;
  border-style: solid;
  border-width: 8px;
  padding: 4px 12px;
  font-family: var(--font-jp);
  font-size: 12px;
  cursor: pointer;
  transition: transform 100ms steps(1);
}
.pixel-button:hover {
  background-image: url('/sprites/ui/btn_hover.png');
  transform: translateY(-1px);
}
.pixel-button:active {
  background-image: url('/sprites/ui/btn_press.png');
  transform: translateY(1px);
}
```

### 9-3. PixelMenuBar のレイアウト

```
┌────────────────────────────────────────────────────────┐
│  [計画]  [採用]  [規模]  [作品]  [図鑑]  [実績]  [設定]  │
└────────────────────────────────────────────────────────┘
```

- 高さ：64 px（32px アイコン + 余白 16px 上下）
- 横並び 7 アイコン + ラベル（下に 12px テキスト）
- 選択中はアイコン全体に `accent-yellow` の縁取り（focus_frame スプライト）
- マウスホバーで 1px 上にせり出し

### 9-4. PixelStatusBar のレイアウト

```
┌──────────────────────────────────────────────────┐
│ 💰¥12,345  👥1,234 fans  🧑‍💻8 emp  📚3 works     │
└──────────────────────────────────────────────────┘
```

- 高さ：32 px
- 4 アイコン + 数値を横並び
- 数値は **PressStart2P フォント**（`.pixel-num` クラス）
- 背景は `bg-dark` クリーム文字 or `bg-light` 濃い文字（明るさはオフィス画面の色味と相談）

### 9-5. PixelModal のレイアウト

```
   ┌───────────────────────────────┐
   │  タイトル                  [X] │ ← タイトルバー（高さ 32px）
   ├───────────────────────────────┤
   │                                │
   │       モーダル内容              │
   │                                │
   ├───────────────────────────────┤
   │              [ キャンセル ] [ OK ] │ ← フッター（高さ 48px）
   └───────────────────────────────┘
```

- オーバーレイ：`bg-dark` 67% 半透明（画面全体）
- 中央配置、最大幅 480px
- 開閉アニメ：`modal-pop-in` 200ms steps(4)
- Esc で閉じる、X ボタンクリックで閉じる、オーバーレイクリックで閉じる

---

## 10. アセット発注計画（PixelLab）

### 10-1. 必要アセット一覧

| カテゴリ | 個数 | サイズ | gen 数 |
|---|---|---|---|
| メニューアイコン | 7 | 32×32 | 7 |
| ステータスアイコン | 4 | 16×16 | 4 |
| 9-slice ウィンドウ枠（standard） | 1 | 24×24 | 1 |
| 9-slice ウィンドウ枠（emphasis） | 1 | 24×24 | 1 |
| 9-slice ウィンドウ枠（modal） | 1 | 36×36 | 1 |
| ボタン 3 状態 | 3 | 24×24 | 3 |
| フォーカス枠 | 1 | 24×24 | 1 |
| カーソル / 選択枠（8px 点線） | 1 | 8×8 | CSS で可 |
| **合計** | | | **18 gen** |

→ `pixelart-prompting` §6-2 のコスト管理で 20 gen 程度の見込み。

### 10-2. 発注順序

1. **9-slice 枠 4 種**（standard / emphasis / modal / button idle）を先に発注
2. **ボタン残り 2 状態**（hover / press）を idle の `style_images` 参照で連鎖発注
3. **メニューアイコン 7 種**（同じ style_images でパレット統一）
4. **ステータスアイコン 4 種**（同上）
5. **フォーカス枠**（最後、ピンク or 黄色の点滅枠）

### 10-3. 9-slice の手動分割手順

PixelLab で 24×24 単一画像を生成 → ImageMagick で 9 分割は不要（border-image-slice で CSS 側で扱える）。

ただし **角が滲んでないか確認**：
```bash
magick identify -format '%wx%h' public/sprites/ui/window_standard.png
# 24x24 か確認
```

---

## 11. NG / OK パターン集

| ❌ NG | ✅ OK |
|---|---|
| `rounded-lg` で角丸ボタン | 直角ボタン（9-slice） |
| `font-family: 'Inter'` | `font-family: 'DotGothic16'` |
| `font-size: 14px` | `font-size: 12px` or `16px` |
| `transition: all 300ms ease-out` | `transition: bg-color 100ms steps(1)` |
| `box-shadow: 0 4px 8px rgba(0,0,0,0.1)` | `box-shadow: 0 2px 0 #000`（ハード影） |
| `transform: scale(1.05)` | `transform: translateY(-1px)`（整数 px） |
| `outline: 2px solid blue` | 専用 focus_frame スプライト |
| `linear-gradient(...)` 背景 | 単色 or 9-slice テクスチャ |
| `<button>` をそのまま使う | `<PixelButton>` でラップ |
| Tailwind class（`bg-blue-500`） | CSS 変数（`var(--c-accent-blue)`） |
| 1.5x / 2.5x スケール | 1x / 2x / 3x のみ |
| アンチエイリアスかかった文字 | `font-smooth: never` 強制 |
| `image-rendering: auto` の sprite | `image-rendering: pixelated` 必須 |

---

## 12. 検証プロトコル（コンポーネント実装後）

### 12-1. 個別コンポーネント検証

新しく作った UI コンポーネントは以下をチェック：

```
□ フォントが DotGothic16 / PressStart2P になっているか
□ font-smooth: never が効いて文字が drawing without anti-alias か
□ font-size が 8 / 12 / 16 / 24 のいずれかか
□ image-rendering: pixelated が効いて拡大しても滲まないか
□ 9-slice 枠の角が引き伸ばされていないか
□ transition が steps() で離散か
□ scale 倍率が整数か
□ クリックで反応するか
□ Tab / 矢印 / Enter で操作できるか
□ Esc でモーダルが閉じるか
```

### 12-2. 統合検証（OfficeScreen 全体）

```
□ 画面上部に PixelStatusBar が固定表示
□ 画面中央に OfficeView（既存）
□ 画面下部に PixelMenuBar が固定表示
□ 各メニューアイコンクリックで対応する画面遷移 or モーダル開く
□ モーダル open 時にオーバーレイで背景クリック不可
□ Playwright スクリーンショットで全体のドット感が統一
```

### 12-3. ブラウザ実機検証（必須）

```bash
npm run dev
# → http://localhost:5173 で起動
# 1. 初期画面が OfficeScreen か
# 2. 各メニューアイコンを順番にクリック
# 3. キーボード矢印 + Enter で同じ操作ができるか
# 4. モーダルを Esc で閉じられるか
# 5. ブラウザを 1.5 倍ズーム → ピクセルが滲まないか
```

### 12-4. 自己チェック報告フォーマット

```
## 自己チェック結果（game-ui-design §12）
- フォント： [✅ DotGothic16 / PressStart2P 適用]
- ピクセルレンダリング： [✅ pixelated 強制 / ⚠️ 一部 auto]
- 9-slice 枠： [✅ 角崩れなし]
- アニメ離散性： [✅ steps() / ⚠️ ease-out 残存]
- キーボード操作： [✅ 矢印・Enter・Esc 動作]
- 統合確認： [✅ オフィス画面 → メニュー → モーダル 動作]
- 残課題： [リストアップ]
```

---

## 13. 過去の失敗パターンと学び

過去の典型的な失敗と対処：

| 失敗 | 原因 | 教訓 |
|---|---|---|
| ボタンに `rounded-lg` を付けて角丸 | Tailwind デフォルト思考 | 直角を原則、9-slice 枠で囲む |
| `transition: all` で全 prop アニメ | コピペ | 対象 prop を明示、`steps()` のみ |
| `font-size: 14px` で文字にじむ | デザインガイド未読 | 8 / 12 / 16 / 24 のみ |
| `outline: 2px solid blue` の focus | ブラウザデフォルト | 専用 focus_frame スプライト |
| 半透明 hover （`opacity: 0.8`） | モダン UI 思考 | 完全切り替え or 1px ずれ |
| アイコンを 1.5x でスケール | レスポンシブ意識 | 整数倍のみ（1x/2x/3x） |
| `box-shadow: 0 4px 12px rgba(0,0,0,0.1)` | Material 思考 | `0 2px 0 #000` ハード影 |
| 文字に `text-shadow` で滲ませる | カッコよさ重視 | drop-shadow 一切なし |
| Tailwind `bg-blue-500` をそのまま使う | utility-first 思考 | CSS 変数 `var(--c-accent-blue)` |
| 1 セッション内で baseline-ui の指針も混ぜる | スキル多用混乱 | このプロジェクトでは game-ui-design 一択 |

---

## 14. 関連ファイル・スキル

### プロジェクト内

- [src/styles/global.css](/home/shsk/git/game/src/styles/global.css) — フォント・image-rendering・CSS 変数
- [src/components/ui/](/home/shsk/git/game/src/components/ui/) — UI コンポーネント置き場（新規）
- [src/features/office/OfficeScreen.tsx](/home/shsk/git/game/src/features/office/OfficeScreen.tsx) — トップ画面
- [src/components/OfficeView.tsx](/home/shsk/git/game/src/components/OfficeView.tsx) — オフィス世界スプライト
- [public/sprites/ui/](/home/shsk/git/game/public/sprites/ui/) — UI アセット（新規）

### 並列スキル

- **`office-visual-design`** — オフィス世界観・パース・家具配置（**世界の中**）
- **`pixelart-prompting`** — PixelLab MCP 発注テクニック（**素材を作る方法**）
- **`game-ui-design`（本スキル）** — UI 実装規格（**世界を操作する HUD**）

### 適用しないスキル

- ❌ **`baseline-ui`** — Tailwind/モダン CSS 前提。本プロジェクトでは使わない

### 外部参考

- Kairosoft Game Dev Story のスクリーンショット（UI レイアウト参考）
- DotGothic16: https://fonts.google.com/specimen/DotGothic16
- PressStart2P: https://fonts.google.com/specimen/Press+Start+2P

---

## 15. このスキルの更新ルール

- ユーザーから新しい要望が来たら **§4 9-slice** or **§7 アニメ** or **§11 NG/OK** に追記
- フォント / カラー / 規格を変えたら **§2 / §3** を改訂
- 新規 UI コンポーネントを作ったら **§9** に追加
- 過去の失敗は **§13** に教訓のみ残す
- **古い基準は削除する**（混乱防止のため）

### 更新ログ

- 2026-06-08：初版。確定方針 = ドット絵 + 9-slice + ピクセルフォント。Kairosoft Game Dev Story 風 UI。baseline-ui SKILL は適用外と明記。
