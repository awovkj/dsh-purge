// Real embedded process/SQLite assessment; fixture.invalid is never contacted.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { RedteamStore } from '../lib/redteam/store-core.js'
import { EvidenceLedger } from '../lib/redteam/evidence-ledger.mjs'
import { awaSettingsOf, saveAwaSettings, writeSettings } from '../lib/redteam/settings.js'
import { removeTreeNoFollowSync } from '../lib/remove-tree.js'
import { buildSrcReport } from '../lib/redteam/src-report.js'
import { EXCHANGE_SCHEMA, awaStatus, awaProject, awaCall, awaSync, awaReviewRows,
  readAwaBinding, buildAwaExchange, assessmentConfigOf, assessmentStatus, ensureNativeAssessment,
  assessmentRun, assessmentImport, assessmentReview } from '../lib/redteam/awa-integration.js'
import { defaultPythonExecutable } from '../lib/redteam/native-assessment.js'
import { confirmFinding } from './fixtures/trusted-finding.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const packagePath = path.join(ROOT, 'lib', 'redteam', 'assessment-engine')
const target = 'https://fixture.invalid/api/private'
const scope = ['https://fixture.invalid/api']
const exclude = ['https://fixture.invalid/api/admin']
const executeFile = promisify(execFile)
const sha256 = text => createHash('sha256').update(text).digest('hex')

function fixture(t) {
  const container = fs.mkdtempSync(path.join(os.tmpdir(), 'purge-awa-integration-'))
  const root = path.join(container, 'redteam')
  const store = new RedteamStore(root)
  const pythonExecutable = process.env.AWA_DDD_TEST_PYTHON || defaultPythonExecutable()
  saveAwaSettings(root, { pythonExecutable, timeoutMs: 15000 })
  t.after(() => {
    store.close()
    const resolved = path.resolve(container)
    const relative = path.relative(path.resolve(os.tmpdir()), resolved)
    assert(!path.isAbsolute(relative) && !relative.startsWith('..')
      && resolved.startsWith(path.join(path.resolve(os.tmpdir()), 'purge-awa-integration-')),
    'cleanup is limited to the freshly created temporary fixture')
    removeTreeNoFollowSync(resolved)
  })
  return { store, root, container, pythonExecutable }
}

const integrationTest = (name, run) => test(name, async t => {
  assert(fs.existsSync(path.join(packagePath, 'src', 'bridge.mjs')), 'embedded assessment runtime must ship with this repository')
  assert(fs.existsSync(path.join(packagePath, 'awa_ddd', '__main__.py')), 'embedded Python assessment engine must ship with this repository')
  return run(t, fixture(t))
})
const engagement = (store, name, mode = 'redteam') => store.openEngagement(name, scope,
  { assessment_mode: mode, exclude, bindCurrent: false }).id
const addCandidate = (store, id, values = {}) => store.addVuln(id,
  { target, title: 'Authorization control fixture', status: 'candidate', severity: 'high', source: 'scanner-fixture', ...values }).id
async function bridgeOf(f, id) {
  const bridge = await import(pathToFileURL(path.join(packagePath, 'src', 'bridge.mjs')).href)
  return { bridge, config: bridge.resolveConfig({ ...assessmentConfigOf(f.store, id), assessmentMode: 'assessment', pythonExecutable: f.pythonExecutable, timeoutMs: 15000 }) }
}
async function createRawProject(f, id, mode = 'src', values = {}) {
  const { bridge, config } = await bridgeOf(f, id)
  return bridge.invokeEngine(config, 'project.create', { project_id: 'assessment', target, scope,
    assessment_mode: mode, allow_mutation: false, exclude, ...values })
}

integrationTest('embedded readiness is read-only and Chinese engagement IDs produce stable opaque ASCII source identities', async (_t, f) => {
  const id = engagement(f.store, '中文授权单位 · 样例红队')
  addCandidate(f.store, id)
  const status = await awaStatus(f.store, id)
  assert.equal(status.available, true)
  assert.equal(status.requests_sent, 0)
  assert.equal(status.binding, null)
  const native = await assessmentStatus(f.store, id)
  assert.equal(native.engine.embedded, true)
  assert.equal(fs.existsSync(assessmentConfigOf(f.store, id).workspace), false, 'runtime readiness does not start Python or create assessment state')
  const first = buildAwaExchange(f.store, id)
  const repeated = buildAwaExchange(f.store, id)
  assert.equal(first.exchange.schema, EXCHANGE_SCHEMA)
  assert.match(first.exchange.engagement.id, /^rt-[a-f0-9]{24}$/)
  assert.equal(first.exchange.engagement.id, repeated.exchange.engagement.id)
  assert.doesNotMatch(JSON.stringify(first.exchange.engagement), /中文授权单位/)
  assert.equal(first.requests_sent, 0)
})

integrationTest('a host-only engagement remains pending until a concrete HTTP scope is available and does not start the engine', async (_t, f) => {
  const id = f.store.openEngagement('host-only internal assessment', ['fixture.invalid'], { bindCurrent: false }).id
  let calls = 0
  const pending = await ensureNativeAssessment(f.store, id, {}, { invokeEngine: async () => { calls++; throw new Error('No engine call is expected') } })
  assert.equal(pending.context.ready, false)
  assert.equal(calls, 0)
  assert.equal(fs.existsSync(assessmentConfigOf(f.store, id).workspace), false)
  assert.equal(pending.requests_sent, 0)
})

