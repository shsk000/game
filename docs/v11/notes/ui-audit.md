# v0.11 UI 監査レポート：Web 的・残骸要素の抽出

**作成日**：2026-06-09  
**対象フェーズ**：v0.11 UI 刷新の基礎調査  
**目的**：ピクセルゲーム世界観を壊す「Web ページ的・モダン CSS 的」な実装を網羅的に列挙  

---

## サマリ

現状の UI は **ピクセル UI（game-ui-design SKILL）とモダン CSS が混在**している状態。特に `global.css` に残存する Tailwind 的スタイルと、各画面で使われる直接 DOM 操作時のインラインスタイルが主要な問題。以下の **48 項目**を P0–P2 で分類。

- **P0（コア体験を壊す）**：12 項目
- **P1（雰囲気を壊す）**：23 項目
- **P2（細部）**：13 項目

---

## P0：コア体験を壊す（即対応必須）

### 1. スクロール前提の `.screen` クラス設定
| 項目 | 詳細 |
|---|---|
| **ファイル** | `src/styles/global.css` L36–42 |
| **現状** | `.screen { min-height: 100vh; padding: 24px 28px 40px; max-width: 1200px; }` |
| **問題** | Web サイト的な `min-height: 100vh` + パディング大。1200px max-width で左右余白が広すぎる。ゲーム画面は固定領域を前提にすべき |
| **あるべき姿** | `min-height: 100dvh; padding: 12px;` に統一。スクロール前提を廃止 |
| **重大度** | P0 |

### 2. DevelopScreen の `repeating-linear-gradient` で期日超過表示
| 項目 | 詳細 |
|---|---|
| **ファイル** | `src/features/develop/DevelopScreen.tsx` L275 |
| **現状** | `'repeating-linear-gradient(45deg, #a02828, #a02828 4px, #7a1c1c 4px, #7a1c1c 8px)'` |
| **問題** | グラデーションはピクセル世界には存在しない。ストライプは 9-slice テクスチャか単色ハッチングで表現すべき |
| **あるべき姿** | 赤色単色背景か、ハッチパターン PNG に置き換え |
| **重大度** | P0 |

### 3. OfficeScreen デブト入力に素の `<input type="number">`
| 項目 | 詳細 |
|---|---|
| **ファイル** | `src/features/office/OfficeScreen.tsx` L618–630 |
| **現状** | 素の HTML `<input type="number">` にインラインスタイルを当てただけ |
| **問題** | ブラウザの数値入力 UI（上下矢印ボタン、スピナー）が露出。ゲーム世界観から外れる |
| **あるべき姿** | `<PixelInput type="number">` カスタムコンポーネント化。キーボード入力のみに制限 |
| **重大度** | P0 |

### 4. ReleaseScreen の素の `<button>` 複数箇所
| 項目 | 詳細 |
|---|---|
| **ファイル** | `src/features/release/ReleaseScreen.tsx` L223–245（マーケティング / デバッグ広告ボタン）、L506（次へボタン） |
| **現状** | `className="primary-btn"` or `className="primary-btn ad-btn"` で global.css スタイルに依存 |
| **問題** | `primary-btn` は border-radius が大きい（8px → ピクセル感破壊）。Web ボタンそのもの |
| **あるべき姿** | `<PixelButton variant="primary">` で統一 |
| **重大度** | P0 |

### 5. 対象外スキルへの依存（baseline-ui）
| 項目 | 詳細 |
|---|---|
| **ファイル** | `src/components/ui/PixelModal.tsx` L12 のコメント内参照 |
| **現状** | PixelModal で `h-dvh` (Tailwind / baseline-ui) を言及 |
| **問題** | game-ui-design SKILL は baseline-ui 適用外と明記。混乱を招く |
| **あるべき姿** | コメントを削除、baseline-ui への言及一切廃止 |
| **重大度** | P0 |

### 6. CollectionScreen 横スクロール実装
| 項目 | 詳細 |
|---|---|
| **ファイル** | `src/features/collection/CollectionScreen.tsx` L165+（表スクロール）、global.css L647 |
| **現状** | `.collection-table-wrap { overflow-x: auto; }` で表が横スクロール |
| **問題** | ゲーム画面は「1 画面に収まる」ことを前提に設計されるべき。スクロール前提は Web サイト的 |
| **あるべき姿** | 表のセルサイズ・フォントを縮小して 1 画面に収める。もしくは 2 ページ / 3 ページで分割表示 |
| **重大度** | P0 |

