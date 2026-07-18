# ジャンル・テーマ追加チェックリスト

新しいジャンル（`GenreId`）またはテーマ（`ThemeId`）を1つ追加する時、触る必要があるファイルは1箇所ではない。
このスキルは「追加時にやることリスト」を1箇所にためておくための生きたドキュメント。
**新しいジャンル/テーマを追加する作業に着手する前に必ず読む。追加後、新しい抜け漏れに気づいたら追記する。**

---

## ⭐ クイックチェックリスト（ジャンル追加）

新ジャンル `foo` を追加する時、上から順に埋める：

| # | ファイル | 内容 | 埋めないとどうなる |
|---|---|---|---|
| 1 | `src/data/genres.ts` | `GenreId` union に `'foo'` を追加 | ✅ TSコンパイルエラー（他の全箇所で気づける） |
| 2 | `src/data/genres.ts` `GENRES[]` | `{ id, name, emoji, bgColor, tags, unlockStage, snippets[] }` を1件追加 | ✅ TSエラー（`GENRE_BY_ID`が`Record<GenreId,Genre>`のため） |
| 3 | `src/data/devPhrases.ts` `GENRE_TICKETS` | 4カテゴリ（program/graphics/sound/design）× 3件ずつ `{title, desc}` | ✅ TSエラー（`Record<GenreId, ...>`） |
| 3b | `src/data/planTickets.ts` `GENRE_PLAN_CONTENT` | 企画チケットの創作系3種（concept/world/core）各 `{title, desc, decided}` ＋ `ideaKeywords` 5個 | ✅ TSエラー（`Record<GenreId, ...>`） |
| 4 | `src/data/codeSnippets.ts` `GENRE_VERBS` | 動詞5〜6個（英語、実装ログの疑似コードで使う） | ✅ TSエラー |
| 5 | `src/data/codeSnippets.ts` `GENRE_CLASSES` | クラス名4個（英語、疑似コードで使う） | ✅ TSエラー |
| 6 | `src/data/titleGenerator.ts` `PREFIX_BY_GENRE` | タイトル接頭語4〜5個（日本語） | ✅ TSエラー |
| 7 | `src/state/gameStore.ts` `MISSION_FLAVORS`（56行目） | ミッション見出し4個（日本語、v0.11レガシー演出） | ⚠️ **TSエラーにならない**（`Record<string,...>`＋`.action`にフォールバック）。忘れると新ジャンルが無言でaction味になる |
| 8 | `public/sprites/genre/foo.png` | PixelLab生成の代表スプライト（64×64・背景透過・genre-theme-content §3参照） | ⚠️ **エラーにならない**。`<img>`が404であるべき箇所が壊れて見えるだけ |
| 8b | `public/sprites/genre_bg/foo.png` | 開発フェーズ「デザイン画面」の背景（320×96・**§3-2 の全面充填ルール必読**） | ⚠️ **エラーにならない**。左右が透明だとジャンルの`bgColor`が透けて「帯」になる |
| 9（任意） | `src/data/compatibility.ts` `DIVINE`/`BOMB` | `'foo\|theme'`の特別相性（無くても`tags`ベースの相性計算は機能する） | 任意。無くても動く |

**TSエラーになる項目（1〜6）は`npm run build`を通せば機械的に埋め漏れが分かる。⚠️の7・8・8bだけは目視でチェックする。**
**8・8bの目視は `/admin/images`（開発ツール）を使う**：本編と同一コンポーネント・同一幅で27ジャンルを一覧できる。生画像のサムネイルで判断すると必ず失敗する（§3-2）。

---

## ⭐ クイックチェックリスト（テーマ追加）

新テーマ `bar` を追加する時：

