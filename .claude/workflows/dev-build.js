export const meta = {
  name: 'dev-build',
  description: 'PM が払い出した build worktree の中で、承認済み提案(docs/plans/<id>/proposal.md)を 企画→実装→検証→審査3体→PR で実装する開発ループ',
  phases: [
    { title: '準備' },
    { title: '開発ループ' },
    { title: '統合' },
  ],
}

// ---- パラメータ（/dev-pm または /dev-build が渡す）----
// args.ids:      社長承認済み提案 id の配列（例 ["20260725-daily-gacha"]）。カンマ/空白区切りの文字列も可。
// args.worktree: 作業する build worktree の絶対パス（PM が払い出す）。ここ以外は触らない。
// args.port:     この worktree 専用の dev server ポート（PM が払い出す。5173＝メイン作業ツリーは使わない）。
// args.handoff:  PM からの申し送り（この提案で外してはいけない点）。
const RAW_IDS = args && args.ids
const IDS = Array.isArray(RAW_IDS)
  ? RAW_IDS.filter(Boolean)
  : typeof RAW_IDS === 'string'
    ? RAW_IDS.split(/[\s,]+/).filter(Boolean)
    : []
const WORKTREE = (args && args.worktree) || ''
const PORT = (args && args.port) || 5180
const HANDOFF = (args && args.handoff) || ''
const MAX_IMPL_RETRY = 3

// すべてのロールに同じ作業ディレクトリ規約を渡す（worktree の外に出ると別ブランチの内容と混線する）。
const WORKDIR = [
  `【作業ディレクトリ（build worktree）】${WORKTREE}`,
  '**この配下だけで作業する。** Read/Write/Edit のパスは必ずこの絶対パス始まり。',
  `Bash は最初に \`cd ${WORKTREE}\` を実行してから使う（以降そのシェルの cwd は維持される）。git は \`git -C ${WORKTREE} …\` でもよい。`,
  'リポジトリ直下（メイン作業ツリー）や他の worktree のファイルは読み書きしない。読んだ内容が別ブランチの物になり検証が嘘になる。',
  `dev server と e2e はこの worktree 専用ポート ${PORT} を使う: \`npm run dev -- --port ${PORT} --strictPort\` / \`GAME_PORT=${PORT} npm run test:e2e\`。`,
  '5173（メイン作業ツリー）は絶対に使わない。他ツリーのサーバーを掴むと「動いているのに変更が反映されない」偽グリーンになる。',
].join('\n')

const handoffLine = HANDOFF ? `【PM からの申し送り（外してはいけない点）】${HANDOFF}` : ''

// ---- スキーマ（ロール間の型付き受け渡し）----
const PLAN_SCHEMA = {
  type: 'object',
  properties: {
    blocked: { type: 'boolean' },
    needsOwnerGo: { type: 'boolean' },
    title: { type: 'string' },
    goalOneLine: { type: 'string' },
    causalChain: { type: 'array', items: { type: 'string' } },
    caps: { type: 'array', items: { type: 'string' } },
    doneChecklist: { type: 'array', items: { type: 'string' } },
    approach: { type: 'string' },
    filesToTouch: { type: 'array', items: { type: 'string' } },
    testPlan: { type: 'array', items: { type: 'string' } },
    reason: { type: 'string' },
  },
  required: ['goalOneLine', 'causalChain', 'caps', 'doneChecklist', 'approach'],
}

const IMPL_SCHEMA = {
  type: 'object',
  properties: {
    blocked: { type: 'boolean' },
    summary: { type: 'string' },
    changedFiles: { type: 'array', items: { type: 'string' } },
    unitTestsAdded: { type: 'array', items: { type: 'string' } },
    selfCheck: { type: 'string' },
    reason: { type: 'string' },
  },
  required: ['summary', 'changedFiles', 'selfCheck'],
}

const VERIFY_SCHEMA = {
  type: 'object',
  properties: {
    build: { type: 'boolean' },
    unit: { type: 'boolean' },
    ui: { type: 'boolean' },
    e2e: { type: 'boolean' },
    realInputChecked: { type: 'boolean' },
    servedFromWorktree: { type: 'boolean' },
    checklistResults: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          item: { type: 'string' },
          passed: { type: 'boolean' },
          evidence: { type: 'string' },
        },
        required: ['item', 'passed'],
      },
    },
    failures: { type: 'array', items: { type: 'string' } },
    ownerChecks: { type: 'array', items: { type: 'string' } },
    verdict: { type: 'string', enum: ['pass', 'fail'] },
  },
  required: ['build', 'unit', 'ui', 'e2e', 'verdict'],
}