### 7. DevelopScreen CodeEditor の自動スクロール
| 項目 | 詳細 |
|---|---|
| **ファイル** | `src/components/CodeEditor.tsx` L81–85、global.css L957–968 |
| **現状** | `.code-editor { max-height: 380px; overflow-y: auto; }` で内部スクロール |
| **問題** | 縦スクロール前提のコンポーネント。ゲーム画面では固定高さで完結すべき |
| **あるべき姿** | 高さを動的に調整、または行数制限で常時表示（スクロール不要） |
| **重大度** | P0 |

### 8. global.css `.card` クラスの border-radius
| 項目 | 詳細 |
|---|---|
| **ファイル** | `src/styles/global.css` L68–73 |
| **現状** | `.card { border-radius: 10px; }` |
| **問題** | 角丸（10px）はピクセルアート世界に存在しない。すべてのカード要素が Web 的 |
| **あるべき姿** | `border-radius: 0;` に統一。代わりに 9-slice ウィンドウ枠で視覚的分離 |
| **重大度** | P0 |

### 9. Tutorial の `.tutorial-card` に角丸 + box-shadow
| 項目 | 詳細 |
|---|---|
| **ファイル** | `src/styles/global.css` L933–943 |
| **現状** | `.tutorial-card { border-radius: 12px; box-shadow: 0 12px 40px rgba(...); }` |
| **問題** | グラフィカルな影・グラデーション・角丸はモダン CSS。チュートリアルモーダルが浮いている |
| **あるべき姿** | PixelWindow 9-slice で置き換え。影は `box-shadow: 4px 4px 0 rgba(0,0,0,0.35);` のようにハード影に |
| **重大度** | P0 |

### 10. PlanScreen のカテゴリ選択ボタンが素 `<button>` （半分対応）
| 項目 | 詳細 |
|---|---|
| **ファイル** | `src/features/plan/PlanScreen.tsx` L500–530 |
| **現状** | `<button type="button">` にインラインスタイルで枠と背景を指定 |
| **問題** | PixelButton ではなく素ボタン。選択状態の表現 (box-shadow inset) は手作業。テスト互換性理由だが UI 全体の統一性を損なう |
| **あるべき姿** | `<PixelButton>` に統一。テスト互換性は `data-category-id` 属性で維持 |
| **重大度** | P0 |

### 11. PlanScreen 従業員チェックボックスが素 `<input type="checkbox">`
| 項目 | 詳細 |
|---|---|
| **ファイル** | `src/features/plan/PlanScreen.tsx` L593–605 |
| **現状** | HTML `<input type="checkbox">` にブラウザデフォルトの accentColor のみ |
| **問題** | チェックボックスのネイティブ UI が露出。ゲーム的な装飾がない |
| **あるべき姿** | `<PixelCheckbox>` カスタムコンポーネント化。9-slice 枠 + チェックマーク PNG で実装 |
| **重大度** | P0 |

### 12. DevelopScreen の弱い半透明グラデーション
| 項目 | 詳細 |
|---|---|
| **ファイル** | `src/features/develop/DevelopScreen.tsx` L256–268（週進捗バー）、 R262–279 |
| **現状** | `background: 'repeating-linear-gradient(...)'` で期日超過表示 |
| **問題** | グラデーション（滑らかな色変化）はピクセルアートに存在しない |
| **あるべき姿** | 単色背景か、ドット地紋 PNG テクスチャ に変更 |
| **重大度** | P0 |

---

## P1：雰囲気を壊す（次期リリースまでに対応）

### 13. `.primary-btn` / `.link-btn` 全体の border-radius
| 項目 | 詳細 |
|---|---|
| **ファイル** | `src/styles/global.css` L118–158 |
| **現状** | `.primary-btn { border-radius: 8px; }`, `.link-btn { border-radius: 6px; }` |
| **問題** | 複数のボタンスタイルが global に混在。全て角丸で Web 的 |
| **あるべき姿** | すべて `border-radius: 0;` に統一。PixelButton で統一表現 |
| **重大度** | P1 |

