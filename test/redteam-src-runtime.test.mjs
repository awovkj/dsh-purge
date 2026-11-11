import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { RedteamStore } from '../lib/redteam/store-core.js'
import { EvidenceLedger } from '../lib/redteam/evidence-ledger.mjs'
import { bindTrustedSession, sessionPolicyOf, srcToolDenial, installSrcExecutionGuard } from '../lib/redteam/session-policy.js'
import { awaProject, awaCall, awaSync, awaReviewRows, buildAwaExchange, readAwaBinding,
  ensureNativeAssessment, assessmentImport } from '../lib/redteam/awa-integration.js'
import { injectionPolicy } from '../lib/preset-injection.js'
import { registerPromptSections, rewriteLiveAssembly } from '../lib/index.js'
import { buildSrcReport } from '../lib/redteam/src-report.js'
import { removeTreeNoFollowSync } from '../lib/remove-tree.js'

const scope = 'https://fixture.invalid/api'
const target = scope + '/private'
const excluded = scope + '/admin'
const signal = () => new AbortController().signal

function storeFixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'purge-src-runtime-'))
  const store = new RedteamStore(root)
  t.after(() => {
    store.close()
    const resolved = path.resolve(root)
    const relative = path.relative(path.resolve(os.tmpdir()), resolved)
    assert(relative && !path.isAbsolute(relative) && !relative.startsWith('..')
      && path.basename(resolved).startsWith('purge-src-runtime-'), 'cleanup stays inside the fresh temporary fixture')
    removeTreeNoFollowSync(resolved)
  })
  return { store, root }
}

function srcEngagement(store, name = '中文 SRC 靶标') {
  return store.openEngagement(name, [scope], { assessment_mode: 'src', exclude: [excluded], bindCurrent: false }).id
}

function sessions(names, presets = []) {
  const map = new Map()
  for (const [index, id] of names.entries()) {
    const session = { id, header: { agentPreset: presets[index] || 'standard', ...(index ? { parentSession: names[index - 1] } : {}) }, store: { get: key => map.get(key) } }
    map.set(id, session)
  }
  return { map, all: names.map(id => map.get(id)), context: index => ({ agent: { id: 'agent-' + names[index], session: map.get(names[index]) } }) }
}

test('durable SRC binding survives preset changes, cold direct parents and store reopen', t => {
  const { store, root } = storeFixture(t)
  const id = srcEngagement(store)
  const redteam = store.openEngagement('ordinary engagement', undefined, { bindCurrent: false }).id
  const chain = sessions(['root-' + path.basename(root), 'child-' + path.basename(root)], ['src', 'standard'])
  bindTrustedSession(store, chain.context(0), id)
  chain.all[0].header.agentPreset = 'unrestricted'
  chain.map.delete(chain.all[0].id)
  const context = { agent: { id: 'cold-child', session: chain.all[1] } }
  assert.equal(sessionPolicyOf(store, context).engagement_id, id)
  assert.match(srcToolDenial(store, { ...context, name: 'bash', arguments: {} }), /blocks this tool/)
  assert.match(srcToolDenial(store, { ...context, name: 'redteam_asset_query', arguments: { engagement: redteam } }), /bound engagement/)
  assert.equal(srcToolDenial(store, { ...context, name: 'redteam_asset_query', arguments: { engagement: id } }), undefined)
  assert.throws(() => bindTrustedSession(store, context, redteam), /cannot bind a redteam/)
  store.close()
  assert.equal(sessionPolicyOf(store, context).assessment_mode, 'src')
})

test('a cold intermediate parent and a prior child binding cannot hide the SRC ancestor', t => {
  const { store, root } = storeFixture(t)
  const src = srcEngagement(store)
  const ordinary = store.openEngagement('ordinary', undefined, { bindCurrent: false }).id
  const prefix = path.basename(root)
  const chain = sessions([prefix + '-root', prefix + '-parent', prefix + '-child'])
  bindTrustedSession(store, chain.context(0), src)
  bindTrustedSession(store, chain.context(1), src)
  // Simulates a durable older child record from before the ancestor became SRC.
  store.kb().prepare('INSERT INTO assessment_session_binding VALUES(?,?,?,?)').run(chain.all[2].id, ordinary, 'redteam', new Date().toISOString())
  assert.equal(sessionPolicyOf(store, chain.context(2)).engagement_id, src)
  const child = chain.all[2]
  chain.map.delete(chain.all[1].id)
  const context = { agent: { session: child } }
  assert.equal(sessionPolicyOf(store, context).engagement_id, src)
  assert.match(srcToolDenial(store, { ...context, name: 'pwsh', arguments: {} }), /blocks this tool/)
})

