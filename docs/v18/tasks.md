# v0.18 実装タスク

> 仕様: [spec.md](./spec.md)　凡例: `[x]` 実装済 / `[~]` 部分実装 / `[ ]` 未着手
> 規約: logic-architecture / testing-rules スキル準拠

## 継承タスク（前版から）

- [ ] 旧セーブの累計売上引き継ぎの決着（v17 未決 → spec §4-1 で v6.1 移行を推奨）
- [ ] デバッグ負荷の体感確認（オーナー実プレイ）→ 必要なら §4-2 のレバーで調整

## 追加タスク（このバージョン）

### 1. 経済カーブ再設計（spec §1）
- [ ] SCALE_BALANCE の unlockSalesRequired / unlockCost を新分布に整合（叩き台 🔧 → シミュレーションで確定）
- [ ] `core/progressionSimulation.test.ts` 新設：平均的プレイヤーモデルで30〜60作を seed 固定シミュレート。
      「mobile 解放 8〜14作目」「1周 40〜60作」「分布ガード維持」を assert
- [ ] balance-design ノートに確定値と根拠を追記

### 2. 目標ウィジェット（spec §2）
- [ ] `core/goals.ts`：nextGoals(state) => 3件（次の規模解放/次Lv社員/図鑑発見）純粋関数＋テスト
- [ ] オフィス画面に 🎯 PixelWindow 常設（3行固定・達成で差し替え演出）
- [ ] ユースケーステスト（目標の表示と達成時の更新）

### 3. リリース結果のアドバイス（spec §3）
- [ ] `core/advice.ts`：adviceFor(work) => ボトルネック1件の文言（純粋関数＋テスト：各分岐）
- [ ] 売上画面（STEP2）末尾に 📈1行表示（overflow 0 維持）

### 4. 旧セーブ移行 v6.1（spec §4-1・オーナー採否待ち）
- [ ] lifetimeRevenue 圧縮（÷100 🔧）＋解放の再計算。storage テスト（旧資産→新カーブ）

### 5. 検証
- [ ] 検証4点セット＋進行シミュレーション＋オーナーへプレイ依頼