| # | ファイル | 内容 | 埋めないとどうなる |
|---|---|---|---|
| 1 | `src/data/themes.ts` | `ThemeId` union に `'bar'` を追加 | ✅ TSエラー |
| 2 | `src/data/themes.ts` `THEMES[]` | `{ id, name, emoji, tags, unlockStage }` を1件追加 | ✅ TSエラー |
| 3 | `src/data/codeSnippets.ts` `THEME_NOUNS` | 名詞5個（英語、疑似コードで使う） | ✅ TSエラー |
| 4 | `src/data/codeSnippets.ts` `THEME_PROPS` | プロパティ名4個（英語、疑似コードで使う） | ✅ TSエラー |
| 5 | `src/data/titleGenerator.ts` `NOUN_BY_THEME` | タイトル名詞句3個（日本語） | ✅ TSエラー |
| 6（任意） | `src/data/compatibility.ts` `DIVINE`/`BOMB` | ジャンルとの特別相性 | 任意 |

テーマには`gameStore.ts`の`MISSION_FLAVORS`やジャンルスプライトのような**テーマ単位の資産は無い**（ミッション見出し・代表スプライトは両方ジャンル単位）。

---

## 1. なぜ1箇所で済まないか

`GenreId`/`ThemeId`は「タイピング内容」「タイトル生成」「相性計算」「開発フェーズのチケット内容」「実装ログの疑似コード語彙」など**複数の独立した生成システムの入力キー**になっている。各システムが「そのジャンル/テーマらしさ」を出すために専用の語彙・フレーバーテキストを持つ設計（v0.10〜v0.15で段階的に増えた）。
1箇所（`genres.ts`のGENRES配列）を埋めるだけではビルドは通っても、他のシステムが古いジャンルにフォールバックして「新ジャンルなのに中身が薄い」状態になる。

## 2. TSコンパイルが守ってくれる箇所・守ってくれない箇所

- **`Record<GenreId, X>` / `Record<ThemeId, X>` で書かれた辞書**（上表✅の項目）は、`GenreId`/`ThemeId`にIDを追加した瞬間に`npm run build`で型エラーが出るので、機械的に埋め漏れを発見できる。**まずGenreId/ThemeId unionにIDだけ足してビルドし、出てきたエラー箇所を全部埋める、という順番が一番安全。**
- **`Record<string, X[]>` ＋ フォールバック**（`gameStore.ts`の`MISSION_FLAVORS`）は文字列キーなので型エラーにならない。追加を忘れると黙って`.action`の内容が出る＝バグに気づきにくい。**新ジャンル追加時は必ずgrepで`MISSION_FLAVORS`を検索して手動で埋める。**
- **`public/sprites/genre/*.png`のような外部ファイル**も型では守れない。無いと`<img>`のalt落ち（ジャンル絵文字が代わりに出るような防御コードは無い実装なら壊れて見える）になるだけなので、追加後は必ずブラウザで実際にグラフィック作業チケットまで打ってみて画像が出るか確認する。

## 3. ジャンル代表スプライトの発注（`public/sprites/genre/*.png`）

開発フェーズの「グラフィック作業中」パネル（`DevelopScreen.tsx`の`GraphicsCanvasPanel`）で使う、ジャンルを一目で表す代表キャラ/オブジェクト。2026-07-08にオーナー承認済みの発注仕様：

- ツール：`create_map_object`（基本モード、`background_image`無し）
- サイズ：**64×64px**、`view: 'side'`
- `outline: 'single color outline'`、`shading: 'medium shading'`、`detail: 'medium detail'`
- プロンプト共通句（末尾に必ず付ける）：
  ```
  single object centered with transparent background,
  cute Japanese pixel art, Kairosoft Game Dev Story inspired style,
  thick black outline, flat shading, bright saturated friendly palette,
  clear readable silhouette, clean pixel grid, no anti-aliasing
  ```
- 本体描写は「そのジャンルを一番象徴する1体」を選ぶ（既存12件の選定例）：
  - rpg=スライム／puzzle=カラフルジェム／action=剣を持つ主人公／shooter=自機の戦闘機／adventure=バックパックの冒険者／simulation=タウンホール風の施設／racing=レースカー／horror=不気味なゴースト／fighting=構えを取る格闘キャラ／roguelike=ダンジョンの骸骨戦士／rhythm=光る音符キャラ／sandbox=ボクセル風ブロック
