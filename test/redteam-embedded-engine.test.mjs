// Run only the recorded, shipped assessment sources from an independent package.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { checkEmbeddedAssessment } from '../scripts/sync-assessment-engine.mjs';
import { removeTreeNoFollowSync } from '../lib/remove-tree.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EMBEDDED = path.join(ROOT, 'lib', 'redteam', 'assessment-engine');
const executeFile = promisify(execFile);
const PROJECT_ID = 'assessment';
const TARGET = 'https://fixture.invalid/api/private';
const SCOPE = ['https://fixture.invalid/api'];
const EXCLUDE = ['https://fixture.invalid/api/admin'];
const PYTHON = process.env.AWA_DDD_TEST_PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
const SNAPSHOT = String.raw`
import json, sys
from awa_ddd.store import Project
with Project(sys.argv[1], sys.argv[2]) as p:
    events = [dict(row) for row in p.connection.execute("SELECT seq,type,document FROM events ORDER BY seq")]
    counts = {row['kind']: row['total'] for row in p.connection.execute("SELECT kind,count(*) AS total FROM entities GROUP BY kind")}
    print(json.dumps({'config':p.config,'events':events,'counts':counts},ensure_ascii=False))
`;

function isolatedPackage(t) {
  checkEmbeddedAssessment();
  const container = fs.mkdtempSync(path.join(os.tmpdir(), 'purge-embedded-engine-'));
  const repository = path.join(container, 'install');
  const component = path.join(repository, 'lib', 'redteam', 'assessment-engine');
  const workspace = path.join(container, 'state');
  const provenance = JSON.parse(fs.readFileSync(path.join(EMBEDDED, 'provenance.json'), 'utf8'));
  t.after(() => {
    const absolute = path.resolve(container);
    const relative = path.relative(path.resolve(os.tmpdir()), absolute);
    assert(relative && !path.isAbsolute(relative) && relative !== '..' && !relative.startsWith('..' + path.sep)
      && path.basename(absolute).startsWith('purge-embedded-engine-'), 'cleanup remains inside the owned temporary package');
    removeTreeNoFollowSync(absolute);
  });
  fs.mkdirSync(component, { recursive: true });
  for (const relative of [...provenance.files.map(file => file.path), 'package.json', 'provenance.json', 'NOTICE.md', 'README.md']) {
    const target = path.join(component, ...relative.split('/'));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(EMBEDDED, ...relative.split('/')), target);
  }
  fs.writeFileSync(path.join(repository, 'package.json'), JSON.stringify({ type: 'module', name: 'isolated-dsh-purge' }) + '\n');
  return { container, repository, component, workspace, provenance };
}