integrationTest('redteam and SRC initialize their fixed internal assessment, inherit exclusions and resume without recreation', async (_t, f) => {
  for (const mode of ['redteam', 'src']) {
    const id = engagement(f.store, '中文项目 ' + mode, mode)
    const result = await awaProject(f.store, id, { mode: 'create', target, scope })
    assert.equal(result.bound, true)
    assert.equal(result.requests_sent, 0)
    assert.equal(result.data.config.assessment_mode, mode === 'src' ? 'src' : 'assessment')
    assert.equal(result.data.config.allow_mutation, false)
    if (mode === 'src') assert.deepEqual(result.data.config.exclude, exclude)
    const binding = readAwaBinding(f.store, id)
    assert.equal(binding.project_id, 'assessment')
    assert.equal(binding.workspace, path.join(f.store.dirOf(id), 'assessment'))
    assert.equal(binding.project_id, result.binding.project_id)
    assert.match(binding.source_engagement_id, /^rt-[a-f0-9]{24}$/)
    const resumed = await awaProject(f.store, id, { mode: 'status' })
    assert.equal(resumed.binding.project_id, binding.project_id)
    const repeated = await ensureNativeAssessment(f.store, id, { target, scope })
    assert.equal(readAwaBinding(f.store, id).project_id, binding.project_id)
    assert.equal(repeated.ok, true)
  }
})

integrationTest('metadata push/pull is idempotent and secret-free; scanner confirmed claims stay unverified and ledger receipts stay inferred', async (_t, f) => {
  const id = engagement(f.store, '红队脱敏交接')
  const password = 'SYNTHETIC-PRIVATE-CREDENTIAL-ONLY'
  const shellKey = 'SYNTHETIC-PRIVATE-REFERENCE-KEY'
  f.store.addCredential(id, { host: scope[0], username: 'inert-reference', secret_value: password })
  f.store.addWebshell(id, { url: 'https://fixture.invalid/api/inert-reference', pass_key: shellKey, status: 'offline' })
  const vulnId = addCandidate(f.store, id, { title: `Authorization claim ${password} ${shellKey}`, confidence: 'inferred' })
  f.store.db(id).prepare("UPDATE vuln SET status='confirmed' WHERE id=?").run(vulnId)
  f.store.addHttpEvidence(id, { vuln_id: vulnId, url: target, method: 'GET', status: 200,
    request: `GET /api/private HTTP/1.1\r\nAuthorization: Bearer ${password}\r\n\r\n`,
    response: `HTTP/1.1 200 OK\r\nSet-Cookie: fixture=${shellKey}\r\n\r\n${password}` })
  addCandidate(f.store, id, { title: 'private query locator', target: `${target}?token=${password}` })
  for (const locator of ['https://outside.invalid/', 'https://fixture.invalid/api/admin']) {
    assert.throws(() => addCandidate(f.store, id, { title: 'outside declared source scope', target: locator }), /outside scope|excluded/)
    f.store.db(id).prepare("INSERT INTO vuln(title,target,status) VALUES('Legacy outside source scope',?,'candidate')").run(locator)
  }
  const exported = buildAwaExchange(f.store, id)
  assert.equal(exported.exchange.candidates.length, 1)
  assert.equal(exported.exchange.candidates[0].source_status, 'confirmed')
  assert.equal(exported.exchange.http_evidence[0].raw_material_included, false)
  assert.equal(exported.exchange.http_evidence[0].hash_scope, 'metadata')
  assert.equal(exported.skipped.length, 3)
  assert.doesNotMatch(JSON.stringify(exported), new RegExp(`${password}|${shellKey}|Authorization:|Set-Cookie:`))
  await awaProject(f.store, id, { mode: 'create', target, scope })
  const first = await awaSync(f.store, id, { mode: 'push' })
  const second = await awaSync(f.store, id, { mode: 'push' })
  assert.equal(first.data.import_id, second.data.import_id)
  assert.deepEqual(first.data.candidate_ids, second.data.candidate_ids)
  assert.equal(first.data.counts.created, 1)
  assert.equal(second.data.counts.created, 0)
  const pulled = await awaSync(f.store, id, { mode: 'pull' })
  const item = pulled.data.candidates[0]
  assert.equal(item.status, 'unverified')
  assert.equal(item.usable_for_confirmation, false)
  assert.deepEqual(item.decisions, [])
  assert.deepEqual(item.findings, [])
  assert.equal(pulled.reviews.length, 1)
  const record = new EvidenceLedger(f.store.db(id)).get(pulled.reviews[0].evidence_ref)
  assert.equal(record.confidence, 'inferred')
  assert.equal(record.engagement_id, id)
  assert.equal(record.result.source_status, 'confirmed')
  const row = f.store.db(id).prepare('SELECT * FROM awa_review WHERE external_id = ?').get('vuln:' + vulnId)
  assert.equal(row.receipt_sha256, sha256(row.review_json))
  assert.equal(JSON.parse(row.review_json).candidate_id, first.data.candidate_ids[0])
  assert.doesNotMatch(row.review_json, new RegExp(`${password}|${shellKey}`))
  const repeated = await awaSync(f.store, id, { mode: 'pull' })
  assert.equal(repeated.reviews[0].evidence_ref, pulled.reviews[0].evidence_ref)
  assert.equal(f.store.db(id).prepare('SELECT confidence FROM vuln WHERE id = ?').get(vulnId).confidence, 'inferred')
  f.store.close()
  assert.equal(awaReviewRows(f.store, id).length, 1, 'receipt survives SQLite handle closure and reopen')
})

