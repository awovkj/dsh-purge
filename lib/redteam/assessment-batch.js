/** Bounded captures through the existing facade, never a second transport. */
import { artifactError } from './assessment-artifacts.js'

export const MAX_CAPTURE_BATCH = 20
const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])
const REQUEST_FIELDS = new Set(['operation_id', 'url', 'headers', 'session_id', 'resource_id',
  'cookie_evidence_ids', 'idempotency_key', 'timeout', 'max_bytes', 'effect'])
const HELP = { required: ['requests'], fields: {
  requests: '1..20 explicit http.capture inputs. Operations must declare GET/HEAD/OPTIONS and effect:read_only; each requires a unique idempotency_key.',
  stop_on_error: 'Boolean, default true. False continues only after a known zero-request rejection; uncertain dispatch always stops.' },
notes: ['Requests without anonymous cookie_evidence_ids use one fixed native worker and recheck scope, identity, captured-session Cookie restrictions and live SRC stops before each dispatch. Anonymous Cookie chains retain the precise facade path.',
  'An exact native already_preflighted receipt can reuse its preparation; the actual operation method is inspected and capture rechecks every gate. The same explicit idempotency_key can return its existing E-ID without a new request.',
  'Requests run in supplied order, one at a time. No invented URLs, automatic redirect following, generated keys, retries or response bodies.',
  'Original indices and actual E-IDs remain available after partial execution. Captures do not confirm vulnerabilities or complete coverage.',
  'Inspect uncertain results on the same request/run identity; do not automatically replay.'] }
export const isCaptureBatchAction = action => action === 'http.capture_batch'
export const captureBatchActionHelp = name => isCaptureBatchAction(name)
  ? { ok: true, data: { action: name, group: 'dsh_embedded_capture', contract_version: 1,
    project_required: true, ...HELP }, requests_sent: 0 } : null

export function captureBatchRequests(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)
    || Object.keys(input).some(key => !['requests', 'stop_on_error'].includes(key))
    || input.stop_on_error !== undefined && typeof input.stop_on_error !== 'boolean'
    || !Array.isArray(input.requests) || input.requests.length < 1 || input.requests.length > MAX_CAPTURE_BATCH) {
    throw artifactError('ASSESSMENT_BATCH_FIELDS', 'Use action.help for http.capture_batch with 1..20 explicit requests')
  }
  const keys = new Set()
  return input.requests.map(request => {
    if (!request || typeof request !== 'object' || Array.isArray(request)
      || Object.keys(request).some(key => !REQUEST_FIELDS.has(key))
      || typeof request.operation_id !== 'string' || !/^[A-Za-z][A-Za-z0-9_-]{0,199}$/.test(request.operation_id)
      || request.effect !== undefined && request.effect !== 'read_only'
      || typeof request.idempotency_key !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(request.idempotency_key)
      || keys.has(request.idempotency_key)) {
      throw artifactError('ASSESSMENT_BATCH_REQUEST', 'Each item needs an actual operation_id, unique idempotency_key and read-only capture fields')
    }
    keys.add(request.idempotency_key)
    return { ...request, effect: 'read_only' }
  })
}

const codeOf = value => typeof value === 'string' && /^[A-Za-z0-9_:-]{1,100}$/.test(value) ? value : 'ASSESSMENT_BATCH_ERROR'
const idOf = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,199}$/.test(value) ? value : null
function referencesOf(value) {
  return Object.fromEntries(['run_id', 'evidence_id', 'recipe_id', 'session_id']
    .map(key => [key, [value?.recovery, value?.details, value?.data, value?.data?.run]
      .map(source => idOf(source?.[key])).find(Boolean)]).filter(([, value]) => value))
}

