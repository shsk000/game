# v0.25 仕様書: 装備システム — お金で買って社員に装備し、能力を上げる

> 起票日: 2026-07-20
> 親計画: [roadmap.md](../roadmap.md) §v0.25 を詳細化したもの。
> 関連タスク: [tasks.md](./tasks.md)

---

## 改訂履歴

- **2026-07-20 起票（この版で大きく変えたこと）**: roadmap の当初 v0.25 は「机上アイテム設置＝**純演出・経済数値に無影響**」だったが、
  オーナー指示で **「お金で買って社員に装備させ、装備に応じて能力を向上させる」設備／装備システム**へ再定義。
  純演出ではなく**リリース品質に実数値で効く**ため、**分布ガード・進行シミュの再校正が本版の中心作業**になる（§8）。
  → roadmap.md の v0.25 節も本スコープに合わせて注記を更新する（tasks 参照）。

---

## 0. この版の位置づけ

「稼いだ金の使い道」をもう1本増やす版。v0.21「投資」（ジャンル/テーマ購入・社員研修=恒久exp）に続く**金→強化**の路線だが、
装備は **付け外し可能な"設備"** で棲み分ける（研修＝社員に恒久的に染み込む exp／装備＝会社が買って割り当てる資産）。

**実装の実態**: `src/data/equipment.ts` に旧 v0.9 由来のスタブ（desk/chair/monitor・カテゴリ次元なし・**どこからも未 import**）が既にある。
これを「種別スロット × カテゴリ別ブースト」に**拡張**し、state/購入/割当/永続化/UI/机の見た目に接続する。

---

## 1. 事業目的と前提（北極星）

game-design スキル継承：広告収益／**広告は人質にしない**／誰も弾かない／**長く遊ぶ人が一番得する**。課金なし。サーバーレス静的構成維持。

- 装備は**お金の使い道（sink）**。広告を見ないと買えない、等の人質化はしない。
- 「長く遊ぶ人が得する」に沿い、装備は**上限付きの加速**（青天井にしない）。強くなりすぎて分布ガードを壊さない範囲で設計する（§8）。

---

## 2. コンセプト（3点で確定）

1. **種別スロット制**：社員ごとに **【PC】【チェア】【小物】** の3スロット。各スロットに1つ装備。
2. **カテゴリ別ブースト**：装備は作業カテゴリ **program / graphics / sound / design**（`TicketCategory` = `devPhrases.ts:14`）を強化する。
   職種×装備の**相性**が戦略になる（例：エンジニア席にゲーミングPC＝program が伸びる）。
3. **机の見た目に反映**：装備した物はその社員の机上に**見た目としても出る**（当初 roadmap の「机に設置」と統合）。強い装備ほど映える。

---

## 3. コアループ

```
資金を稼ぐ → 装備ショップで購入（会社の所有アイテムに追加）
        → 社員のスロットに装備（PC/チェア/小物）
        → その社員が開発で稼いだ devStats のカテゴリが装備倍率で底上げ
        → リリース品質が(上限付きで)上がる → 売上・成長 → さらに良い装備
        → 机の見た目もグレードアップ（愛着・成長の可視化）
```

---

## 4. システム設計

### 4-1. スロットとアイテムカタログ（叩き台 🔧）

社員の装備は `Employee.equipped?: { pc?: string; chair?: string; misc?: string }`（アイテムID参照。既存作法どおり Employee 型に optional 追加＝`state/types.ts:82`）。

| スロット | 効かせるカテゴリ | ティア例（安→高／価格・効果は 🔧） |
|---|---|---|
| **PC** | program 中心（上位は design も少し） | 中古ノート → 標準ノート(現行laptop) → デスクトップ → ゲーミングリグ |
| **チェア** | 全カテゴリ微増（comfort） | 事務椅子 → オフィスチェア → エルゴノミクス |
| **小物** | カテゴリ特化（1品1カテゴリ） | 技術書=design ／ 液タブ=graphics ／ モニタースピーカー=sound ／ 観葉植物=全微増 |

- 3スロットで program/graphics/sound/design を**カバーしうる**が、全部は同時に盛れない（小物は1枠）→ 選択の妙が出る。
- 各ティアは `cost`（¥）＋ `categoryMul`（後述）を持つ。初期装備（cost 0・効果1.0）を各スロットに1つ置き、未装備でも破綻しないようにする。

### 4-2. ブーストの効かせ方（★バランスの核心・§8と一体）

**カテゴリの寄与が合算される唯一の場所は `core/release.ts:136-140` の `statQualityBonus`**：

