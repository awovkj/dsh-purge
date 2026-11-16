import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtempSync, realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, isAbsolute, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { defaultPythonExecutable } from '../lib/redteam/native-assessment.js'
import { assessmentWorkflow } from '../lib/redteam/assessment-workflow.js'
import { currentSkillOptions, runLocalAssessmentAction } from '../lib/redteam/assessment-local-actions.js'
import { removeTreeNoFollowSync } from '../lib/remove-tree.js'

const execute = promisify(execFile)
const engine = fileURLToPath(new URL('../lib/redteam/assessment-engine/', import.meta.url))
const cases = String.raw`
import base64, hashlib, json, sys
from pathlib import Path
from unittest.mock import patch
from awa_ddd import engine
from awa_ddd.__main__ import _project_dispatch
from awa_ddd.execution import capabilities
from awa_ddd.publication import invoke
from awa_ddd.store import Project, EngineError, now
from awa_ddd.transport import request_parts

root = Path(sys.argv[1])
def capture(url, method='GET', headers=None, body=None, timeout=15, max_bytes=65536):
    mime, raw = ('application/javascript', b'fetch("/api/profile")') if url.endswith('.js') else ('text/html', b'<html>fixture</html>')
    actual_headers, unused_body = request_parts(url, headers or {}, body)
    return {'request': {'url': url, 'method': method, 'headers': actual_headers, 'body_base64': ''},
            'response': {'status': 200, 'headers': [['content-type', mime]], 'complete': True, 'length': len(raw),
                         'body_base64': base64.b64encode(raw).decode(), 'body_sha256': hashlib.sha256(raw).hexdigest()},
            'started_at': now(), 'completed_at': now(), 'complete': True, 'elapsed_ms': 0,
            'transport': 'python-http-client', 'redirect_followed': False}

results = {}
with (patch('awa_ddd.engine.request', capture), patch('socket.create_connection', side_effect=AssertionError('No target sockets')),
      patch('socket.getaddrinfo', side_effect=AssertionError('No target DNS')),
      patch('awa_ddd.browser.probe', side_effect=AssertionError('Routing must not probe'))):
    for mode in ('src', 'assessment'):
        with Project(root / mode, 'assessment', create=True) as project:
            project.set_config({'project_id': 'assessment', 'target': 'https://routing.invalid/', 'scope': ['https://routing.invalid/'],
                                'exclude': [], 'assessment_mode': mode, 'assessment_model': 'v2', 'allow_mutation': False})
            javascript = engine.register_operation(project, {'url': 'https://routing.invalid/app.js', 'method': 'GET', 'auth': 'public'})
            page = engine.register_operation(project, {'url': 'https://routing.invalid/page', 'method': 'GET', 'auth': 'public'})
            evidence = engine.capture(project, {'operation_id': javascript['id'], 'idempotency_key': 'script'})
            def call(inputs):
                return invoke(project, 'tool.route', {'project_id': 'assessment', **inputs}, _project_dispatch)
            offline = call({'purpose': 'frontend', 'operation_id': javascript['id'], 'evidence_ids': [evidence['id']]})
            assert offline['items'][0]['next']['input']['evidence_ids'] == [evidence['id']], offline
            assert offline['items'][0]['provider'] == 'native' and offline['items'][0]['offline_only']
            missing = call({'purpose': 'browser', 'operation_id': page['id']})
            assert not missing['items'][0]['ready'] and missing['items'][0]['next']['action'] == 'browser.probe'
            with patch('awa_ddd.browser.available', return_value={'available': True, 'node': 'fixture-node', 'module_path': 'fixture-module'}):
                capabilities.record(project, 'playwright', installed=True, configured=True, catalog_verified=True,
                                    profile_supported=True, authorized=True, evidence={'available': True})
                browser = call({'purpose': 'browser', 'operation_id': page['id']})
                assert browser['items'][0]['ready'] and browser['items'][0]['next']['action'] == 'browser.visit', browser
            replay = call({'purpose': 'request_replay', 'operation_id': page['id']})
            assert not replay['items'][0]['ready'] and replay['items'][0]['next']['action'] == 'action.help'
            for forbidden in ({'ready': True}, {'backend': 'wsl'}, {'tools': ['bash']}, {'mode': 'assessment'}):
                try:
                    call(forbidden)
                    raise AssertionError('Untrusted readiness accepted')
                except EngineError as error:
                    assert error.code == 'tool_route_arguments'
            try:
                call({'purpose': 'frontend', 'operation_id': page['id'], 'evidence_ids': [evidence['id']]})
                raise AssertionError('Wrong operation evidence accepted')
            except EngineError as error:
                assert error.code == 'tool_route_evidence'
            results[mode] = {'offline': offline['items'][0]['next'], 'browser': browser['items'][0]['next'],
                             'requests_sent': browser['requests_sent'], 'dispatch': browser['automatic_dispatch']}
            if mode == 'src':
                project.put('src_stop', {'id': 'SRCSTOP-fixture', 'operation_id': page['id'], 'method': 'GET',
                    'endpoint': page['url'], 'evidence_ids': []})
                halted = call({'purpose': 'browser', 'operation_id': page['id']})
                assert all(row['offline_only'] for row in halted['items'])
                assert halted['items'][0]['profile'] == 'stopped_at_evidence', halted
    with Project(root / 'v1', 'assessment', create=True) as project:
        project.set_config({'project_id': 'assessment', 'target': 'https://routing.invalid/', 'scope': ['https://routing.invalid/'],
                            'exclude': [], 'assessment_mode': 'assessment', 'assessment_model': 'v1', 'allow_mutation': False})
        operation = engine.register_operation(project, {'url': 'https://routing.invalid/search', 'method': 'GET', 'auth': 'public',
            'inputs': [{'name': 'query', 'location': 'query', 'consumer': 'sql_query', 'test_families': ['sql_injection']}]})
        actor = engine.add_actor(project, {'actor_id': 'A-routing', 'subject': 'routing-user', 'roles': []})
        engine.add_session(project, {'actor_id': actor['id'], 'headers': {'Authorization': 'Bearer assessment.prepare'}})
        routed = invoke(project, 'tool.route', {'project_id': 'assessment', 'purpose': 'sql_verification', 'operation_id': operation['id']}, _project_dispatch)
        assert routed['items'][0]['next']['action'] == 'assessment.prepare', routed
        prepared = invoke(project, routed['items'][0]['next']['action'], {'project_id': 'assessment', **routed['items'][0]['next']['input']}, _project_dispatch)
        assert prepared['source']['operation_id'] == operation['id'] and prepared['requests_sent'] == 0, prepared
        results['v1_sql_route'] = True
print(json.dumps(results))
`

