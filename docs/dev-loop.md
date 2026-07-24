# マルチエージェント開発ループ（dev-loop）— 共通の土台

> **位置づけ**: 工学・運用資料（`docs/architecture.md`・`docs/testing.md` と同格）。
> ゲーム仕様は `docs/vNN/spec.md`、開発フローの思想は `.claude/skills/dev-flow/`。
> このドキュメントは「**5つのロール（別エージェント）で dev-flow の4ゲートを回す開発ループ**」の**共通の土台**（なぜ多エージェントか・ロール定義・通信方式・人間ゲートの位置）。ループごとの手順は下記2docへ分割した。

## 構成：企画ループ ↔（社長ゲート）↔ 開発ループ

| フェーズ | 設計doc | コマンド（実装時） | 中身 |
|---|---|---|---|
| **企画ループ** | `docs/dev-plan.md` | `/dev-plan` | 責任者が実プレイ＋コードで軽量PRDを提案 → 社長承認 |
| （人間ゲート） | — | — | 社長が **承認 / 修正 / 却下** |
| **開発ループ** | `docs/dev-build.md` | `/dev-build <id>` | 承認PRDを planner→実装→検証→審査3体→PR。PR後もserver維持 |

> 旧「責任者→…→PR を一気通貫で自動」（§3-5）は、この2ループ化で**企画↔開発の間に社長ゲートを挟む形に更新**。§3-5 は各ループ内の品質ゲート機構として引き続き有効。

---

## 1. 何を解決するか

`.claude/skills/dev-flow/` の4ゲート（計画→実装→検証→レビュー依頼）は正しいが、
`tasks/lessons.md` のアンチパターンは**全部「同じ人格が自分の宿題を自分で甘く採点した」失敗**だった。

| # | 失敗 | 本質 |
|---|---|---|
| 2 | console から store 直呼びで「実機検証済み」と報告 | 実装者＝検証者だったので手心が入った |
| 3 | 自分で触らず「残るはオーナー実プレイのみ」 | 検証をオーナーに転嫁 |
| 4 | unit/ui が緑で満足し e2e を忘れた | 検証者が実装者の続きで疲れていた |
| 1 | 報酬を CAP+8 に埋もれさせ「作ったが反映されてない」 | 目的への立ち返りが実装中に薄れた |

**対策＝ゲートごとに context を分けた別エージェントを立て、後段に敵対的インセンティブを与える。**
実装者は自分の検証を甘くできず、検証者・レビュー者は「落とすこと」で評価される。
これは速度ではなく**品質のための多エージェント化**。速度（並列）は副次的なオプション。

---

## 2. 5つのロール（agent）

各ロールは `.claude/agents/*.md` の Subagent 定義。独立 context・専用 tool・専用システムプロンプトを持つ。
既存スキルをそのままロール憲章として読み込む。

| ロール | ファイル | 担当ゲート | 憲章（読むスキル） | 権限 |
|---|---|---|---|---|
| **責任者 / Producer** | `producer.md` | ループ頂点（何を作るか） | game-design（最上位の目的）+ roadmap/gaps | 読み取り専用（コード変更しない） |
| **企画 / Planner** | `planner.md` | [1] 計画 | game-design + dev-flow + docs/CLAUDE.md | 読み取り専用（計画を出力） |
| **実装 / Engineer** | `engineer.md` | [2] 実装 | logic-architecture + testing-rules | 全権（コード＋unitテスト） |
| **検証 / QA** | `qa.md` | [3] 検証 | testing-rules + playwright-verify | 検証のみ（コード編集禁止） |
| **審査 / Reviewer** | `reviewer.md` | [4] ゲート番人 | dev-flow アンチパターン集 | 読み取り専用（3体多数決） |

> Anthropic の推奨（役割は3〜4体まで、増やしすぎは逆効果）に沿い、
> 中核は5ロール。審査だけは独立性のため同一ロールを3インスタンス並列で走らせ多数決する。

---

## 3. ループの形（2階層）

