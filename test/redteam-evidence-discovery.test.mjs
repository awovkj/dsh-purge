import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { RedteamStore } from '../lib/redteam/store-core.js'
import { removeTreeNoFollowSync } from '../lib/remove-tree.js'
import { saveAwaSettings } from '../lib/redteam/settings.js'
import { initializeAssessment, assessmentRun } from '../lib/redteam/awa-integration.js'
import { defaultPythonExecutable, nativeRuntimeOf, readNativeContext } from '../lib/redteam/native-assessment.js'
import { withAssessmentDatabase } from '../lib/redteam/assessment-artifacts.js'
import { evidenceDiffActionHelp, compareAssessmentEvidence, safeDiscoveryText, redactDiscoveryText } from '../lib/redteam/evidence-diff.js'
import { sourcemapDiscoveryActionHelp, discoverAssessmentSourcemap } from '../lib/redteam/sourcemap-discovery.js'

const ENGINE = fileURLToPath(new URL('../lib/redteam/assessment-engine/', import.meta.url))
const origin = 'https://discovery.fixture.invalid'
const secret = 'FIXTURE-PRIVATE-VALUE-DO-NOT-PUBLISH'
const cloudKey = 'AKIA1234567890ABCDEF'
const sha = value => createHash('sha256').update(value).digest('hex')

