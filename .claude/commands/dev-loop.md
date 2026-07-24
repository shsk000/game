---
description: 責任者→企画→実装→検証→審査の5ロールで開発を1周ループし、PR作成まで自動化する
---

# /dev-loop — マルチエージェント開発ループ

設計の全体像は `docs/dev-loop.md`。ロール定義は `.claude/agents/`（producer / planner / engineer / qa / reviewer）。

## やること

`Workflow` ツールで `.claude/workflows/dev-loop.js` を実行する（`scriptPath` で指定するのが確実）:

```
Workflow({ scriptPath: ".claude/workflows/dev-loop.js", args: { count: 3, focus: "", branch: "" } })
```

引数（`$ARGUMENTS` を解釈して `args` に渡す）:

- `count`（既定 3）: 1周で処理するタスク数
- `focus`（任意）: 責任者の分析焦点（例 `経済バランス`）
- `branch`（任意）: 作業ブランチ名を明示。省略時は自動（main/master 上なら `dev-loop/<短SHA>`、feature ブランチ上ならそれを使う）
- `parallel`（既定 false）: **現状未実装**。true でも逐次実行にフォールバックする（共有ツリー競合のため。詳細は `docs/dev-loop.md` §7）

例:
- `/dev-loop` → おまかせ3タスク、PR作成まで全自動
- `/dev-loop count=1` → 1タスクだけ
- `/dev-loop focus=経済バランス` → 経済バランスに焦点

## 前提と安全ガード

- Workflow は Max/Team/Enterprise で利用可。**ロール agent 定義を読み込んだセッション**（新規セッション推奨）で起動する。
- **新テーマ/新ジャンル・コアループ改変・大投資は自動着手しない**（責任者が GO 待ちへ退避し PR にメモ）。
- **審査 approve<2 または 検証 fail のタスクは PR に混ぜない**。通過タスクは個別コミット・不通過タスクは変更破棄で実効化。通過ゼロなら PR を作らない。
- 起動時に作業ブランチを用意（`branch=` or 自動）。PR 作成は `gh` CLI。
- 停止点は **PR 作成まで**。マージは人間が行う。

## 実行後にやること

Workflow の戻り値（done / failed / deferred / integ.prUrl）をオーナーに要約報告する。
GO 待ち退避項目があれば論点を提示して判断を仰ぐ。
