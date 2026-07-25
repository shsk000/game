# v0.25 タスク: 装備システム

> 凡例：`[x]` 実装済 / `[~]` 部分実装 / `[ ]` 未着手
> 章立ては [spec.md](./spec.md) の節に対応。**フェーズ順（A→E）に実装**する。

---

## フェーズA. データ & 純ロジック（土台・テストで固める）✅

- [x] `data/equipment.ts` を拡張：`EquipmentDef` に `slot: 'pc'|'chair'|'misc'`・`tier: number`・`categoryMul?: Partial<Record<TicketCategory,number>>` を追加（既存 desk/chair/monitor スタブを再編）
- [x] アイテムカタログ（叩き台）を定義：各スロットのティア配列＋初期装備（cost 0・効果1.0）（spec §4-1）
- [x] `core/equip.ts`（新規・純関数）：`computeEquipCategoryMul(loadouts, byId)` → `{program,graphics,sound,design}` 倍率（集約=増分の平均）
- [x] `core/equip.ts`：`equipmentPrice(...)`／`canBuyEquipment` 購入可否判定（`core/invest.ts` を手本）
- [x] `data/balance.ts`：`EQUIP_QUALITY_BONUS_CAP`（叩き台 +6）追加（既存キャップは据え置き）
- [x] `core/equip.test.ts`：倍率計算・価格・境界（未装備=倍率1.0）の unit テスト（12件緑）

## フェーズB. リリース計算への接続（効果を出す）✅

- [x] `Employee.equipped?`（`types.ts`）を追加し、`computeRelease` は参加社員の `equipped` を読む（`ReleaseCtx` は既存の employees をそのまま利用＝新フィールド不要）
- [x] `core/release.ts`：`equipQualityBonus = min(EQUIP_QUALITY_BONUS_CAP, Σ 係数*(mul-1)*devStat)` を `quality` に独立加算（spec §4-2）
- [x] `EquipLoadout` 型を data 層（`data/equipment.ts`）へ配置し層依存を整理
- [x] `core/release.test.ts`：未装備/初期装備で不変・装備で上限内加点・打たないカテゴリは無効、を assert（既存テスト非破壊＝unit 299件緑）

## フェーズC. 状態・購入・割当・永続化 ✅

- [x] `state/types.ts`：`Employee.equipped?: EquipLoadout` を追加（所有は `ownedItems: string[]`＝ライセンス方式にしたため専用 OwnedItem 型は不要）
- [x] `gameStore.ts`：`ownedItems` 状態＋初期値（`storage.defaults()` 経由）＋ reset 対応
- [x] `gameStore.ts`：`buyEquipment(itemId)` アクション（`canBuyEquipment` ガード→減算→所有追加。`buyGenre` が手本）
- [x] `gameStore.ts`：`equipItem(empId, slot, itemId|null)` アクション（所有チェック→割当/解除。初期装備ID=解除）
- [x] `equipStore.test.ts`：購入で funds 減・資金不足/二重/初期装備/不明IDで false／装備・スロット不一致・解除の状態遷移（10件）
- [x] 永続化（version 7 据え置き）：`storage.ts` の `Persisted`＋`defaults()`＋`shapeLoaded`（`ownedItems ?? []`）。`equipped` は `normalizeEmployeeV6` が保持
- [x] 永続化：`boot.ts` の `persistedSnapshot`／`buildBootPatch` に `ownedItems` 配線
- [x] 旧セーブ非破壊（`storage.test.ts` 緑・`{...defaults(),...parsed}`＋nullish 防御）

> ✅ **設計確定（2026-07-20 オーナーFB反映）**: 所有モデルは **実体方式（`ownedItems: Record<string,number>`＝1個=1社員ぶん・複数購入・空き個数を消費）**。当初のライセンス案は「1個で全員使えるのは微妙」で不採用。価格も「安すぎ」を受け値上げ（PC 50/300/1500万等・🔧）。UI は所有数/空き数表示＋空きが無い物は割当候補から除外。実機verify済み（購入→装備→空き0で2人目不可→追加購入で可→リロード永続）。

## フェーズD. UI（購入＋割当・1280×720/no-scroll）✅

