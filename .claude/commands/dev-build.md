---
description: 開発ループ。社長承認済みの提案(docs/plans/<id>/proposal.md)を実装→検証→審査3体→PRまで自動化する
---

# /dev-build — 開発ループ

設計は `docs/dev-build.md`。**社長承認済みの提案**を実装する。Workflow `.claude/workflows/dev-build.js` を起動する。

## 引数（`$ARGUMENTS` を解釈して `args` に渡す）
- `ids`（必須）: 社長承認済みの提案 id（カンマ/空白区切り。例 `20260725-daily-gacha,20260725-offline-modal`）
- `branch`（任意）: 作業ブランチ名。省略時は自動（main/master 上なら `dev-build/<短SHA>`、feature ブランチ上ならそれを使う）

## やること

```
Workflow({ scriptPath: ".claude/workflows/dev-build.js", args: { ids: ["<id>", ...], branch: "" } })
```

各 id につき 企画(planner: proposal.md を読み技術計画→`plan.md`)→ 実装 → 検証(4点セット＋実機入力) → 審査3体多数決 → per-item コミット を回し、通過分で PR を作成する。

## 安全ガード
- **審査 approve<2 または 検証 fail の id は PR に混ぜない**（変更破棄で実効化）。通過ゼロなら PR を作らない。
- per-item コミット隔離（`git add -A`/`git clean` は使わない＝未追跡スクショを巻き込まない）。
- planner は proposal の **UI 置き場所・狙いを勝手に変えない**（審査もそこを見る）。

## 完了後：dev server を起動したまま残す
社長は最終的に**ゲームで実機チェックしてからマージ**する。PR 作成後、**dev server を落とさず起動したまま**にし、起動 URL を社長に伝える（サーバー起動はメインセッション側で管理。背景エージェントに任せない）。

## 中断・失敗からの再開
Workflow は会話プロセス上で回るため、バックグラウンド fork で中断し得る:
- **同一セッションで `resumeFromRunId` 再開**（正規機能。終わったロールはキャッシュ再利用、中断点から）。
- fork で別セッションに移り全再実行に落ちたら：**破棄せず**、未コミット実装を build+unit 通過後に**保護コミット**し、残りロールを独立 Agent で1ステップずつ手回し（qa=ブラウザはメインセッションで）。
- **うまく回らなかったら根本原因を現物で特定し、skill/workflow を再発しない形に直す**（自己改善）。詳細は `docs/dev-loop.md`。

## 実行後にやること
Workflow の戻り値（done / failed / integ.prUrl）を社長に要約報告し、**dev server の起動 URL** を添える。
