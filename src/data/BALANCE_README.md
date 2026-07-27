# balance.ts 調整ガイド

このディレクトリの `balance.ts` は v0.10 ゲームバランスの全数値を集約した「**バランス調整の唯一の入口**」。
数値を変えるときは **このファイルだけ** を触れば全画面に反映される。

設計の根拠と議論履歴は v0.10（資料は削除済み） を参照。

---

## 「ここを触ると何が起きるか」早見表

| 触る場所 | 効果 | 副作用 |
|---|---|---|
| `TIME_RATE_MS_PER_WEEK.typingActive` を下げる | タイピング中の時間が早く流れる | 1 本作るのが早く感じる、固定費も早く来る |
| `TIME_RATE_MS_PER_WEEK.idle` を下げる | アイドル中も時間が早く流れる | アイドル中の固定費プレッシャーが強まる |
| `INITIAL_FUNDS` を下げる | 開始時の資金が減る、序盤詰みやすい | 序盤で失敗を許されない |
| `GOD_GAME_GACHA.baseProbability` を上げる | 神ゲーが出やすい | 「神ゲー」の希少性が薄れる |
| `GOD_GAME_GACHA.pityIncrementPerRelease` を上げる | ピティで救済が早くなる | 「諦めずに作ろう」が薄れる |
| `SCORE_BASE` を下げる | スコアの底上げが減る、初心者で致命的失敗増 | 「うまく作らないと収支が成立しない」緊張感 |
| `SALES_MULTIPLIER_BY_SCORE.hit` 以上を上げる | ヒット作の売上がさらに大きくなる | 神ゲーガチャの相対重要度が下がる |
| `SCALE_BALANCE[scale].devCost` を上げる | 開発費が増える、序盤の投資が重い | 失敗時の赤字が大きく、リスクが上がる |
| `SCALE_BALANCE[scale].unlockSalesRequired` を上げる | 規模解放までの時間が長くなる | 1 セッションで規模解放できなくなるかも |
| `MONTHLY_RENT` を上げる | 毎月の賃料負担が増える | アイドル中のプレッシャーが強くなる |
| `MONTHLY_WAGE_FORMULA.perPowerUnit` を上げる | 強い人材ほど高給になる | 強い人材の採用判断が重くなる |
| `DEBT_CONFIG.monthlyInterestRate` を上げる | 借金が膨らみやすい | 詰みやすい、緊張感大 |

---

## 推奨される調整手順

### 「初心者が詰みやすい」と感じたら
1. `INITIAL_FUNDS` を上げる（¥500 万 → ¥800 万 等）
2. `SCORE_BASE` を 30 → 35 に上げる（致命的失敗の率が下がる）
3. `MONTHLY_RENT` を ¥30 万 → ¥20 万 に下げる

### 「30 分で飽きる」と感じたら
1. `SALES_MULTIPLIER_BY_SCORE.normal` 以下を上げる（普通作でも稼ぎやすく）
2. `SCALE_BALANCE.mobile.unlockSalesRequired` を下げる（規模解放を早める）
3. `GOD_GAME_GACHA.baseProbability` を上げる（神ゲー体験を増やす）

### 「神ゲー乱発」と感じたら
1. `GOD_GAME_GACHA.baseProbability` を下げる（2% → 1%）
2. `GOD_GAME_GACHA.qualityMultiplier` を下げる（1.5 → 1.3）

### 「採用が機械的」と感じたら
1. `HIRE_POWER_DISTRIBUTION.SR.rate` / `SSR.rate` を上げる（強い人が出やすく）
2. `MONTHLY_WAGE_FORMULA.perPowerUnit` を上げる（強い人の給与負担を重く、判断軸として効く）

---

## バランス調整後の検証チェックリスト

balance-design.md §8 と同期：

- [ ] 30 分プレイで離脱なし
- [ ] リリース 8〜12 本
- [ ] 致命的失敗 ≒ 20%、失敗 ≒ 35%（誤差 ±5%）
- [ ] 神ゲー 0〜1 回
- [ ] 30 分以内に mobile 解放可能
- [ ] 「ヒット作が来た時に明らかに嬉しい」体感

不合格項目があれば、上記の早見表で該当する定数を調整。
**1 回の調整で複数定数を変えない**（原因切り分け不可になる）。

---

## 既存ファイルとの関係

| 既存ファイル | balance.ts に移行した内容 |
|---|---|
| `src/data/scales.ts` | `SCALE_BALANCE`（devCost、baseRevenue、unlockSalesRequired、unlockCost、neededWeeks）、`MONTHLY_RENT` |
| `src/data/employees.ts` | `MONTHLY_WAGE_FORMULA`、`computeMonthlyWage()` |
| `src/core/metascore.ts` | メタスコアの式（重み・相性補正・トレンド・評価家のブレ） |
| `src/data/archetypes.ts` | ジャンルの型と ◎○△ の重み |
| `src/core/features.ts` | 特徴ポイントの蓄積（規模係数・打鍵倍率・スキル合計） |
| `src/utils/sales.ts` | `SALES_MULTIPLIER_BY_SCORE`、`salesMultiplierForScore()` |
| `src/state/storage.ts` | `INITIAL_FUNDS` |
| `src/state/gameStore.ts` | `DEBT_CONFIG`、`computeBorrowingLimit()` |

既存ファイルは balance.ts を import して使う。**直接ハードコードしない**こと。