integrationTest('SRC recovers its own fixed internal project but refuses another mode, broader scope or missing exclusions', async (_t, f) => {
  const cases = [
    ['wrong-mode', 'assessment', {}, /mode does not match/],
    ['wide-scope', 'src', { scope: ['https://fixture.invalid/'] }, /outside scope|excluded/],
    ['missing-exclude', 'src', { exclude: [] }, /preserve.*exclusion/],
  ]
  for (const [name, mode, values, expected] of cases) {
    const id = engagement(f.store, 'SRC internal recovery ' + name, 'src')
    await createRawProject(f, id, mode, values)
    await assert.rejects(awaProject(f.store, id, { mode: 'bind', project_id: 'assessment' }), expected)
    assert.equal(readAwaBinding(f.store, id), null, 'rejected internal project never becomes a ready context')
  }
  const id = engagement(f.store, 'SRC existing permitted', 'src')
  await createRawProject(f, id)
  await assert.rejects(awaProject(f.store, id, { mode: 'bind', project_id: 'external-project' }), /fixed|internal|cannot replace/)
  const result = await awaProject(f.store, id, { mode: 'bind', project_id: 'assessment' })
  assert.equal(result.bound, true)
  assert.equal(result.binding.workspace, path.join(f.store.dirOf(id), 'assessment'))
  await assert.rejects(awaCall(f.store, id, 'surface.register', { url: exclude[0], method: 'GET', auth: 'public' }),
    /outside scope or excluded/)
  await assert.rejects(awaCall(f.store, id, 'project.update', { assessment_mode: 'assessment' }),
    { code: 'assessment_mode_immutable' })
})

integrationTest('legacy external paths cannot replace the embedded runtime; the model cannot replace process or project configuration', async (_t, f) => {
  const id = engagement(f.store, 'runtime boundary')
  await awaProject(f.store, id, { mode: 'create', target, scope })
  for (const input of [{ project_id: 'another-project' }, { workspace: path.join(f.container, 'forbidden') },
    { executionBackend: 'wsl' }, { pythonExecutable: 'arbitrary' }, { required_assessment_mode: 'assessment' }]) {
    await assert.rejects(awaCall(f.store, id, 'project.status', input), /cannot replace/)
  }
  await assert.rejects(awaCall(f.store, id, 'shell.run', {}), /Unsupported awa-ddd action/)
  const changed = path.join(f.container, 'other-awa-state')
  const externalPackage = path.join(f.container, 'external-awa-package')
  writeSettings(f.root, { awa: { ...awaSettingsOf(f.root), workspace: changed, packagePath: externalPackage } })
  const status = await awaProject(f.store, id, { mode: 'status' }, {
    env: { AWA_DDD_PACKAGE_PATH: externalPackage, AWA_DDD_WORKSPACE: changed },
  })
  assert.equal(status.bound, true)
  assert.equal(status.binding.workspace, path.join(f.store.dirOf(id), 'assessment'))
  assert.equal((await assessmentStatus(f.store, id)).engine.embedded, true)
  assert.equal(fs.existsSync(changed), false)
  assert.equal(fs.existsSync(externalPackage), false)
  saveAwaSettings(f.root, { executionBackend: 'wsl' })
  await assert.rejects(awaProject(f.store, id, { mode: 'status' }), /runtime differs.*persistent|backend|requires a Windows host/)
  saveAwaSettings(f.root, { executionBackend: 'native' })
  assert.equal((await awaProject(f.store, id, { mode: 'status' })).bound, true)
})

integrationTest('each engagement owns its internal workspace and cannot borrow another engagement project or import', async (_t, f) => {
  const firstId = engagement(f.store, '来源单位甲')
  const secondId = engagement(f.store, '来源单位乙')
  addCandidate(f.store, firstId)
  addCandidate(f.store, secondId)
  const firstBinding = await awaProject(f.store, firstId, { mode: 'create', target, scope })
  await assert.rejects(awaProject(f.store, secondId, { mode: 'bind', project_id: firstBinding.binding.source_engagement_id }), /fixed|internal|cannot replace/)
  const secondBinding = await awaProject(f.store, secondId, { mode: 'create', target, scope })
  assert.equal(firstBinding.binding.project_id, 'assessment')
  assert.equal(secondBinding.binding.project_id, 'assessment')
  assert.notEqual(firstBinding.binding.workspace, secondBinding.binding.workspace)
  assert.notEqual(firstBinding.binding.source_engagement_id, secondBinding.binding.source_engagement_id)
  assert.equal(firstBinding.binding.workspace, path.join(f.store.dirOf(firstId), 'assessment'))
  assert.equal(secondBinding.binding.workspace, path.join(f.store.dirOf(secondId), 'assessment'))
  const first = await awaSync(f.store, firstId, { mode: 'push' })
  const second = await awaSync(f.store, secondId, { mode: 'push' })
  assert.notEqual(first.data.import_id, second.data.import_id)
  assert.notEqual(first.data.candidate_ids[0], second.data.candidate_ids[0])
  await assert.rejects(awaSync(f.store, secondId, { mode: 'pull', import_id: first.data.import_id }), /previously pushed by this engagement/)
  const pulled = await awaSync(f.store, secondId, { mode: 'pull' })
  assert.equal(pulled.data.candidates.length, 1)
  assert.equal(pulled.data.candidates[0].candidate_id, second.data.candidate_ids[0])
  assert.equal(pulled.reviews.length, 1)
  assert.equal(awaReviewRows(f.store, firstId).length, 0)
  assert.equal(awaReviewRows(f.store, secondId).length, 1)
})

