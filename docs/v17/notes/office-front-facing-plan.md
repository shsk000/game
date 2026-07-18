# オフィス「正面向き素材のみ」化 計画（案）

> 状態: **実装完了（2026-07-12）**。OfficeView を新方式に全面置き換え、typecheck/lint/unit test(224件)/build 緑、実機（社員0/2/6人）で表示確認済み。office-visual-design スキルも全面改訂済み。
> 起票: 2026-07-11。オーナー相談「見下ろし2D（アイソメ）は素材作成がかなり大変。正面向き素材だけに変更したい」を受けて作成。
> 並走注意: v18（economy / advice / goals）の別計画が進行中。本計画のバージョン番号・着手順は 🔧（§8、未解消のまま実装完了＝v17扱いで進めた）。

---

## 1. 背景 — なぜアイソメをやめるか

現行確定仕様（office-visual-design スキル）はアイソメ 30°×30°（2:1 dimetric）＋ Sandbox 立方体規格。これが素材面で高コストになっている：

| 痛み | 実態 |
|---|---|
| **向きが 2 方向必須** | 机・椅子・人は SW / NE の 2 方向。2D 反転・回転は全面禁止（裏側は描けない）ため、**全て PixelLab 新規発注 = コスト2倍** |
| **方向指定が不安定** | prompt に方向句を大文字強制しても SE に倒れる事例あり。候補 4 枚全棄却→再発注のロスが常態化 |
| **立方体規格との整合レビュー** | N×M×H キューブ・3面可視・軸平行…の採用前チェックが毎回重い |
| **装飾も全部 2 方向** | 現在 public/sprites/office/ に bookshelf / clock / coffee_table / fridge / plant / sofa / trash / vending / water_cooler / whiteboard / window の **_se/_sw ペアが 11 種類**。家具を1つ増やすたび 2 発注 |

→ **「正面（南）向き 1 方向だけ」に規格を変えれば、発注数・レビュー・失敗リトライが構造的に半分以下になる。**

---

## 2. 提案する新規格（推奨案）

### 2-1. 視点 = 「3/4 オブリーク（一軸・南から見下ろし）」＋ 全素材 正面（南）向きのみ

現行スキル §2-3 の比較表で ❌ にしていた **RPG Maker VX/MV 方式**を採用に反転する：

| 項目 | 現行（アイソメ） | 新規格（正面向きのみ） |
|---|---|---|
| 視点 | 30°×30° 二軸、床はひし形 | **一軸 3/4 オブリーク**。床は**真上の正方形グリッド** |
| 素材の向き | SW / NE の 2 方向シート | **南（正面）1 方向のみ。回転・反転・裏側なし** |
| 見える面 | 上面＋正面＋側面の3面 | **上面＋正面の2面**（側面なし） |
| 壁 | SW/SE 2面 L字＋skew 投影 | **北壁の横帯 1 本のみ**（東西壁は省略 or 細帯） |
| 物体の軸 | アイソメ対角線に沿う | **画面と平行（軸ズレ問題が消滅）** |
| キャラの向き | 上段SW / 下段NE のリアル方式 | **全員カメラ向き（レトロ慣習方式）** |

テイスト（カイロソフト風・太アウトライン・フラットシェーディング・明るいパレット）は**変更なし**。

### 2-2. 机レイアウト = 向かい合わせペアは「配置として」維持

- 机 2 台を縦に接して置く「お見合い席」の**配置は維持**（オフィスらしさ・密集感はレイアウトで出す）
- ただし人・椅子・ラップトップは**上下段とも同じ正面向きスプライト**を使う
- これは現行スキル §2-C-5 に既に併記されている「レトロ慣習方式（全員 south 向き・物理的に嘘だが cute）」への全面切替。モニターは現行でも「嘘採用（1方向）」済みなので、その方針を人・椅子・机に広げるだけ
- 🔧 代替案: ペアをやめて「教室型（全机が南向きの行配置）」にする手もある。嘘が完全に消えるが、レイアウトの見た目が単調になるため**非推奨**

### 2-3. 素材規格（発注ルール）

