/** One confirmation contract for source writes, queries and offline reports. */
import { createHash } from 'node:crypto'
import { EvidenceLedger } from './evidence-ledger.mjs'
import { sameEvidenceTarget } from './assessment-policy.js'
import { readNativeContext } from './native-assessment.js'
import { withAssessmentDatabase, readAssessmentArtifact } from './assessment-artifacts.js'

const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const ranks = { info: 0, low: 1, medium: 2, high: 3, critical: 4 }
const nativeId = /^[A-Za-z][A-Za-z0-9_-]{0,40}-[a-f0-9]{8,64}$/

function materialProjection(kind, row) {
  if (kind === 'v2_campaign') return { scope_epoch: row.scope_epoch, universe_id: row.universe_id }
  if (kind === 'v2_hypothesis') return Object.fromEntries(['family', 'security_property', 'operation_id',
    'input_key', 'relation', 'mechanism', 'consumer_context'].map(key => [key, row[key]]))
  if (kind === 'session') return Object.fromEntries(['id', 'actor_id', 'generation', 'headers',
    'credential_header_names', 'credential_nonce', 'credential_signature', 'credential_origin',
    'verified_at', 'verification_evidence_id', 'verification_assertion', 'actor_signature'].map(key => [key, row[key]]))
  return row
}

function relatedIds(value, out = new Set(), depth = 0) {
  if (!value || typeof value !== 'object' || depth > 12) return out
  for (const [key, item] of Object.entries(value)) {
    if (/(?:_id|_ids)$/.test(key)) {
      for (const id of Array.isArray(item) ? item : [item]) if (typeof id === 'string' && nativeId.test(id)) out.add(id)
    }
    if (item && typeof item === 'object') relatedIds(item, out, depth + 1)
  }
  return out
}

/** Capture only proof dependencies, not administrative counters or unrelated tasks. */
export function captureNativeProofState(store, id, proof) {
  const context = readNativeContext(store, id)
  if (!context || context.engagement_id !== id) throw new Error('native proof context is unavailable')
  const required = [proof.operation_id, proof.finding_id, proof.decision_id, ...(proof.evidence_ids || [])]
  if (required.some(value => typeof value !== 'string' || !nativeId.test(value))) throw new Error('native proof dependency identity is missing')
  const references = withAssessmentDatabase(store, id, context, db => {
    const queue = [...new Set(required)], queued = new Set(queue), visited = new Set(), rows = []
    for (let index = 0; index < queue.length; index++) {
      if (queue.length > 128) throw new Error('native proof dependency budget exceeded')
      const identity = queue[index]
      if (visited.has(identity)) continue
      visited.add(identity)
      const found = db.prepare('SELECT kind,id,document FROM entities WHERE id = ?').all(identity)
      if (!found.length && required.includes(identity)) throw new Error('native proof dependency is absent')
      for (const row of found) {
        if (Buffer.byteLength(row.document) > 4 * 1024 * 1024) throw new Error('native proof dependency exceeds budget')
        const document = JSON.parse(row.document), projected = materialProjection(row.kind, document)
        rows.push({ kind: row.kind, id: row.id, sha256: digest(projected) })
        for (const related of relatedIds(projected)) if (!queued.has(related)) { queue.push(related); queued.add(related) }
      }
    }
    return rows.sort((a, b) => (a.kind + ':' + a.id).localeCompare(b.kind + ':' + b.id))
  })
  return { context_sha256: digest({ engagement_id: id, project_id: context.project_id,
    workspace: context.workspace, model: context.model, campaign_id: context.campaign_id }), references }
}

function nativeProofCurrent(store, id, binding) {
  if (!binding.native_state || !Array.isArray(binding.native_state.references)
    || !binding.native_state.references.length || binding.native_state.references.length > 128) return false
  const context = readNativeContext(store, id)
  if (!context || digest({ engagement_id: id, project_id: context.project_id,
    workspace: context.workspace, model: context.model, campaign_id: context.campaign_id }) !== binding.native_state.context_sha256) return false
  return withAssessmentDatabase(store, id, context, db => {
    for (const reference of binding.native_state.references) {
      const row = db.prepare('SELECT document FROM entities WHERE kind = ? AND id = ?').get(reference.kind, reference.id)
      if (!row || Buffer.byteLength(row.document) > 4 * 1024 * 1024
        || digest(materialProjection(reference.kind, JSON.parse(row.document))) !== reference.sha256) return false
    }
    for (const material of binding.evidence_hashes || []) {
      const row = db.prepare("SELECT document FROM entities WHERE kind = 'evidence' AND id = ?").get(material.evidence_id)
      if (!row) return false
      const evidence = JSON.parse(row.document)
      if (evidence.sha256 !== material.sha256 || evidence.complete !== true || evidence.current === false) return false
      readAssessmentArtifact(store, id, evidence.artifact_path, material.sha256, { context })
    }
    return true
  })
}

