import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, isAbsolute, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { removeTreeNoFollowSync } from '../lib/remove-tree.js'
import { withAssessmentGuidance } from '../lib/redteam/assessment-guidance.js'
import { defaultPythonExecutable } from '../lib/redteam/native-assessment.js'
import { resolveTool } from '../lib/redteam/platform-config.js'

const executeFile = promisify(execFile)
const repositoryRoot = resolve(fileURLToPath(new URL('../', import.meta.url)))
const engineRoot = join(repositoryRoot, 'lib', 'redteam', 'assessment-engine')
const packageVersion = JSON.parse(readFileSync(join(repositoryRoot, 'package.json'), 'utf8')).version
const temporaryParent = realpathSync(tmpdir())
const fixtureRoot = mkdtempSync(join(temporaryParent, 'purge-tool-routing-audit-'))
const nativeAudit = String.raw`
import copy, json, sys
from pathlib import Path
from unittest.mock import patch
from awa_ddd import browser, engine, external, runtime, tscanplus
from awa_ddd.__main__ import _project_dispatch
from awa_ddd.domain.repository import Repository
from awa_ddd.execution import capabilities
from awa_ddd.store import Project

root = Path(sys.argv[1])
yak_catalog = [{'name': 'codec', 'description': 'Synthetic codec-only catalog',
                'inputSchema': {'type': 'object', 'properties': {}}}]
yak_tool_calls = []
replay_tool_calls = []
scanner_tool_calls = []

def project_at(name, origins=None):
    scope = origins or ['https://tool.audit.invalid/api']
    project = Project(root / name, 'assessment', create=True)
    project.set_config({'project_id': 'assessment', 'target': scope[0],
                        'scope': scope, 'exclude': [],
                        'allow_mutation': False, 'assessment_mode': 'assessment',
                        'assessment_model': 'v2', 'coverage_policy': 'subject'})
    return project

def provider_row(project, provider):
    return next(row for row in capabilities.snapshot(project)['providers'] if row['provider'] == provider)

class FakeYakClient:
    def __init__(self, *unused_args, **unused_options):
        self.exchanges = []
        self.noise = []

    def initialize(self):
        return {'serverInfo': {'name': 'synthetic-yak', 'version': 'audit'}}

    def list_tools(self):
        return copy.deepcopy(yak_catalog)

    def call_tool(self, name, arguments):
        yak_tool_calls.append({'name': name, 'arguments': arguments})
        raise AssertionError('Codec-only Yak cannot run a supported HTTP replay')

    def close(self):
        return None

class FakeReplayYakClient(FakeYakClient):
    def list_tools(self):
        return [{'name': 'http_fuzzer', 'inputSchema': {'type': 'object', 'properties': {
            'request': {'type': 'string'}, 'noFollowRedirect': {'type': 'boolean'},
            'fuzzTagMode': {'type': 'string'}},
            'required': ['request', 'noFollowRedirect', 'fuzzTagMode']}}]

    def call_tool(self, name, arguments):
        replay_tool_calls.append({'name': name, 'arguments': copy.deepcopy(arguments)})
        return {'content': [{'type': 'text', 'text': 'HTTP/1.1 200 OK\r\nContent-Length: 0\r\n\r\n'}]}

class FakeScannerClient:
    def __init__(self, *unused_args, **unused_options):
        self.exchanges = []
        self.last_tool_result = None

    def initialize(self):
        return {'serverInfo': {'name': 'synthetic-tscanplus', 'version': 'audit'}}

    def list_tools(self):
        return [{'name': 'project_summary', 'inputSchema': {'type': 'object',
                 'properties': {'project': {'type': 'string'}}, 'required': ['project']}}]

    def call_tool(self, name, arguments):
        scanner_tool_calls.append({'name': name, 'arguments': arguments})
        assert name == 'project_summary'
        self.last_tool_result = {'structuredContent': {'success': True, 'data': {
            'project': arguments['project'], 'counts': {table: 0 for table in tscanplus.TABLES},
            'has_assets': False, 'truncated': False, 'complete': True}}, 'content': []}
        return self.last_tool_result

    def close(self):
        return None

def verified_browser_visit(unused_project, visit_id, unused_url):
    return ({'id': visit_id, 'source': 'local_playwright', 'actor_id': 'audit-actor',
             'session_id': 'audit-session'},
            {'dialogs': [{'message': 'audit-browser-marker'}] if visit_id == 'audit-attack' else []})

def main():
    results = {}
    with project_at('browser') as project:
        with patch.object(browser, 'probe', return_value={'available': True, 'version': 'synthetic-audit'}):
            probed = _project_dispatch(project, 'browser.probe', {'project_id': 'assessment'})
        row = provider_row(project, 'playwright')
        project.put('evidence', {'id': 'E-' + 'a' * 32, 'sha256': 'a' * 64})
        project.put('evidence', {'id': 'E-' + 'b' * 32, 'sha256': 'b' * 64})
        repository = Repository(project)
        with patch.object(browser, '_verified_visit', side_effect=verified_browser_visit):
            evaluated = _project_dispatch(project, 'test.run_browser', {
                'project_id': 'assessment', 'mode': 'xss_evaluate',
                'consumer_url': 'https://tool.audit.invalid/api/consumer',
                'marker': 'audit-browser-marker', 'attack_visit_id': 'audit-attack',
                'normal_visit_id': 'audit-normal', 'writer_attack_evidence_id': 'E-' + 'a' * 32,
                'writer_normal_evidence_id': 'E-' + 'b' * 32})
        results['playwright'] = {'synthetic_probe_available': probed['available'],
            'capability_catalog_verified': row['catalog_verified'], 'capability_ready': row['ready'],
            'capability_reasons': row['unavailable_reasons'],
            'xss_evaluation': evaluated,
            'v2_findings_created': len(repository.list('finding', limit=None)[0]),
            'v2_runs_created': len(repository.list('run', limit=None)[0]),
            'multi_role_readiness_reasons': capabilities.ready_for(project, provider='playwright',
                profile='multi_role_xss')['reasons']}
    with project_at('yakit') as project:
        executable = root / ('yak.exe' if sys.platform == 'win32' else 'yak')
        executable.write_bytes(b'audit placeholder; never executed')
        with patch.object(external, 'MCPClient', FakeYakClient):
            probed = external.probe(project, {'adapter': 'yakit', 'yak_path': str(executable)})
            row = provider_row(project, 'yakit')
            operation = engine.register_operation(project, {'url': 'https://tool.audit.invalid/api/replay',
                'method': 'GET', 'auth': 'public'})
            replayed = external.yakit_replay(project, {'operation_id': operation['id'], 'effect': 'read_only'})
        results['yakit'] = {'synthetic_probe_available': probed['available'],
            'catalog_tools': [tool['name'] for tool in yak_catalog], 'capability_ready': row['ready'],
            'actual_profile_status': replayed['status'], 'actual_profile_error': replayed.get('error_code'),
            'mcp_tool_calls': len(yak_tool_calls),
            'post_readiness_for_public_get_profile': capabilities.ready_for(project, provider='yakit',
                profile='public_get_replay', method='POST')['ready']}
    with project_at('yakit-protocol', ['http://tool.audit.invalid/api', 'https://tool.audit.invalid/api']) as project:
        replay_states = []
        with patch.object(external, 'MCPClient', FakeReplayYakClient):
            external.probe(project, {'adapter': 'yakit', 'yak_path': str(executable)})
            for scheme in ('http', 'https'):
                operation = engine.register_operation(project, {'url': scheme + '://tool.audit.invalid/api/replay',
                    'method': 'GET', 'auth': 'public'})
                replay_states.append(external.yakit_replay(project, {
                    'operation_id': operation['id'], 'effect': 'read_only'})['status'])
        results['yakit_protocol'] = {'catalog_has_https_control': False,
            'http_and_https_mcp_arguments_equal': replay_tool_calls[0]['arguments'] == replay_tool_calls[1]['arguments'],
            'synthetic_replay_states': replay_states, 'mcp_tool_calls': len(replay_tool_calls)}
    with project_at('tscanplus') as project:
        with patch.object(tscanplus, 'StreamableHTTPClient', FakeScannerClient):
            probed = tscanplus.probe(project, {'adapter': 'tscanplus', 'scanner_project': 'audit'})
            summarized = tscanplus.project_summary(project, {})
        row = provider_row(project, 'tscanplus')
        results['tscanplus'] = {'synthetic_probe_available': probed['available'],
            'existing_summary_profile_status': summarized['status'],
            'native_configuration_saved': 'tscanplus' in project.config.get('external_tools', {}),
            'capability_configured': row['configured'], 'capability_ready': row['ready'],
            'capability_reasons': row['unavailable_reasons'], 'mcp_tool_calls': len(scanner_tool_calls)}
    body_path = r'C:\audit\incoming\body.json'
    tool_path = r'C:\audit\tools\sqlmap.py'
    scenario_args = {'scenario': {'steps': [{'body_file': body_path}]}}
    with patch.object(runtime, 'translate_path', side_effect=lambda value: '/translated/' + Path(value).name):
        direct_scenario = runtime.translate_request_paths('scenario.run', scenario_args)
        wrapped_scenario = runtime.translate_request_paths('test.run_scenario', scenario_args)
        direct_external = runtime.translate_request_paths('tool.sqlmap', {'sqlmap_path': tool_path})
        wrapped_external = runtime.translate_request_paths('test.run_external', {'sqlmap_path': tool_path})
    results['wsl_translation'] = {
        'scenario_run_translates_step_body_file': direct_scenario['scenario']['steps'][0]['body_file'] != body_path,
        'test_run_scenario_translates_step_body_file': wrapped_scenario['scenario']['steps'][0]['body_file'] != body_path,
        'tool_sqlmap_translates_executable_path': direct_external['sqlmap_path'] != tool_path,
        'test_run_external_translates_executable_path': wrapped_external['sqlmap_path'] != tool_path}
    return results

with patch('socket.socket', side_effect=AssertionError('Audit forbids sockets')), \
     patch('socket.getaddrinfo', side_effect=AssertionError('Audit forbids DNS')):
    print(json.dumps(main(), ensure_ascii=True))
`

