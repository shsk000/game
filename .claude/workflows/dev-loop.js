export const meta = {
  name: 'dev-loop',
  description: '責任者→企画→実装→検証→審査の5ロールで開発をループし、PR作成まで自動化する（新テーマはGO待ちへ退避）',
  phases: [
    { title: '分析(責任者)' },
    { title: '開発ループ' },
    { title: '統合' },
  ],
}

// ---- パラメータ（/dev-loop count=3 focus=... parallel=false のように渡す）----
const COUNT = (args && Number(args.count)) || 3
const FOCUS = (args && args.focus) || ''
const PARALLEL = !!(args && args.parallel)
const MAX_IMPL_RETRY = 3

// ---- スキーマ（ロール間の型付き受け渡し）----
const PRODUCER_SCHEMA = {
  type: 'object',
  properties: {
    analysis: { type: 'string' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          rationale: { type: 'string' },
          purposeLink: { type: 'string' },
          priority: { type: 'string', enum: ['P0', 'P1', 'P2', 'P3'] },
          targetFiles: { type: 'array', items: { type: 'string' } },
          doneConditions: { type: 'array', items: { type: 'string' } },
          needsOwnerGo: { type: 'boolean' },
        },
        required: ['id', 'title', 'rationale', 'priority', 'doneConditions', 'needsOwnerGo'],
      },
    },
  },
  required: ['analysis', 'items'],
}

