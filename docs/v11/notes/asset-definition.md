# v0.11 UI 刷新：必要素材定義書

> 確定日: 2026-06-09
> 前提: フォントは [x0y0pxFreeFont (hicchicc 製)](https://hicchicc.github.io/00ff/) で確定
> 関連: [pixel-ui-research.md](./pixel-ui-research.md) / [ui-audit.md](./ui-audit.md)

「ゲームに入り込めるドット絵 UI」を実現するために v0.11 で必要となる **フォント・スプライト・SE・BGM・アニメ素材** を一括定義する。発注 / DL / 自前制作の判断は素材ごとに明示する。

---

## 0. 設計原則（前提）

1. **すべてピクセルグリッドに乗る**：4px グリッドを基準、スケール 2x / 3x / 4x で投影
2. **パレットは 32 色固定**（カイロソフト風 + 神ゲー帯のゴールド）
3. **アニメは離散フレーム**（`steps()`・SVG / Sprite Sheet）、滑らかなイージング禁止
4. **SE は必ずアニメと同期**（押下 100ms 以内に音）
5. **フォントは 3 種類使い分け**（HUD・本文・バッジ）、絶対に sans-serif にフォールバックしない

---

## 1. フォント（確定）

### 1-1. 採用フォント 3 種

| 用途 | フォント名 | グリッド | カバー | ライセンス |
|---|---|---|---|---|
| **本文・ダイアログ・サマリ** | **x12y16pxMaruMonica** | 12×16px | ひらがな・カタカナ・漢字（広範囲）・英数・記号 | SIL OFL（商用可、表記不要） |
| **HUD・タイトル・スコア** | **x14y24pxHeadUpDaisy** | 14×24px | 上に同じ | SIL OFL 移行中 |
| **バッジ・ボタンラベル・小数字** | **x8y12pxDenkiChip** | 8×12px | 上に同じ | SIL OFL |

理由：
- **MaruMonica**：丸ゴシック系で長文の可読性が高い。会社サマリ・チュートリアル・本文向け
- **HeadUpDaisy**：HUD 専用設計、太めで遠目でも読める。資金額・スコア・経営指標向け
- **DenkiChip**：8×12 の最小サイズで密度を稼げる。ボタン文字・規模ラベル・タグ向け

### 1-2. サイズ運用ルール

| 用途 | フォント | 表示 px | 行間 |
|---|---|---|---|
| メイン HUD（資金額） | HeadUpDaisy | 24px or 36px（CSS scale） | 24px |
| セクションタイトル | HeadUpDaisy | 24px | 28px |
| 本文 | MaruMonica | 16px | 22px |
| サブテキスト | MaruMonica | 12px | 16px |
| ボタンラベル | DenkiChip | 12px or 16px | — |
| バッジ / タグ | DenkiChip | 12px | — |

### 1-3. 配置

```
public/fonts/
  ├─ x14y24pxHeadUpDaisy.woff2
  ├─ x12y16pxMaruMonica.woff2
  └─ x8y12pxDenkiChip.woff2
```

CSS `@font-face` で `font-display: swap` で読み込み。GitHub Releases から最新を DL（v2025-09 系）。

### 1-4. アクション
- [ ] **AS-Font-1**：3 種の woff2 を `public/fonts/` に配置（DL）
- [ ] **AS-Font-2**：`global.css` に `@font-face` 定義 + 既存 Google Fonts CDN 削除
- [ ] **AS-Font-3**：`game-ui-design` SKILL §3 の「フォント」セクションを書き換え

---

## 2. 9-slice ウィンドウ枠（最重要 / P0）

ピクセル UI では「角丸 div + box-shadow」ではなく、**9-slice 枠**でウィンドウを描く。これがないとピクセル感は出ない。

### 2-1. 必要な枠の種類

| ID | 用途 | サイズ（境界 px） | 仕様 |
|---|---|---|---|
| `frame_standard` | 通常ウィンドウ（PixelWindow デフォルト） | 8px 角 + 4px 縁 | 木目調・タイトルバー無し可 |
| `frame_emphasis` | 強調ウィンドウ（借金パネル、神ゲー認定枠） | 8px 角 + 4px 縁 | 金縁・タイトルバーあり |
| `frame_modal` | モーダル（採用・規模解放・設定） | 12px 角 + 6px 縁 | 厚い縁・タイトル背景濃色 |
| `frame_tooltip` | ホバーツールチップ | 4px 角 + 2px 縁 | 細い縁・矢印付き |
| `frame_dialog` | キャラ吹き出し（チュートリアル等） | 6px 角 + 3px 縁 | 矢印付き・3 方向（下・上・横） |
| `frame_status` | 上部 HUD バー | 4px 縁・タイル可能 | 黒板風・無限横展開 |

### 2-2. 9-slice 仕様（カイロ流）

各枠は **3×3 = 9 タイル**で構成：
- 4 隅：固定サイズスプライト
- 4 辺：1px 単位で繰り返し可能なタイル
- 中央：透明 or 単色背景（PNG だと中央タイル 1px）

例：`frame_standard` を 64×64px の元画像から書き出すなら：
- 角：12×12px × 4 個
- 横辺：40×12px × 2 個（上下）
- 縦辺：12×40px × 2 個（左右）
- 中央：40×40px × 1 個

CSS で `border-image: url() 12 12 12 12 stretch round;` で使う。

### 2-3. 発注 / 自前制作の判断

- **PixelLab**：6 種 × 3 候補（バリアント比較用） ≒ 18 gen
- 採用 1 個ずつ → 9-slice 用に手動分割

### 2-4. アクション
- [ ] **AS-Frame-1**：6 種類の枠を PixelLab で発注（`create_map_object` / 1gen 単発、CRITICAL prompt 強制）
- [ ] **AS-Frame-2**：採用画像を 9-slice 用に分割（手動）
- [ ] **AS-Frame-3**：`PixelWindow` を `border-image` ベースに書き換え

---

## 3. ボタン（P0）

### 3-1. 必要なバリアント

| ID | 用途 | サイズ |
|---|---|---|
| `btn_primary_s/m/l` | 一次アクション（採用・開発開始等） | 24px / 32px / 40px 高 |
| `btn_secondary_s/m/l` | 二次（候補入替、戻る等） | 同上 |
| `btn_danger_s/m/l` | 危険（解雇・リセット） | 同上 |
| `btn_icon` | アイコンのみ（メニュー、設定） | 32×32px / 48×48px |
| `btn_close` | モーダル右上の × | 24×24px |

各バリアント × **3 状態**（idle / hover / press） × **2 サイズ平均** = 約 30 スプライト

### 3-2. 仕様

- 押下時：**1px 下に沈む**（影 1px、ハイライト 1px ずれる）
- ホバー時：**1px 明るく**（ハイライト 1 段階明るい色に）
- 押下中：効果音「ピッ」と同時発火
- disabled：彩度ゼロ + 30% 暗

### 3-3. アクション
- [ ] **AS-Btn-1**：3 バリアント × 3 状態 × 中サイズ = 9 個を PixelLab で発注（≒ 9 gen）
- [ ] **AS-Btn-2**：小・大サイズはピクセル単位スケーリングで派生
- [ ] **AS-Btn-3**：`PixelButton` 書き換え + アニメ実装

---

## 4. アイコン（P0）

### 4-1. メニューアイコン（32×32px、7 種、既存）

`public/sprites/ui/icon_{plan,hire,scale,library,collection,achievements,settings}.png`

既存 12 個発注済（v0.10）→ そのまま流用。ただし「office（家）」アイコン追加が必要。

### 4-2. ステータスアイコン（16×16px、新規）

| ID | 表現 |
|---|---|
| `icon_yen` | ¥ マーク（資金） |
| `icon_fans` | ハート・人形（ファン） |
| `icon_employees` | 人型（従業員数） |
| `icon_works` | 本（作品数） |
| `icon_debt` | 札束に手錠（借金） |
| `icon_interest` | %マーク（月利） |
| `icon_score` | 🎯 標的（メタスコア） |
| `icon_quality` | ⭐ 星（品質） |
| `icon_combo` | 炎（コンボ） |
| `icon_wpm` | ⚡ 雷（WPM） |
| `icon_calendar` | 📅 カレンダー（日付） |
| `icon_clock` | 砂時計（時間進行） |

合計 12 種類。emoji の現状から完全に置き換える。

### 4-3. カテゴリ・規模アイコン（24×24px、新規）

- カテゴリ 6 種：graphics / sound / story / gameplay / presentation / innovation
- 規模 5 種：mini / mobile / indie / hit / aaa
- ジャンル 12 種 / テーマ 15 種：emoji のままで OK（多すぎる）

合計 11 種。

### 4-4. アクション
- [ ] **AS-Icon-1**：ステータスアイコン 12 種を PixelLab で発注（16×16、1gen ずつ ≒ 12 gen）
- [ ] **AS-Icon-2**：カテゴリ・規模アイコン 11 種を発注（24×24、≒ 11 gen）
- [ ] **AS-Icon-3**：`PixelIcon` を画像 src 優先・emoji フォールバックに

---

## 5. カーソル・ポインタ（P1）

ピクセル UI の「ゲームに入り込める」感は、**マウスカーソル自体をピクセル化**することで強化される。

| ID | 用途 | サイズ |
|---|---|---|
| `cursor_default` | 通常 | 16×16px |
| `cursor_hover` | ホバー可能上 | 16×16px |
| `cursor_click` | クリック中 | 16×16px |
| `cursor_text` | テキスト入力欄 | 16×16px |
| `cursor_disabled` | 押下不能 | 16×16px |

CSS `cursor: url('/sprites/ui/cursor_default.png') 0 0, auto;` で適用。

### 5-1. アクション
- [ ] **AS-Cursor-1**：5 種類のカーソルを PixelLab で発注（≒ 5 gen）

---

## 6. プログレスバー・ゲージ（P0）

すべて**両端キャップ + タイル中央**の構成。border-radius: 999px は禁止。

| ID | 用途 | 高さ |
|---|---|---|
| `gauge_combo` | コンボゲージ（develop screen） | 16px |
| `gauge_time` | 開発時間進捗 | 12px |
| `gauge_week` | 次の週まで（office screen） | 8px |
| `gauge_funds_bar` | 借金 / 残債バー | 12px |
| `gauge_sales` | 販売中作品の残プール | 8px |
| `gauge_xp` | （将来用）社員 XP | 12px |

各ゲージ：**両端キャップ 4×N + タイル可能 1×N + フィル色 1×N の 3 ピース**

### 6-1. アクション
- [ ] **AS-Gauge-1**：5 種類の枠を発注（≒ 5 gen × 2 色違い ≒ 10 gen）

---

## 7. キャラクター・人物スプライト（P0）

社員 / 候補者を「人型キャラ」で表現する。既存の OfficeView スプライト（8 方向静止、座り、タイピング、歓喜、沈）を流用 + 拡張。

### 7-1. 必要なキャラ状態

| ID | 用途 |
|---|---|
| `worker_idle` | アイドル（8 方向） |
| `worker_walking` | 歩く（8 方向 × 4 フレーム） |
| `worker_typing` | タイピング中（SE / NW × 6 フレーム） |
| `worker_thinking` | 考え中（？マーク + 揺れ × 3 フレーム） |
| `worker_cheering` | 歓喜（成功時 × 4 フレーム） |
| `worker_sad` | 沈（失敗時 × 4 フレーム） |
| `worker_sleeping` | 居眠り（深夜放置時 × 2 フレーム） |
| `worker_meeting` | 会議中（複数人並ぶ × 2 フレーム） |

### 7-2. プレイヤーキャラ（プロデューサー）

採用画面の「面接官」、リリース時の「監督」役。

- `producer_neutral` / `producer_happy` / `producer_worried` / `producer_excited`
- 顔のみ 48×48px（ダイアログ用）

### 7-3. キャラバリエーション

性別・髪型・服色のバリエーションで、採用候補の見た目を変える：
- 髪型 5 種 × 服色 4 色 × 性別 2 = 40 バリアント
- 自動生成（パレットスワップ）でも OK

### 7-4. アクション
- [ ] **AS-Char-1**：既存 `worker_*` を確認、不足分（thinking、sleeping、meeting）を PixelLab で発注（≒ 12 gen）
- [ ] **AS-Char-2**：プロデューサー顔 4 種（48×48）発注（≒ 4 gen）
- [ ] **AS-Char-3**：髪型・服色のパレットスワップ用ベース 1 体を発注、JS で動的差し替え

---

## 8. 背景・部屋・家具（P0）

### 8-1. オフィス背景（規模別）

| 規模 | サイズ | 内訳 |
|---|---|---|
| `office_bg_mini` | 256×192px | ワンルーム、机 1、椅子 1、PC 1、植物 |
| `office_bg_mobile` | 320×240px | 2 LDK、机 2、椅子 2、PC 2、ホワイトボード |
| `office_bg_indie` | 480×320px | オフィスフロア、机 4、椅子 4、ミーティング卓 |
| `office_bg_hit` | 640×480px | 専用フロア、机 8、椅子 8、応接間 |
| `office_bg_aaa` | 800×600px | ビル 1 階占有、机 16、椅子 16、メディアルーム |

既存 OfficeView は `mini` 相当を表示している。残り 4 規模を追加。

### 8-2. 家具スプライト（再ダウンロード or 自前）

既に PixelLab に登録済の object id（[`docs/v10/notes/balance-design.md` の進捗ノート参照]）：

- 机 NE / SE / NW / SW（4 方向）
- 椅子（8 方向）
- ノート PC SW / SE / MacBook 風（3 種類）
- 植物 1 種

これらを再 DL するだけで 0 gen。

### 8-3. 床タイル

既存 `public/sprites/office/tile_pro_0〜15.png` 16 種類から 1〜2 種類を採用。決定が必要。

### 8-4. アクション
- [ ] **AS-Office-1**：採用する床タイル番号を確定（ユーザー判断）
- [ ] **AS-Office-2**：家具スプライトを PixelLab object id から再 DL（0 gen）
- [ ] **AS-Office-3**：mobile / indie / hit / aaa 規模の追加家具を発注（≒ 各 5 gen × 4 規模 = 20 gen）

---

## 9. 演出・エフェクト・パーティクル（P1）

ゲーム感を出す「ジューシーフィードバック」素材。

### 9-1. 必須エフェクト

| ID | 用途 | フレーム数 |
|---|---|---|
| `fx_sparkle` | 神ゲー認定の煌き | 8 フレーム |
| `fx_confetti` | リリース成功・実績解除 | 12 フレーム |
| `fx_burst` | コンボ達成 | 6 フレーム |
| `fx_smoke` | 失敗時の煙 | 8 フレーム |
| `fx_zzz` | アイドル放置の眠気 | 4 フレーム |
| `fx_typing_keystroke` | 1 文字打鍵の星 | 3 フレーム |
| `fx_money_pop` | 売上発生のコイン | 6 フレーム |
| `fx_lightning` | WPM 200+ の雷 | 4 フレーム |
| `fx_speech_excl` | キャラ吹き出し「！」 | 2 フレーム |
| `fx_speech_dot` | キャラ吹き出し「…」 | 3 フレーム |

### 9-2. 画面遷移ワイプ

| ID | 用途 |
|---|---|
| `wipe_horizontal` | 横スクロール画面遷移 |
| `wipe_diamond` | リリース演出開始 |
| `wipe_fade_pixel` | 通常画面遷移（モザイクフェード） |

### 9-3. アクション
- [ ] **AS-FX-1**：必須エフェクト 10 種を PixelLab で発注（`animate_object` 利用、≒ 各 1 gen × 10 = 10 gen）
- [ ] **AS-FX-2**：画面遷移ワイプは CSS / SVG で実装可、発注不要

---

## 10. サウンドエフェクト（P0）

ピクセル UI は **SE で命が宿る**。最低限必須。

### 10-1. 必須 SE

| ID | 用途 | 形 |
|---|---|---|
| `se_button_click` | ボタン押下 | ピッ（80ms） |
| `se_button_hover` | ボタンホバー | ティ（40ms、控えめ） |
| `se_typing_correct` | タイピング正解 | カタ（30ms） |
| `se_typing_wrong` | タイピング誤り | ブ（80ms、低音） |
| `se_combo_30` | コンボ 30 達成 | ピロン |
| `se_combo_100` | コンボ 100 達成 | ピロロン |
| `se_combo_break` | コンボ切れ | ジュッ（低音） |
| `se_phrase_complete` | 1 フレーズ完走 | ピコッ |
| `se_money_in` | 売上発生 | チャリン（80ms） |
| `se_money_out` | 月固定費発生 | コトッ（暗め） |
| `se_release_fanfare` | リリース時の短いファンファーレ | 1.2s |
| `se_hit_tier` | ヒット作判定 | ピヤッ |
| `se_god_game` | 神ゲー判定（廃止済だが残置） | — |
| `se_achievement` | 実績解除 | ピーン |
| `se_modal_open` | モーダル開く | スッ |
| `se_modal_close` | モーダル閉じる | フッ |
| `se_screen_transition` | 画面遷移 | シュッ |
| `se_game_over` | ゲームオーバー | ドーン（低音 1s） |
| `se_bug_alert` | バグ発生 | ピピッ（警告） |
| `se_unlock` | ジャンル / テーマ解放 | プワッ |

合計 19 種類。

### 10-2. 入手元

- **無料素材**：効果音ラボ（https://soundeffect-lab.info/）、魔王魂、On-Jin
- ライセンス：商用可・クレジット記載で OK の素材を選定
- 形式：OGG（ファイルサイズ小）、44.1kHz mono / stereo

### 10-3. アクション
- [ ] **AS-SE-1**：効果音ラボから 19 種をピックアップ（手動）
- [ ] **AS-SE-2**：`public/sounds/` に配置、AdProvider 風の `SoundProvider` で再生制御
- [ ] **AS-SE-3**：設定モーダルに「音量」「ミュート」スライダ追加

---

## 11. BGM（P1）

雰囲気作りで重要。最低 4 曲。

| ID | 用途 | 長さ |
|---|---|---|
| `bgm_office` | オフィス画面（ループ） | 60〜90s |
| `bgm_develop` | 開発中（テンポ早めループ） | 60〜90s |
| `bgm_release` | リリース演出 | 20〜40s |
| `bgm_title` | タイトル画面（将来用） | 60s |

入手元：
- 魔王魂（https://maoudamashii.jokersounds.com/）：商用可・著作権表示で OK
- DOVA-SYNDROME：商用可

### 11-1. アクション
- [ ] **AS-BGM-1**：4 曲を魔王魂から選定・DL
- [ ] **AS-BGM-2**：`public/bgm/` に配置、`MusicProvider` で再生制御
- [ ] **AS-BGM-3**：画面遷移時にクロスフェード（500ms）

---

## 12. タイトル画面・ロゴ（P2）

v0.11 で起動時のオープニングは作らないが、**タイトルロゴ画像**は欲しい。

| ID | サイズ |
|---|---|
| `logo_main` | 320×80px（横長ロゴ） |
| `logo_small` | 160×40px（ステータスバー用） |

### 12-1. アクション
- [ ] **AS-Logo-1**：「タイピング工場」ロゴをピクセル風で発注（PixelLab で発注しにくいので Aseprite 手描き 推奨）

---

## 13. 集計表

| カテゴリ | 必要数 | 発注 / 入手 | 想定 PixelLab gen |
|---|---|---|---|
| フォント | 3 ファイル | GitHub DL | 0 |
| 9-slice 枠 | 6 種 | PixelLab | 18 |
| ボタン | 9 個（中サイズ） | PixelLab | 9 |
| アイコン | 23 種 | PixelLab | 23 |
| カーソル | 5 種 | PixelLab | 5 |
| ゲージ | 5 種 × 2 色 | PixelLab | 10 |
| キャラ | 12 動作 + 顔 4 | PixelLab + 既存 | 16 |
| 部屋 / 家具 | 既存再 DL + 追加 20 | PixelLab | 20 |
| エフェクト | 10 種 | PixelLab `animate_object` | 10 |
| SE | 19 種 | 効果音ラボ | 0 |
| BGM | 4 曲 | 魔王魂 | 0 |
| タイトルロゴ | 2 種 | 手描き | 0 |
| **合計** | — | — | **約 111 gen** |

PixelLab の月額プランで **約 500 gen / 月** が標準枠なので、1 ヶ月でカバー可。

---

## 14. 優先実装順

```
Phase A: フォント差し替え + ボタン / 枠の再描画
  AS-Font-1〜3, AS-Frame-1〜3, AS-Btn-1〜3
  → 1 画面でもいいので「ピクセル化された」感を出す

Phase B: ステータス・アイコン・ゲージで HUD 統一
  AS-Icon-1〜3, AS-Gauge-1
  → 上部バー・サイドパネルが全てピクセル化される

Phase C: SE 全 19 種実装・操作にフィードバック
  AS-SE-1〜3
  → 「触ると音が鳴る」体験で命が宿る

Phase D: キャラ・部屋・エフェクトでゲーム感
  AS-Char-1〜3, AS-Office-1〜3, AS-FX-1
  → オフィスが生きている感

Phase E: BGM・カーソル・ロゴで仕上げ
  AS-Cursor-1, AS-BGM-1〜3, AS-Logo-1
  → タイトル + 起動時の没入感
```

---

## 15. 関連ドキュメント

- [pixel-ui-research.md](./pixel-ui-research.md)：ピクセル UI 原則・アニメ語彙
- [ui-audit.md](./ui-audit.md)：現状の Web 的残骸 48 項目
- [docs/v11/spec.md](../spec.md)：v0.11 仕様書（後で UI 刷新版に書き直し）
- [.claude/skills/game-ui-design/SKILL.md](../../.claude/skills/game-ui-design/SKILL.md)：UI 実装規約
