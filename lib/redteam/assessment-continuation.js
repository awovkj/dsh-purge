/** Awaited host turn boundary for this store's assessments. No target traffic. */
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { assessmentRun } from './awa-integration.js'
import { readNativeContext } from './native-assessment.js'
import { assessmentContinuationOf, campaignProgressOf, assessmentNextStep } from './assessment-guidance.js'
import { assessmentPreferencesOf } from './settings.js'
import { sessionPolicyOf } from './session-policy.js'
import { createFailureAttribution } from './failure-attribution.js'

export const TURN_STOPPING_EVENT = 'agent/turn-stopping'
const SOURCE = 'dsh-purge-assessment-continuation'
const MAX_AGENTS = 128
const MAX_STALLED_NOTICES = 3
const MAX_HISTORY = 2048
const PAGE_SIZE = 3
const MAX_PAGE_READS = 2
const AUDIT_TIMEOUT_MS = 20000
const IDS = ['operation_id', 'obligation_id', 'evidence_id', 'finding_id', 'decision_id', 'proof_decision_id', 'candidate_id', 'actor_id', 'baseline_actor_id',
  'page_visit_id', 'run_id', 'checklist_id', 'session_id', 'resource_id', 'hypothesis_id', 'recipe_id', 'review_id', 'campaign_id', 'import_id']
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,199}$/
const TARGET_ACTIONS = new Set(['http.capture', 'browser.visit', 'identity.verify', 'scenario.run',
  'tool.sqlmap', 'tool.yakit_replay', 'tool.tscanplus_request', 'test.run', 'test.run_browser',
  'test.run_scenario', 'test.run_external'])
const OFFLINE_ACTIONS = new Set(['assessment.prepare', 'assessment.evaluate', 'assessment.batch', 'evidence.inspect', 'evidence.read', 'evidence.headers', 'surface.from_evidence', 'surface.from_document',
  'finding.record', 'finding.bind', 'candidate.inspect', 'candidate.link', 'candidate.reopen',
  'surface.inspect', 'surface.register', 'surface.batch', 'surface.declare_consumer',
  'identity.actor', 'identity.session', 'identity.session_from_evidence', 'identity.resource', 'page.adopt', 'page.mark',
  'run.inspect', 'run.recover', 'test.inspect', 'review.evidence', 'review.finding', 'review.bind',
  'recon.snapshot', 'recon.import', 'recon.hypotheses', 'integration.import', 'integration.export'])
const ARM_ACTIONS = new Set([...TARGET_ACTIONS, ...OFFLINE_ACTIONS, 'plan.build', 'plan.next', 'plan.review',
  'campaign.start', 'campaign.next'])
const TASK_ACTIONS = new Set([...OFFLINE_ACTIONS, ...TARGET_ACTIONS, 'plan.review', 'plan.disposition', 'action.help'])
const HYPOTHESIS_STATES = ['ready', 'unplanned', 'needs_consumer', 'running', 'inconclusive', 'blocked']
const canonical = value => JSON.stringify(value, (_key, node) => node && typeof node === 'object' && !Array.isArray(node)
  ? Object.fromEntries(Object.keys(node).sort().map(key => [key, node[key]])) : node)
const digest = value => createHash('sha256').update(canonical(value)).digest('hex')
const signalLike = signal => signal && typeof signal.aborted === 'boolean'
  && typeof signal.addEventListener === 'function' && typeof signal.removeEventListener === 'function'
const runtimeAgent = agent => agent && typeof agent.id === 'string' && agent.id
  && agent.session && typeof agent.steer === 'function' && Array.isArray(agent.inbox?.nextStep)
  && Array.isArray(agent.inbox?.nextTurn)

function messageFactoryOf(ctx) {
  const anchors = []
  try { const anchor = ctx.get?.('profileContext')?.installAnchor; if (anchor) anchors.push(anchor) } catch { /* optional service */ }
  if (ctx.baseUrl) anchors.push(ctx.baseUrl)
  anchors.push(import.meta.url)
  for (const anchor of anchors) {
    try {
      const factory = createRequire(anchor)('@deepseek-ai/dsh-llm').createUserMessage
      if (typeof factory === 'function') return factory
    } catch { /* Only the current profile and this installation are considered. */ }
  }
  return null
}

