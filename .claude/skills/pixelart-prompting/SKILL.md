---
name: pixelart-prompting
description: PixelLab MCP（mcp__pixellab__*）を使ってドット絵素材を生成する際のプロンプト設計指針。プロジェクト固有の世界観・サイズ規約・使い回しテンプレを集約する生きたメモ。新しい要望や学びがあったら更新する。
---

# PixelLab プロンプト設計スキル（v1）

> このファイルはタイピング工場プロジェクト用の知見の積み重ね。**要望・失敗・成功のたびに更新する**。
> 古い指針が現実と食い違ったら「§更新ログ」に記録した上で書き換える。

---

## 0. 鉄則（必ず守る）

1. **画像素材を手作業で作らない。** ImageMagick / PIL 等で切り貼り・塗り替え・描き起こしをして「ドア」「家具」などの新規スプライトを自作しない。品質が低く必ず「おかしい/不自然」になってやり直しになる。**新規の絵は PixelLab（mcp__pixellab__*）で発注する。** 既存素材の単純なトリミング/余白調整・配置オフセットは可。
2. **生成したら、その場でユーザーにチェック依頼。** 発注/取得した画像は `get_object` で目視し、**ユーザーに提示して「これでOKか」承認を取ってから**、sprites へ保存・配置・レンダー・コミットへ進む。承認前に次へ進まない。
3. **1体ずつ・コスト配慮。** 発注は費用がかかるので、まとめ発注せず1つずつ。残高は `get_balance` で確認。
4. **2D 反転で別向きは作らない**（→ §別方向の作り方 / memory: 2D素材の反転で別方向は作れない）。

---

## 1. 世界観の指針

### 1-1. 目標テイスト：**Kairosoft（ゲーム発展国）系**
- 太い黒アウトライン（all sprites）
- 明るく彩度高めのフレンドリーな配色
- 1〜2段階の単色シェーディング（平面的、影に凝らない）
- デフォルメ強め、cute Japanese pixel art
- 装飾物が密集（空白を作らない）

### 1-2. 共通スタイル句（プロンプト末尾に必ず付ける）
```
cute Japanese pixel art, thick black outline, flat shading, bright friendly palette, no anti-aliasing
```

### 1-3. PixelLab パラメータ既定（指定がなければこれ）
```ts
// create_character の outline
outline: 'single color black outline'   // ← 黒太線を強制
// create_map_object / create_topdown_tileset / create_1_direction_object の outline（注：別enum）
outline: 'single color outline'         // ← 'black' は付かない。色は description で指定する
shading: 'basic shading'                // ← 凝らない
detail:  'medium detail'
view:    'high top-down'                // ← オフィス系。バトル系なら 'side'
```

**⚠ outline の許容値はツールごとに違う**：
- `create_character`: `'single color black outline'` / `'single color outline'` / `'selective outline'` / `'lineless'`
- `create_map_object`, `create_topdown_tileset`, `create_1_direction_object`: `'single color outline'` / `'selective outline'` / `'lineless'` のみ（`'single color black outline'` 不可）
- 黒太線を狙うときは `description` 文中で `"thick black outline"` を明示するのが安全

---

## 2. サイズ規約（プロジェクト共通）

このゲームでの推奨サイズ。**変えるときはコード側の cellPx と一緒に変える**。

| カテゴリ | サイズ | 例 |
|---|---|---|
| 床タイル | **32×32** | floor_wood.png |
| 小物 | **24×24** | コーヒー・観葉植物・モニター |
| 家具 | **48×48** | デスク・椅子・棚 |
| キャラ（社員） | **48×48** | worker_idle.png |
| 大型家具 | **64×64** | 会議テーブル・ソファ |
| キャラ集合シーン | **128×128** | 単一スプライト完結用 |

**重要**：違うサイズのスプライトを混ぜると見た目が破綻する。

---

## 3. 「素材は別々に作って合成」の原則 ⭐最重要

### 3-0. 基本思想：これは **ゲーム素材** である
PixelLab で作るスプライトは「1枚の完成イラスト」ではなく「**ゲームエンジンに食わせる部品**」。
**動かす／差し替える／組み合わせる**ことを前提に設計する。
1枚の絵として綺麗に見えるかではなく、**「この素材を別の状況で再利用できるか」** が品質基準。

### 3-1. 必ず守る（鉄則）
- **人とモノを1枚の画像に含めない** — 人＝アニメ対象、モノ＝差し替え対象。混ぜると両方できなくなる
- **PCはデスクと別にする**（装備アップグレードでスワップ）
- **椅子はキャラと別にする**（ergo chair upgrade等）
- **キャラはアニメ可能な単体スプライトとして作る**（standing idle → animate_character でアニメ生成）
- **キャラは複数の状態を独立に持つ**：立ち idle / 歩行 / 着席 / タイピング / 喜怒哀楽 など、場面ごとに別アニメとして作る

### 3-2. アンチパターン（過去にやらかしたNG）
- ❌「デスクの上にPCを載せた絵」を1枚で生成 → 装備差し替え不可（旧 desk_legacy.png）
- ❌「人が椅子に座って机に向かう絵」を1枚で生成 → アニメ不可、装備不可
- ❌「窓と壁を一体化した絵」を1枚で生成 → 窓だけ差し替え不可
- ❌「ジャケット背景にロゴを焼き込んだ絵」を1枚で生成 → 異なる作品で再利用不可
- ❌ 同じシーン内のスプライトを別世代のスタイルで混ぜる → 統一感崩壊

### 3-3. キャラクターの「状態セット」設計
1キャラに対して、以下を**それぞれ別アニメとして用意する**のが理想。
| 状態 | 用途 | 必須度 |
|---|---|---|
| 立ち idle 4方向 | 移動先・配置基本姿 | ★★★ |
| 歩行 4方向 | 移動・配置入退場 | ★★★ |
| タイピング（south/north） | デスクワーク（オフィス画面） | ★★★ |
| 着席 idle（south/north） | 静的着席状態（チャット・会議） | ★★ |
| 喜怒哀楽（cheering / sad / surprised） | リリース演出・イベント | ★★ |
| 特殊（読書 / 飲食 / 寝る等） | 休憩シーン・特定演出 | ★ |