const adapterCases = String.raw`
import json, os, sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
from awa_ddd import engine, external, runtime, tscanplus, wsl_runner
from awa_ddd.execution import capabilities
from awa_ddd.execution.tool_router import route
from awa_ddd.store import Project, EngineError

root = Path(sys.argv[1])
catalog = []
sent = []
yak = root / ('yak.exe' if os.name == 'nt' else 'yak')
yak.write_bytes(b'fixture executable is never launched')
yak.chmod(0o700)
valid_yak = [{'name': 'http_fuzzer', 'inputSchema': {'type': 'object', 'properties': {
    'request': {'type': 'string'}, 'isHttps': {'type': 'boolean'}, 'noFollowRedirect': {'type': 'boolean'},
    'fuzzTagMode': {'type': 'string', 'enum': ['standard']}, 'concurrent': {'type': 'integer', 'maximum': 1},
    'repeatTimes': {'type': 'integer', 'maximum': 1}}, 'required': ['request', 'isHttps', 'noFollowRedirect', 'fuzzTagMode']}}]

class YakClient:
    def __init__(self, *arguments, **keywords):
        self.exchanges, self.noise = [], []
    def initialize(self):
        return {'serverInfo': {'name': 'fixture-yak'}}
    def list_tools(self):
        return catalog
    def call_tool(self, name, values):
        sent.append((name, values))
        return {'content': [{'type': 'text', 'text': 'HTTP/1.1 200 OK\r\n\r\nfixture'}]}
    def close(self):
        pass

scanner_catalog = [{'name': name, 'inputSchema': {'type': 'object', 'properties': {
    key: {'type': 'integer' if value == 'number' else value} for key, value in schema.items()},
    'required': ['project'] if name != 'http_request' else list(schema)}} for name, schema in tscanplus.PROFILE_SCHEMAS.items()]

class ScannerClient:
    def __init__(self, *arguments, **keywords):
        self.exchanges, self.last_tool_result = [], None
    def initialize(self):
        return {'serverInfo': {'name': 'fixture-scanner'}}
    def list_tools(self):
        return scanner_catalog
    def call_tool(self, name, values):
        sent.append((name, values))
        data = {'project': values['project'], 'counts': {table: 0 for table in tscanplus.TABLES}, 'has_assets': False}
        if name == 'query_results':
            data.update(table=values['table'], results=[], total=0, matched=0, result_limit=values['result_limit'])
        if name == 'route_candidates':
            data.update(candidates=[], assets=[], results_complete=True)
        self.last_tool_result = {'structuredContent': {'success': True, 'data': data}}
        return self.last_tool_result
    def close(self):
        pass

results = {}
with patch('awa_ddd.external.MCPClient', YakClient), patch('awa_ddd.tscanplus.StreamableHTTPClient', ScannerClient), \
     patch('socket.create_connection', side_effect=AssertionError('No tool or target sockets')):
    with Project(root / 'adapters', 'assessment', create=True) as project:
        project.set_config({'project_id': 'assessment', 'target': 'https://adapter.invalid/',
            'scope': ['https://adapter.invalid/', 'http://adapter.invalid/'], 'exclude': [],
            'assessment_mode': 'assessment', 'assessment_model': 'v2', 'allow_mutation': False})
        for selected in ('codec_only', 'missing_tls', 'valid'):
            catalog = [{'name': 'codec', 'inputSchema': {'type': 'object', 'properties': {}}}] if selected == 'codec_only' else json.loads(json.dumps(valid_yak))
            if selected == 'missing_tls':
                del catalog[0]['inputSchema']['properties']['isHttps']
            external.probe(project, {'adapter': 'yakit', 'yak_path': str(yak), 'timeout': 5})
            results[selected] = capabilities.ready_for(project, provider='yakit', profile='public_get_replay')['ready']
        for scheme in ('http', 'https'):
            operation = engine.register_operation(project, {'url': scheme + '://adapter.invalid/read', 'method': 'GET', 'auth': 'public'})
            advice = route(project, {'purpose': 'request_replay', 'operation_id': operation['id']})['items'][0]
            assert advice['ready'] and advice['next']['action'] == 'tool.yakit_replay'
            external.yakit_replay(project, advice['next']['input'])
            assert sent[-1][1]['isHttps'] is (scheme == 'https')
            assert sent[-1][1]['noFollowRedirect'] is True and sent[-1][1]['repeatTimes'] == 1
        results['tls_exact'] = True
        assert not capabilities.ready_for(project, provider='yakit', profile='public_get_replay', authenticated=True)['ready']
        assert not capabilities.ready_for(project, provider='yakit', profile='public_get_replay', method='POST')['ready']
        try:
            external._yak_arguments(valid_yak, 'GET /?value={{exec()}} HTTP/1.1\r\nHost: adapter.invalid\r\n\r\n', False, 5)
            raise AssertionError('Fuzztag execution accepted')
        except EngineError as error:
            assert error.code == 'tool_effect'
        yak.write_bytes(b'changed fixture executable')
        results['changed_file_ready'] = capabilities.ready_for(project, provider='yakit', profile='public_get_replay')['ready']
        catalog = valid_yak
        external.probe(project, {'adapter': 'yakit', 'yak_path': str(yak), 'timeout': 5})
        configured = project.get('tool_config', 'yakit')
        run = project.get('run', configured['probe_run_id'])
        run['finished_at'] = (datetime.now(timezone.utc) - timedelta(hours=2)).isoformat()
        project.put('run', run)
        results['stale_probe_ready'] = capabilities.ready_for(project, provider='yakit', profile='public_get_replay')['ready']
        tscanplus.probe(project, {'adapter': 'tscanplus', 'mcp_url': 'http://127.0.0.1:39001/mcp', 'scanner_project': 'MCP-fixture'})
        advice = route(project, {'purpose': 'scanner_results'})
        assert len(advice['items']) == 3 and all(row['ready'] for row in advice['items'])
        before = len(sent)
        handlers = {'tool.tscanplus_summary': tscanplus.project_summary, 'tool.tscanplus_results': tscanplus.query_results,
                    'tool.tscanplus_routes': tscanplus.route_candidates}
        for row in advice['items']:
            handlers[row['next']['action']](project, row['next']['input'])
        assert len(sent) - before == 3 and all(values['project'] == 'MCP-fixture' for name, values in sent[before:])
        results['scanner_exact_read_profiles'] = True
        with patch('awa_ddd.runtime.execution_backend', return_value='wsl'):
            assert not next(row for row in capabilities.snapshot(project)['providers'] if row['provider'] == 'tscanplus')['ready']
        try:
            tscanplus.project_summary(project, {'scanner_project': 'MCP-other'})
            raise AssertionError('Wrong namespace accepted')
        except EngineError as error:
            assert error.code == 'tscanplus_namespace'
        with patch('awa_ddd.runtime.execution_backend', return_value='wsl'):
            try:
                tscanplus._settings(project)
                raise AssertionError('Cross-backend scanner accepted')
            except EngineError as error:
                assert error.code == 'tscanplus_configuration'
        results['scanner_backend_namespace_bound'] = True
        with Project(root / 'src-adapters', 'assessment', create=True) as src_project:
            src_project.set_config({**project.config, 'assessment_mode': 'src', 'external_tools': {}})
            external.probe(src_project, {'adapter': 'yakit', 'yak_path': str(yak), 'timeout': 5})
            tscanplus.probe(src_project, {'adapter': 'tscanplus', 'mcp_url': 'http://127.0.0.1:39001/mcp', 'scanner_project': 'MCP-srcfixture'})
            results['src_replay_ready'] = capabilities.ready_for(src_project, provider='yakit', profile='public_get_replay')['ready']
            assert all(row['ready'] and row['offline_only'] for row in route(src_project, {'purpose': 'scanner_results'})['items'])

translated_paths, worker_calls = [], []
def translate(value):
    translated_paths.append(value)
    return '/mnt/c/fixture/' + value.rsplit('\\', 1)[-1] if value.startswith('C:') else value
def worker_run(arguments, **keywords):
    worker_calls.append((arguments, keywords))
    return SimpleNamespace(returncode=0)
with patch('awa_ddd.runtime.translate_path', translate), patch('awa_ddd.wsl_runner.subprocess.run', worker_run):
    request = {'action': 'test.run_scenario', 'args': {'scenario': {'steps': [{'body_file': r'C:\fixture\body.json'}]}},
        'operator_runtime_env': {'PURGE_PLAYWRIGHT_ROOT': r'C:\fixture\playwright', 'DSH_HOME': r'C:\fixture\profile', 'PLAYWRIGHT_BROWSERS_PATH': '0'}}
    assert wsl_runner.worker(request, r'C:\fixture\workspace') == 0
    arguments, keywords = worker_calls[-1]
    assert keywords['shell'] is False and keywords['env']['PLAYWRIGHT_BROWSERS_PATH'] == '0'
    assert keywords['env']['PURGE_PLAYWRIGHT_ROOT'] == '/mnt/c/fixture/playwright'
    payload = json.loads(keywords['input'])
    assert payload['args']['scenario']['steps'][0]['body_file'] == '/mnt/c/fixture/body.json'
    assert 'operator_runtime_env' not in payload
    external_args = runtime.translate_request_paths('test.run_external', {'sqlmap_path': r'C:\fixture\sqlmap.py', 'url': 'https://adapter.invalid/C:/keep'})
    assert external_args['sqlmap_path'] == '/mnt/c/fixture/sqlmap.py' and external_args['url'] == 'https://adapter.invalid/C:/keep'
    for bad in ({'PYTHONPATH': r'C:\poison'}, {'PURGE_PLAYWRIGHT_ROOT': 'bad\npath'}):
        try:
            wsl_runner.worker({**request, 'operator_runtime_env': bad}, r'C:\fixture\workspace')
            raise AssertionError('Writable environment accepted')
        except EngineError as error:
            assert error.code == 'wsl_runtime_environment'
results['wsl_typed_paths_operator_env'] = True
print(json.dumps(results))
`