const REVIEW_SCHEMA = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['approve', 'reject'] },
    purposeAligned: { type: 'boolean' },
    antiPatternChecks: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          pattern: { type: 'string' },
          ok: { type: 'boolean' },
          note: { type: 'string' },
        },
        required: ['pattern', 'ok'],
      },
    },
    reasons: { type: 'array', items: { type: 'string' } },
  },
  required: ['verdict', 'purposeAligned'],
}

const INTEG_SCHEMA = {
  type: 'object',
  properties: {
    committed: { type: 'boolean' },
    pushed: { type: 'boolean' },
    prCreated: { type: 'boolean' },
    prUrl: { type: 'string' },
    notes: { type: 'string' },
  },
  required: ['committed'],
}

const SETUP_SCHEMA = {
  type: 'object',
  properties: {
    ok: { type: 'boolean' },
    branch: { type: 'string' },
    isWorktree: { type: 'boolean' },
    proposalsFound: { type: 'array', items: { type: 'string' } },
    proposalsMissing: { type: 'array', items: { type: 'string' } },
    nodeModules: { type: 'boolean' },
    note: { type: 'string' },
  },
  required: ['ok', 'branch'],
}

const GIT_SCHEMA = {
  type: 'object',
  properties: {
    ok: { type: 'boolean' },
    sha: { type: 'string' },
    note: { type: 'string' },
  },
  required: ['ok'],
}

// ---- プロンプト生成 ----
// planner: producer の item ではなく、社長承認済みの軽量PRD(proposal.md)を入力に技術計画を出す。
function plannerPrompt(item) {
  return [
    WORKDIR,
    'あなたは planner ロール（企画/PdM）。dev-flow ゲート[1] 計画を担当。コードは変更しない。',
    'Skill(dev-flow) の[1]と Skill(logic-architecture) と docs/CLAUDE.md を読む。',
    `社長が承認済みの提案（軽量PRD）を Read で開く: ${WORKTREE}/${item.proposalPath}`,
    `PM の申し送り ${WORKTREE}/docs/plans/${item.id}/pm.md があれば併せて読む。`,
    handoffLine,
    'この提案を実装可能な技術計画に落とす:',
    '- proposal の「成功条件・指標」を doneChecklist（ユーザー操作の言葉）に写す。',
    '- proposal の「提案(What)＋UI導線・置き場所」を尊重して approach を書く（置き場所を勝手に変えない）。',
    '- goalOneLine には提案の狙いを1行で。title には proposal のタイトルを入れる。',
    'causalChain は既存コードを Grep/Read して末端（売上/メタ進行/解放/実績等）まで追い、',
    'caps（CAP・重み・クランプ・既存ガード）を列挙し衝突しないことを確かめる（アンチパターン#1対策）。',
    '因果が最終結果に届かない/CAPと衝突するなら blocked:true と reason を返す。',
  ].filter(Boolean).join('\n')
}

function engineerPrompt(item, plan, prevVerify, attempt) {
  const base = [
    WORKDIR,
    'あなたは engineer ロール（実装）。dev-flow ゲート[2]。',
    'Skill(logic-architecture)（core純粋関数・rng/clock注入・Math.random/Date.now直呼び禁止）と',
    'Skill(testing-rules)（ロジックにはunitテスト必須・境界値）を守る。最小変更。計画にない機能を足さない。',
    `承認済み提案（背景・UI置き場所の正）: ${WORKTREE}/${item.proposalPath}（必要なら Read）。`,
    handoffLine,
    '技術計画:',
    JSON.stringify(plan, null, 2),
    'testPlan の unit テストを書き、この worktree 内で npm run build と npm run test:unit を自分で緑にしてから返す。コミットはしない。',
  ]
  if (prevVerify && prevVerify.verdict === 'fail') {
    base.push(
      `【これは再試行 #${attempt}】前回の検証が fail。以下の失敗を潰す修正だけを行う（推測で塗り替えない）:`,
      JSON.stringify({ failures: prevVerify.failures, checklistResults: prevVerify.checklistResults }, null, 2),
    )
  }
  return base.filter(Boolean).join('\n')
}

