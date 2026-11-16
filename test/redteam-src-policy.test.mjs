import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { RedteamStore, dispatch } from '../lib/redteam/store-core.js'
import { EvidenceLedger } from '../lib/redteam/evidence-ledger.mjs'
import { normalizeScopeRules, targetWithinScope, isSrcAllowedTool } from '../lib/redteam/assessment-policy.js'
import { readPresetDefinition } from '../lib/redteam/preset-composition.js'
import { apply as applyPresetPlugin } from '../lib/presets-plugin.js'
import { confirmFinding, observeFinding } from './fixtures/trusted-finding.mjs'

function fixture(t, mode = 'src') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'purge-src-'))
  const store = new RedteamStore(root)
  t.after(() => { store.close(); fs.rmSync(root, { recursive: true, force: true }) })
  const engagement = store.openEngagement('SRC fixture', ['https://example.test/api'], { assessment_mode: mode, exclude: ['https://example.test/api/admin'], bindCurrent: false })
  return { store, id: engagement.id, root }
}

const target = 'https://example.test/api/private'
test('SRC validates explicit URL/CIDR scope without resolving or excluding public addresses', () => {
  assert.throws(() => normalizeScopeRules([], { required: true }), /non-empty scope/)
  assert.throws(() => normalizeScopeRules(['*']), /invalid SRC/)
  assert.throws(() => normalizeScopeRules(['10.0.0.300/24']), /CIDR/)
  assert.throws(() => normalizeScopeRules(['https://user:pass@example.test/api']), /target URL/)
  const scope = normalizeScopeRules(['https://example.test/api', '203.0.113.0/24', '2001:db8::/32'])
  assert.equal(targetWithinScope(target, scope), true)
  assert.equal(targetWithinScope('https://example.test/api-other', scope), false)
  assert.equal(targetWithinScope('https://evil.example.test/api', scope), false)
  assert.equal(targetWithinScope('http://example.test/api/private', scope), false)
  assert.equal(targetWithinScope('203.0.113.9', scope), true)
  assert.equal(targetWithinScope('203.0.114.9', scope), false)
  assert.equal(targetWithinScope('2001:db8:10::3', scope), true)
  assert.equal(targetWithinScope('2001:db9::1', scope), false)
  assert.equal(targetWithinScope(target, scope, ['https://example.test/api/private']), false)
  assert.throws(() => targetWithinScope('https://example.test/api%2fprivate', scope), /ambiguous/)
})

test('SRC creation is atomic with respect to invalid prerequisites and cannot silently switch mode or scope', t => {
  const { store, id } = fixture(t)
  assert.throws(() => store.openEngagement('empty scope', [], { assessment_mode: 'src', exclude: [] }), /non-empty scope/)
  assert.throws(() => store.openEngagement('missing exclude', ['https://example.test/api'], { assessment_mode: 'src' }), /explicit exclude/)
  assert.equal(fs.existsSync(store.dirOf('empty-scope')), false)
  assert.throws(() => store.openEngagement('SRC fixture', undefined, { assessment_mode: 'redteam' }), /immutable/)
  assert.throws(() => store.openEngagement('SRC fixture', ['https://another.test'], { assessment_mode: 'src' }), /immutable/)
  assert.throws(() => store.openEngagement('SRC fixture', undefined, { assessment_mode: 'src', exclude: [] }), /immutable/)
  assert.equal(store.openEngagement('SRC fixture', undefined, { bindCurrent: false }).assessment_mode, 'src')
  assert.equal(store.assessmentPolicy(id).assessment_mode, 'src')
  assert.throws(() => store.db(id).prepare("UPDATE engagement_policy SET assessment_mode='redteam'").run(), /immutable/)
  // Display metadata can be edited, but the persisted execution policy wins.
  fs.writeFileSync(store.metaPathOf(id), 'target_name: renamed\nassessment_mode: redteam\nscope_cidrs: [*]\n')
  assert.equal(store.snapshot(id).engagement.assessment_mode, 'src')
  assert.deepEqual(store.assessmentPolicy(id).scope, ['https://example.test/api'])
  store.close()
  assert.equal(store.assessmentPolicy(id).assessment_mode, 'src')
})

