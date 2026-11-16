import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { installPresetRegistration } from '../lib/preset-registration.js'
import { prepareListAgents, registerPresetDefinitions } from '../lib/preset-compat.js'
import { apply as applyAnchor } from '../presets/redteam/anchor-gate.mjs'
import { generatedModePolicy, policyTextForMode, stripGeneratedModePolicy, withModePersona } from '../lib/redteam/assessment-policy.js'
import { withPresetDefaults } from '../lib/preset-defaults.js'

const tick = () => new Promise(resolve => setImmediate(resolve))

test('mode policy generation keeps user prose and unknown blocks while shared defaults retain explicit choices', () => {
  const prefix = generatedModePolicy('src') + '\nCustom operator prose.'
  const definition = { id: 'src', plugins: [{ name: '@deepseek-ai/dsh-persona', config: { prefix } },
    { name: '@deepseek-ai/dsh-tool-todo', config: { allowParallelInProgress: false } }] }
  assert.equal(withModePersona(definition).plugins[0].config.prefix, 'Custom operator prose.')
  assert.equal(definition.plugins[0].config.prefix, prefix)
  assert.equal(withPresetDefaults(definition).plugins[1].config.allowParallelInProgress, false)
  const corrupt = prefix.replace('先读取', 'Custom changed instruction 先读取')
  assert.equal(stripGeneratedModePolicy(corrupt, 'src'), corrupt)
  assert.equal(stripGeneratedModePolicy(prefix, 'pentest'), prefix)
  assert.equal(stripGeneratedModePolicy(policyTextForMode('src') + '\nLegacy custom prose.', 'src'), 'Legacy custom prose.')
})
async function until(condition) {
  for (let count = 0; count < 1000; count++) { if (condition()) return; await tick() }
  assert.fail('asynchronous local registration did not settle')
}
function fixture(t, ids = ['src', 'redteam']) {
  const events = [], statuses = new Map(), disposers = [], scopes = []
  let inject
  const registry = { register: async definition => { events.push('+' + definition.id); return async () => { events.push('-' + definition.id) } },
    resolve: async id => ({ id, broken: null }) }
  const ctx = { agentPresets: registry, get: () => undefined, logger: { info() {}, warn() {} },
    effect: effect => disposers.push(effect()), inject: (_keys, callback) => { inject = callback } }
  const driver = installPresetRegistration(ctx, { ids, retryDelay: 1, retryLimit: 3,
    prepare: async id => ({ definition: { id, name: id, plugins: [] }, definitions: [{ id, name: id, plugins: [] }] }),
    status: (id, value) => statuses.set(id, value) })
  const service = value => {
    const releases = []
    inject({ agentPresets: value, effect: fn => releases.push(fn()), get: () => undefined })
    scopes.push(releases)
    return releases
  }
  t.after(async () => { for (const release of disposers) await release(); for (const releases of scopes) for (const release of releases) await release() })
  return { registry, driver, events, statuses, service, disposers }
}

test('service generations release old declarations in order even when the registry object is reused', async t => {
  const { registry, events, statuses, service } = fixture(t)
  await until(() => statuses.get('redteam')?.ok)
  const old = service(registry)
  await until(() => events.filter(item => item === '+redteam').length === 2)
  const newer = service(registry)
  await until(() => events.filter(item => item === '+redteam').length === 3)
  await old[0]()
  await tick()
  assert.equal(statuses.get('redteam').ok, true)
  assert.deepEqual(events.slice(0, 6), ['+src', '+redteam', '-redteam', '-src', '+src', '+redteam'])
  assert.equal(newer.length, 1)
})

test('a late successful registration is released after unmount and cannot write a success receipt', async t => {
  const { registry, events, statuses, driver, disposers } = fixture(t, ['redteam'])
  let finish
  registry.register = async definition => new Promise(resolve => { finish = () => resolve(() => events.push('-' + definition.id)) })
  await until(() => finish)
  await disposers.shift()()
  finish()
  await tick(); await driver.retry(); await tick()
  assert.deepEqual(events, ['-redteam'])
  assert.notEqual(statuses.get('redteam')?.ok, true)
})

test('broken activation unwinds before retry, healthy modes keep independent failure counts', async t => {
  const { registry, driver, events, statuses } = fixture(t)
  let broken = true
  registry.resolve = async id => ({ id, broken: id === 'redteam' && broken ? 'fixture failure' : null })
  await until(() => statuses.get('redteam')?.phase === 'register-failed')
  assert.equal(statuses.get('src').ok, true)
  broken = false
  await driver.retry()
  await until(() => statuses.get('redteam')?.ok)
  assert.equal(events.filter(item => item === '+src').length, 1)
  assert.deepEqual(events.filter(item => item.endsWith('redteam')).slice(0, 3), ['+redteam', '-redteam', '+redteam'])
})