// The bundled engine creates real projects, operations, lineage and artifacts.
// Only HTTP transport is replaced; every attempted network socket fails.
const PYTHON_FIXTURE = String.raw`
import base64, hashlib, json, socket, sys
from urllib.parse import urlsplit
from unittest.mock import patch
from awa_ddd.store import now
from awa_ddd.__main__ import main
workspace=sys.argv[1]
secret='FIXTURE-PRIVATE-VALUE-DO-NOT-PUBLISH'
source_map={'version':3,'sources':['../../escaped.env','webpack:///src/app.js','empty.js'],'names':[],'mappings':'','sourceRoot':'../../never-fetch/',
 'sourcesContent':['const password = "'+secret+'"; const apiKey = "AKIA1234567890ABCDEF";',
  'export const route="/api/items"; const other="https://outside.invalid/api/users";','']}
raw_map=json.dumps(source_map,separators=(',',':')).encode()
inline='const misleading="//# sourceMappingURL=not-a-comment.map";\n//# sourceMappingURL=data:application/json;base64,'+base64.b64encode(raw_map).decode()
fixtures={
 '/api/a':{'items':[{'id':1,'role':'viewer','password':secret}],'echo':secret,'trace':'first','type':1,'a/b':{'~key':True}},
 '/api/b':{'items':[{'id':2,'role':'admin','password':'SECOND-PRIVATE-VALUE'}],'echo':secret,'trace':'second','type':'1','a/b':{'~key':False},'new':True},
 '/api/order-a':{'a':1,'b':[1,2]},'/api/order-b':{'b':[1,2],'a':1},
 '/api/unsafe':None,'/api/deep':None,
 '/assets/app.js.map':source_map,'/assets/wrong.js.map':source_map,
 '/assets/inline.js':inline,'/assets/external.js':'const a=1;\n//# sourceMappingURL=app.js.map',
 '/assets/fake.js':'const a="//# sourceMappingURL=app.js.map";',
 '/assets/outside.js':'const a=1;\n//# sourceMappingURL=https://outside.invalid/private.map',
 '/assets/ambiguous.js':'//# sourceMappingURL=a.map\n//# sourceMappingURL=b.map',
 '/assets/bad-inline.js':'//# sourceMappingURL=data:application/json;base64,@@@@',
 '/assets/text-a.txt':'normal\npassword: '+secret+'\nend',
 '/assets/text-b.txt':'normal\npassword: SECOND-PRIVATE-VALUE\nend',
 '/assets/indexed.map':{'version':3,'sections':[]},'/assets/html.map':'<html>SPA fallback</html>',
 '/assets/big.map':{'version':3,'sources':['x']*501,'mappings':''},
 '/assets/surrogate.map':{'version':3,'sources':['x'],'sourcesContent':['\ud800'],'mappings':''},
 '/assets/huge.txt':'x'*(2*1024*1024+1),
 '/api/profile':{'subject':'fixture-user','roles':[]},
}
def request(url,method='GET',headers=None,body=None,timeout=15,max_bytes=1048576):
 assert url.startswith('https://discovery.fixture.invalid/'), 'fixture prohibits other origins'
 pathname=urlsplit(url).path
 value=fixtures.get(pathname,{'ok':True})
 content_type='text/javascript' if pathname.endswith('.js') else ('text/plain' if pathname.endswith('.txt') else 'application/json')
 if pathname=='/api/unsafe': raw=b'{"value":9007199254740993}'
 elif pathname=='/api/deep': raw=('['*40+'0'+']'*40).encode()
 else: raw=value.encode() if isinstance(value,str) else json.dumps(value,separators=(',',':')).encode()
 complete=len(raw)<=max_bytes
 raw=raw[:max_bytes]
 return {'request':{'url':url,'method':method,'headers':headers or {},'body_base64':''},
  'response':{'status':200,'headers':[['Content-Type',content_type],['Set-Cookie','fixture='+secret+'; Path=/; HttpOnly']],
   'complete':complete,'length':len(raw),'body_base64':base64.b64encode(raw).decode(),'body_sha256':hashlib.sha256(raw).hexdigest()},
  'started_at':now(),'completed_at':now(),'complete':complete,'elapsed_ms':0,'transport':'fixture','redirect_followed':False}
sys.argv=['fixture','--workspace',workspace]
with patch('awa_ddd.engine.request',request),patch('socket.create_connection',side_effect=AssertionError('no sockets')),patch('socket.socket.connect',side_effect=AssertionError('no sockets')):
 main()
`
function nativeFixture(pythonExecutable) {
  return async (config, action, args, options = {}) => new Promise((resolve, reject) => {
    const child = execFile(pythonExecutable, ['-E', '-s', '-X', 'utf8', '-B', '-c', PYTHON_FIXTURE, config.workspace],
      { cwd: ENGINE, windowsHide: true, encoding: 'utf8', timeout: 15000, maxBuffer: 4 * 1024 * 1024, signal: options.signal }, (error, stdout, stderr) => {
        if (error) { reject(new Error('isolated discovery fixture failed: ' + (stderr || error.message))); return }
        let result
        try { result = JSON.parse(stdout) } catch (error) { reject(error); return }
        if (result.ok !== true) { reject(Object.assign(new Error(result.error.message), { code: result.error.code, details: result.error.details })); return }
        resolve(result)
      })
    child.stdin.end(JSON.stringify({ action, args }))
  })
}
async function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'purge-evidence-discovery-'))
  const store = new RedteamStore(root)
  t.after(() => {
    store.close()
    const relative = path.relative(path.resolve(os.tmpdir()), path.resolve(root))
    assert(relative && !path.isAbsolute(relative) && !relative.startsWith('..') && path.basename(root).startsWith('purge-evidence-discovery-'))
    removeTreeNoFollowSync(path.resolve(root))
  })
  const id = store.openEngagement('offline discovery fixture', [origin + '/'], { assessment_mode: 'pentest', exclude: [origin + '/excluded'], bindCurrent: false }).id
  const python = process.env.AWA_DDD_TEST_PYTHON || defaultPythonExecutable()
  saveAwaSettings(root, { pythonExecutable: python, timeoutMs: 15000 })
  const options = { invokeEngine: nativeFixture(python) }
  await initializeAssessment(store, id, { target: origin + '/', scope: [origin + '/'] }, options)
  const runtime = nativeRuntimeOf(store, id, options), context = readNativeContext(store, id)
  const run = (action, input) => assessmentRun(store, id, action, input, options)
  const cache = new Map()
  const capture = async (pathname, settings = {}) => {
    const key = JSON.stringify([pathname, settings])
    if (cache.has(key)) return cache.get(key)
    const op = (await run('surface.register', { url: origin + pathname, method: 'GET', auth: 'public' })).data.id
    const result = await run('http.capture', { operation_id: op, ...settings })
    cache.set(key, result.data.id)
    return result.data.id
  }
  return { store, id, runtime, context, options, run, capture }
}

