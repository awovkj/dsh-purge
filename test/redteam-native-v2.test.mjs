// Real v2 acceptance from the copied, shipped engine; all HTTP is synthetic.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import { removeTreeNoFollowSync } from '../lib/remove-tree.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const executeFile = promisify(execFile)
const scope = ['https://fixture.invalid/api']
const exclude = ['https://fixture.invalid/api/admin']
const endpoint = 'https://fixture.invalid/api/render'

// The normal bridge retains its JSON protocol, interpreter flags, cwd, argv
// workspace and cancellation. Only the owned Python process replaces HTTP.
// It never evaluates the expression: it returns the fixed synthetic value 49.
const HTTP_PROTOCOL = String.raw`
import base64, hashlib, json, sys
from pathlib import Path
from urllib.parse import parse_qs, urlsplit
from unittest.mock import patch
from awa_ddd.__main__ import main
from awa_ddd.store import now
log = Path(sys.argv[1])
sys.argv = ["owned-v2-fixture", *sys.argv[2:]]
def request(url, method="GET", headers=None, body=None, timeout=15, max_bytes=65536):
    parsed = urlsplit(url)
    assert parsed.scheme == "https" and parsed.netloc == "fixture.invalid"
    assert parsed.path == "/api/render" and method == "GET"
    assert body in (None, b"", "") and timeout <= 15 and max_bytes <= 65536
    values = parse_qs(parsed.query, strict_parsing=True)
    assert set(values) == {"label"} and len(values["label"]) == 1
    label = values["label"][0]
    assert label in {"AWA-NORMAL", "7*7", "AWA-NORMAL-2"}
    document = {"value": "49" if label == "7*7" else label}
    raw = json.dumps(document, separators=(",", ":")).encode("utf-8")
    with log.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps({"url": url, "method": method, "label": label}) + "\n")
    return {"request": {"url": url, "method": method, "headers": headers or {}, "body_base64": ""},
        "response": {"status": 200, "headers": [["content-type", "application/json"]],
            "complete": True, "length": len(raw), "body_base64": base64.b64encode(raw).decode("ascii"),
            "body_sha256": hashlib.sha256(raw).hexdigest()},
        "started_at": now(), "completed_at": now(), "complete": True,
        "elapsed_ms": 0, "transport": "python-http-client", "redirect_followed": False}
with patch("awa_ddd.engine.request", request), \
        patch("socket.create_connection", side_effect=AssertionError("Real sockets are forbidden")), \
        patch("socket.socket.connect", side_effect=AssertionError("Real sockets are forbidden")), \
        patch("socket.socket.connect_ex", side_effect=AssertionError("Real sockets are forbidden")), \
        patch("socket.getaddrinfo", side_effect=AssertionError("Real DNS is forbidden")):
    raise SystemExit(main())
`

const INSPECT_V2 = String.raw`
import json, sys
from unittest.mock import patch
from awa_ddd.domain.repository import Repository
from awa_ddd.store import Project
with patch("socket.create_connection", side_effect=AssertionError("Real sockets are forbidden")), \
        patch("socket.socket.connect", side_effect=AssertionError("Real sockets are forbidden")), \
        Project(sys.argv[1], sys.argv[2]) as project:
    repository = Repository(project)
    campaigns = repository.list("campaign", limit=None)[0]
    runs = repository.list("run", limit=None)[0]
    findings = repository.list("finding", limit=None)[0]
    recipes = repository.list("recipe", limit=None)[0]
    print(json.dumps({"config": {key: project.config.get(key) for key in
        ("assessment_model", "assessment_mode", "allow_mutation", "scope", "exclude")},
        "campaigns": [{"id": row["id"], "model": row["model"], "state": row["state"]} for row in campaigns],
        "runs": [{"id": row["id"], "status": row["status"], "outcome": row.get("outcome"),
            "recipe_id": row["recipe_id"], "recipe_spec_hash": row["recipe_spec_hash"], "evidence_ids": row["evidence_ids"],
            "history": [entry["status"] for entry in row["status_history"]]} for row in runs],
        "recipes": [{"id": row["id"], "spec_hash": row["spec_hash"], "public_hash": row["public_hash"],
            "immutable": row["immutable"]} for row in recipes],
        "findings": [{"id": row["id"], "mode": row["mode"], "status": row["status"],
            "decision_id": row["decision_id"], "current": row["current"]} for row in findings],
        "stops": [{"operation_id": row["operation_id"], "decision_id": row["decision_id"],
            "evidence_ids": row["evidence_ids"]} for row in project.list("src_stop")]}))
`