- [x] `OfficeScreen.tsx`：`ModalKind` に `'equipment'` 追加＋メニューバーに「装備」ボタン（🛠）
- [x] `EquipmentModal.tsx`（新規）：左=ショップ（PC/チェア/小物別・効果表示・価格・購入ボタン・資金不足 disabled・所有済タグ）
- [x] `EquipmentModal.tsx`：右=割当（在籍社員×【PC】【チェア】【小物】の select。所有＋初期装備から選択→`equipItem`）
- [x] カテゴリ効果を「プログラム+20%」等で表示。2カラム・スクロールなしで 1280×720 内に収まる
- [x] **ブラウザ実機で通し確認**：装備ボタン→ショップで購入（funds減）→社員に割当（equipped更新）→リロードで永続化、を Playwright で確認済み
- [~] 自動 UI テスト（`test:ui`）は後続（実機verify＋store unit で当面カバー）

## フェーズE. 机の見た目（PixelLab・承認制）

- [ ] 発注する上位ティア素材を確定（"見える"もの優先：デスクトップ/ゲーミングリグ/液タブ 等）
- [ ] PixelLab で north スプライト発注 → **オーナー承認** → `public/sprites/office/` に配置
- [ ] `officeLayout.ts`：`<name>Sprite(dir)`＋`PROP_TRANSFORMS` にティア別キー追加
- [ ] `PropEditorTool.tsx:48` の `PROPS` に登録 → `/admin/props` で位置調整 → 値を `PROP_TRANSFORMS` に転記
- [ ] `OfficeView.tsx` `SeatedEmployee`：装備IDからスプライト選択して `BandedSprite` 描画（上位は頭上/脇に出す）
- [ ] `officeLayout.test.ts`：スプライトパス assert（既存の型に合わせ）

## フェーズF. バランス再校正（★ゲート）＆仕上げ ✅（暫定確定）

- [x] `balanceSimulation.test.ts`：装備の独立枠をペルソナに追加し分布ガードを整備
  - 序盤 `over70=0` 不変（装備は数千万〜1.5億で mini 資金では買えない＝非装備モデル）
  - 終盤フル装備 `over95≈0.48`（≤0.5 でガード）＝青天井でない。95の壁（序盤/中盤=0%）も維持
- [~] `progressionSimulation.test.ts`：**据え置き**（装備は高価な「金で買う加速」で早期に買えず、ベースライン進行=非装備が妥当。Sラッシュと同じ扱い＝spec §8）
- [x] `EQUIP_QUALITY_BONUS_CAP=6`（暫定確定）。強すぎ/弱すぎはこの1値で調整（categoryMul も 🔧）
- [x] build / unit（315件）/ biome 緑（e2e は未変更）
- [x] Playwright MCP：購入→割当→パラメータ/装備効果表示→リロード永続 を実機確認（リリース品質上昇は unit `release.test.ts` で担保）
- [ ] roadmap.md v0.25 節の注記を「純演出→設備システム」に更新（別worktree/mainで）
- [ ] オーナー最終確認（体験・見た目）

## フェーズE. 机の見た目（PixelLab・承認制）— ⏳ 残（アート承認ゲート）

- [ ] **未着手**：装備の机上描画は新規ドット絵素材が必要で、素材はオーナー承認制（feedback）。
  - 発注案：デスクトップ／ゲーミングリグ／液タブ の north スプライト（"見える"上位優先。下位=標準ノートは現行 laptop 流用）
  - 実装は laptop が手本（`officeLayout.ts` パス関数＋`PROP_TRANSFORMS`／`PropEditorTool` 登録／`OfficeView` 描画差し替え）。上位は頭上/脇に出す配置。
  - システム側（A〜D・F）は完成済みなので、素材が承認されれば見た目は後乗せで足せる設計。

---

## 継承タスク（前版から）

- なし（v0.25 新規）。

## 補足

- **バランス（フェーズF）が本版の主作業**。装備の効果の強さは数値決め打ちでなくガードテストで挟んで決める（spec §8）。
- 素材（フェーズE）は承認待ちが挟まるので、A〜D（効果のロジック＋UI）を先に完成させ、見た目は後乗せできる設計にする。
