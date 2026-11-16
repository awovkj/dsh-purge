/** Native assessment evidence governance; the engine source ships in this project. */
import { createHash } from 'node:crypto'
import { isIP } from 'node:net'
import { EvidenceLedger } from './evidence-ledger.mjs'
import { targetWithinScope, isScopedAssessmentMode } from './assessment-policy.js'
import {
  ASSESSMENT_ENGINE, INTERNAL_PROJECT_ID, assessmentPolicyOf, assessmentSourceId,
  assessmentConfigOf, readNativeContext, persistNativeContext, initializeAssessment,
  ensureNativeAssessment, assessmentStatus, nativeProject, nativeRuntimeOf,
  currentNativeProject, callAssessmentRuntime, assessmentScopesForUrls,
  assertAssessmentUrlAllowed, embeddedAssessmentBridge, configureAssessment, validateAssessmentSettings, validateNativeContext,
} from './native-assessment.js'
import { withAssessmentGuidance } from './assessment-guidance.js'
import { redteamPrivateValues, reportText } from './report-text.js'
import { isObservationAction, observationActionHelp, observationActionCatalog,
  readAssessmentResponse, readAssessmentHeaders, discoverAssessmentJavascript } from './assessment-observation.js'
import { isAuthenticationAction, authenticationActionHelp, authenticationActionCatalog,
  hashAssessmentValue, createCookieSession, prepareCookieCapture, assertCookieSessionRequest, withCookieCaptureHelp, withCookieToolAdvice } from './assessment-auth.js'
import { isDocumentDiscoveryAction, documentDiscoveryActionHelp, discoverAssessmentDocument } from './assessment-discovery.js'
import { isEvidenceDiffAction, evidenceDiffActionHelp, compareAssessmentEvidence } from './evidence-diff.js'
import { isSourcemapDiscoveryAction, sourcemapDiscoveryActionHelp, discoverAssessmentSourcemap } from './sourcemap-discovery.js'
import { isCaptureBatchAction, captureBatchActionHelp, captureAssessmentBatch, captureBatchRequests } from './assessment-batch.js'
import { isLocalAssessmentAction, localAssessmentActionHelp, localAssessmentActionCatalog,
  runLocalAssessmentAction, currentSkillOptions } from './assessment-local-actions.js'
import { classifyAssessmentOutcome } from './failure-attribution.js'
import { ownedAssessmentInputPath, readEngineEvidence } from './assessment-artifacts.js'
import { captureNativeProofState } from './finding-proof.js'
import { sourceStopMatches } from './source-stop.js'
import { resolvePage, nextPage } from './page-token.js'

export { ASSESSMENT_ENGINE, assessmentConfigOf, readNativeContext, initializeAssessment,
  ensureNativeAssessment, assessmentStatus }
export { assessmentRuntimeStatus, probeAssessmentRuntime, assessmentOperatorConfigOf } from './native-assessment.js'
export { redteamPrivateValues } from './report-text.js'
export { buildAssessmentDeliveryReport, readAssessmentCoverage } from './assessment-report.js'
export { buildPentestReport } from './pentest-report.js'
export const EXCHANGE_SCHEMA = 'dsh-purge-awa/v1'
export const MAX_EXCHANGE_ITEMS = 200
const digest = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex')
const sourceEngagementId = assessmentSourceId
const policyOf = assessmentPolicyOf
const boundedInteger = (value, fallback, max = MAX_EXCHANGE_ITEMS) => {
  if (value === undefined) return fallback
  if (!Number.isSafeInteger(value) || value < 0 || value > max) throw new Error('invalid pagination: expected a bounded nonnegative integer')
  return value
}
const callRuntime = callAssessmentRuntime
const currentProject = currentNativeProject
const persistBinding = persistNativeContext
export const readAwaBinding = readNativeContext
export const awaProject = nativeProject
export const validateAwaSettings = validateAssessmentSettings
export const configureAwa = configureAssessment

export function awaConfigOf(store, id, env = process.env) {
  if (typeof id !== 'string' || !id) throw new Error('native assessment configuration requires an engagement')
  return assessmentConfigOf(store, id, env)
}

export async function awaStatus(store, id, options = {}) {
  const status = await assessmentStatus(store, id, options)
  return { ...status, version: ASSESSMENT_ENGINE.version, binding: id ? readNativeContext(store, id) : null,
    contract: EXCHANGE_SCHEMA }
}

const URL_PRIVATE_NAME = /(?:token|password|passwd|secret|cookie|authorization|api[-_]?key|session|signature|credential)/i
function exchangeUrl(value, privateValues = []) {
  if (typeof value !== 'string' || value.length > 4096 || /[\x00-\x20\\]/.test(value)) return null
  let url
  try { url = new URL(value) } catch { return null }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.hash) return null
  // A sanitized locator must never be mistaken for the request that was made.
  // Sensitive queries are omitted entirely and returned as a skipped clue.
  for (const key of url.searchParams.keys()) if (URL_PRIVATE_NAME.test(key)) return null
  let decoded = value
  for (let index = 0; index < 3; index++) {
    if (privateValues.some(secret => decoded.includes(secret))) return null
    try { decoded = decodeURIComponent(decoded) } catch { break }
  }
  url.search = ''
  return url.href
}

const exchangeSecrets = redteamPrivateValues

function exchangeTitle(value, privateValues) {
  if (typeof value === 'string' && value.length > 128 * 1024) throw new Error('source title exceeds the bounded metadata budget')
  let title = typeof value === 'string' ? value : 'External discovery'
  for (const secret of privateValues) title = title.split(secret).join('[redacted]')
  title = title.replace(/https?:\/\/[^\s<>"']+/gi, locator => {
    try {
      const url = new URL(locator)
      if (url.username || url.password) return '[redacted URL]'
      url.search = ''; url.hash = ''
      return url.href
    } catch { return '[unresolved URL]' }
  })
  return title.replace(/((?:password|passwd|secret|token|api[-_]?key)\s*[:=]\s*)[^\s,;]+/gi, '$1[redacted]').slice(0, 240)
}