integrationTest('host and CIDR source scope admits multiple concrete origins monotonically while source exclusions remain enforced', async (_t, f) => {
  for (const mode of ['redteam', 'src']) {
    const sourceScope = ['fixture.invalid', '192.0.2.0/24']
    const sourceExclude = ['https://fixture.invalid/admin', '192.0.2.99']
    const id = f.store.openEngagement('host and CIDR ' + mode, sourceScope,
      { assessment_mode: mode, exclude: sourceExclude, bindCurrent: false }).id
    const firstTarget = 'https://fixture.invalid/api/first'
    await ensureNativeAssessment(f.store, id, { target: firstTarget, scope: ['https://fixture.invalid/'] })
    const first = readAwaBinding(f.store, id)
    for (const url of ['http://192.0.2.10:8080/api/second', 'https://192.0.2.20:8443/api/third']) {
      const registered = await assessmentRun(f.store, id, 'surface.register', { url, method: 'GET', auth: 'public' })
      assert.equal(registered.ok, true)
    }
    const grown = readAwaBinding(f.store, id)
    assert.equal(grown.target, firstTarget, 'adding a discovered origin does not replace the original internal target')
    assert.equal(grown.workspace, first.workspace)
    assert.deepEqual(new Set(grown.scope), new Set(['https://fixture.invalid/', 'http://192.0.2.10:8080/', 'https://192.0.2.20:8443/']))
    assert(grown.exclude.includes('https://fixture.invalid/admin'))
    await ensureNativeAssessment(f.store, id, { target: firstTarget, scope: ['https://fixture.invalid/'], exclude: [] })
    const resumed = readAwaBinding(f.store, id)
    assert.deepEqual(resumed.scope, grown.scope, 'a narrower preparation call cannot erase admitted origins')
    assert.deepEqual(resumed.exclude, grown.exclude, 'a preparation call cannot erase inherited exclusions')
    for (const url of ['https://fixture.invalid/admin/private', 'http://192.0.2.99:8080/api', 'https://outside.invalid/api']) {
      await assert.rejects(assessmentRun(f.store, id, 'surface.register', { url, method: 'GET', auth: 'public' }), /outside scope or excluded/)
    }
    await assert.rejects(assessmentRun(f.store, id, 'dsh.context.configure', { assessment_mode: 'assessment', scope: ['https://outside.invalid/'], exclude: [] }), /private assessment adapters/)
    const after = await awaProject(f.store, id, { mode: 'status' })
    assert.deepEqual(after.data.config.scope, grown.scope)
    assert.deepEqual(after.data.config.exclude, grown.exclude)
    assert.equal(after.requests_sent, 0)
  }
})

integrationTest('native review spans both real imported candidate pages and retains earlier receipts after the context cache is pruned', async (_t, f) => {
  const id = engagement(f.store, 'all internal import batches')
  for (let index = 0; index < 51; index++) addCandidate(f.store, id, { title: 'Unverified page fixture ' + index,
    target: target + '/' + index })
  const first = await assessmentImport(f.store, id)
  assert.equal(first.page_kind, 'source_candidates')
  assert.equal(first.data.candidate_ids.length, 50)
  assert.equal(first.next_offset, 50)
  const second = await assessmentImport(f.store, id, { offset: first.next_offset })
  assert.equal(second.data.candidate_ids.length, 1)
  assert.equal(second.next_offset, null)
  assert.notEqual(first.data.import_id, second.data.import_id)
  assert.equal(f.store.db(id).prepare('SELECT COUNT(*) AS n FROM assessment_import').get().n, 2)
  // Emulate normal bounded context-history eviction. SQLite remains the durable
  // import authority and native review must still expose the preceding batch.
  const context = readAwaBinding(f.store, id)
  fs.writeFileSync(path.join(f.store.dirOf(id), 'assessment-context.json'), JSON.stringify({ ...context,
    import_ids: [second.data.import_id], last_import_id: second.data.import_id }) + '\n')
  const reviewedFirst = await assessmentReview(f.store, id)
  assert.equal(reviewedFirst.page_kind, 'assessment_candidates')
  assert.equal(reviewedFirst.data.candidates.length, 50)
  assert.equal(reviewedFirst.next_offset, 50)
  assert.equal(reviewedFirst.candidate_total, 51)
  const reviewedSecond = await assessmentReview(f.store, id, { offset: reviewedFirst.next_offset })
  assert.equal(reviewedSecond.data.candidates.length, 1)
  assert.equal(reviewedSecond.next_offset, null)
  const reviewed = [...reviewedFirst.reviews, ...reviewedSecond.reviews]
  assert.equal(new Set(reviewed.map(item => item.candidate_id)).size, 51)
  assert.equal(awaReviewRows(f.store, id).length, 51)
  const ledger = new EvidenceLedger(f.store.db(id))
  assert(reviewed.every(item => ledger.get(item.evidence_ref).confidence === 'inferred'))
  assert.equal(f.store.db(id).prepare("SELECT COUNT(*) AS n FROM vuln WHERE status = 'candidate'").get().n, 51)
  const oldBatch = await awaSync(f.store, id, { mode: 'pull', import_id: first.data.import_id, limit: 100 })
  assert.equal(oldBatch.data.candidates.length, 50, 'source-compatible lookup uses the durable import table after cache eviction')
  assert.equal([first, second, reviewedFirst, reviewedSecond, oldBatch].every(item => item.requests_sent === 0), true)
})

