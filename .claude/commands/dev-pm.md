---
description: 管理ループ。社長承認済みの提案を PM が優先度判断してキュー化し、提案ごとに build worktree を払い出して開発チーム(/dev-build)に渡し、結果を回収する
---

# /dev-pm — 管理ループ（企画 → 開発 の間）

設計は `docs/dev-pm.md`。**企画（`/dev-plan`）と開発（`/dev-build`）の間**に立ち、
承認済み提案を **「どれを・どの順で・どの worktree で」** 開発チームに渡して回収する工程。
**Workflow ではなくメインセッションで踏む手順**（worktree の払い出し・dev server・社長への報告はメインセッションの仕事）。

## 引数（`$ARGUMENTS` を解釈）
- `ids`（任意）: 社長承認済みの提案 id（カンマ/空白区切り）。省略時は `docs/plans/*/proposal.md` を全ブランチから探して**ステータス `未完了`** を候補にする
- `count`（既定 2）: この起動で開発チームに流す件数
- `plan`（任意）: 提案の取得元（`/dev-plan` の worktree パス、またはブランチ名）。省略時は自動検出

## 手順（PM としてメインセッションで実行）

### 1. 優先度判断（pm エージェント）
`Agent(subagent_type:"pm")` に対象 id 群を渡し、**実行キュー**を返させる（コードは変更させない）。
返させる形（`schema` で型付け）:

```
{ queue: [{ id, title, rank, effect, cost, risk, dependsOn[], conflictsWith[], handoff, blocked, reason }],
  defer: [{ id, reason }] }
```

- **衝突（同じファイル・数値・画面を触る）id は同時に流さない**。前後に分ける（キューは直列に消化する）。
- `blocked:true`（🔧未解決・ステータス不整合）は流さず、論点を社長に上げる。
- 上位 `count` 件を今回のバッチとし、**着手順を社長に1行ずつ通知**する（ここに承認ゲートは置かない。承認は企画ループで済んでいる）。

### 2. build worktree の払い出し（1提案＝1 worktree＝1 PR）
バッチの各 id について、**リポジトリ直下（メイン作業ツリー）を汚さずに**用意する:

```bash
ID=<id>; ROOT=$(git rev-parse --show-toplevel); WT="$ROOT/.claude/worktrees/build-$ID"
git -C "$ROOT" fetch origin main
git -C "$ROOT" worktree add -b "worktree-build-$ID" "$WT" origin/main   # 既存なら add せずそのまま使う
npm --prefix "$WT" ci                                                    # 新しい worktree に node_modules は無い
```

**proposal の取り込み**（build worktree は `origin/main` から切るので、企画ブランチの proposal は入っていない）:

```bash
SHA=$(git -C "$ROOT" rev-list --all -1 -- "docs/plans/$ID/proposal.md")
git -C "$WT" checkout "$SHA" -- "docs/plans/$ID"    # 見つからない場合は plan= の作業ツリーから cp -r
```

取り込んだら **proposal 冒頭メタの `- **ステータス**: ` を `進行中` に更新**し、
pm の `handoff`・順位・衝突メモを `docs/plans/$ID/pm.md` に書いて、両方を worktree 内でコミットする
（この記録は PR に載って社長の判断材料になる）。

**専用ポートの割り当て**（他ツリーの dev server を掴んで「動いてるのに変わらない」を防ぐ）:

```bash
for p in $(seq 5180 5199); do ss -ltnH | awk '{print $4}' | grep -q ":$p$" || { echo $p; break; }; done
```
5173 はメイン作業ツリー予約。選んだ番号を `GAME_PORT` として `/dev-build` に渡す。

### 3. 開発チームへ引き渡し（1件ずつ直列）
キュー順に1件ずつ Workflow を起動する。**並列にしない**（Playwright は1本しか掴めず、QA が互いに壊す）。

```
Workflow({ scriptPath: ".claude/workflows/dev-build.js",
           args: { ids: ["<id>"], worktree: "<WT の絶対パス>", port: <GAME_PORT>, handoff: "<pm の handoff>" } })
```

### 4. 回収と管理（PM の本業）
1件終わるごとに Workflow の戻り値（`done` / `failed` / `integ.prUrl`）を見て仕分ける:

| 結果 | PM の処置 |
|---|---|
| 通過・PR 作成 | proposal は workflow が `完了` に更新済み。PR URL と **dev server URL（`GAME_PORT`）** を社長に渡す。worktree は**消さない**（社長の実機チェック用） |
| 検証 fail / 審査 approve<2 | proposal を `未完了` に戻す。落ちた理由が**実装の問題**なら同 id を再投入（最大1回）、**提案の問題**なら企画（`/dev-plan`）へ論点付きで差し戻す |
| 計画で blocked | 企画へ差し戻し。worktree は `git worktree remove` で片付ける |

バッチが終わったら、**着手した全 id の結果一覧**（PR / 落ちた理由 / 差し戻し先）と、
`defer` に残した提案の理由を社長に報告する。

## 安全ガード
- **メイン作業ツリー（リポジトリ直下）でコード実装をしない**。実装は必ず払い出した build worktree の中。
- **1 worktree = 1 提案 = 1 PR**。衝突する提案を同じ worktree に相乗りさせない。
- worktree ごとに **`GAME_PORT` を固定**し、`npm run dev -- --port $GAME_PORT --strictPort` で起動する
  （`--strictPort` により、他ツリーのサーバーを掴んだら黙って通らず必ずエラーになる）。
- PM は proposal の中身を書き換えない（狙い・UI の置き場所は企画と社長の合意物）。
