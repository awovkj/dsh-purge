import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { captureAssessmentBatch } from '../lib/redteam/assessment-batch.js'
import { RedteamStore } from '../lib/redteam/store-core.js'
import { removeTreeNoFollowSync } from '../lib/remove-tree.js'
import { initializeAssessment, assessmentRun } from '../lib/redteam/awa-integration.js'
import { defaultPythonExecutable, readNativeContext } from '../lib/redteam/native-assessment.js'
import { saveAwaSettings } from '../lib/redteam/settings.js'

const origin = 'https://fixture.invalid'
const engine = fileURLToPath(new URL('../lib/redteam/assessment-engine/', import.meta.url))
const request = (index, extra = {}) => ({ operation_id: 'OP-fixture-' + index,
  idempotency_key: 'fixture-' + index, ...extra })
const evidence = (index, extra = {}) => ({ ok: true, data: { id: 'E-' + index.toString(16).padStart(32, '0'),
  operation_id: 'OP-fixture-' + index, complete: true, status_code: 200, ...extra } })
function fixture(t, mode = 'pentest') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'purge-discovery-facade-'))
  const store = new RedteamStore(root)
  t.after(() => {
    store.close()
    const target = path.resolve(root), relative = path.relative(path.resolve(os.tmpdir()), target)
    assert(relative && !relative.startsWith('..') && !path.isAbsolute(relative)
      && path.basename(target).startsWith('purge-discovery-facade-'))
    removeTreeNoFollowSync(target)
  })
  const id = store.openEngagement('isolated discovery facade', [origin + '/'],
    { assessment_mode: mode, exclude: [origin + '/excluded'], bindCurrent: false }).id
  return { store, root, id }
}

test('capture batches validate the whole bounded input before invoking any tool', async () => {
  let calls = 0
  const invoke = async () => { calls++; return evidence(1) }
  for (const input of [
    { requests: [] }, { requests: Array.from({ length: 21 }, (_, n) => request(n)) },
    { requests: [request(1), request(1)] }, { requests: [request(1, { body: 'unbounded' })] },
    { requests: [request(1, { method: 'GET' })] }, { requests: [request(1, { query: {} })] },
    { requests: [request(1, { effect: 'business_write' })] },
    { requests: [request(1, { idempotency_key: '$(do-not-execute)' })] },
    { requests: [request(1)], stop_on_error: 'false' },
  ]) await assert.rejects(captureAssessmentBatch(input, invoke), /exact|explicit|Each|read-only/)
  assert.equal(calls, 0)
})

test('capture batches preserve order, original indices and evidence IDs without response bodies', async () => {
  const calls = [], keys = []
  let active = 0
  const result = await captureAssessmentBatch({ requests: [request(1), request(2)] }, async (action, input) => {
    assert.equal(active++, 0)
    calls.push(action); keys.push(input.idempotency_key)
    await Promise.resolve()
    active--
    return action === 'http.preflight' ? { ok: true, data: { method: 'GET' } }
      : evidence(Number(input.operation_id.split('-').at(-1)), { response: { body: 'PRIVATE-RESPONSE-BODY' } })
  })
  assert.deepEqual(calls, ['http.preflight', 'http.capture', 'http.preflight', 'http.capture'])
  assert.deepEqual(keys, ['fixture-1', 'fixture-1', 'fixture-2', 'fixture-2'])
  assert.deepEqual(result.data.results.map(row => row.index), [0, 1])
  assert.equal(result.data.results[1].evidence_id, evidence(2).data.id)
  assert.equal(result.data.results[1].observation_next_step.arguments.action, 'evidence.read')
  assert.equal(result.data.capture_attempts, 2)
  assert.equal(result.requests_sent, null, 'a reused native run prevents counting attempts as sent requests')
  assert.equal(result.data.request_count_known, false)
  assert.equal(result.data.can_confirm, false)
  assert(!JSON.stringify(result).includes('PRIVATE-RESPONSE-BODY'))
})

