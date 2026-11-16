/** Classify trusted typed receipts, without interpreting target text or saving request material. */
export const ATTRIBUTION_CLASSES = Object.freeze(['ok', 'platform_denied', 'http_permission_response',
  'http_rate_limit_response', 'runtime_error', 'uncertain'])
const classes = new Set(ATTRIBUTION_CLASSES)
const platformCodes = new Set(['ASSESSMENT_SCOPE', 'ASSESSMENT_MODE', 'ASSESSMENT_POLICY',
  'SRC_STOPPED_AT_EVIDENCE', 'SRC_STOP_SNAPSHOT', 'SRC_MODEL_OBSERVATION_FORBIDDEN',
  'SRC_NOT_SUBMITTABLE', 'REDTEAM_DELEGATION_DENIED', 'REDTEAM_LEAF_DELEGATION_DENIED',
  'REDTEAM_AGENT_CAP', 'scope', 'scope_excluded', 'src_policy', 'src_stopped',
  'src_stop', 'src_stop_snapshot', 'stopped_at_evidence', 'src_action_denied', 'src_write_denied',
  'assessment_mode', 'assessment_mode_mismatch', 'mutation_not_allowed', 'effect_not_allowed', 'dsh_scope',
  'out_of_scope', 'capture_batch_context', 'capture_batch_source', 'capture_batch_cookie'])
const referenceNames = ['operation_id', 'obligation_id', 'evidence_id', 'finding_id',
  'decision_id', 'run_id', 'recipe_id', 'hypothesis_id', 'session_id']
const reference = value => typeof value === 'string' && /^[A-Za-z][A-Za-z0-9_-]{0,199}$/.test(value)
const machineCode = value => typeof value === 'string' && /^[A-Za-z][A-Za-z0-9_]{0,79}$/.test(value)
const actionName = value => typeof value === 'string' && /^[a-z][a-z0-9_.]{0,95}$/.test(value)
const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {}

function referencesOf(...sources) {
  const references = {}
  for (const source of sources) for (const name of referenceNames) {
    if (reference(source?.[name])) references[name] = source[name]
  }
  return references
}

/** Only the facade's actual result/error is input. HTTP 403 is not evidence of a WAF. */
export function classifyAssessmentOutcome(action, result, error) {
  const data = object(result?.data), run = object(data.run), failure = object(error || result?.error)
  const recovery = object(failure.recovery), details = object(failure.details)
  const code = failure.code ?? result?.error_code ?? data.error_code ?? run.error_code
  const status = data.status_code
  let classification = 'ok'
  if (failure.dispatch_uncertain === true || recovery.dispatch_uncertain === true
    || recovery.effect_unknown === true || run.effect?.unknown === true
    || ['effect_unknown', 'dispatch_uncertain', 'run_uncertain'].includes(code)
    || action === 'http.capture' && result?.ok === true && data.complete === false) classification = 'uncertain'
  else if (platformCodes.has(code)) classification = 'platform_denied'
  else if (['http.capture', 'identity.verify'].includes(action) && [401, 403].includes(status)) classification = 'http_permission_response'
  else if (action === 'http.capture' && status === 429) classification = 'http_rate_limit_response'
  else if (error || result?.ok !== true || ['failed', 'cancelled'].includes(run.status)) classification = 'runtime_error'
  const references = referencesOf(data, run, details, recovery)
  if (reference(data.id) && action === 'http.capture') references.evidence_id = data.id
  return { class: classification, ...(actionName(action) ? { action } : {}),
    ...(machineCode(code) ? { code } : {}),
    ...(Number.isInteger(status) && status >= 100 && status <= 599 ? { status_code: status } : {}), references }
}

/** Bounded diagnostics: counts are cumulative; each non-ok class retains three ID-only samples. */
export function createFailureAttribution() {
  const counts = Object.fromEntries(ATTRIBUTION_CLASSES.map(name => [name, 0])), samples = {}
  return Object.freeze({
    observe(value) {
      if (!value || !classes.has(value.class)) return
      counts[value.class]++
      if (value.class === 'ok') return
      const sample = { ...(actionName(value.action) ? { action: value.action } : {}),
        ...(machineCode(value.code) ? { code: value.code } : {}),
        ...(Number.isInteger(value.status_code) && value.status_code >= 100 && value.status_code <= 599
          ? { status_code: value.status_code } : {}), references: referencesOf(object(value.references)) }
      samples[value.class] = [...(samples[value.class] || []), sample].slice(-3)
    },
    snapshot() { return { counts: { ...counts }, samples: structuredClone(samples),
      target_defense_inferred: false, evidence_authority_granted: false } },
  })
}