function qaPrompt(item, plan, impl) {
  return [
    WORKDIR,
    'あなたは qa ロール（検証）。dev-flow ゲート[3]を独立に全項目実行。コードは編集しない。落とすのが仕事。',
    'Skill(testing-rules) と Skill(playwright-verify) を読む。',
    `承認済み提案の成功条件は ${WORKTREE}/${item.proposalPath}（Read で確認）。`,
    'この worktree 内で 4点セット（npm run build / test:unit / test:ui / test:e2e）を全部回す（e2e省略禁止）。',
    `e2e と実機確認は必ずポート ${PORT} で行う。起動ログの \`Local: http://localhost:${PORT}/\` を実際に目視し、`,
    '別ポート（特に 5173＝メイン作業ツリー）のサーバーに繋いでいないことを確認して servedFromWorktree に入れる。',
    '（他ツリーのサーバーを掴むと、変更が入っていないのに緑になる。ここを外した検証は無効。）',
    'Playwright MCP(mcp__playwright__browser_*)で本物の入力を打ち、store直呼びショートカットは状態セットアップのみ。',
    '数値効果は before/after を実測。完成条件を1つずつ消し込む。計画の doneChecklist:',
    JSON.stringify(plan.doneChecklist, null, 2),
    '実装サマリ:',
    JSON.stringify(impl, null, 2),
    '4点のどれか赤／本物入力なし／別ポートのサーバーで確認／完成条件未消し込み → verdict:fail。failures には現物のログを入れる。',
  ].join('\n')
}

// 審査3体は別レンズを割当てて独立性を担保する（同一プロンプトだと出力が相関し多数決が1票化する）。
const REVIEW_LENSES = [
  '【因果レンズ】goalOneLine の効果が実コードで最終結果（売上/メタ進行等）に本当に届くかを最重点で疑う。' +
    'src/core を自分で Grep/Read し末端まで追い直し、CAP・重み・クランプに埋もれていないか（アンチパターン#1）を検める。',
  '【検証レンズ】QA が4点セットを全部回したか、Playwright で本物の入力を打ったか（store 直呼びで流れを見ただけ＝#2でないか）、' +
    'この worktree のサーバー（専用ポート）で確認したか（他ツリーを掴んだ偽グリーンでないか）、' +
    '完成条件を操作の言葉で消し込んだか（#5）を最重点で疑う。git diff とテスト中身を読み、必要なら npm run test:unit を再実行して裏を取る。',
  '【規律レンズ】対症療法の重ね塗り（#6）、最小変更を超えた余計な改変、logic-architecture 違反（core にランダム/時刻直呼び・UI混在）、' +
    '承認済み提案の UI 置き場所/狙いからの逸脱を最重点で疑う。',
]

function reviewerPrompt(item, plan, impl, verify, voter) {
  return [
    WORKDIR,
    `あなたは reviewer ロール（敵対的審査・${voter + 1}人目）。dev-flow ゲート[4]の番人。approveでなく欠陥発見で評価される。同僚に同調しない。`,
    'Skill(dev-flow) のアンチパターン集と Skill(game-design) を読む。主張を鵜呑みにせず、実コードで因果を自分で末端まで追い直す。',
    `承認済み提案（狙い・UI置き場所の正）: ${WORKTREE}/${item.proposalPath}（Read で確認）。実装が提案の置き場所/狙いから逸れていないかも見る。`,
    handoffLine,
    'あなたの担当レンズ（ここを最重点で疑う。他の欠陥に気づいたら併せて挙げてよい）:',
    REVIEW_LENSES[voter] || REVIEW_LENSES[0],
    '迷ったら reject に倒す（番人として偽陰性より見逃しを避ける）。',
    '対象:',
    JSON.stringify({ goalOneLine: plan.goalOneLine, doneChecklist: plan.doneChecklist }, null, 2),
    '実装と検証結果:',
    JSON.stringify({ impl, verify }, null, 2),
    'reject 時は reasons に具体的な file:line と再現を書く。',
  ].filter(Boolean).join('\n')
}

