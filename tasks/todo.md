# テスト環境導入 + テスタビリティ改修（2026-07-09 〜 2026-07-10）

計画本体: `~/.claude/plans/polymorphic-jumping-island.md`／設計資料: `docs/architecture.md`・`docs/testing.md`

- [x] P0: Vitest 基盤 + 既存純粋関数の単体テスト（改修ゼロ）
- [x] P1: core/ports.ts + RNG/Clock デフォルト引数注入 + テスト
- [x] P2: gameStore の import 時副作用排除（boot.ts / testing.ts）+ テスト
- [x] P3a: core/progression.ts 抽出 + テスト
- [x] P3b: core/economy.ts 抽出 + テスト
- [x] P3c: core/release.ts 抽出（releaseWork パイプライン）+ テスト
- [x] P4: typingEngine.ts 抽出 + テスト
- [x] P5: ユースケース UI テスト（Vitest Browser Mode）
- [x] P6: Playwright 整理（webServer 追加・旧 spec 11本を tests/archive/ へ・journey.spec 新設・?seed 決定化）
- [x] P7: docs/architecture.md・docs/testing.md + `.claude/skills/`（logic-architecture / testing-rules）

## Review（2026-07-10 完了時点）

- **テスト**: unit 154 件 + ユースケース UI 10 件 = 164 件（`npm test` 約 17 秒）
- **e2e**: 7 本（smoke 5 + sales-flow 1 + journey 1）22 秒。旧 25 本 6.3 分から短縮。
  改修前から失敗していた旧バージョン向け 7 本は tests/archive/ に退避（削除はしていない）
- **アーキテクチャ**: gameStore 1,010 行 → 591 行（ルール計算は core/ の純粋関数へ）。
  import 時副作用ゼロ・乱数/時刻は Rng/Clock 注入・`?seed=NN` で e2e まで決定化
- **回帰確認**: 各フェーズで build / unit / e2e ベースライン（18本パス）一致 / ブラウザ実機
  （セーブ→リロード復元・実打鍵でコンボ進行）を確認
- **既知の残課題**:
  - フレーズ完了直後の打鍵で nano-type-jp が throw する競合（改修前からの既存挙動）
  - DevelopScreen（2,101 行）は未分割（v15 仕様が動いているため見送り。architecture.md §5-6）
- **次バージョン**: docs/v16/（バランス再設計・社員成長）は計画のみ。実装はレビュー後
