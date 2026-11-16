import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { RedteamStore } from '../lib/redteam/store-core.js'
import { removeTreeNoFollowSync } from '../lib/remove-tree.js'
import { bindTrustedSession } from '../lib/redteam/session-policy.js'
import { agentSchedulerOf, installAgentScheduler } from '../lib/redteam/agent-scheduler.js'
import { writeSettings } from '../lib/redteam/settings.js'

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'purge-scheduler-dispatch-')), store = new RedteamStore(root)
  const id = store.openEngagement('dispatch fixture', ['https://fixture.invalid/'], { exclude: [], bindCurrent: false }).id
  writeSettings(root, { maxAgents: 1 })
  const session = { id: 'scheduler-root-' + path.basename(root), header: { agentPreset: 'redteam' } }
  const execution = { agent: { session }, name: 'subagent', arguments: {}, signal: new AbortController().signal }
  bindTrustedSession(store, execution, id)
  t.after(() => { store.close(); assert(path.basename(root).startsWith('purge-scheduler-dispatch-')
    && path.dirname(root) === path.resolve(os.tmpdir())); removeTreeNoFollowSync(root) })
  return { store, id, execution, root }
}

test('only explicit no-start receipts release a failed dispatch; uncertainty wins over conflicting metadata', async t => {
  const { store, id, execution } = fixture(t), scheduler = agentSchedulerOf(store)
  await assert.rejects(scheduler.around(execution, async () => { throw Object.assign(new Error('fixture pre-dispatch rejection'),
    { dispatch_started: false }) }))
  assert.equal((await scheduler.status(id)).used, 0)
  const rejected = await scheduler.around(execution, async () => ({ isError: true, error: { dispatch_not_started: true } }))
  assert.equal(rejected.isError, true)
  assert.equal((await scheduler.status(id)).used, 0)
  await assert.rejects(scheduler.around(execution, async () => { throw Object.assign(new Error('fixture lost dispatch receipt'),
    { dispatch_started: false, dispatch_uncertain: true }) }))
  assert.equal((await scheduler.status(id)).used, 1)
  store.kb().prepare("UPDATE redteam_agent_lease SET expires_at=0 WHERE state='dispatching'").run()
  assert.equal((await scheduler.status(id)).used, 1, 'elapsed time cannot recycle an uncertain dispatch')
  await assert.rejects(scheduler.around(execution, async () => assert.fail('capacity guard must prevent this body')),
    error => error.code === 'REDTEAM_AGENT_CAP')
})

test('success without child identity stays occupied and exact terminal completion releases an associated child', async t => {
  const { store, id, execution } = fixture(t), scheduler = agentSchedulerOf(store)
  const child = { session_id: 'fixture-child', subagent_id: 'fixture-registry-child' }
  await scheduler.around(execution, async () => ({ value: child }))
  assert.equal((await scheduler.status(id)).used, 1)
  scheduler.endChild({ session_id: 'unrelated-child', subagent_id: 'unrelated-registry-child' })
  assert.equal((await scheduler.status(id)).used, 1)
  scheduler.endChild(child)
  assert.equal((await scheduler.status(id)).used, 0)
  await scheduler.around(execution, async () => ({ value: 'no reliable child receipt' }))
  assert.equal((await scheduler.status(id)).used, 1)
})

test('actual SDK dispatch retains a lease when body failure is normalized and blocks a second child before execution', async t => {
  const require = createRequire(new URL('../package.json', import.meta.url))
  const entry = require.resolve('@deepseek-ai/dsh-tools')
  const sdk = { ...await import(pathToFileURL(entry).href),
    ...await import(pathToFileURL(createRequire(entry).resolve('@deepseek-ai/cordis')).href) }
  const { store, id, execution } = fixture(t), host = new sdk.Context()
  class Prompt extends sdk.Service {
    constructor(ctx) { super(ctx, 'systemPrompt') }
    tools() { return () => {} }
    section() { return () => {} }
  }
  await host.plugin(Prompt)
  await host.plugin(sdk.ToolRuntime, { mode: 'native' })
  const owner = host.plugin({ name: 'scheduler-native-fixture', inject: ['tools'], apply(ctx) {
    installAgentScheduler(ctx, store)
  } })
  await owner
  t.after(() => host.fiber.dispose())
  let bodies = 0
  host.tools.register({ name: 'subagent', parameters: { type: 'object', properties: {} },
    output: { schema: { type: 'string' }, render: (_args, value) => [{ type: 'text', text: value }] },
    execute: async () => { bodies++; throw Object.assign(new Error('Lost fixture child acknowledgment'), { dispatch_uncertain: true }) } })
  host.on('tools/pre-execute', async () => ({ kind: 'allow' }), { global: true, prepend: true })
  const result = await host.tools.execute({ ...execution, callId: 'first-native-dispatch' })
  assert.equal(result.isError, true)
  assert.equal(bodies, 1)
  const status = await agentSchedulerOf(store).status(id)
  assert.equal(status.dispatch_enforced, true)
  assert.equal(status.used, 1)
  assert.equal(status.reservations[0].state, 'dispatching')
  const second = await host.tools.execute({ ...execution, callId: 'second-native-dispatch' })
  assert.equal(second.isError, true)
  assert.equal(bodies, 1, 'the second actual SDK body must never execute')
  assert.match(second.error.message, /execution-agent limit/)
})
