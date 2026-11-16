import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { RedteamStore } from '../lib/redteam/store-core.js'
import { removeTreeNoFollowSync } from '../lib/remove-tree.js'
import { buildWorkflowAdvice } from '../lib/redteam/workflow-advisor.js'
import { classifyAssessmentOutcome, createFailureAttribution } from '../lib/redteam/failure-attribution.js'
import { createAssessmentContinuation, TURN_STOPPING_EVENT } from '../lib/redteam/assessment-continuation.js'
import { bindTrustedSession } from '../lib/redteam/session-policy.js'
import { persistNativeContext, ASSESSMENT_CONTEXT_SCHEMA, assessmentSourceId } from '../lib/redteam/native-assessment.js'
import { confirmFinding } from './fixtures/trusted-finding.mjs'

const scope = 'https://fixture.invalid/api'
function fixture(t, mode = 'pentest') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'purge-workflow-advisor-')), store = new RedteamStore(root)
  const id = store.openEngagement('local fixture', [scope], { assessment_mode: mode, exclude: [scope + '/excluded'], bindCurrent: false }).id
  t.after(() => { store.close(); assert(path.basename(root).startsWith('purge-workflow-advisor-')
    && path.dirname(root) === path.resolve(os.tmpdir())); removeTreeNoFollowSync(root) })
  return { store, id, root }
}
const candidate = (store, id, title = '具体越权读取', target = scope + '/record') => {
  const row = { title, target, category: 'access_control', severity: 'low', status: 'candidate' }
  return { ...row, ...store.addVuln(id, row) }
}

test('typed failures distinguish platform decisions, HTTP responses, runtime errors and unknown effects', () => {
  assert.equal(classifyAssessmentOutcome('http.capture', { ok: true, data: { status_code: 403, id: 'E-fixture', complete: true,
    body: 'WAF secret-data' } }).class, 'http_permission_response')
  assert.equal(classifyAssessmentOutcome('http.capture', { ok: true, data: { status_code: 429, complete: true } }).class, 'http_rate_limit_response')
  assert.equal(classifyAssessmentOutcome('http.capture', null, { code: 'ASSESSMENT_SCOPE', message: 'raw-private-target' }).class, 'platform_denied')
  for (const code of ['src_action_denied', 'src_write_denied', 'stopped_at_evidence', 'src_stop_snapshot']) {
    assert.equal(classifyAssessmentOutcome('http.capture', null, { code }).class, 'platform_denied')
  }
  assert.equal(classifyAssessmentOutcome('http.capture', null, { code: 'ECONNRESET', message: 'raw-private-target' }).class, 'runtime_error')
  assert.equal(classifyAssessmentOutcome('test.run', { ok: true, data: { run: { id: 'RUN-fixture', effect: { unknown: true } } } }).class, 'uncertain')
  assert.equal(classifyAssessmentOutcome('http.capture', { ok: true, data: { complete: false, status_code: 403 } }).class, 'uncertain')
  assert.equal(classifyAssessmentOutcome('http.capture', null, { code: 'ASSESSMENT_SCOPE', dispatch_uncertain: true }).class, 'uncertain')
  assert.equal(classifyAssessmentOutcome('evidence.read', { ok: true, data: { text: '403 WAF denied' } }).class, 'ok', 'target text is not a classification source')
})

test('failure samples keep bounded typed references, no raw body, request, credentials or exception text', () => {
  const diagnostics = createFailureAttribution()
  for (let index = 0; index < 6; index++) diagnostics.observe(classifyAssessmentOutcome('http.capture',
    { ok: true, data: { id: 'E-fixture-' + index, status_code: 403, complete: true, request: { password: 'private-value' } } }))
  diagnostics.observe(classifyAssessmentOutcome('surface.inspect', null, { code: 'ECONNRESET', message: 'Bearer private-value',
    details: { operation_id: 'OP-fixture', url: 'https://outside.invalid/private-value' } }))
  const snapshot = diagnostics.snapshot()
  assert.equal(snapshot.counts.http_permission_response, 6)
  assert.equal(snapshot.samples.http_permission_response.length, 3)
  assert.equal(snapshot.samples.http_permission_response[0].references.evidence_id, 'E-fixture-3')
  assert(!JSON.stringify(snapshot).includes('private-value'))
  assert.equal(snapshot.target_defense_inferred, false)
  snapshot.samples.runtime_error[0].code = 'tampered'
  assert.equal(diagnostics.snapshot().samples.runtime_error[0].code, 'ECONNRESET')
})