integrationTest('a long known private value is removed before source-title and report truncation, including persisted review source claims', async (_t, f) => {
  const id = engagement(f.store, 'SRC private truncation fixture', 'src')
  const marker = 'PRIVATE_FIXTURE_'
  const secret = marker + 's'.repeat(327 - marker.length)
  assert.equal(secret.length, 327)
  assert.throws(() => f.store.addCredential(id, { host: 'fixture.invalid', secret_value: secret }), /SRC policy forbids/)
  f.store.db(id).prepare('INSERT INTO credential(host,secret_value) VALUES(?,?)').run('fixture.invalid', secret)
  const title = 'Source heading '.repeat(7) + secret + ' public suffix'
  const finding = f.store.addVuln(id, { target, title, severity: 'high', status: 'candidate' })
  confirmFinding(f.store, id, finding, { result: { observation: 'fixture '.repeat(125) + secret + ' observed' } })
  const exported = buildAwaExchange(f.store, id)
  assert(exported.exchange.candidates[0].title.includes('[redacted]'))
  const pushed = await assessmentImport(f.store, id)
  const receipt = await assessmentReview(f.store, id)
  const saved = f.store.db(id).prepare('SELECT review_json FROM awa_review').get().review_json
  const report = buildSrcReport(f.store, id, { save: false })
  assert.equal(report.confirmed, 1)
  const publicOutput = JSON.stringify([exported, pushed, receipt, saved, report])
  assert.equal(publicOutput.includes(secret), false)
  assert.equal(publicOutput.includes(secret.slice(0, 128)), false, 'truncating a private value must not disclose its leading fragment')
  assert.equal(publicOutput.includes(marker), false)
  assert.equal(JSON.parse(saved).source_claim.title.includes('[redacted]'), true)
  assert.equal([exported, pushed, receipt, report].every(item => item.requests_sent === 0), true)
})

// The owned Python test process patches the transport, not evidence or decision
// storage. Normal capture/oracle/finding APIs produce and revalidate the proof.
const PROOF_FIXTURE = String.raw`
import base64, hashlib, json, sys
from urllib.parse import urlsplit
from unittest.mock import patch
from awa_ddd import engine
from awa_ddd.assessment import evaluate, record_finding
from awa_ddd.candidates import link_candidate
from awa_ddd.store import Project, now

workspace, project_id, candidate_id, endpoint = sys.argv[1:5]
variant = sys.argv[5] if len(sys.argv) > 5 else 'machine'
calls = []
def fixture_request(url, method='GET', headers=None, body=None, timeout=15, max_bytes=65536):
    assert url.startswith('https://fixture.invalid/api/'), url
    assert method == 'GET', method
    headers = {str(k).lower(): str(v) for k, v in (headers or {}).items()}
    actor = 'allowed' if headers.get('cookie') == 'fixture_actor=allowed' else 'denied'
    document = {'id': actor, 'roles': ['admin'] if actor == 'allowed' else ['user']}
    if urlsplit(url).path != '/api/whoami':
        document = {'record': {'id': 'fixture-record', 'value': 'synthetic-protected-record'}}
    raw = json.dumps(document, separators=(',', ':')).encode()
    started = now()
    calls.append(urlsplit(url).path)
    return {'request': {'url': url, 'method': method, 'headers': headers, 'body_base64': ''},
            'response': {'status': 200, 'headers': [['Content-Type', 'application/json']], 'complete': True,
                         'length': len(raw), 'body_base64': base64.b64encode(raw).decode(),
                         'body_sha256': hashlib.sha256(raw).hexdigest()},
            'started_at': started, 'completed_at': now(), 'complete': True, 'elapsed_ms': 0,
            'transport': 'python-http-client', 'redirect_followed': False}

with Project(workspace, project_id) as project, patch('awa_ddd.engine.request', fixture_request):
    profile = engine.register_operation(project, {'url': 'https://fixture.invalid/api/whoami', 'method': 'GET', 'auth': 'authenticated'})
    operation = engine.register_operation(project, {'url': endpoint, 'method': 'GET', 'auth': 'restricted', 'allowed_roles': ['admin']})
    sessions = {}
    for actor, role in [('allowed', 'admin'), ('denied', 'user')]:
        engine.add_actor(project, {'actor_id': actor, 'subject': actor, 'roles': [role]})
        session = engine.add_session(project, {'actor_id': actor, 'headers': {'Cookie': 'fixture_actor=' + actor}})
        engine.verify_identity(project, {'operation_id': profile['id'], 'session_id': session['id'], 'subject_selector': '/id', 'roles_selector': '/roles'})
        sessions[actor] = session['id']
    engine.build_plan(project)
    obligation = next(row for row in project.list('obligation') if row['operation_id'] == operation['id'] and row['kind'] == 'access' and row.get('actor_id') == 'denied')
    evidence = [engine.capture(project, {'operation_id': operation['id'], 'session_id': sessions[actor]})['id'] for actor in ('allowed', 'denied')]
    if variant == 'analyst':
        finding = record_finding(project, {'mode': 'analyst', 'reviewer': 'fixture-reviewer', 'reason': 'Synthetic reviewed observation only', 'evidence_ids': evidence,
            'title': 'Fixture analyst observation', 'category': 'access_control', 'impact': 'Only the synthetic fixture record was observed', 'remediation': 'Enforce the declared access policy'})
        decision = {'id': finding['decision_id']}
    else:
        decision = evaluate(project, {'obligation_id': obligation['id'], 'evidence_ids': evidence, 'oracle': {'type': 'authorization', 'selector': '/record'}})
        assert decision['outcome'] == 'confirmed'
        finding = record_finding(project, {'decision_id': decision['id'], 'title': 'Fixture authorization evidence', 'category': 'access_control', 'impact': 'Only the synthetic fixture record was observed', 'remediation': 'Enforce the declared access policy'})
    link_candidate(project, {'candidate_id': candidate_id, 'operation_id': operation['id']})
    print(json.dumps({'operation_id': operation['id'], 'decision_id': decision['id'], 'finding_id': finding['id'], 'evidence_ids': evidence, 'mock_requests': len(calls)}))
`