- 全物体 **1 方向・1 発注**（`create_map_object` 1gen）。方向句の強制・採用前の向きチェックが不要になる
- サイズ規格は「グリッド何マス占有か（W×D マス）＋見た目の高さ」の 2 次元に簡素化（立方体 3 軸規格は廃止）
- プロンプト基本形（叩き台 🔧）:
  ```
  [object], front view with slight top-down tilt (RPG Maker VX style),
  facing the camera (south), axis-aligned, you see the top surface and the front face,
  cute Japanese pixel art Game Dev Story style, thick black outline,
  flat shading, bright friendly palette, transparent background
  ```

---

## 3. 既存素材の棚卸し（再利用可否）

| 素材 | 判定 | 根拠 |
|---|---|---|
| `person_sit.png` | ⭕ 流用候補 🔧 | ほぼ正面向き。新視点でも成立する可能性が高い（要並置確認） |
| `person.png` / `person_sit_nw.png` | ▲ / ❌ | nw（背中）は不要になる |
| `tile_pro_*.png`（6/8 生成の真上タイル16種） | ⭕ 流用候補 🔧 | 正方形トップダウンタイル。新床にそのまま使える可能性 |
| `desk_se.png` / `desk.png` | ❌ 再発注 | 完全アイソメ（3面可視・ひし形天板）。正面視点と不整合 |
| `chair_se` / `laptop_se` / `door_se` | ❌ 再発注 | 同上 |
| `floor_iso.png` | ❌ 廃止 | ひし形タイルは使えない |
| `wall_v_se/sw` | ❌ 再発注 | 北壁横帯 1 種に置き換え |
| 装飾 11 種（_se/_sw ペア） | ❌ 再発注（ただし**各 1 方向で済む**） | アイソメ視点。ただし新規格では 11 発注で済む（現行なら 22） |

### 3-1. オーナー支給素材（2026-07-11 受領・確定）

- **オフィス背景画像**: オーナー支給の 1 枚絵（元: `public/office/small.png`、1445×1088）。黒背景を透過処理して **`public/sprites/office/office_bg.png`** として保存済み（フラッドフィル fuzz 1%、ドア枠の誤透過を修正済み）
- **背景に含まれるもの**: 部屋（床・壁・ドア・窓）＋ **机 6 台（2列×3行）** ＋ ソファ・棚・ホワイトボード等の装飾一式
- → **床タイル・壁・机・装飾の発注は不要になった**（§4 のコスト試算は大幅減）。ゲーム側で重ねるのは **人・椅子・パソコン** の 3 種
- **机の向き制約（オーナー確定）**: 机は**上向きまたは下向きのみ**。人・椅子は机の上側（下向きに座る＝正面が見える）か下側（上向きに座る＝背中が見える）にのみ配置する。左右向きは存在しない
- **配置モデルの変更**: タイルグリッドのジオメトリ計算は不要になり、**背景画像上のアンカー座標（机 6 箇所＋通路）に人・椅子・PC を重ねる**方式に変わる。z-order は「y が大きいほど手前」の painter's algorithm を維持
- **実効ピクセル密度**: 背景は約 2px/ドット相当。キャラ等の追加素材は 64px 級で生成し **表示時 2 倍**で密度を合わせる（机幅 ≈175px・ドア高 ≈260px に対しキャラ表示高 ≈128px）

### 3-2. キャラクター素材（オーナー依頼 2026-07-11）

男性エンジニア 1 体（PixelLab `create_character` v3・64px・high top-down・8方向）：

> **スタイル参考（オーナー支給 2026-07-11）**: 立ち絵キャラ例シート（プログラマー〜サポートの12職種）。
> 特徴 = **頭身高め（約1:3、チビキャラではない）**・落ち着いた色数（彩度控えめ）・柔らかい暗色アウトライン・シンプルな形状で量産しやすいデザイン。職種ごとに服装・小物（ノートPC・ギター・マグ等）で差別化。
> 将来の量産時はこの12職種ラインナップに沿って横展開する。

| 状態 | 方向数 | 用途 |
|---|---|---|
| 立ち（rotation） | 8 | 配置基本姿 |
| 歩行アニメ | 8 | 部屋内の移動 |
| 着席 | 下向き（south）＋上向き（north）🔧 | 机の上側/下側に座る。**椅子はキャラと分離**（pixelart-prompting §3-1 鉄則）し、椅子だけ差し替え可能にする |

