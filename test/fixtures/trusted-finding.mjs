// Synthetic operator verification for local store tests. Native engine tests use real machine receipts.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { EvidenceLedger } from '../../lib/redteam/evidence-ledger.mjs'

export function observeFinding(store, id, finding, overrides = {}) {
  finding = { ...store.db(id).prepare('SELECT * FROM vuln WHERE id = ?').get(finding.id), ...finding }
  const binding = { schema: 'dsh-purge-finding-proof/v1', engagement_id: id, vuln_id: finding.id,
    target: finding.target, title: finding.title, category: finding.category || 'access_control',
    operation_id: 'fixture-operation-' + finding.id, input_key: 'query:record', proof_scope: 'restricted_record_disclosure',
    finding_id: 'fixture-finding-' + finding.id, decision_id: 'fixture-decision-' + finding.id,
    severity_cap: finding.severity || 'low', limitations: ['Only the synthetic fixture record was observed.'],
    ...overrides.binding }
  const input = { operation: 'operator_fixture_verification', engagement_id: id, authority: 'request-replay',
    parameters: { url: finding.target, finding_id: finding.id },
    result: { url: finding.target, direct_evidence: true, proof_type: 'http_response',
      observation: 'Synthetic restricted record returned to the fixture-only unauthorized principal.', ...overrides.result } }
  const result = new EvidenceLedger(store.db(id)).recordObserved(input, { collector: 'operator-verification',
    invocation_id: 'fixture-check-' + finding.id, material_sha256: [createHash('sha256').update(JSON.stringify(input)).digest('hex')], binding })
  assert.equal(result.ok, true, result.error)
  return result.ev_id
}

export function confirmFinding(store, id, finding, overrides = {}) {
  const ref = observeFinding(store, id, finding, overrides)
  store.updateVuln(id, finding.id, { status: 'confirmed', evidence_refs: [ref] })
  return ref
}