→ 全部を一気に作る必要はない。**場面が増えたら都度アニメ追加**。

### 3-4. レイヤー合成の z-order（上から下）
```
z=4  モニター・PC（装備品）
z=3  デスク（装備品）
z=2  キャラクター（アニメ）
z=1  椅子（装備品）
z=0  床タイル
```
→ デスクで下半身を隠す技法で「座っている感」を出せる（立ち idle のままでも可）。
→ ただし本格的な座りアニメ（脚を曲げる等）が必要な場合は v3 mode で別途生成。

### 3-5. オブジェクト（モノ）の分解単位
- **家具**：1家具 = 1スプライト（例：デスク／椅子／棚／ソファ）
- **装飾**：1装飾 = 1スプライト（例：植物／コーヒー／ポスター）
- **構造物**：壁／窓／ドアは別々のスプライト
- **アクセサリ**：キャラが持つ物（鞄／本／カップ）も**キャラと分離**

### 3-6. 場面（コンテキスト）別の差分発想
同じキャラでも、場面によって**追加スプライト**が必要：
- オフィス画面 → 立ち + タイピング + 着席 + 歩行
- リリース演出 → 喜びジャンプ
- バッドエンド演出 → 落胆ポーズ
- 採用シーン → 入室歩行（東向き等）
- 「同じキャラの新作画」は1〜2 gen で生成可能。**先回りで作らず、必要になってから足す**

---

## 4. スタイル統一の鍵：style_images の活用

PixelLab の `create_1_direction_object` 等は `style_images`（参考画像 base64）を受け取れる。
**2枚目以降の生成は必ず1枚目を style_images に渡してパレット・線質を揃える**。

### 4-1. 推奨フロー
1. **基準スプライト**を1枚生成（最も世界観を体現したい素材）
2. 残りはこの基準を `style_images` に渡して連鎖生成
3. もし途中で「絵柄が崩れた」と感じたら、もう一度基準スプライトを style_images に入れ直す

### 4-2. base64 化のお作法
```bash
# 既存PNGを base64 にして style_images に渡す
base64 -w 0 public/sprites/office/desk.png > /tmp/desk.b64
# tool 呼び出し時に { "base64": "<...>", "format": "png" }
```

### 4-3. style_images の制約
- PNG/JPEG・最大 256×256 px
- `size` パラメータと組み合わせ時の上限あり：
  - size ≤ 85 → 最大8枚
  - size ≤ 170 → 最大4枚
  - それ以上 → 1枚

---

## 5. ジャンル別・カテゴリ別 プロンプトテンプレ

> このプロジェクトでは **アイソメトリック（2:1 dimetric, 30°×30°）＋立方体ベース** が確定。
> 詳細は [`office-visual-design`](../office-visual-design/SKILL.md) §2 と §2-A 参照。

### 5-0. 確定スタイル句（家具・装飾共通）
```
isometric pixel art style (Kairosoft Game Dev Story inspired),
30 degree isometric view, 2:1 dimetric projection,
sandbox-style chunky pixel art (Minecraft / SimCity feel),
top face + south face + east face all visible (three faces),
thick black outline, flat shading, bright saturated palette,
transparent background outside the object shape
```

### 5-1. オフィス家具（立方体ベース）
```
isometric pixel art of a [家具名], [色・素材],
fits within a [W]×[D]×[H] cube bounding box,
[共通スタイル句 §5-0]
empty surface no items no decorations on top
```
- 例: `isometric pixel art of a modern office desk with white laminate top and dark grey metal legs, fits within a 2×1×1 cube bounding box, top + south + east faces all visible, ...`
- ⚠ 立方体サイズは [`office-visual-design`](../office-visual-design/SKILL.md) §2-A-3 参照（机=2×1×1、椅子=1×1×2 等）
- ⚠ "no items on top" を入れないとPCや書類を勝手に乗せられる

### 5-2. オフィス装飾品（小型・1×1×N cube）
```
isometric pixel art of a small [object], fits within a 1×1×[H] cube,
single object centered, [共通スタイル句 §5-0]
```
- 観葉植物: 1×1×1.5 cube
- コーヒーマシン: 1×1×1.5 cube
- 本棚: 1×1×2.5 cube
- ホワイトボード: 2×0.1×1.5 cube（壁貼り）

### 5-3. 床タイル（アイソメひし形パターン）
```
seamless tileable isometric pixel art [素材] floor tile,
diamond shape 2:1 ratio (32px wide × 16px tall in isometric projection),
subtle outline (NOT thick - tile seams would be visible),
[共通スタイル句 §5-0]
```
- ⚠ アウトラインを太くすると繋ぎ目が目立つ → `subtle outline` または `selective outline`
- ⚠ アイソメ床はひし形（diamond）のパターンを意識

### 5-4. キャラクター（社員系・アイソメ前提）
```
isometric pixel art of a young [性別/年齢] office worker,
fits within a 1×1×2 cube (1 cube wide, 1 cube deep, 2 cubes tall when standing),
[服装], [髪型・色], cute chibi proportions (big head, small body),
Kairosoft Game Dev Story inspired sprite style,
thick black outline, flat shading, bright saturated palette,
visible from 30 degree isometric angle (3/4 view from south-east)
```
- view: `high top-down`（PixelLab には isometric 専用 view がないため最も近い "high top-down" を使う）
- size: 48
- n_directions: 4 または 8（アイソメは斜め4方向＝NE/SE/SW/NW がメインのため8方向推奨）
- ⚠ PixelLab はアイソメを完全に出せないことが多い。`style_images` に Kairosoft 系の参考画像を渡すと効果大

