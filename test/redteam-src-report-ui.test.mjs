import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Readable } from 'node:stream'
import { RedteamStore } from '../lib/redteam/store-core.js'
import { EvidenceLedger } from '../lib/redteam/evidence-ledger.mjs'
import { buildSrcReport } from '../lib/redteam/src-report.js'
import { buildAwaExchange } from '../lib/redteam/awa-integration.js'
import { isRedteamOriginAllowed, apply as applyUi } from '../lib/redteam/ui.js'

const request = (origin, remote = '127.0.0.1', host = '127.0.0.1:8080') => ({
  headers: { host, ...(origin === undefined ? {} : { origin }) }, socket: { remoteAddress: remote },
})

test('redteam API rejects foreign web origins on loopback while preserving local Desktop and same-origin clients', () => {
  for (const origin of ['https://foreign.invalid', 'http://localhost:9999', 'https://127.0.0.1:8080', 'http://user@127.0.0.1:8080']) {
    assert.equal(isRedteamOriginAllowed(request(origin)), false)
  }
  for (const origin of [undefined, 'null', 'app://dsh', 'file://', 'http://127.0.0.1:8080']) {
    assert.equal(isRedteamOriginAllowed(request(origin)), true)
  }
  assert.equal(isRedteamOriginAllowed(request(undefined, '192.0.2.1')), false)
  assert.equal(isRedteamOriginAllowed(request('app://dsh', '192.0.2.1')), false)
  assert.equal(isRedteamOriginAllowed(request('http://assessment.invalid:8080', '192.0.2.1', 'assessment.invalid:8080')), true)
})

test('a foreign browser request cannot change the local AWA runtime through the actual API handler', async t => {
  const cleanup = []
  let route
  const ctx = { redteam: { root: os.tmpdir() }, effect: factory => { cleanup.push(factory()) },
    on: () => () => {}, webServer: { register: value => { route = value; return () => {} } } }
  t.after(() => { for (const release of cleanup.reverse()) if (typeof release === 'function') release() })
  applyUi(ctx)
  assert.equal(route.path, '/redteam/api')
  const req = Object.assign(Readable.from([JSON.stringify({ op: 'awaConfigSave', config: { packagePath: 'untrusted' } })]),
    request('https://foreign.invalid'), { method: 'POST' })
  let code, response
  const res = { writeHead: status => { code = status }, end: value => { response = JSON.parse(value) } }
  await route.handler(req, res)
  assert.equal(code, 403)
  assert.equal(response.ok, false)
  assert.match(response.error, /cross-origin/)
})

test('SRC report retains direct-evidence stops and pending denominator, redacts locator queries and writes only its own report', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'purge-src-report-'))
  const store = new RedteamStore(root)
  t.after(() => { store.close(); fs.rmSync(root, { recursive: true, force: true }) })
  const id = store.openEngagement('SRC reporting fixture', ['https://fixture.invalid/api'], { assessment_mode: 'src' }).id
  const target = 'https://fixture.invalid/api/item?%74oken=PRIVATE_QUERY_FIXTURE_123'
  const ledger = new EvidenceLedger(store.db(id))
  const evidence = ledger.record({ operation: 'bounded_http_proof', parameters: { target },
    confidence: 'observed', authority: 'request-replay', engagement_id: id,
    result: { direct_evidence: true, proof_type: 'http_response', observation: 'Restricted fixture marker; Bearer PRIVATE_BEARER_FIXTURE_123' } })
  store.addVuln(id, { title: 'Fixture access boundary', target, severity: 'medium', status: 'confirmed', evidence_refs: [evidence.ev_id] })
  store.addVuln(id, { title: 'Needs controls', target: 'https://fixture.invalid/api/other', status: 'candidate' })
  const report = buildSrcReport(store, id)
  assert.equal(report.confirmed, 1)
  assert.equal(report.candidates, 1)
  assert.equal(report.registered_findings, 2)
  assert.equal(report.coverage_exhausted, false)
  assert.equal(report.can_claim_complete, false)
  assert.equal(report.requests_sent, 0)
  assert.equal(path.dirname(report.path), path.join(store.dirOf(id), 'reports'))
  assert.equal(fs.readFileSync(report.path, 'utf8'), report.markdown)
  assert.match(report.markdown, /direct_evidence_obtained/)
  assert.ok(report.markdown.includes(evidence.ev_id))
  assert.doesNotMatch(report.markdown, /PRIVATE_QUERY_FIXTURE_123|PRIVATE_BEARER_FIXTURE_123/)
  store.db(id).prepare('UPDATE evidence SET result = ? WHERE ev_id = ?').run('{"direct_evidence":true,"proof_type":"http_response","observation":"changed"}', evidence.ev_id)
  assert.throws(() => buildSrcReport(store, id), /integrity|valid/i)
})

test('exchange omits unknown query credentials even without a learned credential context', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'purge-exchange-query-'))
  const store = new RedteamStore(root)
  t.after(() => { store.close(); fs.rmSync(root, { recursive: true, force: true }) })
  const id = store.openEngagement('Query handoff', ['https://fixture.invalid/api'], { assessment_mode: 'src' }).id
  const secret = 'UNDECLARED_QUERY_CREDENTIAL_FIXTURE_123'
  const url = 'https://fixture.invalid/api/lookup?opaque=' + secret
  const finding = store.addVuln(id, { title: 'Candidate at ' + url, target: url, status: 'candidate' })
  store.addHttpEvidence(id, { vuln_id: finding.id, url, method: 'GET', status: 200 })
  const exchange = buildAwaExchange(store, id).exchange
  assert.equal(exchange.candidates[0].url, 'https://fixture.invalid/api/lookup')
  assert.equal(exchange.candidates[0].query_omitted, true)
  assert.equal(exchange.http_evidence[0].url, 'https://fixture.invalid/api/lookup')
  assert.doesNotMatch(JSON.stringify(exchange), new RegExp(secret))
})