function boundedReferences(input = {}, { pagination = true } = {}) {
  const refs = {}
  for (const key of IDS) if (ID_PATTERN.test(input[key] || '')) refs[key] = input[key]
  for (const key of ['input_location', 'input_selector', 'schema_branch']) {
    if (typeof input[key] === 'string' && input[key].length <= 200) refs[key] = input[key]
  }
  if (Array.isArray(input.evidence_ids) && input.evidence_ids.length <= 25
    && input.evidence_ids.every(id => ID_PATTERN.test(id))) refs.evidence_ids = [...input.evidence_ids]
  if (pagination) for (const key of ['offset', 'limit']) {
    if (Number.isSafeInteger(input[key]) && input[key] >= 0) refs[key] = input[key]
  }
  return refs
}

function invocationReferences(action, input) {
  const refs = boundedReferences(input, { pagination: false })
  if (refs.evidence_ids) refs.evidence_ids = [...new Set(refs.evidence_ids)].sort()
  if (action === 'action.help' && typeof input.name === 'string' && /^[a-z][a-z0-9_.]{0,95}$/.test(input.name)) refs.name = input.name
  return refs
}

function taskMaterial(row, input) {
  const material = { ...boundedReferences(row, { pagination: false }), ...boundedReferences(input, { pagination: false }) }
  for (const key of ['source_signature', 'operation_signature', 'input_signature', 'scope_epoch', 'resource_signature', 'session_generation', 'hypothesis_family']) {
    const value = row[key] ?? input[key]
    if (typeof value === 'string' && value.length <= 200 || Number.isSafeInteger(value)) material[key] = value
  }
  for (const key of ['missing_prerequisites', 'missing_context', 'control_candidate_evidence_ids']) {
    const values = row[key] ?? input[key] ?? []
    if (Array.isArray(values)) material[key] = [...new Set(values
      .filter(value => typeof value === 'string' && value.length <= 200
        && value !== 'offline_obligation_blocker_reconciliation'))].slice(0, 32).sort()
  }
  if (material.evidence_ids) material.evidence_ids = [...new Set(material.evidence_ids)].sort()
  // Include only concrete browser prerequisites, never administrative attempts
  // or another obligation's progress/checkpoint text.
  if (row.browser_testing && !row.blocker_reconciliation_required) {
    for (const key of ['requirement', 'existing_visit_id', 'consumer_locator']) {
      const value = row.browser_testing[key]
      if (typeof value === 'string' && value.length <= 200) material['browser_' + key] = value
    }
  }
  return material
}

function taskRecord(row, action, input, identity) {
  if (!ID_PATTERN.test(identity || '')) return null
  const material = taskMaterial(row, input)
  const attemptKey = digest([identity, action, material])
  return { action, input, offline_only: true, identity, references: boundedReferences(row),
    prerequisites: material.missing_prerequisites || material.missing_context || [], key: attemptKey, attemptKey }
}