async function fixture(t, operatorModel = 'v1') {
  const container = fs.mkdtempSync(path.join(os.tmpdir(), 'purge-native-v2-'))
  const install = path.join(container, 'install')
  const stateRoot = path.join(container, 'state')
  let store
  t.after(() => {
    store?.close()
    const resolved = path.resolve(container)
    const relative = path.relative(path.resolve(os.tmpdir()), resolved)
    assert(relative && !path.isAbsolute(relative) && !relative.startsWith('..')
      && path.basename(resolved).startsWith('purge-native-v2-'), 'cleanup stays inside this owned temporary fixture')
    removeTreeNoFollowSync(resolved)
  })
  fs.mkdirSync(install)
  fs.cpSync(path.join(ROOT, 'lib'), path.join(install, 'lib'), { recursive: true,
    filter: source => !['__pycache__', '.pytest_cache'].includes(path.basename(source)) && !source.endsWith('.pyc') })
  const version = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version
  fs.writeFileSync(path.join(install, 'package.json'), JSON.stringify({ name: 'dsh-purge-community', version, type: 'module' }) + '\n')
  const load = relative => import(pathToFileURL(path.join(install, relative)).href)
  const [{ RedteamStore }, api, native, { EvidenceLedger }, settings] = await Promise.all([
    load('lib/redteam/store-core.js'), load('lib/redteam/awa-integration.js'),
    load('lib/redteam/native-assessment.js'), load('lib/redteam/evidence-ledger.mjs'), load('lib/redteam/settings.js'),
  ])
  store = new RedteamStore(stateRoot)
  const pythonExecutable = process.env.AWA_DDD_TEST_PYTHON || (process.platform === 'win32' ? 'python' : 'python3')
  settings.saveAwaSettings(stateRoot, { pythonExecutable, executionBackend: 'native', timeoutMs: 15000, assessmentModel: operatorModel })
  const engineRoot = path.join(install, 'lib', 'redteam', 'assessment-engine')
  const callsPath = path.join(container, 'synthetic-http.jsonl')
  const options = { invokeEngine(config, action, args, { signal } = {}) {
    return native.embeddedAssessmentBridge.invokeEngine(config, action, args, { signal,
      spawnProcess(executable, argv, processOptions) {
        const index = argv.indexOf('-m')
        assert(index >= 0 && argv[index + 1] === 'awa_ddd', 'the fixture only wraps the fixed native engine module')
        assert.equal(processOptions.cwd, engineRoot)
        assert.equal(processOptions.shell, false)
        return spawn(executable, [...argv.slice(0, index), '-c', HTTP_PROTOCOL, callsPath, ...argv.slice(index + 2)], processOptions)
      },
    })
  } }
  const open = name => store.openEngagement(name, scope, { assessment_mode: 'src', exclude, bindCurrent: false }).id
  const python = async (script, ...args) => {
    const { stdout } = await executeFile(pythonExecutable, ['-E', '-s', '-X', 'utf8', '-B', '-c', script, ...args],
      { cwd: engineRoot, shell: false, windowsHide: true, encoding: 'utf8', timeout: 15000, maxBuffer: 128 * 1024 })
    return JSON.parse(stdout)
  }
  const inspect = id => python(INSPECT_V2, path.join(store.dirOf(id), 'assessment'), 'assessment')
  const httpCalls = () => fs.existsSync(callsPath)
    ? fs.readFileSync(callsPath, 'utf8').trim().split('\n').filter(Boolean).map(row => JSON.parse(row)) : []
  const deleteContext = id => {
    const target = path.resolve(store.dirOf(id), 'assessment-context.json')
    const relative = path.relative(path.resolve(container), target)
    assert(relative && !path.isAbsolute(relative) && !relative.startsWith('..')
      && path.basename(target) === 'assessment-context.json', 'remove only this fixture engagement metadata')
    fs.unlinkSync(target)
  }
  return { store, api, native, EvidenceLedger, options, open, python, inspect, httpCalls, deleteContext }
}

