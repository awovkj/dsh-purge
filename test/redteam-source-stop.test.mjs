import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { defaultPythonExecutable } from '../lib/redteam/native-assessment.js'
import { sourceStopRule, sourceStopMatches } from '../lib/redteam/source-stop.js'

const engine = path.resolve('lib/redteam/assessment-engine')
const python = process.env.AWA_DDD_TEST_PYTHON || defaultPythonExecutable()
const script = String.raw`
import base64, hashlib, json, pathlib, sys
from unittest.mock import patch
from awa_ddd.store import Project, EngineError, now
from awa_ddd import engine
from awa_ddd.scope import validate_config
from awa_ddd.assessment_mode import browser_stop_rules, capture_policy
from awa_ddd.execution import test_runner
workspace = pathlib.Path(sys.argv[1])
rules = json.load(sys.stdin)
document = {'schema':'dsh-purge-source-stops/v1','project_id':'assessment','source_engagement_id':'rt-'+'a'*24,'rules':rules}
snapshot = workspace / 'dsh-source-stops.json'
calls=[]
def request(url,method='GET',headers=None,body=None,timeout=15,max_bytes=65536):
    calls.append(url)
    raw=b'{"synthetic":true}'
    return {'request':{'url':url,'method':method,'headers':headers or {},'body_base64':''},
        'response':{'status':200,'headers':[['Content-Type','application/json']],'complete':True,'length':len(raw),
          'body_base64':base64.b64encode(raw).decode(),'body_sha256':hashlib.sha256(raw).hexdigest()},
        'started_at':now(),'completed_at':now(),'complete':True,'elapsed_ms':0,'transport':'fixture','redirect_followed':False}
def denied(action):
    before=len(calls)
    try: action()
    except EngineError as exc:
        assert exc.code == 'stopped_at_evidence', (exc.code,str(exc))
        assert exc.details['requests_sent']==0
    else: raise AssertionError('stopped resource was permitted')
    assert len(calls)==before
with Project(workspace,'assessment',create=True) as p, patch('awa_ddd.engine.request',request), \
     patch('socket.create_connection',side_effect=AssertionError('No real connection permitted')), \
     patch('socket.socket.connect',side_effect=AssertionError('No real socket permitted')):
    p.set_config(validate_config({'target':'https://fixture.invalid/api','scope':['https://fixture.invalid/api'],
        'exclude':[],'assessment_mode':'src','allow_mutation':False}))
    snapshot.write_text(json.dumps(document),encoding='utf-8')
    stop=engine.register_operation(p,{'url':'https://fixture.invalid/api/private','method':'GET','auth':'anonymous'})
    alias=engine.register_operation(p,{'url':'https://fixture.invalid/api/%70rivate','method':'GET','auth':'anonymous'})
    template=engine.register_operation(p,{'url':'https://fixture.invalid/api/items/{record}','method':'GET','auth':'anonymous'})
    denied(lambda:engine.capture(p,{'operation_id':stop['id'],'url':stop['url']+'?changed=1'}))
    denied(lambda:engine.capture(p,{'operation_id':alias['id']}))
    denied(lambda:engine.preflight_capture(p,{'operation_id':template['id'],'url':'https://fixture.invalid/api/items/12'}))
    # Even an unstopped native template must check the actual bound URL before dispatch.
    actual=engine.register_operation(p,{'url':'https://fixture.invalid/api/{name}','method':'GET','auth':'anonymous'})
    denied(lambda:engine.capture(p,{'operation_id':actual['id'],'url':stop['url']}))
    p.add_actor if False else None
    engine.add_actor(p,{'actor_id':'fixture','subject':'fixture','roles':['user']})
    session=engine.add_session(p,{'actor_id':'fixture','headers':{'Cookie':'synthetic=only'}})
    denied(lambda:engine.verify_identity(p,{'operation_id':stop['id'],'session_id':session['id'],
        'subject_selector':'/synthetic','roles_selector':'/roles'}))
    from awa_ddd.browser import visit
    denied(lambda:visit(p,{'url':stop['url']}))
    spec=browser_stop_rules(p)
    assert spec['sourceStopFile']==str(snapshot)
    pathlib.Path(workspace/'browser-stop-spec.json').write_text(json.dumps(spec),encoding='utf-8')
    # Exercise the indirect recipe execution entry before prerequisites or transport are reached.
    recipe={'id':'R-fixture','hypothesis_id':'H-fixture','limits':{'effect':'read_only'}}
    hypothesis={'id':'H-fixture'}
    class Repo:
        def __init__(self,project): pass
        def get(self,kind,identity): return recipe if kind=='recipe' else hypothesis
    with patch.object(test_runner,'Repository',Repo), patch.object(test_runner,'_campaign',return_value={'id':'CAM-fixture'}), \
         patch.object(test_runner,'_existing',return_value=None), patch.object(test_runner,'assert_current'), \
         patch.object(test_runner,'context',return_value={}), patch.object(test_runner,'_operation',return_value=stop):
        denied(lambda:test_runner.run(p,{'recipe_id':'R-fixture','idempotency_key':'synthetic'}))
        with patch.object(test_runner,'_verify',return_value={'offline':True}):
            assert test_runner.run(p,{'recipe_id':'R-fixture','mode':'verify'})=={'offline':True}
    assert not calls
    public=engine.register_operation(p,{'url':'https://fixture.invalid/api/public','method':'GET','auth':'anonymous'})
    engine.capture(p,{'operation_id':public['id']})
    assert len(calls)==1
    snapshot.write_text('{invalid',encoding='utf-8')
    try: engine.capture(p,{'operation_id':public['id']})
    except EngineError as exc: assert exc.code=='src_stop_snapshot' and exc.details['requests_sent']==0
    else: raise AssertionError('invalid snapshot must block before dispatch')
    assert len(calls)==1
print(json.dumps({'mock_requests':len(calls),'stopped_requests':0}))
`