function candidateFamily(title) {
  const label = String(title || '').toLowerCase()
  for (const [pattern, family] of [[/sql\s*(?:注入|injection)|sqli/, 'sql_injection'],
    [/跨站脚本|\bxss\b/, 'xss'], [/\bssrf\b|服务端请求伪造/, 'ssrf'],
    [/\bxxe\b|外部实体/, 'xxe'], [/路径遍历|path.traversal|目录穿越/, 'path_traversal'],
    [/命令注入|command.injection|\brce\b|远程代码执行|remote.code.execution/, 'command_injection'], [/模板注入|template.injection/, 'template_injection'],
    [/反序列化|deserial/, 'deserialization'], [/越权|access.control|idor/, 'access_control']]) {
    if (pattern.test(label)) return family
  }
  return 'generic'
}

/** Metadata-only handoff, read directly in bounded pages (no raw HTTP copies). */
export function buildAwaExchange(store, id, args = {}) {
  const limit = boundedInteger(args.limit, 50)
  if (!limit) throw new Error('invalid pagination: limit must be positive')
  const offset = boundedInteger(args.offset, 0, Number.MAX_SAFE_INTEGER)
  const db = store.db(id)
  const privateValues = exchangeSecrets(db)
  const policy = policyOf(store, id)
  const filter = policy.assessment_mode === 'src' ? ' WHERE src_eligible = 1' : ''
  const total = db.prepare('SELECT COUNT(*) AS n FROM vuln' + filter).get().n
  const excluded_hardening = db.prepare('SELECT COUNT(*) AS n FROM vuln WHERE src_eligible = 0').get().n
  const rows = db.prepare('SELECT id, title, target, severity, status, source, category, finding_kind FROM vuln' + filter + ' ORDER BY id LIMIT ? OFFSET ?').all(limit, offset)
  const candidates = [], http = [], skipped = []
  for (const row of rows) {
    if (row.finding_kind !== 'vulnerability') {
      skipped.push({ external_id: 'vuln:' + row.id, reason: 'hardening_or_informational_not_a_security_candidate' }); continue
    }
    const url = exchangeUrl(row.target, privateValues)
    if (!url) { skipped.push({ external_id: 'vuln:' + row.id, reason: 'explicit_public_http_url_required' }); continue }
    if (policy.scope.length && !targetWithinScope(url, policy.scope, policy.exclude)) {
      skipped.push({ external_id: 'vuln:' + row.id, reason: 'outside_source_scope_or_excluded' }); continue
    }
    const captures = db.prepare('SELECT id, method, url, status, captured_at FROM http_evidence WHERE vuln_id = ? ORDER BY id LIMIT 10').all(row.id)
    const method = captures[0]?.method || null
    candidates.push({ external_id: 'vuln:' + row.id, url, method,
      title: exchangeTitle(row.title, privateValues),
      severity: row.severity || 'info', category: row.category || candidateFamily(row.title), source_status: row.status || 'candidate',
      query_omitted: new URL(row.target).search !== '',
      evidence_refs: captures.map(capture => 'http:' + capture.id) })
    for (const capture of captures) {
      if (http.length >= MAX_EXCHANGE_ITEMS) break
      const captureUrl = exchangeUrl(capture.url, privateValues)
      if (!captureUrl) continue
      if (policy.scope.length && !targetWithinScope(captureUrl, policy.scope, policy.exclude)) continue
      http.push({ external_id: 'http:' + capture.id, candidate_external_id: 'vuln:' + row.id,
        url: captureUrl, method: capture.method || 'GET', status_code: capture.status,
        captured_at: capture.captured_at,
        sha256: digest({ id: capture.id, url: captureUrl, method: capture.method,
          status: capture.status, captured_at: capture.captured_at }),
        hash_scope: 'metadata', raw_material_included: false })
    }
  }
  const exchange = { schema: EXCHANGE_SCHEMA,
    engagement: { id: sourceEngagementId(store, id), name: 'engagement:' + sourceEngagementId(store, id), mode: policyOf(store, id).assessment_mode },
    candidates, http_evidence: http,
    limitations: ['External source status and HTTP hashes are provenance only; recollect and evaluate current controls in AWA.'] }
  return { ok: true, exchange, total, offset, limit,
    next_offset: offset + rows.length < total ? offset + rows.length : null,
    skipped, excluded_hardening, requests_sent: 0 }
}

const TARGET_ACTIONS = new Set(['http.capture', 'browser.visit', 'identity.verify', 'scenario.run',
  'tool.sqlmap', 'tool.yakit_replay', 'tool.tscanplus_request', 'test.run', 'test.run_browser',
  'test.run_scenario', 'test.run_external'])

async function assertSourceStops(store, id, runtime, binding, action, input, options) {
  if (policyOf(store, id).assessment_mode !== 'src' || !TARGET_ACTIONS.has(action)) return
  if (action === 'test.run' && input.mode === 'verify') return
  const stopped = typeof store.srcStops === 'function' ? store.srcStops(id) : store.srcFindings(id)
  if (!stopped.length) return
  const locators = ['url', 'verify_url', 'consumer_url', 'entry_url'].map(key => input[key]).filter(value => typeof value === 'string')
  if (typeof input.operation_id === 'string') {
    const inspected = await callRuntime(runtime, 'surface.inspect', { project_id: binding.project_id, operation_id: input.operation_id }, options)
    if (typeof inspected.data?.operation?.url === 'string') locators.push(inspected.data.operation.url)
  }
  // Frozen recipe/session targets are resolved by the native executor. It reads
  // the package-owned snapshot before each actual HTTP request or browser route.
  if (!locators.length) return
  if (locators.some(locator => stopped.some(finding => sourceStopMatches(finding.target, locator)))) {
    throw Object.assign(new Error('SRC stopped_at_evidence: this source target has direct evidence; use offline review or report actions'),
      { code: 'SRC_STOPPED_AT_EVIDENCE', recovery: { requests_sent: 0, next_action: 'redteam_evidence_list' } })
  }
}

const RUNTIME_FIELDS = new Set(['project_id', 'workspace', 'packagePath', 'executionBackend',
  'pythonExecutable', 'wslDistribution', 'wslPythonExecutable', 'timeoutMs', 'assessmentModel',
  'assessmentMode', 'required_assessment_mode'])

function actionLocators(input) {
  return ['url', 'verify_url', 'consumer_url', 'entry_url', 'base_url'].map(key => input[key])
    .concat(input.operation?.url, ...(Array.isArray(input.operations) ? input.operations.map(item => item?.url) : []))
    .filter(value => typeof value === 'string')
}

