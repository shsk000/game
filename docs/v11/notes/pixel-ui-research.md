# ピクセル UI 設計理論リサーチ — 実装書のための材料集

> このドキュメントは「タイピング工場」プロジェクトの v0.11 以降の UI 設計書を起こすための**理論的バックグラウンド集**である。既存の `.claude/skills/game-ui-design/SKILL.md` は「**何を採用するか**（フォント・色・9-slice・倍率）」を決定済みなので、ここではそれを**前提**としたうえで「**なぜそうするのか / 何を追加で意識すべきか**」を Web リサーチをもとに掘り下げる。
>
> 重複は避け、深掘り・補完に徹する。

---

## 章立て

1. ピクセル UI の基本原則 — 解像度・パレット・線・フォントの「物理学」
2. 「スクロール前提を捨てる」ゲーム UI の流儀 — 固定ビューポート設計
3. ピクセル UI のアニメーション語彙 — フレーム数・離散・効果音同期

---

## 1. ピクセル UI の基本原則

### 1-1. 解像度の系譜とピクセルスナップ

ファミコンは 256×240px、スーファミは 256×224px が標準で、当時の UI はこの**狭小キャンバスに HUD・メニュー・テキストが全て収まる**ことが前提だった（[ファミコン解像度メモ](https://gametsukurukun.com/docs/nintendo-hardware-resolution-memo/)）。
このサイズ感は現代の「ピクセル UI らしさ」を作る最大の規定要因で、**1px の重み**を尊重するルートにつながる。

ピクセルスナップ（pixel snapping）とは、要素の `left/top/width/height` を必ず**整数 px** に揃え、`transform: translate(1.5px, 0)` のような小数ピクセル移動を禁ずる規律のこと。半端な値は GPU の双線形補間で滲み、隣の 1px の重みを失わせる。

Web で実装する場合は次の二段構えが必須：

1. レイアウト側：要素の幅・位置・パディングを **4 の倍数**で統一（既存 SKILL §2-3）
2. 描画側：`image-rendering: pixelated` と整数倍 `scale` のみ許可（既存 SKILL §6）

[CrossCode の GUI 実装記事](https://www.radicalfishgames.com/?p=1594)は「Web では blocky pixel font をレンダリングするのが原理的に難しい」と述べ、Canvas でレンダリングする選択をした。HTML/CSS で行く本プロジェクトでは、**font-smooth: never と integer-scale layout** で同じ表現を再現する。

### 1-2. パレット制限と現代的妥協

「16 色 / 32 色」という古典的制約は、ハードウェアの制限から来ていたが、**今でも採用する理由はビジュアル一貫性**にある。
カイロソフトのドット絵研究記事（[note: カイロソフトから学びたいドット絵研究](https://note.com/iseebinokathi/n/n4e7bf9bf4e90)）によれば、カイロ作品のキャラは典型的に **32×32 以下**で、5 工程（固有色 → 線画 → 乗算（影）→ ハイライト → 影（接地））で組まれる。
ここで重要なのは「**乗算とハイライトに使う色は固有色の派生**」であって、自由色ではないこと。**パレット数 16 色**は事実上「ベース色 4 種 × 明 / 暗 2 階調 × アクセント数色」という意味になる。

現代的妥協：

- グラデーションは使わない（ピクセル空間に「中間色」は存在しない）
- 半透明（alpha）は `0` か `1` か、**影専用に 0.67 ひとつだけ**（既存 SKILL §3-1）
- アンチエイリアシングは禁止（テキストも、画像も、border も）

### 1-3. フォント選定の理屈

採用済みの **DotGothic16（日本語）+ Press Start 2P（英数字）**は、それぞれ別のリスクを持つ：

- **DotGothic16** は 16×16 グリッドのビットマップフォントで、`font-size: 16px` のときに最も整って見える（[Google Fonts: DotGothic16](https://fonts.google.com/specimen/DotGothic16)）。8px や 12px で出すと「**1 文字が読めない**」ことが起きるので、原則は **16px、補助情報のみ 12px**。8px は数字バッジ専用とする。
- **Press Start 2P** は Namco アーケード由来の 8×8 フォントで、**8 / 16 / 24 / 32 px の倍数**でのみ整う（[gwfh: Press Start 2P](https://gwfh.mranftl.com/fonts/press-start-2p)）。横幅を取りやすいので、**長い英文章には使わない**。数値ステータス・スコア・タイトルロゴ専用。

ペアの落とし穴：DotGothic16 と Press Start 2P を**同じ行に並べる**と、ベースラインが微妙にずれる。解決策は `vertical-align: bottom` + `line-height` を両者で同値（16px）に揃え、Press Start 2P の数字側を `transform: translateY(-2px)` で**整数 px** 揃え。

### 1-4. 9-slice の存在意義

9-slice（または 9-patch / nine-patch）は、画像を四隅・四辺・中央の 9 領域に分け「**角は引き伸ばさず、辺と中央だけ伸ばす**」技術（[Wikipedia: 9-slice scaling](https://en.wikipedia.org/wiki/9-slice_scaling)）。

ピクセル UI に**必須**である理由：

1. **画像 1 枚で任意サイズのウィンドウが作れる** — 24×24 の枠 1 つで 100×40 のボタンも 400×300 のモーダルもまかなえる
2. **角のドットパターン（陰影・装飾）が崩れない** — 通常の background-stretch だと角の細かな模様が引き伸ばされてピクセル感を失う
3. **CSS 標準でサポートされている** — `border-image-source/slice/width/repeat`（既存 SKILL §4 参照）

CrossCode は**NinePatch を独自実装**して採用しているし（前述）、Unity・Unreal・Bevy・Urho3D も標準機能として持っている（[Itch.io: 9-slice UI assets](https://ome6a1717.itch.io/ui-background-nine-slices)）。**ピクセル UI で 9-slice を使わない選択肢は、実質ない**。

### 1-5. エッジ・ライト・シャドウの 1px ルール

カイロ研究記事の「乗算 → ハイライト → 影」の三段は、**全部 1px の塗り**で実現される。これを Web の CSS に翻訳すると：

- 線：要素の `border` ではなく**スプライト側に焼き込む**。CSS `border: 1px solid` は端末の DPR によって 1px の太さが崩れる
- ハイライト：要素の上端 1px を 1 段明るい色で。`box-shadow: inset 0 1px 0 #fff8e0` のように **inset / 整数 px / blur 0** で
- 影：要素の下端 1px を 1 段暗い色で。同じく `box-shadow: 0 1px 0 #704028` または `inset 0 -1px 0 #704028`
- ❌ `box-shadow: 0 4px 12px rgba(...)` の Material 風 soft shadow は禁止（既存 SKILL §7-3）

ディザリング（dithering）はピクセル UI においては**画像側の表現技法**であって、CSS 側でやることは原則ない（[Pixnote: Dithering Guide](https://pixnote.net/en/learn/dithering/)）。背景テクスチャや 9-slice の中央タイルにディザを焼き込むのは OK。

### 1-6. 本章でルール化すべきチェックリスト

- [ ] すべての要素の width / height / padding / margin は **4 の倍数 px**
- [ ] `transform: translate(*)` に小数を渡さない（整数 px のみ）
- [ ] ハードコードする色は CSS 変数経由のみ、定義済みパレット外の値は禁止
- [ ] テキストの `font-size` は 8 / 12 / 16 / 24 のみ、**`line-height` は font-size と同値**
- [ ] 日本語本文は DotGothic16 16px が基準、12px はサブ、8px は数字バッジ専用
- [ ] DotGothic16 と Press Start 2P を同じ行に並べたら整数 px の `translateY` で揃える
- [ ] ウィンドウ・パネル・ボタンの矩形枠は **必ず 9-slice**（CSS `border-image`）、`border` 1px stroke 単独は禁止
- [ ] 影は inset/通常を問わず **1px / blur 0 / 暗い単色** のみ
- [ ] ハイライトは inset 1px / 明るい単色のみ
- [ ] グラデーション（`linear-gradient` / `radial-gradient`）は背景・テキスト含めて全面禁止

---

## 2. 「スクロール前提を捨てる」ゲーム UI の流儀

### 2-1. なぜスクロールしないのか

Web UI は「縦に長い page」を前提とするが、ゲーム UI は「**ひとつのテレビ画面**」を前提とする。
ファミコン〜スーファミは物理的にスクロール不可（256×224px に全部入れるしかない）だったが、その制約が結果として**ゲーム UI の作法**を作った：

- HUD は常時画面上部または周囲固定で、世界の中身（オフィス）と独立
- メニューやコマンドはモーダル / 別画面に切り替え、本編画面と**重ねない**
- 情報過多のときは「タブで分ける」「複数モーダルを順に開く」（[Sunstrike: HUD design](https://sunstrikestudios.com/en/blog/HUD_design_in_games/) では Dynamic HUD / Maximalist HUD の対比あり）

Web 慣性で `overflow-y: auto` を入れてしまうと、ゲーム感が消える。本プロジェクトでも**スクロールは原則禁止**で、例外を明示的に管理する。

### 2-2. 想定アスペクト比と固定ビューポート

カイロ系 / 経営シム系の参考実装は典型的に **iPhone 縦 / 9:16** または **横 16:9** で設計される。
[gametsukurukun: 自分ルール](https://gametsukurukun.com/docs/my-rule-about-ui/) はモバイルファースト + iPhone SE 解像度（750×1334）を基準に「**6 枠 × 8 枠**の制約の中で UI を作る」と宣言している。
本プロジェクトは PC 横 + モバイル横を想定するが、**基準解像度をひとつ決める**ことが先決：

- **基準ビューポート**：1280×720（PC ベース、16:9）
- **モバイル横最小**：896×414（iPhone 12-15 系の landscape）
- **モバイル縦サポート**：428×926（iPhone Pro Max 縦）

そして、これらすべてで「**スクロールせずに 1 画面**」を成り立たせる。

### 2-3. 1 画面情報密度の限界

[Polydin: Game HUD Design](https://polydin.com/game-hud-design/) と Stardew Valley UX 分析（[Medium: Deceptively Simple Design](https://medium.com/swlh/deceptively-simple-design-cabde40af87f)）に共通するのは「**HUD は最低限、深い情報はモーダルへ**」。

具体的な分量目安：

- **常時 HUD**：4〜6 要素（資金 / ファン / 従業員 / 作品 / 時刻 / 日付 など）
- **同時に見せる主要 UI ブロック**：3〜4 個まで（オフィス画面 + メニュー + ステータスバー + 任意のトースト）
- **モーダル内の主要選択肢**：5〜8 個まで（メニューは 7 個 = 既存 SKILL §5-2 と一致）
- **1 つのテキスト塊**：3 行以内（[gametsukurukun ルール](https://gametsukurukun.com/docs/my-rule-about-ui/) の「メッセージは 3 行以内」を踏襲）

[Stardew Valley UX 研究](https://medium.com/design-bootcamp/stardew-valley-a-ux-case-study-43e348c3fec0) は「アイコン化されたクロップの**シルエットだけで成長段階が分かる**」と指摘する。**文字を減らしアイコンで語る**ことが情報密度の鍵。

### 2-4. 層構造（HUD / 本編 / モーダル / オーバーレイ / トースト）

ゲーム UI は実質「**5 つのレイヤー**」で出来ている：

| z-index | 層 | 役割 | スクロール |
|---|---|---|---|
| 0 | 本編（オフィス画面） | 世界の中身 | ❌ |
| 100 | HUD（ステータスバー・メニューバー） | 常時情報 | ❌ |
| 500 | オーバーレイ（半透明背景） | モーダル背景 | ❌ |
| 1000 | モーダル本体 | 一時操作 | △ 例外的に可 |
| 2000 | トースト・通知 | 一過性情報 | ❌ |

z-index の段差を 100 単位で確保すると、後から要素を挟みやすい。

### 2-5. スクロールが許される例外

スクロール禁止の原則だが、以下は許可：

1. **作品履歴 / 図鑑 / ログ** — 情報量がプレイ時間に応じて増える性質のもの。ただし**モーダル内に限定**し、HUD や本編とは独立
2. **長いテキスト（チュートリアル / シナリオ）** — モーダル内で縦スクロール OK。ただし**スクロールバー自体もピクセルアートで描画**する（ブラウザデフォルトのスクロールバーは禁止）
3. **ランキング / リーダーボード** — 同上、モーダル限定

スクロールが**絶対に禁止**な場所：

- 本編画面（オフィス画面そのもの）
- HUD（ステータスバー、メニューバー）
- メイン操作モーダル（採用 / 規模 / 設定）— ボタンや選択肢の数が決まっているもの

### 2-6. モバイル：親指届く範囲とタップターゲット

[72Technologies: Tap targets and thumb zones](https://www.72technologies.com/blog/tap-targets-thumb-zones-mobile-ux) によれば、**44pt の標準は「最小値」であって「快適値ではない」**。
快適値は **約 72px（実寸 1 インチ ≈ 親指幅）**で、Fitts の法則によると **44pt と 60pt 以上では 2〜3 倍のタップ時間差**が出る（[UX/UI Principles: Touch Target Sizing](https://uxuiprinciples.com/en/principles/touch-target-sizing)）。

本プロジェクトの規格に翻訳すると：

- **最小タップターゲット**：48×48 px（メニューアイコン 32×32 + 余白 8px ×2）
- **推奨タップターゲット**：64×64 px（既存 SKILL §9-3 のメニューバー高 64px と整合）
- **ターゲット間の最小余白**：8 px（誤タップ防止）
- **親指届く範囲（縦持ち時）**：画面下から 60% 以内に主要操作を配置

スマホ縦持ちで上 40% は「**見るゾーン**」、下 60% は「**操作ゾーン**」と分けると、片手操作で疲れない。

### 2-7. 本章でルール化すべきチェックリスト

- [ ] 基準ビューポート **1280×720** で全画面が成立すること（スクロール無し）
- [ ] モバイル横 896×414 と縦 428×926 でも**スクロール無しで本編 + HUD が見える**こと
- [ ] HUD 要素は常時 6 個以下、本編画面に重ねるが必ず**枠の外側**（オフィス絵を覆わない）
- [ ] モーダル選択肢は最大 8 個まで、それを超えるならタブ分割
- [ ] スクロール許可は「履歴・図鑑・ログ・チュートリアル文」のみ、それ以外は**設計でスクロールを潰す**
- [ ] スクロール領域はブラウザデフォルトの scrollbar を `display: none` にし、**専用ピクセルスクロールバー**を別レイヤで描画
- [ ] 全タップ可能要素は **最低 48×48 px**、メニューは 64×64 px
- [ ] タップ要素間のマージンは **最低 8 px**
- [ ] モバイル縦持ち想定時、主要操作（メニューバー）は画面下 60% 以内に配置
- [ ] z-index は 0 / 100 / 500 / 1000 / 2000 の段差を厳守、間の値は使わない

---

## 3. ピクセル UI のアニメーション語彙

### 3-1. なぜ `steps()` 必須なのか

[Josh W Comeau: Sprites on the Web](https://www.joshwcomeau.com/animation/sprites/) と [Treehouse: CSS Sprite Animation with steps()](https://blog.teamtreehouse.com/css-sprite-sheet-animations-steps) が口を揃えて言うのは「**滑らかに補間したらピクセル感が壊れる**」。
`steps(N)` は中間値を**スキップして次のフレームへジャンプ**するため、`width: 0 → 100px` を `steps(4)` で動かすと `0 → 25 → 50 → 75 → 100` の 5 状態しか描画されない。これが**フィルムの 1 コマめくり**に相当する。

[Harshal Ladhe: Mastering steps()](https://harshal-ladhe.netlify.app/post/css-step-timing-function) は **`jump-end`（デフォルト）vs `jump-none` vs `step-start`** の違いを整理している：

- `steps(4)` = `steps(4, jump-end)`：0, 25, 50, 75（最後の 100 は描画されない）
- `steps(4, jump-none)`：0, 33, 66, 100（5 フレーム = N+1 状態）
- `steps(4, jump-start)`：25, 50, 75, 100（最初の 0 は描画されない）
- `step-start`：開始即座にジャンプ
- `step-end`：終了直前にジャンプ

**ループするスプライト（idle 等）は `jump-none` で N+1 = sprite 枚数に合わせる**のが正攻法。単発のフェードや拡縮は `jump-end`（デフォルト）でいい。既存 SKILL §7-1 はこの使い分けを明示していないので、設計書では明示すべき。

### 3-2. フレームレート規約（8〜12 fps を採用）

[Pixnote: Pixel Art Animation Guide](https://pixnote.net/en/learn/animation/) と [Sprite-AI: Sprite Animation Frames](https://www.sprite-ai.art/blog/sprite-animation-frames) が示すピクセルアニメの標準：

- **8〜12 fps**：標準。レトロ感が出る基準
- **4〜6 fps**：idle、ゆったり動く環境演出
- **15〜24 fps**：強烈な攻撃エフェクト、強調演出

CSS で 12 fps を実現するには、1 フレーム ≈ **83ms**。ただし整数化規律のため、本プロジェクトでは**80ms / 100ms / 120ms / 160ms / 200ms / 400ms / 600ms** の離散値だけを使う。

### 3-3. アニメーション語彙カタログ（実装すべき類型）

以下、本プロジェクトで「**最終的に揃えたい UI アニメ集**」を網羅的に並べる。
**フレーム数 × 1 コマ持続時間 = 合計 duration**。

| # | 類型 | フレーム数 | 1 コマ持続 | 合計 duration | timing | 用途 |
|---|---|---|---|---|---|---|
| 1 | **hover ハイライト**（背景色切替） | 1 | — | 瞬時 | `steps(1)` | ボタン・メニュー・カード |
| 2 | **押下（press）** | 2 | 80ms | 160ms | `steps(2)` | ボタンを 1px 沈める |
| 3 | **選択（select）強調** | 2 | 200ms | 400ms loop | `steps(2)` infinite | フォーカス枠の点滅 |
| 4 | **出現（pop-in モーダル）** | 4 | 50ms | 200ms | `steps(4)` | scale 0 → 0.5 → 1 → 1.1 → 1 |
| 5 | **消滅（pop-out）** | 3 | 50ms | 150ms | `steps(3)` | scale 1 → 0.5 → 0 |
| 6 | **強調揺れ（shake）** | 4 | 50ms | 200ms | `steps(4)` | エラー / 不足通知 |
| 7 | **ダメージフラッシュ** | 2 | 60ms | 120ms ×3 | `steps(2)` | 赤背景 → 通常 を 3 回 |
| 8 | **報酬（コインを得た等）** | 6 | 80ms | 480ms | `steps(6)` | スプライト 6 枚アニメ |
| 9 | **紙吹雪（confetti）** | 8 | 100ms | 800ms | `steps(8)` | 大型イベント・実績解除 |
| 10 | **コンボ表示（積み上げ）** | 1〜3 | 80ms | 80〜240ms | `steps(N)` | 数字差し替え + 1px 拡大 |
| 11 | **数字カウントアップ** | フレーム数可変 | 40ms | 値による | `steps(N)` | 資金・ファン数の変動 |
| 12 | **トーストの跳ね（slide-in）** | 4 | 60ms | 240ms | `steps(4)` | 画面右上から滑り込み |
| 13 | **画面遷移ワイプ** | 8 | 50ms | 400ms | `steps(8)` | 横一文字ワイプ / 黒幕 |
| 14 | **カーソル点滅** | 2 | 300ms | 600ms loop | `steps(2)` infinite | テキスト入力カーソル |
| 15 | **idle 揺れ**（キャラの呼吸） | 2 | 400ms | 800ms loop | `steps(2)` infinite | 従業員の OfficeView 内 |

これらを実装する際の `keyframes` の作法：

```css
/* 例：報酬獲得のポップ */
@keyframes reward-pop {
  0%   { transform: scale(0)   translateY(0);   }
  16%  { transform: scale(0.6) translateY(-4px); }
  33%  { transform: scale(1.2) translateY(-8px); }
  50%  { transform: scale(1)   translateY(-8px); }
  66%  { transform: scale(1)   translateY(-4px); }
  83%  { transform: scale(1)   translateY(-2px); }
  100% { transform: scale(1)   translateY(0);   }
}
.reward { animation: reward-pop 480ms steps(6) forwards; }
```

`steps(6)` なので 6 つの状態しか見えない = **6 フレームアニメーション**として描画される。

### 3-4. Squash & Stretch をピクセルでやる方法

[Donkey Isle: Juicy juice](https://donkey-isle.itch.io/juice-juicy-juice) や Game Juice 系記事（[GameAnalytics: Squeezing more juice](https://www.gameanalytics.com/blog/squeezing-more-juice-out-of-your-game-design)）で頻出する Squash & Stretch を**ピクセル UI で**やる方法は限られる：

- `transform: scale(1, 1.2)` のような**整数比でない**スケールは禁止（ピクセル感破壊）
- 代わりに「**専用スプライト 2〜3 枚**を切り替える」か、`scale(2, 2) → scale(2, 3)` のように整数倍の差で

ボタン押下にはこれは過剰なので、**報酬 / ダメージ / コンボ等の強調シーン**だけで使う。

### 3-5. 効果音同期（SE sync）

ピクセル UI でも SE 同期は重要だが、注意点：

- 音は **アニメ開始 0ms または +20〜40ms 遅延**まで（人間は 50ms 以上ずれると違和感を感じる）
- 同じイベントで同じ音を 2 つ以上重ねない（コインを 5 枚一気に得たら 1 音で表現、5 音重ねない）
- 「**コミカル系 SE**（ピコッ・ピロッ）」が 8-bit / ピクセル UI と相性◎

[GameDev4U: Juicy effects](https://gamedev4u.medium.com/when-you-play-a-great-game-it-feels-good-d23761b6eccf) は「Sound is 50% of the experience」と書く。MVP では SE 無しでも進めるが、実装書では**各アニメに対応 SE ファイル名を予約欄として書いておく**べき。

### 3-6. 参考作品の運動学（観察ポイント）

| 作品 | UI アニメの特徴 | 学ぶ点 |
|---|---|---|
| **Game Dev Story（カイロ）** | メニュー切替が**瞬時**（フェード無し）、ポップアップは即出現で硬めの効果音同期 | ボタンより**通知トーストの方が動く**。トーストは 8 fps 程度のスライドイン |
| **Stardew Valley** | インベントリは hover で**選択枠だけ瞬時切替**、開閉は微妙なスケール（[Stardew analysis](https://medium.com/@n01578837/elevating-the-gaming-experience-a-fresh-take-on-stardewvalleys-ui-ux-91502b82215d)） | フォーカス枠の点滅 ≈ 400ms loop |
| **Undertale** | テキスト送りが**1 文字ずつ表示**、特殊効果は文字単位で揺れる | typewriter エフェクトを `steps()` + `width` で再現可 |
| **Celeste** | UI は最小限、ピクセル感維持のため整数 scale + 8×8 グリッド ([Aran's Celeste tileset analysis](https://aran.ink/posts/celeste-tilesets)) | 8 グリッド規律を再確認 |
| **CrossCode** | 9-patch + ベジェ補間でメニューが滑らか（[Radical Fish blog](https://www.radicalfishgames.com/?p=1594)） | 反面教師：ベジェにすると滑らかすぎる、本プロジェクトは `steps()` で対抗 |
| **ファミコン / GB / GBA 作品全般** | 数字カウントアップが**1 桁ずつパチパチ**進む | 資金・スコア演出の参考 |

### 3-7. 本章でルール化すべきチェックリスト

- [ ] すべての `transition` / `animation` の timing-function は **`steps(N)`**、ease 系は禁止
- [ ] ループスプライトは `steps(N, jump-none)`、単発は `steps(N)`（= `jump-end`）
- [ ] 1 コマ持続時間は **40 / 50 / 60 / 80 / 100 / 120 / 160 / 200 ms** のいずれかから選ぶ
- [ ] アニメ duration は **80 / 100 / 160 / 200 / 240 / 400 / 600 / 800 ms** から選ぶ（既存 SKILL §7-2 から拡張）
- [ ] §3-3 のアニメ語彙カタログ 15 種は**全種類について実装の有無**を設計書に記載
- [ ] スケール変化は **整数倍 or 専用スプライト切替**、`scale(1.05)` 等の半端値は禁止
- [ ] 報酬 / ダメージ / 強調系は SE ファイル名を予約欄として記載（実装は後でも、設計上はペアにしておく）
- [ ] フォーカス枠点滅は 400〜600ms ループ、それより速いと目障り、遅いと注意を引かない
- [ ] 数字カウントアップは **40ms / 1 step** を基本に、桁ごとに 1 ステップ進む
- [ ] 画面遷移ワイプは**最大 400ms**、それ以上はテンポを殺す

---

## 4. 参考リンク一覧

### ピクセル UI 原則 / 9-slice

- [Wikipedia: 9-slice scaling](https://en.wikipedia.org/wiki/9-slice_scaling)
- [Unity Learn: 9-Slicing for Scalable Sprites](https://learn.unity.com/tutorial/using-9-slicing-for-scalable-sprites)
- [Itch.io: Ui Background 9-Slices Vol.1](https://ome6a1717.itch.io/ui-background-nine-slices)
- [Pixnote: How to Make Pixel Art Game Assets](https://pixnote.net/en/learn/game-assets/)
- [CrossCode GUI System (Radical Fish Games)](https://www.radicalfishgames.com/?p=1594)

### フォント

- [Google Fonts: DotGothic16](https://fonts.google.com/specimen/DotGothic16)
- [Google Fonts: Press Start 2P](https://fonts.google.com/specimen/Press+Start+2P)
- [GitHub: fontworks-fonts/DotGothic16](https://github.com/fontworks-fonts/DotGothic16)
- [gwfh: Press Start 2P sizing notes](https://gwfh.mranftl.com/fonts/press-start-2p)
- [Design Work Life: 38 Pixel Fonts](https://designworklife.com/pixel-fonts-for-video-game-tech-design/)

### ピクセルアート技法

- [Pixnote: Pixel Art Dithering Guide](https://pixnote.net/en/learn/dithering/)
- [Pixnote: Pixel Art Shading & Lighting](https://pixnote.net/en/learn/shading/)
- [Pixnote: Pixel Art Tips and Tricks](https://pixnote.net/en/learn/tips/)
- [Drububu: Pixel art tutorial — sketch, outline, shading](https://www.drububu.com/tutorial/pixel-art-and-shading.html)

### カイロ / 国産参考

- [note: カイロソフトから学びたいドット絵研究](https://note.com/iseebinokathi/n/n4e7bf9bf4e90)
- [カイロソフト: Pixel Art Park Vol.6](https://kairosoft.net/gallery/PAP6/)
- [ピクセルアートブックレット vol.1](https://kairosoft.stores.jp/items/61f8e126c15c5a7a2f274282)

### 解像度・歴史

- [ゲーム作るくん: Nintendo 歴代解像度メモ](https://gametsukurukun.com/docs/nintendo-hardware-resolution-memo/)
- [マイナビ: 2DCG ゲームの歴史](https://mynavi-creator.jp/blog/article/history-of-2dcg-designer)
- [80.lv: A Look Into Games UI: From 1960s to Present](https://80.lv/articles/a-look-into-games-ui-from-1960s-to-the-present)

### UI 設計理論

- [Polydin: Game HUD Design Guide](https://polydin.com/game-hud-design/)
- [Sunstrike: HUD design in games](https://sunstrikestudios.com/en/blog/HUD_design_in_games/)
- [Game UI Database](https://gameuidatabase.com/)
- [Ethan Tal: Innovative Game UI](https://www.ethantal.com/articles/innovative-game-ui)
- [gametsukurukun: ゲーム制作時の UI に関する自分ルール](https://gametsukurukun.com/docs/my-rule-about-ui/)

### モバイル / 入力

- [72Technologies: Tap Targets and Thumb Zones](https://www.72technologies.com/blog/tap-targets-thumb-zones-mobile-ux)
- [UX/UI Principles: Touch Target Sizing](https://uxuiprinciples.com/en/principles/touch-target-sizing)
- [UX Movement: Finger-Friendly Mobile Touch Target Sizes](https://uxmovement.com/mobile/finger-friendly-design-ideal-mobile-touch-target-sizes/)
- [Adrian Roselli: Target Size and WCAG 2.5.5](https://adrianroselli.com/2019/06/target-size-and-2-5-5.html)

### アニメーション / Game Feel

- [Josh W. Comeau: Sprites on the Web](https://www.joshwcomeau.com/animation/sprites/)
- [Treehouse: CSS Sprite Animation with steps()](https://blog.teamtreehouse.com/css-sprite-sheet-animations-steps)
- [Harshal Ladhe: Mastering CSS steps()](https://harshal-ladhe.netlify.app/post/css-step-timing-function)
- [Pixnote: Pixel Art Animation Guide](https://pixnote.net/en/learn/animation/)
- [Sprite-AI: Sprite Animation Frames](https://www.sprite-ai.art/blog/sprite-animation-frames)
- [Sprite-AI: 12 Animation Principles for Pixel Art](https://www.sprite-ai.art/guides/animation-principles)
- [Pixel-Editor: Sprite Animation Fundamentals](https://www.pixel-editor.com/articles/sprite-animation-fundamentals)
- [Itch.io blog: Making a Game Feel Juicy](https://itch.io/blog/1059831/making-a-game-feel-juicy-with-simple-effects)
- [GameAnalytics: Squeezing more juice](https://www.gameanalytics.com/blog/squeezing-more-juice-out-of-your-game-design)
- [Jason Tu: 3 Basic Skills for Game Juice](https://nucleartide.com/juice-techniques)

### 参考作品分析

- [Game UI Database — Celeste](https://www.gameuidatabase.com/gameData.php?id=53)
- [Game UI Database — CrossCode](https://www.gameuidatabase.com/gameData.php?id=715)
- [Medium: Stardew Valley UX Case Study](https://medium.com/design-bootcamp/stardew-valley-a-ux-case-study-43e348c3fec0)
- [Medium: Deceptively Simple Design (Stardew Valley)](https://medium.com/swlh/deceptively-simple-design-cabde40af87f)
- [Medium: Elevating Stardew Valley UX/UI](https://medium.com/@n01578837/elevating-the-gaming-experience-a-fresh-take-on-stardewvalleys-ui-ux-91502b82215d)
- [Aran's: Celeste Tilesets, Step-by-Step](https://aran.ink/posts/celeste-tilesets)
- [Synthron: How to Make Stardew Valley-Type UI](https://synthronai.com/how-to-make-stardew-valley-type-ui/)
- [Mental Nerd: ConcernedApe Interview on Pixel Art](https://mentalnerd.com/blog/getting-started-pixel-art-interview/)

---

## 5. 既存 SKILL との関係（補完マップ）

このリサーチが既存 `.claude/skills/game-ui-design/SKILL.md` に**新規に提供する論点**：

| 既存 SKILL の章 | このリサーチの補完 |
|---|---|
| §2 ピクセルフォント | DotGothic16 と Press Start 2P を**同行併用したときのベースライン調整** |
| §3 カラーパレット | 「**乗算 / ハイライト / 影**」三段の派生色ルール（カイロ研究記事より） |
| §4 9-slice | CrossCode の独自 NinePatch 実装が示す「Web では Canvas のほうが楽だが本プロジェクトは CSS で行く」覚悟 |
| §6 image-rendering | ピクセルスナップ規律の理論的根拠（256×240 → 1280×720 の倍率系譜） |
| §7 アニメ制約 | **アニメ語彙カタログ 15 種**（§3-3）の追加、`jump-none` vs `jump-end` の使い分け |
| §8 入力 | モバイルのタップターゲット最小 48px / 推奨 64px、Fitts 法則からの定量根拠 |
| §9 コンポーネント | 「スクロール許可ゾーン」（履歴 / 図鑑 / ログ）の例外設計指針 |

このリサーチを下敷きに、v0.11 の UI 設計書では：

1. アニメ語彙カタログ 15 種を**全部書き出す**
2. ビューポート 3 種（1280×720 / 896×414 / 428×926）で**全画面のワイヤーを描く**
3. タップターゲット 48px / 64px を**全 UI コンポーネントに明示**

を行うのが次の一手。
