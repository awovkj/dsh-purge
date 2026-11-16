// Acceptance from the shipped lib tree, with no sibling awa-ddd installation.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { removeTreeNoFollowSync } from '../lib/remove-tree.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const executeFile = promisify(execFile)
const target = 'https://fixture.invalid/api/private'
const scope = ['https://fixture.invalid/api']
const exclude = ['https://fixture.invalid/api/admin']

// Only the owned Python process replaces HTTP transport. The normal embedded
// capture, identity, oracle, finding and candidate APIs create the real proof.
const PROOF = String.raw`
import base64, hashlib, json, sys
from urllib.parse import urlsplit
from unittest.mock import patch
from awa_ddd import engine
from awa_ddd.assessment import evaluate, record_finding
from awa_ddd.candidates import link_candidate
from awa_ddd.store import Project, now
workspace, project_id, candidate_id, endpoint = sys.argv[1:]
calls=[]
def fixture_request(url, method='GET', headers=None, body=None, timeout=15, max_bytes=65536):
    assert url.startswith('https://fixture.invalid/api/') and method == 'GET'
    headers={str(k).lower():str(v) for k,v in (headers or {}).items()}
    actor='allowed' if headers.get('cookie') == 'fixture_actor=allowed' else 'denied'
    document={'id':actor,'roles':['admin'] if actor == 'allowed' else ['user']}
    if urlsplit(url).path != '/api/whoami':
        document={'record':{'id':'fixture-record','value':'synthetic-protected-record'}}
    raw=json.dumps(document,separators=(',',':')).encode()
    calls.append(urlsplit(url).path)
    return {'request':{'url':url,'method':method,'headers':headers,'body_base64':''},
        'response':{'status':200,'headers':[['Content-Type','application/json']],'complete':True,
            'length':len(raw),'body_base64':base64.b64encode(raw).decode(),'body_sha256':hashlib.sha256(raw).hexdigest()},
        'started_at':now(),'completed_at':now(),'complete':True,'elapsed_ms':0,
        'transport':'python-http-client','redirect_followed':False}
with Project(workspace,project_id) as p, patch('awa_ddd.engine.request',fixture_request), \
        patch('socket.create_connection',side_effect=AssertionError('No real socket is allowed in the fixture')), \
        patch('socket.socket.connect',side_effect=AssertionError('No real socket is allowed in the fixture')):
    profile=engine.register_operation(p,{'url':'https://fixture.invalid/api/whoami','method':'GET','auth':'authenticated'})
    operation=engine.register_operation(p,{'url':endpoint,'method':'GET','auth':'restricted','allowed_roles':['admin']})
    sessions={}
    for actor,role in [('allowed','admin'),('denied','user')]:
        engine.add_actor(p,{'actor_id':actor,'subject':actor,'roles':[role]})
        session=engine.add_session(p,{'actor_id':actor,'headers':{'Cookie':'fixture_actor='+actor}})
        engine.verify_identity(p,{'operation_id':profile['id'],'session_id':session['id'],'subject_selector':'/id','roles_selector':'/roles'})
        sessions[actor]=session['id']
    engine.build_plan(p)
    obligation=next(x for x in p.list('obligation') if x['operation_id']==operation['id'] and x['kind']=='access' and x.get('actor_id')=='denied')
    evidence=[engine.capture(p,{'operation_id':operation['id'],'session_id':sessions[actor]})['id'] for actor in ('allowed','denied')]
    decision=evaluate(p,{'obligation_id':obligation['id'],'evidence_ids':evidence,'oracle':{'type':'authorization','selector':'/record'}})
    assert decision['outcome']=='confirmed'
    finding=record_finding(p,{'decision_id':decision['id'],'title':'Embedded authorization fixture',
        'category':'access_control','impact':'Synthetic fixture record only','remediation':'Enforce the declared access policy'})
    link_candidate(p,{'candidate_id':candidate_id,'operation_id':operation['id']})
    print(json.dumps({'mock_requests':len(calls),'operation_id':operation['id'],'decision_id':decision['id'],
        'finding_id':finding['id'],'evidence_ids':evidence}))
`