/** Optional host observation cannot alter the actual engine/ledger outcome. */
async function observedCall(store, id, action, input, options, execute) {
  const observer = store.assessmentContinuation?.observe
  const invocation = Object.freeze({ engagement: id, action, input,
    execution: options.execution, signal: options.signal })
  const notify = event => { try { observer?.({ ...event, invocation }) } catch { /* optional host integration */ } }
  notify({ phase: 'start' })
  try {
    const result = await execute()
    options.signal?.throwIfAborted()
    let materialKey = null
    if (result?.ok === true && action === 'http.capture' && result.data?.complete === true) {
      // Artifact hashes contain timestamps. Use request/control identity and
      // actual body bytes so re-reading or recapturing the same body is not progress.
      try {
        const captured = readEngineEvidence(store, id, result.data.id, readNativeContext(store, id))
        materialKey = digest([action, captured.record.operation_id, captured.record.actor_id,
          captured.record.resource_id, captured.artifact.request.url, captured.artifact.request.method,
          Object.entries(captured.artifact.request.headers || {}).map(([name, value]) => [name.toLowerCase(), value])
            .sort(([a], [b]) => a.localeCompare(b)), captured.artifact.request.body_base64,
          captured.artifact.response.status,
          captured.artifact.response.body_sha256])
      } catch { /* An unavailable artifact cannot reset the progress guard. */ }
    } else if (result?.ok === true && action === 'assessment.evaluate' && input.oracle?.type !== 'baseline'
      && ['confirmed', 'refuted'].includes(result.data?.outcome)) {
      materialKey = digest([action, input.obligation_id, input.oracle?.type, input.evidence_ids, result.data.outcome])
    } else if (result?.ok === true && action === 'http.capture_batch' && Array.isArray(result.data?.results)) {
      const materials = []
      for (const row of result.data.results) {
        if (row.state === 'captured') {
          notify({ phase: 'item', ok: true, attribution: classifyAssessmentOutcome('http.capture', { ok: true,
            data: { id: row.evidence_id, status_code: row.status_code, complete: row.capture_complete, run_id: row.run_id } }) })
          if (row.capture_complete === true) {
            try {
              const captured = readEngineEvidence(store, id, row.evidence_id, readNativeContext(store, id))
              materials.push([captured.record.operation_id, captured.record.actor_id, captured.record.resource_id,
                captured.artifact.request, captured.artifact.response.status, captured.artifact.response.body_sha256])
            } catch {}
          }
        }
      }
      if (materials.length) materialKey = digest([action, materials])
    } else if (result?.ok === true && action === 'assessment.batch' && Array.isArray(result.data?.results)) {
      const evaluated = result.data.results.filter(row => row.ok === true && ['confirmed', 'refuted'].includes(row.outcome)
        && input.items?.[row.index]?.oracle?.type !== 'baseline').map(row => [row.obligation_id,
          input.items?.[row.index]?.oracle?.type, input.items?.[row.index]?.evidence_ids, row.outcome])
      if (evaluated.length) materialKey = digest([action, evaluated])
    } else if (result?.ok === true && action === 'identity.verify' && result.data?.session?.verified_at) {
      const session = result.data.session
      // A fresh attestation ID for the same principal/generation is not a new capability.
      materialKey = digest([action, session.id, session.generation, session.actor_signature, session.verification_assertion])
    } else if (result?.ok === true && (action === 'scenario.run' && result.data?.status === 'succeeded'
      || ['test.run', 'test.run_browser', 'test.run_scenario', 'test.run_external'].includes(action)
        && ['evaluated', 'published'].includes(result.data?.run?.status)
        && result.data.run.evidence_ids?.length && result.data.run.effect?.unknown !== true)) {
      const run = result.data?.run
      materialKey = run ? digest([action, run.recipe_id, run.hypothesis_id, run.evidence_ids, run.status, run.effect])
        : digest([action, result.data?.evidence_ids || result.data?.id || input.session_id])
    }
    notify({ phase: 'success', ok: result?.ok === true, material_key: materialKey,
      attribution: classifyAssessmentOutcome(action, result) })
    return result
  } catch (error) { notify({ phase: 'failure', dispatch_uncertain: error.dispatch_uncertain === true,
    attribution: classifyAssessmentOutcome(action, null, error) }); throw error }
}

/** Recovery stays on the same IDs and existing material; it never invents an oracle. */
function recoverAssessmentAction(error, action, input, id) {
  const recovery = { ...(error.recovery || {}) }
  const evidenceId = recovery.evidence_id || input.evidence_ids?.[0]
  if (['selector', 'response_json'].includes(error.code) && /^E-[a-f0-9]{32}$/.test(evidenceId || '')) {
    recovery.next_step = { tool: 'redteam_assessment_run', arguments: { engagement: id,
      action: 'evidence.read', input: { evidence_id: evidenceId } }, offline_only: true }
    recovery.note = '先读取实际 JSON 结构或文本类型；不要猜 selector，也不要对 HTML/JS 使用 JSON Pointer 判据。'
  } else if (error.code === 'evidence_binding') {
    recovery.note = '证据必须属于该义务的确切 operation。先 evidence.inspect 和 surface.inspect 核对返回的 ID，不按相同响应或标题混用证据。'
  } else if (['src_write_denied', 'src_action_denied'].includes(error.code)) {
    recovery.note = '这是 SRC 模式边界；保留 blocked 和实际前提，不通过修改 effect、当前模式或重复请求消除阻塞。独立渗透任务使用新 pentest 会话。'
    recovery.requests_sent = 0
  } else if (error.code === 'frontier_evidence') {
    recovery.note = '先 evidence.inspect 核对 complete、integrity 与 lineage；不完整响应不能用于 frontier reviewed/completed 声明。'
  } else if (error.code === 'action_name') {
    recovery.next_step = { tool: 'redteam_assessment_run', arguments: { engagement: id, action: 'action.help', input: {} }, offline_only: true }
  }
  if (!recovery.next_step && /^[a-z][a-z0-9_.]{0,95}$/.test(action)
    && action !== 'action.help' && !error.dispatch_uncertain && !recovery.run_id) {
    recovery.next_step = { tool: 'redteam_assessment_run', arguments: { engagement: id,
      action: 'action.help', input: { name: action } }, offline_only: true }
    recovery.note ||= 'Read the complete action contract before retrying; do not add guessed fields one error at a time.'
  }
  if (Object.keys(recovery).length) error.recovery = recovery
  return error
}

