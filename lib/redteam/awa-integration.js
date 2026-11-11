/** Native assessment evidence governance; the engine source ships in this project. */
import { createHash } from 'node:crypto'
import { isIP } from 'node:net'
import { EvidenceLedger } from './evidence-ledger.mjs'
import { targetWithinScope } from './assessment-policy.js'
import {
  ASSESSMENT_ENGINE, INTERNAL_PROJECT_ID, assessmentPolicyOf, assessmentSourceId,
  assessmentConfigOf, readNativeContext, persistNativeContext, initializeAssessment,
  ensureNativeAssessment, assessmentStatus, nativeProject, nativeRuntimeOf,
  currentNativeProject, callAssessmentRuntime, assessmentScopesForUrls,
  assertAssessmentUrlAllowed, embeddedAssessmentBridge, configureAssessment, validateAssessmentSettings,
} from './native-assessment.js'

export { ASSESSMENT_ENGINE, assessmentConfigOf, readNativeContext, initializeAssessment,
  ensureNativeAssessment, assessmentStatus }
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

export function redteamPrivateValues(db) {
  const values = new Set()
  for (const [table, column] of [['credential', 'secret_value'], ['webshell', 'pass_key']]) {
    if (db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${column} IS NOT NULL`).get().n > 2000) throw new Error('private credential context exceeds the exchange budget; export a reviewed offline manifest')
    for (const row of db.prepare(`SELECT ${column} AS secret FROM ${table} WHERE ${column} IS NOT NULL LIMIT 2000`).all()) {
      if (typeof row.secret === 'string' && row.secret.length) values.add(row.secret)
    }
  }
  return [...values].sort((left, right) => right.length - left.length)
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
  const total = db.prepare('SELECT COUNT(*) AS n FROM vuln').get().n
  const rows = db.prepare('SELECT id, title, target, severity, status, source FROM vuln ORDER BY id LIMIT ? OFFSET ?').all(limit, offset)
  const policy = policyOf(store, id)
  const candidates = [], http = [], skipped = []
  for (const row of rows) {
    const url = exchangeUrl(row.target, privateValues)
    if (!url) { skipped.push({ external_id: 'vuln:' + row.id, reason: 'explicit_public_http_url_required' }); continue }
    if (policy.scope.length && !targetWithinScope(url, policy.scope, policy.exclude)) {
      skipped.push({ external_id: 'vuln:' + row.id, reason: 'outside_source_scope_or_excluded' }); continue
    }
    const captures = db.prepare('SELECT id, method, url, status, captured_at FROM http_evidence WHERE vuln_id = ? ORDER BY id LIMIT 10').all(row.id)
    const method = captures[0]?.method || null
    candidates.push({ external_id: 'vuln:' + row.id, url, method,
      title: exchangeTitle(row.title, privateValues),
      severity: row.severity || 'info', category: candidateFamily(row.title), source_status: row.status || 'candidate',
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
    skipped, requests_sent: 0 }
}

const TARGET_ACTIONS = new Set(['http.capture', 'browser.visit', 'identity.verify', 'scenario.run',
  'tool.sqlmap', 'tool.yakit_replay', 'tool.tscanplus_request', 'test.run', 'test.run_browser',
  'test.run_scenario', 'test.run_external'])

function sourceStopMatches(target, locator) {
  let current
  try { current = new URL(locator) } catch { return false }
  if (!/^https?:\/\//i.test(target)) {
    const host = isIP(target) ? target : String(target).split(':')[0]
    return current.hostname.replace(/^\[|\]$/g, '') === host
  }
  const stopped = new URL(target)
  if (stopped.origin !== current.origin) return false
  const path = decodeURI(stopped.pathname)
  const expression = path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\\\{[A-Za-z_][\w-]*\\\}/g, '[^/]+')
  return new RegExp('^' + expression + '$').test(decodeURI(current.pathname))
}

async function assertSourceStops(store, id, runtime, binding, action, input, options) {
  if (policyOf(store, id).assessment_mode !== 'src' || !TARGET_ACTIONS.has(action)) return
  const stopped = store.srcFindings(id)
  if (!stopped.length) return
  const locators = ['url', 'verify_url', 'consumer_url', 'entry_url'].map(key => input[key]).filter(value => typeof value === 'string')
  if (typeof input.operation_id === 'string') {
    const inspected = await callRuntime(runtime, 'surface.inspect', { project_id: binding.project_id, operation_id: input.operation_id }, options)
    if (typeof inspected.data?.operation?.url === 'string') locators.push(inspected.data.operation.url)
  }
  if (!locators.length) throw new Error('SRC active action requires an explicit unstopped target binding; source direct evidence is already recorded')
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

/** Project selection is internal. The public facade cannot invoke private adapters. */
export async function awaCall(store, id, action, input = {}, options = {}) {
  embeddedAssessmentBridge.validateJson(input)
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('AWA input must be an object')
  if (Object.keys(input).some(key => RUNTIME_FIELDS.has(key))) throw new Error('assessment input cannot replace the fixed internal project or runtime')
  if (typeof action !== 'string' || action.startsWith('dsh.')) throw new Error('private assessment adapters are not public actions')
  if (['project.create', 'project.list', 'integration.import', 'integration.export'].includes(action)) throw new Error('use redteam_assessment_start/import/review for this action')
  if (action === 'project.update' && ['scope', 'exclude', 'target'].some(key => Object.hasOwn(input, key))) {
    throw new Error('internal assessment scope/exclude are managed by the engagement policy')
  }
  embeddedAssessmentBridge.validateRequest(action, ['action.help', 'runtime.probe'].includes(action)
    ? input : { ...input, project_id: INTERNAL_PROJECT_ID })
  const locators = actionLocators(input).map(value => assertAssessmentUrlAllowed(store, id, value))
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
  if (action === 'campaign.rollback' || action === 'campaign.migrate' && input.apply === true
    || action === 'campaign.start' && binding.model !== 'v2') {
    throw Object.assign(new Error('assessment model is fixed for the internal context; use a separate engagement for another model'),
      { code: 'ASSESSMENT_MODEL_IMMUTABLE' })
  }
  await assertSourceStops(store, id, runtime, binding, action, input, options)
  const args = ['action.help', 'runtime.probe'].includes(action) ? input : { ...input, project_id: binding.project_id }
  const result = await callRuntime(runtime, action, args, options)
  if (action === 'campaign.start' && typeof result.data?.campaign?.id === 'string') {
    const latest = readNativeContext(store, id)
    persistNativeContext(store, id, { ...latest, campaign_id: result.data.campaign.id, updated_at: new Date().toISOString() })
  }
  return result
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
      const vuln = db.prepare('SELECT id, target, status, title, severity, cve FROM vuln WHERE id = ?').get(vulnId)
      if (!vuln) continue
      const currentUrl = exchangeUrl(vuln.target, privateValues)
      if (!currentUrl) continue
      const endpoint = new URL(currentUrl); endpoint.search = ''
      if (item.url !== endpoint.href) continue
      const previous = db.prepare('SELECT review_json, receipt_sha256 FROM awa_review WHERE external_id = ?').get(externalId)
      if (previous && digest(previous.review_json) !== previous.receipt_sha256) throw new Error('AWA receipt integrity mismatch')
      const sourceClaim = previous ? JSON.parse(previous.review_json).source_claim : null
      const reviewed = { ...item, source_claim: sourceClaim || {
        title: exchangeTitle(vuln.title, privateValues), severity: vuln.severity, status: vuln.status,
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
        const observation = ledger.upgrade({ claimed_ev_id: record.ev_id, verified_by: 'awa-current-proof',
          verified_result: { target: vuln.target, direct_evidence: true, proof_type: 'awa_decision',
            observation: `AWA ${binding.project_id} revalidated ${proof.category || item.category} decision ${proof.decision_id} with ${proof.evidence_ids.length} intact current controls.`,
            decision_id: proof.decision_id, oracle_type: proof.oracle_type,
            evidence_ids: proof.evidence_ids, evidence_hashes: proof.evidence_hashes,
            proof_mode: 'machine', current: true, validated: true } })
        if (!observation.ok) throw new Error(observation.error)
        store.updateVuln(id, vulnId, { status: 'confirmed', evidence_refs: [observation.ev_id],
          title: proof.finding.title, severity: proof.finding.severity, cve: null,
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
    const result = await callRuntime(runtime, 'integration.import', { project_id: binding.project_id, exchange: page.exchange }, options)
    if (typeof result.data?.import_id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,199}$/.test(result.data.import_id)) throw new Error('AWA import did not return its persistent import_id')
    ensureImportTable(store, id).prepare('INSERT OR IGNORE INTO assessment_import VALUES(?,?,?,?)')
      .run(result.data.import_id, INTERNAL_PROJECT_ID, sourceEngagementId(store, id), new Date().toISOString())
    const current = readAwaBinding(store, id)
    const next = { ...current, last_import_id: result.data.import_id,
      import_ids: [...new Set([...(current.import_ids || []), result.data.import_id])].slice(-128),
      last_sync_at: new Date().toISOString() }
    persistBinding(store, id, next)
    return { ...result, offset: page.offset, next_offset: page.next_offset, skipped: page.skipped, requests_sent: 0 }
  }
  const importId = args.import_id || binding.last_import_id
  if (!knownImport(store, id, binding, importId)) throw new Error('AWA pull requires an import_id previously pushed by this engagement')
  const result = await callRuntime(runtime, 'integration.export', { project_id: binding.project_id,
    import_id: importId,
    offset: boundedInteger(args.offset, 0, Number.MAX_SAFE_INTEGER), limit: boundedInteger(args.limit, 50, 100) }, options)
  const reviews = persistReviews(store, id, binding, result.data, importId, mode === 'verify')
  return { ...result, reviews, requests_sent: 0,
    note: mode === 'verify' ? 'Only revalidated current machine proofs with intact controls and confirmed findings were promoted; other discoveries remain pending.'
      : 'Review receipts were saved to the local ledger; source claims did not change vulnerability confirmation.' }
}

export function awaReviewRows(store, id) {
  const db = ensureReviewTable(store, id)
  return db.prepare('SELECT external_id,candidate_id,project_id,receipt_sha256,reviewed_at FROM awa_review ORDER BY reviewed_at DESC LIMIT 200').all()
}

export const assessmentRun = awaCall

export async function assessmentImport(store, id, args = {}, options = {}) {
  const result = await awaSync(store, id, { ...args, mode: 'push' }, options)
  return { ...result, page_kind: 'source_candidates' }
}

export async function assessmentReview(store, id, args = {}, options = {}) {
  embeddedAssessmentBridge.validateJson(args)
  if (!args || typeof args !== 'object' || Array.isArray(args)
    || Object.keys(args).some(key => !['verify', 'engagement', 'offset', 'limit'].includes(key))) throw new Error('invalid native assessment review fields')
  const { verify = false } = args
  if (typeof verify !== 'boolean') throw new Error('assessment review verify must be boolean')
  const offset = boundedInteger(args.offset, 0, Number.MAX_SAFE_INTEGER), limit = boundedInteger(args.limit, 50, 100)
  if (!limit) throw new Error('invalid pagination: limit must be positive')
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
  const result = await callRuntime(runtime, 'integration.export', { project_id: INTERNAL_PROJECT_ID, offset, limit }, options)
  const reviews = persistReviews(store, id, readNativeContext(store, id), result.data, null, verify)
  return { ...result, engine: ASSESSMENT_ENGINE, reviews, page_kind: 'assessment_candidates',
    offset: result.data?.offset ?? offset, limit: result.data?.limit ?? limit,
    next_offset: result.data?.next_offset ?? null, candidate_total: result.data?.candidate_total,
    requests_sent: 0, note: verify ? 'Current machine proofs were rechecked across this engagement; pending items remain visible.'
      : 'Local review receipts were retained across all imported batches; source claims are not confirmations.' }
}