---

## 4. 発注コスト試算（PixelLab）

| カテゴリ | 内容 | gen 数（目安） |
|---|---|---|
| ワークステーション | desk / chair / laptop（person_sit は流用前提 🔧） | 3 |
| 部屋 | 北壁帯 / 窓 / ドア / 床タイル（tile_pro 流用なら 0）※背景画像支給により減る可能性 🔧 | 0〜4 |
| 装飾 | bookshelf / clock / coffee_table / fridge / plant / sofa / trash / vending / water_cooler / whiteboard | 10 |
| リトライ余裕 | 視点ミス等の再発注バッファ | +5 |
| **合計** | | **約 20 gen**（アイソメ継続なら装飾だけで 22 + 方向リトライ） |

以後の**新家具追加は常に 1 発注**。ここが恒久的な削減効果。

---

## 5. コード影響範囲

| ファイル | 変更 | 規模感 |
|---|---|---|
| `src/lib/officeGeometry.ts`（123行） | ひし形グリッド → 正方格子。`tileTopLeft` / `cellAnchor` は単純な `i*cell, j*cell` に。`baseZ` は行ベース（j が大きいほど手前）で大幅簡素化 | 書き直し（縮む） |
| `src/lib/officeLayout.ts`（263行） | `dir: 'SW'|'SE'|'NW'` フィールド・`wallSkewDeg` / `wallImg(dir)` / `decorGeom` の鏡映ロジックを削除。カタログは img 1 本に | 縮む |
| `src/components/OfficeView.tsx`（240行） | 床ループを単純な行×列に。壁は北帯 1 本。skew 撤去 | 縮む |
| `src/components/Workstation.tsx`（86行） | `dir` prop 廃止。上下段共通スプライト | 縮む |
| `src/components/OfficeLayoutTool.tsx`（628行） | ジオメトリ差し替えに追従。向きトグル UI 削除 | 中 |
| `src/lib/officeGeometry.test.ts` | 新ジオメトリに合わせ更新（testing-rules: unit 必須） | 中 |
| `WorkstationTuner.tsx` / `data/workstation.ts` | オフセット定数の再調整 | 小 |

ロジック（core/・gameStore）への影響は **なし**（表示レイヤーのみ）。

## 6. ドキュメント・スキル改訂

- **office-visual-design SKILL.md を全面改訂**（§2〜§11 が全てアイソメ前提）。旧アイソメ規格は「§12 過去の失敗と学び」に教訓として圧縮して残す（スキルの更新ルール §14 準拠：古い基準は削除）
- pixelart-prompting に新プロンプト基本形（§2-3）を追記
- メモリ `2D素材の反転で別方向は作れない` は有効なまま（そもそも別方向を作らなくなる）

---

## 7. 実装フェーズ（GO 後）

1. **Phase 1 — ジオメトリ切替**: officeGeometry / officeLayout / OfficeView / Workstation を正方格子＋1方向規格に書き換え。素材は流用候補（tile_pro / person_sit）＋既存アイソメ素材の仮置きで**まず画面を成立させる**。unit テスト更新 → Playwright 実機スクショで骨格確認
2. **Phase 2 — ワークステーション素材発注**: desk / chair / laptop（＋必要なら person_sit）を PixelLab 発注。**各素材とも生成→オーナー承認→組み込み**（勝手に組み込まない）
3. **Phase 3 — 部屋・装飾素材発注**: 北壁帯・窓・ドア・床、装飾 10 種を段階発注（同じ承認フロー）
4. **Phase 4 — スキル改訂＋旧素材整理**: office-visual-design 全面改訂、`*_se/_sw` 等の廃止素材を削除
5. **検証**: playwright-verify で全 scale（mini〜aaa）のスクショ、1280×720 固定・スクロールなし、vitest / e2e / build 緑

---

## 7.5 進捗ログ（2026-07-11）