test('unconfirmed health and failed cleanup never masquerade as registration success', async () => {
  const events = []
  await assert.rejects(registerPresetDefinitions({ register: async () => () => events.push('released') }, [{ id: 'redteam' }]),
    error => error.code === 'PRESET_REGISTRATION_UNCONFIRMED')
  assert.deepEqual(events, ['released'])
  let fail = true
  const registry = { register: async () => async () => { if (fail) throw new Error('release failed'); events.push('recovered') },
    resolve: async () => ({ broken: 'bad import' }) }
  let caught
  try { await registerPresetDefinitions(registry, [{ id: 'redteam' }]) } catch (error) { caught = error }
  assert.equal(caught.cleanup_errors.length, 1)
  fail = false
  await caught.cleanup()
  assert.equal(events.at(-1), 'recovered')
})

test('current-profile Loader resolves the real helper implementation; opaque or conditional modules retain the old row', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'purge-control-source-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const file = path.join(root, 'control.mjs')
  const main = { id: 'control', name: '@deepseek-ai/dsh-tool-subagent-control' }
  const legacy = { id: 'tool-subagent-list-agents', name: main.name + '/list-agents' }
  const definition = { id: 'redteam', plugins: [main, legacy] }
  const source = `function registerListAgents(ctx) { const definition = defineTool({name:'list_agents'}); ctx.tools.register(definition); return definition; }
export function apply(ctx, config={}) { const listAgents = registerListAgents(ctx); }`
  fs.writeFileSync(file, source)
  const anchors = []
  const ctx = { get: name => name === 'profileContext' ? { installAnchor: path.join(root, 'profile/package.json') }
    : { internal: { import: async (_name, anchor) => { anchors.push(anchor); return { apply() {} } }, resolve: async () => pathToFileURL(file).href } } }
  assert.deepEqual((await prepareListAgents(definition, ctx)).plugins, [main])
  assert.equal(anchors[0], pathToFileURL(path.join(root, 'profile/package.json')).href)
  const v2 = { get: name => name === 'profileContext' ? { installAnchor: path.join(root, 'profile/package.json') }
    : { internal: { version: 'v2', import: async () => ({ apply() {} }), resolveSync: (anchor, request) => {
      assert.equal(anchor, anchors[0]); assert.equal(request.specifier, main.name); assert.deepEqual(request.attributes, {})
      return { url: pathToFileURL(file).href }
    } } } }
  assert.deepEqual((await prepareListAgents(definition, v2)).plugins, [main])
  for (const body of [`export function apply(ctx) { /* list_agents */ }`,
    `export function apply(ctx) { if (false) ctx.tools.register({name:'list_agents'}); }`,
    `export function apply(ctx) { registerListAgents(ctx); }`]) {
    fs.writeFileSync(file, body)
    assert.deepEqual((await prepareListAgents(definition, ctx)).plugins, definition.plugins)
  }
})

test('bootstrap counts completed steps across language and compaction without overriding a lower host limit', async () => {
  const callbacks = new Map(), releases = []
  const ctx = { on: (name, callback) => { callbacks.set(name, callback); return () => callbacks.delete(name) },
    effect: fn => releases.push(fn()) }
  applyAnchor(ctx, { maxBootstrapSteps: 2, bootstrapMaxTokens: 8192, promoteAfterFirstResponse: true })
  const session = { events: [{ id: 1, type: 'assistant/reasoning', text: '我先检查已有材料。' }, { id: 2, type: 'tool/call' }, { id: 3, type: 'step/end' }] }
  const request = callbacks.get('agent/request'), payload = { agent: { session } }
  const downstream = { maxTokens: 20000, messages: [{ role: 'system', content: 'Full workspace instructions.' }] }
  let result = await request(payload, async () => downstream)
  assert.equal(result.maxTokens, 8192)
  assert.equal(result.messages, downstream.messages)
  assert.equal((await request(payload, async () => ({ maxTokens: 512 }))).maxTokens, 512)
  session.events.push({ id: 4, type: 'assistant/reasoning', text: 'Let me check this.' }, { id: 5, type: 'step/end' })
  assert.equal(await request(payload, async () => downstream), downstream)
  const compacted = { id: 6, type: 'compaction/end' }
  session.events.push(compacted)
  callbacks.get('session/event')(session, compacted)
  session.events = session.events.slice(-3)
  result = await request(payload, async () => downstream)
  assert.equal(result.maxTokens, 8192)
  // Reconstructed historical events have stable IDs and do not count twice.
  session.events = session.events.map(event => ({ ...event }))
  assert.equal((await request(payload, async () => downstream)).maxTokens, 8192)
  for (const release of releases) release()
  assert.equal(callbacks.size, 0)
})