function observationGuidance(result, id, action, input) {
  if (result?.ok !== true) return result
  if (action === 'http.capture' && /^E-[a-f0-9]{32}$/.test(result.data?.id || '')) {
    return { ...result, observation_next_step: { tool: 'redteam_assessment_run', arguments: { engagement: id,
      action: 'evidence.read', input: { evidence_id: result.data.id } }, offline_only: true },
    observation_note: result.data.complete === false
      ? '响应已截断，不能用于漏洞判定或完整覆盖。先 run.inspect；静态 JS 的实际 Range 片段可用 surface.from_evidence 离线检查完整性，不能自动重发。'
      : '先读取实际响应结构或文本，基于真实字段选判据；HTTP 200 和相同长度本身不证明功能存在或漏洞不存在。' }
  }
  const oracles = action === 'assessment.evaluate' ? [input.oracle] : action === 'assessment.batch' ? (input.items || []).map(item => item.oracle) : []
  if (oracles.some(oracle => oracle?.type === 'baseline')) return { ...result,
    baseline_only: oracles.every(oracle => oracle?.type === 'baseline'),
    assessment_note: 'baseline 的 confirmed/refuted/inconclusive 仅解释所选正常响应不变量，不能证明漏洞存在或不存在。需实际登记 test_family/输入/身份并满足对应安全判据。' }
  return result
}

function assessmentHelpPolicy(store, id, result) {
  if (result?.ok !== true) return result
  const mode = policyOf(store, id).assessment_mode
  return { ...result, facade_policy: { assessment_mode: mode, project_selection: 'current_engagement_only',
    ...(mode === 'src' ? { http_capture: { methods: ['GET', 'HEAD', 'OPTIONS'], max_bytes: 65536, timeout_seconds: 15 },
      denied_actions: ['tool.sqlmap', 'tool.yakit_replay', 'tool.tscanplus_request', 'test.run_external', 'scenario.run', 'test.run_scenario'],
      stop_policy: 'direct_evidence_obtained', browser_actions: ['wait', 'waitForSelector', 'waitForDialog', 'waitForURL'] }
      : mode === 'pentest' ? { engine_mode: 'assessment', src_stop_policy: false,
        execution_policy: 'existing_scope_identity_fixture_and_mutation_contracts' } : {}) } }
}

export async function assessmentSkillOptions(store, id, options = {}) {
  const context = readNativeContext(store, id)
  const skillRuntime = { assessment: null, browser: null, credentials: typeof store.credentialAuthentication === 'function' }
  if (context) {
    try {
      const runtime = nativeRuntimeOf(store, id, options)
      await currentProject(store, id, runtime, context, options)
      skillRuntime.assessment = true
      const saved = await callRuntime(runtime, 'recon.capabilities', { project_id: INTERNAL_PROJECT_ID }, options)
      const browser = saved.data?.providers?.find(row => row.provider === 'playwright')
      const profile = browser?.profile_readiness?.native_page_visit
      if (profile?.ready === true) skillRuntime.browser = true
      else if (browser?.catalog_verified === true && browser?.unavailable_reasons?.includes('browser_runtime_unavailable')) skillRuntime.browser = false
    } catch (error) {
      options.signal?.throwIfAborted()
      skillRuntime.assessment = false
    }
  }
  return currentSkillOptions(store, id, { registeredTools: options.registeredTools, skillRuntime })
}