/** invoke(action,input) is the existing, engagement-bound awaCall. */
export async function captureAssessmentBatch(input, invoke, options = {}) {
  const requests = captureBatchRequests(input), rows = []
  let attempts = 0, unknown = false, stopped = null
  for (const [index, request] of requests.entries()) {
    if (options.signal?.aborted) { stopped = 'cancelled'; break }
    let captureStarted = false
    try {
      let checked, preparedAgain = false
      try { checked = await invoke('http.preflight', request) }
      catch (error) {
        // Native preflight runs all gates before returning this precise loop
        // receipt. Reuse only that contract, never a generic preflight failure.
        if (error.code !== 'already_preflighted'
          || (error.recovery?.next_action || error.details?.next_action) !== 'http.capture') throw error
        const inspected = await invoke('surface.inspect', { operation_id: request.operation_id })
        if (inspected?.ok !== true) throw artifactError('ASSESSMENT_BATCH_METHOD', 'The actual operation method could not be inspected')
        checked = { ok: true, data: { method: inspected.data?.operation?.method } }
        preparedAgain = true
      }
      if (checked?.ok !== true) throw Object.assign(new Error('Native preflight did not accept this request'), {
        code: codeOf(checked?.error_code || checked?.error?.code), recovery: { requests_sent: 0 } })
      const method = checked.data?.method || checked.data?.request?.method
      if (!READ_METHODS.has(method)) throw artifactError('ASSESSMENT_BATCH_METHOD', 'The actual operation must use GET, HEAD or OPTIONS')
      options.signal?.throwIfAborted()
      captureStarted = true
      attempts++
      const result = await invoke('http.capture', request)
      if (result?.ok !== true || !/^E-[a-f0-9]{32}$/.test(result.data?.id || '')) {
        throw Object.assign(new Error('Capture did not return an owned evidence identity'), {
          code: codeOf(result?.error_code || result?.error?.code), dispatch_uncertain: true,
          recovery: { ...referencesOf(result), automatic_retry_allowed: false } })
      }
      const data = result.data
      rows.push({ index, state: 'captured', evidence_id: data.id, operation_id: idOf(data.operation_id) || request.operation_id,
        status_code: Number.isSafeInteger(data.status) ? data.status : Number.isSafeInteger(data.status_code) ? data.status_code : null,
        capture_complete: data.complete === true, preflight_state: preparedAgain ? 'already_checked' : 'checked',
        observation_next_step: { tool: 'redteam_assessment_run', arguments: {
          action: 'evidence.read', input: { evidence_id: data.id } }, offline_only: true } })
      if (data.complete !== true) { unknown = true; stopped = 'capture_incomplete'; break }
    } catch (error) {
      const uncertain = error.dispatch_uncertain === true || error.recovery?.dispatch_uncertain === true
        || ['run_uncertain', 'effect_unknown', 'dispatch_uncertain'].includes(error.code)
        || captureStarted && error.recovery?.requests_sent !== 0
      unknown ||= uncertain
      rows.push({ index, state: uncertain ? 'uncertain' : 'rejected', error_code: codeOf(error.code),
        ...referencesOf(error), requests_sent: captureStarted && uncertain ? null : 0, automatic_retry_allowed: false })
      if (options.signal?.aborted) { stopped = 'cancelled'; break }
      if (uncertain || input.stop_on_error !== false) { stopped = uncertain ? 'dispatch_uncertain' : 'item_rejected'; break }
    }
  }
  const nextIndex = rows.length
  return { ok: true, data: { state: stopped ? 'partial' : 'completed', results: rows,
    total: requests.length, captured: rows.filter(row => row.state === 'captured').length,
    rejected: rows.filter(row => row.state === 'rejected').length,
    uncertain: rows.filter(row => row.state === 'uncertain' || row.state === 'captured' && !row.capture_complete).length,
    incomplete: rows.filter(row => row.state === 'captured' && !row.capture_complete).length,
    remaining: requests.length - nextIndex, next_index: nextIndex < requests.length ? nextIndex : null,
    stopped_reason: stopped, capture_attempts: attempts, request_count_known: attempts === 0,
    execution_strategy: 'per_item_facade',
    can_confirm: false, security_coverage_granted: false, automatic_retry_allowed: false },
    requests_sent: attempts === 0 ? 0 : null, dispatch_uncertain: unknown,
    note: 'E-IDs identify captured observations. Native idempotency may reuse a capture, so capture_attempts is not an outgoing-request count. Inspect existing runs before an explicit recovery.' }
}