```
statQualityBonus = min(STAT_QUALITY_BONUS_CAP=8, program*0.12 + graphics*0.08 + sound*0.08 + design*0.05)
```

この経路には設計上の壁がある（調査で判明）:
- `STAT_QUALITY_BONUS_CAP=8` ＆ `AXIS_QUALITY_BONUS_CAP=8` で**二重に頭打ち**、かつ企画/イベントボーナスと**同じ8点枠を共有**。通常プレイで既に飽和しがち。
- → **既存係数に倍率を掛けるだけでは、装備を積んでも品質がほぼ動かない**（＝「能力向上」を実感できない）。
- 品質の支配項は charPower（`QUALITY_WEIGHTS.charPower=0.6`）だが**カテゴリ次元を持たず**、ここを上げるとガードが即壊れる。

**採用する設計**：装備専用の**独立ブースト枠**を新設する（既存8点枠を食わない）。

```
// core/equip.ts（新規・純関数）
computeEquipCategoryMul(equipped, EQUIPMENT_BY_ID) -> { program, graphics, sound, design }  // 例 program:1.15

// core/release.ts computeRelease 内（ReleaseCtx に equipment を optional 追加）
equipBonus = min(EQUIP_QUALITY_BONUS_CAP,          // 装備専用キャップ（叩き台 +6 🔧）
  program*0.12*(mul.program-1) + graphics*0.08*(mul.graphics-1) + sound*0.08*(mul.sound-1) + design*0.05*(mul.design-1))
quality = clamp(quality0 + axisQualityBonus + equipBonus)   // ← 既存 axisQualityBonus とは別項で加算
```

- 「`(mul-1)` × 既存係数 × devStat」＝**装備で"増えた分"だけ**を独立枠で加点。未装備なら 0（既存挙動を一切変えない）。
- 装備専用キャップ `EQUIP_QUALITY_BONUS_CAP`（叩き台 +6 🔧）で青天井を防ぐ。
- **devStats 経路なので「そのカテゴリを実際に開発で打った分」に比例**＝装備と行動が噛み合う（打たないカテゴリの装備は効かない＝相性の意味が出る）。
- `ReleaseCtx.equipment` は **optional**（既存の `release.test.ts` 等をコンパイル/セットアップから壊さないため）。

### 4-3. 購入・所有・割当（state / 永続化）

既存の v0.21 投資（`buyGenre`/`buyTheme` = `gameStore.ts:642-666`）とほぼ同型で乗せる（調査で確認）:

- **所有インベントリ**：`GameState.ownedItems: OwnedItem[]`（`unlockedGenres`/`library` と同列のトップレベル）。同一IDの重複購入可否は 🔧（叩き台：同一ティアは1個所有で複数席に付け替え＝**所有=ライセンス**方式か、席ごとに実体購入か。MVPは「所有=1個、1社員に割当」＝実体方式で単純化）。
- **割当**：`Employee.equipped?: {pc,chair,misc}`（アイテムID）。付け外しは無償（設備の移動）。
- **アクション**（`gameStore.ts`、`buyGenre` を手本）：
  - `buyEquipment(itemId): boolean` — funds ガード → `funds -= cost` → `ownedItems` に追加。
  - `equipItem(empId, slot, itemId|null): boolean` — 所有チェック → `Employee.equipped[slot]` 更新（null で外す）。
- **価格**：`core/equip.ts` の純関数（`core/invest.ts` の `investPrice` が手本）。ティア連動 or 規模連動（`GACHA_CONFIG.priceByScale` 方式）は 🔧。テーブルは `data/equipment.ts`。
- **永続化**（`src/utils/storage.ts`。※`src/state/storage.ts` ではない）：**加算的変更なので version 据え置き（現 v7）**。
  4点だけ：(a)`Persisted` に `ownedItems` 追加（`Employee.equipped` は Employee 型側）、(b)`defaults()` に初期値、
  (c)`boot.ts` の `persistedSnapshot`／`buildBootPatch` に配線、(d)`shapeLoaded` に nullish 防御（`equipped ?? {}`, `ownedItems ?? []`）。

### 4-4. 机の見た目（OfficeView 反映）

- 装備した PC/チェア/小物を、その社員の机上スプライトに反映（`OfficeView.tsx` の `SeatedEmployee`／`officeLayout.ts` の `PROP_TRANSFORMS`）。
- **既知の制約（実機確認済み）**：現行 laptop は north 席で `z:-1`（人より奥）に置かれ**社員の背中で完全に隠れて見えない**。
  → 上位装備（デスクトップのモニタ・デュアルモニタ・ゲーミングリグの発光）は**頭上・体の脇に張り出す形**でないと「見える・映える」にならない。ティア別に `PROP_TRANSFORMS` を調整する。
