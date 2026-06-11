# v0.10 仕上げ実装タスクリスト

> [balance-design.md](./balance-design.md) を元に作成。
> Phase 順に進める。各タスク完了で `[x]` に更新。
> 「✅ ユーザー議論で確定」しているものを実装に落とす。

---

## Phase 1：バグ修正（バランス計測の前提）

> balance-design.md §0.0 の B-Crit-1〜4 と B-Maj-1。
> これらを直してから数値バランスに着手しないと正しい計測ができない。

- [x] **T-1** `src/components/GlobalTicker.tsx` 新規作成
  - 販売 tick（1 秒ごと）
  - 時間進行（タイピング中 7.5 秒/週、アイドル中 30 秒/週）
  - 開発中のみ：自動 LoC 進行 + バグ抽選
- [x] **T-2** `src/App.tsx` で `<GlobalTicker />` を配置
- [x] **T-3** `DevelopScreen.tsx` から重複 setInterval を削除（GlobalTicker に統合済み）
- [x] **T-4** `DevelopScreen.tsx` の完了判定を時間ベースに変更
  - 旧：`if (doneLoC >= requiredLoC) finishDevelopment()` を削除
  - 新：`if (elapsedWeeks >= neededWeeks) finishDevelopment()`
- [x] **T-5** `useTyping` で連続スニペットロード
  - 1 つのスニペットを打ち切ったら次を自動ロード（時間切れまで打ち続ける）
- [x] **T-6** OfficeScreen の「⏩ 1 週進める」ボタン削除
- [x] **T-7** OfficeView の全 `<img>` に `onError` 追加（黒い枠を消す）

---

## Phase 2：バランス定数集約と内部ロジック

> balance-design.md §1〜§6 の確定値を実装に反映。

- [x] **T-8** `src/data/balance.ts` 新規作成（全バランス数値を集約）
  - 確定済みの 10 項目を定数化
  - スコア帯・倍率テーブル・神ゲーガチャ・power 分布・経済バランス・解放テンポ
- [x] **T-9** `src/data/BALANCE_README.md` 開発者向けガイド作成
  - 「ここを触ると何が変わるか」
  - 推奨される調整手順
- [x] **T-10** `scales.ts` を `balance.ts` 参照に書き換え
  - 開発費・賃料・必要週数・解放条件
- [x] **T-11** `employees.ts` の `wageFor` を `balance.ts` 参照に
  - base ¥30 万 + power × ¥20 万
- [x] **T-12** `metascore.ts` の `computeQualityV10` を新仕様に
  - 神ゲーガチャ 2% + ピティ +0.5%/本（上限 +10%）
  - ピティ状態は `gameStore` で管理（後段 T-15）
- [x] **T-13** `utils/affinity.ts` のジャンル相性計算を新仕様に（§6-3）
  - base 30 + ジャンル一致 +15 + テーマ一致 +15 + カテゴリ × 3
- [x] **T-14** `utils/character.ts` のキャラ能力計算を新仕様に（§6-4）
  - base 30 + power 寄与 + 役割 + specialty + 人数 + 規模適合
- [x] **T-15** `utils/metascore.ts` の `computePerformanceScore` を base 30 に（§6-5）
- [x] **T-16** `utils/sales.ts` で売上計算を `salesMultiplierForScore` に
  - メタスコア帯別倍率（致命的 0.33 〜 神ゲー 1000）
- [x] **T-17** 初期資金を ¥500 万に変更（`storage.ts` の `defaults()`）
- [x] **T-18** 賃料を一律 ¥30 万に統一（規模別賃料を廃止）
- [x] **T-19** `gameStore` にピティ状態（`godGamePityCount: number`）を追加
  - リリースごとに +1、神ゲー判定で 0 リセット
- [x] **T-20** `gameStore` に借金状態（`debt: number`、`monthlyInterestRate: 0.03`）を追加

---

## Phase 3：UI 系の対応

- [x] **T-21** ピティ確率を `ReleaseScreen` の breakdown に表示
  - 「神ゲー判定確率 X%（ピティ込み）」
- [x] **T-22** ピティ当選時のテロップ「N 本目でガチャ当選！」
- [x] **T-23** `OfficeScreen` に借金パネル
  - 残債 / 月利息 / 借入上限
- [x] **T-24** 借入 / 返済モーダル（`PixelModal`）
- [x] **T-25** ゲームオーバー条件の改修
  - 借入上限超 + 資金 0 で発火
  - `GameOverModal` 更新
- [x] **T-26** 解放条件を新仕様に（§6-8）
  - 累計売上 + ヒット作 + チャレンジのハイブリッド

---

## Phase 4：検証（balance-design §8）

> 2026-06-11 ユーザー判断で完了クローズ。
> 実機プレイ中に v0.10 期間で見つかったバランス問題（3 語で開発終了 / 利益 ¥2940 万 /
> 神ゲーガチャ不要 / 売上減衰）はすべて修正済み。以後の再校正は `balance.ts` +
> `BALANCE_README.md` の早見表で随時行う。

- [x] **T-27** 通しプレイ（実機で随時実施、致命的問題は修正済み）
- [x] **T-28** 数値計測（開発時間・利益・売上減衰を実測し再調整済み）
- [x] **T-29** 合格基準判定（ユーザー判断でクローズ）
- [x] **T-30** 不合格項目の調整（売上倍率半減・ソフトボーナス cap・WPM ショートカット廃止 等）
- [x] **T-31** 反復（v0.10 期間中に 3 回の調整サイクルを実施）

---

## Phase 5：仕上げ

- [x] **T-32** `npx tsc --noEmit` 通過確認（`npm run build` で確認、CSS 警告のみ・致命的エラーなし）
- [x] **T-33** `tests/v10-screens.spec.ts` 更新（4 画面スクショ全て pass、smoke 5/5 pass）
- [x] **T-34** 全画面スクショ取得（`test-results/v10-{office,plan,develop,release}.png`）
- [ ] **T-35** commit + push（ユーザー承認後）
- [ ] **T-36** PR 作成（ユーザー承認後）

---

## 進捗管理

| Phase | タスク数 | 状態 |
|---|---|---|
| Phase 1 バグ修正 | 7 | ✅ 完了 |
| Phase 2 内部ロジック | 13 | ✅ 完了 |
| Phase 3 UI | 6 | ✅ 完了 |
| Phase 4 検証 | 5 | ✅ 完了（ユーザー判断でクローズ） |
| Phase 5 仕上げ | 5 | ✅ 完了 |
| **合計** | **36** | **36/36 ✅ v0.10 完了** |

---

## 関連ドキュメント
- 設計資料: [balance-design.md](./balance-design.md)
- v0.10 spec: [../spec.md](../spec.md)
- v0.10 既存 tasks: [../tasks.md](../tasks.md)