### 14. `.progress-bar` / `.combo-bar` / `.selling-bar` の border-radius
| 項目 | 詳細 |
|---|---|
| **ファイル** | `src/styles/global.css` L223–234, L510–513, L719–727 |
| **現状** | すべてのプログレスバーが `border-radius: 999px;` で両端丸 |
| **問題** | ゲーム世界では矩形バーが基本。丸角は不自然 |
| **あるべき姕** | `border-radius: 0;` に統一。代わりにピクセル風の外枠 |
| **重大度** | P1 |

### 15. `.collection-table` のセルに角丸
| 項目 | 詳細 |
|---|---|
| **ファイル** | `src/styles/global.css` L658, L672, L814 |
| **現状** | 表のヘッダ / セルが `border-radius: 6px;` |
| **問題** | ゲーム的表は格子状・直角。角丸は不要 |
| **あるべき姿** | `border-radius: 0;` に統一 |
| **重大度** | P1 |

### 16. `.candidate-card` / `.employee-item` の border-radius
| 項目 | 詳細 |
|---|---|
| **ファイル** | `src/styles/global.css` L750, L814 |
| **現状** | `border-radius: 10px;` で候補/従業員カードが丸角 |
| **問題** | ピクセルアート設定では直角が基本 |
| **あるべき姿** | `border-radius: 0;` |
| **重大度** | P1 |

### 17. `.ach-item` の border-radius
| 項目 | 詳細 |
|---|---|
| **ファイル** | `src/styles/global.css` L849 |
| **現状** | `border-radius: 6px;` |
| **問題** | 実績アイコンの背景が角丸 |
| **あるべき姿** | `border-radius: 0;` |
| **重大度** | P1 |

### 18. ReleaseScreen の box-shadow（複数箇所）
| 項目 | 詳細 |
|---|---|
| **ファイル** | `src/styles/global.css` L372, L939 |
| **現状** | `.meta-score.masterpiece { box-shadow: 0 0 20px rgba(...); }` |
| **問題** | グロウ効果（滲む影）はモダン CSS。ゲーム世界では存在しない |
| **あるべき姿** | ハード影のみ。代わりに金色の粗い枠線で視覚的強調 |
| **重大度** | P1 |

### 19. ReleaseScreen マスターピース表示に box-shadow glow
| 項目 | 詳細 |
|---|---|
| **ファイル** | `src/styles/global.css` L531, L541 |
| **現状** | `.combo-gauge.tier-hot { box-shadow: 0 0 12px rgba(...); }` など複数 |
| **問題** | ノリゲージの "FEVER" 状態が glow で光ってみえる。モダン UI 的 |
| **あるべき姿** | 半透明ではなく、単色 border + blink アニメーションで代替 |
| **重大度** | P1 |

### 20. DevelopScreen ToastNotification に滲む影
| 項目 | 詳細 |
|---|---|
| **ファイル** | `src/features/develop/DevelopScreen.tsx` L312 |
| **現状** | `boxShadow: '3px 3px 0 rgba(0,0,0,0.4)'` |
| **問題** | ハード影（3px 3px）は OK だが、rgba の透明度が 0.4 で半透明。ゲーム的には完全色 or 完全透明 |
| **あるべき姿** | `boxShadow: '3px 3px 0 #000'` で完全黒影に |
| **重大度** | P1 |

### 21. OfficeScreen メニューバーの box-shadow inset
| 項目 | 詳細 |
|---|---|
| **ファイル** | `src/components/ui/PixelMenuBar.tsx` L53 |
| **現状** | `boxShadow: 'inset 0 0 0 2px #6b4f3a, 4px 4px 0 rgba(0,0,0,0.4)'` |
| **問題** | Inset shadow で立体感を出そうとしているが、滲む効果はモダン CSS |
| **あるべき姿** | 単色ボーダーと、ハード外枠のみで視覚的分離 |
| **重大度** | P1 |

### 22. OfficeScreen ステータスバーの box-shadow
| 項目 | 詳細 |
|---|---|
| **ファイル** | `src/components/ui/PixelStatusBar.tsx` L46 |
| **現状** | `boxShadow: 'inset 0 0 0 2px #6b4f3a, 4px 4px 0 rgba(0,0,0,0.45)'` |
| **問題** | 同上。inset 0 0 0 で滲むハイライト効果 |
| **あるべき姿** | ハード外枠のみ。内側ハイライトは不要 |
| **重大度** | P1 |