const PLAN_SCHEMA = {
  type: 'object',
  properties: {
    blocked: { type: 'boolean' },
    needsOwnerGo: { type: 'boolean' },
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

// ---- プロンプト生成 ----
function producerPrompt(focus, count) {
  return [
    'あなたは producer ロール（責任者/プロデューサー）。まず Skill(game-design) を憲章として読み、',
    'ロール・目的・北極星をそこから採用する（再発明しない）。',
    'docs/roadmap.md・最大版の docs/vNN/spec.md と tasks.md・docs/v08/gaps.md・実コード(src/core, src/data)を分析し、',
    '目的に対する差分を優先度付けして返す。',
    focus ? `分析の焦点: 「${focus}」を最優先の観点にする。` : '',
    `自動着手させてよい項目（needsOwnerGo:false）を優先度順に最大 ${count} 件、`,
    '新テーマ/新ジャンル・コアループ改変・大投資・方針が割れる論点は needsOwnerGo:true にして論点を rationale へ。',
    '各 item に doneConditions（ユーザー操作の言葉での完成条件）を必ず付ける。根拠は file:line で。',
    'コードは変更しない。',
  ].filter(Boolean).join('\n')
}

function plannerPrompt(item) {
  return [
    'あなたは planner ロール（企画/PdM）。dev-flow ゲート[1] 計画を担当。コードは変更しない。',
    'Skill(dev-flow) の[1]と Skill(logic-architecture) と docs/CLAUDE.md を読む。',
    '次の work item を実装可能な計画に落とす:',
    JSON.stringify(item, null, 2),
    'causalChain は既存コードを Grep/Read して末端まで追い、caps（CAP・重み・クランプ・既存ガード）を列挙し',
    '衝突しないことを確かめる。doneChecklist はユーザー操作の言葉で。',
    '因果が最終結果に届かない/CAPと衝突するなら blocked:true と reason を返す。',
    '新テーマ相当なら needsOwnerGo:true。',
  ].join('\n')
}

function engineerPrompt(item, plan, prevVerify, attempt) {
  const base = [
    'あなたは engineer ロール（実装）。dev-flow ゲート[2]。',
    'Skill(logic-architecture)（core純粋関数・rng/clock注入・Math.random/Date.now直呼び禁止）と',
    'Skill(testing-rules)（ロジックにはunitテスト必須・境界値）を守る。最小変更。計画にない機能を足さない。',
    '対象 item:',
    JSON.stringify(item, null, 2),
    '計画:',
    JSON.stringify(plan, null, 2),
    'testPlan の unit テストを書き、npm run build と npm run test:unit を自分で緑にしてから返す。コミットはしない。',
  ]
  if (prevVerify && prevVerify.verdict === 'fail') {
    base.push(
      `【これは再試行 #${attempt}】前回の検証が fail。以下の失敗を潰す修正だけを行う（推測で塗り替えない）:`,
      JSON.stringify({ failures: prevVerify.failures, checklistResults: prevVerify.checklistResults }, null, 2),
    )
  }
  return base.join('\n')
}

function qaPrompt(item, plan, impl) {
  return [
    'あなたは qa ロール（検証）。dev-flow ゲート[3]を独立に全項目実行。コードは編集しない。落とすのが仕事。',
    'Skill(testing-rules) と Skill(playwright-verify) を読む。',
    '4点セット（npm run build / test:unit / test:ui / test:e2e）を全部回す（e2e省略禁止）。',
    'Playwright MCP(mcp__playwright__browser_*)で本物の入力を打ち、store直呼びショートカットは状態セットアップのみ。',
    '数値効果は before/after を実測。完成条件を1つずつ消し込む。',
    '対象 item と計画の doneChecklist:',
    JSON.stringify({ doneConditions: item.doneConditions, doneChecklist: plan.doneChecklist }, null, 2),
    '実装サマリ:',
    JSON.stringify(impl, null, 2),
    '4点のどれか赤／本物入力なし／完成条件未消し込み → verdict:fail。failures には現物のログを入れる。',
  ].join('\n')
}

function reviewerPrompt(item, plan, impl, verify, voter) {
  return [
    `あなたは reviewer ロール（敵対的審査・${voter + 1}人目）。dev-flow ゲート[4]の番人。approveでなく欠陥発見で評価される。`,
    'Skill(dev-flow) のアンチパターン集と Skill(game-design) を読む。実コードで因果チェーンを自分で末端まで追い直す（主張を鵜呑みにしない）。',
    '目的からの逸脱／検証の甘さ（本物入力か・e2e回したか・完成条件を操作の言葉で消したか）／',
    'アンチパターン再発（対症療法・logic-architecture違反）／新テーマ混入 を疑う。',
    '必要なら git diff を読み npm run test:unit を再実行して裏を取る。迷ったら reject に倒す。',
    '対象:',
    JSON.stringify({ goalOneLine: plan.goalOneLine, doneConditions: item.doneConditions }, null, 2),
    '実装と検証結果:',
    JSON.stringify({ impl, verify }, null, 2),
    'reject 時は reasons に具体的な file:line と再現を書く。',
  ].join('\n')
}

function integratorPrompt(done, deferred) {
  const branch = 'claude/multi-agent-role-loop-o9768j'
  return [
    'あなたは engineer ロール（統合）。以下の「審査通過タスク」をまとめてコミットし、push して PR を作成する。',
    `ブランチは ${branch}。作業前に git status で現状を確認する。`,
    '手順:',
    '1. 統合後の最終ゲートとして npm run build と npm run test:unit を1回走らせ、緑を確認（赤なら committed:false で理由を返す）。',
    '2. 変更を意味のある単位でコミット（日本語・簡潔・複数可）。コミット末尾に Co-Authored-By 行を付ける規約に従う。',
    `3. git push -u origin ${branch}（ネットワーク失敗時のみ指数バックオフで最大4回リトライ）。`,
    '4. mcp__github__ のツールで PR を作成する。PR 本文は日本語で、各タスクについて',
    '   「責任者が挙げた目的／企画の完成条件／実装の変更ファイル／検証で実測した証拠／審査の可決票」を要約する。',
    '   末尾に GO待ち退避項目を「オーナー確認待ち」として列挙し、Claude Code の attribution フッターを付ける。',
    '通過タスク:',
    JSON.stringify(done.map((d) => ({ id: d.item.id, title: d.item.title, goal: d.plan.goalOneLine, changed: d.impl && d.impl.changedFiles, evidence: d.verify && d.verify.checklistResults, approve: d.approveCount })), null, 2),
    'GO待ち退避項目:',
    JSON.stringify(deferred.map((x) => ({ title: x.title, rationale: x.rationale })), null, 2),
  ].join('\n')
}

// ---- micro ループ（1タスク＝5ロール＋審査3体）----
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
phase('分析(責任者)')
const producer = await agent(producerPrompt(FOCUS, COUNT), { label: '責任者:分析', schema: PRODUCER_SCHEMA, agentType: 'producer' })
const allItems = (producer && producer.items) || []
const deferred = allItems.filter((it) => it.needsOwnerGo)
const items = allItems.filter((it) => !it.needsOwnerGo).slice(0, COUNT)
if (deferred.length) log(`⏸ オーナーGO待ちに退避（自動着手しない）: ${deferred.map((d) => d.title).join(' / ')}`)
if (!items.length) {
  log('自動着手できる項目がありません（すべてGO待ち、または差分なし）。')
  return { producer, done: [], deferred, note: '着手項目なし' }
}
log(`着手: ${items.map((i) => `${i.id}:${i.title}`).join(' / ')}`)

phase('開発ループ')
let results
if (PARALLEL) {
  results = (await parallel(items.map((it) => () => microLoop(it)))).filter(Boolean)
} else {
  results = []
  for (let i = 0; i < items.length; i++) {
    results.push(await microLoop(items[i]))
  }
}
const done = results.filter((r) => r && r.passed)
const failed = results.filter((r) => r && !r.passed)

phase('統合')
let integ = null
if (done.length) {
  integ = await agent(integratorPrompt(done, deferred), { label: '統合:commit+push+PR', phase: '統合', schema: INTEG_SCHEMA, agentType: 'engineer' })
} else {
  log('審査通過タスクがゼロ。PR は作成しません。')
}

return {
  analysis: producer && producer.analysis,
  done: done.map((d) => ({ id: d.item.id, title: d.item.title, approve: d.approveCount })),
  failed: failed.map((f) => ({ id: f.item.id, title: f.item.title, stoppedAt: f.stoppedAt })),
  deferred: deferred.map((d) => ({ title: d.title, rationale: d.rationale })),
  integ,
}