- 追加手順は laptop が完全な実装例（`<name>Sprite(dir)` パス関数＋`PROP_TRANSFORMS` キー追加＋`/admin/props`(PropEditorTool) に1行登録して実機調整＋`SeatedEmployee` に `BandedSprite` 1枚）。`bandedSprite.tsx` は無改変。

---

## 5. 経済設計

- 装備は**金 sink**。価格は「安い実用ティア → 高価な最上位」でティア連動（叩き台 🔧：PC 5万/20万/80万/300万、チェア 3万/30万/150万、小物 10〜60万）。
- v0.21 との棲み分け：**研修＝恒久exp（社員に染み込む）／装備＝会社資産（付け外し・売却は 🔧）**。両方あっても固定費（給与）とのトレードオフは崩れない。
- 効果は**上限付き**（§4-2 の `EQUIP_QUALITY_BONUS_CAP`）。北極星「長く遊ぶ人が得する」に沿い、装備は"近道"だが天井を破らない。

---

## 6. UX（1280×720 固定・スクロール禁止）

- **装備ショップ＆割当**は `OfficeScreen` に `modal='equipment'` を1つ追加（採用モーダル `OfficeScreen.tsx:588-729` と同型）。
- 中身は2部：
  1. **ショップ**（購入）：PlanScreen の `LockedShop`（折りたたみ＋価格行＋`disabled={!affordable}`）＋2段階確認 `pendingPurchase`（`PlanScreen.tsx:124-174, 663-704`）を踏襲。
  2. **割当**：在籍メンバー一覧（採用モーダルの行 UI `OfficeScreen.tsx:660-728` が手本）を拡張し、各社員行に【PC】【チェア】【小物】スロット表示＋選択。
- **社員を選んで操作する既存フローは無い**（v0.17 で全員自動参加化）→ 割当 UI はこの版で新設。選択状態は `useState`（既存 `modal`/`pendingPurchase` と同じ流儀）。
- 種別タブ or 折りたたみで**スクロールを出さない**（no-scroll 原則、`PlanScreen.tsx:117-120` 参照）。

---

## 7. 技術メモ（層分割・触るファイル）

logic-architecture 規約どおり層を分ける：
- `src/data/equipment.ts`（**既存スタブを拡張**）：`EquipmentDef` に `slot: 'pc'|'chair'|'misc'` と `categoryMul?: Partial<Record<TicketCategory, number>>` と `tier` を追加。カタログ＋価格テーブル。
- `src/core/equip.ts`（新規・純関数）：`computeEquipCategoryMul(equipped)`、`equipmentPrice(...)`、購入可否判定。
- `src/core/release.ts`：`ReleaseCtx` に `equipment?` を optional 追加し、§4-2 の `equipBonus` を加算。呼び出し元（`gameStore` のリリース処理）から装備マップを渡す。
- `src/data/balance.ts`：`EQUIP_QUALITY_BONUS_CAP` 追加。既存 `STAT_QUALITY_BONUS_CAP`/`AXIS_QUALITY_BONUS_CAP` は据え置き。
- `src/state/gameStore.ts`：`ownedItems` 状態＋`buyEquipment`/`equipItem` アクション（`buyGenre` が手本）。
- `src/state/types.ts`：`Employee.equipped?` 追加、`OwnedItem` 型。
- `src/utils/storage.ts` ＋ `src/state/boot.ts`：§4-3 の永続化4点（version 据え置き）。
- `src/features/office/OfficeScreen.tsx`：装備モーダル（ショップ＋割当）。
- `src/data/officeLayout.ts` ＋ `src/components/OfficeView.tsx` ＋ `PropEditorTool.tsx`：机の見た目（ティア別プロップ）。
- 乱数/時刻は使わない純関数（`core/`）。副作用は state/UI 層のみ。

---

## 8. バランス設計とガード再校正（★最重要判断ゲート）

装備は品質に**実数値で効く**ため、既存ガードの前提（装備なし）を更新する必要がある。

- **`balanceSimulation.test.ts`（分布・1000試行）**：現状ペルソナは `statBonus=8` 満額で over70/80/90/95 到達率を検証（序盤 over70=0 … 終盤 0<over95≤0.15）。
  装備専用枠 `equipBonus` を足すと、**「装備込みペルソナ」を追加**して分布を引き直す必要。合格レンジは「装備しても序盤が終盤帯に飛ばない」よう再設定 🔧。