// PM が払い出した worktree が「実装を始められる状態か」だけを確かめる（ブランチは切らない＝worktree のブランチで作業する）。
function setupPrompt(ids) {
  return [
    WORKDIR,
    'あなたは統合準備担当。PM が払い出した build worktree が実装を始められる状態かを確認する。ソースコードは変更しない。',
    '手順:',
    `1. \`git -C ${WORKTREE} rev-parse --show-toplevel\` が ${WORKTREE} 自身を返すことを確認（実在する git 作業ツリーか）。違えば ok:false。`,
    `2. \`git -C ${WORKTREE} branch --show-current\` で現在ブランチを取得し branch に入れる（**ここで新しいブランチを切らない**）。`,
    '   main / master だった場合は ok:false（PM が build worktree を払い出せておらず、メイン作業ツリーで実装しかけている）。',
    `3. 対象 id の proposal が worktree 内にあるか確認: ${ids.map((id) => `docs/plans/${id}/proposal.md`).join(' , ')}`,
    '   あるものを proposalsFound、無いものを proposalsMissing に入れる。1件も無ければ ok:false（PM の取り込み漏れ）。',
    `4. \`test -d ${WORKTREE}/node_modules\` を確認。無ければ \`cd ${WORKTREE} && npm ci\` を実行してから nodeModules:true にする（数分かかってよい）。`,
    `5. \`git -C ${WORKTREE} status --porcelain\` で未コミットの tracked 変更があれば note に記す（勝手にコミット/破棄しない）。`,
    '注意: worktree 内には未追跡の *.png スクショが出ることがある。これらには一切触れない（add も clean もしない）。',
  ].join('\n')
}

// 審査通過タスクを「そのタスクの変更ファイル＋技術計画 plan.md」だけ個別コミットする。git add -A は禁止。
function commitItemPrompt(r) {
  const files = (r.impl && r.impl.changedFiles) || []
  return [
    WORKDIR,
    'あなたは統合担当。いま審査を通過した1タスクの変更「だけ」をコミットする。git と Write だけを触る。',
    `対象提案 id: ${r.item.id}`,
    '手順:',
    `1. 技術計画を ${WORKTREE}/docs/plans/${r.item.id}/plan.md に Write で書く（proposal.md と対で残す）。内容は下記 plan を人間が読める Markdown に整形:`,
    JSON.stringify(r.plan, null, 2),
    '2. このタスクで変更・追加されたコード（この範囲だけ add。"git add -A" は禁止＝未追跡スクショを巻き込むため）:',
    JSON.stringify(files, null, 2),
    `   と docs/plans/${r.item.id}/plan.md を \`git -C ${WORKTREE} add <paths>\`。存在しない/差分のないパスは飛ばす。`,
    `   さらに docs/plans/${r.item.id}/proposal.md 冒頭メタの「- **ステータス**: …」行を「- **ステータス**: 完了」に更新して add する（開発ループ通過の記録）。`,
    '3. 日本語で簡潔なコミットメッセージ。1行目は「' + (r.plan && r.plan.title ? r.plan.title : r.item.id) + '」。末尾に Co-Authored-By フッターを付ける規約に従う。',
    `4. \`git -C ${WORKTREE} commit\` を実行。add できる変更が無ければ ok:false と note（理由）を返す。成功なら ok:true と sha。`,
    '注意: 未追跡の *.png など、このタスク外のファイルは絶対に add しない。worktree の外のファイルは触らない。',
  ].join('\n')
}

// 審査を通らなかった（または検証failで打ち切った）タスクの変更を、PRに混ぜないよう安全に破棄する。
function discardItemPrompt(r) {
  const files = (r.impl && r.impl.changedFiles) || []
  return [
    WORKDIR,
    'あなたは後始末担当。審査不通過/検証failで打ち切った1タスクの変更を、後続タスクとPRに混ぜないよう破棄する。git だけを触る。',
    'このタスクが触ったファイル:',
    JSON.stringify(files, null, 2),
    '手順（この範囲だけ・慎重に）:',
    `1. 上記のうち tracked ファイルの変更を HEAD に戻す: 各パスに \`git -C ${WORKTREE} restore -- <path>\`。`,
    `2. このタスクが新規作成した untracked ファイル（\`git -C ${WORKTREE} status --porcelain\` で "??" かつ上記 files に含まれるもの）だけを個別に rm する。`,
    '3. "git clean" は使わない。上記 files 以外の未追跡ファイル（*.png スクショ等）には一切触れない。',
    `4. 破棄後 \`git -C ${WORKTREE} status\` で、このタスク由来の変更が消えたことを確認し ok:true を返す。`,
    '注意: 直前までに通過・コミット済みの他タスクのコミットは絶対に触らない（reset しない）。worktree の外も触らない。',
  ].join('\n')
}