test('a root later bound to SRC protects older redteam descendants after an intermediate parent becomes cold', t => {
  const { store, root } = storeFixture(t)
  const src = srcEngagement(store)
  const ordinary = store.openEngagement('older redteam task', undefined, { bindCurrent: false }).id
  const prefix = path.basename(root)
  const chain = sessions([prefix + '-root', prefix + '-parent', prefix + '-child'])
  bindTrustedSession(store, chain.context(2), ordinary)
  bindTrustedSession(store, chain.context(0), src)
  const child = chain.all[2]
  chain.map.delete(chain.all[1].id)
  const context = { agent: { session: child } }
  assert.equal(sessionPolicyOf(store, context).engagement_id, src)
  assert.match(srcToolDenial(store, { ...context, name: 'bash', arguments: {} }), /blocks this tool/)
})

let nativeSdk
async function sdkOf(t) {
  if (nativeSdk) return nativeSdk
  const candidates = [new URL('../package.json', import.meta.url)]
  for (const anchor of candidates) {
    try {
      const entry = createRequire(anchor).resolve('@deepseek-ai/dsh-tools')
      const tools = await import(pathToFileURL(entry).href)
      const cordis = await import(pathToFileURL(createRequire(entry).resolve('@deepseek-ai/cordis')).href)
      nativeSdk = { ...tools, ...cordis }
      return nativeSdk
    } catch { /* A repository checkout without the host SDK runs the portable policy tests above. */ }
  }
  t.skip('Actual DSH tools SDK is unavailable in this checkout')
  return null
}

async function nativeFixture(t, { withRedteamTools = false, assessmentMode = 'src' } = {}) {
  const sdk = await sdkOf(t)
  if (!sdk) return null
  const { store, root } = storeFixture(t)
  const host = new sdk.Context()
  class Prompt extends sdk.Service {
    constructor(ctx) { super(ctx, 'systemPrompt'); this.sections = [] }
    tools() { return () => {} }
    section(spec) { this.sections.push(spec); return () => { const index = this.sections.indexOf(spec); if (index >= 0) this.sections.splice(index, 1) } }
  }
  await host.plugin(Prompt)
  await host.plugin(sdk.ToolRuntime, { mode: 'native' })
  host.provide('redteam', store)
  let module
  if (withRedteamTools) {
    const previousCwd = process.cwd()
    try {
      // Development SDK resolves from this repository, just like the host SDK.
      process.chdir(fileURLToPath(new URL('../', import.meta.url)))
      module = await import(new URL('../lib/redteam/tools.js', import.meta.url))
    } finally { process.chdir(previousCwd) }
  }
  const owner = host.plugin({ name: 'src-native-guard-fixture', inject: ['tools'], apply(ctx) {
    installSrcExecutionGuard(ctx, store)
    if (module) module.apply(ctx, { assessmentMode })
  } })
  await owner
  t.after(() => host.fiber.dispose())
  let sequence = 0
  const execute = (name, args, context) => host.tools.execute({ name, arguments: args, signal: signal(), callId: 'fixture-' + (++sequence), ...context })
  return { host, owner, store, root, execute }
}

test('actual SDK guard denies before body dispatch even when an approval hook force-allows', async t => {
  const fixture = await nativeFixture(t)
  if (!fixture) return
  const { host, store, root, execute } = fixture
  let bodies = 0
  for (const name of ['bash', 'pwsh', 'awa_http', 'todo_write']) host.tools.register({ name, parameters: { type: 'object', properties: {} },
    output: { schema: { type: 'string' }, render: (_args, value) => [{ type: 'text', text: value }] },
    execute: async () => { bodies++; return 'inert local fixture' } })
  host.on('tools/pre-execute', async () => ({ kind: 'allow' }), { global: true, prepend: true })
  const chain = sessions(['native-' + path.basename(root)], ['src'])
  const context = chain.context(0)
  for (const name of ['bash', 'pwsh', 'awa_http']) {
    const result = await execute(name, {}, context)
    assert.equal(result.isError, true)
    assert.match(result.error.message, /SRC discovery mode blocks/)
  }
  assert.equal(bodies, 0)
  const id = srcEngagement(store)
  bindTrustedSession(store, context, id)
  chain.all[0].header.agentPreset = 'unrestricted'
  assert.equal((await execute('bash', {}, context)).isError, true)
  assert.equal(bodies, 0)
  assert.equal((await execute('todo_write', {}, context)).isError, false)
  assert.equal(bodies, 1)
})