### 5-5. アニメーション
- `template_animation_id` 優先（1 gen/dir、安価）
- カスタム動作なら v3 モード（1 gen/dir、cheap）
- `pro` モードは最後の手段（20-40 gen、要 confirm）
- **タイピング**: template に該当なし → v3 で `"typing on keyboard, hands moving"` action_description

#### 5-5-1. ⭐ スプライトシート化（アニメ再生の必須手順）
PixelLab は **個別のフレーム PNG** を返す（例：`south/0.png` 〜 `5.png`）。
ゲーム内で再生するには **1枚のスプライトシート** に連結して CSS animation で steps() 再生するのが正攻法。
```bash
# 6フレームを横方向に連結（個別32x32 → 192x32 シート）
magick worker_walking/south/{0..5}.png +append worker_walk_south.png
```
```tsx
// React コンポーネント例
<SpriteAnimation
  sheet="/sprites/office/worker_walk_south.png"
  frames={6}
  fps={10}
  size={32}
/>
```
```css
.sprite-walk-south {
  width: 32px; height: 32px;
  background-image: url(...);
  animation: walk steps(6) 0.6s infinite;
}
@keyframes walk {
  from { background-position-x: 0; }
  to   { background-position-x: -192px; } /* = 6 * 32 */
}
```

**ルール**:
- 1アニメ＝1シート＝1方向ぶん（4方向あるなら4シート）
- フレームは横一列に並べる（CSSが楽）
- ファイル名は `{character}_{action}_{direction}.png` で統一
- fps の目安：歩行 10、タイピング 12〜15、着席idle 4〜6、ジャンプ 8〜10

#### 5-5-2. ⭐ 同じ物体の「向き違い」は1枚のスプライトシートに統合

> **ルール**：**同じ物体（机・椅子・モニター・キャラ等）が複数の向きを持つ場合、必ず1枚のスプライトシートに統合**。
> 別ファイルに分けない（×: `monitor.png` ＋ `monitor_back.png`、◯: `monitor.png` 1枚に複数向きを横並び）。

理由：
- ファイル数増殖防止
- CSS `background-position-x` で1ステートメントで切り替え可
- 装備品データ（equipment.ts）に「sheet path + orientation index」だけ持てば済む
- リソース管理が一貫する

#### 方向の標準オーダー（横並び）
このプロジェクトでは [`office-visual-design`](../office-visual-design/SKILL.md) §2-B 確定で **SW / NE の2方向**：
```
[ SW ][ NE ]
  0     1
```
- **SW（index 0）**：ペアの**上段ワーカー用**（NE 側に座って SW を向く）
- **NE（index 1）**：ペアの**下段ワーカー用**（SW 側に座って NE を向く）

`equipment.ts` の `orientation: 'SW' | 'NE'` で 2方向から選択。

将来「壁際机」を入れる場合は 4方向に拡張：
```
[ SW ][ NE ][ SE ][ NW ]
  0     1     2     3
```

#### シート作成のコマンド例（ImageMagick）
```bash
# 全物体：PixelLab で各方向を別途発注 → 連結のみ
# ⚠ 反転・回転で別方向を作るのは絶対禁止（§7-5-2）
magick desk_sw.png desk_ne.png +append desk.png
magick chair_sw.png chair_ne.png +append chair.png
```

#### コンポーネント側の使い方
```tsx
<div
  style={{
    width: frameSize,
    height: frameSize,
    backgroundImage: `url(/sprites/office/desk.png)`,
    backgroundPosition: `-${orientationIndex * frameSize}px 0`, // 0 = SW, 1 = NE
    backgroundSize: `${totalDirections * frameSize}px ${frameSize}px`,
  }}
/>
```

#### 物体ごとの推奨方向数と作り方（このプロジェクト確定・2026-06-07 書き換え）

| 物体 | 向き数 | 作り方 |
|---|---|---|
| **机** | 2（or 4） | 各方向を **`create_map_object` で別々に発注**（1gen ずつ）。反転・回転禁止 |
| **椅子（前向き）** | 1〜2 | 各方向を `create_map_object` で別々に発注 |
| **椅子（後ろ向き）** | 1 | 別 prompt で発注（前向き椅子からは作れない） |
| **モニター（嘘採用）** | 1 | 1枚使い回し（画面が両方向に見える嘘） |
| **モニター（リアル）** | 2 | 各方向を `create_map_object` で別々に発注 |
| **キャラ idle** | 8 | `create_character` で 8方向セット |
| **キャラアニメ（着席・タイピング）** | 2（SE/NW など） | `animate_character` v3 mode で `directions: ['south-east', 'north-west']` 指定 |
| **キャラ歩行アニメ** | 8 | template `walking-8-frames` で 8方向 |
| **植物・窓・床タイル** | 1 | 単体スプライト |

→ **2D 反転・回転は禁止（§7-5-2）**。すべて新規発注。
→ どの方向が必要かは office-visual-design §2-B でペア配置を確認してから決める。

#### アニメ × 方向（複雑なケース）
キャラの着席タイピングアニメを 2方向 8フレームで持つ場合：
- 2枚のシート：`worker_typing_sw.png` `worker_typing_ne.png`
- 各シートは 8フレーム横並び（8 × 48 = 384px幅）

これは「§5-5-1 アニメ＝1シート/方向」ルールに従う。
**静止画オブジェクト（机・椅子・モニター）の向き違いは§5-5-2 に従って1シート統合**。

---

## 6. コスト管理

### 6-1. プラン別の枠
- trial: 40 gen 月（学習用）
- Tier 1 ($12): 2000 gen/月（プロト〜本制作向け）
- Tier 2 ($24): 5000 gen/月（量産向け）