- 生成後は`genres.ts`の`genreSpriteUrl(genreId)`が`/sprites/genre/${genreId}.png`を自動で指すので、**ファイルを`public/sprites/genre/<id>.png`に置くだけでコード変更は不要**（`Genre`型に`spriteUrl`フィールドは持たせていない。全ジャンルで命名規則が同じなので冗長なフィールドより導出関数の方がDRY）。
- 発注前に必ず[`pixelart-prompting`](../pixelart-prompting/SKILL.md)を確認（PixelLab全般の失敗パターン・コスト管理はそちらが本体）。このスキルの§3は「このプロジェクトのジャンルスプライトという用途に絞った」確定仕様の記録。
- **生成したら組み込み（配置・コード反映）前に必ずオーナー承認を取る**（プロジェクト共通ルール。1枚だけ先出し→OKなら残りをまとめて発注、の順が安全）。

### 3-1. スプライトの表示サイズと解像度（2026-07-16 確定）

- 表示は `GENRE_SPRITE_PX = 64`（`DevelopScreen.tsx`）。**この値は勝手に変えない。**
- 理由：素材の解像度が **既存12種=64×64 / v0.21新規15種=128×128** と混在している。64 表示なら
  両方が整数倍（等倍／1/2）に収まり、`imageRendering: pixelated`（最近傍補間）でドットが崩れない。
- **非整数倍にすると絵が潰れる**：40px 時代は 0.625倍／0.3125倍で、オーナーから「小さくてよく見えない」
  という指摘を受けた（原因はサイズだけでなくこのボケ）。次に大きくするなら 128（整数倍）だが、
  既存64×64素材が2倍に伸びて新規128×128と粒の細かさが揃わなくなるので要相談。
- 新規スプライトを発注するなら **64×64 に揃える**のが無難（§3 の確定仕様どおり）。

### 3-2. 背景（`public/sprites/genre_bg/*.png`）の発注（2026-07-16 確定）

開発フェーズ「🎨デザイン画面」パネルの背景。`genreBackgroundUrl(genreId)` が
`/sprites/genre_bg/${genreId}.png` を自動で指すので**ファイルを置くだけでコード変更は不要**。

- ツール：`create_map_object`（基本モード）／サイズ **320×96**／`view: 'side'`／
  `detail: 'high detail'`／`shading: 'detailed shading'`
- **最重要：`create_map_object` の基本モードは公式ドキュメント上も「standalone object（背景透過の単体
  オブジェクト）」を作るツールであり、背景生成用ではない。** 素直に頼むと必ず「中央に小さな物体、
  左右は透明」が返り、パネル上ではジャンルの`bgColor`が透けて**左右に帯**ができる。
- **効く構図＝風景（ヴィスタ）**。これだけが安定して全面を埋めた：
  ```
  下半分を地面/水面が「completely filling the entire lower half from the far left edge to the far right edge」、
  上半分を空が「completely filling the entire upper half from edge to edge」、
  末尾に no empty or transparent areas anywhere, wide horizontal landscape scene,
  not a single small object, not a floating blob
  ```
  例（一発成功）：fishing=夕暮れの湖／shooter=星雲／fps=夕暮れの戦場／horror=夜の墓地
- 「回廊＋奥に消失点」（roguelike=ダンジョン、fighting=道場）も埋まるが**成否がぶれる**。
- **効かなかった仮説（全部試して全滅。繰り返さないこと）**：
  1. プロンプトに "full-bleed" "edge to edge" を足すだけ → 中央寄せのまま
  2. リング/ステージ/塹壕など**主役になりうる題材**を指定 → 必ず物体として中央に描かれる
  3. キャンバスを 320×32 にする → **真っ白**が返る
  4. `outline: 'lineless'` にする → 中央寄せのまま
- **合否はサムネイル目視で判断しない**（2回誤判定した）。機械的に判定する：
  ```bash
  magick out.png -trim +repage t.png && identify -format "%wx%h" t.png
  ```
  **トリム後の幅が 320 のままなら横は全面**。88px や 166px なら失敗（拡大するとドットが粗くなるので
  トリムして使うのも不可）。最後は必ず `/admin/images` の実パネルで確認する。
- パネル側には「左右端が塗り切れていない場合に備えた」グラデーション馴染ませが既にあるが、
  効くのは端18%まで。それ以上空くと帯として見える。

## 4. `tags` は既存の語彙を再利用する