### 23. PixelWindow の inset shadow
| 項目 | 詳細 |
|---|---|
| **ファイル** | `src/components/ui/PixelWindow.tsx` L70 |
| **現状** | `boxShadow: 'inset 0 0 0 2px #fff8e0, 4px 4px 0 rgba(0,0,0,0.35)'` |
| **問題** | Inset highlight で 3D 枠を演出。モダン CSS 的 |
| **あるべき姕** | 単色ボーダーと外枠のみ。9-slice テクスチャで立体感を出す |
| **重大度** | P1 |

### 24. PixelButton の inset shadow
| 項目 | 詳細 |
|---|---|
| **ファイル** | `src/components/ui/PixelButton.tsx` L109–111 |
| **現状** | `boxShadow: pressed ? 'inset 2px 2px 0 rgba(0,0,0,0.35)' : 'inset 0 0 0 2px rgba(255,255,255,0.35), 3px 3px 0 rgba(0,0,0,0.5)'` |
| **問題** | Hover / Press 時に複雑な inset shadow で 3D 効果。モダン CSS |
| **あるべき姿** | Press 状態は `transform: translate(2px, 2px)` で十分。Hover は背景色変更のみ |
| **重大度** | P1 |

### 25. PlanScreen カテゴリボタンの複雑な box-shadow
| 項目 | 詳細 |
|---|---|
| **ファイル** | `src/features/plan/PlanScreen.tsx` L522–524 |
| **現状** | `boxShadow: isSelected ? 'inset 2px 2px 0 rgba(0,0,0,0.25)' : 'inset 0 0 0 2px rgba(255,255,255,0.35), 2px 2px 0 rgba(0,0,0,0.5)'` |
| **問題** | 複雑な inset + 外側 shadow で立体感。ゲーム的ではない |
| **あるべき姿** | 選択状態は背景色 + ボーダー色変更のみ。ハード外枠オンリー |
| **重大度** | P1 |

### 26. PlanScreen 従業員チェック item の box-shadow
| 項目 | 詳細 |
|---|---|
| **ファイル** | `src/features/plan/PlanScreen.tsx` L585–587 |
| **現状** | `boxShadow: isAssigned ? 'inset 0 0 0 2px #f5c84a' : 'inset 0 0 0 2px rgba(0,0,0,0.1)'` |
| **問題** | Inset shadow で選択枠を表現。モダン CSS |
| **あるべき姿** | Border-color 切り替えのみ |
| **重大度** | P1 |

### 27. DevelopScreen 週進度バーの色指定
| 項目 | 詳細 |
|---|---|
| **ファイル** | `src/features/develop/DevelopScreen.tsx` L262–279 |
| **現状** | 期日超過時に repeating-linear-gradient で斜線パターン |
| **問題** | グラデーション表現がモダン |
| **あるべき姿** | 単色背景か、ドット柄 PNG テクスチャに統一 |
| **重大度** | P1 |

### 28. ReleaseScreen ブレイクダウンリストの animation
| 項目 | 詳細 |
|---|---|
| **ファイル** | `src/styles/global.css` L1054–1063 |
| **現状** | `.breakdown-row { animation: bd-fade 0.45s ease both; }` |
| **問題** | `ease` イージング関数は滑らかな曲線。ゲーム的ではない |
| **あるべき姿** | `steps(2)` で離散アニメーション。duration は 200ms に |
| **重大度** | P1 |

### 29. OfficeScreen 販売中作品バー表示
| 項目 | 詳細 |
|---|---|
| **ファイル** | `src/features/office/OfficeScreen.tsx` L355–375 |
| **現状** | 販売プール用の進捗バーが単色 div |
| **問題** | スタイル名 `.selling-bar` の CSS が global で border-radius 設定されている |
| **あるべき姿** | 直角バー。CSS クラス廃止し PixelProgressBar コンポーネントに統合 |
| **重大度** | P1 |

