---
description: 開発ループ。PM から渡された build worktree の中で、承認済み提案(docs/plans/<id>/proposal.md)を実装→検証→審査3体→PRまで自動化する
---

# /dev-build — 開発ループ（開発チーム）

設計は `docs/dev-build.md`。**PM（`/dev-pm`）から渡された1提案を、渡された build worktree の中だけで作り切る**。
Workflow `.claude/workflows/dev-build.js` を起動する。

## 引数（`$ARGUMENTS` を解釈して `args` に渡す）
- `ids`（必須）: 社長承認済みの提案 id（既定は1件。カンマ区切りで複数も可だが、衝突判断は PM 側の責任）
- `worktree`（必須）: 作業する build worktree の**絶対パス**（`<repo>/.claude/worktrees/build-<id>`）
- `port`（必須）: この worktree 専用の dev server ポート（PM が払い出す。5173 は使わない）
- `handoff`（任意）: PM からの申し送り（この提案で外してはいけない点）

## やること

```
Workflow({ scriptPath: ".claude/workflows/dev-build.js",
           args: { ids: ["<id>"], worktree: "<絶対パス>", port: <port>, handoff: "<PM の申し送り>" } })
```

各 id につき 企画(planner: proposal.md を読み技術計画→`plan.md`)→ 実装 → 検証(4点セット＋実機入力) → 審査3体多数決 → per-item コミット を回し、通過分で PR を作成する。**すべての読み書き・コマンドは `worktree` の中**で行う。

## 引数が無いとき（直叩きされたとき）
`worktree` / `port` が無いまま実行しない。**`/dev-pm ids=<id>` を使うよう促す**（優先度判断と worktree 払い出しは PM の仕事）。
どうしても単発で回すなら、起動前にメインセッションで最低限これを済ませてから args を埋める:

```bash
ID=<id>; ROOT=$(git rev-parse --show-toplevel); WT="$ROOT/.claude/worktrees/build-$ID"
git -C "$ROOT" fetch origin main && git -C "$ROOT" worktree add -b "worktree-build-$ID" "$WT" origin/main
npm --prefix "$WT" ci
SHA=$(git -C "$ROOT" rev-list --all -1 -- "docs/plans/$ID/proposal.md"); git -C "$WT" checkout "$SHA" -- "docs/plans/$ID"
for p in $(seq 5180 5199); do ss -ltnH | awk '{print $4}' | grep -q ":$p$" || { echo $p; break; }; done
```

## 安全ガード
- **worktree の外を触らない**。メイン作業ツリー（リポジトリ直下）や他の worktree のファイルは読み書きしない。
- **審査 approve<2 または 検証 fail の id は PR に混ぜない**（変更破棄で実効化）。通過ゼロなら PR を作らない。
- per-item コミット隔離（`git add -A`/`git clean` は使わない＝未追跡スクショを巻き込まない）。
- planner は proposal の **UI 置き場所・狙いを勝手に変えない**（審査もそこを見る）。
- dev server / e2e は必ず `port` で起動する（`npm run dev -- --port <port> --strictPort` / `GAME_PORT=<port> npm run test:e2e`）。
  他ツリーのサーバーを掴んだ「動いてるのに変わらない」偽グリーンを防ぐため。

## ステータス管理（proposal）
proposal は `未完了 → 進行中 → 完了` の3状態を冒頭メタに持つ（定義は `docs/dev-plan.md`）。
- **起動前**：PM が worktree へ取り込む際に **進行中** に更新済み。
- **通過**：開発ループ通過（PR作成）で workflow が per-item コミットに **完了** への更新を含める。
- **不通過**：PR に載らなかった id は PM が **未完了** に戻す。

## 完了後：dev server を起動したまま残す
社長は最終的に**ゲームで実機チェックしてからマージ**する。PR 作成後、**その worktree の dev server を落とさず起動したまま**にし、
起動 URL（`http://localhost:<port>/`）を PM 経由で社長に伝える（サーバー起動はメインセッション側で管理。背景エージェントに任せない）。

## 中断・失敗からの再開
Workflow は会話プロセス上で回るため、バックグラウンド fork で中断し得る:
- **同一セッションで `resumeFromRunId` 再開**（正規機能。終わったロールはキャッシュ再利用、中断点から）。
- fork で別セッションに移り全再実行に落ちたら：**破棄せず**、未コミット実装を build+unit 通過後に**保護コミット**し、残りロールを独立 Agent で1ステップずつ手回し（qa=ブラウザはメインセッションで）。
- **うまく回らなかったら根本原因を現物で特定し、skill/workflow を再発しない形に直す**（自己改善）。詳細は `docs/dev-loop.md`。

## 実行後にやること
Workflow の戻り値（done / failed / integ.prUrl）を **PM に返す**（`/dev-pm` の回収ステップ）。
PM が社長への報告（PR URL・dev server URL・落ちた id の差し戻し先）をまとめる。