test('v2 initializes the actual embedded Python campaign automatically and reuses it without changing SRC policy', async t => {
  const f = await fixture(t, 'v2')
  const id = f.open('v2 automatic SRC initialization')
  const before = await f.api.assessmentStatus(f.store, id, f.options)
  assert.equal(before.context.ready, false)
  const initialized = await f.api.ensureNativeAssessment(f.store, id, {}, f.options)
  assert.equal(initialized.context.ready, true)
  assert.equal(initialized.context.model, 'v2')
  assert.equal(initialized.context.project_id, 'assessment')
  assert.equal(initialized.requests_sent, 0)
  const first = await f.inspect(id)
  assert.deepEqual(first.config, { assessment_model: 'v2', assessment_mode: 'src', allow_mutation: false, scope, exclude })
  assert.equal(first.campaigns.length, 1)
  assert.equal(first.campaigns[0].model, 'v2')
  assert.equal(initialized.context.campaign_id, first.campaigns[0].id)
  const repeated = await f.api.ensureNativeAssessment(f.store, id, {}, f.options)
  assert.equal(repeated.context.campaign_id, initialized.context.campaign_id)
  assert.deepEqual((await f.inspect(id)).campaigns, first.campaigns)
  await assert.rejects(f.api.initializeAssessment(f.store, id, { assessmentModel: 'v1' }, f.options), /model.*fixed|model.*match/)
  assert.deepEqual((await f.inspect(id)).config, first.config)
  assert.deepEqual(f.httpCalls(), [])
})

test('completed Python v2 initialization recovers missing native metadata despite default v1 and refuses an explicit downgrade', async t => {
  const f = await fixture(t, 'v1')
  const id = f.open('v2 interrupted metadata write')
  const initialized = await f.api.initializeAssessment(f.store, id, { assessmentModel: 'v2' }, f.options)
  const persisted = await f.inspect(id)
  assert.equal(persisted.config.assessment_model, 'v2')
  f.deleteContext(id)
  assert.equal(f.api.readNativeContext(f.store, id), null)
  await assert.rejects(f.api.initializeAssessment(f.store, id, { assessmentModel: 'v1' }, f.options), /model.*match|model.*fixed/)
  assert.equal(f.api.readNativeContext(f.store, id), null, 'a rejected explicit downgrade does not write replacement metadata')
  assert.deepEqual(await f.inspect(id), persisted, 'a rejected downgrade leaves Python state untouched')
  const recovered = await f.api.ensureNativeAssessment(f.store, id, {}, f.options)
  assert.equal(recovered.context.ready, true)
  assert.equal(recovered.context.model, 'v2')
  assert.equal(recovered.context.project_id, 'assessment')
  assert.equal(recovered.context.campaign_id, initialized.context.campaign_id)
  assert.deepEqual(await f.inspect(id), persisted, 'implicit recovery reuses the completed Python campaign')
  assert.deepEqual(f.httpCalls(), [])
})

