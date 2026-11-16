import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdtempSync, realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, isAbsolute, join, relative, resolve } from 'node:path'
import { initializeAssessment, assessmentRun } from '../lib/redteam/awa-integration.js'
import { defaultPythonExecutable, readNativeContext } from '../lib/redteam/native-assessment.js'
import { withAssessmentDatabase } from '../lib/redteam/assessment-artifacts.js'
import { withCookieToolAdvice } from '../lib/redteam/assessment-auth.js'
import { RedteamStore } from '../lib/redteam/store-core.js'
import { saveAwaSettings } from '../lib/redteam/settings.js'
import { invokeEngine } from '../lib/redteam/assessment-engine/src/bridge.mjs'
import { removeTreeNoFollowSync } from '../lib/remove-tree.js'

async function fixture(context, mode, { dualOrigin = false, model = 'v1' } = {}) {
  const parent = realpathSync(tmpdir()), root = mkdtempSync(join(parent, 'purge-batch-runtime-'))
  const store = new RedteamStore(root), received = [], receivedDetails = [], starts = []
  let stoppedTarget, engagement, stallObserved
  const stalled = new Promise(resolveStall => { stallObserved = resolveStall })
  const handler = (request, response) => {
    received.push(request.url)
    receivedDetails.push({ url: request.url, host: request.headers.host,
      authorization: request.headers.authorization, cookie: request.headers.cookie })
    if (request.url.startsWith('/stall')) { stallObserved(); return }
    if (stoppedTarget && request.url.startsWith('/stop-first')) {
      store.db(engagement).prepare('INSERT OR IGNORE INTO src_source_stop(vuln_id,target,evidence_refs,stopped_at) VALUES(?,?,?,?)')
        .run(9001, stoppedTarget, '[]', new Date().toISOString())
    }
    const url = new URL(request.url, 'http://' + request.headers.host)
    const principal = request.headers.authorization?.replace(/^Bearer /, '')
      || (/\bsession=([^;]+)/.exec(request.headers.cookie || '')?.[1] === 'local-captured-cookie' ? 'cookie-owner' : 'anonymous')
    const headers = { 'Content-Type': 'application/json' }
    if (url.pathname === '/cookie/start' || url.pathname === '/cookie/short') {
      headers['Set-Cookie'] = 'session=local-captured-cookie; Path=/protected; HttpOnly; Max-Age=' + (url.pathname.endsWith('/short') ? 30 : 120)
    }
    if (url.pathname === '/protected/rotate') headers['Set-Cookie'] = 'session=; Path=/protected; Max-Age=0'
    response.writeHead(200, headers)
    const document = url.pathname.endsWith('/profile') ? { subject: principal, roles: ['viewer'] }
      : url.pathname.endsWith('/render') ? { value: url.searchParams.get('label') }
        : { path: request.url, fixture: 'local-only-read-object', principal }
    const finish = () => response.end(JSON.stringify(document))
    if (url.pathname === '/protected/wait-expiry') setTimeout(finish, 35000)
    else finish()
  }
  const server = createServer(handler)
  await new Promise((fulfill, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', fulfill) })
  const origin = 'http://127.0.0.1:' + server.address().port
  const other = dualOrigin ? createServer(handler) : null
  if (other) await new Promise((fulfill, reject) => { other.once('error', reject); other.listen(0, '127.0.0.1', fulfill) })
  const otherOrigin = other ? 'http://127.0.0.1:' + other.address().port : null
  const scopes = [origin + '/', ...(otherOrigin ? [otherOrigin + '/'] : [])]
  context.after(async () => {
    for (const current of [server, other].filter(Boolean)) {
      current.closeAllConnections()
      await new Promise(fulfill => current.close(fulfill))
    }
    store.close()
    const target = resolve(root), inside = relative(parent, target)
    assert(inside && !isAbsolute(inside) && !inside.startsWith('..') && basename(target).startsWith('purge-batch-runtime-'))
    removeTreeNoFollowSync(target)
  })
  engagement = store.openEngagement('local batch ' + mode, scopes,
    { assessment_mode: mode, exclude: [origin + '/excluded'], bindCurrent: false }).id
  saveAwaSettings(root, { pythonExecutable: defaultPythonExecutable(), timeoutMs: 15000 })
  const options = { invokeEngine: async (config, action, input, control) => {
    starts.push(action)
    return invokeEngine(config, action, input, control)
  } }
  await initializeAssessment(store, engagement, { target: origin + '/', scope: scopes, assessmentModel: model }, options)
  const run = (action, input, extra = {}) => assessmentRun(store, engagement, action, input, { ...options, ...extra })
  const register = async (path, extra = {}, selectedOrigin = origin) => (await run('surface.register', {
    url: selectedOrigin + path, method: 'GET', auth: 'public', ...extra })).data.id
  return { store, engagement, origin, otherOrigin, received, receivedDetails, starts, stalled, run, register,
    stopAt: path => { stoppedTarget = origin + path } }
}

for (const mode of ['src', 'pentest', 'redteam']) test('one real local batch worker retains exact reuse and scope in ' + mode,
  { timeout: 90000 }, async context => {
    const current = await fixture(context, mode)
    const operation = await current.register('/read')
    const requests = Array.from({ length: 20 }, (_, index) => ({ operation_id: operation,
      url: current.origin + '/read?controlled=' + index, idempotency_key: 'local-twenty-' + index }))
    const before = current.starts.length
    const result = await current.run('http.capture_batch', { requests })
    assert.equal(current.starts.length - before, 1)
    assert.equal(current.received.length, 20)
    assert.equal(result.requests_sent, 20)
    assert.equal(result.data.responses_received, 20)
    assert.equal(result.data.dispatch_attempts, 20)
    assert(result.data.response_bytes > 0)
    assert.equal(result.data.can_confirm, false)
    const reused = await current.run('http.capture_batch', { requests })
    assert.equal(current.received.length, 20)
    assert.equal(reused.requests_sent, 0)
    assert.equal(reused.data.response_bytes, 0)
    assert.equal(reused.data.reused, 20)
    assert.deepEqual(reused.data.results.map(row => row.evidence_id), result.data.results.map(row => row.evidence_id))
    const denied = await current.run('http.capture_batch', { requests: [{ operation_id: operation,
      url: current.origin + '/excluded', idempotency_key: 'local-outside' }] })
    assert.equal(denied.requests_sent, 0)
    assert.equal(denied.data.rejected, 1)
    assert.equal(current.received.length, 20)
  })

test('live SRC source stops and incomplete local responses halt remaining native batch items', { timeout: 90000 }, async context => {
  const current = await fixture(context, 'src')
  const first = await current.register('/stop-first'), second = await current.register('/stop-second')
  current.stopAt('/stop-second')
  const stopped = await current.run('http.capture_batch', { stop_on_error: false, requests: [
    { operation_id: first, idempotency_key: 'live-stop-first' },
    { operation_id: second, idempotency_key: 'live-stop-second' },
    { operation_id: first, idempotency_key: 'live-stop-remainder' },
  ] })
  assert.equal(stopped.data.results[1].error_code, 'stopped_at_evidence')
  assert.equal(stopped.data.results[1].requests_sent, 0)
  assert.equal(current.received.includes('/stop-second'), false)
  const read = await current.register('/truncated')
  const partial = await current.run('http.capture_batch', { requests: [
    { operation_id: read, idempotency_key: 'limited-response', max_bytes: 8 },
    { operation_id: first, idempotency_key: 'after-incomplete' },
  ] })
  assert.equal(partial.data.stopped_reason, 'capture_incomplete')
  assert.equal(partial.requests_sent, 1)
  assert.equal(partial.data.remaining, 1)
  assert.equal(partial.data.automatic_retry_allowed, false)
})

for (const mode of ['pentest', 'redteam']) test('one native worker keeps verified identities and origins separate in ' + mode,
  { timeout: 90000 }, async context => {
    const current = await fixture(context, mode, { dualOrigin: true })
    const profile = await current.register('/protected/profile')
    const otherProfile = await current.register('/protected/profile', {}, current.otherOrigin)
    const sessions = []
    for (const [principal, selectedOrigin, operation] of [
      ['owner-a', current.origin, profile], ['peer-a', current.origin, profile], ['owner-b', current.otherOrigin, otherProfile],
    ]) {
      const actor = 'A-' + principal
      await current.run('identity.actor', { actor_id: actor, subject: principal, roles: ['viewer'] })
      const session = await current.run('identity.session', { actor_id: actor, origin_url: selectedOrigin + '/protected/profile',
        headers: { Authorization: 'Bearer ' + principal } })
      await current.run('identity.verify', { operation_id: operation, session_id: session.data.id,
        subject_selector: '/subject', roles_selector: '/roles' })
      sessions.push(session.data.id)
    }
    const protectedOperation = await current.register('/protected/object', { auth: 'authenticated' })
    const otherOperation = await current.register('/protected/object', { auth: 'authenticated' }, current.otherOrigin)
    const publicOperation = await current.register('/public')
    const before = current.starts.length, receivedBefore = current.received.length
    const result = await current.run('http.capture_batch', { requests: [
      { operation_id: protectedOperation, session_id: sessions[0], idempotency_key: 'identity-owner-a' },
      { operation_id: protectedOperation, session_id: sessions[1], idempotency_key: 'identity-peer-a' },
      { operation_id: otherOperation, session_id: sessions[2], idempotency_key: 'identity-owner-b' },
      { operation_id: publicOperation, idempotency_key: 'identity-anonymous' },
    ] })
    assert.equal(current.starts.length - before, 1)
    assert.equal(result.requests_sent, 4)
    assert.deepEqual(current.receivedDetails.slice(receivedBefore).map(row => row.authorization),
      ['Bearer owner-a', 'Bearer peer-a', 'Bearer owner-b', undefined])
    assert.deepEqual(current.receivedDetails.slice(receivedBefore).map(row => row.host),
      [new URL(current.origin).host, new URL(current.origin).host, new URL(current.otherOrigin).host, new URL(current.origin).host])
    const count = current.received.length
    const denied = await current.run('http.capture_batch', { stop_on_error: false, requests: [
      { operation_id: otherOperation, session_id: sessions[0], idempotency_key: 'identity-wrong-origin' },
      { operation_id: publicOperation, idempotency_key: 'identity-after-denial' },
    ] })
    assert.equal(denied.data.results[0].requests_sent, 0)
    assert.equal(denied.data.rejected, 1)
    assert.equal(denied.requests_sent, 1)
    assert.equal(current.received.length - count, 1)
    const wrongKey = await current.run('http.capture_batch', { requests: [
      { operation_id: protectedOperation, session_id: sessions[1], idempotency_key: 'identity-owner-a' },
    ] })
    assert.equal(wrongKey.data.results[0].error_code, 'idempotency_conflict')
    assert.equal(wrongKey.requests_sent, 0)
  })

test('captured cookies retain path, origin, deletion and indirect recipe guards through the real facade',
  { timeout: 90000 }, async context => {
    const current = await fixture(context, 'pentest', { dualOrigin: true, model: 'v2' })
    const start = await current.register('/cookie/start'), profile = await current.register('/protected/profile', { auth: 'authenticated' })
    const initial = await current.run('http.capture', { operation_id: start, idempotency_key: 'cookie-bootstrap' })
    await current.run('identity.actor', { actor_id: 'A-cookie-owner', subject: 'cookie-owner', roles: ['viewer'] })
    const session = await current.run('identity.session_from_evidence', { actor_id: 'A-cookie-owner',
      url: current.origin + '/protected/profile', evidence_ids: [initial.data.id] })
    await current.run('identity.verify', { operation_id: profile, session_id: session.data.id,
      subject_selector: '/subject', roles_selector: '/roles' })
    const advice = withCookieToolAdvice(current.store, current.engagement, readNativeContext(current.store, current.engagement), {
      ok: true, data: { items: [{ provider: 'playwright', ready: true, next: { action: 'browser.visit',
        input: { url: current.origin + '/protected/profile', session_id: session.data.id } } }] },
    })
    assert.equal(advice.data.items[0].ready, false)
    assert.equal(advice.data.items[0].offline_only, true)
    assert(advice.data.items[0].missing.includes('ASSESSMENT_COOKIE_BROWSER_SCOPE'))
    const protectedOperation = await current.register('/protected/object', { auth: 'authenticated' })
    const outsidePath = await current.register('/outside', { auth: 'authenticated' })
    const otherOperation = await current.register('/protected/object', { auth: 'authenticated' }, current.otherOrigin)
    const before = current.received.length
    const batch = await current.run('http.capture_batch', { stop_on_error: false, requests: [
      { operation_id: protectedOperation, session_id: session.data.id, idempotency_key: 'cookie-matching-path' },
      { operation_id: outsidePath, session_id: session.data.id, idempotency_key: 'cookie-wrong-path' },
      { operation_id: otherOperation, session_id: session.data.id, idempotency_key: 'cookie-wrong-origin' },
    ] })
    assert.equal(batch.requests_sent, 1)
    assert.equal(batch.data.rejected, 2)
    assert.equal(current.received.length - before, 1)
    assert.equal(current.receivedDetails.at(-1).cookie, 'session=local-captured-cookie')
    const render = await current.register('/protected/render', { auth: 'authenticated', inputs: [
      { name: 'label', location: 'query', consumer: 'template_engine', test_families: ['template_injection'],
        test_contract: { response_selector: '/value', template_dialect: 'jinja_expression' } },
    ] })
    const campaign = (await current.run('campaign.start', { model: 'v2', new_campaign: true })).data.campaign.id
    const prepared = await current.run('campaign.next', { campaign_id: campaign, limit: 25 })
    const selected = prepared.data.recipes.find(row => row.target.operation_id === render && row.hypothesis.family === 'template_injection')
    assert(selected)
    const dispatchedBefore = current.received.length
    await assert.rejects(current.run('test.run', { campaign_id: campaign, hypothesis_id: selected.hypothesis.id,
      idempotency_key: 'cookie-implicit-recipe' }), error => error.code === 'ASSESSMENT_COOKIE_RECIPE_REQUIRED')
    assert.equal(current.received.length, dispatchedBefore)
    const tested = await current.run('test.run', { campaign_id: campaign, recipe_id: selected.recipe.id,
      idempotency_key: 'cookie-explicit-recipe' })
    assert.equal(tested.data.outcome, 'inconclusive')
    assert.equal(current.received.length - dispatchedBefore, 4)
    const replayBefore = current.received.length
    await assert.rejects(current.run('test.run', { campaign_id: campaign, run_id: tested.data.run.id }), /requires recipe_id or hypothesis_id/)
    assert.equal(current.received.length, replayBefore)
    const rotate = await current.register('/protected/rotate')
    const cleared = await current.run('http.capture_batch', { requests: [{ operation_id: rotate,
      cookie_evidence_ids: [initial.data.id], idempotency_key: 'cookie-cleared' }] })
    assert.equal(cleared.data.execution_strategy, 'per_item_facade')
    const clearedEvidence = cleared.data.results[0].evidence_id
    await assert.rejects(current.run('http.capture', { operation_id: protectedOperation,
      cookie_evidence_ids: [initial.data.id, clearedEvidence], idempotency_key: 'cookie-after-clear' }), /No unexpired captured cookie/)
  })

test('a real cookie expiry during a native batch denies later dispatch even after native session renewal',
  { timeout: 150000 }, async context => {
    const current = await fixture(context, 'pentest')
    saveAwaSettings(current.store.root, { timeoutMs: 60000 })
    const start = await current.register('/cookie/short'), profile = await current.register('/protected/profile', { auth: 'authenticated' })
    await current.run('identity.actor', { actor_id: 'A-cookie-owner', subject: 'cookie-owner', roles: ['viewer'] })
    const wait = await current.register('/protected/wait-expiry', { auth: 'authenticated' })
    const after = await current.register('/protected/after-expiry', { auth: 'authenticated' })
    const initial = await current.run('http.capture', { operation_id: start, idempotency_key: 'short-cookie-bootstrap' })
    const session = await current.run('identity.session_from_evidence', { actor_id: 'A-cookie-owner',
      url: current.origin + '/protected/profile', evidence_ids: [initial.data.id] })
    await current.run('identity.verify', { operation_id: profile, session_id: session.data.id,
      subject_selector: '/subject', roles_selector: '/roles' })
    await current.run('identity.session', { session_id: session.data.id, renew: true, ttl_seconds: 120 })
    const before = current.received.length
    const batch = await current.run('http.capture_batch', { requests: [
      { operation_id: wait, session_id: session.data.id, idempotency_key: 'cookie-before-expiry', timeout: 50 },
      { operation_id: after, session_id: session.data.id, idempotency_key: 'cookie-after-expiry' },
    ] })
    assert.equal(batch.requests_sent, 1)
    assert.equal(batch.data.results[1].error_code, 'capture_batch_cookie')
    assert.equal(batch.data.results[1].requests_sent, 0)
    assert.equal(current.received.length - before, 1)
    assert.equal(current.received.includes('/protected/after-expiry'), false)
  })

test('cancelling a live local native worker preserves the unresolved key and does not replay it', { timeout: 90000 }, async context => {
  const current = await fixture(context, 'pentest')
  const stalled = await current.register('/stall'), next = await current.register('/not-dispatched')
  const controller = new AbortController()
  const inputs = { requests: [{ operation_id: stalled, idempotency_key: 'cancelled-request' },
    { operation_id: next, idempotency_key: 'cancelled-remainder' }] }
  const pending = current.run('http.capture_batch', inputs, { signal: controller.signal })
  const rejected = assert.rejects(pending, error => error.dispatch_uncertain === true || error.code === 'ABORTED')
  await current.stalled
  controller.abort()
  await rejected
  assert.deepEqual(current.received, ['/stall'])
  const runs = withAssessmentDatabase(current.store, current.engagement, readNativeContext(current.store, current.engagement), database =>
    database.prepare("SELECT document FROM entities WHERE kind='run'").all().map(row => JSON.parse(row.document)))
  assert(runs.some(row => row.status === 'running'))
  const recovery = await current.run('http.capture_batch', inputs)
  assert.equal(recovery.requests_sent, 0)
  assert.equal(recovery.data.stopped_reason, 'dispatch_uncertain')
  assert.equal(recovery.data.automatic_retry_allowed, false)
  assert.deepEqual(current.received, ['/stall'])
})
