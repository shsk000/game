export const meta = {
  name: 'dev-loop',
  description: '責任者→企画→実装→検証→審査の5ロールで開発をループし、PR作成まで自動化する（新テーマはGO待ちへ退避）',
  phases: [
    { title: '分析(責任者)' },
    { title: '開発ループ' },
    { title: '統合' },
  ],
}

// ---- パラメータ（/dev-loop count=3 focus=... branch=... parallel=false のように渡す）----
const COUNT = (args && Number(args.count)) || 3
const FOCUS = (args && args.focus) || ''
const ARG_BRANCH = (args && args.branch) || ''
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

// setup（作業ブランチ用意）と per-item の git 操作（commit/discard）の戻り
const SETUP_SCHEMA = {
  type: 'object',
  properties: {
    branch: { type: 'string' },
    created: { type: 'boolean' },
    note: { type: 'string' },
  },
  required: ['branch'],
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
function producerPrompt(focus, count) {
  return [
    'あなたは producer ロール（責任者/プロデューサー）。まず Skill(game-design) を憲章として読み、',
    'ロール・目的・最上位の目的をそこから採用する（再発明しない）。',
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

// 審査3体は同一プロンプトだと出力が相関し「独立多数決」が実質1票になる。
// 各体に別レンズを割当て、敵対性を分散させる（気づいた他の欠陥も併せて挙げてよい）。
const REVIEW_LENSES = [
  '【因果レンズ】goalOneLine の効果が実コードで最終結果（売上/メタ進行等）に本当に届くかを最重点で疑う。' +
    'src/core を自分で Grep/Read し末端まで追い直し、CAP・重み・クランプに埋もれていないか（アンチパターン#1）を検める。',
  '【検証レンズ】QA が4点セットを全部回したか、Playwright で本物の入力を打ったか（store 直呼びで流れを見ただけ＝#2でないか）、' +
    '完成条件を操作の言葉で消し込んだか（#5）を最重点で疑う。git diff とテスト中身を読み、必要なら npm run test:unit を再実行して裏を取る。',
  '【規律レンズ】対症療法の重ね塗り（#6）、最小変更を超えた余計な改変、logic-architecture 違反（core にランダム/時刻直呼び・UI混在）、' +
    'オーナーGO が要る新テーマ/コアループ改変の黙認混入（#4）を最重点で疑う。',
]

function reviewerPrompt(item, plan, impl, verify, voter) {
  return [
    `あなたは reviewer ロール（敵対的審査・${voter + 1}人目）。dev-flow ゲート[4]の番人。approveでなく欠陥発見で評価される。同僚に同調しない。`,
    'Skill(dev-flow) のアンチパターン集と Skill(game-design) を読む。主張を鵜呑みにせず、実コードで因果を自分で末端まで追い直す。',
    'あなたの担当レンズ（ここを最重点で疑う。他の欠陥に気づいたら併せて挙げてよい）:',
    REVIEW_LENSES[voter] || REVIEW_LENSES[0],
    '迷ったら reject に倒す（番人として偽陰性より見逃しを避ける）。',
    '対象:',
    JSON.stringify({ goalOneLine: plan.goalOneLine, doneConditions: item.doneConditions }, null, 2),
    '実装と検証結果:',
    JSON.stringify({ impl, verify }, null, 2),
    'reject 時は reasons に具体的な file:line と再現を書く。',
  ].join('\n')
}

// 起動時に作業ブランチを用意する（ハードコードのブランチに毎回上書きするのを防ぐ）。
// Workflow 台本自体は git を触れない（agent 経由でのみ実行）。
function setupPrompt(focus, argBranch) {
  const lines = [
    'あなたは統合準備担当。dev-loop の作業ブランチを用意する。git だけを触り、ソースコードは変更しない。',
    '手順:',
    '1. "git status" と "git branch --show-current" で現状確認。未コミットの tracked 変更があれば note に記す（勝手にコミット/破棄しない）。',
  ]
  if (argBranch) {
    lines.push(
      '2. 指定ブランチ「' + argBranch + '」を作業ブランチにする。存在すれば "git switch ' + argBranch + '"、無ければ "git switch -c ' + argBranch + '"。',
    )
  } else {
    lines.push(
      '2. 現在ブランチが main または master なら、新しい作業ブランチを切る:',
      '   ブランチ名は "dev-loop/" + ("git rev-parse --short HEAD" の値)。',
      focus ? ('   focus「' + focus + '」を安全な英数字スラッグ化して末尾に "-<slug>" を足す。') : '   focus 指定は無い。',
      '   同名ブランチが既に存在したら末尾に -2, -3 … を付けて一意化。"git switch -c <name>" で作成・移動する。',
      '   main/master 以外の feature ブランチ上なら、それをそのまま作業ブランチとして使う（新規作成しない）。',
    )
  }
  lines.push(
    '3. 最終的な作業ブランチ名を branch に、新規作成したかを created に入れて返す。',
    '注意: リポジトリ直下には未追跡の *.png スクショが多数ある。これらには一切触れない（add も clean もしない）。',
  )
  return lines.join('\n')
}

// 審査通過タスクを「そのタスクの変更ファイルだけ」個別コミットする。
// git add -A は未追跡スクショを巻き込むため禁止。
function commitItemPrompt(r) {
  const files = (r.impl && r.impl.changedFiles) || []
  return [
    'あなたは統合担当。いま審査を通過した1タスクの変更「だけ」をコミットする。git だけを触る。',
    'このタスクで変更・追加されたファイル（この範囲だけ add する。"git add -A" は禁止＝未追跡スクショを巻き込むため）:',
    JSON.stringify(files, null, 2),
    '手順:',
    '1. 上記ファイルのみ "git add <paths>"。存在しない/差分のないパスは飛ばす。',
    '2. 日本語で簡潔なコミットメッセージ。1行目は「' + (r.item.title || r.item.id) + '」。末尾に Co-Authored-By フッターを付ける規約に従う。',
    '3. "git commit" を実行。add できる変更が無ければ ok:false と note（理由）を返す。成功なら ok:true と sha。',
    '注意: 未追跡の *.png など、このタスク外のファイルは絶対に add しない。',
  ].join('\n')
}

// 審査を通らなかった（または検証failで打ち切った）タスクの変更を、PRに混ぜないよう安全に破棄する。
function discardItemPrompt(r) {
  const files = (r.impl && r.impl.changedFiles) || []
  return [
    'あなたは後始末担当。審査不通過/検証failで打ち切った1タスクの変更を、後続タスクとPRに混ぜないよう破棄する。git だけを触る。',
    'このタスクが触ったファイル:',
    JSON.stringify(files, null, 2),
    '手順（この範囲だけ・慎重に）:',
    '1. 上記のうち tracked ファイルの変更を HEAD に戻す: 各パスに "git restore -- <path>"（または "git checkout -- <path>"）。',
    '2. このタスクが新規作成した untracked ファイル（"git status --porcelain" で "??" かつ上記 files に含まれるもの）だけを個別に "rm" する。',
    '3. "git clean" は使わない。上記 files 以外の未追跡ファイル（リポジトリ直下の *.png スクショ等）には一切触れない。',
    '4. 破棄後 "git status" で、このタスク由来の変更が消えたことを確認し ok:true を返す。',
    '注意: 直前までに通過・コミット済みの他タスクのコミットは絶対に触らない（reset しない）。',
  ].join('\n')
}

function integratorPrompt(done, deferred, branch) {
  return [
    'あなたは統合担当。審査通過タスクは既に個別コミット済み。あなたの仕事はブランチを push し PR を作ること。',
    'PR 作成は gh CLI を使う（mcp__github__ はこの環境に未接続なので使わない）。git と gh だけを触る。',
    '作業ブランチ: ' + branch + '。まず "git status" と "git log --oneline -n 10" で、通過タスクのコミットが載っていることを確認する。',
    '手順:',
    '1. 統合後の最終ゲート: "npm run build" と "npm run test:unit" を1回走らせ緑を確認（赤なら committed:false と理由を返し、push しない）。',
    '2. "git status" で予期しない未コミット変更が無いか確認（通過タスクは既にコミット済みのはず。あれば notes に記録）。',
    '3. "git push -u origin ' + branch + '"（ネットワーク失敗時のみ指数バックオフで最大4回リトライ）。',
    '4. "gh pr create --base main --head ' + branch + ' --title <日本語タイトル> --body <本文>" で PR を作成。',
    '   同ブランチの PR が既にあれば作成はスキップし "gh pr view --json url -q .url" で URL を取得する。',
    '   本文は日本語で、各タスクについて「責任者の目的／企画の完成条件／実装の変更ファイル／検証で実測した証拠／審査の可決票」を要約する。',
    '   末尾に GO待ち退避項目を「オーナー確認待ち」として列挙し、Claude Code の attribution フッターを付ける。',
    '通過タスク:',
    JSON.stringify(done.map((d) => ({ id: d.item.id, title: d.item.title, goal: d.plan.goalOneLine, changed: d.impl && d.impl.changedFiles, evidence: d.verify && d.verify.checklistResults, approve: d.approveCount, sha: d.commit && d.commit.sha })), null, 2),
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

// 作業ブランチを用意（ハードコードのブランチに毎回上書きしない）。
const setup = await agent(setupPrompt(FOCUS, ARG_BRANCH), { label: '準備:作業ブランチ', schema: SETUP_SCHEMA, agentType: 'general-purpose' })
const branch = setup && setup.branch
if (!branch) {
  log('作業ブランチの用意に失敗。安全のため中止します。')
  return { producer, done: [], deferred, note: 'ブランチ準備失敗' }
}
log(`作業ブランチ: ${branch}${setup.created ? '（新規作成）' : ''}`)

phase('開発ループ')
// parallel は共有作業ツリーで engineer 同士が衝突し、per-item のコミット隔離も成立しないため未対応。
// worktree 隔離（node_modules 分離含む）を実装するまでは逐次で回す。
if (PARALLEL) log('⚠ parallel=true は現状未実装（共有ツリーで競合し隔離が壊れる）。逐次実行にフォールバックします。')
const results = []
for (let i = 0; i < items.length; i++) {
  const r = await microLoop(items[i])
  if (r.passed) {
    // 通過タスクは即コミット＝以降このタスクの diff は tracked から消え、後続の QA/審査の git diff がクリーンになる。
    r.commit = await agent(commitItemPrompt(r), { label: `コミット:${r.item.id}`, phase: '開発ループ', schema: GIT_SCHEMA, agentType: 'general-purpose' })
    if (r.commit && r.commit.ok === false) {
      log(`⚠ ${r.item.id} は審査通過したがコミット失敗: ${r.commit.note || ''} → 破棄してPRから除外`)
      if (r.impl) await agent(discardItemPrompt(r), { label: `破棄:${r.item.id}`, phase: '開発ループ', schema: GIT_SCHEMA, agentType: 'general-purpose' })
      r.passed = false
      r.stoppedAt = 'commit'
    }
  } else if (r.impl) {
    // 不通過タスクの作業ツリー変更は、後続タスク・PRに混ざらないよう破棄する（安全ガードの実効化）。
    await agent(discardItemPrompt(r), { label: `破棄:${r.item.id}`, phase: '開発ループ', schema: GIT_SCHEMA, agentType: 'general-purpose' })
  }
  results.push(r)
}
const done = results.filter((r) => r && r.passed)
const failed = results.filter((r) => r && !r.passed)

phase('統合')
let integ = null
if (done.length) {
  integ = await agent(integratorPrompt(done, deferred, branch), { label: '統合:push+PR', phase: '統合', schema: INTEG_SCHEMA, agentType: 'general-purpose' })
} else {
  log('審査通過タスクがゼロ。PR は作成しません。')
}

return {
  analysis: producer && producer.analysis,
  branch,
  done: done.map((d) => ({ id: d.item.id, title: d.item.title, approve: d.approveCount, sha: d.commit && d.commit.sha })),
  failed: failed.map((f) => ({ id: f.item.id, title: f.item.title, stoppedAt: f.stoppedAt })),
  deferred: deferred.map((d) => ({ title: d.title, rationale: d.rationale })),
  integ,
}