/** Do not expose input templates with request bytes, credential values or guessed assertions. */
function taskOf(row, offlineOnly) {
  if (!row || typeof row !== 'object' || row.render_actionable === false) return null
  if (row.status === 'blocked' && !row.blocker_reconciliation_required) return null
  let action = row.suggested_action || row.action
  let input = row.input_template
  if ((!action || ['plan.next', 'plan.audit'].includes(action)) && ID_PATTERN.test(row.obligation_id || '')) {
    action = 'assessment.prepare'; input = { obligation_id: row.obligation_id, limit: 1 }
  }
  if (action === 'evidence.inspect' && ID_PATTERN.test(row.obligation_id || '')) {
    // An unassessed observation needs control/oracle preparation. Repeating
    // metadata inspection alone never assesses its security obligation.
    action = 'assessment.prepare'; input = { obligation_id: row.obligation_id, limit: 1 }
  }
  if (!TASK_ACTIONS.has(action) || offlineOnly && TARGET_ACTIONS.has(action)) return null
  // The guard hands execution back through current local preparation. It never
  // manufactures an HTTP request from a redacted locator or result template.
  if (TARGET_ACTIONS.has(action)) {
    if (row.execution_blocked || row.missing_prerequisites?.length || !ID_PATTERN.test(row.operation_id || '')) return null
    action = 'assessment.prepare'; input = { operation_id: row.operation_id, limit: 1 }
  }
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    const field = { 'evidence.inspect': 'evidence_id', 'candidate.inspect': 'candidate_id',
      'surface.inspect': 'operation_id', 'page.adopt': 'page_visit_id', 'run.inspect': 'run_id' }[action]
    const id = row[field] || (field === 'evidence_id' ? row.evidence_ids?.[0] : null)
    if (!field || !ID_PATTERN.test(id || '')) return null
    input = { [field]: id }
  }
  const safeInput = boundedReferences(input)
  if (Number.isSafeInteger(input.limit) && input.limit >= 1 && input.limit <= PAGE_SIZE) safeInput.limit = input.limit
  // Typed oracle values and review/disposition assertions must be inspected in
  // the engine's current help/detail, never copied into a host-authored notice.
  if (['assessment.evaluate', 'assessment.batch', 'finding.record', 'finding.bind', 'plan.review', 'plan.disposition'].includes(action)) {
    const refs = { ...boundedReferences(row), ...safeInput }
    const target = ['obligation_id', 'finding_id', 'evidence_id', 'operation_id'].find(key => refs[key])
    if (!target && ID_PATTERN.test(refs.checklist_id || '')) {
      return taskRecord(row, 'action.help', { name: action }, refs.checklist_id)
    }
    if (!target) return null
    action = 'assessment.prepare'; input = { [target]: refs[target], limit: 1 }
  } else input = safeInput
  if (!Object.keys(input).some(key => IDS.includes(key))) return null
  const identity = row.obligation_id || row.id || Object.values(boundedReferences(input))[0]
  return taskRecord(row, action, input, identity)
}