### 6-2. 1素材の標準コスト
- 床タイル（tileset 16タイル）: 1 gen
- 家具/小物（map_object or 1_direction_object）: 1 gen
- キャラクター（standard mode 4 dir）: 1 gen
- キャラアニメ（v3 mode south only）: 1 gen
- キャラアニメ（v3 mode 4 dir）: 4 gen

### 6-3. 投入前チェックリスト
- [ ] **立方体サイズ（W×D×H cube）を `office-visual-design` §2-A-3 で確認した？**
- [ ] サイズが §2 規約と整合してる？
- [ ] **共通スタイル句（§5-0：アイソメ＋立方体）を入れた？**
- [ ] style_images に基準スプライトを渡した？（2枚目以降）
- [ ] 'no items on top' 等の禁止句を入れた？（装備差し替え対象なら）
- [ ] 万一の再生成 1〜2回ぶんの予算を残してる？
- [ ] **「N×M×H cube bounding box」を description に明示した？**

---

## 7. 失敗パターンと対処

### 7-0. ⭐ このプロジェクトで実証した失敗・成功パターン一覧（2026-06-07）

#### ❌ 失敗パターン（やってはいけない）

| パターン | 何が起きたか | 教訓 |
|---|---|---|
| `create_1_direction_object` で `facing south-east` 指定 | 全候補が PixelLab デフォルト方向（SW）で出る | 1_direction では方向句が効かない。`create_map_object` を使う |
| 方向ラベル `chair_south-west.png` を画面の左下 = SW と読む（標準座標） | ユーザーと方向認識が逆になって混乱 | アイソメワールド標準座標（N=画面左上、S=画面右下）で読む |
| 既存スプライトを `magick -flop` で別方向に流用 | 3D の別角度にはならない（鏡像になるだけ）。光源も反転 | 2D 反転は禁止。すべて新規発注 |
| 既存スプライトを `magick -rotate 180` で NE 向きを作る | 「下から見上げた違和感」が出る。drawer位置だけ反転、影が裏返る | 180度回転禁止。新規発注 |
| 普通の英文に「facing north-west」を埋め込む | 弱い指示でガチャに倒される | `CRITICAL DIRECTION CONSTRAINT` + 大文字 + NEVER 等の強制表現 |
| ユーザー指示「1方向だけ発注」を勝手に8方向に拡張 | 余計な 20gen 消費、ユーザー意図と乖離 | 指示の範囲を勝手に広げない |
| 同じセッション内で方向問題に何度もガチャを繰り返す | ユーザーのお金と時間を浪費 | 「効かない技法」を確認したら撤退、別アプローチへ |

#### ✅ 成功パターン（やるべき）

| パターン | 結果 | 採用ルール |
|---|---|---|
| `create_map_object` + `facing south-east in isometric world coordinates (...)` | 方向通りの絵が 1gen で出た | **第一選択ツール**。1gen 安い |
| `create_8_direction_object` で8方向セット | アイソメワールド座標でラベル通り全方向出る | 同じ物体の全方向揃えたい時 |
| `create_character` v3 mode + 8方向 | 全方向で方向ラベル正確、品質高い | キャラ生成の標準 |
| `animate_character` v3 mode + `directions:[...]` 指定 | 指定方向だけアニメ生成（コスト節約） | アニメは必要方向だけ |
| `create_tiles_pro` + `tile_view_angle: 30` | アイソメ30°ひし形タイルが複数バリエ一括で出る | 床タイルの量産 |
| 採用前に Read で目視確認（アイソメワールド座標で読む） | ラベル誤読を防げる | 全スプライト必須 |

---


### 7-1. サイズ不整合
**症状**: デスクは大きく、キャラは小さく、PCは見えない。
**原因**: 別々の解像度で生成、合成時に CSS スケールでバラつき。
**対処**: §2 規約に沿って同じ世代の素材は同じ「実ピクセル → セル換算」で生成。例：cellPx=96 なら家具は2セル=64×64実ピクセル基準。

### 7-2. 絵柄バラつき
**症状**: 同じシーン内で線の太さや陰影方向が違う。
**原因**: style_images を使ってない、または基準スプライトを統一してない。
**対処**: §4 のフローで連鎖生成。

### 7-3. 装備品にアクセサリが乗ってしまう
**症状**: "office desk" と頼んだのに PC や書類まで描かれる。
**対処**: プロンプトに `no items on top, no decorations, empty surface` を追加。

### 7-4. 透明背景にならない
**症状**: 背景が描かれてしまう。
**対処**: `transparent background` を明示。`create_map_object` はデフォルトで透明だが、宣言しておくと安心。

### 7-5. trial 枠の低速キュー
**症状**: ETAが10倍くらいになる（例：30s→457s）。
**原因**: trial プランは低優先度。
**対処**: 並列で3〜4ジョブ投入してまとめて待つ。本制作は Tier 1 加入を検討。

### 7-5-1. 方向制御 ⭐【2026-06-07 完全書き換え】

#### 結論：座標系とツールの両方を理解すれば方向制御は可能

**A. 座標系（最重要）：アイソメワールド標準を使う**

PixelLab object 系の方向ラベル（north / south / east / west / 斜め4方向）は **アイソメワールド座標** で正確に出る。**2Dトップダウン座標（上=N、下=S、右=E、左=W）で読むと全部逆になって混乱する**。

| 方位 | アイソメワールドでの画面位置 |
|---|---|
| **N（北）** | 画面の **左上** 方向 |
| **NE** | 画面の右上斜め |
| **E（東）** | 画面の **右上** 方向（やや右寄り） |
| **SE** | 画面の右下斜め |
| **S（南）** | 画面の **右下** 方向 |
| **SW** | 画面の左下斜め |
| **W（西）** | 画面の **左下** 方向（やや左寄り） |
| **NW** | 画面の左上斜め |

