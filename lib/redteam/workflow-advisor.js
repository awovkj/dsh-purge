/** Local workflow recommendations from current source proofs. No runtime initialization or dispatch. */
import { findingConfirmation } from './finding-proof.js'
import { sameEvidenceTarget, targetWithinScope } from './assessment-policy.js'
import { redteamPrivateValues, reportLocator, reportText, reportEvidenceRefs } from './report-text.js'
import { readNativeContext } from './native-assessment.js'
import { sourceStopMatches } from './source-stop.js'

const MAX_SCAN = 200
const categories = Object.freeze({
  sql_injection: 'inspect_existing_control_and_bound_impact',
  sqli: 'inspect_existing_control_and_bound_impact',
  template_injection: 'inspect_existing_consumer_and_bound_impact',
  ssti: 'inspect_existing_consumer_and_bound_impact',
  access_control: 'inspect_existing_identity_and_resource_controls',
  authorization: 'inspect_existing_identity_and_resource_controls',
  idor: 'inspect_existing_identity_and_resource_controls',
  authentication: 'inspect_existing_identity_verification',
  ssrf: 'inspect_existing_scoped_service_evidence',
  upload: 'inspect_existing_test_fixture_and_readback',
  path_traversal: 'inspect_existing_scoped_readback',
  sensitive_data_exposure: 'bound_the_already_observed_disclosure',
})
const inScope = (policy, target) => {
  try { return policy.scope.length > 0 && targetWithinScope(target, policy.scope, policy.exclude) } catch { return false }
}

export function buildWorkflowAdvice(store, engagement, input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)
    || Object.keys(input).some(key => key !== 'limit') || input.limit !== undefined
      && (!Number.isSafeInteger(input.limit) || input.limit < 1 || input.limit > 20)) {
    throw Object.assign(new Error('workflow.advice accepts only limit (1..20)'), { code: 'ASSESSMENT_ADVICE_FIELDS' })
  }
  const limit = input.limit ?? 5, policy = store.assessmentPolicy(engagement), db = store.db(engagement)
  const secrets = redteamPrivateValues(db), text = value => reportText(value, secrets, 500)
  const total = db.prepare("SELECT COUNT(*) AS n FROM vuln WHERE finding_kind='vulnerability' AND status IN ('confirmed','candidate','pending','exploited')").get().n
  const rows = db.prepare(`SELECT * FROM vuln WHERE finding_kind='vulnerability'
    AND status IN ('confirmed','candidate','pending','exploited')
    ORDER BY CASE WHEN status IN ('confirmed','exploited') THEN 0 ELSE 1 END,id LIMIT ?`).all(MAX_SCAN)
  const proofs = [], pending = [], candidates = []
  for (const row of rows) {
    if (policy.assessment_mode === 'src' && row.src_eligible !== 1 || !inScope(policy, row.target)) continue
    const metadata = { vuln_id: row.id, title: text(row.title), target: text(reportLocator(row.target, secrets)),
      declared_status: row.status, can_confirm: false }
    if (!['confirmed', 'exploited'].includes(row.status)) {
      candidates.push({ row, metadata }); continue
    }
    const proof = findingConfirmation(store, engagement, row)
    if (!proof.verified) { pending.push({ ...metadata, reason: 'current_exact_proof_required', pending: proof.pending }); continue }
    proofs.push({ row, metadata, proofs: proof.proofs })
  }
  const sourceStops = policy.assessment_mode === 'src' ? store.srcStops(engagement) : []
  const stoppedTargets = sourceStops.map(row => row.target)
  let nativeContext
  try { nativeContext = readNativeContext(store, engagement) } catch { /* No binding is inferred from unavailable metadata. */ }
  const prepareAction = nativeContext?.model === 'v2' ? 'test.prepare' : 'assessment.prepare'
  const recommendations = proofs.slice(0, limit).map(item => {
    const proof = item.proofs[0], src = policy.assessment_mode === 'src'
    return { ...item.metadata, current_proof_valid: true,
      category: text(proof.category), severity_cap: proof.severity_cap,
      proof_scope: text(proof.proof_scope), limitations: (Array.isArray(proof.limitations)
        ? proof.limitations : [proof.limitations]).slice(0, 16).map(text),
      recommendation: src ? 'preserve_stop_and_prepare_submission' : categories[proof.category] || 'inspect_existing_proof_and_remaining_controls',
      references: { operation_id: text(proof.operation_id), input_key: text(proof.input_key), ledger_ev_id: proof.ev_id },
      next_step: src ? { tool: 'redteam_src_report', arguments: { engagement, save: false }, offline_only: true }
        : { tool: 'redteam_assessment_run', arguments: { engagement, action: 'action.help',
          input: { name: prepareAction } }, offline_only: true },
      target_requests_scheduled: false,
      authorization: 'existing_scope_and_current_proof_only',
      prerequisites: src ? ['retain_direct_evidence_stop', 'check_program_rules_and_submission_material']
        : ['inspect_current_typed_provider_and_control_contract', 'verify_actual_identity_and_test_fixture_when_required',
          'new_service_or_credential_target_requires_explicit_scope'], }
  })
  const prioritized = candidates.filter(item => !stoppedTargets.some(target => {
    try { return sourceStopMatches(target, item.row.target) } catch { return true }
  }))
    .map(item => {
      const nearby = proofs.some(proof => sameEvidenceTarget(proof.row.target, item.row.target))
      let references = []
      try { references = reportEvidenceRefs(item.row.evidence_refs).evidence_refs } catch { /* Invalid declarations stay unverified. */ }
      return { ...item.metadata, priority: nearby ? 1 : references.length ? 2 : 3,
        reason: nearby ? 'same_target_as_current_verified_material' : references.length
          ? 'local_references_need_current_review' : 'concrete_control_material_required',
        evidence_refs: references, evidence_authority_granted: false,
        next_step: { tool: 'redteam_assessment_import', arguments: { engagement, limit: 50 }, offline_only: true },
        required_followup: 'review_current_machine_proof_after_candidate_import' }
    }).sort((left, right) => left.priority - right.priority || left.vuln_id - right.vuln_id)
  const assets = db.prepare('SELECT COUNT(*) AS n FROM asset').get().n
  const scanComplete = rows.length === total
  const highProofs = proofs.filter(item => item.proofs.some(proof => ['high', 'critical'].includes(proof.severity_cap))).length
  const converge = policy.assessment_mode !== 'src' && scanComplete && assets > 50 && highProofs === 0 && prioritized.length > 0
  return { ok: true, data: { schema: 'dsh-purge-workflow-advice/v1', engagement, assessment_mode: policy.assessment_mode,
    recommendations, candidate_priorities: prioritized.slice(0, limit), pending_confirmation: pending.slice(0, limit),
    source_stops: { total: sourceStops.length, must_remain_stopped: policy.assessment_mode === 'src' },
    convergence: { recommended: converge, scan_complete: scanComplete, scanned_findings: rows.length,
      source_findings: total, registered_assets: assets, current_high_impact_proofs_in_scan: highProofs,
      advice: converge ? 'Review one or two existing concrete candidates before registering more surfaces.'
        : scanComplete ? 'Use current scoped prerequisites and retain unfinished coverage.' : 'Proof inventory is bounded; no global absence or convergence claim.' },
    limits: { returned_per_list: limit, source_scan: MAX_SCAN },
    whole_scope_exhausted: false, can_claim_complete: false, automatic_dispatch: false,
    evidence_authority_granted: false, target_requests_scheduled: false }, requests_sent: 0 }
}