/** Project selection is internal. The public facade cannot invoke private adapters. */
export async function awaCall(store, id, action, input = {}, options = {}) {
  embeddedAssessmentBridge.validateJson(input)
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('AWA input must be an object')
  if (Object.keys(input).some(key => RUNTIME_FIELDS.has(key))) throw new Error('assessment input cannot replace the fixed internal project or runtime')
  if (typeof action !== 'string' || action.startsWith('dsh.')) throw new Error('private assessment adapters are not public actions')
  let credentialUrl = null
  if (['credential_handle', 'credential_url', 'credential_auth'].some(key => Object.hasOwn(input, key))) {
    if (action !== 'identity.session' || input.renew || input.headers || input.headers_file) throw new Error('Credential handles create a session without mixing raw or renewed credentials')
    credentialUrl = assertAssessmentUrlAllowed(store, id, input.credential_url)
    const authorization = store.credentialAuthentication(id, input.credential_handle, credentialUrl, input.credential_auth || 'basic')
    const { credential_handle, credential_url, credential_auth, ...nativeInput } = input
    if (nativeInput.origin_url !== undefined && new URL(nativeInput.origin_url).origin !== new URL(credentialUrl).origin) {
      throw new Error('A credential handle cannot replace its recorded destination origin')
    }
    input = { ...nativeInput, origin_url: credentialUrl, headers: { Authorization: authorization } }
  }
  if (['project.create', 'project.list', 'integration.import', 'integration.export'].includes(action)) throw new Error('use redteam_assessment_start/import/review for this action')
  if (action === 'project.update' && ['scope', 'exclude', 'target'].some(key => Object.hasOwn(input, key))) {
    throw new Error('internal assessment scope/exclude are managed by the engagement policy')
  }
  if (action === 'action.help') {
    const local = observationActionHelp(input.name) || authenticationActionHelp(input.name) || documentDiscoveryActionHelp(input.name)
      || evidenceDiffActionHelp(input.name) || sourcemapDiscoveryActionHelp(input.name)
      || captureBatchActionHelp(input.name) || localAssessmentActionHelp(input.name)
    if (local) {
      if (Object.keys(input).some(key => key !== 'name')) throw new Error('action.help accepts only the exact action name')
      return assessmentHelpPolicy(store, id, local)
    }
  }
  if (action === 'value.hash') {
    options.signal?.throwIfAborted()
    return hashAssessmentValue(input)
  }
  if (isLocalAssessmentAction(action)) {
    const skillOptions = ['skill.index', 'intel.search', 'intel.get'].includes(action)
      ? await assessmentSkillOptions(store, id, options) : null
    return observedCall(store, id, action, input, options, () => runLocalAssessmentAction(store, id, action, input,
      skillOptions ? { ...options, skillRuntime: skillOptions.capabilities } : options))
  }
  if (action === 'tool.route' && !readNativeContext(store, id)) {
    throw Object.assign(new Error('tool.route reads an existing internal assessment only; prepare a concrete authorized HTTP scope first'),
      { code: 'ASSESSMENT_ROUTE_CONTEXT' })
  }
  if (isCaptureBatchAction(action)) {
    const context = readNativeContext(store, id)
    if (!context) throw new Error('Batch capture requires an already prepared internal assessment')
    const requests = captureBatchRequests(input)
    let result
    if (requests.every(request => !Object.hasOwn(request, 'cookie_evidence_ids'))) {
      const runtime = nativeRuntimeOf(store, id, options)
      const fixed = validateNativeContext(store, id, runtime, context)
      result = await observedCall(store, id, action, input, options, () => callRuntime(runtime, 'dsh.http.capture_batch', {
        project_id: INTERNAL_PROJECT_ID, requests, ...(input.stop_on_error === undefined ? {} : { stop_on_error: input.stop_on_error }), context: fixed }, options))
      result = { ...result, requests_sent: result.data.requests_sent, dispatch_uncertain: result.data.uncertain > 0,
        note: 'One fixed native worker; captured-session cookies and live source stops are checked per dispatch. Counters with unavailable transport receipts remain unknown.',
        data: { ...result.data, results: result.data.results.map(row => row.state === 'captured' ? { ...row,
          observation_next_step: { tool: 'redteam_assessment_run', arguments: { action: 'evidence.read', input: { evidence_id: row.evidence_id } }, offline_only: true } } : row) } }
    } else result = await captureAssessmentBatch(input, (name, request) => awaCall(store, id, name, request, options), options)
    return { ...result, data: { ...result.data, results: result.data.results.map(row => row.observation_next_step
      ? { ...row, observation_next_step: { ...row.observation_next_step,
        arguments: { engagement: id, ...row.observation_next_step.arguments } } } : row) } }
  }
  if (isObservationAction(action) || isAuthenticationAction(action) || isDocumentDiscoveryAction(action)
    || isEvidenceDiffAction(action) || isSourcemapDiscoveryAction(action)) {
    const context = readNativeContext(store, id)
    if (!context) throw new Error('offline observation requires an already prepared internal assessment; it does not initialize one')
    const runtime = nativeRuntimeOf(store, id, options)
    await currentProject(store, id, runtime, context, options)
    const execute = { 'evidence.read': readAssessmentResponse, 'evidence.headers': readAssessmentHeaders,
      'surface.from_evidence': discoverAssessmentJavascript, 'identity.session_from_evidence': createCookieSession,
      'surface.from_document': discoverAssessmentDocument, 'evidence.diff': compareAssessmentEvidence,
      'surface.from_sourcemap': discoverAssessmentSourcemap }[action]
    try { return await observedCall(store, id, action, input, options, () => execute(store, id, runtime, context, input, options)) }
    catch (error) { throw recoverAssessmentAction(error, action, input, id) }
  }
  if (Object.hasOwn(input, 'cookie_evidence_ids')) {
    if (!['http.capture', 'http.preflight'].includes(action)) throw new Error('cookie_evidence_ids is a facade field for http.capture/http.preflight only')
    const context = readNativeContext(store, id)
    if (!context) throw new Error('cookie evidence requires an already prepared internal assessment')
    const runtime = nativeRuntimeOf(store, id, options)
    await currentProject(store, id, runtime, context, options)
    try { input = await prepareCookieCapture(store, id, runtime, context, input, options) }
    catch (error) { throw recoverAssessmentAction(error, action, input, id) }
  }
  embeddedAssessmentBridge.validateRequest(action, ['action.help', 'runtime.probe'].includes(action)
    ? input : { ...input, project_id: INTERNAL_PROJECT_ID })
  if (['action.help', 'runtime.probe'].includes(action)) {
    // Help/runtime metadata are usable before the engagement has a concrete
    // HTTP context. They do not initialize a project or arm continuation.
    const runtime = nativeRuntimeOf(store, id, options)
    try {
      const result = await callRuntime(runtime, action, input, options)
      return action === 'action.help' ? assessmentHelpPolicy(store, id, withCookieCaptureHelp(
        input.name === undefined && result.ok === true ? { ...result, facade_actions: [
          ...observationActionCatalog(), ...authenticationActionCatalog(), documentDiscoveryActionHelp('surface.from_document').data,
          evidenceDiffActionHelp('evidence.diff').data, sourcemapDiscoveryActionHelp('surface.from_sourcemap').data,
          captureBatchActionHelp('http.capture_batch').data, ...localAssessmentActionCatalog(),
        ] } : result, input.name)) : result
    } catch (error) { throw recoverAssessmentAction(error, action, input, id) }
  }
  let rejected = [], originalIndices = []
  if (action === 'surface.batch' && Array.isArray(input.operations)) {
    if (!input.operations.length || input.operations.length > 50 || input.operations.some(item => !item || typeof item !== 'object' || Array.isArray(item))) throw new Error('surface.batch requires 1..50 operation objects')
    const operations = []
    for (const [index, operation] of input.operations.entries()) {
      try { assertAssessmentUrlAllowed(store, id, operation.url); operations.push(operation); originalIndices.push(index) }
      catch { rejected.push({ index, status: 'rejected', error_code: 'ASSESSMENT_SCOPE',
        message: 'Operation URL is invalid, outside scope or excluded; correct this item without widening scope', next_action: 'action.help', help_input: { name: 'surface.register' } }) }
    }
    if (!operations.length) return { ok: true, data: { results: rejected, accepted: 0, rejected: rejected.length,
      plan_added: 0, requests_sent: 0, next_action: 'plan.next' }, requests_sent: 0 }
    input = { ...input, operations }
  }
  const locators = [...actionLocators(input), ...(credentialUrl ? [credentialUrl] : [])].map(value => assertAssessmentUrlAllowed(store, id, value))
  let binding = readAwaBinding(store, id)
  if (!binding || locators.some(value => !targetWithinScope(value, binding.scope, binding.exclude))) {
    const seed = locators.length ? { target: (() => { const url = new URL(locators[0]); url.search = ''; return url.href })(),
      scope: assessmentScopesForUrls(store, id, locators) } : {}
    const prepared = await ensureNativeAssessment(store, id, seed, options)
    if (prepared.context?.ready !== true) throw new Error('internal assessment requires a concrete authorized HTTP URL scope')
    binding = readAwaBinding(store, id)
  }
  const runtime = nativeRuntimeOf(store, id, options)
  await currentProject(store, id, runtime, binding, options)
  if (isScopedAssessmentMode(policyOf(store, id).assessment_mode)) {
    for (const field of ['path', 'source_path', 'headers_file', 'body_file', 'output_dir']) {
      if (input[field] !== undefined) ownedAssessmentInputPath(store, id, input[field], binding)
    }
    for (const step of input.scenario?.steps || []) if (step.body_file !== undefined) {
      ownedAssessmentInputPath(store, id, step.body_file, binding)
    }
  }
  if (action === 'campaign.rollback' || action === 'campaign.migrate' && input.apply === true
    || action === 'campaign.start' && binding.model !== 'v2') {
    throw Object.assign(new Error('assessment model is fixed for the internal context; use a separate engagement for another model'),
      { code: 'ASSESSMENT_MODEL_IMMUTABLE' })
  }
  await assertSourceStops(store, id, runtime, binding, action, input, options)
  if (TARGET_ACTIONS.has(action) || ['http.preflight', 'scenario.preflight'].includes(action)) {
    assertCookieSessionRequest(store, id, binding, input, action)
    for (const step of input.scenario?.steps || []) assertCookieSessionRequest(store, id, binding, step, action)
  }
  const args = ['action.help', 'runtime.probe'].includes(action) ? input : { ...input, project_id: binding.project_id }
  let result
  try { result = await observedCall(store, id, action, input, options, () => callRuntime(runtime, action, args, options)) }
  catch (error) { throw recoverAssessmentAction(error, action, input, id) }
  if (rejected.length && result.ok === true && Array.isArray(result.data?.results)) {
    const rows = result.data.results.map(row => ({ ...row, index: originalIndices[row.index] })).concat(rejected).sort((a, b) => a.index - b.index)
    result = { ...result, data: { ...result.data, results: rows,
      accepted: rows.filter(row => row.status === 'accepted').length, rejected: rows.filter(row => row.status === 'rejected').length } }
  }
  if (action === 'campaign.start' && typeof result.data?.campaign?.id === 'string') {
    const latest = readNativeContext(store, id)
    persistNativeContext(store, id, { ...latest, campaign_id: result.data.campaign.id, updated_at: new Date().toISOString() })
  }
  if (action === 'tool.route') result = withCookieToolAdvice(store, id, binding, result)
  return observationGuidance(withAssessmentGuidance(result, id, readNativeContext(store, id), action, input), id, action, input)
}