/** Old confirmed labels remain in the ledger but are displayed as pending proof. */
export function findingConfirmation(store, id, value) {
  const pending = [], proofs = []
  let refs
  try { refs = typeof value.evidence_refs === 'string' ? JSON.parse(value.evidence_refs) : value.evidence_refs || [] }
  catch { refs = []; pending.push('invalid_evidence_refs') }
  if (!Array.isArray(refs) || refs.length > 32 || refs.some(ref => !/^ev_[a-f0-9]{64}$/.test(ref))) {
    return { verified: false, pending: ['invalid_evidence_refs'], proofs: [] }
  }
  if (!refs.length) pending.push('bound_observation_required')
  const db = store.db(id), ledger = new EvidenceLedger(db)
  for (const ref of [...new Set(refs)]) {
    try {
      const record = ledger.get(ref), provenance = record?.observation_provenance
      if (!record || record.engagement_id !== id || record.observation_state !== 'trusted'
        || !['tool-output', 'request-replay', 'screenshot', 'database-record'].includes(record.authority)) {
        pending.push('trusted_observation_required'); continue
      }
      if (!ledger.verify(record).matched) { pending.push('evidence_integrity_mismatch'); continue }
      const binding = provenance.binding
      if (!binding || binding.schema !== 'dsh-purge-finding-proof/v1'
        || binding.engagement_id !== id || binding.vuln_id !== Number(value.id)
        || !sameEvidenceTarget(value.target, binding.target)
        || !binding.operation_id || !binding.category || !binding.proof_scope
        || !binding.finding_id || !binding.decision_id || typeof binding.title !== 'string') {
        pending.push('finding_claim_binding_required'); continue
      }
      if (value.title !== binding.title || value.cve && value.cve !== binding.cve
        || !(value.severity in ranks) || !(binding.severity_cap in ranks)
        || ranks[value.severity] > ranks[binding.severity_cap]
        || value.category != null && value.category !== '' && value.category !== binding.category
        || value.operation_id !== undefined && value.operation_id !== binding.operation_id
        || value.input_key !== undefined && value.input_key !== binding.input_key
        || value.proof_scope !== undefined && value.proof_scope !== binding.proof_scope
        || value.gained && value.gained !== binding.gained) {
        pending.push('claim_exceeds_verified_proof'); continue
      }
      if (record.result?.direct_evidence !== true || !record.result.observation
        || provenance.collector === 'host-tool-dispatch') {
        pending.push('typed_direct_proof_required'); continue
      }
      if (provenance.collector === 'native-assessment-review') {
        const receipt = db.prepare("SELECT review_json,receipt_sha256 FROM awa_review WHERE external_id = ?").get('vuln:' + value.id)
        if (!receipt || digest(JSON.parse(receipt.review_json)) !== receipt.receipt_sha256
          || receipt.receipt_sha256 !== binding.receipt_sha256 || !nativeProofCurrent(store, id, binding)) {
          pending.push('current_native_proof_required'); continue
        }
      }
      proofs.push({ ev_id: ref, operation: record.operation, authority: record.authority,
        recorded_at: record.recorded_at, proof_type: record.result.proof_type,
        security_defect: true, target: binding.target,
        input_location: binding.input_location ?? null, input_selector: binding.input_selector ?? null,
        observation: record.result.observation, category: binding.category, operation_id: binding.operation_id,
        input_key: binding.input_key ?? null, proof_scope: binding.proof_scope,
        title: binding.title, severity_cap: binding.severity_cap, limitations: binding.limitations || [] })
    } catch { pending.push('proof_unavailable_or_changed') }
  }
  return { verified: refs.length > 0 && pending.length === 0, pending: [...new Set(pending)], proofs }
}

export function assertFindingConfirmation(store, id, value) {
  const result = findingConfirmation(store, id, value)
  if (!result.verified) throw Object.assign(new Error('Finding confirmation requires a current proof of this exact claim: ' + result.pending.join(', ')),
    { code: 'FINDING_PROOF_REQUIRED', recovery: { next_action: 'redteam_assessment_review', verify: true,
      requests_sent: 0, reason: result.pending } })
  return result
}