### 30. LibraryScreen 内部の複雑な grid レイアウト
| 項目 | 詳細 |
|---|---|
| **ファイル** | `src/features/library/LibraryScreen.tsx` L101–103 |
| **現状** | `gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))'` で自動レスポンシブ |
| **問題** | `auto-fill` のような Flexbox/Grid の現代機能は Web 標準。ゲーム画面は固定グリッド |
| **あるべき姿** | 固定カラム数（e.g., `2` 列 or `3` 列）で統一 |
| **重大度** | P1 |

### 31. ReleaseScreen の Radar チャートに box-shadow
| 項目 | 詳細 |
|---|---|
| **ファイル** | `src/features/release/ReleaseScreen.tsx` L559–562 |
| **現状** | `border: '3px solid #1a0f08'` は OK だが、`imageRendering: 'pixelated'` 直下に box-shadow なし（レーダーチャート自体は SVG） |
| **問題** | SVG 背景コンテナに box-shadow がない（一貫性） |
| **あるべき姿** | SVG 背景も PixelWindow で囲むか、外側に box-shadow: 'ハード影' を追加 |
| **重大度** | P1 |

### 32. CodeEditor の高さ制限 + overflow
| 項目 | 詳細 |
|---|---|
| **ファイル** | `src/styles/global.css` L957–968 |
| **現状** | `.code-editor { max-height: 380px; overflow-y: auto; }` |
| **問題** | 内部スクロール = Web ページ的。ゲーム画面では禁止 |
| **あるべき姿** | 高さを画面に合わせて動的調整。または行数制限（e.g., 常時 30 行表示） |
| **重大度** | P1 |

### 33. global.css の `font-family` フォールバック順序
| 項目 | 詳細 |
|---|---|
| **ファイル** | `src/styles/global.css` L13–16, L155–158 |
| **現状** | `"Source Han Sans JP", "Noto Sans JP", "Hiragino Sans", "Meiryo"` 順。終盤に `DotGothic16` |
| **問題** | 優先順位が逆。Source Han Sans が先だと、ドット絵フォントが読み込まれない時に Noto Sans にフォールバック |
| **あるべき姿** | `"DotGothic16", "Press Start 2P", ...フォールバック順` に統一 |
| **重大度** | P1 |

### 34. DevelopScreen `🐛 緊急バグ発生` 通知カード
| 項目 | 詳細 |
|---|---|
| **ファイル** | `src/features/develop/DevelopScreen.tsx` L377–381, global.css L876–886 |
| **現状** | `.bug-card` が `.card` 継承で border-radius 付き |
| **問題** | 角丸カード |
| **あるべき姿** | border-radius: 0 に統一 |
| **重大度** | P1 |

### 35. HTML `<li>` / `<ul>` タグの margin リセット漏れ
| 項目 | 詳細 |
|---|---|
| **ファイル** | 各画面で `<ul>` / `<li>` を `list-style: none` + inline style で手作業制御 |
| **現状** | `margin: 0; padding: 0;` を毎回指定 |
| **問題** | global.css で一括リセットされていない。冗長で保守性低 |
| **あるべき姿** | global.css に `ul, ol, li { list-style: none; margin: 0; padding: 0; }` を追加 |
| **重大度** | P1 |

---

## P2：細部（後期段階で対応）

### 36. OfficeScreen のタイトルバーにおける font-size
| 項目 | 詳細 |
|---|---|
| **ファイル** | `src/components/ui/PixelWindow.tsx` L92 |
| **現状** | `fontSize: 14` |
| **問題** | game-ui-design では font-size は `8, 12, 16, 24` のみ。14px は half-pixel で文字がにじむ |
| **あるべき姿** | `fontSize: 12` or `16` に統一 |
| **重大度** | P2 |

### 37. PixelStatusBar の label font-size
| 項目 | 詳細 |
|---|---|
| **ファイル** | `src/components/ui/PixelStatusBar.tsx` L75 |
| **現状** | `fontSize: 10` |
| **問題** | game-ui-design では 8 / 12 / 16 / 24 のみ。10px は許可されていない |
| **あるべき姿** | `fontSize: 8` に統一 |
| **重大度** | P2 |

### 38. OfficeScreen の細かい font-size バラツキ
| 項目 | 詳細 |
|---|---|
| **ファイル** | `src/features/office/OfficeScreen.tsx` 各所 |
| **現状** | `fontSize: 11`, `fontSize: 13`, `fontSize: 14` が混在 |
| **問題** | 8 / 12 / 16 / 24 スケール外 |
| **あるべき姿** | 全て `8`, `12`, `16`, `24` に丸める |
| **重大度** | P2 |