物体の「向き」 = **物体の正面（人が見る側、ノートパソコンのパネル法線、机の drawer 反対側等）** が指す方角。例：
- ノートパソコン「SE向き」= パネルが画面の右下方向に向く（人は右下から見ている）
- 机「SW向き」= 机の正面（drawer 反対側＝使用者側）が左下方向

**B. ツール別の方向句の効き（2026-06-07 実証）**

| ツール | 方向句 (`facing south-east` 等) の効き | コスト | 用途 |
|---|---|---|---|
| **`create_map_object`** | ✅ 効く（プロジェクトでの第一選択） | **1gen / 1候補** | 通常の単方向物体 |
| **`create_8_direction_object`** | — （8方向すべて出るので方向句不要） | **20gen / 8方向** | 同じ物体を全方向揃えたい時。`reference_image_base64` 併用可 |
| **`create_1_direction_object`** | ❌ **効かない**（常に PixelLab デフォルト SW向きに倒れる） | 20gen / 16候補 | 単方向ガチャ用、方向不問の物体のみ |

→ **デフォルトは `create_map_object`**。1gen で安く、方向句で正確に方向制御できる。

**過去の失敗（学習用）:**
- 2026-06-07: 椅子を `create_1_direction_object` で `"facing south-west"` prompt 発注 → 全候補が PixelLab デフォルト方向で出て方向句が効かないと誤判定した
- 2026-06-07: 8方向 chair_south-west.png を「画面左下＝SW」と読んだが、これは標準座標の読み方。アイソメワールドでは画面左下＝SW で **PixelLab ラベル通り正しい**ことが後から判明
- 2026-06-07: ノートパソコンを `create_map_object` で `"facing south-east"` 発注 → 期待通りパネルが画面右下に向く絵が出た。**ツール選定が正解だった**

**正しい発注手順:**
1. **ツール選定**：単方向なら `create_map_object`、フルセットなら `create_8_direction_object`
2. **方向句**：`facing <direction> in isometric world coordinates (...画面のどこに何が向くか具体的に...)` を必ず明示
3. **採用前確認**：絵を Read してアイソメワールド座標で方向判定（標準座標で読まないように注意）

### 7-5-2. ImageMagick 反転・回転の限界 ⭐ 絶対禁止
**結論：2D 画像を反転・回転して別方向のスプライトを作るのは原則 100% 不可能。提案も禁止。**

**症状**: SW向きの物体を180度回転 or 水平反転（`-flop`）して、別方向のスプライトに使おうとする → 全部失敗する
- 椅子・人物・ノートパソコン・モニター：背面や開閉状態など「画面に描かれていない情報」は反転で生成できない
- 机：左右対称に見えても、影や光源の方向も反転するので「下から見上げた違和感」が出る

**原因**: PixelLab が出すのは **2D ピクセル画像** であり、3D モデルではない。2D 反転は画像の左右ピクセルを入れ替えるだけ＝3D 空間の視点回転と等価ではない。

**対処（厳守）**:
- 別方向が必要な物体は **必ず PixelLab に新規発注する**（`create_map_object` か `create_8_direction_object`）
- 「flop で SW から SE 作れる」「rotate 180 で NE 作れる」を**選択肢として出さない**
- 既存スプライトを 2D 加工して「別方向」と称するワークフローは禁止
- 例外：UI アイコンの装飾的なミラーなどは別。ゲーム内オブジェクトの方向違いには絶対使わない

**過去の失敗（学習用）**:
- 2026-06-07: 机 NW を `desk_sw.png` の 180度回転で作って影が反転、ユーザー却下
- 2026-06-07: ノートパソコン SE を SW から flop で作る案を提示し、ユーザーから「現実的にありえない」と却下

### 7-6. 視点（角度）の解釈ブレ ⭐重要
**症状**: 同じ `view: 'high top-down'` を指定したのに、デスクは真上・椅子は真後ろ・モニターは斜め…と**スプライトごとに角度が違う**。並べると違和感大。
**原因**: PixelLab の `view` は緩やかな指示で、絵柄や description によって解釈が 0〜45° まで揺れる。
**対処（このプロジェクトでの確定方針）**:
- **アイソメトリック（30°×30°、2:1 dimetric）を確定スタイルとして使う**
- description 文中で「**isometric view**」「**30 degree isometric**」「**three faces visible (top + south + east)**」を明示
- **「N×M×H cube bounding box」を入れる**（立方体ベースを意識させる）
- 既存のスタイル合致スプライトを `style_images` に渡して角度を揃える
- PixelLab には `create_isometric_tile` 専用ツールがあり、isometric を意識した生成に有効

**経験則**:
- 家具（デスク・椅子・テーブル）: 「isometric, three faces visible」を強く指示しないと斜めや真俯瞰になる
- キャラクター: PixelLab は基本立ち絵。「isometric chibi character from 30 degree angle」と書いて style_images に Kairosoft 系を渡すと効果大
- モニター・PC: 「flat front」「TV screen view」と書くと画面正面ばかりになる → アイソメ向けは「isometric monitor with screen visible at slight angle, three faces」

### 7-7. ジョブスロット上限（8並列）
**症状**: 9件目の生成リクエストで `error: need 1 job slots but only 0 available (8/8 used)` 発生。
**原因**: PixelLab は **同時実行ジョブ8件** が上限。`walking` template は 4方向 = 4 job 消費するなど、テンプレートが複数 job を生成することに注意。
**対処**:
- 大量並列するときは **8 job 上限** を意識して投入順を組む
- まず重い template（複数方向）を投入 → 待つ → 単発を投入 のリズム
- エラーが出たら数十秒待って再投入

---

## 8. 検収プロトコル

新しいスプライトを project の `public/sprites/office/` に置く前に：