test('new action help declares offline contracts and rejects guessed public action names', () => {
  assert.equal(evidenceDiffActionHelp('evidence.diff').requests_sent, 0)
  assert.equal(sourcemapDiscoveryActionHelp('surface.from_sourcemap').requests_sent, 0)
  assert.equal(evidenceDiffActionHelp('response.diff'), null)
  assert.equal(sourcemapDiscoveryActionHelp('surface.download_sourcemap'), null)
})

test('safeDiscoveryText hides complete spaced or unfinished authentication values in public summaries', () => {
  const privateValue = 'opaqueSyntheticSecret123'
  const samples = [
    'const headers = {"Authorization": "Custom ' + privateValue + '"};',
    "const headers = {'authorization': 'Custom prefix " + privateValue + " suffix'};",
    'const headers = {"Cookie": "id=plain; session=' + privateValue + '"};',
    'const config = {"password": "space ' + privateValue + ' value"};',
    'const config = {apiKey: `Custom prefix ' + privateValue + ' suffix`};',
    'Authorization: "Custom unfinished ' + privateValue + '\npublic next line',
    'token: \'Custom unfinished ' + privateValue,
    'Authorization: Custom prefix ' + privateValue + ' trailing\npublic next line',
    'Cookie: id=plain; session=' + privateValue + '; other=additional-private-value',
    String.raw`const headers = {"Authorization": "Custom \"quoted\" ` + privateValue + String.raw` suffix"};`,
    'const headers = {"Authorization": "Custom\n' + privateValue + '\nvalue"};',
  ]
  for (const sample of samples) {
    const full = redactDiscoveryText(sample)
    assert(!full.includes(privateValue), full)
    assert(!full.includes('additional-private-value'), full)
    assert(!full.includes('suffix'), full)
    const output = safeDiscoveryText(sample, [], 4096)
    assert(!output.includes(privateValue), output)
    assert(!output.includes('additional-private-value'), output)
    assert(!output.includes('suffix'), output)
    assert(output.includes('[redacted]'), output)
    assert(!/[\r\n\x00-\x1f\x7f]/.test(output), output)
  }
  assert.equal(safeDiscoveryText('public route /api/items'), 'public route /api/items')
})

test('redactDiscoveryText preserves complete redacted multiline text for workspace consumers', () => {
  const privateValue = 'opaqueSyntheticSecret123'
  const source = 'public first line\nconst headers = {"Authorization": "Custom\n' + privateValue
    + '\nwith escaped \\"quote\\" tail"};\npublic last line\n' + 'retain this full text '.repeat(10000)
  const full = redactDiscoveryText(source)
  assert(full.startsWith('public first line\n'))
  assert(full.includes('\npublic last line\n'))
  assert(full.endsWith('retain this full text '.repeat(10000)))
  assert(!full.includes(privateValue)); assert(!full.includes('escaped')); assert(!full.includes('tail'))
  assert(full.length > 160)
  const summary = safeDiscoveryText(source, [], 80)
  assert.equal(summary.length, 80)
  assert(!summary.includes('\n'))
  assert.equal(redactDiscoveryText('first\nknown private\nlast', ['private']), 'first\nknown [redacted]\nlast')
})