test('multiple active v2 campaigns recover the last durable start and retain their original Python history', async t => {
  const f = await fixture(t, 'v1')
  const id = f.open('v2 multiple active campaign recovery')
  const initialized = await f.api.initializeAssessment(f.store, id, { assessmentModel: 'v2' }, f.options)
  const newer = await f.api.assessmentRun(f.store, id, 'campaign.start', { model: 'v2', new_campaign: true }, f.options)
  const lastStarted = newer.data.campaign.id
  assert.notEqual(lastStarted, initialized.context.campaign_id)
  assert.equal(f.api.readNativeContext(f.store, id).campaign_id, lastStarted, 'public start updates the current internal campaign immediately')
  const persisted = await f.inspect(id)
  assert.equal(persisted.campaigns.length, 2)
  assert(persisted.campaigns.every(row => row.state === 'active' && row.model === 'v2'))
  f.deleteContext(id)
  assert.equal(f.api.readNativeContext(f.store, id), null)
  const recovered = await f.api.ensureNativeAssessment(f.store, id, {}, f.options)
  assert.equal(recovered.context.model, 'v2')
  assert.equal(recovered.context.campaign_id, lastStarted, 'recovery follows the last durable start event rather than another active ID')
  assert.deepEqual(await f.inspect(id), persisted, 'recovery does not add, replace or retire any Python campaign')
  const repeated = await f.api.ensureNativeAssessment(f.store, id, {}, f.options)
  assert.equal(repeated.context.campaign_id, lastStarted)
  assert.deepEqual(await f.inspect(id), persisted)
  assert.deepEqual(f.httpCalls(), [])
})