test('default redteam behavior remains compatible while SRC denies post-exploitation through direct store and dispatch', async t => {
  const { store, id } = fixture(t)
  for (const operation of ['addCredential', 'addAccess', 'addWebshell', 'updateWebshell', 'addTunnel', 'updateTunnel', 'addScoreHit', 'saveScorePoint', 'deleteScorePoint', 'addAttackFile']) {
    assert.throws(() => store[operation](id, {}), /SRC policy forbids/)
    assert.equal(dispatch(store, { op: operation, engagement: id }).ok, false)
  }
  await assert.rejects(store.probeSessions(id), /SRC policy forbids/)
  assert.throws(() => store.addChainStep(id, { stage_code: 'internal', title: 'should fail' }), /SRC chain/i)
  assert.throws(() => store.addChainStep(id, { stage_code: 'recon', access_id: 1 }), /SRC chain/i)
  assert.throws(() => store.addVuln(id, { target, status: 'exploited' }), /SRC uses confirmed vulnerability evidence instead of post-exploitation gains/)
  assert.throws(() => store.addVuln(id, { target, gained: 'server control' }), /SRC uses confirmed vulnerability evidence instead of post-exploitation gains/)
  const ordinary = store.openEngagement('legacy compatible')
  assert.equal(ordinary.assessment_mode, 'redteam')
  assert.ok(store.addCredential(ordinary.id, { host: 'fixture.test', username: 'fixture', secret_value: 'inert' }).id)
  assert.throws(() => store.addVuln(ordinary.id, { title: 'unsupported prior label', status: 'confirmed' }), /requires a current proof/)
  assert.ok(store.addVuln(ordinary.id, { title: 'ordinary candidate behavior', status: 'candidate' }).id)
})

test('SRC keeps weak, imported, mismatched and unrelated observations as candidates', t => {
  const { store, id } = fixture(t)
  const candidate = store.addVuln(id, { target, title: 'Candidate', status: 'candidate', source: 'nuclei' })
  assert.equal(candidate.stop, false)
  assert.throws(() => store.updateVuln(id, candidate.id, { status: 'confirmed' }), /requires a current proof/)
  const ledger = new EvidenceLedger(store.db(id))
  const inferred = ledger.record({ engagement_id: id, operation: 'scanner_claim', confidence: 'inferred', authority: 'operator-input', result: { url: target } }).ev_id
  const scanner = observeFinding(store, id, candidate, { result: { direct_evidence: false, observation: 'Scanner suggestion remains unverified.' } })
  const wrongTarget = observeFinding(store, id, candidate, { binding: { target: 'https://example.test/api/another' }, result: { observation: 'Different fixture target.' } })
  const wrongEngagement = observeFinding(store, id, candidate, { binding: { engagement_id: 'another-fixture' }, result: { observation: 'Different fixture engagement.' } })
  const portOnly = observeFinding(store, id, candidate, { result: { direct_evidence: false, observation: null, port: 443 } })
  for (const ref of [inferred, scanner, wrongTarget, wrongEngagement, portOnly]) {
    assert.throws(() => store.updateVuln(id, candidate.id, { status: 'confirmed', evidence_refs: [ref] }), /requires a current proof/)
    assert.equal(store.listVulns(id).items[0].status, 'candidate')
  }
  assert.throws(() => store.addVuln(id, { target: 'https://example.test/api/admin', title: 'Excluded' }), /outside scope or excluded/)
  assert.throws(() => store.addHttpEvidence(id, { url: 'https://outside.test/', response: 'fixture' }), /outside scope/)
  assert.throws(() => store.importBundle(id, { assets: [{ ip: '192.0.2.1', ports: [{ url: 'https://outside.test/' }] }] }), /outside scope/)
  assert.equal(store.stats(id).assets, 0)
})

test('direct observed evidence confirms once, persists a stop record and remains integrity checked', t => {
  const { store, id } = fixture(t)
  const added = store.addVuln(id, { target, title: 'Directly verified fixture', status: 'candidate', evidence: 'Fixture-only restricted marker returned without authorization' })
  const ref = confirmFinding(store, id, added)
  const [finding] = store.srcFindings(id)
  assert.equal(finding.id, added.id)
  assert.deepEqual(finding.evidence_refs, [ref])
  assert.equal(finding.proofs[0].proof_type, 'http_response')
  assert.throws(() => store.updateVuln(id, added.id, { status: 'candidate' }), /finding is stopped/)
  store.db(id).prepare("UPDATE evidence SET result = '{\"url\":\"changed\"}' WHERE ev_id = ?").run(ref)
  assert.equal(store.srcFindings(id).length, 0)
  assert.equal(store.pendingSourceFindings(id).length, 1, 'changed proof keeps the source label pending rather than confirmed')
  assert.equal(store.srcStops(id).length, 1)
})