export function createAssessmentContinuation(ctx, store, { signal: ownerSignal, createMessage = messageFactoryOf(ctx),
  runAssessment = assessmentRun, readContext = readNativeContext } = {}) {
  const lifetime = new AbortController()
  const states = new Map()
  const tickets = new WeakMap()
  const failureAttribution = createFailureAttribution()
  const disposers = []
  let registered = false
  let disposed = false
  let reason = 'not_attached'
  const metrics = { steers: 0, audit_failures: 0, stalled: 0, blocked: 0, cancelled: 0,
    material_captures: 0, identity_verifications: 0, security_control_runs: 0, repeated_task_failures: 0 }

  function remove(agent) {
    const state = states.get(agent)
    if (!state) return
    state.audit?.abort()
    state.signal.removeEventListener('abort', state.onAbort)
    states.delete(agent)
  }

  function enabled() { return !disposed && !lifetime.signal.aborted && !ownerSignal?.aborted && assessmentPreferencesOf(store.root).continuationGuard }
  function retain(state, collection, key, value) {
    if (collection.has(key)) return false
    if (collection.size >= MAX_HISTORY) { state.historyFull = true; return false }
    if (collection instanceof Map) collection.set(key, value)
    else collection.add(key)
    return true
  }
  function usable(agent, state, signal = state?.signal, turn = state?.turn) {
    if (!enabled() || !registered || !runtimeAgent(agent) || agent.status !== 'running'
      || !state || states.get(agent) !== state || state.signal !== signal || state.turn !== turn
      || state.session !== agent.session || state.agentId !== agent.id || state.cancelled || signal?.aborted) return false
    if (state.engagement) {
      try { if (sessionPolicyOf(store, { agent })?.engagement_id !== state.engagement) return false } catch { return false }
    }
    return true
  }
  function pendingInput(agent, state) {
    return [...agent.inbox.nextStep, ...agent.inbox.nextTurn].some(message => message?.role === 'user'
      && (message.source?.kind === 'user' || state.steeringIds.has(message.id)))
  }

  async function preStep(payload, next) {
    let decision
    try { decision = await next() } catch (error) { remove(payload?.agent); throw error }
    const agent = payload?.agent
    if (!enabled() || !registered || !runtimeAgent(agent) || agent.status !== 'running'
      || !signalLike(payload?.signal) || payload.signal.aborted || !Number.isSafeInteger(payload.turn)
      || payload.turn < 1 || decision?.kind !== 'enter' || !Array.isArray(decision.messages)) {
      remove(agent); return decision
    }
    const userId = decision.messages.filter(message => message?.role === 'user'
      && message.source?.kind === 'user' && typeof message.id === 'string').at(-1)?.id
    let state = states.get(agent)
    if (!state || state.turn !== payload.turn || state.signal !== payload.signal || state.session !== agent.session
      || state.agentId !== agent.id || userId && userId !== state.userId) {
      remove(agent)
      if (states.size >= MAX_AGENTS) remove(states.keys().next().value)
      state = { agentId: agent.id, session: agent.session, turn: payload.turn, signal: payload.signal, userId,
        cancelled: false, engagement: null, trafficArmed: false, activity: new Set(), activityVersion: 0,
        progressKey: null, notices: 0, lastActivity: -1, materialActivity: new Set(), materialVersion: 0, noticeMaterialVersion: -1,
        issuedTasks: new Map(), failedTasks: new Set(), historyFull: false,
        failureAttribution: createFailureAttribution(),
        queueOffset: 0, reviewOffset: 0, hypothesisState: 0, checkpointed: new Set(), steeringIds: new Set(), audit: null, recoveryIssued: false }
      state.onAbort = () => { state.cancelled = true; state.audit?.abort(); metrics.cancelled++ }
      state.signal.addEventListener('abort', state.onAbort, { once: true })
      states.set(agent, state)
    }
    for (const message of decision.messages) state.steeringIds.delete(message?.id)
    return decision
  }

  /** Receipts originate in real facade execution, never in result/source_meta. */
  function observe(event) {
    const invocation = event?.invocation
    if (!invocation || !enabled() || !registered) return
    const exec = invocation.execution, agent = exec?.agent, state = states.get(agent)
    if (event.phase === 'start') {
      if (!usable(agent, state) || !signalLike(exec?.signal) || exec.signal.aborted
        || !signalLike(invocation.signal) || invocation.signal.aborted
        || !(ARM_ACTIONS.has(invocation.action) || state.engagement && TASK_ACTIONS.has(invocation.action))) return
      let policy
      try { policy = sessionPolicyOf(store, exec) } catch { return }
      if (policy?.engagement_id !== invocation.engagement) return
      if (state.engagement && state.engagement !== invocation.engagement) return
      const refs = boundedReferences(invocation.input)
      const entities = invocationReferences(invocation.action, invocation.input)
      const attempts = [...state.issuedTasks.values()].filter(task => task.action === invocation.action
        && Object.entries(invocationReferences(task.action, task.input)).every(([key, value]) => canonical(entities[key]) === canonical(value)))
      tickets.set(invocation, { state, agent, refs, attempts })
      return
    }
    const ticket = tickets.get(invocation)
    tickets.delete(invocation)
    if (!ticket || !usable(ticket.agent, ticket.state) || invocation.execution.signal.aborted || invocation.signal.aborted) return
    const succeeded = event.phase === 'success' && event.ok === true
    const uncertain = event.dispatch_uncertain === true
    if (!succeeded && !uncertain && !ticket.state.engagement) return
    const current = ticket.state
    failureAttribution.observe(event.attribution)
    current.failureAttribution.observe(event.attribution)
    current.engagement = invocation.engagement
    if ((succeeded || uncertain) && TARGET_ACTIONS.has(invocation.action)) current.trafficArmed = true
    const activity = digest([invocation.action, ticket.refs, succeeded ? 'success' : uncertain ? 'uncertain' : 'failed'])
    if ((OFFLINE_ACTIONS.has(invocation.action) || TARGET_ACTIONS.has(invocation.action))
      && retain(current, current.activity, activity)) {
      current.activityVersion++
      if (succeeded) current.recoveryIssued = false
    }
    if (succeeded && /^[a-f0-9]{64}$/.test(event.material_key || '')
      && retain(current, current.materialActivity, event.material_key)) {
      current.materialVersion++
      if (invocation.action === 'http.capture') metrics.material_captures++
      else if (invocation.action === 'identity.verify') metrics.identity_verifications++
      else if (['test.run', 'test.run_browser', 'test.run_scenario', 'test.run_external', 'scenario.run', 'assessment.evaluate', 'assessment.batch'].includes(invocation.action)) metrics.security_control_runs++
    }
    if (!succeeded) for (const task of ticket.attempts) retain(current, current.failedTasks, task.attemptKey)
  }

  async function checkpoint(state, context, signal, key) {
    if (state.checkpointed.has(key)) return
    if (!retain(state, state.checkpointed, key)) return
    const action = context.model === 'v2' ? 'campaign.checkpoint' : 'plan.checkpoint'
    try { await runAssessment(store, state.engagement, action, {
      ...(context.model === 'v2' ? { campaign_id: context.campaign_id } : {}),
      label: 'Host boundary: unfinished work retained; no target replay or completion claim' }, { signal }) }
    catch { /* An uncertain checkpoint is not retried or treated as finalization. */ }
  }

  function currentCursor(value, previous) {
    return Number.isSafeInteger(value) && value > previous ? value : 0
  }
  async function currentTasks(agent, state, context, signal, current) {
    const tasks = [], deferred = []
    if (context.model === 'v2') {
      for (let page = 0; page < MAX_PAGE_READS; page++) {
        const result = await runAssessment(store, state.engagement, 'recon.hypotheses',
          { status: HYPOTHESIS_STATES[state.hypothesisState], offset: state.queueOffset, limit: PAGE_SIZE }, { signal })
        signal.throwIfAborted()
        if (!usable(agent, state) || pendingInput(agent, state)) return { tasks: [], deferred }
        for (const row of result.data?.items || []) {
          if (!ID_PATTERN.test(row.id || '')) continue
          let action = 'action.help', input = { name: 'review.disposition' }
          if (['ready', 'unplanned'].includes(row.status)) {
            action = 'campaign.next'; input = { campaign_id: context.campaign_id, limit: PAGE_SIZE }
          } else if (row.status === 'needs_consumer') {
            input = { name: 'surface.declare_consumer' }
          } else if (ID_PATTERN.test(row.run_id || '') || ID_PATTERN.test(row.review_id || '')) {
            action = 'review.evidence'; input = boundedReferences({ run_id: row.run_id, review_id: row.review_id })
          }
          const task = taskRecord({ ...row, hypothesis_id: row.id }, action, input, row.id)
          if (state.failedTasks.has(task.attemptKey)) {
            metrics.repeated_task_failures++
            deferred.push({ id: task.identity, action, reason: 'same_material_attempt_failed' }); continue
          }
          if (!state.issuedTasks.has(task.key)) tasks.push(task)
        }
        state.queueOffset = currentCursor(result.data?.next_offset, state.queueOffset)
        if (!state.queueOffset) state.hypothesisState = (state.hypothesisState + 1) % HYPOTHESIS_STATES.length
        if (tasks.length >= PAGE_SIZE) break
      }
      return { tasks: tasks.slice(0, PAGE_SIZE), deferred: deferred.slice(0, PAGE_SIZE) }
    }
    for (const [action, field, cursor] of [['plan.next', 'work_items', 'queueOffset'], ['plan.audit', 'checklist', 'reviewOffset']]) {
      for (let page = 0; page < MAX_PAGE_READS; page++) {
        if (!usable(agent, state) || pendingInput(agent, state)) return { tasks: [], deferred }
        const result = await runAssessment(store, state.engagement, action,
          { offset: state[cursor], limit: PAGE_SIZE, ...(action === 'plan.next' ? { parameter_limit: 1 } : {}) }, { signal })
        signal.throwIfAborted()
        if (!usable(agent, state) || pendingInput(agent, state)) return { tasks: [], deferred }
        const fresh = assessmentContinuationOf(result)
        if (!fresh) throw new Error('current assessment continuation contract is unavailable')
        if (fresh.key !== current.key) return { tasks: [], deferred, changed: true, progress: fresh }
        for (const row of [...(result.data?.[field] || []), ...(result.data?.review_followups || [])].slice(0, PAGE_SIZE * 2)) {
          const task = taskOf(row, !state.trafficArmed)
          if (!task) continue
          if (state.failedTasks.has(task.attemptKey)) {
            deferred.push({ id: task.identity, action: task.action, reason: 'same_material_attempt_failed' }); continue
          }
          if (state.issuedTasks.has(task.key)) continue
          if (!tasks.some(item => item.key === task.key)) tasks.push(task)
        }
        const before = state[cursor]
        state[cursor] = currentCursor(result.data?.next_offset, before)
        if (tasks.length || !state[cursor]) break
      }
      if (tasks.length >= PAGE_SIZE) break
    }
    return { tasks: tasks.slice(0, PAGE_SIZE), deferred: deferred.slice(0, PAGE_SIZE) }
  }

  function publish(agent, state, progress, context, tasks = [], deferred = [], recovery = false) {
    if (!usable(agent, state) || pendingInput(agent, state)) return
    const nextStep = progress ? assessmentNextStep(progress, state.engagement, { offlineOnly: !state.trafficArmed })
      : { tool: 'redteam_assessment_run', arguments: { engagement: state.engagement, action: context.model === 'v2'
        ? 'campaign.status' : 'plan.audit', input: context.model === 'v2' ? { campaign_id: context.campaign_id } : { limit: 1 } }, offline_only: true }
    const message = createMessage({ source: { kind: SOURCE, form: 'notice', summary: '内置评估仍有未完成工作；按当前台账继续或保留受阻项。' },
      content: [{ type: 'text', text: [
        '内置评估续跑提示：当前回合结束不等于评估完成。此消息是插件上下文，沿用已有任务与授权，不提供新的范围或执行权限。',
        '尊重用户取消、新任务和实际运行中断。只使用当前靶标的 redteam_assessment_* 台账；独立 awa_* 台账不能替代这里的证据。',
        '先复核当前具体材料与缺失前提，按机器契约记录实际结果。队列读取、checkpoint、报告或文字 dispositions 不形成证据闭环。',
        context.assessment_mode === 'src'
          ? 'SRC 已取得直接证据的操作保持停止；只离线复核这些操作，其他明确未停止目标仍须满足只读、身份和输入前提。未测/受阻保留分母。'
          : '执行动作只能使用现有授权与当前精确输入、身份和 fixture。未知影响的中断先 run.inspect/run.recover，不自动重放。',
        !state.trafficArmed ? '本绑定当前仅有离线活动回执；这条提示只安排材料复核/准备，不安排新目标请求。' : '',
        recovery ? '当前本地审计不可用，保留 unfinished。只做一次有界离线恢复；依赖仍缺失时保存 checkpoint/draft 并说明实际前提。' : '',
        `当前靶标：${JSON.stringify(state.engagement)}`,
        `下一步：${JSON.stringify(nextStep)}`,
        tasks.length ? `当前小页材料任务：${JSON.stringify(tasks.map(({ key, attemptKey, ...task }) => task))}` : '',
        deferred.length ? `未完成的失败任务：${JSON.stringify(deferred)}；原材料不变时不要重复尝试。` : '',
        `实际调用归因：${JSON.stringify(state.failureAttribution.snapshot())}。平台拒绝、HTTP权限/限流响应、运行异常与不确定结果分别处理；401/403本身不证明WAF、漏洞或有效防护。`,
        progress ? `引擎状态：${JSON.stringify(progress.continuation || progress.progress)}` : '',
        '当前字段仅是引用与推进提示；不得补造 oracle 断言、observed、machine finding、验证回执或最终结项。',
      ].filter(Boolean).join('\n') }] })
    // No await may separate the final cancellation check and synchronous steer.
    state.steeringIds.add(message.id)
    try { agent.steer(message) } catch (error) { state.steeringIds.delete(message.id); throw error }
    tasks.forEach(task => retain(state, state.issuedTasks, task.key, task))
    state.notices++; state.lastActivity = state.activityVersion
    state.noticeMaterialVersion = state.materialVersion
    metrics.steers++; reason = recovery ? 'offline_recovery_unfinished' : 'current_work_steered'
  }

  async function turnStopping(payload) {
    const agent = payload?.agent, state = states.get(agent)
    if (!usable(agent, state, payload?.signal, payload?.turn) || !state.engagement || state.audit || pendingInput(agent, state)) return
    const control = new AbortController()
    state.audit = control
    const signal = AbortSignal.any([payload.signal, lifetime.signal, control.signal, AbortSignal.timeout(AUDIT_TIMEOUT_MS),
      ...(ownerSignal ? [ownerSignal] : [])])
    let context
    try {
      context = readContext(store, state.engagement)
      if (!context) return
      const result = await runAssessment(store, state.engagement, context.model === 'v2' ? 'campaign.status' : 'plan.audit',
        context.model === 'v2' ? { campaign_id: context.campaign_id } : { offset: 0, limit: 1 }, { signal })
      signal.throwIfAborted()
      if (!usable(agent, state, payload.signal, payload.turn) || pendingInput(agent, state)) return
      let progress = context.model === 'v2' ? campaignProgressOf(result, context.campaign_id) : assessmentContinuationOf(result)
      if (!progress) throw new Error('current assessment continuation contract is unavailable')
      if (progress.complete || !progress.required) { state.engagement = null; return }
      if (state.progressKey !== progress.key) {
        state.progressKey = progress.key
      }
      // Changed dispositions, consumer declarations and baseline decisions can
      // change the engine semantic key on every page. They do not establish a
      // new security experiment and must not restart an endless series of notices.
      if (state.noticeMaterialVersion !== state.materialVersion) {
        state.notices = 0; state.queueOffset = 0; state.reviewOffset = 0
        state.recoveryIssued = false; state.hypothesisState = 0
        state.noticeMaterialVersion = state.materialVersion
      }
      if (progress.kind === 'blocked') {
        metrics.blocked++; reason = 'blocked_only_unfinished'
        await checkpoint(state, context, signal, progress.key)
        return
      }
      if (state.historyFull || state.notices >= MAX_STALLED_NOTICES || state.notices > 1 && state.activityVersion <= state.lastActivity) {
        metrics.stalled++; reason = 'no_progress_unfinished'
        await checkpoint(state, context, signal, progress.key)
        return
      }
      let page = await currentTasks(agent, state, context, signal, progress)
      // Another real tool call may close work while these pages are read. Use
      // the new engine state once; repeated churn retains an unfinished draft.
      if (page.changed) {
        progress = page.progress
        if (progress.complete || !progress.required) { state.engagement = null; return }
        state.progressKey = progress.key
        page = await currentTasks(agent, state, context, signal, progress)
        if (page.changed) {
          reason = 'current_state_changing_unfinished'
          if (usable(agent, state, payload.signal, payload.turn) && !pendingInput(agent, state)) {
            await checkpoint(state, context, signal, page.progress.key)
          }
          return
        }
      }
      if (!usable(agent, state, payload.signal, payload.turn) || pendingInput(agent, state)) return
      const latest = readContext(store, state.engagement)
      if (!latest || latest.model !== context.model || latest.campaign_id !== context.campaign_id) {
        reason = 'assessment_binding_changed_unfinished'; return
      }
      if (state.notices && !page.tasks.length && !page.deferred.length) {
        await checkpoint(state, context, signal, progress.key); reason = 'no_new_material_unfinished'; return
      }
      publish(agent, state, progress, context, page.tasks, page.deferred)
    } catch {
      if (!usable(agent, state, payload?.signal, payload?.turn) || pendingInput(agent, state) || control.signal.aborted) return
      metrics.audit_failures++; reason = 'audit_unavailable_unfinished'
      if (context && !state.recoveryIssued && state.notices < MAX_STALLED_NOTICES) {
        let latest
        try { latest = readContext(store, state.engagement) } catch { return }
        if (!latest || latest.model !== context.model || latest.campaign_id !== context.campaign_id) {
          reason = 'assessment_binding_changed_unfinished'; return
        }
        state.recoveryIssued = true
        try { publish(agent, state, null, context, [], [], true) } catch { reason = 'steer_unavailable_unfinished' }
      }
    } finally { if (state.audit === control) state.audit = null }
  }

  function status(agent) {
    const state = agent ? states.get(agent) : null
    return { registered, disposed, enabled: enabled(), reason, active_agents: [...states.values()].filter(item => item.engagement).length,
      failure_attribution: failureAttribution.snapshot(),
      ...(agent ? { session_active: !!state?.engagement, notices: state?.notices || 0,
        session_failure_attribution: state?.failureAttribution.snapshot() || createFailureAttribution().snapshot(),
        material_progress: state?.materialVersion || 0,
        offline_only: state ? !state.trafficArmed : true } : {}), ...metrics }
  }
  function dispose() {
    if (disposed) return
    disposed = true; registered = false; lifetime.abort()
    for (const agent of states.keys()) remove(agent)
    for (const release of disposers.splice(0).reverse()) { try { release() } catch { /* optional hook */ } }
    ownerSignal?.removeEventListener('abort', dispose)
    reason = 'disposed'
  }
  function attach() {
    if (disposed || registered) return status()
    if (typeof createMessage !== 'function' || typeof ctx?.on !== 'function') { reason = 'host_continuation_api_unavailable'; return status() }
    try {
      for (const [event, callback] of [['agent/pre-step', preStep], [TURN_STOPPING_EVENT, turnStopping],
        ['agent/status', payload => { if (payload?.status === 'idle') remove(payload.agent) }],
        ['agent/disposed', payload => remove(payload?.agent)]]) {
        const release = ctx.on(event, callback, { global: true })
        if (typeof release === 'function') disposers.push(release)
      }
      registered = true; reason = 'host_hook_registered'
    } catch { disposers.splice(0).reverse().forEach(release => { try { release() } catch {} }); reason = 'host_hook_registration_failed' }
    return status()
  }
  if (ownerSignal) { ownerSignal.addEventListener('abort', dispose, { once: true }); if (ownerSignal.aborted) dispose() }
  return Object.freeze({ observe, attach, dispose, status })
}