1. **目視確認**: PixelLab の `get_*` ツールで preview を見る
2. **サイズ確認**: §2 規約と一致するか `file` コマンドで確認
3. **背景確認**: 透明背景か（背景色が描き込まれていないか）
4. **配置テスト**: dev server で OfficeView 等のコンポーネントに差し込んで描画確認
5. **Aseprite 加工（v0.9 spec §付録Z-4）**: 商用利用するなら **人間の手による加工を必ず1手間入れる**（色調整 / トリミング / アンチエイリアス潰し）。これが法的にも見た目的にも品質保証になる

---

## 9. 既知のプロジェクト固有制約

### 9-1. PCE 風 16色制約
- 設計書（v0.9 spec）で PC Engine 風 16色パレットを目指している
- PixelLab はパレット直接指定不可 → プロンプトで誘導：
  - `vibrant 16-color palette like PC Engine games`
  - `limited color palette, no gradients, no anti-aliasing`

### 9-2. 配置先のセルサイズ
- `OfficeView.tsx` の `TILE * SCALE = 32 × 3 = 96px`
- 「1セル = 32px 実解像度」を基準にスプライトを発注

### 9-3. 床タイルは継ぎ目が出やすい
- `create_topdown_tileset` で出力される base tile は単体使用OK
- ただし `outline: 'single color black outline'` は繋ぎ目が目立つ → 床は `'selective outline'` または `'lineless'` 推奨

---

## 10. 即使えるプロンプト・スニペット集

> 全スニペットは **アイソメトリック＋立方体ベース＋アイソメワールド座標** 仕様。
> ⭐ **座標系**：N=画面左上、E=画面右上、S=画面右下、W=画面左下（§7-5-1 参照）
> ⭐ **デフォルトツールは `create_map_object`**（1gen / 方向句効く）。`create_1_direction_object` は方向句効かないので非推奨。
>
> 共通方向句テンプレ（例：SE向き）:
> ```
> facing south-east in isometric world coordinates
> (the front of the object faces the lower-right area of the image,
> with three faces visible: top, south, and east),
> isometric 30-degree dimetric perspective
> ```
> 別方向は `south-east` を置き換える＋画面のどこに何が向くか具体的に補足する。
>
> 別方向は全物体で **新規発注必須**（2D 反転・回転禁止、§7-5-2）。

### 10-0. ⭐ 推奨ツール選定（2026-06-07 実証）

| 用途 | ツール | コスト | 理由 |
|---|---|---|---|
| **単方向の物体（家具・小物 1個）** | **`create_map_object`** | **1 gen / 1候補** | 方向句が効く。最安。第一選択 |
| **同じ物体の全方向セット** | `create_8_direction_object` | 20 gen / 8方向 | ラベルは正確（アイソメワールド座標）。`reference_image_base64` で既存物体の8方向版可 |
| **方向不問・複数バリエ比較** | `create_1_direction_object` | 20 gen / 16候補 | 方向句効かない（PixelLab デフォルト方向に倒れる）。バリエ比較したい時のみ |
| **タイル単体** | `create_isometric_tile` | 1 gen | アイソメひし形タイル単発 |
| **複数バリエタイル** | `create_tiles_pro` | 20-40 gen / 16タイル | 色違い・パターン違い一括。`tile_view_angle: 30` でアイソメ30°厳密指定可 |

→ 家具・小物の生成は **必ず `create_map_object` から始める**。20gen ガチャは無駄。

### 10-0b. ⭐【新】prompt 強制表現テンプレ（必ず使う）

普通の英文に方向句を埋めるだけでは効きが弱い。**Midjourney 等で使う強制表現**を必ず使う。

#### 構造
```
1. 物体の本体描写（外観・素材・色）
2. CRITICAL DIRECTION CONSTRAINT ブロック（大文字・MUST/NEVER・除外）
3. 視点・サイズ・スタイル句
```

#### 強制ブロックのテンプレ（SE向きの例）
```
CRITICAL DIRECTION CONSTRAINT (must be strictly followed):
the object MUST face SOUTH-EAST in isometric world coordinates.
the FRONT of the object MUST point to the LOWER-RIGHT area of the image.
the BACK of the object MUST point to the UPPER-LEFT area of the image.
DO NOT face south-west. DO NOT face north-east. DO NOT face north-west.
NEVER orient the object so the front faces the upper-left, upper-right, or lower-left.
```

#### 効くキーワード
- `MUST` / `MUST NOT` （絶対指定）
- `STRICTLY` / `STRICT` （厳密化）
- `NEVER` / `DO NOT` （除外）
- 大文字（強調）
- 除外方向を **明示列挙**（"DO NOT face X, Y, Z"）
- `CRITICAL` / `MANDATORY` / `IMPORTANT`（重要度マーカー）

#### NG パターン（過去の失敗）
- ❌ "facing south-east" だけ書く → ガチャに倒される
- ❌ "the screen faces upper-left" だけ書く → 解釈ブレ
- ❌ 否定指定なし → モデルが別方向に逃げる
- ❌ 小文字の方向句 → 重要度が低く解釈される

これを必ず適用したかどうかをセルフチェック（§14-6）に追加する。

### 10-1. オフィスデスク（2×1×1 cube）
```
isometric pixel art of a modern office desk with drawer cabinet on the user side,
white laminate top, dark grey metal frame legs at four corners,
facing south-east in isometric world coordinates (the drawer cabinet and the user-facing front of the desk point toward the lower-right area of the image, so a worker would sit on the south-east side of the desk),
three faces visible: top, south, east,
isometric 30-degree dimetric perspective,
fits within a 2×1×1 cube bounding box,
sandbox-style chunky pixel art (Kairosoft Game Dev Story inspired),
empty top surface no items no monitors no keyboards,
thick black outline, flat shading, bright saturated palette, transparent background
```
- **`create_map_object`**, view='high top-down', width=96, height=64
- 別方向（SW / NE / NW）が必要なら方向句を置き換えて新規発注（1gen ずつ）
- ⚠ 反転・回転で別方向を作るのは禁止（§7-5-2）