test('only explicit zero-dispatch rejections may be skipped, and actual write methods never capture', async () => {
  const calls = []
  const result = await captureAssessmentBatch({ requests: [request(1), request(2), request(3)], stop_on_error: false },
    async (action, input) => {
      calls.push([action, input.operation_id])
      if (input.operation_id === 'OP-fixture-1') throw Object.assign(new Error('private scope locator'), { code: 'ASSESSMENT_SCOPE' })
      if (input.operation_id === 'OP-fixture-2') return { ok: true, data: { method: 'POST' } }
      return action === 'http.preflight' ? { ok: true, data: { method: 'HEAD' } } : evidence(3)
    })
  assert.deepEqual(result.data.results.map(row => row.state), ['rejected', 'rejected', 'captured'])
  assert.equal(result.data.results[0].requests_sent, 0)
  assert.equal(result.data.results[1].error_code, 'ASSESSMENT_BATCH_METHOD')
  assert.deepEqual(calls.filter(([action]) => action === 'http.capture'), [['http.capture', 'OP-fixture-3']])
  assert.equal(result.data.remaining, 0)
  assert(!JSON.stringify(result).includes('private scope locator'))
})

test('an exact native preflight-reuse receipt still checks the actual method before capture', async () => {
  const seen = []
  const invoke = async action => {
    seen.push(action)
    if (action === 'http.preflight') throw Object.assign(new Error('typed reused preparation'), {
      code: 'already_preflighted', details: { next_action: 'http.capture', request_signature: 'a'.repeat(64) } })
    if (action === 'surface.inspect') return { ok: true, data: { operation: { method: 'GET' } } }
    return evidence(1)
  }
  const result = await captureAssessmentBatch({ requests: [request(1)] }, invoke)
  assert.deepEqual(seen, ['http.preflight', 'surface.inspect', 'http.capture'])
  assert.equal(result.data.results[0].preflight_state, 'already_checked')
  let captured = false
  const malformed = await captureAssessmentBatch({ requests: [request(1)] }, async action => {
    if (action === 'http.capture') captured = true
    throw Object.assign(new Error('not a validated contract'), { code: 'already_preflighted', details: { next_action: 'run.inspect' } })
  })
  assert.equal(malformed.data.rejected, 1)
  assert.equal(captured, false)
})

test('uncertain dispatch, incomplete evidence and cancellation retain recovery and stop further captures', async () => {
  let captures = 0
  const prior = await captureAssessmentBatch({ requests: [request(1), request(2)], stop_on_error: false }, async action => {
    assert.equal(action, 'http.preflight', 'a prior incomplete run must not reach capture')
    throw Object.assign(new Error('previous run remains incomplete'), { code: 'run_uncertain', details: { run_id: 'RUN-prior' } })
  })
  assert.equal(prior.data.stopped_reason, 'dispatch_uncertain')
  assert.equal(prior.data.results[0].run_id, 'RUN-prior')
  assert.equal(prior.requests_sent, 0, 'no new request was attempted while the prior run remains unresolved')
  assert.equal(prior.dispatch_uncertain, true)
  const uncertain = await captureAssessmentBatch({ requests: [request(1), request(2)], stop_on_error: false }, async action => {
    if (action === 'http.preflight') return { ok: true, data: { method: 'GET' } }
    captures++
    throw Object.assign(new Error('transport and secret body must be omitted'), { code: 'capture_failed', details: { run_id: 'RUN-existing' } })
  })
  assert.equal(captures, 1)
  assert.equal(uncertain.data.stopped_reason, 'dispatch_uncertain')
  assert.equal(uncertain.data.results[0].run_id, 'RUN-existing')
  assert.equal(uncertain.data.results[0].requests_sent, null)
  assert.equal(uncertain.data.next_index, 1)
  assert.equal(uncertain.dispatch_uncertain, true)
  assert.equal(uncertain.data.automatic_retry_allowed, false)

  captures = 0
  const incomplete = await captureAssessmentBatch({ requests: [request(1), request(2)], stop_on_error: false }, async action => {
    if (action === 'http.preflight') return { ok: true, data: { method: 'GET' } }
    captures++; return evidence(1, { complete: false })
  })
  assert.equal(captures, 1)
  assert.equal(incomplete.data.stopped_reason, 'capture_incomplete')
  assert.equal(incomplete.data.incomplete, 1)
  assert.equal(incomplete.data.results[0].evidence_id, evidence(1).data.id)

  const controller = new AbortController()
  captures = 0
  const cancelled = await captureAssessmentBatch({ requests: [request(1), request(2)] }, async action => {
    if (action === 'http.preflight') return { ok: true, data: { method: 'GET' } }
    captures++; controller.abort(); return evidence(1)
  }, { signal: controller.signal })
  assert.equal(captures, 1)
  assert.equal(cancelled.data.stopped_reason, 'cancelled')
  assert.equal(cancelled.data.remaining, 1)
  const none = await captureAssessmentBatch({ requests: [request(1)] }, () => assert.fail('cancelled batch invoked a tool'), { signal: controller.signal })
  assert.equal(none.requests_sent, 0)
  assert.equal(none.data.next_index, 0)
})

