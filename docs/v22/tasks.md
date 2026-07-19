# v0.22 実装タスク: 採用ガチャ

> 凡例：`[x]` 実装済 / `[~]` 部分実装 / `[ ]` 未着手
> 仕様: [spec.md](./spec.md)
> **状態: 実装・検証完了（2026-07-19）。残るはオーナー実プレイ確認のみ**

---

## 継承タスク（前版から）

- [x] REFRESH_COST（候補リフレッシュ¥50）の扱い確定 — 本版で「廃止・ガチャ料に統合」として消化
- [ ] 備品（equipment.ts 死コード）の活用判断 — v21 A/B実装後のプレイFB待ち。本版でも保留（スコープ外）

## 追加タスク（このバージョン）

### 1. データ層・純粋ロジック

- [x] `balance.ts` に `GACHA_CONFIG` 追加（排出率70/25/5・basePower帯・specialty帯・
      規模別価格テーブル¥5万〜¥15億・ピティ閾値20。全て🔧コメント付き叩き台）
- [x] `core/gacha.ts` 新設：`rollRank(rng, pityCount)`（ピティ発火込み）＋`gachaPrice`／`nextPityCount`
- [x] `employees.ts` リファクタ：`rollPower`/`rollSpecialties` をランク別レンジ受け取りに一般化し、
      `newCandidate(deps, rank)` にランク引数を追加（`rollPowerForRank` を公開・重複ロジックなし）
- [x] `REFRESH_COST` 定義と全参照の削除

### 2. store 配線

- [x] `gameStore` に `pullGacha` アクション（資金チェック→ガチャ料減算→ピティ更新→候補生成）
- [x] `dismissCandidate`（候補破棄・返金なし）／既存 `hireCandidate` は candidate クリアに変更
- [x] `gachaPity` state 追加とセーブ・ロード（storage/boot 配線。旧セーブはデフォルト0で補完）
- [x] 開封済み候補もセーブに永続化（有料で引いた結果をリロードで失わせない）

### 3. UI（OfficeScreen 採用モーダル改修）

- [x] 旧「別の候補 ¥50」UI撤去、「ガチャを引く ¥{規模別価格}」ボタン設置（資金不足時は無効化）
- [x] カード開封演出 `GachaReveal`（裏面→ランク色フレーム→めくり→結果表示。B=銅/A=銀/S=虹）
- [x] S排出時の追加演出（全面フラッシュ。CSS steps 離散でピクセル規約準拠）
- [x] 演出スキップ（裏面 button クリックで即結果）
- [x] 開封後の「雇用する ¥{wage}」「見送る」2択（満席時は雇用無効化・現行踏襲）
- [x] 在籍メンバー一覧にランクバッジ表示
- [x] 1280×720 固定内・スクロールなしを維持

### 4. テスト（testing-rules 規約）

- [x] unit: 排出率の合計=100%・大量試行での実測率が設定±誤差内（`gacha.test.ts`）
- [x] unit: ランク別 basePower / specialty が仕様帯に収まる（帯域境界値。`employees.test.ts`）
- [x] unit: ピティ（20連で次回S確定・S排出でリセット）（`gacha.test.ts`＋`gameStore.test.ts`）
- [x] unit: 資金不足で引けない／見送りで返金されない（`gameStore.test.ts`）
- [x] **分布ガード**: `balanceSimulation.test.ts` の序盤 persona は非課金平均(power0.4)を
      モデル化し「序盤70+＝0%」維持（S課金ラッシュ加速はオーナー決定で許容＝ガード対象外。spec §8）
- [x] **進行ガード**: `progressionSimulation.test.ts` も非課金平均をモデル化し緑を維持（spec §8）
- [x] セーブ移行: 旧v7セーブ（ガチャフィールド無し）でピティ0・候補null補完（`storage.test.ts`）

### 5. 検証（verify フロー）

- [x] 4点セット（build/unit 266・ui 14・e2e 7）全緑
- [x] Playwright MCP 実機操作（ガチャ→開封→雇用/見送り→資金反映・ピティ強制S・保存復元・スキップ）
- [x] spec §9 チェックリストの消し込み
- [ ] **オーナー実プレイ確認（「引きの快感」成立・価格感）** ← 残タスク（機械検証不可）

## 追加タスク（v0.22.1：ガチャ2種分割・2026-07-19 オーナー指示）

- [x] `GACHA_CONFIG` を normal(S無)/premium(S有・高額・天井10) の2層に再構成（powerRange/specialty 共通）
- [x] `core/gacha.ts` を kind 対応：`rollRank(kind,rng,pity)`／`gachaPrice(kind,scales)`／`pityThreshold(kind)`
- [x] `pullGacha(kind)`：premium のみ pity 更新。normal は S を出さず pity 不変
- [x] 採用モーダルに2種ボタン（ノーマル/プレミアム）。premium は資金不足で無効化＝序盤ロック
- [x] premium mini 価格を初期資金超（¥600万）にして「序盤 1 発も引けない」を確定
- [x] テスト：normal never S・premium can S・premium>normal 価格・premium mini>初期資金・pity は premium のみ
- [x] 実機：¥5M で normal 有効/premium 無効、normal×100 で S=0、premium×100 で S/A/B 出現を確認

## 重要メモ（実装中の発見）

- **S課金ラッシュで序盤加速が可能だった**：当初の単一ガチャでは、ピティ（20連S確定・mini¥5万）で
  初期資金 S 3体を揃え mini でメタ70+ を出せた。オーナー決定＝許容（v21「時間を金で買う」思想）。
- **v0.22.1 でガチャ2種に分割し大幅緩和**：S をプレミアム（mini¥600万＝初期資金超）限定にしたため、
  序盤に S を揃えるのが経済的にほぼ不可能に。早期分布ガードが当初計画より自然に守られる。詳細 spec §8。
