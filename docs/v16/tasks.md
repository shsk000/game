# v0.16 実装タスク

> 仕様: [spec.md](./spec.md)　凡例: `[x]` 実装済 / `[~]` 部分実装 / `[ ]` 未着手
> 規約: 全ロジックは logic-architecture スキル準拠（core/ に純粋関数＋rng/clock 注入）。
> テストは testing-rules スキル準拠（ロジック変更は unit テスト必須）。

## 継承タスク（前版から）

- [~] テスト基盤導入（P0〜P5 実装済・コミット済。P6 Playwright 整理が作業途中、P7 ドキュメント仕上げ未）
  - [ ] P6: webServer 追加・旧 spec アーカイブ・ジャーニー spec の完走確認
  - [ ] P7: tasks/todo.md 完了更新・レビューセクション記入

## 追加タスク（このバージョン）

### 1. 社員成長システム（spec §1）
- [ ] `Employee` 型に level / exp を追加（state/types.ts）
- [ ] `core/growth.ts` 新設：`nextExpFor(lv)` / `gainExp(employee, meta)` / `powerAt(base, lv)` / `wageAt(...)`（純粋関数＋テスト）
- [ ] リリース時の exp 付与を `core/release.ts`（computeRelease patch）に合流＋テスト
- [ ] レベルアップ演出（ReleaseScreen 開封に「⬆ Lv up」表示）
- [ ] 候補生成の power レンジを正規化 0.2〜0.6 に圧縮（data/employees.ts）＋テスト更新

### 2. power 正規化と役割換算（spec §1-3）
- [ ] 役割共通の power スケール 0..1 に統一。使用側（LoC/s・品質+・売上%）の換算係数を balance.ts に集約
- [ ] 影響箇所の追従：sumProgrammerSpeed / sumDesignerBonus / sumPrBonus / 表示（PlanScreen・OfficeScreen 等）

### 3. キャラ能力スコア再設計（spec §2）
- [ ] `computeCharacterScore` 改訂（power 0..70 支配・下駄と人数ボーナス廃止）＋境界値テスト
- [ ] POWER_CAP を正規化 power 前提で再設定（balance.ts）
- [ ] statQualityBonus に上限 +8（core/release.ts）＋テスト

### 4. 相性テーブル是正（spec §3）
- [ ] DIVINE から puzzle|sushi を削除。初期 9 組を 0.85〜1.35 帯に調整（data/compatibility.ts）
- [ ] 神組合せ（1.8+）が stage3+ の交点にのみ存在することを検証する unit テスト

### 5. 分布シミュレーションテスト（spec §4）
- [ ] `src/core/balanceSimulation.test.ts`：プレイヤーモデル×1,000 試行で
      序盤 80 超 0%／95+ は終盤のみ、を assert（mulberry32 固定 seed）
- [ ] 叩き台数値をシミュレーションで追い込み、確定値を balance.ts と spec §6 に反映

### 6. セーブ移行（spec §5）
- [ ] Persisted v6（employees に level/exp、power 換算）。storage.ts にマイグレーション追加＋テスト

### 7. 検証（spec §8）
- [ ] 分布テスト緑 / 新規開始で初作メタ 60 未満（実機）/ 旧セーブ読込確認
- [ ] 検証4点セット＋オーナーへプレイ依頼
