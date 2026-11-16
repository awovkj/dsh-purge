import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { RedteamStore, dispatch } from '../lib/redteam/store-core.js'
import { EvidenceLedger } from '../lib/redteam/evidence-ledger.mjs'
import { buildSrcReport } from '../lib/redteam/src-report.js'
import { buildPentestReport } from '../lib/redteam/pentest-report.js'
import { buildAssessmentDeliveryReport } from '../lib/redteam/assessment-report.js'
import { buildAwaExchange } from '../lib/redteam/awa-integration.js'
import { resolvePage, nextPage } from '../lib/redteam/page-token.js'
import { isModeAllowedTool, modeToolNames } from '../lib/redteam/mode-tools.js'
import { confirmFinding, observeFinding } from './fixtures/trusted-finding.mjs'

const scope = 'https://fixture.invalid/api'
function fixture(t, mode = 'src') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'purge-mode-upgrade-'))
  const store = new RedteamStore(root)
  const id = store.openEngagement('fixture-' + mode, [scope], { assessment_mode: mode, exclude: [scope + '/excluded'], bindCurrent: false }).id
  t.after(() => { store.close(); fs.rmSync(root, { recursive: true, force: true }) })
  return { store, id, root }
}
const candidate = (store, id, title = '低危的具体越权读取', severity = 'low') => {
  const value = { title, severity, category: 'access_control', target: scope + '/record', status: 'candidate' }
  return { ...value, ...store.addVuln(id, value) }
}

test('SRC rejects configuration-only claims before writes; a genuine low-severity defect remains eligible', t => {
  const { store, id } = fixture(t)
  for (const value of [
    { title: '缺少 X-Frame-Options 响应头', severity: 'high', category: 'xss' },
    { title: '缺少请求头', category: 'business_logic', impact: 'claim of administrator control' },
    { title: 'Server version disclosure', severity: 'critical' },
    { title: 'TLS configuration', finding_kind: 'hardening' },
    { title: 'Cookie 缺少 HttpOnly', category: 'cookie_flags' },
  ]) {
    const result = dispatch(store, { op: 'addVuln', engagement: id, vuln: { target: scope + '/record', ...value } })
    assert.equal(result.ok, false)
    assert.equal(result.error_code, 'SRC_NOT_SUBMITTABLE')
    assert.equal(result.recovery.recorded, false)
    assert.equal(result.recovery.requests_sent, 0)
  }
  assert.equal(store.vulnStats(id).total, 0)
  candidate(store, id)
  assert.equal(store.vulnStats(id).vulnerabilities, 1)
})

test('submission readiness requires a full current proof, actual rule fields and local duplicate checking', t => {
  const { store, id } = fixture(t)
  const finding = candidate(store, id)
  const ledger = new EvidenceLedger(store.db(id))
  assert.equal(ledger.record({ operation: 'claim', result: { direct_evidence: true }, confidence: 'observed', engagement_id: id }).ok, false)
  const ref = confirmFinding(store, id, finding)
  assert.equal(store.srcFindings(id)[0].submission.disposition, 'report_incomplete')
  const submission = { program: 'Synthetic local SRC program', policy_reference: 'https://rules.invalid/src',
    policy_basis: 'Unauthorized disclosure is in scope under the fixture rule.', prerequisites: 'Fixture-only ordinary account and synthetic record',
    expected_result: 'Deny another account access to the restricted record.', duplicate_check: 'checked_local' }
  store.updateVuln(id, finding.id, { submission, reproduction: 'Compare the already recorded owner and unauthorized controls.',
    impact: 'Only the synthetic record is disclosed.', remediation: 'Enforce the record owner policy.' })
  let report = buildSrcReport(store, id, { save: false })
  assert.equal(report.submission_ready, 1)
  assert.equal(report.report.submitted, false)
  assert.equal(report.report.platform_acceptance, 'not_assessed')
  const invalid = ledger.record({ operation: 'unverified', result: { alleged: true }, confidence: 'inferred', engagement_id: id })
  // A partially valid list must not acquire readiness or a trusted-observation presentation.
  store.db(id).prepare('UPDATE vuln SET evidence_refs = ? WHERE id = ?').run(JSON.stringify([ref, invalid.ev_id]), finding.id)
  report = buildSrcReport(store, id, { save: false })
  assert.equal(report.confirmed, 0)
  assert.equal(report.submission_ready, 0)
  assert.equal(dispatch(store, { op: 'vulns', engagement: id }).items[0].current_proofs.length, 0)
  assert.equal(store.srcStops(id).length, 1)
})