function integratorPrompt(done, branch) {
  return [
    WORKDIR,
    'あなたは統合担当。審査通過タスクは既に個別コミット済み。あなたの仕事はこの build worktree のブランチを push し PR を作ることだけ。',
    'PR 作成は gh CLI を使う（mcp__github__ はこの環境に未接続なので使わない）。git と gh だけを触る。',
    `作業ブランチ: ${branch}（この build worktree のブランチ）。まず \`git -C ${WORKTREE} status\` と \`git -C ${WORKTREE} log --oneline -n 10\` で、通過タスクのコミットが載っていることを確認する。`,
    '手順:',
    `1. 統合後の最終ゲート: \`cd ${WORKTREE}\` してから \`npm run build\` と \`npm run test:unit\` を1回走らせ緑を確認（赤なら committed:false と理由を返し、push しない）。`,
    '2. `git status` で予期しない未コミット変更が無いか確認（通過タスクは既にコミット済みのはず。あれば notes に記録）。',
    `3. \`git -C ${WORKTREE} push -u origin ${branch}\`（ネットワーク失敗時のみ指数バックオフで最大4回リトライ）。`,
    `4. \`cd ${WORKTREE}\` した上で \`gh pr create --base main --head ${branch} --title <日本語タイトル> --body <本文>\` で PR を作成。`,
    '   同ブランチの PR が既にあれば作成はスキップし `gh pr view --json url -q .url` で URL を取得する。',
    '   本文は日本語で、各タスクについて「提案の狙い(goalOneLine)／完成条件／実装の変更ファイル／検証で実測した証拠／審査の可決票」を要約する。',
    `   末尾に「社長は dev server（http://localhost:${PORT}/）で実機チェックしてからマージ」の一文と、Claude Code の attribution フッターを付ける。`,
    '通過タスク:',
    JSON.stringify(done.map((d) => ({ id: d.item.id, title: d.plan && d.plan.title, goal: d.plan && d.plan.goalOneLine, changed: d.impl && d.impl.changedFiles, evidence: d.verify && d.verify.checklistResults, approve: d.approveCount, sha: d.commit && d.commit.sha })), null, 2),
  ].join('\n')
}

// ---- micro ループ（1提案＝企画→実装→検証→審査3体）----
async function microLoop(item) {
  const plan = await agent(plannerPrompt(item), { label: `企画:${item.id}`, phase: '開発ループ', schema: PLAN_SCHEMA, agentType: 'planner' })
  if (!plan || plan.blocked || plan.needsOwnerGo) {
    log(`⏭ ${item.id} は計画で停止（blocked/GO待ち）: ${plan && plan.reason ? plan.reason : ''}`)
    return { item, plan, passed: false, stoppedAt: 'plan' }
  }

  let impl = null
  let verify = null
  for (let attempt = 1; attempt <= MAX_IMPL_RETRY; attempt++) {
    impl = await agent(engineerPrompt(item, plan, verify, attempt), {
      label: `実装:${item.id}#${attempt}`, phase: '開発ループ', schema: IMPL_SCHEMA, agentType: 'engineer',
    })
    if (!impl || impl.blocked) {
      log(`⏭ ${item.id} は実装で停止: ${impl && impl.reason ? impl.reason : ''}`)
      return { item, plan, impl, passed: false, stoppedAt: 'impl' }
    }
    verify = await agent(qaPrompt(item, plan, impl), {
      label: `検証:${item.id}#${attempt}`, phase: '開発ループ', schema: VERIFY_SCHEMA, agentType: 'qa',
    })
    if (verify && verify.verdict === 'pass') break
    log(`🔁 ${item.id} 検証fail（試行${attempt}/${MAX_IMPL_RETRY}）→ 実装へ差し戻し`)
  }
  if (!verify || verify.verdict !== 'pass') {
    return { item, plan, impl, verify, passed: false, stoppedAt: 'verify' }
  }

  // 敵対的審査 3体多数決（独立並列）
  const votes = (await parallel([0, 1, 2].map((v) => () =>
    agent(reviewerPrompt(item, plan, impl, verify, v), { label: `審査:${item.id}.${v + 1}`, phase: '開発ループ', schema: REVIEW_SCHEMA, agentType: 'reviewer' }),
  ))).filter(Boolean)
  const approveCount = votes.filter((x) => x.verdict === 'approve').length
  const passed = approveCount >= 2
  log(`${passed ? '✅' : '❌'} ${item.id} 審査 approve ${approveCount}/3`)
  return { item, plan, impl, verify, votes, approveCount, passed }
}