test('advisor requires a current exact proof and does not initialize or dispatch an assessment', t => {
  const { store, id } = fixture(t), verified = candidate(store, id)
  confirmFinding(store, id, verified)
  candidate(store, id, '只有文字声明的关键影响')
  store.db(id).prepare("INSERT INTO vuln(title,target,severity,status,category) VALUES(?,?,?,?,?)")
    .run('Historical confirmed label', scope + '/legacy', 'critical', 'confirmed', 'access_control')
  const first = buildWorkflowAdvice(store, id)
  assert.equal(first.data.recommendations.length, 1)
  assert.equal(first.data.recommendations[0].severity_cap, 'low')
  assert.equal(first.data.recommendations[0].next_step.arguments.action, 'action.help', 'operator proof does not invent a native operation')
  assert.equal(first.data.pending_confirmation.length, 1)
  assert.equal(first.data.candidate_priorities[0].priority, 1)
  assert.equal(first.requests_sent, 0)
  assert.equal(first.data.automatic_dispatch, false)
  assert(!fs.existsSync(path.join(store.dirOf(id), 'assessment')))
  store.db(id).prepare('UPDATE vuln SET title=? WHERE id=?').run('Unverified changed claim', verified.id)
  assert.equal(buildWorkflowAdvice(store, id).data.recommendations.length, 0)
})

test('SRC advice keeps persistent stops and only recommends offline submission preparation', t => {
  const { store, id } = fixture(t, 'src'), verified = candidate(store, id)
  confirmFinding(store, id, verified)
  const advice = buildWorkflowAdvice(store, id)
  assert.equal(advice.data.recommendations[0].recommendation, 'preserve_stop_and_prepare_submission')
  assert.equal(advice.data.recommendations[0].next_step.tool, 'redteam_src_report')
  assert.equal(advice.data.source_stops.total, 1)
  candidate(store, id, 'Query does not reopen a stopped source', scope + '/record?variant=2')
  assert.equal(buildWorkflowAdvice(store, id).data.candidate_priorities.length, 0)
  store.updateVuln(id, verified.id, { status: 'fixed' })
  const next = buildWorkflowAdvice(store, id)
  assert.equal(next.data.source_stops.total, 1)
  assert.equal(next.data.source_stops.must_remain_stopped, true)
  assert.equal(next.data.convergence.recommended, false)
})

test('advisor redacts private proof references and only asks for the actual model preparation contract', t => {
  const { store, id } = fixture(t), secret = 'advisor-secret-value', row = candidate(store, id)
  store.addCredential(id, { host: scope, secret_value: secret })
  confirmFinding(store, id, row, { binding: { operation_id: 'OP-' + secret, input_key: 'query:' + secret } })
  let advice = buildWorkflowAdvice(store, id)
  assert(!JSON.stringify(advice).includes(secret))
  assert.equal(advice.data.recommendations[0].next_step.arguments.input.name, 'assessment.prepare')
  persistNativeContext(store, id, { schema: ASSESSMENT_CONTEXT_SCHEMA, engagement_id: id,
    source_engagement_id: assessmentSourceId(store, id), project_id: 'assessment',
    workspace: path.join(store.dirOf(id), 'assessment'), assessment_mode: 'assessment', model: 'v2',
    executionBackend: 'native', scope: [scope], exclude: [], target: scope })
  advice = buildWorkflowAdvice(store, id)
  assert.equal(advice.data.recommendations[0].next_step.arguments.action, 'action.help')
  assert.deepEqual(advice.data.recommendations[0].next_step.arguments.input, { name: 'test.prepare' })
  assert(!fs.existsSync(path.join(store.dirOf(id), 'assessment')), 'model metadata does not initialize an engine workspace')
})