test('fixed local actions and their exact help work before a native project without starting Python', async t => {
  const { store, id } = fixture(t, 'src')
  const options = { invokeEngine: () => assert.fail('local discovery initialized a native runtime') }
  for (const action of ['evidence.diff', 'surface.from_sourcemap', 'http.capture_batch', 'workspace.list', 'workspace.read',
    'intel.import', 'intel.search', 'intel.get', 'skill.index', 'workflow.advice']) {
    const help = await assessmentRun(store, id, 'action.help', { name: action }, options)
    assert.equal(help.data.action, action)
    assert.equal(help.requests_sent, 0)
    assert.equal(help.facade_policy.assessment_mode, 'src')
  }
  const list = await assessmentRun(store, id, 'workspace.list', {}, options)
  assert.equal(list.data.state, 'missing')
  const intel = await assessmentRun(store, id, 'intel.search', {}, options)
  assert.equal(intel.data.state, 'not_imported')
  const skills = await assessmentRun(store, id, 'skill.index', { cwe: ['CWE-639'] }, options)
  assert.equal(skills.data.mode, 'src')
  assert(skills.data.items.some(row => row.resource === 'authorization'))
  assert.equal(skills.data.can_confirm, false)
  await assert.rejects(assessmentRun(store, id, 'skill.index', { tools: ['bash'], mode: 'redteam' }, options), /literal filters/)
  await assert.rejects(assessmentRun(store, id, 'workspace.list', { workspace: os.tmpdir() }, options), /fixed internal project/)
  await assert.rejects(assessmentRun(store, id, 'http.capture_batch', { requests: [request(1)] }, options), /already prepared/)
  assert.equal(readNativeContext(store, id), null)
  assert.equal(fs.existsSync(path.join(store.dirOf(id), 'assessment')), false)
})

const PYTHON_FIXTURE = String.raw`
import base64, hashlib, json, socket, sys
from pathlib import Path
from urllib.parse import urlsplit
from unittest.mock import patch
from awa_ddd.store import now
from awa_ddd.__main__ import main
workspace=sys.argv[1]
def request(url,method='GET',headers=None,body=None,timeout=15,max_bytes=1048576):
    assert url.startswith('https://fixture.invalid/'), 'fixture cannot visit another origin'
    assert '/excluded' not in url, 'excluded source cannot reach fixture transport'
    assert method in {'GET','HEAD','OPTIONS'}, 'batch cannot write'
    with (Path(workspace)/'fixture-requests.jsonl').open('a',encoding='utf-8') as handle:
        handle.write(json.dumps({'url':url,'method':method})+'\n')
    raw=json.dumps({'path':urlsplit(url).path,'private':'PRIVATE-RESPONSE-BODY'},separators=(',',':')).encode()
    status=403 if urlsplit(url).path=='/api/a' else 429
    return {'request':{'url':url,'method':method,'headers':headers or {},'body_base64':''},
      'response':{'status':status,'headers':[['Content-Type','application/json']], 'complete':True,'length':len(raw),
        'body_base64':base64.b64encode(raw).decode(),'body_sha256':hashlib.sha256(raw).hexdigest()},
      'started_at':now(),'completed_at':now(),'complete':True,'elapsed_ms':0,'transport':'python-http-client','redirect_followed':False,
      'dispatch_attempts':1,'requests_sent':1,'responses_received':1}
sys.argv=['fixture','--workspace',workspace]
with patch('awa_ddd.engine.request',request),patch('socket.create_connection',side_effect=AssertionError('no sockets')),patch('socket.socket.connect',side_effect=AssertionError('no sockets')):
    main()
`
function nativeFixture(pythonExecutable, starts = []) {
  return (config, action, args, options = {}) => new Promise((resolve, reject) => {
    starts.push(action)
    const child = execFile(pythonExecutable, ['-E', '-s', '-X', 'utf8', '-B', '-c', PYTHON_FIXTURE, config.workspace],
      { cwd: engine, windowsHide: true, encoding: 'utf8', timeout: 15000, maxBuffer: 4 * 1024 * 1024, signal: options.signal }, (error, stdout, stderr) => {
        if (error) { reject(new Error('isolated fixture failed: ' + (stderr || error.message))); return }
        try {
          const result = JSON.parse(stdout)
          if (result.ok !== true) reject(Object.assign(new Error(result.error.message), { code: result.error.code, details: result.error.details }))
          else resolve(result)
        } catch (error) { reject(error) }
      })
    child.stdin.end(JSON.stringify({ action, args }))
  })
}