async function seedProof(f, binding, candidateId, endpoint = target, variant = 'machine') {
  const { stdout } = await executeFile(f.pythonExecutable,
    ['-E', '-s', '-X', 'utf8', '-B', '-c', PROOF_FIXTURE, binding.workspace, binding.project_id, candidateId, endpoint, variant],
    { cwd: packagePath, shell: false, windowsHide: true, encoding: 'utf8', timeout: 15000, maxBuffer: 64 * 1024 })
  return JSON.parse(stdout)
}

async function alterFixture(f, binding, script, ...args) {
  const { stdout } = await executeFile(f.pythonExecutable,
    ['-E', '-s', '-X', 'utf8', '-B', '-c', script, binding.workspace, binding.project_id, ...args],
    { cwd: packagePath, shell: false, windowsHide: true, encoding: 'utf8', timeout: 15000, maxBuffer: 64 * 1024 })
  return stdout.trim() ? JSON.parse(stdout) : undefined
}

integrationTest('independently evaluated typed proof is rechecked on pull and persists as inferred handoff without auto-confirming SRC', async (_t, f) => {
  const id = engagement(f.store, 'SRC typed receipt', 'src')
  const vulnId = addCandidate(f.store, id)
  const created = await awaProject(f.store, id, { mode: 'create', target, scope })
  const pushed = await awaSync(f.store, id, { mode: 'push' })
  const { stdout } = await executeFile(f.pythonExecutable,
    ['-E', '-s', '-X', 'utf8', '-B', '-c', PROOF_FIXTURE, created.binding.workspace, created.binding.project_id, pushed.data.candidate_ids[0], target],
    { cwd: packagePath, shell: false, windowsHide: true, encoding: 'utf8', timeout: 15000, maxBuffer: 64 * 1024 })
  const proof = JSON.parse(stdout)
  assert.equal(proof.mock_requests, 4, 'only the owned transport mock received the two identity and two access controls')
  const pulled = await awaSync(f.store, id, { mode: 'pull' })
  const item = pulled.data.candidates[0]
  assert.equal(item.usable_for_confirmation, true)
  const decision = item.decisions.find(row => row.decision_id === proof.decision_id)
  assert.equal(decision.current, true)
  assert.equal(decision.validated, true)
  assert.equal(decision.mode, 'machine')
  assert.deepEqual(decision.evidence_ids, proof.evidence_ids)
  assert.equal(decision.evidence_hashes.length, 2)
  assert(decision.evidence_hashes.every(row => /^[a-f0-9]{64}$/.test(row.sha256)))
  assert.equal(pulled.reviews.length, 1)
  const record = new EvidenceLedger(f.store.db(id)).get(pulled.reviews[0].evidence_ref)
  assert.equal(record.confidence, 'inferred', 'a verified remote proof fact is still an explicit handoff, not a local observation upgrade')
  assert.equal(record.result.usable_for_confirmation, true)
  assert.equal(f.store.db(id).prepare('SELECT status FROM vuln WHERE id = ?').get(vulnId).status, 'candidate')
  assert.doesNotMatch(JSON.stringify(pulled), /fixture_actor=|synthetic-protected-record/)
  await assert.rejects(awaCall(f.store, id, 'http.capture', { operation_id: proof.operation_id, url: target }), { code: 'stopped_at_evidence' })
  const tamper = String.raw`from awa_ddd.store import Project; import sys
with Project(sys.argv[1],sys.argv[2]) as p:
    e=p.get('evidence',sys.argv[3]); (p.base/e['artifact_path']).write_text('{}',encoding='utf-8')`
  await executeFile(f.pythonExecutable, ['-E', '-s', '-X', 'utf8', '-B', '-c', tamper, created.binding.workspace, created.binding.project_id, proof.evidence_ids[1]],
    { cwd: packagePath, shell: false, windowsHide: true, timeout: 15000, maxBuffer: 64 * 1024 })
  const invalid = await awaSync(f.store, id, { mode: 'pull' })
  assert.equal(invalid.data.candidates[0].usable_for_confirmation, false, 'tampered evidence is rechecked rather than trusting the old confirmed label')
  assert.equal(f.store.db(id).prepare('SELECT status FROM vuln WHERE id = ?').get(vulnId).status, 'candidate')
})

integrationTest('an old proof locator cannot write a new local review after the source vulnerability target changes', async (_t, f) => {
  const id = engagement(f.store, 'locator boundary')
  const vulnId = addCandidate(f.store, id)
  await awaProject(f.store, id, { mode: 'create', target, scope })
  await awaSync(f.store, id, { mode: 'push' })
  const first = await awaSync(f.store, id, { mode: 'pull' })
  f.store.db(id).prepare('UPDATE vuln SET target = ? WHERE id = ?').run('https://fixture.invalid/api/other', vulnId)
  const second = await awaSync(f.store, id, { mode: 'pull' })
  assert.equal(first.reviews.length, 1)
  assert.deepEqual(second.reviews, [])
  const records = new EvidenceLedger(f.store.db(id)).list({ operation: 'awa_review', engagement_id: id })
  assert.equal(records.length, 1, 'history is retained but stale target metadata cannot create another accepted handoff')
})

