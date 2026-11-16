import assert from 'node:assert/strict'
import { execFile, spawn } from 'node:child_process'
import { mkdtempSync, readFileSync, realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, isAbsolute, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { removeTreeNoFollowSync } from '../lib/remove-tree.js'
import { RedteamStore } from '../lib/redteam/store-core.js'
import { assessmentRun } from '../lib/redteam/awa-integration.js'
import { defaultPythonExecutable, embeddedAssessmentBridge } from '../lib/redteam/native-assessment.js'
import { saveAwaSettings } from '../lib/redteam/settings.js'

const engineRoot = resolve(fileURLToPath(new URL('../lib/redteam/assessment-engine/', import.meta.url)))
const packageVersion = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version
const pythonExecutable = process.env.AWA_DDD_TEST_PYTHON || defaultPythonExecutable()
const executeFile = promisify(execFile)
const temporaryParent = realpathSync(tmpdir())
const fixtureRoot = mkdtempSync(join(temporaryParent, 'purge-three-mode-audit-'))

const nativeAudit = String.raw`
import base64, json, sqlite3, sys
from pathlib import Path
from urllib.parse import parse_qs, urlsplit
from unittest.mock import patch
from awa_ddd import engine, v2api
from awa_ddd.domain.hypothesis import FAMILIES
from awa_ddd.domain.repository import Repository
from awa_ddd.domain.universe import operation_record
from awa_ddd.execution.recipe_builder import PAYLOADS, automatic_provider
from awa_ddd.planning import campaign, coverage, scheduler
from awa_ddd.planning.hypotheses import generate_hypotheses
from awa_ddd.proof_claim import finding_proof_state
from awa_ddd.store import Project, now
from awa_ddd.transport import request_parts

root = Path(sys.argv[1])
database = sqlite3.connect(':memory:')
database.execute('CREATE TABLE records (label TEXT NOT NULL)')
database.executemany('INSERT INTO records(label) VALUES (?)', [(PAYLOADS['sql_injection'][1],)] * 2)

def project_at(name, mode='assessment', origins=None):
    scope = origins or ['https://audit.invalid/api']
    project = Project(root / name, 'assessment', create=True)
    project.set_config({'project_id': 'assessment', 'target': scope[0], 'scope': scope,
                        'exclude': [], 'allow_mutation': False, 'assessment_mode': mode,
                        'assessment_model': 'v2', 'coverage_policy': 'subject'})
    return project

def capture(url, method='GET', headers=None, body=None, timeout=15, max_bytes=65536):
    parsed = urlsplit(url)
    assert parsed.hostname == 'audit.invalid' and method == 'GET'
    values = parse_qs(parsed.query)
    if parsed.path == '/api/search':
        count = database.execute('SELECT COUNT(*) FROM records WHERE label = ?',
                                 (values['query'][0],)).fetchone()[0]
        document = {'count': count}
    else:
        document = {'value': values['label'][0]}
    raw = json.dumps(document, separators=(',', ':')).encode('utf-8')
    actual_headers, actual_body = request_parts(url, headers or {}, body)
    return {'request': {'url': url, 'method': method, 'headers': actual_headers,
                        'body_base64': base64.b64encode(actual_body or b'').decode('ascii')},
            'response': {'status': 200, 'headers': [['content-type', 'application/json']],
                         'complete': True, 'length': len(raw),
                         'body_base64': base64.b64encode(raw).decode('ascii'),
                         'body_sha256': __import__('hashlib').sha256(raw).hexdigest()},
            'started_at': now(), 'completed_at': now(), 'complete': True,
            'elapsed_ms': 0, 'transport': 'python-http-client', 'redirect_followed': False}

def prepared_run(project, path, name, consumer, family):
    operation = engine.register_operation(project, {'url': 'https://audit.invalid/api/' + path,
        'method': 'GET', 'auth': 'public', 'inputs': [{'name': name, 'location': 'query',
        'selector': name, 'consumer': consumer, 'test_families': [family]}]})
    started = v2api.campaign_start(project, {'model': 'v2'})
    campaign_id = started['campaign']['id']
    prepared = v2api.campaign_next(project, {'campaign_id': campaign_id})
    recipe_id = prepared['recipes'][0]['recipe']['id']
    result = v2api.test_run(project, {'campaign_id': campaign_id, 'recipe_id': recipe_id,
                                    'mode': 'test', 'idempotency_key': 'audit-' + path})
    return operation, campaign_id, result

results = {}
with patch('awa_ddd.engine.request', capture), \
     patch('socket.create_connection', side_effect=AssertionError('Audit forbids sockets')), \
     patch('socket.socket.connect', side_effect=AssertionError('Audit forbids sockets')), \
     patch('socket.socket.connect_ex', side_effect=AssertionError('Audit forbids sockets')), \
     patch('socket.getaddrinfo', side_effect=AssertionError('Audit forbids DNS')):
    with project_at('projection') as project:
        operation = engine.register_operation(project, {'url': 'https://audit.invalid/api/record',
            'method': 'GET', 'auth': 'public', 'ownership': True,
            'inputs': [{'name': 'record_id', 'location': 'query', 'consumer': 'lookup'}]})
        universe = campaign.build_universe(project)
        hypotheses, unused_limited = generate_hypotheses(universe)
        corrected = json.loads(json.dumps(universe))
        corrected['operations'][0]['ownership'] = operation['ownership']
        corrected_hypotheses, unused_limited = generate_hypotheses(corrected)
        results['ownership_projection'] = {
            'registered_ownership': operation['ownership'],
            'projected_ownership': operation_record(operation).get('ownership'),
            'generated_boundary_hypotheses': sum(row['security_property'] == 'principal_tenant_boundary' for row in hypotheses),
            'with_field_preserved': sum(row['security_property'] == 'principal_tenant_boundary' for row in corrected_hypotheses)}

    with project_at('origins', origins=['https://service-a.audit.invalid/api', 'https://service-b.audit.invalid/api']) as project:
        first = engine.register_operation(project, {'url': 'https://service-a.audit.invalid/api/records/7', 'method': 'GET', 'auth': 'public'})
        second = engine.register_operation(project, {'url': 'https://service-b.audit.invalid/api/records/7', 'method': 'GET', 'auth': 'public'})
        universe = campaign.build_universe(project)
        known_case = {'id': 'CASE-audit', 'family': 'sql_injection', 'mechanism': 'audit_case',
                      'method': 'GET', 'url': second['url']}
        hypotheses, unused_limited = generate_hypotheses(universe, [known_case])
        matched = next(row for row in hypotheses if row['known_case_id'] == known_case['id'])
        results['known_case_origin'] = {'mapped_to_expected_operation': matched['operation_id'] == second['id'],
            'mapped_to_first_other_origin': matched['operation_id'] == first['id'],
            'registered_operations': len(universe['operations']), 'merged_route_rows': len(universe['routes'])}

    with project_at('semantics') as project:
        engine.register_operation(project, {'url': 'https://audit.invalid/api/lookup', 'method': 'GET', 'auth': 'public',
            'inputs': [{'name': name, 'location': 'query', 'consumer': 'lookup'} for name in ('profile_id', 'candidate_id')]})
        hypotheses, unused_limited = generate_hypotheses(campaign.build_universe(project))
        results['substring_hypotheses'] = [{'family': row['family'], 'property': row['security_property'],
                                           'field': row['label']} for row in hypotheses]

    with project_at('inconclusive', mode='src') as project:
        operation, campaign_id, result = prepared_run(project, 'render', 'label', 'template_engine', 'template_injection')
        repository = Repository(project)
        current = repository.get('campaign', campaign_id)
        universe = repository.get('universe', current['universe_id'])
        selected, preparation, unused_queue = scheduler.next_hypotheses(project, current, universe)
        matrix = coverage.compute(project, campaign_id)
        results['inconclusive_scheduling'] = {'outcome': result['outcome'],
            'tested_coverage': matrix['dimensions']['hypothesis']['tested_coverage'],
            'hypothesis_coverage_status': matrix['dimensions']['hypothesis']['status'],
            'next_selected': len(selected), 'next_preparation': len(preparation),
            'unresolved_inconclusive': sum(row['count'] for row in matrix['delivery']['remaining'] if row['kind'] == 'inconclusive')}
        evidence_ids = result['run']['evidence_ids']
        reported = v2api.review_finding(project, {'hypothesis_id': result['run']['hypothesis_id'],
            'run_id': result['run']['id'], 'material': {'evidence_ids': [evidence_ids[0]]},
            'control_groups': [{'id': 'primary', 'controls': [
                {'role': 'normal', 'evidence_id': evidence_ids[0]},
                {'role': 'attack', 'evidence_id': evidence_ids[0]}]}],
            'observation': {'selector': '/value', 'expected': '49', 'actual': '49'},
            'consumer_point': {'type': 'http_json', 'url': operation['url'], 'identity_role': 'anonymous'},
            'source_trust': {'kind': 'audit', 'trust': 'declared'},
            'reviewer': {'type': 'agent_recorded', 'id': 'offline-audit', 'source': 'model-declaration'},
            'proof_scope': {'accepted': ['template_evaluation'], 'not_proven': ['code_execution']}})
        actual = json.loads(base64.b64decode(project.read_artifact(project.get('evidence', evidence_ids[0]))['response']['body_base64']))
        results['agent_review_stop'] = {'machine_proof': reported['machine_proof'],
            'reviewer_type': reported['review']['reviewer']['type'],
            'declared_observation_matches_capture': reported['review']['observation']['actual'] == actual['value'],
            'same_evidence_in_normal_and_attack': True, 'native_src_stops': len(project.list('src_stop')),
            'hypothesis_status': repository.get('hypothesis', result['run']['hypothesis_id'])['status']}

    with project_at('safe-sql', mode='src') as project:
        unused_operation, unused_campaign, result = prepared_run(project, 'search', 'query', 'sql_query', 'sql_injection')
        finding = result.get('finding')
        proof = finding_proof_state(project, finding, model='v2') if finding else {}
        results['parameterized_sql_false_positive'] = {'query_uses_bound_parameters': True,
            'outcome': result['outcome'], 'machine_finding_created': bool(finding),
            'current_machine_proof': proof.get('machine_proof'),
            'severity': finding.get('severity') if finding else None,
            'proof_scope': finding.get('proof_scope') if finding else None,
            'native_src_stops': len(project.list('src_stop'))}

    with project_at('campaigns') as project:
        def register_path(path):
            return engine.register_operation(project, {'url': 'https://audit.invalid/api/' + path,
                'method': 'GET', 'auth': 'public', 'inputs': [{'name': 'label', 'location': 'query',
                'consumer': 'plain', 'test_families': ['generic']}]})
        register_path('one')
        first = v2api.campaign_start(project, {'model': 'v2'})['campaign']['id']
        repository = Repository(project)
        first_campaign = repository.get('campaign', first)
        first_universe = repository.get('universe', first_campaign['universe_id'])
        register_path('two')
        second = v2api.campaign_start(project, {'model': 'v2', 'new_campaign': True})['campaign']['id']
        second_universe = repository.get('universe', repository.get('campaign', second)['universe_id'])
        matrix = coverage.compute(project, first)
        candidates, unused_preparation = scheduler.candidates(project, first_campaign, first_universe)
        first_operation_ids = {row['operation_id'] for row in first_universe['operations']}
        results['campaign_membership'] = {'first_frozen_operations': len(first_universe['operations']),
            'first_hypothesis_denominator_after_second_start': matrix['dimensions']['hypothesis']['denominator'],
            'foreign_operation_is_schedulable': any(row['operation_id'] not in first_operation_ids
                for family in candidates.values() for unused_score, row in family),
            'snapshot_changed': first_universe['snapshot_hash'] != second_universe['snapshot_hash'],
            'target_build_unchanged': first_universe['target_build'] == second_universe['target_build']}

    results['automatic_providers'] = [automatic_provider(family) for family in FAMILIES]
database.close()
print(json.dumps(results, ensure_ascii=False))
`

const captureProtocol = String.raw`
import base64, hashlib, json
from urllib.parse import urlsplit
from unittest.mock import patch
from awa_ddd.__main__ import main
from awa_ddd.store import now
from awa_ddd.transport import request_parts
def capture(url, method='GET', headers=None, body=None, timeout=15, max_bytes=65536):
    assert urlsplit(url).hostname == 'facade.audit.invalid' and method == 'GET'
    raw = b'{"value":"audit"}'
    actual_headers, actual_body = request_parts(url, headers or {}, body)
    return {'request': {'url': url, 'method': method, 'headers': actual_headers,
        'body_base64': base64.b64encode(actual_body or b'').decode('ascii')},
        'response': {'status': 200, 'headers': [['content-type', 'application/json']],
        'complete': True, 'length': len(raw), 'body_base64': base64.b64encode(raw).decode('ascii'),
        'body_sha256': hashlib.sha256(raw).hexdigest()}, 'started_at': now(), 'completed_at': now(),
        'complete': True, 'elapsed_ms': 0, 'transport': 'python-http-client', 'redirect_followed': False}
with patch('awa_ddd.engine.request', capture), \
     patch('socket.create_connection', side_effect=AssertionError('Audit forbids sockets')), \
     patch('socket.socket.connect', side_effect=AssertionError('Audit forbids sockets')), \
     patch('socket.socket.connect_ex', side_effect=AssertionError('Audit forbids sockets')), \
     patch('socket.getaddrinfo', side_effect=AssertionError('Audit forbids DNS')):
    raise SystemExit(main())
`

let store
try {
  const { stdout } = await executeFile(pythonExecutable, ['-E', '-s', '-X', 'utf8', '-B', '-c', nativeAudit, fixtureRoot],
    { cwd: engineRoot, shell: false, windowsHide: true, encoding: 'utf8', timeout: 30000, maxBuffer: 256 * 1024 })
  const nativeResults = JSON.parse(stdout)
  store = new RedteamStore(join(fixtureRoot, 'facade-state'))
  saveAwaSettings(store.root, { pythonExecutable, timeoutMs: 15000, assessmentModel: 'v1' })
  const engagement = store.openEngagement('offline mode audit', ['https://facade.audit.invalid/api'],
    { assessment_mode: 'pentest', exclude: [], bindCurrent: false }).id
  const invocations = []
  const options = { invokeEngine(config, action, input, { signal } = {}) {
    invocations.push(action)
    return embeddedAssessmentBridge.invokeEngine(config, action, input, { signal,
      spawnProcess(executable, argumentsList, processOptions) {
        const moduleIndex = argumentsList.indexOf('-m')
        assert.equal(argumentsList[moduleIndex + 1], 'awa_ddd')
        assert.equal(processOptions.cwd, engineRoot)
        assert.equal(processOptions.shell, false)
        return spawn(executable, [...argumentsList.slice(0, moduleIndex), '-c', captureProtocol,
          ...argumentsList.slice(moduleIndex + 2)], processOptions)
      } })
  } }
  const registered = await assessmentRun(store, engagement, 'surface.register',
    { url: 'https://facade.audit.invalid/api/capture', method: 'GET', auth: 'public' }, options)
  const requests = ['audit-first', 'audit-second'].map(idempotencyKey => ({ operation_id: registered.data.id,
    idempotency_key: idempotencyKey }))
  invocations.length = 0
  const started = performance.now()
  const batch = await assessmentRun(store, engagement, 'http.capture_batch', { requests }, options)
  const elapsedMs = performance.now() - started
  const invocationCounts = Object.fromEntries([...new Set(invocations)].map(action =>
    [action, invocations.filter(value => value === action).length]))
  const repeated = await assessmentRun(store, engagement, 'http.capture_batch', { requests }, options)
  console.log(JSON.stringify({ schema: 'dsh-purge-three-mode-audit/v1', package_version: packageVersion,
    isolation: { synthetic_transport: true, target_network_disabled: true, temporary_state_only: true },
    native: nativeResults, facade_batch: { items: requests.length, native_invocations: Object.values(invocationCounts).reduce((total, count) => total + count, 0),
      invocation_counts: invocationCounts, elapsed_ms: Math.round(elapsedMs),
      repeated_evidence_ids_reused: batch.data.results.every((row, index) => row.evidence_id === repeated.data.results[index].evidence_id),
      repeated_requests_sent: repeated.requests_sent } }, null, 2))
} finally {
  store?.close()
  const resolvedRoot = resolve(fixtureRoot)
  const relativeRoot = relative(temporaryParent, resolvedRoot)
  assert(relativeRoot && !isAbsolute(relativeRoot) && relativeRoot !== '..' && !relativeRoot.startsWith('..\\')
    && !relativeRoot.startsWith('../') && basename(resolvedRoot).startsWith('purge-three-mode-audit-'))
  assert.equal(realpathSync(resolvedRoot), resolvedRoot)
  removeTreeNoFollowSync(resolvedRoot)
}