test('changed target is persisted and needs a new exact proof; original SRC stop survives repair', t => {
  const { store, id } = fixture(t)
  const finding = candidate(store, id)
  confirmFinding(store, id, finding)
  store.updateVuln(id, finding.id, { status: 'fixed' })
  assert.equal(store.srcStops(id)[0].target, finding.target)
  const next = candidate(store, id, '另一个越权候选')
  store.updateVuln(id, next.id, { target: scope + '/other-record' })
  assert.equal(store.listVulns(id).items.find(row => row.id === next.id).target, scope + '/other-record')
  const oldProof = observeFinding(store, id, next)
  assert.throws(() => store.updateVuln(id, next.id, { status: 'confirmed', evidence_refs: [oldProof] }), /exact claim/)
  assert.equal(store.srcStops(id).length, 1)
})

test('SRC delivery preserves long reproduction steps and all draft fields while redacting proof and draft secrets', t => {
  const { store, id } = fixture(t)
  const finding = candidate(store, id)
  const secret = 'SYNTHETIC-SRC-DRAFT-SECRET'
  store.db(id).prepare('INSERT INTO credential(host,secret_value) VALUES(?,?)').run(scope, secret)
  confirmFinding(store, id, finding, { binding: { input_selector: secret, input_key: 'query:' + secret,
    operation_id: 'fixture-op-' + secret, limitations: ['Only fixture ' + secret] }, result: { observation: 'Bearer ' + secret } })
  const reproduction = '1. Read the recorded owner control.\n' + 'Recorded fixture detail. '.repeat(100) + '\n2. Compare the recorded denied control.\nEND-OF-REPRODUCTION'
  store.updateVuln(id, finding.id, { reproduction, impact: 'Only the fixture record is exposed.', remediation: 'Enforce ownership.',
    submission: { program: 'Local fixture', policy_reference: 'https://rules.invalid/src?token=' + secret,
      policy_basis: 'Recorded rule details. '.repeat(100) + 'END-OF-POLICY', prerequisites: 'Fixture-only account token=' + secret,
      expected_result: 'Deny unauthorized access.', duplicate_check: 'checked_local' } })
  const report = buildSrcReport(store, id)
  assert(report.markdown.includes(reproduction))
  assert(report.markdown.includes('END-OF-POLICY'))
  assert.equal(report.report.findings[0].reproduction, reproduction)
  assert.equal(report.report.stops.length, 1)
  assert.equal(report.report.pages.candidates_total, 0)
  for (const artifact of [report.markdown, fs.readFileSync(report.json_path, 'utf8')]) assert(!artifact.includes(secret))
  assert.equal(report.submission_ready, 1)
})

test('an oversized historical SRC report fails before replacing either saved artifact', t => {
  const { store, id } = fixture(t)
  const dir = path.join(store.dirOf(id), 'reports')
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'src-findings.md'), 'retained previous report')
  fs.writeFileSync(path.join(dir, 'src-findings.json'), '{"previous":true}')
  store.db(id).exec(`WITH RECURSIVE items(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM items WHERE n<10001)
    INSERT INTO vuln(title,target,status,src_eligible) SELECT 'Historical source label', '${scope}/old', 'confirmed', 1 FROM items`)
  assert.throws(() => buildSrcReport(store, id), error => error.code === 'SRC_REPORT_BUDGET' && error.recovery.requests_sent === 0)
  assert.equal(fs.readFileSync(path.join(dir, 'src-findings.md'), 'utf8'), 'retained previous report')
  assert.equal(fs.readFileSync(path.join(dir, 'src-findings.json'), 'utf8'), '{"previous":true}')
})

test('historical SRC information items stay preserved but leave queries, import, delivery and badge denominators', async t => {
  const { store, id } = fixture(t)
  store.db(id).prepare("INSERT INTO vuln(title,target,severity,status,finding_kind,src_eligible) VALUES(?,?,'info','candidate','hardening',0)")
    .run('Missing HSTS', scope + '/old')
  candidate(store, id)
  assert.equal(store.listVulns(id).total, 1)
  assert.equal(store.listVulns(id, { include_excluded: true }).total, 2)
  assert.equal(store.consoleDigest(id).sections.findings.count, 1)
  assert.equal(buildAwaExchange(store, id).total, 1)
  const result = await buildAssessmentDeliveryReport(store, id, { save: false })
  assert.equal(result.findings.registered_total, 1)
  assert.equal(result.findings.excluded_hardening, 1)
  assert.equal(result.assessment.state, 'not_initialized')
  assert.equal(fs.existsSync(path.join(store.dirOf(id), 'assessment')), false)
})

