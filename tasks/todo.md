# テスト環境導入 + テスタビリティ改修（2026-07-09）

計画本体: `~/.claude/plans/polymorphic-jumping-island.md`

- [ ] P0: Vitest 基盤 + 既存純粋関数の単体テスト（改修ゼロ）
- [ ] P1: core/ports.ts + RNG/Clock デフォルト引数注入 + テスト
- [ ] P2: gameStore の import 時副作用排除（boot.ts / testing.ts）+ テスト
- [ ] P3a: core/progression.ts 抽出 + テスト
- [ ] P3b: core/economy.ts 抽出 + テスト
- [ ] P3c: core/release.ts 抽出（releaseWork パイプライン）+ テスト
- [ ] P4: typingEngine.ts 抽出 + テスト
- [ ] P5: ユースケース UI テスト（Vitest Browser Mode）
- [ ] P6: Playwright 整理（webServer 追加・旧 spec 10本を tests/archive/ へ）
- [ ] P7: docs/testing.md + `.claude/skills/` にアーキテクチャ規約・テスト規約スキルを作成（ユーザー指示 2026-07-09）

## Review

（完了時に記入）