// ================= 実行 =================
phase('準備')
if (!IDS.length) {
  log('承認済み提案 id が渡されていません（args.ids）。/dev-pm 経由で id を指定して起動してください。')
  return { done: [], failed: [], note: 'id 未指定' }
}
if (!WORKTREE) {
  log('build worktree のパスが渡されていません（args.worktree）。メイン作業ツリーで実装しないため中止します。/dev-pm から起動してください。')
  return { done: [], failed: [], note: 'worktree 未指定' }
}
log(`実装対象（承認済み）: ${IDS.join(' / ')}`)
log(`build worktree: ${WORKTREE}（dev server ポート ${PORT}）`)
const items = IDS.map((id) => ({ id, proposalPath: `docs/plans/${id}/proposal.md` }))

// PM が払い出した worktree が実装可能な状態かを確認（ブランチは切らない）
const setup = await agent(setupPrompt(IDS), { label: '準備:worktree確認', phase: '準備', schema: SETUP_SCHEMA, agentType: 'general-purpose' })
if (!setup || !setup.ok || !setup.branch) {
  log(`worktree の確認に失敗。安全のため中止します: ${setup && setup.note ? setup.note : ''}`)
  return { done: [], failed: [], worktree: WORKTREE, note: 'worktree 確認失敗', setup }
}
const branch = setup.branch
log(`作業ブランチ: ${branch}（worktree のブランチをそのまま使用）`)
if (setup.proposalsMissing && setup.proposalsMissing.length) {
  log(`⚠ proposal が worktree に無い id: ${setup.proposalsMissing.join(' / ')} → PM の取り込み漏れ`)
}

phase('開発ループ')
// 逐次実行（同じ worktree で engineer 同士が衝突し、per-item コミット隔離も破綻するため並列にしない）。
const results = []
for (let i = 0; i < items.length; i++) {
  const r = await microLoop(items[i])
  if (r.passed) {
    r.commit = await agent(commitItemPrompt(r), { label: `コミット:${r.item.id}`, phase: '開発ループ', schema: GIT_SCHEMA, agentType: 'general-purpose' })
    if (r.commit && r.commit.ok === false) {
      log(`⚠ ${r.item.id} は審査通過したがコミット失敗: ${r.commit.note || ''} → 破棄してPRから除外`)
      if (r.impl) await agent(discardItemPrompt(r), { label: `破棄:${r.item.id}`, phase: '開発ループ', schema: GIT_SCHEMA, agentType: 'general-purpose' })
      r.passed = false
      r.stoppedAt = 'commit'
    }
  } else if (r.impl) {
    await agent(discardItemPrompt(r), { label: `破棄:${r.item.id}`, phase: '開発ループ', schema: GIT_SCHEMA, agentType: 'general-purpose' })
  }
  results.push(r)
}
const done = results.filter((r) => r && r.passed)
const failed = results.filter((r) => r && !r.passed)

phase('統合')
let integ = null
if (done.length) {
  integ = await agent(integratorPrompt(done, branch), { label: '統合:push+PR', phase: '統合', schema: INTEG_SCHEMA, agentType: 'general-purpose' })
} else {
  log('審査通過タスクがゼロ。PR は作成しません。')
}

return {
  worktree: WORKTREE,
  port: PORT,
  branch,
  done: done.map((d) => ({ id: d.item.id, title: d.plan && d.plan.title, approve: d.approveCount, sha: d.commit && d.commit.sha })),
  failed: failed.map((f) => ({ id: f.item.id, stoppedAt: f.stoppedAt })),
  integ,
  // 統合後、PM（メインセッション）が worktree の dev server を起動したまま残し社長の実機チェックに供する。
  keepServerUp: done.length > 0,
  devServerUrl: done.length > 0 ? `http://localhost:${PORT}/` : '',
}