async function runtime(t) {
  const fixture = isolatedPackage(t);
  const bridge = await import(pathToFileURL(path.join(fixture.component, 'src', 'bridge.mjs')).href);
  const external = path.join(fixture.container, 'poisoned-external-source');
  fs.mkdirSync(path.join(external, 'awa_ddd'), { recursive: true });
  fs.writeFileSync(path.join(external, 'awa_ddd', '__init__.py'), "raise RuntimeError('External AWA source must never be imported')\n");
  const calls = [];
  const spawnProcess = (executable, argv, options) => {
    calls.push({ executable, argv: [...argv], cwd: options.cwd, shell: options.shell, windowsHide: options.windowsHide });
    return spawn(executable, argv, { ...options, env: { ...process.env,
      PYTHONPATH: external, AWA_DDD_PACKAGE_PATH: external, AWA_DDD_WORKSPACE: path.join(external, 'data') } });
  };
  const config = { workspace: fixture.workspace, pythonExecutable: PYTHON, timeoutMs: 15000, assessmentMode: 'src' };
  fixture.bridge = bridge;
  fixture.calls = calls;
  fixture.call = async (action, args = {}, overrides = {}) =>
    (await bridge.invokeEngine({ ...config, ...overrides }, action, args, { spawnProcess })).data;
  fixture.python = async (script, args = [], overrides = {}) => {
    const { stdout } = await executeFile(PYTHON, ['-E', '-s', '-X', 'utf8', '-B', '-c', script,
      overrides.workspace || fixture.workspace, PROJECT_ID, ...args],
    { cwd: fixture.component, shell: false, windowsHide: true, encoding: 'utf8', timeout: 15000, maxBuffer: 128 * 1024 });
    return JSON.parse(stdout);
  };
  fixture.snapshot = overrides => fixture.python(SNAPSHOT, [], overrides);
  fixture.create = (args = {}, overrides = {}) => fixture.call('project.create', {
    project_id: PROJECT_ID, target: TARGET, scope: SCOPE, exclude: EXCLUDE, assessment_mode: 'src', ...args,
  }, overrides);
  fixture.configure = (args = {}, overrides = {}) => fixture.call('dsh.context.configure', {
    project_id: PROJECT_ID, assessment_mode: 'src', scope: SCOPE, exclude: EXCLUDE, ...args,
  }, overrides);
  assert.equal(bridge.PACKAGE_ROOT, fixture.component);
  assert.equal(fs.existsSync(path.join(fixture.container, 'awa-ddd')), false);
  return fixture;
}

function assertNoExecution(snapshot) {
  for (const kind of ['run', 'evidence', 'decision', 'finding', 'v2_run', 'v2_finding', 'src_stop']) {
    assert.equal(snapshot.counts[kind] || 0, 0, kind + ' must remain absent during offline configuration/import');
  }
}

test('embedded provenance checks work offline and detect changed shipped source', t => {
  const metadata = checkEmbeddedAssessment();
  assert.equal(metadata.external_source_required, false);
  assert.equal(metadata.javascript_files, 3);
  assert(metadata.python_files >= 70);
  const fixture = isolatedPackage(t);
  const files = fixture.provenance.files;
  assert(files.some(file => file.path === 'awa_ddd/execution/test_runner.py'));
  assert.equal(files.filter(file => file.origin === 'dsh-purge').length, 1);
  assert(files.some(file => file.path === 'awa_ddd/dsh_context.py' && file.origin === 'dsh-purge' && file.upstream_sha256 === null));
  assert(files.every(file => !/node_modules|__pycache__|\.pyc$|\/tests_[^/]+\.py$|sdk|plugin\.mjs|\.sqlite3$/.test(file.path)));
  assert.equal(checkEmbeddedAssessment(fixture.repository).source_sha256, metadata.source_sha256);
  fs.appendFileSync(path.join(fixture.component, 'awa_ddd', 'engine.py'), '\n# fixture tampering\n');
  assert.throws(() => checkEmbeddedAssessment(fixture.repository), /integrity mismatch: awa_ddd\/engine\.py/);
});