test('pentest retains hardening separately and its credentials; mode-mismatched reports fail explicitly', async t => {
  const { store, id } = fixture(t, 'pentest')
  store.addVuln(id, { target: scope + '/record', title: 'Missing CSP header', severity: 'high', remediation: 'Configure CSP.' })
  candidate(store, id)
  const stats = store.vulnStats(id)
  assert.equal(stats.hardening, 1)
  assert.equal(stats.vulnerabilities, 1)
  assert.equal(stats.bySeverity.high || 0, 0)
  const credential = store.addCredential(id, { host: scope, username: 'fixture', secret_value: 'synthetic-secret' })
  assert.equal(store.listCredentials(id)[0].credential_handle, credential.credential_handle)
  assert.throws(() => store.addCredential(id, { host: 'https://outside.invalid', secret_value: 'inert' }), /outside scope/)
  const report = await buildPentestReport(store, id, { save: false })
  assert.equal(report.report.source.findings.length, 1)
  assert.equal(report.report.source.recommendations.length, 1)
  assert.equal(report.markdown.includes('synthetic-secret'), false)
  assert.throws(() => buildSrcReport(store, id, { save: false }), /requires a src engagement/)
  assert.equal(isModeAllowedTool('redteam', 'redteam_src_report'), false)
  assert.equal(isModeAllowedTool('redteam', 'redteam_pentest_report'), false)
  const tools = fs.readFileSync(new URL('../lib/redteam/tools.js', import.meta.url), 'utf8')
  const registered = new Set([...tools.matchAll(/name: '(redteam_[a-z_]+)'/g)].map(match => match[1]))
  for (const mode of ['redteam', 'src', 'pentest']) for (const name of modeToolNames(mode)) assert(registered.has(name), mode + '/' + name)
})

test('page tokens reject wrong streams, targets, tampering, limit conflicts and changed verification semantics', t => {
  const { store, id } = fixture(t)
  const page = resolvePage(store, id, 'assessment_candidates', { verify: true, limit: 2 }, { verify: true })
  const next = nextPage(store, id, 'assessment_candidates', page, { offset: 2 }, 'redteam_assessment_review')
  assert.equal(resolvePage(store, id, 'assessment_candidates', next.arguments).verify, true)
  for (const [stream, args, identity] of [
    ['source_candidates', next.arguments, id], ['assessment_candidates', { ...next.arguments, offset: 0 }, id],
    ['assessment_candidates', { ...next.arguments, verify: false }, id], ['assessment_candidates', { ...next.arguments, limit: 3 }, id],
    ['assessment_candidates', { page_token: next.arguments.page_token.slice(0, -4) + 'AAAA' }, id],
  ]) assert.throws(() => resolvePage(store, identity, stream, args), error => error.code === 'ASSESSMENT_PAGE_TOKEN')
  const other = store.openEngagement('other', [scope], { assessment_mode: 'src', exclude: [], bindCurrent: false }).id
  assert.throws(() => resolvePage(store, other, 'assessment_candidates', next.arguments), /engagement/)
})

test('combined delivery tokens advance unequal finding and stop streams without repeating an exhausted stream', async t => {
  const { store, id } = fixture(t)
  for (let index = 0; index < 5; index++) {
    const finding = candidate(store, id, '具体越权 ' + index)
    if (index < 2) confirmFinding(store, id, finding)
  }
  const findings = [], stops = []
  let args = { save: false, limit: 2 }
  for (let page = 0; page < 5; page++) {
    const report = await buildAssessmentDeliveryReport(store, id, args)
    findings.push(...report.findings.items.map(row => row.id)); stops.push(...report.src_stops.items.map(row => row.vuln_id))
    if (!report.next) break
    const { engagement, ...next } = report.next.arguments
    args = next
  }
  assert.equal(findings.length, 5)
  assert.equal(new Set(findings).size, 5)
  assert.equal(stops.length, 2)
})