- ✅ 背景透過（`public/sprites/office/office_bg.png`、1445×1088）
- ✅ 社員キャラ6体（programmer/designer/pr × 男女）: 立ち8方向・歩行8方向シート・着席8方向（椅子分離）。`public/sprites/office/<role>/`
- ✅ 椅子・PC 正面/背面（`chair_south/north.png`, `laptop_south/north.png`）
- ✅ **キャラ倍率 2.5倍で確定**（足元オフセット: 立ち75 / 着席70 / 背面着席88 native）
- ✅ 配置ツール `office-layout-tool.html`（①サイズ ②移動領域=塗り ③座席 ④遮蔽物=塗り+選択編集 ⑤検証=実際に歩ける）
- ✅ **確定レイアウトデータ `public/sprites/office/office_layout.json`**（歩行961セル・座席6・遮蔽物11。連結性/到達性/重複の機械チェック済み）
- ✅ 合成プレビュー `office-preview.html` / キャッシュ無効サーバ `serve.py`（port 8931）
- 席は全席「机の南側・北向き（背面）」構成で確定（オーナーのツール設定より）

## 7.6 実装ログ（2026-07-12）

- ✅ `src/data/officeLayout.ts` 新設：`officeLayoutData.json` の型付けラッパー、`MAX_EMPLOYEES`（=座席数=6、旧12から変更）、`spriteFolderFor()`（employee.id ハッシュで性別を決定論的に導出）
- ✅ `src/data/officeLayout.test.ts` 新設（8件・全て green）：MAX_EMPLOYEES整合・座席到達性・遮蔽物重複なし・性別分布・スプライトパス組み立て
- ✅ `OfficeView.tsx` 全面書き換え：背景1枚絵＋着席6名分（painter's algorithm z順）。`ScaledSprite`（`naturalWidth` 実測 × charScale）で表示サイズのバグ（椅子が全身を隠す事故）を修正
- ✅ 旧アイソメ実装を削除：`officeGeometry.ts/.test.ts`, `lib/officeLayout.ts`, `Workstation.tsx`, `OfficeLayoutTool.tsx`, `WorkstationTuner.tsx`, `data/workstation.ts`（`git rm`）
- ✅ `OfficeScreen.tsx` / `gameStore.ts` / `main.tsx` の import 先・stageSize を新実装に追従
- ✅ typecheck（tsc -b）・lint（biome, 変更ファイルは警告0）・unit test（224件 green）・build 全て通過
- ✅ 実機確認（Playwright、実際の dev server + `window.__gs()` で雇用シミュレーション）：社員0人/2人/6人（満席）の3パターンで表示確認。7人目の雇用が MAX_EMPLOYEES で正しく弾かれることも確認

## 7.7 歩行検証ツール追加＋精密デバッグ（2026-07-12）

- ✅ 歩行アニメ8方向×8キャラの精度をAE差分解析＋目視で確認（全方向・全キャラで安定した交互運動、ループ継ぎ目も滑らか）。ただし**本番 OfficeView では歩行は未使用**（着席のみ）と判明・報告済み
- ✅ **`?walk` 検証ツール新設**（`src/components/OfficeWalkTool.tsx`）：本番の背景・レイアウトデータ・実キャラスプライトをそのまま使い、矢印キー/WASDでキャラを動かして歩行可否・遮蔽を実機検証できる。office-layout-tool.html（スタンドアロン、データ作成用）とは役割分担
- ✅ `officeLayout.ts` に `isWalkable`/`vectorToDir8`/`standingSprite`/`walkSheet` 等を追加、テスト6件追加（計230件green）
- ⚠️ **重大なデバッグの教訓**：実装当初、初期位置(400,950)でキャラが一切表示されない事故が発生。数十回の実機検証（clone比較・clip-path比較・z-index比較・新規タブ比較等）の末、**バグではなく仕様通りの遮蔽動作**と判明——その座標がドア脇の本棚の遮蔽物（baseline:1000）の footprint 内で、キャラの z(950) < 遮蔽物 z(1000) のため正しく隠れていただけだった。教訓：「表示されない」時は先に該当座標が遮蔽物データに含まれていないか機械的に確認してから実装バグを疑うこと（`node -e` でのワンライナー確認が有効）
- ✅ 副次的にコンポーネント実装も改善：ref経由でDOM styleを直接書き換える方式は避け、React state駆動＋`<img src>`（`OfficeView.tsx`のScaledSpriteと同じ実績パターン）に統一。`overflow:hidden`をネストしたtransform:scale()内で使うと`<img>`子要素が再ペイントされない実機バグも発見・`clip-path`で回避（保険的に記録。真因は上記の遮蔽仕様だったが、この過程で見つけた副次的な知見として残す）
- ✅ `office-visual-design` スキルを新方式で全面改訂（§9 に旧アイソメの教訓を圧縮して保存）
- ⚠️ **既知の仕様変化**：MAX_EMPLOYEES が 12→6 に減少（新背景の机が6台のため）。バランス調整（採用上限が下がることの影響）は本タスクのスコープ外、別途確認が必要
- 📌 残課題：docs/v17/notes に置いた `office-preview.html` / `office-layout-tool.html` / `serve.py` はスタンドアロン開発ツール（本番ビルド対象外）。今後レイアウトを直す時はこれらで再調整→JSON転記の流れを継続する