test('public routing prefers local evidence, requires a real browser receipt and rejects writable readiness', async context => {
  const parent = realpathSync(tmpdir()), temporary = mkdtempSync(join(parent, 'purge-routing-'))
  context.after(() => {
    const target = resolve(temporary), inside = relative(parent, target)
    assert(inside && !isAbsolute(inside) && !inside.startsWith('..') && basename(target).startsWith('purge-routing-'))
    removeTreeNoFollowSync(target)
  })
  const { stdout } = await execute(defaultPythonExecutable(), ['-E', '-s', '-X', 'utf8', '-B', '-c', cases, temporary],
    { cwd: engine, windowsHide: true, timeout: 30000, maxBuffer: 256 * 1024 })
  const result = JSON.parse(stdout)
  assert.equal(result.v1_sql_route, true)
  for (const mode of ['src', 'assessment']) {
    assert.equal(result[mode].requests_sent, 0)
    assert.equal(result[mode].dispatch, false)
    const workflow = assessmentWorkflow({ ok: true, data: { items: [{ next: result[mode].browser, offline_only: false }] } },
      'isolated-engagement', null, 'tool.route')
    assert.equal(workflow.next_step.arguments.engagement, 'isolated-engagement')
    assert.equal(workflow.next_step.arguments.action, 'browser.visit')
    assert.equal(workflow.next_step.offline_only, false)
    assert.equal(workflow.next_step.automatic_dispatch, false)
  }
})

