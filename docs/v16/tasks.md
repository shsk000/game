# v0.16 実装タスク

> 仕様: [spec.md](./spec.md)　凡例: `[x]` 実装済 / `[~]` 部分実装 / `[ ]` 未着手
> 規約: 全ロジックは logic-architecture スキル準拠（core/ に純粋関数＋rng/clock 注入）。
> テストは testing-rules スキル準拠（ロジック変更は unit テスト必須）。

## 継承タスク（前版から）

- [x] テスト基盤導入（P0〜P7 完了。PR #3 で main マージ済み）

## 追加タスク（このバージョン）

### 1. 社員成長システム（spec §1）
- [x] `Employee` 型に basePower / level / exp を追加（state/types.ts）
- [x] `core/growth.ts` 新設：nextExpFor / powerAt / expForRelease / applyReleaseGrowth（純粋関数＋テスト9件）
- [x] リリース時の exp 付与を `core/release.ts`（computeRelease patch）に合流＋テスト
- [x] レベルアップ演出（ReleaseScreen 開封に「⬆ Lv up」バッジ）＋ UI テスト
- [x] 候補生成の power レンジを正規化 0.2〜0.6 に圧縮（data/employees.ts）＋テスト更新

### 2. power 正規化と役割換算（spec §1-3）
- [x] 役割共通の power スケール 0..1 に統一。換算係数 ROLE_EFFECT を balance.ts に集約
- [x] 影響箇所の追従：sumProgrammerSpeed / sumDesignerBonus / sumPrBonus / 月給式 /
      表示（PlanScreen: Lv+power、OfficeScreen: Lv表示+換算値、DevelopScreen: ゲージ）

### 3. キャラ能力スコア再設計（spec §2）
- [x] `computeCharacterScore` 改訂（power 0..70 支配・下駄と人数ボーナス廃止）＋境界値テスト7件
- [x] POWER_CAP を正規化 power 前提で再設定（mini 2.5〜aaa 3.6）
- [x] QUALITY_WEIGHTS 改訂（キャラ 0.60 / 相性 0.15 / タイピング 0.15 / 運 0.10）
- [x] statQualityBonus に上限 +8（core/release.ts）＋テスト

### 4. 相性テーブル是正（spec §3）
- [x] DIVINE から puzzle|sushi 削除・全体を +0.25〜0.35 に圧縮・実効上限 2.0→1.6・
      初期 9 組を 0.85〜1.25 帯に調整（adventure|sushi に学習用地雷 0.85）
- [x] 神（1.5+）が stage3+ の交点にのみ存在することを検証する unit テスト5件

### 5. 分布シミュレーションテスト（spec §4）
- [x] `src/core/balanceSimulation.test.ts`：序盤/中盤/終盤モデル×1,000 試行（seed固定）
      結果：序盤 70+ **0%** / 中盤 80+ **0%** / 終盤 90+ 到達・95+ は稀（≤15%）— spec §2-3 の帯どおり

### 6. セーブ移行（spec §5）
- [x] Persisted v6（employees の power 正規化＋成長フィールド付与）。v5→v6 移行＋テスト
      （進行データ保持・旧キー削除・v4 以前からのパスも v6 に合流）

### 7. 検証（spec §8）
- [x] 分布テスト緑 / build / vitest 193件 / e2e 7本
- [x] 実機（ブラウザ）：新規開始→初作（1人・WPM180・精度100%）でメタ 19（旧 95）、
      puzzle|sushi 1.2、exp 付与を確認
- [ ] オーナーへプレイ依頼