function ensureReviewTable(store, id) {
  const db = store.db(id)
  db.exec(`CREATE TABLE IF NOT EXISTS awa_review (
    external_id TEXT PRIMARY KEY, candidate_id TEXT NOT NULL, project_id TEXT NOT NULL,
    review_json TEXT NOT NULL, receipt_sha256 TEXT NOT NULL, reviewed_at TEXT NOT NULL
  )`)
  return db
}

function ensureImportTable(store, id) {
  const db = store.db(id)
  db.exec(`CREATE TABLE IF NOT EXISTS assessment_import (
    import_id TEXT PRIMARY KEY, project_id TEXT NOT NULL, source_id TEXT NOT NULL, received_at TEXT NOT NULL
  )`)
  return db
}

function knownImport(store, id, binding, importId) {
  if (typeof importId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,199}$/.test(importId)) return false
  if ([...(binding.import_ids || []), binding.last_import_id].includes(importId)) return true
  return !!ensureImportTable(store, id).prepare('SELECT 1 FROM assessment_import WHERE import_id = ? AND project_id = ? AND source_id = ?')
    .get(importId, INTERNAL_PROJECT_ID, sourceEngagementId(store, id))
}

function verifiedProof(item) {
  if (item.usable_for_confirmation !== true || !Array.isArray(item.decisions) || !Array.isArray(item.findings)) return null
  for (const proof of item.decisions) {
    if (proof.mode !== 'machine' || proof.proof_mode !== 'machine' || proof.outcome !== 'confirmed'
      || proof.current !== true || proof.validated !== true || proof.usable_for_confirmation !== true
      || typeof proof.decision_id !== 'string' || !Array.isArray(proof.evidence_ids) || !proof.evidence_ids.length
      || !Array.isArray(proof.evidence_hashes) || proof.evidence_hashes.length !== proof.evidence_ids.length) continue
    if (!proof.evidence_ids.every(id => typeof id === 'string' && proof.evidence_hashes.some(record =>
      record.evidence_id === id && /^[a-f0-9]{64}$/.test(record.sha256 || '') && record.complete === true))) continue
    const finding = item.findings.find(finding => finding.decision_id === proof.decision_id && finding.mode === 'machine'
      && ['confirmed', 'machine_confirmed'].includes(finding.status) && finding.current === true && finding.usable_for_confirmation === true
      && typeof finding.title === 'string' && finding.title.trim()
      && ['critical', 'high', 'medium', 'low', 'info'].includes(finding.severity))
    if (!finding) continue
    return { ...proof, finding }
  }
  return null
}