test('actual composed SRC preset blocks an unbound session before its stale standard header is updated', async t => {
  const fixture = await nativeFixture(t)
  if (!fixture) return
  const { host, store, root, execute } = fixture
  let bodies = 0
  host.tools.register({ name: 'bash', parameters: { type: 'object', properties: {} },
    output: { schema: { type: 'string' }, render: (_args, value) => [{ type: 'text', text: value }] },
    execute: async () => { bodies++; return 'inert fixture' } })
  host.provide('agentPresets', { composedPreset: () => ({ id: 'src' }) })
  const chain = sessions(['mounted-' + path.basename(root)], ['standard'])
  const context = chain.context(0)
  context.agent.ctx = host
  assert.equal(sessionPolicyOf(store, context).assessment_mode, 'src')
  const result = await execute('bash', {}, context)
  assert.equal(result.isError, true)
  assert.match(result.error.message, /SRC discovery mode blocks/)
  assert.equal(bodies, 0)
})

test('actual SRC data tools cannot create an orphan engagement or replace a durable binding', async t => {
  const fixture = await nativeFixture(t, { withRedteamTools: true })
  if (!fixture) return
  const { store, root, execute } = fixture
  const chain = sessions(['tools-' + path.basename(root)], ['src'])
  const context = chain.context(0)
  const first = await execute('redteam_engagement_open', { target: 'Original SRC fixture', scope: [scope], exclude: [excluded] }, context)
  assert.equal(first.isError, false)
  assert.equal(JSON.parse(first.content[0].text).ok, true)
  const original = sessionPolicyOf(store, context).engagement_id
  const before = store.listEngagements({ includeStats: false }).length
  const rejected = await execute('redteam_engagement_open', { target: 'Orphan SRC fixture', scope: [scope] }, context)
  assert(rejected.isError || JSON.parse(rejected.content[0].text).ok === false)
  assert.equal(store.listEngagements({ includeStats: false }).length, before)
  assert.equal(sessionPolicyOf(store, context).engagement_id, original)
})

test('actual SDK owns SRC internal assessment from engagement creation through native import, review and policy rejection', async t => {
  const fixture = await nativeFixture(t, { withRedteamTools: true })
  if (!fixture) return
  const { store, root, execute } = fixture
  const chain = sessions(['native-assessment-' + path.basename(root)], ['src'])
  const context = chain.context(0)
  const succeeded = async (name, args) => {
    const result = await execute(name, args, context)
    assert.equal(result.isError, false, name)
    const data = JSON.parse(result.content[0].text)
    assert.equal(data.ok, true, JSON.stringify(data))
    return data
  }
  const opened = await succeeded('redteam_engagement_open', { target: 'Native SDK internal SRC lifecycle', scope: [scope], exclude: [excluded] })
  assert.equal(opened.assessment.context.ready, true, 'opening a URL-scoped engagement prepares its internal core')
  assert.equal(opened.assessment.engine.embedded, true)
  assert.equal(opened.assessment.requests_sent, 0)
  const id = sessionPolicyOf(store, context).engagement_id
  assert.equal(readAwaBinding(store, id).workspace, path.join(store.dirOf(id), 'assessment'))
  await succeeded('redteam_vuln_add', { title: 'Native pending authorization fixture', severity: 'high', status: 'candidate', target, source: 'inert-fixture' })
  chain.all[0].header.agentPreset = 'standard'
  const status = await succeeded('redteam_assessment_status', {})
  assert.equal(status.engine.embedded, true)
  assert.equal(status.context.ready, true)
  const imported = await succeeded('redteam_assessment_import', {})
  assert.equal(imported.page_kind, 'source_candidates')
  assert.equal(imported.data.candidate_ids.length, 1)
  const reviewed = await succeeded('redteam_assessment_review', {})
  assert.equal(reviewed.page_kind, 'assessment_candidates')
  assert.equal(reviewed.reviews.length, 1)
  assert.equal(new EvidenceLedger(store.db(id)).get(reviewed.reviews[0].evidence_ref).confidence, 'inferred')
  const help = await succeeded('redteam_assessment_run', { action: 'action.help', input: { name: 'http.capture' } })
  assert.equal(help.ok, true)
  const original = readAwaBinding(store, id)
  for (const args of [
    { action: 'dsh.context.configure', input: { assessment_mode: 'assessment', scope: ['https://outside.invalid/'], exclude: [] } },
    { action: 'project.status', input: { workspace: path.join(root, 'forbidden-runtime') } },
    { action: 'surface.register', input: { url: excluded, method: 'GET', auth: 'public' } },
  ]) {
    const denied = await execute('redteam_assessment_run', args, context)
    if (!denied.isError) assert.equal(JSON.parse(denied.content[0].text).ok, false)
    assert.match(JSON.stringify(denied), /private assessment|cannot replace|outside scope or excluded/)
  }
  const foreign = store.openEngagement('foreign task', undefined, { bindCurrent: false }).id
  const denied = await execute('redteam_assessment_status', { engagement: foreign }, context)
  assert.equal(denied.isError, true)
  assert.match(denied.error.message, /bound engagement/)
  const after = readAwaBinding(store, id)
  assert.equal(after.workspace, original.workspace)
  assert.deepEqual(after.scope, original.scope)
  assert.deepEqual(after.exclude, original.exclude)
  assert.equal(fs.existsSync(path.join(root, 'forbidden-runtime')), false)
  const report = await succeeded('redteam_src_report', { save: false })
  assert.equal(report.candidates, 1)
  assert.equal(report.coverage_exhausted, false)
  assert.equal([status, imported, reviewed, report].every(item => item.requests_sent === 0), true)
})