`GenreTag`（`fast`/`logic`/`epic`/`scary`/`chill`/`wild`/`story`）と`ThemeTag`（`epic`/`tech`/`classic`/`daily`/`gourmet`/`cute`/`scary`/`cool`/`chill`）は`compatibility.ts`の`TAG_AFFINITY`が参照する固定語彙。新ジャンル/テーマの`tags`はこの**既存の語彙から選ぶ**（新しいタグ値を増やすと`TAG_AFFINITY`にペア加点ルールが無いため何の効果も持たない＝相性計算に反映されない）。
新しい「感触」がどうしても既存タグで表現できない場合のみ、`GenreTag`/`ThemeTag` union拡張と`TAG_AFFINITY`へのペア追加をセットで検討する（影響範囲が広がるので慎重に）。

## 5. `unlockStage` の目安

`themes.ts`の既定に倣う：
- 1（初期）：地味・日常系
- 2（序盤）：日常・かわいい系
- 3（中盤）：クラシック・大作系
- 4（終盤）：超人気・尖った系

新ジャンルもこの並びに合わせてバランスする（初期からハイリスク・ハイリターンな尖った内容を解放しない）。

## 6. 触らなくていいファイル（参考）

以下は`GENRE_BY_ID`/`THEME_BY_ID`経由の**汎用ルックアップのみ**行っており、ジャンル/テーマを追加しても編集不要（型が自動で通る）：
`JacketView.tsx`／`ReleaseScreen.tsx`／`PlanScreen.tsx`／`CollectionScreen.tsx`／`utils/storage.ts`／`utils/metascore.ts`／`utils/affinity.ts`。

## 7. 検証手順

1. `GenreId`（または`ThemeId`）unionにIDを追加した時点で一度`npm run build`し、型エラーが出た箇所（クイックチェックリストの✅項目）を全部埋める。
2. `MISSION_FLAVORS`とジャンルスプライトPNGは型で守られないので、grepと目視で個別に確認する。
3. `npm run build`が green になったら、ブラウザ実機で新ジャンル/テーマのプロジェクトを実際に開始し、企画→開発（4カテゴリのチケットが全部それらしい文言か／グラフィック作業中パネルに代表スプライトが出るか）まで一通り自己プレイして確認する。

---

## 更新ログ

### 2026-07-08（初版）
- 作業チケット制導入（v0.15.2）後の混乱を機に、ジャンル/テーマ追加時のタッチポイントを棚卸しして作成
- ジャンル代表スプライト（`public/sprites/genre/*.png`）の発注仕様を確定として記録

### 2026-07-09
- 企画チケット制導入（v0.15.3）に伴い `planTickets.ts` の `GENRE_PLAN_CONTENT` を新ジャンル追加チェックリストに追記（#3b）。
  企画カテゴリ7種のうちジャンル別執筆が必要なのは concept/world/core の3種のみ
  （genre/target/title/sales の4種は汎用＋バリアントで自動解決）

### 2026-07-16（v0.21 で15ジャンル・13テーマを一括追加した際の学び）
- **§3-2 背景の発注仕様を新設**。従来このスキルはスプライト（`genre/`）しか扱っておらず、
  背景（`genre_bg/`）の規約が無かったため、20回以上の生成失敗を重ねた。効く構図・効かない仮説・
  機械的な合否判定（`magick -trim` 後の幅）を記録。チェックリストにも #8b として追加
- **§3-1 スプライト表示サイズを明文化**。素材が 64×64 と 128×128 で混在しており、
  非整数倍の表示（40px）で絵が潰れていた問題と、`GENRE_SPRITE_PX = 64` の根拠を記録
- **`/admin/images` を新設**（`src/admin/`）。本編と同一コンポーネント・同一幅（実測588px）で
  全ジャンルの背景＋スプライトを一覧できる。素材の見え方の検証は必ずここで行う
  （生画像のサムネイルで判断して2回誤判定した）。相性の一覧は `/admin/compat`
- 参考：`create_map_object` の基本モードは「背景透過の単体オブジェクト」を作るツールという
  公式ドキュメントの記述を、失敗を重ねてから読み直して気づいた。**発注前にツールの説明を読む**