### 10-2. オフィス椅子（1×1×2 cube・前向き）
```
isometric pixel art of an office swivel chair,
seen from the front (the seat surface and the front face of the back rest are visible),
facing south-east in isometric world coordinates (the seat opens toward the lower-right area of the image, so a worker sitting in this chair faces the lower-right),
three faces visible: top, south, east,
isometric 30-degree dimetric perspective,
dark grey fabric seat and back rest, five caster wheels at the base spreading out,
fits within a 1×1×2 cube bounding box,
sandbox-style chunky pixel art (Kairosoft Game Dev Story inspired),
thick black outline, flat shading, transparent background
```
- **`create_map_object`**, view='high top-down', width=48, height=64
- 完成後 Read で目視確認：座面の向きがアイソメワールド座標で意図通りか

### 10-2b. オフィス椅子（後ろ向きが必要な場合のみ）
```
isometric pixel art of an office swivel chair,
seen from behind (only the back side of the back rest is visible, the seat is hidden behind the back rest),
facing north-west in isometric world coordinates (the seat opens toward the upper-left, away from the camera, so the back rest blocks the seat from view),
dark grey fabric back rest exterior, five caster wheels at the base spreading out,
fits within a 1×1×2 cube bounding box,
sandbox-style chunky pixel art (Kairosoft Game Dev Story inspired),
thick black outline, flat shading, transparent background
```
- **`create_map_object`**, view='high top-down', width=48, height=64
- ⚠ 椅子の後ろ姿は PixelLab が苦手な角度。生成失敗（前向きで出る）の場合は方向句強化 or 8方向発注（`create_8_direction_object` で N ラベル＝真後ろ姿を採用）に切り替え
- 2D 反転・回転で作るのは絶対禁止（§7-5-2）

### 10-3. CRTモニター（旧式・1×0.5×1.5 cube）
```
isometric pixel art of a small CRT computer monitor with chunky beige plastic case,
fits within a 1×0.5×1.5 cube bounding box (1 wide, 0.5 deep, 1.5 tall - standing on desk),
screen face visible at slight angle (30 degree isometric), top + south + east faces visible,
sandbox-style chunky pixel art (Kairosoft inspired),
thick black outline, flat shading, transparent background
```
- create_map_object, width=48, height=64

### 10-4. 液晶モニター（中グレード・1×0.5×1.5 cube）
```
isometric pixel art of a slim flat-screen LCD computer monitor with modern black bezel,
fits within a 1×0.5×1.5 cube bounding box,
glowing blue screen face visible at 30 degree isometric angle,
top + south + east faces all visible (three faces),
sandbox-style chunky pixel art (Kairosoft inspired),
thick black outline, flat shading, transparent background
```
- create_map_object, width=48, height=64

### 10-5. 社員キャラ（1×1×2 cube、着席時）
```
isometric pixel art of a young office worker in casual clothes, friendly expression,
chibi proportions (big head, small body),
fits within a 1×1×2 cube bounding box (1 wide, 1 deep, 2 tall),
visible from 30 degree isometric angle (Kairosoft Game Dev Story style),
thick black outline, flat shading, vibrant saturated palette
```
- create_character, body_type='humanoid', view='high top-down', size=48,
  outline='single color black outline', shading='basic shading',
  n_directions=8（アイソメは斜め4方向 NE/SE/SW/NW を使うので 8 推奨）
- 重要：style_images に Kairosoft 系 sprite（参考画像）を渡すと劇的に改善

### 10-6. タイピングアニメ
- animate_character, mode='v3', action_description='typing on keyboard, hands moving rapidly, sitting at desk in isometric chibi style',
  directions=['south-east'], frame_count=6
- 注：アイソメでは south-east など斜め方向を使う

### 10-7. 床タイル（アイソメひし形）
```
seamless tileable isometric pixel art office carpet floor tile,
diamond shape 2:1 ratio (32 pixels wide and 16 pixels tall in isometric projection),
warm orange color (Kairosoft style), no thick outlines (tile seams should be invisible),
flat shading, transparent background
```
- create_topdown_tileset or create_isometric_tile
- ⚠ outline は `selective outline` または `lineless` 推奨

---

## 11. 更新ログ

このスキルの変更履歴を末尾に追記する。

### 2026-06-07（v1 初版）
- 設計書 v0.9 のテイスト方針（Kairosoft 系）を反映
- 「素材は別々に作って合成」原則を明文化（PC・椅子・デスクは別スプライト）
- サイズ規約を OfficeView の `cellPx=96` 基準で確定
- 失敗パターン 5 件と即使えるスニペット 6 件を収録

### 2026-06-07：初版
- PixelLab MCP の汎用テクニックを集約
- アイソメトリック＋立方体ベース＋2方向スプライトシート方式で確定
- §3「素材は別々に作って合成」原則
- §5 プロンプトテンプレ（アイソメ・立方体・サンドボックス系）
- §10 即使えるスニペット集

### 更新ルール
- 新しい要望が来たら **§5 テンプレ** または **§7 失敗パターン** に追記
- スタイルが変わったら **§1 世界観** を改訂
- 学んだコスト情報は **§6 コスト管理** へ
- **古い基準は削除する**（混乱防止のため）。重要な学びは「§7 失敗パターン」に教訓のみ残す

---

## 12. 関連ファイル
- 仕様: [docs/spec/](../../../docs/spec/)
- 素材置き場: [public/sprites/](../../../public/sprites/)
- ドキュメント運用規約: [docs/CLAUDE.md](../../../docs/CLAUDE.md)
- 配置コンポーネント: [src/components/OfficeView.tsx](../../../src/components/OfficeView.tsx)

---

## 13. プロジェクト固有のビジュアル仕様