test('actual SRC SDK cannot turn model-supplied direct evidence prose into an observation, confirmation or freeform upgrade', async t => {
  const fixture = await nativeFixture(t, { withRedteamTools: true })
  if (!fixture) return
  const { store, root, execute } = fixture
  const id = srcEngagement(store, 'SRC model observation boundary')
  const context = sessions(['model-trust-' + path.basename(root)], ['src']).context(0)
  bindTrustedSession(store, context, id)
  const payload = async (name, args) => {
    const result = await execute(name, args, context)
    assert.equal(result.isError, false, 'the SDK reaches the structured policy rejection for ' + name)
    return JSON.parse(result.content[0].text)
  }
  const fake = { operation: 'model_supplied_direct_proof', parameters: { url: target },
    result: { target, direct_evidence: true, proof_type: 'http_response', observation: 'Synthetic model assertion of protected fixture content' } }
  const ledger = new EvidenceLedger(store.db(id))
  for (const confidence of ['observed', 'derived']) {
    const rejected = await payload('redteam_evidence_record', { ...fake, confidence, authority: 'request-replay' })
    assert.equal(rejected.ok, false)
    assert.equal(rejected.error_code, 'SRC_MODEL_OBSERVATION_FORBIDDEN')
  }
  assert.equal(ledger.list({ engagement_id: id }).length, 0, 'rejecting self-assigned observation authority does not create a ledger record')
  const inferred = await payload('redteam_evidence_record', { ...fake, confidence: 'inferred', authority: 'request-replay' })
  assert.equal(inferred.ok, true)
  assert.equal(ledger.get(inferred.ev_id).confidence, 'inferred')
  assert.equal(ledger.get(inferred.ev_id).authority, 'operator-input')
  const claimed = await payload('redteam_evidence_record', { ...fake, confidence: 'claimed', authority: 'tool-output', source_agent: 'synthetic-model' })
  assert.equal(claimed.ok, true)
  assert.equal(ledger.get(claimed.ev_id).confidence, 'claimed')
  assert.equal(ledger.get(claimed.ev_id).authority, 'subagent-report')
  const defaultRecord = await payload('redteam_evidence_record', { ...fake, operation: 'model_default_confidence', authority: 'screenshot' })
  assert.equal(defaultRecord.ok, true)
  assert.equal(ledger.get(defaultRecord.ev_id).confidence, 'inferred')
  assert.equal(ledger.get(defaultRecord.ev_id).authority, 'operator-input')
  const matchingHash = await payload('redteam_evidence_verify', { ...fake, confidence: 'inferred', authority: 'operator-input' })
  assert.equal(matchingHash.matched, true, 'hash consistency remains available without turning a claim into an observation')
  const confirmation = { title: 'Fabricated direct proof fixture', severity: 'high', status: 'confirmed', target, evidence_refs: [inferred.ev_id] }
  const refused = await payload('redteam_vuln_add', confirmation)
  assert.equal(refused.ok, false)
  assert.match(refused.error, /must be observed|verified observed direct evidence/)
  for (const record of [inferred, claimed]) {
    const rejected = await payload('redteam_evidence_upgrade', { claimed_ev_id: record.ev_id,
      verified_result: { ...fake.result, current: true, validated: true, proof_mode: 'machine' }, verified_by: 'model-claimed-reviewer' })
    assert.equal(rejected.ok, false)
    assert.equal(rejected.error_code, 'SRC_MODEL_OBSERVATION_FORBIDDEN')
  }
  const stillRefused = await payload('redteam_vuln_add', confirmation)
  assert.equal(stillRefused.ok, false)
  assert.equal(ledger.list({ confidence: 'observed', engagement_id: id }).length, 0)
  assert.equal(ledger.list({ confidence: 'derived', engagement_id: id }).length, 0)
  assert.equal(store.db(id).prepare('SELECT COUNT(*) AS n FROM evidence_verification').get().n, 0)
  assert.equal(store.db(id).prepare('SELECT COUNT(*) AS n FROM vuln').get().n, 0)
  assert.equal(store.srcFindings(id).length, 0)
  assert.equal(buildSrcReport(store, id, { save: false }).confirmed, 0)
})