test('a real read-only v2 test.run finding upgrades through native review to observed evidence and stops SRC', async t => {
  const f = await fixture(t, 'v2')
  const id = f.open('v2 machine proof SRC')
  const source = f.store.addVuln(id, { target: endpoint, title: 'Scanner template injection claim',
    severity: 'critical', status: 'candidate', source: 'owned-fixture', cve: 'CVE-2099-1234' })
  // The first native import performs actual v2 initialization with no bind step.
  const imported = await f.api.assessmentImport(f.store, id, { offset: 0, limit: 50 }, f.options)
  assert.equal(imported.requests_sent, 0)
  assert.equal(imported.data.candidate_ids.length, 1)
  const context = f.api.readNativeContext(f.store, id)
  assert.equal(context.model, 'v2')
  const registered = await f.api.assessmentRun(f.store, id, 'surface.register', { operation: {
    url: endpoint, method: 'GET', auth: 'public', inputs: [{ name: 'label', location: 'query', selector: 'label',
      consumer: 'template_engine', test_families: ['template_injection'] }],
  } }, f.options)
  // The automatically created campaign froze the initially empty inventory.
  // Start an explicit new inventory campaign through the public contract; no
  // fixture constructs or writes hypotheses, recipes or proof records itself.
  const campaign = await f.api.assessmentRun(f.store, id, 'campaign.start', { model: 'v2', new_campaign: true }, f.options)
  const campaignId = campaign.data.campaign.id
  const plan = await f.api.assessmentRun(f.store, id, 'campaign.next', { campaign_id: campaignId, limit: 1 }, f.options)
  assert.equal(plan.data.recipes.length, 1)
  assert.equal(plan.data.recipes[0].hypothesis.family, 'template_injection')
  const recipe = plan.data.recipes[0].recipe
  assert.equal(recipe.limits.effect, 'read_only')
  assert.equal(recipe.limits.max_writes, 0)
  const prepared = { operation_id: plan.data.recipes[0].target.operation_id, recipe_id: recipe.id, recipe_public_hash: recipe.spec_hash }
  assert.equal(prepared.operation_id, registered.data.id)
  await f.api.assessmentRun(f.store, id, 'candidate.link', { candidate_id: imported.data.candidate_ids[0],
    operation_id: prepared.operation_id }, f.options)
  assert.deepEqual(f.httpCalls(), [], 'initialization, import and frozen recipe setup remain offline')
  const executed = await f.api.assessmentRun(f.store, id, 'test.run', { campaign_id: campaignId,
    recipe_id: prepared.recipe_id, idempotency_key: 'owned-v2-read-only-proof' }, f.options)
  assert.equal(executed.data.outcome, 'supported')
  assert.equal(executed.data.finding.mode, 'machine')
  assert.equal(executed.data.finding.status, 'machine_confirmed')
  assert.equal(executed.data.finding.proof_scope, 'unexpected_expression_evaluation')
  const evidenceIds = executed.data.run.evidence_ids
  assert.equal(evidenceIds.length, 3)
  assert.deepEqual(f.httpCalls().map(row => row.label), ['AWA-NORMAL', '7*7', 'AWA-NORMAL-2'])
  const actual = await f.inspect(id)
  assert.equal(actual.runs.length, 1)
  const frozenRecipe = actual.recipes.find(row => row.id === prepared.recipe_id)
  assert(frozenRecipe)
  assert.equal(frozenRecipe.immutable, true)
  // The public projection exposes public_hash as spec_hash. The managed run
  // binds the different, private manifest commitment in the owned ledger.
  assert.equal(frozenRecipe.public_hash, prepared.recipe_public_hash)
  assert.equal(actual.runs[0].recipe_id, prepared.recipe_id)
  assert.equal(actual.runs[0].recipe_spec_hash, frozenRecipe.spec_hash)
  assert.equal(actual.runs[0].outcome, 'supported')
  assert(actual.runs[0].history.includes('response_saved') && actual.runs[0].history.includes('evaluated'))
  assert.equal(actual.findings[0].status, 'machine_confirmed')
  assert.equal(actual.stops[0].operation_id, prepared.operation_id)
  assert.deepEqual(actual.stops[0].evidence_ids, evidenceIds)
  const received = await f.api.assessmentReview(f.store, id, { verify: false }, f.options)
  const ledger = new f.EvidenceLedger(f.store.db(id))
  assert.equal(ledger.get(received.reviews[0].evidence_ref).confidence, 'inferred')
  assert.equal(f.store.db(id).prepare('SELECT status FROM vuln WHERE id = ?').get(source.id).status, 'candidate')
  const missingInput = await f.api.assessmentReview(f.store, id, { verify: true }, f.options)
  assert.equal(missingInput.reviews[0].status, 'confirmation_pending', 'a real v2 finding cannot confirm an unbound source input')
  assert.equal(missingInput.data.candidates[0].decisions[0].reason, 'input_binding_required')
  assert.equal(f.store.db(id).prepare('SELECT status FROM vuln WHERE id = ?').get(source.id).status, 'candidate')
  await f.api.assessmentRun(f.store, id, 'candidate.link', { candidate_id: imported.data.candidate_ids[0],
    operation_id: prepared.operation_id, input_location: 'query', input_selector: 'label' }, f.options)
  const confirmed = await f.api.assessmentReview(f.store, id, { verify: true }, f.options)
  assert.equal(confirmed.requests_sent, 0)
  assert.equal(confirmed.reviews[0].status, 'verified')
  const observation = ledger.get(confirmed.reviews[0].evidence_ref)
  assert.equal(observation.confidence, 'observed')
  assert.equal(observation.result.direct_evidence, true)
  assert.equal(observation.result.proof_mode, 'machine')
  assert.equal(observation.result.current, true)
  assert.equal(observation.result.validated, true)
  assert.equal(observation.result.decision_id, executed.data.run.id)
  assert.deepEqual(observation.result.evidence_ids, evidenceIds)
  assert.equal(observation.result.evidence_hashes.length, 3)
  for (const record of observation.result.evidence_hashes) {
    assert(evidenceIds.includes(record.evidence_id))
    assert.match(record.sha256, /^[a-f0-9]{64}$/)
    assert.equal(record.complete, true)
  }
  const finding = f.store.db(id).prepare('SELECT status,title,severity,cve,stop_reason FROM vuln WHERE id = ?').get(source.id)
  assert.equal(finding.status, 'confirmed')
  assert.equal(finding.title, executed.data.finding.title)
  assert.equal(finding.severity, 'high')
  assert.equal(finding.cve, null)
  assert.equal(finding.stop_reason, 'direct_evidence_obtained')
  const repeated = await f.api.assessmentReview(f.store, id, { verify: true }, f.options)
  assert.equal(repeated.reviews[0].evidence_ref, observation.ev_id)
  await assert.rejects(f.api.assessmentRun(f.store, id, 'http.capture', { operation_id: prepared.operation_id, url: endpoint }, f.options), /stopped_at_evidence/)
  assert.equal(f.httpCalls().length, 3, 'offline review and the stopped request cannot send another HTTP control')
})