try {
  const { stdout } = await executeFile(defaultPythonExecutable(), ['-E', '-s', '-X', 'utf8', '-B', '-c', nativeAudit, fixtureRoot],
    { cwd: engineRoot, shell: false, windowsHide: true, encoding: 'utf8', timeout: 30000, maxBuffer: 256 * 1024 })
  const native = JSON.parse(stdout)
  const browserGuidance = withAssessmentGuidance({ ok: true, data: native.playwright.xss_evaluation },
    'audit-engagement', { model: 'v2', campaign_id: 'CAM-' + 'c'.repeat(24) }, 'test.run_browser', { mode: 'xss_evaluate' })
  const toolSource = readFileSync(join(repositoryRoot, 'lib', 'redteam', 'tools.js'), 'utf8')
  const description = /name:\s*'redteam_assessment_run',\s*description:\s*'([^\n]*)'/.exec(toolSource)?.[1]
  assert(description)
  let resolutionCalls = 0
  const missingLinuxPath = '/__purge_audit_missing__/nmap'
  assert(!existsSync(missingLinuxPath))
  const configured = process.platform === 'win32' ? resolveTool('nmap', {
    config: { wslDistribution: 'kali-linux', tools: { nmap: missingLinuxPath } },
    exec() { resolutionCalls++; throw new Error('Configured Linux paths are checked before WSL resolution') },
  }) : null
  console.log(JSON.stringify({ schema: 'dsh-purge-tool-routing-audit/v1', package_version: packageVersion,
    isolation: { synthetic_tool_transports: true, target_network_disabled: true, temporary_state_only: true,
      real_browser_launched: false, real_yak_executed: false, real_wsl_started: false, model_selection_test_performed: false },
    native, browser_facade_guidance: { workflow_phase: browserGuidance.workflow_phase,
      next_action: browserGuidance.next_step?.arguments?.action || null },
    top_level_assessment_description_mentions: Object.fromEntries(['playwright', 'yakit', 'tscanplus',
      'browser.visit', 'test.run_browser', 'tool.yakit_replay', 'tool.tscanplus_request']
      .map(name => [name, description.toLowerCase().includes(name)])),
    windows_configured_linux_path: configured ? { source: configured.source,
      wsl_resolution_calls: resolutionCalls, executable_found: Boolean(configured.path) } : { state: 'not_applicable' },
  }, null, 2))
} finally {
  const resolvedRoot = resolve(fixtureRoot)
  const relativeRoot = relative(temporaryParent, resolvedRoot)
  assert(relativeRoot && !isAbsolute(relativeRoot) && relativeRoot !== '..' && !relativeRoot.startsWith('..\\')
    && !relativeRoot.startsWith('../') && basename(resolvedRoot).startsWith('purge-tool-routing-audit-'))
  assert.equal(realpathSync(resolvedRoot), resolvedRoot)
  removeTreeNoFollowSync(resolvedRoot)
}