test('real embedded engine batches reuse idempotency, keep SRC scope, return actual statuses and attribute observations', { timeout: 180000 }, async t => {
  const { store, root, id } = fixture(t, 'src')
  const pythonExecutable = process.env.AWA_DDD_TEST_PYTHON || defaultPythonExecutable()
  saveAwaSettings(root, { pythonExecutable, timeoutMs: 15000 })
  const observed = []
  store.assessmentContinuation = { observe: event => { if (event.attribution) observed.push(event.attribution) } }
  const starts = []
  const options = { invokeEngine: nativeFixture(pythonExecutable, starts) }
  await initializeAssessment(store, id, { target: origin + '/', scope: [origin + '/'] }, options)
  const run = (action, input) => assessmentRun(store, id, action, input, options)
  const first = (await run('surface.register', { url: origin + '/api/a', method: 'GET', auth: 'public' })).data.id
  const second = (await run('surface.register', { url: origin + '/api/b', method: 'GET', auth: 'public' })).data.id
  const items = { requests: [{ operation_id: first, idempotency_key: 'batch-native-a' }, { operation_id: second, idempotency_key: 'batch-native-b' }] }
  const startCount = starts.length
  const result = await run('http.capture_batch', items)
  assert.equal(starts.length - startCount, 1, 'two items use one worker, not status/preflight/capture worker chains')
  assert.equal(result.data.execution_strategy, 'single_native_worker')
  assert.equal(result.requests_sent, 2, 'the synthetic fixture provides explicit dispatch receipts')
  assert.equal(result.data.state, 'completed')
  assert.deepEqual(result.data.results.map(row => row.status_code), [403, 429])
  assert(result.data.results.every(row => row.observation_next_step.arguments.engagement === id))
  assert(observed.some(row => row.class === 'http_permission_response'))
  assert(observed.some(row => row.class === 'http_rate_limit_response'))
  const log = path.join(readNativeContext(store, id).workspace, 'fixture-requests.jsonl')
  assert.equal(fs.readFileSync(log, 'utf8').trim().split('\n').length, 2)
  const repeated = await run('http.capture_batch', items)
  assert.equal(repeated.data.state, 'completed', JSON.stringify(repeated))
  assert.equal(repeated.requests_sent, 0)
  assert.equal(repeated.data.reused, 2)
  assert.deepEqual(repeated.data.results.map(row => row.evidence_id), result.data.results.map(row => row.evidence_id))
  assert.equal(fs.readFileSync(log, 'utf8').trim().split('\n').length, 2, 'the repeated keys did not produce new synthetic transport requests')
  const excluded = await run('http.capture_batch', { requests: [{ operation_id: first, url: origin + '/excluded', idempotency_key: 'excluded-batch' }] })
  assert.equal(excluded.data.rejected, 1)
  assert.equal(excluded.requests_sent, 0)
  assert.equal(excluded.data.results[0].error_code, 'out_of_scope')
  assert.equal(fs.readFileSync(log, 'utf8').trim().split('\n').length, 2)
  assert(!JSON.stringify([result, repeated, excluded]).includes('PRIVATE-RESPONSE-BODY'))
  assert.equal(result.data.security_coverage_granted, false)
  const beforeTwenty = starts.length
  const twenty = await run('http.capture_batch', { requests: Array.from({ length: 20 }, (_, index) => ({
    operation_id: second, url: origin + '/api/b?controlled=' + index, idempotency_key: 'batch-twenty-' + index })) })
  assert.equal(twenty.data.captured, 20)
  assert.equal(twenty.requests_sent, 20)
  assert.equal(starts.length - beforeTwenty, 1)
})