```
┌─ macro（タスク横断ループ）──────────────────────────────┐
│ [責任者] 目的(最上位の目的)を起点に今のゲームを分析              │
│   └→ gaps.md / roadmap / 実コードから 差分を優先度付け      │
│   └→ 「自動着手可」項目 と 「オーナーGO待ち」項目 に仕分け  │
│                                                            │
│  for each 自動着手可 item:                                 │
│   ┌─ micro（1タスク内ループ）──────────────────┐          │
│   │ [企画] 目的1行 + 因果チェーン + 完成条件      │          │
│   │   ↓                                          │          │
│   │ [実装] 最小変更 + unitテスト  ←──┐           │          │
│   │   ↓                              │ NG(最大3回) │        │
│   │ [検証] 4点セット + 実機入力 ─────┘           │          │
│   │   ↓ pass                                     │          │
│   │ [審査×3] 敵対レビュー多数決 → approve≥2?     │          │
│   │   ↓ 通過=このタスクの変更だけ即コミット        │          │
│   │      不通過=このタスクの変更を破棄            │          │
│   └──────────────────────────────────────────────┘          │
│                                                            │
│ [統合] 通過コミットを push → PR作成（gh・全自動）         │
│ [退避] GO待ち項目は PR 本文と docs にメモして人間へ        │
└────────────────────────────────────────────────────────────┘
```

- **micro のフィードバック辺は Workflow のコードで強制**する（モデルの気分で飛ばせない）。
  検証 NG は実装へ最大3回差し戻し、検証結果を次の実装プロンプトに渡す。
- **審査は独立3体の多数決**（`parallel`）。approve が2票未満なら不通過＝統合に含めない。

---

## 4. 停止点と安全ガード（オーナー方針 2026-07-23）

- **既定は「PR作成まで全自動」**（マージは人間）。1回の起動で処理するタスク数は `count`（既定3）。
- **新テーマ / 新ジャンルは自動着手しない**。責任者が `needsOwnerGo:true` を立て、
  ループから除外して PR 本文・docs にメモ（`genre-theme-content` スキルと dev-flow lessons #1「新テーマは明示GO必須」を尊重）。
- **後戻りしにくい大投資・コアループ改変**も同様に GO 待ちへ退避。
- **審査 approve<2 または 検証 fail のタスクは統合しない**（PR に混ぜない）。通過ゼロなら PR を作らない。
  - この保証は**per-item のコミット隔離**で実効化する：通過タスクは直後にそのタスクの変更ファイルだけを個別コミットし、
    不通過タスクは作業ツリーの変更を破棄する（`git restore` ＋ そのタスクが作った未追跡ファイルのみ削除）。
    `git add -A` / `git clean` は使わない（リポジトリ直下の未追跡スクショ等を巻き込まないため）。
    統合ロールは「既にコミット済みの通過タスクだけが載ったブランチ」を push する（ダーティツリーを掃かない）。
- 実装は最小変更。責任者が出した目的に紐づかない改変は審査で落とす。

---

## 5. 起動方法

```
/dev-loop                    # 責任者おまかせで3タスク、PR作成まで
/dev-loop count=1            # 1タスクだけ
/dev-loop focus=経済バランス   # 責任者の分析焦点を指定
/dev-loop branch=dev-loop/x  # 作業ブランチを明示（省略時は自動命名）
```

> 起動時に作業ブランチを用意する。`branch=` 省略時、現在ブランチが main/master なら `dev-loop/<短SHA>` を自動作成、
> feature ブランチ上ならそれをそのまま使う。ハードコードされたブランチに毎回上書きすることはない。

内部的には Workflow ツール（`.claude/workflows/dev-loop.js`）を実行する。
Workflow は Max/Team/Enterprise で利用可。ロール agent 定義を読み込んだセッション（新規セッション推奨）で起動する。