## 7.8 配置ツール統合（2026-07-12）

- ✅ **`office-layout-tool.html`（スタンドアロン、port 8931）と `?walk`（OfficeWalkTool.tsx）を1コンポーネントに統合**：新設 `src/components/OfficeEditorTool.tsx`、URL は `?layout`（`?walk` は後方互換のエイリアスとして同じツールを起動）
- ✅ ①サイズ ②移動領域 ③座席 ④遮蔽物 ⑤検証 の5モードを1画面に集約。①〜④で編集したデータ（state）を⑤がそのまま参照するため、**エクスポート/インポートを介さずその場でテストできる**（旧2ツール分割からの改善）
- 実装方針：②④の塗り作業（数百〜千セル）は `<canvas>` に直接描画（DOM大量生成を回避）、状態の実体は `useRef`（ミュータブル）+ `paintVersion` カウンタ（変更通知用）。⑤検証・①サイズのキャラ描画は React state 駆動の `<img src>`（OfficeWalkTool・OfficeView と同じ実績パターン）
- JSON 出力/読込は既存スキーマ（`officeLayoutData.json`）と完全互換であることを実機で確認（charScale・footOffsets・grid.cell・座席6・遮蔽物11 が一致）
- 実機確認（Playwright）：①〜⑤全モードの表示、②のブラシ塗り（mousedown/mousemove/mouseup dispatch）、⑤の矢印キー移動・遮蔽（sofa裏）・着席（着席スプライトは立ち/歩行と別途 naturalWidth 計測、footOffsets の sitSouth/sitNorth を使用）、コンソールエラー0件を確認
- 📌 **残課題**：スタンドアロン `office-layout-tool.html` / `serve.py`（port 8931）はこの統合により役割を終えたが、rm 実行がパーミッションで拒否されたため worktree に残存（機能的には無害・未参照）。次回セッションで削除可
- 📌 **未着手（診断済み・§7.7 由来）**：ホワイトボード周辺に遮蔽物が無い／ソファの遮蔽物バンドが浅く効果が薄い問題。新しい `?layout` の④モードで対話的に修正可能な状態になったが、今回は統合作業のみでこの修正自体は未実施

## 8. 未決点 🔧

| # | 未決点 | 推奨 |
|---|---|---|
| 🔧1 | 視点の最終形: **A. 3/4 オブリーク（上面＋正面、RPG Maker 風）** か B. 完全真正面（側面図・Fallout Shelter 風の断面) | **A 推奨**。経営シムの「部屋を見渡す」読みやすさとグリッド配置ツールを保てる。B はジャンルの見た目ごと変わる |
| 🔧2 | 机レイアウト: **A. 向かい合わせペア維持（全員カメラ向きの嘘）** か B. 教室型の行配置 | **A 推奨**（§2-2） |
| 🔧3 | person_sit / tile_pro の流用可否 | Phase 1 の仮組みで並置して判定 |
| 🔧4 | バージョン番号と着手順: v18（経済系）が並走中。本件を v19 として起票するか、v18 マージ後に採番するか。実装を v18 と並行するか後回しか | オーナー判断待ち |
| 🔧5 | 発注プロンプト基本形（§2-3）の文言 | Phase 2 の最初の 1 発注で検証してから確定 |
| 🔧6 | 支給される背景画像の扱い: 床・壁を「1枚絵の背景」に置き換えるか、タイル敷き＋壁帯の構成を維持して背景はその外側だけに使うか | 画像を見てから判定（§3-1） |