test('ordinary redteam SDK evidence recording and explicit upgrade retain their existing behavior', async t => {
  const fixture = await nativeFixture(t, { withRedteamTools: true, assessmentMode: 'redteam' })
  if (!fixture) return
  const { store, root, execute } = fixture
  const id = store.openEngagement('ordinary evidence fixture', [scope], { exclude: [excluded], bindCurrent: false }).id
  const context = sessions(['ordinary-evidence-' + path.basename(root)]).context(0)
  bindTrustedSession(store, context, id)
  const payload = async (name, args) => {
    const result = await execute(name, args, context)
    assert.equal(result.isError, false, name)
    const data = JSON.parse(result.content[0].text)
    assert.equal(data.ok, true, JSON.stringify(data))
    return data
  }
  const result = { target, direct_evidence: true, proof_type: 'http_response', observation: 'Inert ordinary evidence fixture' }
  const observation = await payload('redteam_evidence_record', { operation: 'ordinary_owned_observation', parameters: { url: target },
    result, confidence: 'observed', authority: 'request-replay' })
  const ledger = new EvidenceLedger(store.db(id))
  assert.equal(ledger.get(observation.ev_id).confidence, 'observed')
  assert.equal(ledger.get(observation.ev_id).authority, 'request-replay')
  const claimed = await payload('redteam_evidence_record', { operation: 'ordinary_subagent_claim', parameters: { url: target },
    result: { summary: 'Inert child observation claim' }, confidence: 'claimed', authority: 'subagent-report', source_agent: 'synthetic-child' })
  const verified = await payload('redteam_evidence_upgrade', { claimed_ev_id: claimed.ev_id, verified_result: result, verified_by: 'inert-fixture-reviewer' })
  assert.equal(ledger.get(verified.ev_id).confidence, 'observed')
  assert.equal(ledger.get(verified.ev_id).authority, 'tool-output')
  assert.deepEqual(ledger.get(verified.ev_id).supporting_ev_ids, [claimed.ev_id])
  assert.equal(store.db(id).prepare('SELECT observation_id FROM evidence_verification WHERE claim_id = ?').get(claimed.ev_id).observation_id, verified.ev_id)
  const derived = await payload('redteam_evidence_record', { operation: 'ordinary_derived_fixture', parameters: { url: target },
    result: { consequence: 'Synthetic fixture derivation' }, confidence: 'derived', authority: 'database-record', supporting_ev_ids: [observation.ev_id] })
  assert.equal(ledger.get(derived.ev_id).confidence, 'derived')
  assert.equal(ledger.get(derived.ev_id).authority, 'database-record')
})