function persistReviews(store, id, binding, exported, expectedImportId, verify = false) {
  if (!exported || exported.schema !== EXCHANGE_SCHEMA || exported.project_id !== binding.project_id
    || exported.import_id !== expectedImportId
    || !Array.isArray(exported.candidates) || exported.candidates.length > MAX_EXCHANGE_ITEMS) throw new Error('invalid AWA review receipt identity or budget')
  const db = ensureReviewTable(store, id)
  const rows = []
  const privateValues = exchangeSecrets(db)
  const ledger = new EvidenceLedger(db)
  db.exec('SAVEPOINT awa_receipts')
  try {
    for (const item of exported.candidates) {
      if (item.engagement_id !== sourceEngagementId(store, id)
        || item.source?.engagement_id !== sourceEngagementId(store, id)) continue
      const externalId = item.external_id || item.source?.external_id
      const candidateId = item.candidate_id || item.id
      if (typeof externalId !== 'string' || typeof candidateId !== 'string' || !/^vuln:[1-9][0-9]*$/.test(externalId)) continue
      if (item.source?.provider !== 'dsh-purge' || item.source.external_id !== externalId) continue
      if (!knownImport(store, id, binding, item.source.import_id)) continue
      if (candidateId !== 'C-' + digest(['dsh-purge', sourceEngagementId(store, id), externalId]).slice(0, 24)) continue
      const vulnId = Number(externalId.slice(5))
      const vuln = db.prepare('SELECT * FROM vuln WHERE id = ?').get(vulnId)
      if (!vuln) continue
      if (policyOf(store, id).assessment_mode === 'src' && vuln.src_eligible !== 1) {
        rows.push({ external_id: externalId, candidate_id: candidateId, status: 'excluded_hardening',
          reason: 'source_is_not_a_submittable_security_candidate' }); continue
      }
      const currentUrl = exchangeUrl(vuln.target, privateValues)
      if (!currentUrl) continue
      const endpoint = new URL(currentUrl); endpoint.search = ''
      if (item.url !== endpoint.href) continue
      const previous = db.prepare('SELECT review_json, receipt_sha256 FROM awa_review WHERE external_id = ?').get(externalId)
      if (previous && digest(previous.review_json) !== previous.receipt_sha256) throw new Error('AWA receipt integrity mismatch')
      const sourceClaim = previous ? JSON.parse(previous.review_json).source_claim : null
      const reviewed = { ...item, source_claim: sourceClaim || {
        title: exchangeTitle(vuln.title, privateValues), severity: vuln.severity, status: vuln.status,
        gained: vuln.gained ? reportText(vuln.gained, privateValues) : null,
        cve: typeof vuln.cve === 'string' && /^(?:CVE|CNVD|CNNVD)-[0-9-]+$/i.test(vuln.cve) ? vuln.cve : null } }
      const receipt = JSON.stringify(reviewed)
      db.prepare(`INSERT INTO awa_review VALUES(?,?,?,?,?,?) ON CONFLICT(external_id)
        DO UPDATE SET candidate_id=excluded.candidate_id,project_id=excluded.project_id,
        review_json=excluded.review_json,receipt_sha256=excluded.receipt_sha256,reviewed_at=excluded.reviewed_at`)
        .run(externalId, candidateId, binding.project_id, receipt, digest(receipt), new Date().toISOString())
      // A receipt is deliberately inferred until AWA exports a current,
      // independently checked proof. No scanner or analyst label upgrades it.
      const record = ledger.record({ operation: 'awa_review', parameters: { target: vuln.target,
        project_id: binding.project_id, candidate_id: candidateId, external_id: externalId }, result: reviewed,
        confidence: 'inferred', authority: 'tool-output', engagement_id: id,
        recorded_by: 'awa-review', limitations: ['Imported local review metadata; inspect AWA decision and evidence before confirmation.'] })
      if (!record.ok) throw new Error(record.error)
      const proof = verify ? verifiedProof(item) : null
      if (proof) {
        const proofBinding = { schema: 'dsh-purge-finding-proof/v1', engagement_id: id,
          vuln_id: vulnId, target: vuln.target, project_id: binding.project_id,
          candidate_id: candidateId, operation_id: proof.operation_id || item.operation_id,
          category: proof.finding.category || proof.category || item.category,
          input_key: proof.input_key ?? null, input_location: proof.input_location ?? null,
          input_selector: proof.input_selector ?? null, proof_scope: proof.proof_scope || proof.oracle_type,
          finding_id: proof.finding.finding_id, decision_id: proof.decision_id,
          title: proof.finding.title, cve: null, gained: null, severity_cap: proof.finding.severity,
          limitations: proof.finding.limitations || proof.limitations || [],
          evidence_ids: proof.evidence_ids, evidence_hashes: proof.evidence_hashes,
          receipt_sha256: digest(receipt) }
        proofBinding.native_state = captureNativeProofState(store, id, proofBinding)
        const observation = ledger.upgradeObserved({ claimed_ev_id: record.ev_id, verified_by: 'awa-current-proof',
          verified_result: { target: vuln.target, direct_evidence: true, proof_type: 'awa_decision',
            observation: `AWA ${binding.project_id} revalidated ${proof.category || item.category} decision ${proof.decision_id} with ${proof.evidence_ids.length} intact current controls.`,
            decision_id: proof.decision_id, oracle_type: proof.oracle_type,
            evidence_ids: proof.evidence_ids, evidence_hashes: proof.evidence_hashes,
            proof_mode: 'machine', current: true, validated: true, proof_scope: proofBinding.proof_scope } },
          { collector: 'native-assessment-review', invocation_id: proof.decision_id + ':' + digest(receipt),
            material_sha256: proof.evidence_hashes.map(value => value.sha256), binding: proofBinding })
        if (!observation.ok) throw new Error(observation.error)
        store.updateVuln(id, vulnId, { status: 'confirmed', evidence_refs: [observation.ev_id],
          title: proof.finding.title, severity: proof.finding.severity, cve: null, gained: null,
          category: proofBinding.category, finding_kind: 'vulnerability',
          evidence: `AWA current ${proof.category || item.category} proof: ${proof.decision_id}; ${observation.ev_id}` })
        rows.push({ external_id: externalId, candidate_id: candidateId, evidence_ref: observation.ev_id,
          status: 'verified', vuln_status: 'confirmed', stop: policyOf(store, id).assessment_mode === 'src' })
      } else {
        rows.push({ external_id: externalId, candidate_id: candidateId, evidence_ref: record.ev_id,
          status: verify ? 'confirmation_pending' : 'review_received', vuln_status: vuln.status,
          reason: verify ? 'current_machine_proof_and_finding_required' : 'receipt_only' })
      }
    }
    db.exec('RELEASE awa_receipts')
  } catch (error) { db.exec('ROLLBACK TO awa_receipts; RELEASE awa_receipts'); throw error }
  return rows
}