test('real native captures support bounded private differences and sourcemap extraction without network', { timeout: 240000 }, async t => {
  const { store, id, runtime, context, options, run, capture } = await fixture(t)
  const diff = input => compareAssessmentEvidence(store, id, runtime, context, input, options)
  const sourcemap = input => discoverAssessmentSourcemap(store, id, runtime, context, input, options)
  const a = await capture('/api/a'), b = await capture('/api/b')
  await t.test('nested type/array/key changes retain exact provenance and redact both private keys and credential echoes', async () => {
    const result = await diff({ evidence_ids: [a, b], include_values: true })
    assert.equal(result.requests_sent, 0)
    assert.equal(result.data.can_confirm, false)
    assert.equal(result.data.security_coverage_granted, false)
    assert(result.data.items.some(row => row.selector === '/items/0/id' && row.value_a === 1 && row.value_b === 2))
    assert(result.data.items.some(row => row.selector === '/type' && row.change === 'type_changed'))
    assert(result.data.items.some(row => row.selector === '/a~1b/~0key'))
    const password = result.data.items.find(row => row.selector === '/items/0/password')
    assert.equal(password.value_a, '[redacted]'); assert.equal(password.value_b, '[redacted]')
    assert(!JSON.stringify(result).includes(secret)); assert(!JSON.stringify(result).includes('SECOND-PRIVATE-VALUE'))
    assert.equal(result.data.sources[0].evidence_id, a)
    assert.match(result.data.sources[0].artifact_sha256, /^[a-f0-9]{64}$/)
    assert.equal(result.data.exact_body_match, false)
  })
  await t.test('order-independent JSON comparisons preserve exact byte mismatch and explicit omission/pagination', async () => {
    const orderA = await capture('/api/order-a'), orderB = await capture('/api/order-b')
    const same = await diff({ evidence_ids: [orderA, orderB] })
    assert.equal(same.data.total, 0); assert.equal(same.data.exact_body_match, false)
    const page = await diff({ evidence_ids: [a, b], limit: 1, ignore_selectors: ['/items', '/trace'] })
    assert.equal(page.data.items.length, 1); assert.equal(page.data.next_offset, 1)
    assert.equal(page.data.omitted_subtrees, 2)
    assert(!page.data.items.some(row => row.selector.startsWith('/items/')))
    assert(!JSON.stringify(page).includes('SECOND-PRIVATE-VALUE'))
  })
  await t.test('text inspection gives bounded redacted change locations without interpreting a security outcome', async () => {
    const textA = await capture('/assets/text-a.txt'), textB = await capture('/assets/text-b.txt')
    const result = await diff({ evidence_ids: [textA, textB], include_values: true })
    assert.equal(result.data.kind, 'text_diff'); assert.equal(result.data.total, 1)
    assert(!JSON.stringify(result).includes(secret)); assert(!JSON.stringify(result).includes('SECOND-PRIVATE-VALUE'))
  })
  await t.test('wrong IDs, guessed fields, scalar/structure budgets, truncation and cancellation fail locally', async () => {
    await assert.rejects(diff({ evidence_ids: [a, a] }), { code: 'ASSESSMENT_DIFF_IDS' })
    await assert.rejects(diff({ evidence_ids: [a, b], url: origin }), { code: 'ASSESSMENT_DIFF_FIELDS' })
    await assert.rejects(diff({ evidence_ids: [a, b], ignore_selectors: ['/bad~2'] }), { code: 'ASSESSMENT_DIFF_SELECTORS' })
    await assert.rejects(diff({ evidence_ids: [a, await capture('/api/unsafe')] }), { code: 'ASSESSMENT_DIFF_JSON_NUMBER' })
    await assert.rejects(diff({ evidence_ids: [await capture('/api/deep'), await capture('/api/deep', { headers: { 'X-Control': 'second' } })] }), { code: 'ASSESSMENT_DIFF_BUDGET' })
    await assert.rejects(diff({ evidence_ids: [a, await capture('/assets/huge.txt', { max_bytes: 64 })] }), { code: 'ASSESSMENT_EVIDENCE_CURRENT' })
    await assert.rejects(diff({ evidence_ids: [a, await capture('/assets/huge.txt', { max_bytes: 3 * 1024 * 1024 })] }), { code: 'ASSESSMENT_DIFF_BUDGET' })
    const signal = AbortSignal.abort()
    await assert.rejects(compareAssessmentEvidence(store, id, runtime, context, { evidence_ids: [a, b] }, { ...options, signal }), error => error.name === 'AbortError')
  })
  await t.test('standalone map reconstructs original bytes under hash names without source path traversal or secret publication', async () => {
    const map = await capture('/assets/app.js.map')
    const result = await sourcemap({ evidence_id: map, limit: 2 })
    assert.equal(result.requests_sent, 0); assert.equal(result.data.source_kind, 'captured_map')
    assert.equal(result.data.total, 3); assert.equal(result.data.next_offset, 2)
    assert.equal(result.data.sources_with_content, 3)
    assert(result.data.secret_signals.some(row => row.type === 'cloud_access_key_literal'))
    assert(result.data.route_hints.some(row => row.url === origin + '/api/items' && row.in_scope === true))
    assert(result.data.route_hints.some(row => row.in_scope === false))
    assert(result.data.route_hints.every(row => row.declaration_only && row.runtime_verified === false))
    assert(!JSON.stringify(result).includes(secret)); assert(!JSON.stringify(result).includes(cloudKey))
    assert.equal(result.data.can_confirm, false); assert.equal(result.data.severity_assigned, false)
    const first = result.data.sources[0]
    assert.match(path.basename(first.source_file), /^\d{4}-[a-f0-9]{64}\.txt$/)
    assert(!fs.existsSync(path.join(store.dirOf(id), 'escaped.env')))
    const bytes = fs.readFileSync(path.join(store.dirOf(id), first.source_file))
    assert.equal(sha(bytes), first.content_sha256); assert(bytes.toString().includes(secret))
    const manifestBytes = fs.readFileSync(path.join(store.dirOf(id), result.data.manifest_path))
    assert.equal(sha(manifestBytes), result.data.manifest_sha256)
    assert(!manifestBytes.toString().includes(secret)); assert(!manifestBytes.toString().includes(cloudKey))
  })
  await t.test('only real comments select inline maps and save:false returns private metadata without deriving files', async () => {
    const inline = await capture('/assets/inline.js')
    const result = await sourcemap({ evidence_id: inline, save: false })
    assert.equal(result.data.source_kind, 'inline_map'); assert.equal(result.data.private_sources_saved, false)
    assert.equal(result.data.manifest_path, undefined)
    assert(result.data.sources.every(row => row.source_file === undefined))
    assert.equal((await sourcemap({ evidence_id: await capture('/assets/fake.js') })).data.state, 'no_declared_sourcemap')
  })
  await t.test('a missing installed parser blocks JavaScript discovery while module loading and captured JSON maps remain usable', async () => {
    const isolated = fs.mkdtempSync(path.join(os.tmpdir(), 'purge-parser-missing-'))
    t.after(() => {
      assert(path.dirname(isolated) === path.resolve(os.tmpdir()) && path.basename(isolated).startsWith('purge-parser-missing-'))
      removeTreeNoFollowSync(isolated)
    })
    fs.cpSync(fileURLToPath(new URL('../lib/', import.meta.url)), path.join(isolated, 'lib'), { recursive: true })
    fs.writeFileSync(path.join(isolated, 'package.json'), JSON.stringify({ type: 'module' }))
    const parserPackage = path.join(isolated, 'node_modules', 'acorn')
    fs.mkdirSync(parserPackage, { recursive: true })
    fs.writeFileSync(path.join(parserPackage, 'package.json'), JSON.stringify({ name: 'acorn', type: 'module', exports: './missing-parser.js' }))
    const loaded = await import(pathToFileURL(path.join(isolated, 'lib', 'redteam', 'sourcemap-discovery.js')).href)
    assert.equal(typeof loaded.discoverAssessmentSourcemap, 'function')
    const facade = await import(pathToFileURL(path.join(isolated, 'lib', 'redteam', 'awa-integration.js')).href)
    assert.equal(typeof facade.initializeAssessment, 'function')
    const direct = await loaded.discoverAssessmentSourcemap(store, id, runtime, context,
      { evidence_id: await capture('/assets/app.js.map'), save: false }, options)
    assert.equal(direct.data.state, 'sourcemap_parsed')
    assert.equal(direct.requests_sent, 0)
    await assert.rejects(loaded.discoverAssessmentSourcemap(store, id, runtime, context,
      { evidence_id: await capture('/assets/inline.js'), save: false }, options),
    error => error.code === 'ASSESSMENT_SOURCEMAP_PARSER' && error.recovery.requests_sent === 0)
  })
  await t.test('external maps need exact explicit current captures; undeclared locations and scope changes never trigger download', async () => {
    const js = await capture('/assets/external.js'), map = await capture('/assets/app.js.map')
    const declaration = await sourcemap({ evidence_id: js })
    assert.equal(declaration.data.state, 'external_map_declared'); assert.equal(declaration.requests_sent, 0)
    const result = await sourcemap({ evidence_id: js, map_evidence_id: map, save: false })
    assert.equal(result.data.source_kind, 'declared_external_map')
    assert.deepEqual(result.data.source_evidence_ids, [js, map])
    await assert.rejects(sourcemap({ evidence_id: js, map_evidence_id: await capture('/assets/wrong.js.map') }), { code: 'ASSESSMENT_SOURCEMAP_BINDING' })
    await assert.rejects(sourcemap({ evidence_id: await capture('/assets/outside.js') }), { code: 'ASSESSMENT_SOURCEMAP_SCOPE' })
  })
  await t.test('matching map URLs cannot transfer observations across native identities', async () => {
    await run('identity.actor', { actor_id: 'A-fixture-user', subject: 'fixture-user', roles: [] })
    const session = await run('identity.session', { actor_id: 'A-fixture-user', origin_url: origin + '/api/profile', headers: { Authorization: 'Bearer ' + secret } })
    const profile = (await run('surface.register', { url: origin + '/api/profile', method: 'GET', auth: 'authenticated' })).data.id
    await run('identity.verify', { operation_id: profile, session_id: session.data.id, subject_selector: '/subject', roles_selector: '/roles' })
    const authenticatedMap = await capture('/assets/app.js.map', { session_id: session.data.id })
    await assert.rejects(sourcemap({ evidence_id: await capture('/assets/external.js'), map_evidence_id: authenticatedMap }), { code: 'ASSESSMENT_SOURCEMAP_BINDING' })
  })
  await t.test('evidence IDs from another prepared engagement remain unavailable', async () => {
    const other = store.openEngagement('different offline fixture', [origin + '/'], { assessment_mode: 'pentest', exclude: [], bindCurrent: false }).id
    await initializeAssessment(store, other, { target: origin + '/', scope: [origin + '/'] }, options)
    await assert.rejects(compareAssessmentEvidence(store, other, nativeRuntimeOf(store, other, options), readNativeContext(store, other),
      { evidence_ids: [a, b] }, options), error => /evidence|exist|found/i.test(error.message))
  })
  await t.test('malformed, ambiguous, oversized and nonlossless maps are explicit unresolved errors', async () => {
    await assert.rejects(sourcemap({ evidence_id: await capture('/assets/ambiguous.js') }), { code: 'ASSESSMENT_SOURCEMAP_REFERENCES' })
    await assert.rejects(sourcemap({ evidence_id: await capture('/assets/bad-inline.js') }), { code: 'ASSESSMENT_SOURCEMAP_INLINE' })
    await assert.rejects(sourcemap({ evidence_id: await capture('/assets/indexed.map') }), { code: 'ASSESSMENT_SOURCEMAP_FORMAT' })
    await assert.rejects(sourcemap({ evidence_id: await capture('/assets/html.map') }), { code: 'ASSESSMENT_SOURCEMAP_TYPE' })
    await assert.rejects(sourcemap({ evidence_id: await capture('/assets/big.map') }), { code: 'ASSESSMENT_SOURCEMAP_FORMAT' })
    await assert.rejects(sourcemap({ evidence_id: await capture('/assets/surrogate.map') }), { code: 'ASSESSMENT_SOURCEMAP_ENCODING' })
    await assert.rejects(sourcemap({ evidence_id: a, path: '../../outside' }), { code: 'ASSESSMENT_SOURCEMAP_FIELDS' })
  })
  await t.test('tampered artifacts and current-operation drift cannot become inspection inputs', async () => {
    const record = withAssessmentDatabase(store, id, context, db => JSON.parse(db.prepare("SELECT document FROM entities WHERE kind='evidence' AND id=?").get(a).document))
    const artifact = path.join(context.workspace, 'projects', 'assessment', record.artifact_path)
    const saved = fs.readFileSync(artifact)
    fs.writeFileSync(artifact, saved.toString() + ' ')
    try { await assert.rejects(diff({ evidence_ids: [a, b] }), { code: 'ASSESSMENT_EVIDENCE_CURRENT' }) }
    finally { fs.writeFileSync(artifact, saved) }
    await run('surface.register', { url: origin + '/api/a', method: 'GET', auth: 'authenticated' })
    await assert.rejects(diff({ evidence_ids: [a, b] }), { code: 'ASSESSMENT_EVIDENCE_CURRENT' })
  })
})