test('the session creation hook preserves SRC ancestry before a descendant executes any tool', async t => {
  const fixture = await nativeFixture(t)
  if (!fixture) return
  const { host, store, root, execute } = fixture
  let bodies = 0
  host.tools.register({ name: 'bash', parameters: { type: 'object', properties: {} }, output: { schema: { type: 'string' }, render: (_args, value) => [{ type: 'text', text: value }] }, execute: async () => { bodies++; return 'inert' } })
  const chain = sessions([path.basename(root) + '-root', path.basename(root) + '-parent', path.basename(root) + '-child'])
  host.emit('session/created', chain.all[1])
  host.emit('session/created', chain.all[2])
  const src = srcEngagement(store)
  bindTrustedSession(store, chain.context(0), src)
  const child = chain.all[2]
  chain.map.delete(chain.all[1].id)
  const context = { agent: { session: child } }
  assert.equal(sessionPolicyOf(store, context).assessment_mode, 'src')
  assert.equal((await execute('bash', {}, context)).isError, true)
  assert.equal(bodies, 0)
})

test('SRC suppresses Purge boost and stale rewrites while retaining the independent discovery policy', async t => {
  const fixture = await nativeFixture(t)
  if (!fixture) return
  const { host, store, root } = fixture
  const context = sessions(['prompt-' + path.basename(root)], ['standard']).context(0)
  bindTrustedSession(store, context, srcEngagement(store))
  const config = { enabled: true, boost: true, excludePresets: [], postPrompt: 'ordinary purge override', postPromptOrder: 5100 }
  assert.equal(injectionPolicy(config, context).src, true)
  assert.equal(injectionPolicy(config, context).allowed, false)
  const purge = []
  registerPromptSections({ systemPrompt: { section: definition => purge.push(definition) } }, config)
  assert(purge.every(spec => spec.text(context) === ''))
  const discovery = host.get('systemPrompt').sections.find(spec => spec.name === 'src:discovery-policy')
  assert(discovery, 'native host owns an independent SRC policy section')
  assert.match(discovery.text(context), /直接证据/)
  const native = { name: 'deployment:persona-prefix', text: 'original SRC persona' }
  const policy = { name: discovery.name, text: discovery.text(context) }
  const user = { name: 'workspace:user', text: 'unchanged operator notes' }
  const dirty = { sections: [native, policy, { name: 'dsh-purge-boost', text: 'stale ordinary override' }, user], tools: [{ name: 'redteam_awa_call' }] }
  const clean = rewriteLiveAssembly(config, dirty, context)
  assert.deepEqual(clean.sections, [native, policy, user])
  assert.deepEqual(clean.tools, dirty.tools)
  assert.equal(dirty.sections.length, 4)
})

function mockAssessment() {
  const state = { calls: [], config: null, project_id: null, import_id: 'IMP-fixture', exported: null, target_requests: 0 }
  const invokeEngine = async (config, action, args, options) => {
    state.calls.push({ action, args, mode: config.assessmentMode, aborted: options?.signal?.aborted || false })
    if (action === 'project.create') {
      state.project_id = args.project_id
      state.config = structuredClone(args)
      return { ok: true, data: { project_id: args.project_id, config: structuredClone(state.config) } }
    }
    if (action === 'project.status') {
      if (!state.config) throw Object.assign(new Error('Fixture project does not exist'), { code: 'project_not_found' })
      return { ok: true, data: { config: structuredClone(state.config) } }
    }
    if (action === 'integration.import') return { ok: true, data: { import_id: state.import_id } }
    if (action === 'integration.export') return { ok: true, data: structuredClone(state.exported) }
    if (action === 'action.help') return { ok: true, data: { name: args.name } }
    throw new Error('Unexpected target-capable action reached inert assessment fixture: ' + action)
  }
  // Only this trusted, code-level test seam is replaceable. No runtime package,
  // environment variable or model/UI parameter installs the fixture.
  return { state, options: { invokeEngine } }
}