test('a fresh lib installation performs internal SRC initialization, typed verification, stop and report without external AWA', async t => {
  const container = fs.mkdtempSync(path.join(os.tmpdir(), 'purge-native-assessment-'))
  const install = path.join(container, 'install')
  const stateRoot = path.join(container, 'state')
  let store
  t.after(() => {
    store?.close()
    const resolved = path.resolve(container)
    const relative = path.relative(path.resolve(os.tmpdir()), resolved)
    assert(relative && !path.isAbsolute(relative) && !relative.startsWith('..')
      && path.basename(resolved).startsWith('purge-native-assessment-'), 'cleanup stays inside the fresh isolated install')
    removeTreeNoFollowSync(resolved)
  })
  fs.mkdirSync(install)
  fs.cpSync(path.join(ROOT, 'lib'), path.join(install, 'lib'), { recursive: true,
    filter: source => !['__pycache__', '.pytest_cache'].includes(path.basename(source)) && !source.endsWith('.pyc') })
  const { name, version, type } = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'))
  fs.writeFileSync(path.join(install, 'package.json'), JSON.stringify({ name, version, type }) + '\n')
  const importInstalled = relative => import(pathToFileURL(path.join(install, relative)).href)
  const [{ RedteamStore }, api, { EvidenceLedger }, { saveAwaSettings, writeSettings }, { buildSrcReport }, { defaultPythonExecutable }] = await Promise.all([
    importInstalled('lib/redteam/store-core.js'), importInstalled('lib/redteam/awa-integration.js'),
    importInstalled('lib/redteam/evidence-ledger.mjs'), importInstalled('lib/redteam/settings.js'),
    importInstalled('lib/redteam/src-report.js'), importInstalled('lib/redteam/native-assessment.js'),
  ])
  store = new RedteamStore(stateRoot)
  const pythonExecutable = process.env.AWA_DDD_TEST_PYTHON || defaultPythonExecutable()
  saveAwaSettings(stateRoot, { pythonExecutable, timeoutMs: 15000 })
  const externalPackage = path.join(container, 'nonexistent-awa-package')
  const externalWorkspace = path.join(container, 'nonexistent-awa-state')
  // An old operator settings file and environment must not select an engine or
  // shared workspace after upgrading to the physically embedded component.
  writeSettings(stateRoot, { awa: { pythonExecutable, timeoutMs: 15000,
    packagePath: externalPackage, workspace: externalWorkspace } })
  const options = { env: { AWA_DDD_PACKAGE_PATH: externalPackage, AWA_DDD_WORKSPACE: externalWorkspace } }
  const id = store.openEngagement('中文内置 SRC 验收', scope, { assessment_mode: 'src', exclude, bindCurrent: false }).id
  const secret = 'NATIVE-ASSESSMENT-PRIVATE-FIXTURE-SECRET'
  assert.throws(() => store.addCredential(id, { host: 'fixture.invalid', secret_value: secret }), /SRC policy forbids/)
  // Inert historical material is placed directly in the owned fixture database
  // to exercise upgrade redaction; the public SRC credential operation stays closed.
  store.db(id).prepare('INSERT INTO credential(host,secret_value) VALUES(?,?)').run('fixture.invalid', secret)
  const sourceClaim = { title: 'Scanner authorization claim token=' + secret,
    severity: 'critical', status: 'candidate', cve: 'CVE-2099-1234' }
  const candidate = store.addVuln(id, { target, source: 'inert-fixture', ...sourceClaim })
  const before = await api.assessmentStatus(store, id, options)
  assert.equal(before.engine.embedded, true)
  assert.equal(before.context.ready, false)
  assert.equal(before.requests_sent, 0)
  const initialized = await api.ensureNativeAssessment(store, id, {}, options)
  assert.equal(initialized.ok, true, 'an explicit URL scope initializes the internal assessment without a separate project step')
  const context = api.readNativeContext(store, id)
  assert.equal(context.project_id, 'assessment')
  assert.equal(context.workspace, path.join(store.dirOf(id), 'assessment'))
  const status = await api.assessmentStatus(store, id, options)
  assert.equal(status.engine.embedded, true)
  assert.equal(status.context.ready, true)
  assert.deepEqual(status.context.scope, scope)
  const pushed = await api.awaSync(store, id, { mode: 'push' }, options)
  assert.equal(pushed.requests_sent, 0)
  assert.equal(pushed.data.candidate_ids.length, 1)
  const engineRoot = path.join(install, 'lib', 'redteam', 'assessment-engine')
  const { stdout } = await executeFile(pythonExecutable,
    ['-E', '-s', '-X', 'utf8', '-B', '-c', PROOF, context.workspace, context.project_id, pushed.data.candidate_ids[0], target],
    { cwd: engineRoot, shell: false, windowsHide: true, encoding: 'utf8', timeout: 15000, maxBuffer: 64 * 1024 })
  const proof = JSON.parse(stdout)
  assert.equal(proof.mock_requests, 4)
  const pulled = await api.awaSync(store, id, { mode: 'pull' }, options)
  const ledger = new EvidenceLedger(store.db(id))
  assert.equal(ledger.get(pulled.reviews[0].evidence_ref).confidence, 'inferred')
  assert.equal(store.db(id).prepare('SELECT status FROM vuln WHERE id = ?').get(candidate.id).status, 'candidate')
  const verified = await api.awaSync(store, id, { mode: 'verify' }, options)
  assert.equal(verified.requests_sent, 0)
  assert.equal(verified.reviews[0].status, 'verified')
  const observation = ledger.get(verified.reviews[0].evidence_ref)
  assert.equal(observation.confidence, 'observed')
  assert.equal(observation.result.direct_evidence, true)
  assert.equal(observation.result.decision_id, proof.decision_id)
  assert.deepEqual(observation.result.evidence_ids, proof.evidence_ids)
  assert.equal(observation.result.evidence_hashes.length, 2)
  const claim = ledger.get(observation.supporting_ev_ids[0])
  assert.equal(claim.confidence, 'inferred')
  assert.deepEqual(store.db(id).prepare('SELECT * FROM evidence_verification WHERE claim_id = ?').get(claim.ev_id),
    Object.assign(Object.create(null), { claim_id: claim.ev_id, observation_id: observation.ev_id }))
  const finding = store.db(id).prepare('SELECT status,title,severity,cve,stop_reason FROM vuln WHERE id = ?').get(candidate.id)
  assert.equal(finding.status, 'confirmed')
  assert.match(finding.title, /^access_control: authorization_boundary \(/, 'the machine predicate supplies its bounded title')
  assert.equal(finding.severity, 'medium')
  assert.equal(finding.cve, null)
  assert.equal(finding.stop_reason, 'direct_evidence_obtained')
  const repeated = await api.awaSync(store, id, { mode: 'verify' }, options)
  assert.equal(repeated.reviews[0].evidence_ref, observation.ev_id)
  await assert.rejects(api.awaCall(store, id, 'http.capture', { operation_id: proof.operation_id, url: target }, options), /stopped_at_evidence/)
  const report = buildSrcReport(store, id)
  assert.equal(report.confirmed, 1)
  assert.equal(report.coverage_exhausted, false)
  assert.equal(report.can_claim_complete, false)
  assert.equal(report.requests_sent, 0)
  assert.equal(fs.readFileSync(report.path, 'utf8'), report.markdown)
  assert.equal(path.dirname(report.path), path.join(store.dirOf(id), 'reports'))
  assert.doesNotMatch(JSON.stringify([pushed, pulled, verified, report]), new RegExp(secret + '|fixture_actor=|synthetic-protected-record'))
  assert.equal(fs.existsSync(path.join(container, 'awa-ddd')), false)
  assert.equal(fs.existsSync(externalPackage), false)
  assert.equal(fs.existsSync(externalWorkspace), false)
  assert.equal(fs.existsSync(path.join(stateRoot, 'awa-ddd-data')), false)
})