integrationTest('verify closes the SRC evidence loop with an observed verification receipt and is idempotent without target requests', async (_t, f) => {
  const id = engagement(f.store, 'SRC automatic verified receipt', 'src')
  const sourceClaim = { title: 'Scanner disclosure candidate', severity: 'critical', status: 'candidate', cve: 'CVE-2099-1234' }
  const vulnId = addCandidate(f.store, id, sourceClaim)
  const created = await awaProject(f.store, id, { mode: 'create', target, scope })
  const pushed = await awaSync(f.store, id, { mode: 'push' })
  const proof = await seedProof(f, created.binding, pushed.data.candidate_ids[0])
  const plain = await awaSync(f.store, id, { mode: 'pull' })
  assert.equal(plain.data.candidates[0].usable_for_confirmation, true)
  assert.equal(f.store.db(id).prepare('SELECT status FROM vuln WHERE id = ?').get(vulnId).status, 'candidate')
  const verified = await awaSync(f.store, id, { mode: 'verify' })
  assert.equal(verified.requests_sent, 0)
  assert.equal(verified.reviews[0].status, 'verified')
  const ledger = new EvidenceLedger(f.store.db(id))
  const observation = ledger.get(verified.reviews[0].evidence_ref)
  assert.equal(observation.confidence, 'observed')
  assert.equal(observation.authority, 'tool-output')
  assert.equal(observation.result.target, target)
  assert.equal(observation.result.direct_evidence, true)
  assert.equal(observation.result.proof_type, 'awa_decision')
  assert.equal(observation.result.decision_id, proof.decision_id)
  assert.deepEqual(observation.result.evidence_ids, proof.evidence_ids)
  assert.equal(observation.result.evidence_hashes.length, proof.evidence_ids.length)
  assert.equal(observation.supporting_ev_ids.length, 1)
  const claim = ledger.get(observation.supporting_ev_ids[0])
  assert.equal(claim.confidence, 'inferred')
  assert.deepEqual(claim.result.source_claim, { ...sourceClaim, gained: null })
  assert.deepEqual(f.store.db(id).prepare('SELECT * FROM evidence_verification WHERE claim_id = ?').get(claim.ev_id),
    Object.assign(Object.create(null), { claim_id: claim.ev_id, observation_id: observation.ev_id }))
  const finding = f.store.db(id).prepare('SELECT title,severity,cve,status,evidence_refs,stop_reason FROM vuln WHERE id = ?').get(vulnId)
  assert.equal(finding.status, 'confirmed')
  assert.match(finding.title, /^access_control: authorization_boundary \(/)
  assert.equal(finding.severity, 'medium')
  assert.equal(finding.cve, null, 'a scanner CVE claim is not a machine attribution of the independently confirmed finding')
  assert.equal(finding.stop_reason, 'direct_evidence_obtained')
  assert.deepEqual(JSON.parse(finding.evidence_refs), [observation.ev_id])
  assert.equal(f.store.srcFindings(id)[0].proofs[0].proof_type, 'awa_decision')
  const repeated = await awaSync(f.store, id, { mode: 'verify' })
  assert.equal(repeated.reviews[0].evidence_ref, observation.ev_id)
  const receipt = f.store.db(id).prepare('SELECT review_json FROM awa_review WHERE external_id = ?').get('vuln:' + vulnId)
  assert.deepEqual(JSON.parse(receipt.review_json).source_claim, { ...sourceClaim, gained: null }, 'the first source declaration survives semantic correction and repeat verification')
  assert.equal(ledger.list({ confidence: 'observed', engagement_id: id }).length, 1)
  await assert.rejects(awaCall(f.store, id, 'http.capture', { operation_id: proof.operation_id, url: target }), /stopped_at_evidence/)
  assert.doesNotMatch(JSON.stringify(verified), /fixture_actor=|synthetic-protected-record/)
})

integrationTest('verify cannot promote scanner confirmation prose, analyst-only findings or tampered proof', async (_t, f) => {
  for (const variant of ['source-claim', 'analyst', 'tampered', 'withdrawn-finding', 'family-mismatch']) {
    const id = engagement(f.store, 'SRC rejected verify ' + variant, 'src')
    const vulnId = addCandidate(f.store, id, variant === 'family-mismatch' ? { title: 'Scanner RCE candidate', severity: 'critical' } : {})
    const created = await awaProject(f.store, id, { mode: 'create', target, scope })
    const pushed = await awaSync(f.store, id, { mode: 'push' })
    if (variant === 'source-claim') {
      await alterFixture(f, created.binding, String.raw`from awa_ddd.store import Project; import sys
with Project(sys.argv[1],sys.argv[2]) as p:
    c=p.get('candidate',sys.argv[3]); c['source_status']='confirmed'; p.put('candidate',c)`, pushed.data.candidate_ids[0])
    } else {
      const proof = await seedProof(f, created.binding, pushed.data.candidate_ids[0], target, variant === 'analyst' ? 'analyst' : 'machine')
      if (variant === 'tampered') await alterFixture(f, created.binding, String.raw`from awa_ddd.store import Project; import sys
with Project(sys.argv[1],sys.argv[2]) as p:
    e=p.get('evidence',sys.argv[3]); (p.base/e['artifact_path']).write_text('{}',encoding='utf-8')`, proof.evidence_ids[1])
      if (variant === 'withdrawn-finding') await alterFixture(f, created.binding, String.raw`from awa_ddd.store import Project; import sys
with Project(sys.argv[1],sys.argv[2]) as p:
    finding=p.get('finding',sys.argv[3]); finding['status']='fixed'; p.put('finding',finding)`, proof.finding_id)
    }
    const result = await awaSync(f.store, id, { mode: 'verify' })
    assert.equal(result.requests_sent, 0)
    assert.equal(result.reviews.length, 1)
    assert.equal(result.reviews[0].status, 'confirmation_pending', variant)
    if (variant === 'withdrawn-finding') assert.equal(result.data.candidates[0].decisions[0].usable_for_confirmation, true,
      'even a current machine decision needs a matching current confirmed finding')
    assert.equal(f.store.db(id).prepare('SELECT status FROM vuln WHERE id = ?').get(vulnId).status, 'candidate')
    if (variant === 'family-mismatch') assert.equal(f.store.db(id).prepare('SELECT title FROM vuln WHERE id = ?').get(vulnId).title, 'Scanner RCE candidate')
    assert.equal(new EvidenceLedger(f.store.db(id)).list({ confidence: 'observed', engagement_id: id }).length, 0)
  }
})

const INPUT_PROOF_FIXTURE = String.raw`
import base64, hashlib, json, sys
from urllib.parse import parse_qs, urlsplit, quote
from unittest.mock import patch
from awa_ddd import engine
from awa_ddd.assessment import evaluate, record_finding
from awa_ddd.candidates import link_candidate
from awa_ddd.store import Project, now
workspace, project_id, candidate_id, endpoint = sys.argv[1:]
source, canary = 'https://canary.invalid/src-fixture', 'SYNTHETIC-SRC-FIXTURE-CANARY'
calls=[]
def fixture_request(url, method='GET', headers=None, body=None, timeout=15, max_bytes=65536):
    assert url.startswith(endpoint+'?url=') and method=='GET'
    chosen=parse_qs(urlsplit(url).query)['url'][0]
    raw=json.dumps({'preview':canary if chosen==source else 'ordinary-fixture-control'}).encode()
    calls.append(url)
    return {'request':{'url':url,'method':method,'headers':headers or {},'body_base64':''},
        'response':{'status':200,'headers':[['Content-Type','application/json']],'complete':True,'length':len(raw),'body_base64':base64.b64encode(raw).decode(),'body_sha256':hashlib.sha256(raw).hexdigest()},
        'started_at':now(),'completed_at':now(),'complete':True,'elapsed_ms':0,'transport':'python-http-client','redirect_followed':False}
with Project(workspace,project_id) as p, patch('awa_ddd.engine.request',fixture_request):
    o=engine.register_operation(p,{'url':endpoint,'method':'GET','auth':'public','inputs':[{'name':'url','location':'query','selector':'url','consumer':'ssrf','test_families':['ssrf']}]})
    engine.build_plan(p)
    item=next(x for x in p.list('obligation') if x['kind']=='input_test' and x['operation_id']==o['id'] and x.get('test_family')=='ssrf')
    ids=[engine.capture(p,{'operation_id':o['id'],'url':endpoint+'?url='+quote(value,safe='')})['id'] for value in (source,'https://control.invalid/empty')]
    d=evaluate(p,{'obligation_id':item['id'],'evidence_ids':ids,'oracle':{'type':'extraction','test_family':'ssrf','selector':'/preview','expect':'^'+canary+'$','expected_value':canary,'source_reference':source}})
    assert d['outcome']=='confirmed'
    f=record_finding(p,{'decision_id':d['id'],'title':'SRC bounded canary fixture','category':'ssrf','impact':'Synthetic canary-only disclosure','remediation':'Validate server-side fetch destinations'})
    link_candidate(p,{'candidate_id':candidate_id,'operation_id':o['id']})
    print(json.dumps({'operation_id':o['id'],'decision_id':d['id'],'finding_id':f['id'],'mock_requests':len(calls)}))
`

integrationTest('verify requires the exact candidate input binding before a typed input proof can confirm SRC', async (_t, f) => {
  const id = engagement(f.store, 'SRC exact input verification', 'src')
  const endpoint = 'https://fixture.invalid/api/fetch'
  const vulnId = addCandidate(f.store, id, { target: endpoint, title: 'SSRF input fixture' })
  const created = await awaProject(f.store, id, { mode: 'create', target: endpoint, scope })
  const pushed = await awaSync(f.store, id, { mode: 'push' })
  const proof = await alterFixture(f, created.binding, INPUT_PROOF_FIXTURE, pushed.data.candidate_ids[0], endpoint)
  assert.equal(proof.mock_requests, 2)
  const pending = await awaSync(f.store, id, { mode: 'verify' })
  assert.equal(pending.reviews[0].status, 'confirmation_pending')
  assert.equal(pending.data.candidates[0].decisions[0].reason, 'input_binding_required')
  assert.equal(f.store.db(id).prepare('SELECT status FROM vuln WHERE id = ?').get(vulnId).status, 'candidate')
  assert.equal(new EvidenceLedger(f.store.db(id)).list({ confidence: 'observed', engagement_id: id }).length, 0)
  await awaCall(f.store, id, 'candidate.link', { candidate_id: pushed.data.candidate_ids[0], operation_id: proof.operation_id,
    input_location: 'query', input_selector: 'url' })
  const verified = await awaSync(f.store, id, { mode: 'verify' })
  assert.equal(verified.reviews[0].status, 'verified')
  assert.equal(f.store.db(id).prepare('SELECT status FROM vuln WHERE id = ?').get(vulnId).status, 'confirmed')
})