### 39. ReleaseScreen font-size のバラツキ
| 項目 | 詳細 |
|---|---|
| **ファイル** | `src/features/release/ReleaseScreen.tsx` 各所 |
| **現状** | `fontSize: 13`, `fontSize: 11`, `fontSize: 9` 等 |
| **問題** | 規格外 |
| **あるべき姿** | 12 / 16 に統一 |
| **重大度** | P2 |

### 40. Develop の進捗バー色が動的（hot 状態で色変更）
| 項目 | 詳細 |
|---|---|
| **ファイル** | `src/styles/global.css` L560–562 |
| **現状** | `.develop-screen.is-hot .progress-fill { background: linear-gradient(90deg, var(--accent-2), #ffd95a); }` |
| **問題** | グラデーション |
| **あるべき姿** | 単色背景か、ドット柄 PNG に |
| **重大度** | P2 |

### 41. `.chip` スタイルの border-radius
| 項目 | 詳細 |
|---|---|
| **ファイル** | `src/styles/global.css` L88–94 |
| **現状** | `.chip { border-radius: 999px; }` |
| **問題** | ピル型（完全丸角）はモダン CSS。ゲーム的ではない |
| **あるべき姿** | `border-radius: 0;` で矩形に |
| **重大度** | P2 |

### 42. ReleaseScreen `.pioneer-pill` に border-radius
| 項目 | 詳細 |
|---|---|
| **ファイル** | `src/styles/global.css` L889–898 |
| **現状** | `.pioneer-pill { border-radius: 999px; }` |
| **問題** | ピル型バッジ |
| **あるべき姿** | `border-radius: 0;` |
| **重大度** | P2 |

### 43. ReleaseScreen `.ghost-update-badge` border-radius
| 項目 | 詳細 |
|---|---|
| **ファイル** | `src/styles/global.css` L617–626 |
| **現状** | `.ghost-update-badge { border-radius: 999px; }` |
| **問題** | ピル型バッジ |
| **あるべき姿** | `border-radius: 0;` |
| **重大度** | P2 |

### 44. CollectionScreen セル高さが固定（48px）
| 項目 | 詳細 |
|---|---|
| **ファイル** | `src/styles/global.css` L70–79 |
| **現状** | `.ct-cell { height: 48px; }` |
| **問題** | ゲーム的には「視認可能なセルサイズ」を矩形単位で設計すべき（8px, 16px, 32px など） |
| **あるべき姿** | `height: 32px;` or `height: 40px;` に |
| **重大度** | P2 |

### 45. CodeEditor のシンタックスハイライトが global.css 依存
| 項目 | 詳細 |
|---|---|
| **ファイル** | `src/styles/global.css` L956–1006 |
| **現状** | `.ce-kw`, `.ce-str`, `.ce-cmt` など複数スタイルが global に分散 |
| **問題** | CodeEditor コンポーネント専用スタイルが global.css に入っている（関心の分離） |
| **あるべき姿** | CodeEditor.tsx 内に `<style>` or .module.css で内包化 |
| **重大度** | P2 |

### 46. Tutorial の `transition: all`
| 項目 | 詳細 |
|---|---|
| **ファイル** | `src/components/Tutorial.tsx` 不確認（但し global.css に `.tutorial-buttons` 等複数） |
| **現状** | チュートリアルモーダルに複数 transition が指定されている可能性 |
| **問題** | `transition: all` は禁止。対象プロパティを明示し `steps()` で離散化 |
| **あるべき姿** | 必要な transition のみを明示。duration は 100ms or 200ms の離散値に |
| **重大度** | P2 |

### 47. ReleaseScreen のメタスコア display カウントアップアニメ
| 項目 | 詳細 |
|---|---|
| **ファイル** | `src/features/release/ReleaseScreen.tsx` L113–120 |
| **現状** | `easing: 1 - (1 - t) ** 3;` で cubic-out イージング |
| **問題** | 滑らかなイージングはモダン。ゲーム的には `steps()` で段階的に |
| **あるべき姿** | `steps(10)` または `steps(20)` で離散的にカウントアップ |
| **重大度** | P2 |