test('a standalone embedded package enforces SRC before traffic and preserves imported claims as unverified', { timeout: 60000 }, async t => {
  const fixture = await runtime(t);
  const help = await fixture.call('action.help');
  assert(help.action_count > 50);
  assert.doesNotMatch(JSON.stringify(help), /dsh\.context\.configure/);
  await assert.rejects(fixture.call('action.help', { name: 'dsh.context.configure' }), { code: 'action_name' });
  await fixture.create();
  const status = await fixture.call('project.status', { project_id: PROJECT_ID });
  assert.equal(status.config.assessment_mode, 'src');
  assert.equal(status.config.allow_mutation, false);
  assert.equal(status.assessment_policy.stop_policy, 'stop_at_direct_evidence');

  let requests = 0;
  const server = createServer((_request, response) => {
    requests++;
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end('{"fixture":true}');
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const origin = 'http://127.0.0.1:' + server.address().port;
  await fixture.configure({ scope: [...SCOPE, origin + '/'] });
  const operation = await fixture.call('surface.register', {
    project_id: PROJECT_ID, operation: { url: origin + '/inert-write', method: 'POST', auth: 'public' },
  });
  await assert.rejects(fixture.call('http.capture', { project_id: PROJECT_ID, operation_id: operation.id }), error => {
    assert.equal(error.code, 'src_write_denied');
    assert.equal(error.details.requests_sent, 0);
    return true;
  });
  assert.equal(requests, 0, 'the owned loopback server received no HTTP request');
  await assert.rejects(fixture.call('project.update', { project_id: PROJECT_ID, assessment_mode: 'assessment' }), { code: 'assessment_mode_immutable' });

  const secret = 'EMBEDDED-TEST-PRIVATE-FIXTURE';
  const exchange = { schema: 'dsh-purge-awa/v1', engagement: { id: 'isolated-fixture' },
    candidates: [{ external_id: 'candidate:1', url: TARGET, method: 'GET', category: 'generic',
      title: 'Scanner status is a source claim', source_status: 'confirmed', severity: 'critical', evidence_refs: ['http:1'] }],
    http_evidence: [{ external_id: 'http:1', url: TARGET, method: 'GET', status_code: 200,
      sha256: 'a'.repeat(64), request: { headers: { Authorization: 'Bearer ' + secret }, body: secret },
      response: { headers: { 'Set-Cookie': secret }, body: secret } }] };
  const imported = await fixture.call('integration.import', { project_id: PROJECT_ID, exchange });
  assert.equal(imported.requests_sent, 0);
  assert.equal(imported.usable_for_confirmation, false);
  assert.equal(imported.candidates[0].status, 'unverified');
  const repeated = await fixture.call('integration.import', { project_id: PROJECT_ID, exchange });
  assert.equal(repeated.import_id, imported.import_id);
  assert.deepEqual(repeated.candidate_ids, imported.candidate_ids);
  assert.equal(repeated.counts.created, 0);
  const exported = await fixture.call('integration.export', { project_id: PROJECT_ID, import_id: imported.import_id });
  assert.equal(exported.requests_sent, 0);
  assert.equal(exported.counts.verified_candidates, 0);
  assert.equal(exported.candidates[0].source_status, 'confirmed');
  assert.equal(exported.candidates[0].status, 'unverified');
  assert.equal(exported.candidates[0].usable_for_confirmation, false);
  assert.deepEqual(exported.candidates[0].decisions, []);
  assert.deepEqual(exported.candidates[0].findings, []);
  assert.doesNotMatch(JSON.stringify(exported), new RegExp(secret));
  assertNoExecution(await fixture.snapshot());
  assert(fixture.calls.every(call => call.cwd === fixture.component && call.shell === false && call.windowsHide === true));
  assert(fixture.calls.every(call => JSON.stringify(call.argv.slice(0, 7)) === JSON.stringify(['-E', '-s', '-X', 'utf8', '-B', '-m', 'awa_ddd'])));
  assert.doesNotMatch(JSON.stringify(fixture.calls), /poisoned-external-source/);
});

test('the isolated package uses its own AST helper and declared acorn dependency without executing source', { timeout: 60000 }, async t => {
  const fixture = await runtime(t);
  const acorn = path.join(ROOT, 'node_modules', 'acorn');
  assert.equal(JSON.parse(fs.readFileSync(path.join(acorn, 'package.json'), 'utf8')).version, '8.19.0');
  fs.mkdirSync(path.join(fixture.repository, 'node_modules'), { recursive: true });
  fs.cpSync(fs.realpathSync(acorn), path.join(fixture.repository, 'node_modules', 'acorn'), { recursive: true, dereference: true });
  await fixture.create();
  const marker = path.join(fixture.container, 'input-executed.txt');
  const source = 'import fs from "node:fs";\nfs.writeFileSync(' + JSON.stringify(marker)
    + ', "must never happen");\nfetch("https://fixture.invalid/api/search?q=synthetic", {method:"GET"});\n';
  const input = path.join(fixture.container, 'static-input.js');
  fs.writeFileSync(input, source, 'utf8');
  const imported = await fixture.call('surface.import', { project_id: PROJECT_ID, path: input, format: 'javascript' });
  assert(imported.operation_ids.length > 0, JSON.stringify(imported.limitations));
  assert(!imported.limitations.some(row => /javascript_ast_parser_(?:unavailable|failed)/.test(row.code)));
  const operation = await fixture.call('surface.inspect', { project_id: PROJECT_ID, operation_id: imported.operation_ids[0] });
  const registered = operation.operation || operation;
  assert.equal(registered.url, 'https://fixture.invalid/api/search');
  assert.equal(registered.method, 'GET');
  assert(operation.inputs.some(row => row.location === 'query' && row.selector === 'q'));
  const digest = createHash('sha256').update(source, 'utf8').digest('hex');
  const lineage = await fixture.python(String.raw`
import json, sys
from awa_ddd.store import Project
with Project(sys.argv[1],sys.argv[2]) as p:
    row=p.get('operation',sys.argv[3])
    print(json.dumps({'source_hashes':[source.get('sha256') for source in row.get('sources',[])]}))
`, [imported.operation_ids[0]]);
  assert(lineage.source_hashes.includes(digest));
  assert.equal(fs.existsSync(marker), false, 'supplied JavaScript remains inert source data');
  assertNoExecution(await fixture.snapshot());
});

test('private owner context merges rules without changing policy and rejects invalid changes atomically', { timeout: 60000 }, async t => {
  const fixture = await runtime(t);
  await fixture.create();
  await fixture.python(String.raw`
import json, sys
from awa_ddd.store import Project
with Project(sys.argv[1],sys.argv[2]) as p:
    p.set_config({**p.config,'native_owner_marker':{'flag':False,'nested':['synthetic',3]}})
    print(json.dumps({'seeded':True}))
`);
  const before = await fixture.snapshot();
  const merged = await fixture.configure({ scope: ['HTTPS://SECOND.invalid:443/public'], exclude: ['https://second.invalid/private'] });
  assert.deepEqual(JSON.parse(JSON.stringify(merged)), { project_id: PROJECT_ID, assessment_mode: 'src', changed: true,
    added_scope_count: 1, added_exclude_count: 1, scope_total: 2, exclude_total: 2, requests_sent: 0 });
  const after = await fixture.snapshot();
  assert.deepEqual(after.config, { ...before.config, scope: [...SCOPE, 'https://second.invalid/public'],
    exclude: [...EXCLUDE, 'https://second.invalid/private'] });
  assert.equal(after.events.filter(row => row.type === 'dsh.context.configured').length, 1);
  const repeated = await fixture.configure({ scope: ['https://second.invalid/public', 'HTTPS://SECOND.invalid:443/public'], exclude: [] });
  assert.equal(repeated.changed, false);
  assert.deepEqual(await fixture.snapshot(), after, 'a repeated merge preserves state and emits no event');
  const invalid = [
    [{ target: 'https://second.invalid/public' }, 'dsh_context_shape'],
    [{ allow_mutation: true }, 'dsh_context_shape'],
    [{ unknown_owner_field: true }, 'dsh_context_shape'],
    [{ project_id: 'other-project' }, 'dsh_context_project'],
    [{ assessment_mode: 'assessment' }, 'assessment_mode_mismatch'],
    [{ required_assessment_mode: 'assessment' }, 'assessment_mode_mismatch'],
    [{ scope: [] }, 'dsh_context_shape'],
    [{ scope: ['file:///fixture'] }, 'url'],
    [{ scope: ['https://fixture.invalid/api/../ambiguous'] }, 'url'],
    [{ scope: ['https://user:password@fixture.invalid/api'] }, 'url'],
    [{ exclude: [TARGET] }, 'scope'],
    [{ scope: Array(257).fill(SCOPE[0]) }, 'dsh_context_budget'],
    [{ exclude: Array(257).fill(EXCLUDE[0]) }, 'dsh_context_budget'],
    [{ scope: ['https://fixture.invalid/' + 'x'.repeat(8192)] }, 'dsh_context_budget'],
    [{ exclude: null }, 'dsh_context_shape'],
  ];
  for (const [args, code] of invalid) {
    await assert.rejects(fixture.configure(args, { assessmentMode: 'assessment' }), error => {
      assert.equal(error.code, code);
      assert.equal(error.details.requests_sent, 0);
      return true;
    });
    assert.deepEqual(await fixture.snapshot(), after, 'failed owner configuration must not modify state');
  }
  await Promise.all([
    fixture.configure({ scope: ['https://third.invalid/'], exclude: ['https://third.invalid/private'] }),
    fixture.configure({ scope: ['https://fourth.invalid/'], exclude: ['https://fourth.invalid/private'] }),
  ]);
  const concurrent = await fixture.snapshot();
  assert.deepEqual(new Set(concurrent.config.scope), new Set([...after.config.scope, 'https://third.invalid/', 'https://fourth.invalid/']));
  assert.deepEqual(new Set(concurrent.config.exclude), new Set([...after.config.exclude, 'https://third.invalid/private', 'https://fourth.invalid/private']));
  assert.equal(concurrent.events.filter(row => row.type === 'dsh.context.configured').length, 3);
  assertNoExecution(concurrent);
});

test('owner context rolls back a failed event write and enforces the resulting rule budget', { timeout: 60000 }, async t => {
  const fixture = await runtime(t);
  await fixture.create({ assessment_mode: 'assessment', allow_mutation: true }, { assessmentMode: 'assessment' });
  const original = await fixture.snapshot();
  const failure = await fixture.python(String.raw`
import json, sys
from unittest.mock import patch
from awa_ddd.__main__ import dispatch
from awa_ddd.store import Project, EngineError
real_event=Project.event
def failed_event(project, event_type, payload):
    real_event(project,event_type,payload)
    raise EngineError('fixture_event_failure','Owned fixture failure after an event write')
try:
    with patch.object(Project,'event',failed_event):
        dispatch(sys.argv[1],'dsh.context.configure',{'project_id':sys.argv[2],
            'assessment_mode':'assessment','scope':['https://rollback.invalid/'],'exclude':[]})
except EngineError as exc:
    print(json.dumps({'code':exc.code,'requests_sent':exc.details.get('requests_sent')}))
`);
  assert.deepEqual(failure, { code: 'fixture_event_failure', requests_sent: 0 });
  assert.deepEqual(await fixture.snapshot(), original, 'config and event insert roll back as one transaction');
  await fixture.configure({ assessment_mode: 'assessment', scope: ['https://retained.invalid/'], exclude: [] }, { assessmentMode: 'assessment' });
  const preserved = await fixture.snapshot();
  assert.equal(preserved.config.allow_mutation, true, 'owner context preserves an existing assessment mutation policy');
  assert.equal(preserved.config.target, original.config.target);
  const remaining = Array.from({ length: 254 }, (_value, index) => 'https://budget-' + index + '.invalid/');
  await fixture.configure({ assessment_mode: 'assessment', scope: remaining, exclude: [] }, { assessmentMode: 'assessment' });
  const full = await fixture.snapshot();
  assert.equal(full.config.scope.length, 256);
  await assert.rejects(fixture.configure({ assessment_mode: 'assessment', scope: ['https://over-budget.invalid/'], exclude: [] },
    { assessmentMode: 'assessment' }), { code: 'dsh_context_budget' });
  assert.deepEqual(await fixture.snapshot(), full);
  assertNoExecution(full);
});