> このプロジェクトの**世界観・パース・配置・サイズ規格**は別スキル [`office-visual-design`](../office-visual-design/SKILL.md) を必ず参照。
>
> **棲み分け**：
> - **pixelart-prompting**（このスキル）＝ PixelLab MCP の**汎用**テクニック（プロンプト・サイズ規約・コスト管理・失敗パターン）
> - **office-visual-design** ＝ このプロジェクト固有の**確定テイスト・配置・規格**（アイソメ・立方体ベース・向かい合わせペア）
>
> 新しいスプライトを発注する時は **両スキルを併用**：office-visual-design で「何を作るか」を決め、pixelart-prompting で「どう発注するか」を決める。

---

## 14. セルフチェック プロトコル ⭐【生成・配置のたびに必ず実行】

> **過去の失敗**：ユーザーが「サイズおかしい」「視点バラバラ」を指摘して初めて気付いた。
> **改善**：素材生成後・配置後に**必ず以下を能動的にチェック**してから報告する。
> **原則**：「とりあえず動かして見せてフィードバック待ち」は禁止。先に問題を発見する。

### 14-1. スプライト個別の検証（生成直後）

1. **サイズ計測**：`magick identify file.png` で実寸を取得し、§2 規約と一致するか
2. **背景透明確認**：`magick identify -format '%[opaque]' file.png` で false なら透明あり ✓
3. **目視確認（Read tool）**：
   - [ ] 視点が **アイソメトリック（30°×30°、2:1 dimetric）** になっているか（office-visual-design §2 参照）
   - [ ] **立方体規格（N×M×H cube）** に収まっているか（office-visual-design §2-A 参照）
   - [ ] 線・色・シェーディングが他の同シーン素材と統一感あるか
4. **判定結果を office-visual-design §11 の既存スプライト判定表に記録**

### 14-2. 現実比のチェック（複数素材並べた時）

オフィス家具の現実比（参考値）：
| 物 | 高さ | 幅 |
|---|---|---|
| 大人の頭の高さ（座位） | ~120cm | ~50cm |
| デスク天板 | (高さ75cm) | 120cm 横幅 |
| 液晶モニター（24型） | ~50cm | ~55cm |
| オフィスチェア | 背もたれ高90cm | 座面径50cm |

→ スプライト比に換算：
- **人物：モニター ≈ 2.4 : 1（高さ）**
- **机幅：人物幅 ≈ 2.4 : 1**
- **椅子背高：人物頭高 ≈ 0.75 : 1**

スクリーンショット撮ったら**実測値**で比率を確認：
```bash
# 例：worker と desk の高さ比測定
magick identify -format '%h\n' worker_idle.png desk.png
# → 比率が 2:1〜2.5:1 の範囲内ならOK
```

### 14-3. 視点の一貫性チェック

並べて配置する素材を全部 Read して、**全要素が同じ視点角度** か目視判定：

| ✅ OK サイン | ❌ NG サイン |
|---|---|
| すべて「南エッジに薄い影」がある | 一部だけ完全に真俯瞰 |
| すべて「上面と少しの正面」が見える | モノだけ正面が見えない |
| 人物・椅子・モニター全部に「立ち上がり感」 | 机だけ平面、他は立体 |

### 14-4. Game Dev Story との並列比較

参考画像（Game Dev Story スクリーンショット）を Read し、以下を判定：

```
□ 視点角度が同じ程度（~35° 後傾）か
□ 線の太さが似ているか
□ 色彩の鮮やかさが似ているか
□ キャラのデフォルメ度が似ているか
□ オブジェクト密度（密集感）が似ているか
```

### 14-5. 配置後の検証（OfficeView更新後）

Playwright スクショ後、以下をチェック：

```
□ 4人全員が見える位置にいるか（実際に椅子に座って机に向かっているか）
□ 人と物の重なり順が現実的か（机が人の下半身を隠す等）
□ 隙間／重なりすぎがないか
□ 各要素のスケールが揃っているか
□ 部屋の壁・床のテイストがキャラ・家具と統一感あるか
```

### 14-6. 自己検証コマンド集

```bash
# サイズ一括確認
cd /home/shsk/git/game/public/sprites/office
magick identify -format '%f: %wx%h\n' *.png | sort

# 比率計算
python3 -c "
import subprocess
for f in ['worker_idle.png', 'desk.png', 'monitor.png', 'chair.png']:
    r = subprocess.check_output(['magick', 'identify', '-format', '%w %h', f]).decode().split()
    print(f'{f}: {r[0]}x{r[1]} (ratio H/W: {int(r[1])/int(r[0]):.2f})')
"

# 全部 Read で目視確認（実行コマンドではなく手順）
# → Read tool で各 PNG を表示し、office-visual-design §2 と照合
```

### 14-7. 報告フォーマット

ユーザーへの報告前に以下を必ず付記：

```
## 自己チェック結果（§14）
- サイズ実測： [worker: 48x48, desk: 64x64, monitor: 32x32]
- 視点一貫性： [✅ / ⚠️ desk が真俯瞰寄り]
- 現実比： [✅ / ⚠️ 人 vs 机 = 0.5 だが現実は 0.4 推奨]
- 配置検証： [✅ 4人着席確認 / ⚠️ AB椅子がはみ出る]
- 残課題： [リストアップ]
```

→ チェックで問題が見つかったら **報告前に修正** or **修正案を併記**。「動いたから見せます」だけはNG。

### 14-8. プロセス改善（再発防止）

過去の失敗パターンと対処：
| 失敗 | 対策 |
|---|---|
| サイズ感がおかしいまま報告 | §14-2 の比率チェックを毎回 |
| 視点バラバラのまま合成 | §14-3 で並べ目視 |
| 椅子の向きが逆 | office-visual-design §2-C-5 の反転マトリクスを確認 |
| 「人と物を1枚に」して融通効かなくなる | §3-1 の鉄則を生成前に再読 |
| ユーザー指摘待ちでリアクティブ | この §14 を毎回実行
| 立方体サイズを意識せず発注 | office-visual-design §2-A-3 を必ず確認 |