test('claimed direct evidence needs an explicit verification before confirmation', t => {
  const { store, id } = fixture(t)
  const ledger = new EvidenceLedger(store.db(id))
  const claim = ledger.record({ operation: 'minimal_http_verification', parameters: { url: target }, result: { alleged: true }, confidence: 'claimed', authority: 'subagent-report', source_agent: 'fixture-reviewer', engagement_id: id })
  assert.equal(claim.ok, true)
  const freeform = ledger.upgrade({ claimed_ev_id: claim.ev_id, verified_by: 'fixture-coordinator', verified_result: { url: target, direct_evidence: true, proof_type: 'http_response', observation: 'Alleged restricted fixture marker' } })
  assert.equal(freeform.ok, false)
  const finding = store.addVuln(id, { target, title: 'Verified claim', status: 'candidate' })
  confirmFinding(store, id, finding)
  assert.equal(store.srcFindings(id)[0].id, finding.id)
})

test('SRC presets and role defaults provide discovery tools and no exploitation roles', t => {
  const { store, id } = fixture(t)
  const roles = store.listPrompts(id)
  assert.deepEqual(roles.map(role => role.role), ['plan', 'recon', 'assess', 'vuln-scan'])
  assert(roles.every(role => role.content.includes('当前 SRC 模式契约')))
  assert(roles.find(role => role.role === 'vuln-scan').content.includes('直接证据'))
  assert.throws(() => store.savePrompt(id, 'exploit', 'arbitrary'), /SRC does not provide/i)
  assert.deepEqual(store.listStages(id).map(stage => stage.code), ['recon', 'discovery', 'verification', 'report'])
  const definition = readPresetDefinition('src', path.resolve('presets/src'))
  assert.equal(definition.name, 'SRC 模式')
  const names = definition.plugins.map(row => row.name)
  assert(!names.some(name => /dsh-tool-(?:bash|pwsh|web|subagent|fs)/.test(name)))
  assert.equal(definition.plugins.find(row => row.id === 'redteam-tools').config.assessmentMode, 'src')
  // DSH 0.2.2-rc.1's tool-todo requires an explicit policy. Without it the
  // registry drops the whole preset as broken and the SRC mode option vanishes.
  assert.equal(definition.plugins.find(row => row.id === 'tool-todo').config.allowParallelInProgress, true)
  assert.equal(isSrcAllowedTool('redteam_awa_call'), false)
  assert.equal(isSrcAllowedTool('redteam_assessment_run'), true)
  assert.equal(isSrcAllowedTool('redteam_webshell_add'), false)
  assert.equal(isSrcAllowedTool('redteam_unknown_future_tool'), false)
})

test('the running preset plugin installs and registers SRC and disposes every declaration', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'purge-src-presets-'))
  const oldHome = process.env.DSH_HOME
  process.env.DSH_HOME = root
  const definitions = [], released = [], effects = []
  const registry = { register: async definition => { definitions.push(definition); return () => released.push(definition.id) }, resolve: async () => ({ broken: null }) }
  const ctx = { agentPresets: registry, get: () => undefined, logger: { info() {}, warn() {} }, effect: fn => { effects.push(fn()) } }
  t.after(async () => {
    for (const effect of effects) await effect()
    if (oldHome === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = oldHome
    fs.rmSync(root, { recursive: true, force: true })
  })
  applyPresetPlugin(ctx)
  for (let i = 0; i < 20 && !definitions.some(definition => definition.id === 'src'); i++) await new Promise(resolve => setImmediate(resolve))
  assert(definitions.some(definition => definition.id === 'unrestricted'))
  assert(definitions.some(definition => definition.id === 'src'))
  assert.equal(fs.existsSync(path.join(root, '.agent-presets/src/agent.cordis.yml')), true)
  const status = JSON.parse(fs.readFileSync(path.join(root, 'dsh-purge-community/preset-declare.json'), 'utf8'))
  assert.equal(status.src.ok, true)
  assert.equal(status.src.phase, 'registered')
  assert.equal(status.unrestricted.ok, true)
  for (const effect of effects.splice(0)) await effect()
  assert.equal(released.length, definitions.length)
  assert.equal(new Set(released).size, released.length)
})
