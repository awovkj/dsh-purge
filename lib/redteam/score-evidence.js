/** Optional score evidence policy; legacy text and observed proof stay distinct. */
import { EvidenceLedger } from './evidence-ledger.mjs'
import { sameEvidenceTarget } from './assessment-policy.js'
import { targetAuthority } from './score-rules.js'
import { isIP } from 'node:net'

export const HIGH_VALUE_SCORE_CODES = Object.freeze(['server-host', 'central-system', 'domain-control'])
const AUTHORITIES = new Set(['tool-output', 'request-replay', 'screenshot', 'database-record'])

export function scoreEvidenceRefs(value = []) {
  if (!Array.isArray(value) || value.length > 32 || value.some(ref => typeof ref !== 'string' || !/^ev_[a-f0-9]{64}$/.test(ref))) {
    throw new Error('score evidence_refs must contain at most 32 evidence ledger IDs')
  }
  return [...new Set(value)]
}

function sameScoreTarget(target, evidenceTarget) {
  if (typeof target !== 'string' || typeof evidenceTarget !== 'string' || !target || !evidenceTarget) return false
  if (isIP(target) && isIP(evidenceTarget)) return sameEvidenceTarget(target, evidenceTarget)
  // Two URL paths need exact binding. A named service may cite a concrete URL
  // on that same explicitly addressed service, without guessing host aliases.
  if (/^https?:\/\//i.test(target) && /^https?:\/\//i.test(evidenceTarget)) return sameEvidenceTarget(target, evidenceTarget)
  const a = targetAuthority(target), b = targetAuthority(evidenceTarget)
  return a !== null && b !== null && a === b
}

export function describeScoreEvidence(db, engagement, value, target, { code, points } = {}) {
  const refs = scoreEvidenceRefs(typeof value === 'string' ? JSON.parse(value) : value || [])
  if (!refs.length) return { state: 'legacy_text', evidence_refs: [], observed: false, outcome_bound: false, pending: [] }
  const ledger = new EvidenceLedger(db)
  const pending = []
  const highValue = HIGH_VALUE_SCORE_CODES.includes(code)
  for (const ref of refs) {
    const record = ledger.get(ref)
    if (!record || record.engagement_id !== engagement) { pending.push({ ev_id: ref, reason: 'not_in_this_engagement' }); continue }
    if (!ledger.verify(record).matched) throw new Error('score evidence integrity mismatch: ' + ref)
    const evidenceTarget = record.parameters?.target ?? record.parameters?.url ?? record.result?.target ?? record.result?.url
    if (!sameScoreTarget(target, evidenceTarget)) { pending.push({ ev_id: ref, reason: 'target_mismatch' }); continue }
    if (record.confidence !== 'observed' || !AUTHORITIES.has(record.authority)) {
      pending.push({ ev_id: ref, reason: 'observed_tool_evidence_required' }); continue
    }
    if (record.observation_state !== 'trusted') {
      pending.push({ ev_id: ref, reason: 'trusted_collector_receipt_required' }); continue
    }
    if (record.supporting_ev_ids.length && !db.prepare('SELECT claim_id FROM evidence_verification WHERE observation_id = ?').get(ref)) {
      pending.push({ ev_id: ref, reason: 'verification_link_required' }); continue
    }
    if (!record.result || typeof record.result !== 'object' || Array.isArray(record.result) || !Object.keys(record.result).length) {
      pending.push({ ev_id: ref, reason: 'actual_observation_required' }); continue
    }
    if (highValue) {
      // A current SQL/XSS finding proves that finding, not host or domain
      // control. Bind the actual observed outcome and its base score tier.
      // This is a ledger policy, not a new machine oracle for privileges.
      const outcome = record.result.score_outcome
      const certified = record.observation_provenance?.binding?.score_outcome
      if (!outcome || typeof outcome !== 'object' || Array.isArray(outcome) || outcome.code !== code
        || !certified || certified.code !== code || certified.points !== outcome.points
        || record.observation_provenance.collector === 'host-tool-dispatch'
        || typeof record.result.observation !== 'string' || !record.result.observation.trim()) {
        pending.push({ ev_id: ref, reason: 'score_outcome_binding_required', score_code: code }); continue
      }
      if (!Number.isFinite(outcome.points) || outcome.points <= 0 || !Number.isFinite(points)
        || outcome.points < points) {
        pending.push({ ev_id: ref, reason: 'score_tier_not_supported', score_code: code, required_base_points: points })
      }
    }
  }
  return { state: pending.length ? 'pending' : 'observed', evidence_refs: refs, observed: !pending.length,
    outcome_bound: highValue && !pending.length, proof_scope: highValue ? 'observed_score_outcome' : 'observed_reference',
    machine_privilege_proof: false, pending }
}