test('typed failure samples reach continuation status without resetting its three-notice material budget', async t => {
  const { store, id } = fixture(t), events = new Map(), signal = new AbortController().signal
  const agent = { id: 'advisor-continuation', status: 'running', session: { id: 'advisor-continuation-session', header: { agentPreset: 'pentest' } },
    inbox: { nextStep: [], nextTurn: [] }, steer(message) { this.inbox.nextStep.push(message) } }
  bindTrustedSession(store, { agent }, id)
  let round = 0, messages = 0
  const contract = () => ({ contract_version: 2, stop_policy_version: 1, stop_policy: 'exhaustion_only',
    continue_required: true, can_finalize: false, can_claim_complete: false, automatic_stop_allowed: false,
    frontier_review_required: true, frontier_rounds: 0, ready_total: 1, review_total: 1, blocked_total: 1,
    actionable_total: 2, unresolved_total: 3, state: 'continue', coverage_status: 'partial',
    snapshot_id: 'CS-' + round, semantic_progress_id: 'PR-' + round, next_action: 'plan.next' })
  const controller = createAssessmentContinuation({ on(name, handler) { events.set(name, handler); return () => events.delete(name) } }, store,
    { createMessage: data => ({ ...data, role: 'user', id: 'notice-' + ++messages }),
      readContext: () => ({ model: 'v1', assessment_mode: 'assessment' }),
      runAssessment: async (_store, _id, action) => action === 'plan.checkpoint' ? { ok: true }
        : { ok: true, data: { continuation: contract(), next_offset: null, work_items: [{ obligation_id: 'OB-' + round,
          suggested_action: 'assessment.prepare', input_template: { obligation_id: 'OB-' + round, limit: 1 } }] } } })
  t.after(() => controller.dispose())
  controller.attach()
  const step = async () => events.get('agent/pre-step')({ agent, signal, turn: 1 },
    async () => ({ kind: 'enter', messages: agent.inbox.nextStep.splice(0) }))
  const observe = (action, attribution) => {
    const invocation = { action, input: action === 'http.capture' ? { operation_id: 'OP-fixture-' + round } : {},
      engagement: id, execution: { agent, signal }, signal }
    controller.observe({ phase: 'start', invocation })
    controller.observe({ phase: 'success', ok: true, invocation, attribution })
  }
  await step()
  observe('plan.build', classifyAssessmentOutcome('plan.build', { ok: true }))
  for (round = 1; round <= 6; round++) {
    observe('http.capture', classifyAssessmentOutcome('http.capture', { ok: true, data: { status_code: 403, complete: true, id: 'E-fixture-' + round } }))
    await events.get(TURN_STOPPING_EVENT)({ agent, signal, turn: 1 })
    await step()
  }
  assert.equal(messages, 3)
  assert.equal(controller.status(agent).material_progress, 0)
  assert.equal(controller.status(agent).session_failure_attribution.counts.http_permission_response, 6)
  assert.equal(controller.status(agent).session_failure_attribution.samples.http_permission_response.length, 3)
})

test('out-of-scope legacy proof and subjective high severity cannot trigger continuation advice', t => {
  const { store, id } = fixture(t), row = candidate(store, id)
  confirmFinding(store, id, row)
  store.db(id).prepare('UPDATE vuln SET target=? WHERE id=?').run('https://outside.invalid/private', row.id)
  const claim = candidate(store, id, 'Subjective critical impact')
  store.db(id).prepare('UPDATE vuln SET severity=? WHERE id=?').run('critical', claim.id)
  for (let index = 0; index < 51; index++) store.db(id).prepare('INSERT INTO asset(ip,segment_cidr) VALUES(?,?)').run('192.0.2.' + index, '192.0.2.0/24')
  const advice = buildWorkflowAdvice(store, id)
  assert.equal(advice.data.recommendations.length, 0)
  assert.equal(advice.data.convergence.current_high_impact_proofs_in_scan, 0)
  assert.equal(advice.data.convergence.recommended, true)
  assert.equal(advice.data.candidate_priorities[0].priority, 3)
  assert.equal(advice.data.whole_scope_exhausted, false)
})

test('bounded inventory cannot claim global absence and advisor rejects caller-controlled runtime fields', t => {
  const { store, id } = fixture(t)
  const insert = store.db(id).prepare('INSERT INTO vuln(title,target,status,severity,category) VALUES(?,?,?,?,?)')
  for (let index = 0; index < 201; index++) insert.run('Synthetic candidate ' + index, scope + '/record', 'candidate', 'low', 'access_control')
  const advice = buildWorkflowAdvice(store, id, { limit: 2 })
  assert.equal(advice.data.candidate_priorities.length, 2)
  assert.equal(advice.data.convergence.scan_complete, false)
  assert.equal(advice.data.convergence.recommended, false)
  for (const input of [{ limit: 0 }, { limit: 21 }, { target: scope }, { workspace: 'caller path' }, { assessment_mode: 'src' }]) {
    assert.throws(() => buildWorkflowAdvice(store, id, input), error => error.code === 'ASSESSMENT_ADVICE_FIELDS')
  }
})