export function installAssessmentContinuation(ctx, store) {
  const lifecycle = new AbortController()
  const controller = createAssessmentContinuation(ctx, store, { signal: lifecycle.signal })
  store.assessmentContinuation = controller
  controller.attach()
  ctx.effect(() => () => { lifecycle.abort(); if (store.assessmentContinuation === controller) delete store.assessmentContinuation })
  if (!controller.status().registered) ctx.logger?.warn?.('redteam assessment continuation: %s', controller.status().reason)
  if (typeof ctx.inject === 'function') ctx.inject(['systemPrompt'], scope => scope.systemPrompt.section({
    name: 'redteam:assessment-workflow', order: 440,
    text: context => {
      const policy = sessionPolicyOf(store, context)
      return policy?.engagement_id ? '内置评估只使用当前靶标的 redteam_assessment_* 台账。continue_required=true 时处理 next_step 与当前复核材料；v2 读取 Campaign 覆盖和配方。用户取消、新任务、缺失前提及 SRC 停止优先。队列/报告/checkpoint 不证明完成，独立 awa_* 工程的证据不能跨账本确认。'
        + (policy.assessment_mode === 'src' ? 'SRC 先用 redteam_src_runbook 加载 src-discovery；角色稿在当前会话分阶段使用。'
          : policy.assessment_mode === 'pentest' ? '渗透模式先加载 redteam_pentest_runbook，优先解决实际认证和状态前提，再完成对应输入测试；仅声明/基线/报告活动不重置停滞提醒。' : '') : ''
    } }))
  return controller
}