test('the local skill facade consumes only internal scoped registration and native readiness', () => {
  const store = { assessmentPolicy: () => ({ assessment_mode: 'pentest', scope: ['https://routing.invalid/'], exclude: [] }) }
  const options = { registeredTools: ['redteam_assessment_run'], skillRuntime: { assessment: true, browser: false } }
  const current = currentSkillOptions(store, 'isolated-engagement', options)
  assert.deepEqual(current.tools, ['redteam_assessment_run'])
  const catalog = runLocalAssessmentAction(store, 'isolated-engagement', 'skill.index', {}, options).data
  assert.equal(catalog.items.find(row => row.resource === 'authorization').availability, 'available')
  assert.equal(catalog.items.find(row => row.resource === 'browser').availability, 'blocked')
  const hidden = runLocalAssessmentAction(store, 'isolated-engagement', 'skill.index', {}, { ...options, registeredTools: [] }).data
  assert.equal(hidden.items.find(row => row.resource === 'authorization').missing[0].reason, 'tool_not_registered')
  assert.throws(() => runLocalAssessmentAction(store, 'isolated-engagement', 'skill.index', { capabilities: { browser: true } }, options),
    /literal filters/)
})

test('adapter profiles bind TLS, live files, scanner namespaces and typed WSL operator paths', async context => {
  const parent = realpathSync(tmpdir()), temporary = mkdtempSync(join(parent, 'purge-routing-adapters-'))
  context.after(() => {
    const target = resolve(temporary), inside = relative(parent, target)
    assert(inside && !isAbsolute(inside) && !inside.startsWith('..') && basename(target).startsWith('purge-routing-adapters-'))
    removeTreeNoFollowSync(target)
  })
  let stdout
  try {
    ({ stdout } = await execute(defaultPythonExecutable(), ['-E', '-s', '-X', 'utf8', '-B', '-c', adapterCases, temporary],
      { cwd: engine, windowsHide: true, timeout: 30000, maxBuffer: 256 * 1024 }))
  } catch (error) { throw new Error(error.stderr || error.code) }
  assert.deepEqual(JSON.parse(stdout), { codec_only: false, missing_tls: false, valid: true, tls_exact: true,
    changed_file_ready: false, stale_probe_ready: false, scanner_exact_read_profiles: true,
    scanner_backend_namespace_bound: true, src_replay_ready: false, wsl_typed_paths_operator_env: true })
})