export async function awaSync(store, id, args = {}, options = {}) {
  embeddedAssessmentBridge.validateJson(args)
  if (!args || typeof args !== 'object' || Array.isArray(args)
    || Object.keys(args).some(key => !['mode', 'engagement', 'import_id', 'offset', 'limit'].includes(key))) {
    throw new Error('assessment import/review cannot replace its fixed internal context')
  }
  const mode = args.mode || 'export'
  if (!['export', 'push', 'pull', 'verify'].includes(mode)) throw new Error('invalid AWA sync mode')
  if (mode === 'export') return buildAwaExchange(store, id, args)
  const page = mode === 'push' ? buildAwaExchange(store, id, args) : null
  let binding = readAwaBinding(store, id)
  const urls = page?.exchange.candidates.map(item => item.url) || []
  if (!binding || urls.some(value => !targetWithinScope(value, binding.scope, binding.exclude))) {
    const prepared = await ensureNativeAssessment(store, id, urls.length ? { target: urls[0], scope: assessmentScopesForUrls(store, id, urls) } : {}, options)
    if (prepared.context?.ready !== true) throw new Error('internal assessment requires a concrete authorized HTTP URL scope')
    binding = readAwaBinding(store, id)
  }
  const runtime = nativeRuntimeOf(store, id, options)
  await currentProject(store, id, runtime, binding, options)
  if (mode === 'push') {
    if (!page.exchange.candidates.length) return { ...page, imported: 0, note: 'No eligible candidates in this page.' }
    return observedCall(store, id, 'integration.import', { offset: page.offset, limit: page.limit }, options, async () => {
      const result = await callRuntime(runtime, 'integration.import', { project_id: binding.project_id, exchange: page.exchange }, options)
      options.signal?.throwIfAborted()
      if (typeof result.data?.import_id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,199}$/.test(result.data.import_id)) throw new Error('AWA import did not return its persistent import_id')
      ensureImportTable(store, id).prepare('INSERT OR IGNORE INTO assessment_import VALUES(?,?,?,?)')
        .run(result.data.import_id, INTERNAL_PROJECT_ID, sourceEngagementId(store, id), new Date().toISOString())
      const current = readAwaBinding(store, id)
      const next = { ...current, last_import_id: result.data.import_id,
        import_ids: [...new Set([...(current.import_ids || []), result.data.import_id])].slice(-128),
        last_sync_at: new Date().toISOString() }
      persistBinding(store, id, next)
      return withAssessmentGuidance({ ...result, offset: page.offset, limit: page.limit, next_offset: page.next_offset,
        skipped: page.skipped, requests_sent: 0 }, id, next, 'integration.import')
    })
  }
  const importId = args.import_id || binding.last_import_id
  if (!knownImport(store, id, binding, importId)) throw new Error('AWA pull requires an import_id previously pushed by this engagement')
  const offset = boundedInteger(args.offset, 0, Number.MAX_SAFE_INTEGER), limit = boundedInteger(args.limit, 50, 100)
  return observedCall(store, id, 'integration.export', { import_id: importId, offset, limit }, options, async () => {
    const result = await callRuntime(runtime, 'integration.export', { project_id: binding.project_id,
      import_id: importId, offset, limit }, options)
    options.signal?.throwIfAborted()
    const reviews = persistReviews(store, id, readNativeContext(store, id), result.data, importId, mode === 'verify')
    return withAssessmentGuidance({ ...result, reviews, requests_sent: 0,
      note: mode === 'verify' ? 'Only revalidated current machine proofs with intact controls and confirmed findings were promoted; other discoveries remain pending.'
        : 'Review receipts were saved to the local ledger; source claims did not change vulnerability confirmation.' },
    id, readNativeContext(store, id), 'integration.export')
  })
}

export function awaReviewRows(store, id) {
  const db = ensureReviewTable(store, id)
  return db.prepare('SELECT external_id,candidate_id,project_id,receipt_sha256,reviewed_at FROM awa_review ORDER BY reviewed_at DESC LIMIT 200').all()
}

export const assessmentRun = awaCall

export async function assessmentImport(store, id, args = {}, options = {}) {
  if (!args || typeof args !== 'object' || Array.isArray(args)
    || Object.keys(args).some(key => !['engagement', 'offset', 'limit', 'page_token'].includes(key))) throw new Error('invalid assessment import fields')
  const page = resolvePage(store, id, 'source_candidates', args, { maximum: MAX_EXCHANGE_ITEMS })
  const result = await awaSync(store, id, { mode: 'push', offset: page.offset, limit: page.limit }, options)
  return { ...result, page_kind: 'source_candidates', next: result.ok === true
    ? nextPage(store, id, 'source_candidates', page, { offset: result.next_offset }, 'redteam_assessment_import') : null }
}

export async function assessmentReview(store, id, args = {}, options = {}) {
  embeddedAssessmentBridge.validateJson(args)
  if (!args || typeof args !== 'object' || Array.isArray(args)
    || Object.keys(args).some(key => !['verify', 'engagement', 'offset', 'limit', 'page_token'].includes(key))) throw new Error('invalid native assessment review fields')
  if (args.verify !== undefined && typeof args.verify !== 'boolean') throw new Error('assessment review verify must be boolean')
  const page = resolvePage(store, id, 'assessment_candidates', args, { verify: args.verify ?? false })
  const { offset, limit, verify } = page
  let binding = readNativeContext(store, id)
  if (!binding) {
    const prepared = await ensureNativeAssessment(store, id, {}, options)
    if (prepared.context?.ready !== true) throw new Error('internal assessment requires a concrete authorized HTTP URL scope')
    binding = readNativeContext(store, id)
  }
  const runtime = nativeRuntimeOf(store, id, options)
  await currentProject(store, id, runtime, binding, options)
  // Unfiltered export is still local to this one fixed engagement/project. It
  // lets native review cover every imported batch with its own stable cursor.
  return observedCall(store, id, 'integration.export', { offset, limit }, options, async () => {
    const result = await callRuntime(runtime, 'integration.export', { project_id: INTERNAL_PROJECT_ID, offset, limit }, options)
    options.signal?.throwIfAborted()
    const reviews = persistReviews(store, id, readNativeContext(store, id), result.data, null, verify)
    return withAssessmentGuidance({ ...result, engine: ASSESSMENT_ENGINE, reviews, page_kind: 'assessment_candidates',
      offset: result.data?.offset ?? offset, limit: result.data?.limit ?? limit,
      next_offset: result.data?.next_offset ?? null, candidate_total: result.data?.candidate_total,
      next: result.ok === true ? nextPage(store, id, 'assessment_candidates', page,
        { offset: result.data?.next_offset ?? null }, 'redteam_assessment_review') : null,
      requests_sent: 0, note: verify ? 'Current machine proofs were rechecked across this engagement; pending items remain visible.'
        : 'Local review receipts were retained across all imported batches; source claims are not confirmations.' },
    id, readNativeContext(store, id), 'integration.export')
  })
}