test('an initialization suspended in project.status retains an internal import committed before its metadata write', { timeout: 10000 }, async t => {
  const { store } = storeFixture(t)
  const id = srcEngagement(store, 'SRC init/import interleaving')
  const { state, options: baseline } = mockAssessment()
  await ensureNativeAssessment(store, id, {}, baseline)
  store.addVuln(id, { title: 'Interleaved candidate fixture', severity: 'high', status: 'candidate', target })
  let reached, release
  const paused = new Promise(resolve => { reached = resolve })
  const resumed = new Promise(resolve => { release = resolve })
  let hold = true
  const options = { invokeEngine: async (config, action, args, invokeOptions) => {
    if (action === 'project.status' && hold) { hold = false; reached(); await resumed }
    return baseline.invokeEngine(config, action, args, invokeOptions)
  } }
  const initialization = ensureNativeAssessment(store, id, {}, options)
  let imported
  try {
    await Promise.race([paused, initialization.then(() => { throw new Error('Expected a status pause during preparation') })])
    imported = await assessmentImport(store, id, {}, baseline)
    assert.equal(imported.data.import_id, state.import_id)
    assert.equal(readAwaBinding(store, id).last_import_id, state.import_id)
  } finally { release() }
  const completed = await initialization
  assert.equal(completed.context.ready, true)
  const context = readAwaBinding(store, id)
  assert.equal(context.last_import_id, imported.data.import_id)
  assert(context.import_ids.includes(imported.data.import_id))
  assert.equal(store.db(id).prepare('SELECT COUNT(*) AS n FROM assessment_import WHERE import_id = ?').get(imported.data.import_id).n, 1)
  assert.equal(state.target_requests, 0)
})

test('SRC internal assessment creates only a matching project and preserves source exclusions before dispatch', async t => {
  const { store, root } = storeFixture(t)
  const id = srcEngagement(store)
  const { state, options } = mockAssessment()
  await awaProject(store, id, { mode: 'create', target, scope: [scope], exclude: [] }, options)
  assert.equal(state.config.assessment_mode, 'src')
  assert.equal(state.config.allow_mutation, false)
  assert(state.config.exclude.includes(excluded))
  const goodConfig = structuredClone(state.config)
  for (const patch of [{ assessment_mode: 'assessment' }, { allow_mutation: true }, { scope: ['https://outside.invalid/'] }, { exclude: [] }]) {
    state.config = { ...goodConfig, ...patch }
    await assert.rejects(awaCall(store, id, 'http.capture', { url: target }, options), /SRC|scope|assessment mode/)
    assert.equal(state.calls.filter(call => call.action === 'http.capture').length, 0)
  }
  state.config = goodConfig
  const before = state.calls.length
  for (const input of [{ project_id: 'other' }, { workspace: 'other' }, { executionBackend: 'wsl' }, { pythonExecutable: 'other' }, { required_assessment_mode: 'assessment' }]) {
    await assert.rejects(awaCall(store, id, 'http.capture', input, options), /cannot replace/)
  }
  assert.equal(state.calls.length, before)
  assert.equal(state.target_requests, 0)
})

test('external exchange enforces source scope and uses opaque ASCII identities for Chinese engagements', t => {
  const { store } = storeFixture(t)
  const id = store.openEngagement('中文测试单位', [scope], { exclude: [excluded], bindCurrent: false }).id
  const secret = 'RT_PRIVATE_CREDENTIAL_FIXTURE_123'
  store.addCredential(id, { host: 'fixture.invalid', secret_value: secret })
  const valid = store.addVuln(id, { title: 'SQL injection password=' + secret, target, status: 'confirmed' })
  store.addVuln(id, { title: 'Excluded', target: excluded })
  store.addVuln(id, { title: 'Outside', target: 'https://outside.invalid/api' })
  store.addVuln(id, { title: 'Protected URL', target: target + '?anything=' + secret })
  store.addHttpEvidence(id, { vuln_id: valid.id, url: target, method: 'GET', status: 200, request: 'Authorization: Bearer ' + secret, response: 'private fixture body' })
  const page = buildAwaExchange(store, id)
  assert.equal(page.exchange.candidates.length, 1)
  assert.equal(page.exchange.candidates[0].source_status, 'confirmed')
  assert.equal(page.skipped.length, 3)
  assert.match(page.exchange.engagement.id, /^[A-Za-z0-9_.:@-]{1,128}$/)
  assert.notEqual(page.exchange.engagement.id, id)
  assert.equal(JSON.stringify(page.exchange).includes(secret), false)
  assert.equal(JSON.stringify(page.exchange).includes('private fixture body'), false)
  assert.equal(page.exchange.http_evidence[0].raw_material_included, false)
  assert.equal(page.requests_sent, 0)
})