- **`progressionSimulation.test.ts`（進行・60作×3seed）**：現状 devStats を通さない（`AXIS_BONUS=4` 直書き）ため、装備の効果を検証するには**装備込みの進行シナリオを追加**する。
  合格レンジ（mobile 8〜16作・aaa 25〜60作）は「装備投資で多少早まるのは許容、でも早すぎない」よう再校正 🔧。
- **設計方針**：`EQUIP_QUALITY_BONUS_CAP` と `categoryMul` の値は、**上記2テストが装備なし/装備ありの両シナリオで緑になる範囲で決める**（当て推量で数値を置かない）。
  ＝「効果が体感でき、かつ終盤ガード（メタ95は終盤・青天井なし）を壊さない」交点を探す。これが本版の主作業。

---

## 9. 素材（PixelLab・承認制）

- 机上に出す装備スプライト（north 向き先行。全席 north）。まずは**"見える"上位ティア**（デスクトップ／ゲーミングリグ／液タブ 等）を優先発注。
- 下位＝現行 `laptop`/`chair` 流用で発注ゼロ。
- **生成物は組み込み前にオーナー承認を取る**（feedback 準拠）。2D反転で別向きは作れないため south は必要時に新規発注。

---

## 10. スコープ外（本版では作らない）

- 装備の売却・トレード・強化合成（必要になれば次版 🔧）。
- 一時ブースト（コーヒー等の時間制バフ）＝恒常ブーストに一本化（時間制は演出過多になりやすい 🔧）。
- 装備によるバグ増減・速度への効果（本版は**品質カテゴリ倍率に一本化**。速度/バグ拡張は後段 🔧）。
- south 向き素材の作り込み（全席 north のため後回し）。

---

## 11. 検証チェックリスト（完成条件）

### コアシステム
- [ ] ショップで装備を購入すると funds が減り `ownedItems` に入る／資金不足で買えない
- [ ] 社員の【PC】【チェア】【小物】スロットに装備/解除でき、リロード後も保持される（永続化）
- [ ] `computeEquipCategoryMul` が装備からカテゴリ倍率を正しく返す（unit）
- [ ] 装備した社員のリリースで、打ったカテゴリの品質が**上限内で**上がる／未装備は挙動不変（unit: `computeRelease`）

### バランス（最重要ゲート）
- [ ] `balanceSimulation.test.ts` が装備なし/装備あり両シナリオで緑（分布ガード維持）
- [ ] `progressionSimulation.test.ts` が装備込み進行で緑（mobile 8〜16・aaa 25〜60・連続解放なし）
- [ ] 装備を全部積んでも「序盤に終盤メタ帯へ飛ばない」ことを数値で確認

### 見た目
- [ ] 装備した物が机上に見える（上位ティアは背中に隠れず頭上/脇に出る）／未装備席は既存どおり
- [ ] `/admin/props` で新プロップを調整でき、本番と同じ見え方

### 共通
- [ ] 4点セット（build / unit / ui / e2e）が緑
- [ ] Playwright MCP で購入→割当→机反映を実機操作で確認
- [ ] 1280×720 内でスクロールなし・表示崩れなし
- [ ] 素材の見た目 → オーナー承認済み

---

## 12. 未決事項まとめ 🔧

1. ~~**`EQUIP_QUALITY_BONUS_CAP` と `categoryMul` の値**~~ → **暫定確定（2026-07-20）：CAP=6**。分布シミュで検証：序盤 over70=0 不変（装備は高価で買えない）／終盤フル装備 over95≈0.48（≤0.5・青天井でない）。強すぎ/弱すぎと感じたらこの1値で調整。categoryMul の個別値は 🔧。
2. **価格体系**：ティア固定 vs 規模連動。金 sink としての重み。
3. ~~**所有モデル**~~ → **確定（2026-07-20 実装）：実体方式**（`ownedItems: Record<string,number>`＝1個=1社員ぶん。複数欲しければ複数購入し、空き個数＝購入済み−使用中を消費して装備）。オーナー指示「1個買えば全員使えるのは微妙」を反映（当初のライセンス案から変更）。価格も「安すぎ／0をもう1個」指摘を受け ×10（PC 500/3000万・ゲーミング1.5億／チェア 1000/6000万／小物 500〜3000万。なお 🔧、Phase F で確定）。
4. **スロット構成の最終確定**：PC/チェア/小物 の3枠でカテゴリ4種をどう割り振るか（sound をどの枠で拾うか）。
5. **アイテムカタログの品目・価格・categoryMul の具体値**（叩き台 §4-1）。
6. **机の見た目をどのティアまで作り込むか**（PixelLab 発注量）。
7. **v0.21 研修との棲み分けの体験差**（両方が金→強化で被って見えないか、プレイFBで確認）。