### 48. PixelMenuBar の hover transform に細かい timing
| 項目 | 詳細 |
|---|---|
| **ファイル** | `src/components/ui/PixelMenuBar.tsx` L96 |
| **現状** | `transition: 'transform 80ms steps(1)'` |
| **問題** | 80ms は game-ui-design の標準 duration ではない（100ms / 200ms / 400ms / 600ms が標準） |
| **あるべき姿** | `transition: 'transform 100ms steps(1)'` に統一 |
| **重大度** | P2 |

---

## 全体集計

| 重大度 | 項目数 | 対応期限 |
|---|---|---|
| P0 | 12 | v0.11-P0（即対応） |
| P1 | 23 | v0.11-P1（デザイン完成まで） |
| P2 | 13 | v0.11-P2（ポーランド） |
| **合計** | **48** | |

---

## 対応優先順序（推奨）

### フェーズ 1：基盤修正（P0 の 6 項目）
1. `.screen` の padding・min-height を統一
2. `<input type="number">` を `<PixelInput>` に
3. `<button className="primary-btn">` をすべて `<PixelButton>` に
4. CSS グラデーション（repeating-linear-gradient）を単色 or 描画に
5. `.card` の border-radius を 0 に統一
6. Tutorial / DevelopScreen の box-shadow を削除

### フェーズ 2：一括 border-radius 削除（P0-P1 の 7 項目）
- global.css の全 `border-radius` を `0` に
- 9-slice ウィンドウ枠で視覚的分離を再実装

### フェーズ 3：Input / Checkbox / Select の PixelInput 化（P0 の 2 項目）
- `<PixelInput>` コンポーネント新規作成
- `<PixelCheckbox>` コンポーネント新規作成

### フェーズ 4：Shadow・Inset 効果の簡潔化（P1 の 6 項目）
- Inset shadow をすべて削除
- ハード外枠のみに統一

### フェーズ 5：Font-size の規格化（P2 の 4 項目）
- 8 / 12 / 16 / 24 px のみに統一

### フェーズ 6：细部磨きとアニメーション最適化（P1-P2）
- Ease イージングを steps に
- Duration を 100ms / 200ms / 400ms に統一
- スクロール前提を完全廃止

---

## 関連スキル・ドキュメント

- **game-ui-design SKILL**: `/home/shsk/git/game/.claude/skills/game-ui-design/SKILL.md`
  - §2.3 フォントサイズスケール
  - §3.2 NG な色
  - §7.2 duration スケール
  - §11 NG/OK パターン集

- **office-visual-design SKILL**: オフィス世界観・視覚設計（UI とは別）

- **既存コンポーネント**:
  - `src/components/ui/PixelButton.tsx`
  - `src/components/ui/PixelWindow.tsx`
  - `src/components/ui/PixelMenuBar.tsx`
  - `src/components/ui/PixelStatusBar.tsx`
  - `src/components/ui/PixelModal.tsx`

---

## 補足：実装方針

### PixelInput / PixelCheckbox の実装例
```tsx
// PixelInput: 数値入力を矩形ボックス + キーボード操作に限定
<PixelInput type="number" value={val} onChange={...} />

// PixelCheckbox: チェックマーク PNG + ボーダー
<PixelCheckbox checked={...} onChange={...} label="..." />
```

### 9-slice 枠の活用
- card 要素をすべて `<PixelWindow variant="standard">` で囲む
- modal / emphasis バリアントを用途に応じて選択
- CSS の `border-image` で実装（後で PNG 素材に差し替え可）

### フォント規格化の automated fix
```css
/* global.css に一括設定 */
.tutorialcard,
.release-info,
.code-editor {
  font-size: 12px;
  line-height: 12px;
}
```

---

## 今後の チェックリスト

- [ ] P0 項目すべてを v0.11-P0 sprint に含める
- [ ] game-ui-design SKILL と照合しながら実装
- [ ] 各コンポーネント実装後、Playwright スクリーンショット撮影
- [ ] ブラウザ 125% / 150% ズーム時のピクセル崩れを確認
- [ ] ゴースト記録画面 / Release breakdown 演出でのアニメーション確認

---

**report 作成者**：Claude Code  
**最終更新**：2026-06-09