test('review receipts require the bound source, candidate, URL and import; a label never confirms', async t => {
  const { store, root } = storeFixture(t)
  const id = srcEngagement(store)
  const added = store.addVuln(id, { target, title: 'SQL injection fixture', status: 'candidate' })
  const { state, options } = mockAssessment()
  await awaProject(store, id, { mode: 'create', target, scope: [scope] }, options)
  await awaSync(store, id, { mode: 'push' }, options)
  const binding = readAwaBinding(store, id)
  const sourceId = buildAwaExchange(store, id).exchange.engagement.id
  const externalId = 'vuln:' + added.id
  const candidateId = 'C-' + createHash('sha256').update(JSON.stringify(['dsh-purge', sourceId, externalId])).digest('hex').slice(0, 24)
  const receipt = { external_id: externalId, candidate_id: candidateId, engagement_id: sourceId, url: target, method: null,
    source: { provider: 'dsh-purge', engagement_id: sourceId, external_id: externalId, import_id: state.import_id }, status: 'confirmed', usable_for_confirmation: true }
  const exported = candidate => ({ schema: 'dsh-purge-awa/v1', project_id: binding.project_id, import_id: state.import_id, candidates: [candidate] })
  for (const candidate of [
    { ...receipt, source: undefined },
    { ...receipt, source: { ...receipt.source, engagement_id: 'other-source' } },
    { ...receipt, candidate_id: 'C-unrelated' },
    { ...receipt, url: scope + '/another' },
    { ...receipt, source: { ...receipt.source, import_id: 'IMP-foreign' } },
  ]) {
    state.exported = exported(candidate)
    const response = await awaSync(store, id, { mode: 'pull' }, options)
    assert.equal(response.reviews.length, 0)
    assert.equal(awaReviewRows(store, id).length, 0)
  }
  state.exported = exported(receipt)
  const response = await awaSync(store, id, { mode: 'pull' }, options)
  assert.equal(response.reviews.length, 1)
  assert.equal(store.listVulns(id).items[0].status, 'candidate')
  const ledger = new EvidenceLedger(store.db(id))
  assert.equal(ledger.get(response.reviews[0].evidence_ref).confidence, 'inferred')
  const before = state.calls.length
  await assert.rejects(awaSync(store, id, { mode: 'pull', import_id: 'IMP-foreign' }, options), /previously pushed/)
  assert.equal(state.calls.slice(before).some(call => call.action === 'integration.export'), false)
  assert.equal(state.target_requests, 0)
})

test('SRC discovery reports redact encoded credential query keys in direct evidence locators', t => {
  const { store } = storeFixture(t)
  const id = srcEngagement(store)
  const secret = 'RT_QUERY_SECRET_FIXTURE_123'
  const signedTarget = target + '?%74oken=' + secret
  const ledger = new EvidenceLedger(store.db(id))
  const proof = ledger.record({ operation: 'offline_fixture_verification', parameters: { url: signedTarget }, result: { direct_evidence: true, proof_type: 'http_response', observation: 'Restricted fixture marker was observed' }, confidence: 'observed', authority: 'request-replay', engagement_id: id })
  assert.equal(proof.ok, true)
  store.addVuln(id, { target: signedTarget, title: 'Direct fixture finding', status: 'confirmed', evidence_refs: [proof.ev_id] })
  const report = buildSrcReport(store, id, { save: false })
  assert.equal(report.confirmed, 1)
  assert.equal(report.markdown.includes(secret), false)
  assert.equal(report.requests_sent, 0)
})

test('a direct-evidence stop in the source ledger prevents repeat target traffic through the embedded assessment engine', async t => {
  const { store, root } = storeFixture(t)
  const id = srcEngagement(store)
  const { state, options } = mockAssessment()
  await awaProject(store, id, { mode: 'create', target, scope: [scope] }, options)
  const proof = new EvidenceLedger(store.db(id)).record({ operation: 'offline_fixture_verification', parameters: { url: target }, result: { direct_evidence: true, proof_type: 'http_response', observation: 'Direct fixture evidence is complete' }, confidence: 'observed', authority: 'request-replay', engagement_id: id })
  assert.equal(proof.ok, true)
  store.addVuln(id, { target, title: 'Direct stopped fixture', status: 'confirmed', evidence_refs: [proof.ev_id] })
  await assert.rejects(awaCall(store, id, 'http.capture', { url: target }, options))
  assert.equal(state.calls.filter(call => call.action === 'http.capture').length, 0)
  const help = await awaCall(store, id, 'action.help', { name: 'http.capture' }, options)
  assert.equal(help.ok, true)
  assert.equal(state.target_requests, 0)
})