> **参考**: [Claude Code Workflows](https://code.claude.com/docs/en/workflows) /
> [Custom subagents](https://code.claude.com/docs/en/sub-agents)

---

## 6. ロール間の受け渡し（構造化スキーマ）

各ゲートの出力は Workflow の `schema` で型検証して次段へ渡す（自由文の取りこぼしを防ぐ）。

- **責任者 → 企画**: `{ items: [{ id, title, rationale, purposeLink, priority, targetFiles, doneConditions, needsOwnerGo }] }`
- **企画 → 実装**: `{ goalOneLine, causalChain, caps, doneChecklist, approach, filesToTouch, testPlan }`
- **実装 → 検証**: `{ summary, changedFiles, unitTestsAdded, selfCheck }`
- **検証 → 審査**: `{ build, unit, ui, e2e, realInputChecked, checklistResults, failures, verdict }`
- **審査 → 統合**: `{ verdict: approve|reject, antiPatternChecks, purposeAligned, reasons }`

因果チェーン（`causalChain`）と CAP 列挙（`caps`）を計画段で必須化しているのは、
アンチパターン #1（CAP に埋もれる）を構造で防ぐため。

### 6.1 エージェント間コミュニケーションの方針

**エージェント同士を直接会話させない。** 通信は3チャネルに限定する。

1. **制御・データ = オーケストレーター仲介（黒板方式）**
   各ロールの出力を Workflow の JS 台本が `schema` で型検証し、次段のプロンプトに差し込む。
   自由文チャットで伝言ゲーム化させない。利点＝**決定論・`journal.jsonl` による監査・resume 可能・
   審査者の独立性維持（雑談による実装者への同調＝共謀を防ぐ）**。
2. **共有状態 = リポジトリ現物**
   実装者が書いた実コード・テスト・docs を、検証者・審査者が**実際に読んで動かす**。
   伝聞でなく現物が最も信頼できる共有黒板。
3. **フィードバック辺 = 台本のループ変数**
   検証結果オブジェクトを次の実装プロンプトへ渡して差し戻す（何が落ちたかを実装者へ）。

直接対話（SendMessage 型の往復）を使わない理由：①決定論とリプレイ性、②context 肥大の回避、
③審査の独立性（敵対性）維持。会話が要るのは人間との境界（GO 待ち）だけで、そこは PR / docs に集約する。

### 6.2 なぜこの通信方式か（2026 の指針との整合）

2026 の production 指針は「マルチエージェントが壊れる最大原因はパターン選択でなく **context の不整合**。
対策は *shared mutation でなく明示メッセージ* ＋ *verifier チェックポイント* ＋ *完全な監査証跡*」で一致している
（[Atlan](https://atlan.com/know/multi-agent-system-orchestration/) /
[Taskade](https://www.taskade.com/blog/inter-agent-communication-patterns) /
schema 接地＋監査可能性を推す [PatchBoard, 2026](https://arxiv.org/pdf/2605.29313)）。
本設計はこれに一致：①型付きメッセージ（共有メモリ直書きしない）②QA＋審査の verifier チェックポイント
③`journal.jsonl` の監査証跡。

Claude Code の通信トポロジ3種との棲み分け
（[比較](https://www.developersdigest.tech/blog/claude-code-subagents-vs-agent-teams-vs-workflows)）：

| 方式 | 通信 | この用途での評価 |
|---|---|---|
| **Workflow（採用）** | オーケストレーター仲介・型付き受け渡し | ◎ 決定論・監査・審査の独立性が要る品質ゲートに最適 |
| Agent Teams | 共有タスクリスト(kanban)・git・自律claim・並列 | △ 大量バックログの swarm 連続処理向き。審査の独立性・監査は弱い |
| 自由文チャット / 素の共有メモリ | 直接会話・共有 scratchpad | ✕ 2026 指針が名指しで避ける anti-pattern |

**切り替え基準**：将来「数十タスクを連続並列で消化する swarm」にするなら、**macro 層だけ Agent Teams に載せ替え、
micro の品質ゲートは Workflow のまま残す hybrid** が最適。現状はループの肝が
「審査者の敵対的独立性」と「ゲート非スキップの決定論」なので Workflow 仲介型を主とする。

---

## 7. 既知の制約 / 今後

- **`parallel=true` は現状「未実装」**。指定しても逐次実行にフォールバックする（`dev-loop.js` が警告を出す）。
  複数 engineer を同一作業ツリーで同時に走らせると、①ファイル編集の競合、②後述の per-item コミット隔離（§4）の破綻、
  が起きるため。将来 `isolation:'worktree'`（node_modules 分離まで含む）を実装したら解禁する。
  それまで「複数エージェント」は**1タスクを5ロール＋審査3体で回す縦の多エージェント**で満たす。
- **統合は git worktree でなくブランチ上で逐次**。起動時に作業ブランチを用意し（`branch=` 指定 or 自動 `dev-loop/<sha>`）、
  main/master 上での直接実装を避ける（§4）。
- PR 作成は **`gh` CLI**（`gh pr create`）で行う。`mcp__github__` はこのリポジトリに接続していないため使わない。
- 音・体感・面白さなど機械検証不能な項目は検証者が `ownerCheck` ラベルで PR に残す（dev-flow 3-4）。
