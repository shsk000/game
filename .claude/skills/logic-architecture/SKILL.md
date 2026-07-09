---
name: logic-architecture
description: タイピング工場プロジェクトのコード構造の確定規約（ルール計算とUI/副作用の分離）。ゲームロジック（品質・売上・経済・解放・実績・タイピング判定・フェーズ遷移）を追加/変更する時、gameStore のアクションを触る時、乱数（Math.random）・時刻（Date.now/performance.now）・タイマーを使うコードを書く時、src/core/ src/state/ を触る時は必ずこのスキルを最初に参照すること。設計判断の理由と全体像は docs/architecture.md。テストの書き方は testing-rules スキル。
---

# ロジックアーキテクチャ規約（確定）

**原則は1つ：ルール計算は「入力→出力だけの普通の関数（純粋関数）」として書き、store・画面・タイマー・保存はそれを呼んで結果を反映するだけにする。**
理由と設計判断の全体は `docs/architecture.md` を参照。

## ⭐ クイックリファレンス（絶対規則）

| # | 規則 | 詳細 |
|---|---|---|
| 1 | 複数の状態をまたぐルール計算は `src/core/` に純粋関数で書く | §1 |
| 2 | **`Math.random()` / `Date.now()` / `performance.now()` をロジック内で直接呼ばない**。末尾デフォルト引数で注入 | §2 |
| 3 | **import 時副作用は全面禁止**。副作用の起動は `state/boot.ts` の `bootGameStore()` だけ | §3 |
| 4 | gameStore のアクションは薄い配線。新しいビジネスロジックをアクション本体に書き足さない | §4 |
| 5 | UI コンポーネントの派生計算が3行を超えたら純粋関数に切り出す | §5 |
| 6 | ゲームバランスの数値は `data/balance.ts` に集約（他ファイルに散らさない） | — |

## §1 コードの置き場所

| 書こうとしているもの | 置き場所 |
|---|---|
| 複数の状態（資金・ファン・ライブラリ…）をまたぐ遷移・パイプライン | `src/core/`（release / economy / progression） |
| 入力→出力が閉じた単機能の計算 | `src/utils/` か feature 併設の `.ts`（前例：`devImpact.ts`、`typingEngine.ts`） |
| バランス数値・静的テーブル | `src/data/`（数値は balance.ts） |
| 画面・入力ハンドリング | `src/features/` `src/components/` |
| 起動時の副作用（セーブ読込・autosave・window.__gs） | `src/state/boot.ts` のみ |

`src/core/` の関数は React / zustand / DOM / localStorage に依存してはならない。状態は引数で受け取り、変更分（`patch: Partial<GameState>`）を返す。

## §2 乱数・時刻の注入（このプロジェクトのポートは2つだけ）

```ts
// src/core/ports.ts
export type Rng = () => number;   // [0,1)
export type Clock = () => number; // epoch ms
```

書き方は**末尾デフォルト引数**（呼び出し側は無変更で済む）：

```ts
// ❌ 禁止
const luck = 0.97 + Math.random() * 0.06;

// ✅ 正
export const computeRevenue = (args, rng: Rng = Math.random) => {
  const luck = 0.97 + rng() * 0.06;
};
```

- `Date.now()` / `new Date()` も同様に `now: Clock = Date.now` か `nowMs: number` 引数で受ける。
- 適用範囲：`core/` `utils/` `data/` のすべての関数。`features/` 内でも抽選・判定に使う乱数は注入形にする。
- 演出専用（パーティクルの散らし方等、結果がゲーム状態に影響しないもの）は直呼びを許容する。

## §3 import 時副作用の禁止

モジュールを import しただけで localStorage 読込・`setInterval`・`subscribe` 登録・`window` への書き込みが走ってはならない（テストから import できなくなる）。

- 起動処理はすべて `bootGameStore()`（`src/state/boot.ts`）に集約し、`main.tsx` の render 前に1回だけ呼ぶ。
- `window.__gs`（e2e 用の state 覗き窓）と `?seed=NN`（乱数 seed 化）の配線も boot 内。

## §4 gameStore アクション = 薄い配線

```ts
// ✅ 良い：計算は core/、アクションは配線だけ
releaseWork: (opts) => {
  const r = computeRelease(get(), opts, defaultDeps);
  set(r.patch);
  return r.work;
},

// ❌ 悪い：アクション本体に品質計算や分岐を書き足す
```

既存アクションにロジックを足したくなったら、`core/` に関数を作って（または既存の core 関数を拡張して）呼ぶ。**unit テストを同時に書く**（testing-rules スキル参照）。

- store はシングルトン（`useGameStore`）を維持する。ファクトリ化しない（理由は docs/architecture.md §5-3）。
- store の公開 API（アクション名・シグネチャ）を変える時は import 元 12 ファイルへの影響を必ず確認。

## §5 UI コンポーネントの責務

- 表示・入力ハンドリング・store アクション呼び出しのみ。
- 派生計算が**3行を超えたら**同ディレクトリの `.ts` に純粋関数として切り出す（前例：`devImpact.ts`）。
- タイマー / rAF は演出専用に限る。ゲーム内時間の進行は GlobalTicker → store の tick アクション経由の一本道（勝手に第2の時計を作らない）。

## 現在の導入状況

段階移行中（進捗は `tasks/todo.md` の P0〜P7）。P2〜P4 完了までは gameStore に規約違反（import 時副作用・アクション内ロジック）が**既知のものとして残っている**。既存違反は移行フェーズで解消するので個別に直さない。**新規コードは本規約に即時準拠すること**。