test('SRC resource matching covers queries, encoded names, templates, IPv6 and explicit ports without swallowing siblings', () => {
  for (const [stopped, current] of [
    ['https://FIXTURE.invalid:443/api/private?x=1', 'https://fixture.invalid/api/%70rivate?x=2'],
    ['https://fixture.invalid/api/items/{record}', 'https://fixture.invalid/api/items/42'],
    ['[2001:db8::1]:8443', 'https://[2001:db8::01]:8443/private'],
  ]) assert.equal(sourceStopMatches(stopped, current), true)
  assert.equal(sourceStopMatches('https://fixture.invalid/api/private', 'https://fixture.invalid/api/private-more'), false)
  assert.equal(sourceStopMatches('fixture.invalid:8443', 'https://fixture.invalid:9443/private'), false)
  assert.throws(() => sourceStopMatches('https://fixture.invalid/api', 'https://fixture.invalid/api/%252e%252e/private'), /ambiguous/)
})

test('native capture, preflight, identity, browser entry and indirect recipes reject source stops before sending', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'purge-source-stop-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const rules = ['https://fixture.invalid/api/private', 'https://fixture.invalid/api/items/{record}']
    .map((target, index) => sourceStopRule(target, { id: 'source-' + (index + 1) + '-' + 'a'.repeat(16), evidence_ids: ['ev_' + 'a'.repeat(64)] }))
  const result = spawnSync(python, ['-E', '-s', '-X', 'utf8', '-B', '-c', script, root],
    { cwd: engine, input: JSON.stringify(rules), encoding: 'utf8', windowsHide: true, timeout: 25000, maxBuffer: 1024 * 1024 })
  assert.equal(result.status, 0, result.stderr || result.error?.message)
  assert.equal(JSON.parse(result.stdout).stopped_requests, 0)
})

test('browser router refreshes source stops and blocks stopped or corrupt resources before fetch', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'purge-browser-stop-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const source = fs.readFileSync(path.join(engine, 'awa_ddd/browser.py'), 'utf8').split('_VISIT = r"""')[1].split('"""')[0]
  const helper = source.slice(source.indexOf('function parsedURL'), source.indexOf('// A write is only'))
  const snapshot = path.join(root, 'dsh-source-stops.json')
  const document = { schema: 'dsh-purge-source-stops/v1', project_id: 'assessment', source_engagement_id: 'rt-' + 'a'.repeat(24), rules: [] }
  fs.writeFileSync(snapshot, JSON.stringify(document))
  const spec = { url: 'https://fixture.invalid/api/public', scope: [{ scheme: 'https', authority: 'fixture.invalid', root: '/api' }], exclude: [],
    sourceStopFile: snapshot, sourceStopIdentity: document.source_engagement_id, stopRules: [] }
  const evaluate = new Function('fs', 'spec', helper + ';return {stopped,allowed};')(fs, spec)
  assert.equal(evaluate.stopped('https://fixture.invalid/api/private'), false)
  document.rules = [sourceStopRule('https://fixture.invalid/api/private', { id: 'source-1-' + 'a'.repeat(16), evidence_ids: [] })]
  fs.writeFileSync(snapshot, JSON.stringify(document))
  assert.equal(evaluate.stopped('https://fixture.invalid/api/%70rivate?x=1'), true)
  assert.equal(evaluate.stopped(spec.url), false)
  // Run the actual route guard with a synthetic route; every stop must abort before route.fetch.
  const routeBody = source.slice(source.indexOf("await context.route('**/*', async route => {")
    + "await context.route('**/*', async route => {".length, source.indexOf("      if (!['GET', 'HEAD', 'OPTIONS'].includes(method))"))
  const guard = new Function('route', 'out', 'actionIndex', 'allowed', 'stopped', 'block',
    'return (async()=>{' + routeBody + '})()')
  let aborted = 0
  const route = { request: () => ({ url: () => 'https://fixture.invalid/api/private', method: () => 'GET', resourceType: () => 'fetch' }),
    abort: async () => { aborted++ }, fetch: () => assert.fail('stopped resource cannot reach fetch') }
  return (async () => {
    const out = { network: [] }
    await guard(route, out, null, evaluate.allowed, evaluate.stopped, () => {})
    assert.equal(aborted, 1); assert.equal(out.network[0].reason, 'stopped_at_evidence')
    fs.writeFileSync(snapshot, '{invalid')
    await guard(route, out, null, evaluate.allowed, evaluate.stopped, () => {})
    assert.equal(aborted, 2); assert.equal(out.network[1].reason, 'src_stop_snapshot')
  })()
})
