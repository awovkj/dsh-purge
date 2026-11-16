import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtempSync, realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, isAbsolute, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { defaultPythonExecutable } from '../lib/redteam/native-assessment.js'
import { removeTreeNoFollowSync } from '../lib/remove-tree.js'

const executeFile = promisify(execFile)
const engineRoot = fileURLToPath(new URL('../lib/redteam/assessment-engine/', import.meta.url))
const cases = String.raw`
import base64, hashlib, json, sqlite3, sys
from pathlib import Path
from urllib.parse import parse_qs, urlsplit
from unittest.mock import patch
from awa_ddd import engine, v2api
from awa_ddd.domain.repository import Repository
from awa_ddd.execution.recipe_builder import PAYLOADS
from awa_ddd.planning import campaign, coverage, scheduler
from awa_ddd.planning.hypotheses import generate_hypotheses
from awa_ddd.proof_claim import finding_proof_state
from awa_ddd.store import Project, EngineError, now
from awa_ddd.transport import request_parts

root = Path(sys.argv[1])
database = sqlite3.connect(':memory:')
database.execute('CREATE TABLE records (label TEXT NOT NULL)')
database.executemany('INSERT INTO records(label) VALUES (?)', [('alpha',), ('alpha',), (PAYLOADS['sql_injection'][1],), (PAYLOADS['sql_injection'][1],)])
behavior = 'secure'

def project_at(name, mode='src', scopes=None):
    scopes = scopes or ['https://truth.invalid/api']
    project = Project(root / name, 'assessment', create=True)
    project.set_config({'project_id': 'assessment', 'target': scopes[0], 'scope': scopes, 'exclude': [],
                        'allow_mutation': False, 'assessment_mode': mode, 'assessment_model': 'v2', 'coverage_policy': 'subject'})
    return project

def capture(url, method='GET', headers=None, body=None, timeout=15, max_bytes=65536):
    parsed = urlsplit(url)
    assert parsed.hostname == 'truth.invalid' and method == 'GET'
    values = parse_qs(parsed.query)
    value = values.get('query', values.get('label', ['']))[0]
    if parsed.path.endswith('/search'):
        if behavior == 'vulnerable':
            count = database.execute("SELECT COUNT(*) FROM records WHERE label = '" + value + "'").fetchone()[0]
        else:
            count = database.execute('SELECT COUNT(*) FROM records WHERE label = ?', (value,)).fetchone()[0]
        document = {'count': count}
    elif behavior == 'template':
        document = {'value': {'{{13*17}}': '221', '{{19*23}}': '437'}.get(value, value)}
    elif behavior == 'calculator':
        document = {'value': '221' if value == '13*17' else value}
    else:
        document = {'value': value, 'count': 1 if value == 'AWA-ATTACK' else 0}
    raw = json.dumps(document, separators=(',', ':')).encode('utf-8')
    actual_headers, actual_body = request_parts(url, headers or {}, body)
    return {'request': {'url': url, 'method': method, 'headers': actual_headers,
                        'body_base64': base64.b64encode(actual_body or b'').decode('ascii')},
            'response': {'status': 200, 'headers': [['content-type', 'application/json']], 'complete': True,
                         'length': len(raw), 'body_base64': base64.b64encode(raw).decode('ascii'),
                         'body_sha256': hashlib.sha256(raw).hexdigest()},
            'started_at': now(), 'completed_at': now(), 'complete': True, 'elapsed_ms': 0,
            'transport': 'python-http-client', 'redirect_followed': False,
            'dispatch_attempts': 1, 'requests_sent': 1, 'responses_received': 1, 'synthetic_dispatch_fixture': True}

def run_family(project, family, path, contract):
    name = 'query' if family == 'sql_injection' else 'label'
    operation = engine.register_operation(project, {'url': 'https://truth.invalid/api/' + path,
        'method': 'GET', 'auth': 'public', 'inputs': [{'name': name, 'location': 'query',
        'consumer': 'sql_query' if family == 'sql_injection' else 'template_engine' if family == 'template_injection' else 'plain',
        'test_families': [family], 'test_contract': contract}]})
    if family == 'sql_injection':
        baseline = engine.capture(project, {'operation_id': operation['id'], 'url': operation['url'] + '?query=alpha',
                                           'idempotency_key': 'actual-baseline', 'effect': 'read_only'})
        operation = engine.register_operation(project, {'url': operation['url'], 'method': 'GET', 'auth': 'public',
            'inputs': [{**operation['inputs'][0], 'test_contract': {**contract, 'baseline_evidence_id': baseline['id']}}]})
    started = v2api.campaign_start(project, {'model': 'v2'})
    campaign_id = started['campaign']['id']
    prepared = v2api.campaign_next(project, {'campaign_id': campaign_id, 'limit': 1})
    assert prepared['recipes'], prepared
    recipe_id = prepared['recipes'][0]['recipe']['id']
    result = v2api.test_run(project, {'campaign_id': campaign_id, 'recipe_id': recipe_id,
                                    'idempotency_key': 'truth-' + path})
    return operation, campaign_id, result

results = {}
with patch('awa_ddd.engine.request', capture), \
     patch('socket.create_connection', side_effect=AssertionError('No target sockets')), \
     patch('socket.getaddrinfo', side_effect=AssertionError('No target DNS')):
    for selected in ('secure', 'vulnerable'):
        behavior = selected
        with project_at('sql-' + selected) as project:
            operation, campaign_id, result = run_family(project, 'sql_injection', 'search',
                {'response_selector': '/count', 'sql_context': 'quoted_string_equality'})
            finding = result.get('finding')
            proof = finding_proof_state(project, finding, model='v2') if finding else {}
            results['sql_' + selected] = {'outcome': result['outcome'], 'finding': bool(finding),
                                          'proof': proof.get('machine_proof', False), 'stops': len(project.list('src_stop'))}
            reviewed = v2api.test_run(project, {'campaign_id': campaign_id, 'hypothesis_id': result['run']['hypothesis_id'],
                'mode': 'verify', 'evidence_ids': Repository(project).get('run', result['run']['id'])['evidence_ids']})
            results['verify_' + selected] = {'outcome': reviewed['outcome'], 'requests_sent': reviewed['requests_sent']}
            project.put('run', {'id': 'RUN-unrelated-inventory', 'adapter': 'yakit', 'action': 'probe', 'status': 'succeeded', 'kind': 'external_tool'})
            measured = coverage.compute(project, campaign_id)['tool_yield']
            results['cost_' + selected] = {'requests': measured['measured_http_requests'], 'findings': measured['findings'],
                'http_calls': measured['calls']['http'], 'yakit_calls': measured['calls']['yakit'],
                'inventory_yakit_calls': measured['project_inventory_calls']['yakit'], 'tokens': measured['tokens'],
                'all_known': measured['all_target_requests_known'], 'elapsed_positive': measured['measured_execution_ms'] > 0}
            saved = Repository(project).get('run', result['run']['id'])
            saved.pop('execution_receipt')
            Repository(project).save('run', saved)
            missing_cost = coverage.compute(project, campaign_id)['tool_yield']
            results['missing_cost_' + selected] = {'requests': missing_cost['measured_http_requests'], 'tokens': missing_cost['tokens'],
                'all_known': missing_cost['all_target_requests_known']}
    for selected in ('secure', 'calculator', 'template'):
        behavior = selected
        with project_at('expression-' + selected) as project:
            operation, campaign_id, result = run_family(project, 'template_injection', 'render',
                {'response_selector': '/value', 'template_dialect': 'jinja_expression'})
            results['expression_' + selected] = {'outcome': result['outcome'], 'finding': bool(result.get('finding')),
                                                'stops': len(project.list('src_stop'))}
            if selected != 'secure':
                continue
            ids = result['run']['evidence_ids']
            repository = Repository(project)
            hypothesis_id = result['run']['hypothesis_id']
            draft = {'hypothesis_id': hypothesis_id, 'run_id': result['run']['id'],
                'control_groups': [{'id': 'primary', 'controls': [{'role': 'normal', 'evidence_id': ids[0]},
                                                                {'role': 'attack', 'evidence_id': ids[1]}]}],
                'material': {'evidence_ids': ids[:2]},
                'observation': {'selector': '/value', 'expected': '221', 'actual': '{{13*17}}'},
                'consumer_point': {'type': 'http_json', 'url': operation['url'], 'identity_role': 'anonymous'},
                'source_trust': {'kind': 'model', 'trust': 'declared'},
                'reviewer': {'type': 'human_independent', 'id': 'self-declared', 'source': 'model'},
                'proof_scope': {'accepted': ['template_evaluation'], 'not_proven': ['code_execution']}}
            accepted = v2api.review_finding(project, draft)
            results['review_draft'] = {'detection': accepted['detection'], 'independent': accepted['reviewer_independent'],
                'hypothesis_status': repository.get('hypothesis', hypothesis_id)['status'], 'stops': len(project.list('src_stop'))}
            invalid = json.loads(json.dumps(draft))
            invalid['control_groups'][0]['controls'][1]['evidence_id'] = ids[0]
            try:
                v2api.review_finding(project, invalid)
                raise AssertionError('Duplicate controls accepted')
            except EngineError as error:
                results['duplicate_controls_rejected'] = error.code
            invalid = json.loads(json.dumps(draft))
            invalid['observation']['actual'] = '221'
            try:
                v2api.review_finding(project, invalid)
                raise AssertionError('Invented observation accepted')
            except EngineError as error:
                results['invented_actual_rejected'] = error.code
            matrix = coverage.compute(project, campaign_id)
            selected_rows, preparation, queue = scheduler.next_hypotheses(project,
                repository.get('campaign', campaign_id), repository.get('universe', matrix['campaign']['universe_id']))
            results['recovery'] = {'attempted': matrix['dimensions']['hypothesis']['attempted'],
                                   'conclusive': matrix['dimensions']['hypothesis']['conclusive'],
                                   'coverage_status': matrix['dimensions']['hypothesis']['status'],
                                   'offline_recovery': bool(matrix['recovery']), 'preparation': len(preparation)}
            later = v2api.campaign_start(project, {'model': 'v2', 'new_campaign': True})['campaign']['id']
            ambiguous = False
            try:
                v2api.review_disposition(project, {'hypothesis_id': hypothesis_id, 'status': 'blocked',
                    'prerequisite': 'Actual input consumer still requires inspection', 'missing_context': ['actual_input_consumer']})
            except EngineError as error:
                ambiguous = error.code == 'v2_review_disposition'
            assert ambiguous
            v2api.review_disposition(project, {'campaign_id': later, 'hypothesis_id': hypothesis_id, 'status': 'blocked',
                'prerequisite': 'Only this campaign records this preparation', 'missing_context': ['actual_input_consumer']})
            old_view = v2api.recon_hypotheses(project, {'campaign_id': campaign_id})['items'][0]
            new_view = v2api.recon_hypotheses(project, {'campaign_id': later})['items'][0]
            results['local_state'] = {'old': old_view['status'], 'new': new_view['status'], 'ambiguous_rejected': ambiguous,
                'old_attempted': coverage.compute(project, campaign_id)['dimensions']['hypothesis']['attempted'],
                'new_attempted': coverage.compute(project, later)['dimensions']['hypothesis']['attempted'],
                'new_findings': coverage.compute(project, later)['finding_summary']['current_total']}
    with project_at('na-review', mode='assessment') as project:
        behavior = 'secure'
        operation = engine.register_operation(project, {'url': 'https://truth.invalid/api/note', 'method': 'GET', 'auth': 'public',
            'inputs': [{'name': 'label', 'location': 'query', 'consumer': 'plain', 'test_families': ['generic']}]})
        material = engine.capture(project, {'operation_id': operation['id'], 'idempotency_key': 'na-source'})
        campaign_id = v2api.campaign_start(project, {'model': 'v2'})['campaign']['id']
        before = coverage.compute(project, campaign_id)['dimensions']['hypothesis']['denominator']
        hypothesis_id = v2api.recon_hypotheses(project, {'campaign_id': campaign_id})['items'][0]['id']
        other = engine.register_operation(project, {'url': 'https://truth.invalid/api/other', 'method': 'GET', 'auth': 'public'})
        unrelated = engine.capture(project, {'operation_id': other['id'], 'idempotency_key': 'unrelated-na-source'})
        try:
            v2api.review_disposition(project, {'campaign_id': campaign_id, 'hypothesis_id': hypothesis_id, 'status': 'not_applicable',
                'applicability_basis': {'business_fact': 'This is an unverified business interpretation'}, 'evidence_ids': [unrelated['id']]})
            raise AssertionError('Wrong-operation N/A material accepted')
        except EngineError as error:
            assert error.code == 'v2_review_disposition'
        disposition = v2api.review_disposition(project, {'campaign_id': campaign_id, 'hypothesis_id': hypothesis_id, 'status': 'not_applicable',
            'applicability_basis': {'business_fact': 'This is an unverified business interpretation'}, 'evidence_ids': [material['id']]})
        matrix = coverage.compute(project, campaign_id)
        selected, preparation, queue = scheduler.next_hypotheses(project, Repository(project).get('campaign', campaign_id),
            Repository(project).get('universe', matrix['campaign']['universe_id']))
        results['na_review'] = {'denominator_retained': matrix['dimensions']['hypothesis']['denominator'] == before,
            'tested': matrix['dimensions']['hypothesis']['conclusive'], 'exhausted': matrix['delivery']['exhausted_authority'],
            'unverified_gap': any(row['kind'] == 'unverified_applicability' for row in matrix['delivery']['remaining']),
            'offline_preparation': any(row['reason'] == 'unverified_applicability' and row['offline_only'] for row in preparation),
            'can_exclude': disposition['can_exclude']}
    with project_at('projection', mode='assessment', scopes=['https://a.truth.invalid/api', 'https://b.truth.invalid/api']) as project:
        first = engine.register_operation(project, {'url': 'https://a.truth.invalid/api/records/7', 'method': 'GET',
            'auth': 'public', 'ownership': True, 'inputs': [{'name': 'profile_id', 'location': 'query', 'consumer': 'lookup'}]})
        second = engine.register_operation(project, {'url': 'https://b.truth.invalid/api/records/7', 'method': 'GET', 'auth': 'public'})
        universe = campaign.build_universe(project)
        hypotheses, limited = generate_hypotheses(universe, [{'id': 'CASE-truth', 'family': 'sql_injection',
            'method': 'GET', 'url': second['url'], 'mechanism': 'sql'}])
        case = next(row for row in hypotheses if row.get('known_case_id') == 'CASE-truth')
        results['projection'] = {'ownership': universe['operations'][0]['ownership'], 'routes': len(universe['routes']),
            'correct_origin': case['operation_id'] == second['id'],
            'ownership_tasks': sum(row['security_property'] == 'principal_tenant_boundary' for row in hypotheses),
            'false_upload_tasks': sum(row['family'] == 'file_upload' for row in hypotheses), 'target_build': universe['target_build']}
        bound_cases, unused_limited = generate_hypotheses(universe, [{'id': identity, 'family': 'generic', 'method': 'GET',
            'url': first['url'], 'mechanism': 'generic_property', 'params': [{'name': 'profile_id', 'location': 'query', 'selector': 'profile_id'}]}
            for identity in ('KC-one', 'KC-two')])
        bound_cases = [row for row in bound_cases if row.get('known_case_id')]
        results['known_case_inputs'] = {'count': len(bound_cases), 'unique': len({row['id'] for row in bound_cases}),
            'all_bound': all(row['input_key'] == universe['operations'][0]['inputs'][0]['input_key'] and row['status'] == 'ready' for row in bound_cases)}
        before = v2api.campaign_start(project, {'model': 'v2'})['campaign']['id']
        prior_total = coverage.compute(project, before)['dimensions']['hypothesis']['denominator']
        engine.register_operation(project, {'url': 'https://a.truth.invalid/api/third', 'method': 'GET', 'auth': 'public',
            'inputs': [{'name': 'label', 'location': 'query', 'consumer': 'plain', 'test_families': ['generic']}]})
        newer = v2api.campaign_start(project, {'model': 'v2', 'new_campaign': True})['campaign']['id']
        after_total = coverage.compute(project, before)['dimensions']['hypothesis']['denominator']
        results['membership'] = {'before': prior_total, 'after': after_total,
                                 'new_total': coverage.compute(project, newer)['dimensions']['hypothesis']['denominator']}
database.close()
print(json.dumps(results))
`

const authorizationCases = String.raw`
import base64, hashlib, json, sys
from pathlib import Path
from urllib.parse import urlsplit
from unittest.mock import patch
from awa_ddd import engine, v2api
from awa_ddd.domain.repository import Repository
from awa_ddd.proof_claim import finding_proof_state
from awa_ddd.store import Project, EngineError, now
from awa_ddd.transport import request_parts

root = Path(sys.argv[1])
behavior = 'secure'

def capture(url, method='GET', headers=None, body=None, timeout=15, max_bytes=65536):
    assert urlsplit(url).hostname == 'truth.invalid' and method == 'GET'
    token = (headers or {}).get('authorization', '').removeprefix('Bearer ')
    if urlsplit(url).path.endswith('/profile'):
        document, status = {'subject': token, 'roles': ['admin'] if token == 'allowed' else []}, 200
    elif token == 'allowed' or behavior == 'vulnerable':
        document, status = {'resource_id': '7', 'owner': 'allowed', 'protected': {'secret': 'owned-test-value'}}, 200
    elif behavior == 'data_in_denial':
        document, status = {'protected': {'secret': 'owned-test-value'}}, 403
    elif behavior == 'unrelated':
        document, status = {'protected': {'public': True}}, 200
    else:
        document, status = {'error': 'denied'}, 403
    raw = json.dumps(document, separators=(',', ':')).encode()
    actual_headers, actual_body = request_parts(url, headers or {}, body)
    return {'request': {'url': url, 'method': method, 'headers': actual_headers,
                        'body_base64': base64.b64encode(actual_body or b'').decode()},
            'response': {'status': status, 'headers': [['content-type', 'application/json']], 'complete': True,
                         'length': len(raw), 'body_base64': base64.b64encode(raw).decode(),
                         'body_sha256': hashlib.sha256(raw).hexdigest()},
            'started_at': now(), 'completed_at': now(), 'complete': True, 'elapsed_ms': 0,
            'transport': 'python-http-client', 'redirect_followed': False}

def prepare(project, property_name, *, roles_verified=True, wrong_owner=False):
    profile = engine.register_operation(project, {'url': 'https://truth.invalid/api/profile', 'method': 'GET', 'auth': 'public'})
    sessions = {}
    for token in ('allowed', 'forbidden'):
        actor = engine.add_actor(project, {'actor_id': 'A-' + token, 'subject': token,
                                           'roles': ['admin'] if token == 'allowed' else []})
        session = engine.add_session(project, {'actor_id': actor['id'], 'headers': {'Authorization': 'Bearer ' + token},
                                               'origin_url': profile['url']})
        engine.verify_identity(project, {'operation_id': profile['id'], 'session_id': session['id'],
            'subject_selector': '/subject', **({'roles_selector': '/roles'} if roles_verified or token == 'allowed' else {})})
        sessions[token] = session['id']
    owned = property_name == 'principal_tenant_boundary'
    operation = engine.register_operation(project, {'url': 'https://truth.invalid/api/records/{record}' if owned else
        'https://truth.invalid/api/records/7', 'method': 'GET', 'auth': 'restricted' if property_name == 'role_authorization' else 'authenticated',
        'allowed_roles': ['admin'] if property_name == 'role_authorization' else [], 'ownership': owned,
        'authorization_contract': {'protected_selector': '/protected', **({'resource_selector': '/resource_id',
                                                                          'owner_selector': '/owner'} if owned else {})}})
    resource = engine.add_resource(project, {'operation_id': operation['id'], 'owner_actor_id': 'A-allowed',
        'external_id': '7', 'request_binding': {'location': 'path', 'selector': 'record'}}) if owned else None
    if wrong_owner:
        resource['external_id'] = '8'
        project.put('resource', resource)
    engine.capture(project, {'operation_id': operation['id'], 'url': 'https://truth.invalid/api/records/7',
                            'session_id': sessions['allowed'], 'idempotency_key': 'object-baseline',
                            **({'resource_id': resource['id']} if resource and not wrong_owner else {})})
    campaign = v2api.campaign_start(project, {'model': 'v2'})['campaign']['id']
    prepared = v2api.campaign_next(project, {'campaign_id': campaign, 'limit': 25})
    selected = next((row for row in prepared['recipes'] if row['hypothesis']['security_property'] == property_name), None)
    return campaign, selected, prepared

results = {}
with patch('awa_ddd.engine.request', capture), patch('socket.create_connection', side_effect=AssertionError('No target sockets')), \
     patch('socket.getaddrinfo', side_effect=AssertionError('No target DNS')):
    for property_name in ('authentication_enforcement', 'role_authorization', 'principal_tenant_boundary'):
        for selected_behavior in ('secure', 'vulnerable', 'unrelated', 'data_in_denial'):
            behavior = selected_behavior
            with Project(root / (property_name + '-' + behavior), 'assessment', create=True) as project:
                project.set_config({'project_id': 'assessment', 'target': 'https://truth.invalid/api', 'scope': ['https://truth.invalid/api'],
                    'exclude': [], 'assessment_mode': 'assessment', 'assessment_model': 'v2', 'allow_mutation': False})
                campaign, selected, prepared = prepare(project, property_name)
                assert selected, prepared
                result = v2api.test_run(project, {'campaign_id': campaign, 'recipe_id': selected['recipe']['id'],
                                                 'idempotency_key': 'authorization-truth'})
                finding = result.get('finding')
                results[property_name + '-' + behavior] = {'outcome': result['outcome'], 'finding': bool(finding),
                    'current_proof': finding_proof_state(project, finding, model='v2')['machine_proof'] if finding else False}
    for name, options in [('unknown_roles', {'roles_verified': False}), ('wrong_resource', {'wrong_owner': True})]:
        behavior = 'secure'
        with Project(root / name, 'assessment', create=True) as project:
            project.set_config({'project_id': 'assessment', 'target': 'https://truth.invalid/api', 'scope': ['https://truth.invalid/api'],
                'exclude': [], 'assessment_mode': 'assessment', 'assessment_model': 'v2', 'allow_mutation': False})
            campaign, selected, prepared = prepare(project, 'role_authorization' if name == 'unknown_roles' else
                                                    'principal_tenant_boundary', **options)
            results[name] = {'ready': bool(selected), 'blocked': bool(prepared['preparation'])}
print(json.dumps(results))
`

const browserCases = String.raw`
import base64, hashlib, html, json, re, sys
from pathlib import Path
from urllib.parse import parse_qs, urlsplit
from unittest.mock import patch
from awa_ddd import browser, engine, v2api
from awa_ddd.execution import capabilities
from awa_ddd.proof_claim import finding_proof_state
from awa_ddd.store import Project, EngineError, now
from awa_ddd.transport import request_parts

root = Path(sys.argv[1])
behavior = 'secure'

def capture(url, method='GET', headers=None, body=None, timeout=15, max_bytes=65536):
    assert urlsplit(url).hostname == 'truth.invalid' and method == 'GET'
    value = parse_qs(urlsplit(url).query).get('label', ['normal'])[0]
    rendered = value if behavior != 'secure' else html.escape(value)
    raw = ('<html><body>' + rendered + '</body></html>').encode()
    actual_headers, actual_body = request_parts(url, headers or {}, body)
    return {'request': {'url': url, 'method': method, 'headers': actual_headers,
                        'body_base64': base64.b64encode(actual_body or b'').decode()},
            'response': {'status': 200, 'headers': [['content-type', 'text/html']], 'complete': True,
                         'length': len(raw), 'body_base64': base64.b64encode(raw).decode(),
                         'body_sha256': hashlib.sha256(raw).hexdigest()},
            'started_at': now(), 'completed_at': now(), 'complete': True, 'elapsed_ms': 0,
            'transport': 'python-http-client', 'redirect_followed': False}

def observe(project, args):
    actual = capture(args['url'], headers=args.get('headers'))
    value = parse_qs(urlsplit(args['url']).query)['label'][0]
    marker = re.search(r'AWA-XSS-[a-f0-9]{32}', value).group()
    dialogs = []
    if behavior == 'alert_all' or behavior != 'secure' and value.startswith('<svg'):
        dialogs = [{'type': 'alert', 'message': marker if behavior != 'substring' else 'prefix-' + marker,
                    'document_url': args['url'] if behavior != 'wrong_page' else 'https://truth.invalid/api/other',
                    'action_index': None}]
    raw = {'url': args['url'], 'finalUrl': args['url'], 'status': 200, 'signals': {'textLength': 42},
           'actions': [], 'dialogs': dialogs, 'blocked_requests': [], 'write_requests': [], 'write_authorized': False,
           'started_at': now(), 'completed_at': now(), 'network': [{'url': args['url'], 'method': 'GET', 'type': 'document',
             'request_headers': actual['request']['headers'], 'request_body_bytes': 0,
             'request_body_sha256': hashlib.sha256(b'').hexdigest(), 'status': 200, 'response_body_complete': True,
             'response_body_bytes': actual['response']['length'], 'response_body_sha256': actual['response']['body_sha256']
              if behavior != 'wrong_content' else '0' * 64}]}
    result = browser._record_observation(project, raw, project.id('PV'), 'local_playwright')
    return {**result, 'run_status': 'succeeded'}

results = {}
with patch('awa_ddd.engine.request', capture), patch('awa_ddd.browser.visit', observe), \
     patch('awa_ddd.browser.available', return_value={'available': True, 'node': 'fixture-node', 'module_path': 'fixture-module'}), \
     patch('socket.create_connection', side_effect=AssertionError('No target sockets')), \
     patch('socket.getaddrinfo', side_effect=AssertionError('No target DNS')):
    for selected in ('secure', 'vulnerable', 'alert_all', 'substring', 'wrong_page', 'wrong_content'):
        behavior = selected
        with Project(root / selected, 'assessment', create=True) as project:
            project.set_config({'project_id': 'assessment', 'target': 'https://truth.invalid/api', 'scope': ['https://truth.invalid/api'],
                'exclude': [], 'assessment_mode': 'src', 'assessment_model': 'v2', 'allow_mutation': False})
            capabilities.record(project, 'playwright', installed=True, configured=True, catalog_verified=True,
                                profile_supported=True, authorized=True, evidence={'available': True})
            operation = engine.register_operation(project, {'url': 'https://truth.invalid/api/render', 'method': 'GET', 'auth': 'public',
                'inputs': [{'name': 'label', 'location': 'query', 'consumer': 'html_rendering', 'test_families': ['xss']}]})
            baseline = engine.capture(project, {'operation_id': operation['id'], 'url': operation['url'] + '?label=baseline',
                                               'idempotency_key': 'html-baseline'})
            operation = engine.register_operation(project, {'url': operation['url'], 'method': 'GET', 'auth': 'public',
                'inputs': [{**operation['inputs'][0], 'test_contract': {'xss_context': 'html_markup', 'baseline_evidence_id': baseline['id']}}]})
            campaign = v2api.campaign_start(project, {'model': 'v2'})['campaign']['id']
            prepared = v2api.campaign_next(project, {'campaign_id': campaign, 'limit': 1})
            assert prepared['recipes'], prepared
            try:
                result = v2api.test_run_browser(project, {'campaign_id': campaign, 'recipe_id': prepared['recipes'][0]['recipe']['id'],
                    'idempotency_key': 'browser-truth'})
                finding = result.get('finding')
                current = finding_proof_state(project, finding, model='v2')['machine_proof'] if finding else False
                results[selected] = {'outcome': result['outcome'], 'finding': bool(finding), 'current': current,
                                     'stops': len(project.list('src_stop')), 'visits': len(result['run']['browser_visit_ids'])}
                if finding:
                    checked = v2api.test_run_browser(project, {'campaign_id': campaign, 'run_id': result['run']['id'], 'mode': 'verify'})
                    assert checked['outcome'] == 'supported' and checked['requests_sent'] == 0
            except EngineError as error:
                results[selected] = {'error': error.code, 'finding': bool(project.list('v2_finding')), 'stops': len(project.list('src_stop'))}
    with Project(root / 'loose', 'assessment', create=True) as project:
        project.set_config({'project_id': 'assessment', 'target': 'https://truth.invalid/api', 'scope': ['https://truth.invalid/api'],
                            'exclude': [], 'assessment_mode': 'src', 'assessment_model': 'v2'})
        loose = v2api.test_run_browser(project, {'mode': 'xss_evaluate', 'consumer_url': 'https://truth.invalid/api/render',
            'marker': 'AWA-XSS-' + 'a' * 32, 'attack_visit_id': 'invented', 'normal_visit_id': 'invented',
            'writer_attack_evidence_id': 'invented', 'writer_normal_evidence_id': 'invented'})
        results['loose'] = {'outcome': loose['evaluation']['outcome'], 'finding_allowed': loose['finding_allowed']}
print(json.dumps(results))
`

const v1Cases = String.raw`
import base64, hashlib, json, sqlite3, sys
from pathlib import Path
from urllib.parse import parse_qs, urlsplit, urlencode
from unittest.mock import patch
from awa_ddd import engine
from awa_ddd.__main__ import _project_dispatch
from awa_ddd.publication import invoke
from awa_ddd.execution.input_contract import controls
from awa_ddd.proof_claim import finding_proof_state
from awa_ddd.store import Project, EngineError, now
from awa_ddd.transport import request_parts

root = Path(sys.argv[1])
database = sqlite3.connect(':memory:')
database.execute('CREATE TABLE records (label TEXT NOT NULL)')
database.executemany('INSERT INTO records(label) VALUES (?)', [('alpha',), ('alpha',), ("alpha' AND '13'='13",)])
behavior = 'secure'

def capture(url, method='GET', headers=None, body=None, timeout=15, max_bytes=65536):
    assert urlsplit(url).hostname == 'truth.invalid' and method == 'GET'
    value = parse_qs(urlsplit(url).query)['query'][0]
    count = database.execute("SELECT COUNT(*) FROM records WHERE label = '" + value + "'").fetchone()[0] if behavior == 'vulnerable' \
            else database.execute('SELECT COUNT(*) FROM records WHERE label = ?', (value,)).fetchone()[0]
    raw = json.dumps({'count': count}, separators=(',', ':')).encode()
    actual_headers, actual_body = request_parts(url, headers or {}, body)
    return {'request': {'url': url, 'method': method, 'headers': actual_headers, 'body_base64': ''},
            'response': {'status': 200, 'headers': [['content-type', 'application/json']], 'complete': True,
                         'length': len(raw), 'body_base64': base64.b64encode(raw).decode(), 'body_sha256': hashlib.sha256(raw).hexdigest()},
            'started_at': now(), 'completed_at': now(), 'complete': True, 'elapsed_ms': 0,
            'transport': 'python-http-client', 'redirect_followed': False}

results = {}
with patch('awa_ddd.engine.request', capture), patch('socket.create_connection', side_effect=AssertionError('No target sockets')):
    for mode in ('src', 'assessment'):
        for selected in ('secure', 'vulnerable'):
            behavior = selected
            with Project(root / (mode + '-' + selected), 'assessment', create=True) as project:
                project.set_config({'project_id': 'assessment', 'target': 'https://truth.invalid/api/',
                    'scope': ['https://truth.invalid/api/'], 'exclude': [], 'allow_mutation': False,
                    'assessment_mode': mode, 'assessment_model': 'v1', 'coverage_policy': 'subject'})
                def call(action, args):
                    try:
                        return {'ok': True, 'data': invoke(project, action, {'project_id': 'assessment', **args}, _project_dispatch)}
                    except EngineError as error:
                        return {'ok': False, 'error': error.code}
                operation = engine.register_operation(project, {'url': 'https://truth.invalid/api/search', 'method': 'GET', 'auth': 'public',
                    'inputs': [{'name': 'query', 'location': 'query', 'consumer': 'sql_query', 'test_families': ['sql_injection']}]})
                baseline = engine.capture(project, {'operation_id': operation['id'], 'url': operation['url'] + '?query=alpha',
                    'effect': 'read_only', 'idempotency_key': 'real-baseline'})
                selector = 'json:/count' if mode == 'assessment' else '/count'
                operation = engine.register_operation(project, {**operation, 'inputs': [{**operation['inputs'][0],
                    'test_contract': {'response_selector': selector, 'sql_context': 'quoted_string_equality', 'baseline_evidence_id': baseline['id']}}]})
                engine.build_plan(project)
                obligation = next(row for row in project.list('obligation') if row.get('test_family') == 'sql_injection')
                prepared = call('assessment.prepare', {'obligation_id': obligation['id']})
                values, oracle, unused_request = controls(project, operation, operation['inputs'][0], 'sql_injection', None)
                ids = [engine.capture(project, {'operation_id': operation['id'], 'url': operation['url'] + '?' + urlencode({'query': value}),
                    'effect': 'read_only', 'idempotency_key': 'fixed-' + label})['id'] for label, role, value in values]
                input_args = {'obligation_id': obligation['id'], 'evidence_ids': ids, 'oracle': {'type': 'sql_boolean', 'selector': selector, 'test_family': 'sql_injection'}}
                weak = call('assessment.evaluate', {**input_args, 'evidence_ids': ids[:3]})
                assert weak['ok'] is False
                reordered = call('assessment.evaluate', {**input_args, 'evidence_ids': [ids[0], ids[2], ids[1], *ids[3:]]})
                assert reordered['ok'] is False
                result = call('assessment.evaluate', input_args)
                assert result['ok'], result
                decision = project.list('decision')[-1]
                finding = None
                if decision['outcome'] == 'confirmed':
                    recorded = call('finding.record', {'decision_id': decision['id'], 'title': 'Model claims domain control',
                        'category': 'sql_injection', 'impact': 'Model claims all databases', 'severity': 'critical', 'remediation': 'Parameterize query'})
                    assert recorded['ok'], recorded
                    finding = project.list('finding')[-1]
                results[mode + '-' + selected] = {'outcome': decision['outcome'], 'proof': bool(finding and finding_proof_state(project, finding)['machine_proof']),
                    'severity': finding.get('severity') if finding else None, 'stops': len(project.list('src_stop')),
                    'weak_rejected': True, 'reordered_rejected': True, 'prepared': prepared['ok']}
database.close()
print(json.dumps(results))
`

async function executeCases(t, source) {
  const parent = realpathSync(tmpdir())
  const temporary = mkdtempSync(join(parent, 'purge-optimization-truth-'))
  t.after(() => {
    const target = resolve(temporary)
    const inside = relative(parent, target)
    assert(inside && !isAbsolute(inside) && !inside.startsWith('..') && basename(target).startsWith('purge-optimization-truth-'))
    removeTreeNoFollowSync(target)
  })
  try {
    const { stdout } = await executeFile(defaultPythonExecutable(), ['-E', '-s', '-X', 'utf8', '-B', '-c', source, temporary],
      { cwd: engineRoot, shell: false, windowsHide: true, encoding: 'utf8', timeout: 30000, maxBuffer: 256 * 1024 })
    return JSON.parse(stdout)
  } catch (error) {
    throw new Error(error.stderr || String(error.code))
  }
}

test('paired security truth, review authority, campaign isolation and recovery survive the embedded public API', async t => {
  const result = await executeCases(t, cases)
  assert.deepEqual(result.sql_secure, { outcome: 'inconclusive', finding: false, proof: false, stops: 0 })
  assert.deepEqual(result.sql_vulnerable, { outcome: 'supported', finding: true, proof: true, stops: 1 })
  assert.deepEqual(result.verify_secure, { outcome: 'inconclusive', requests_sent: 0 })
  assert.deepEqual(result.verify_vulnerable, { outcome: 'supported', requests_sent: 0 })
  for (const selected of ['secure', 'vulnerable']) {
    assert.deepEqual(result['cost_' + selected], { requests: 5, findings: selected === 'vulnerable' ? 1 : 0,
      http_calls: 1, yakit_calls: 0, inventory_yakit_calls: 1, tokens: null, all_known: true, elapsed_positive: true })
    assert.deepEqual(result['missing_cost_' + selected], { requests: null, tokens: null, all_known: false })
  }
  assert.deepEqual(result.expression_secure, { outcome: 'inconclusive', finding: false, stops: 0 })
  assert.deepEqual(result.expression_calculator, { outcome: 'inconclusive', finding: false, stops: 0 })
  assert.deepEqual(result.expression_template, { outcome: 'supported', finding: true, stops: 1 })
  assert.deepEqual(result.review_draft, { detection: false, independent: false, hypothesis_status: 'inconclusive', stops: 0 })
  assert.equal(result.duplicate_controls_rejected, 'v2_review_controls')
  assert.equal(result.invented_actual_rejected, 'v2_review_observation')
  assert.deepEqual(result.recovery, { attempted: 1, conclusive: 0, coverage_status: 'gap', offline_recovery: true, preparation: 1 })
  assert.deepEqual(result.local_state, { old: 'inconclusive', new: 'blocked', ambiguous_rejected: true,
    old_attempted: 1, new_attempted: 0, new_findings: 0 })
  assert.deepEqual(result.na_review, { denominator_retained: true, tested: 0, exhausted: false,
    unverified_gap: true, offline_preparation: true, can_exclude: false })
  assert.deepEqual(result.known_case_inputs, { count: 2, unique: 2, all_bound: true })
  assert.deepEqual(result.projection, { ownership: true, routes: 2, correct_origin: true,
    ownership_tasks: 1, false_upload_tasks: 0, target_build: 'unknown' })
  assert.equal(result.membership.before, result.membership.after)
  assert(result.membership.new_total > result.membership.after)
})

test('read-only authorization distinguishes protected data from status, declared roles and wrong objects', async t => {
  const result = await executeCases(t, authorizationCases)
  for (const property of ['authentication_enforcement', 'role_authorization', 'principal_tenant_boundary']) {
    assert.deepEqual(result[property + '-secure'], { outcome: 'refuted', finding: false, current_proof: false })
    assert.deepEqual(result[property + '-vulnerable'], { outcome: 'supported', finding: true, current_proof: true })
    assert.deepEqual(result[property + '-unrelated'], { outcome: 'inconclusive', finding: false, current_proof: false })
    assert.deepEqual(result[property + '-data_in_denial'], { outcome: 'inconclusive', finding: false, current_proof: false })
  }
  assert.deepEqual(result.unknown_roles, { ready: false, blocked: true })
  assert.deepEqual(result.wrong_resource, { ready: false, blocked: true })
})

test('managed reflected-XSS closure verifies consumed bytes, exact dialogs and independent native controls', async t => {
  const result = await executeCases(t, browserCases)
  for (const negative of ['secure', 'alert_all', 'substring', 'wrong_page']) {
    assert.deepEqual(result[negative], { outcome: 'inconclusive', finding: false, current: false, stops: 0, visits: 3 })
  }
  assert.deepEqual(result.vulnerable, { outcome: 'supported', finding: true, current: true, stops: 1, visits: 3 })
  assert.deepEqual(result.wrong_content, { error: 'v2_oracle_processing', finding: false, stops: 0 })
  assert.deepEqual(result.loose, { outcome: 'inconclusive', finding_allowed: false })
})

test('the public v1 SQL contract rejects weak controls and preserves bounded current proof', async t => {
  const result = await executeCases(t, v1Cases)
  for (const mode of ['src', 'assessment']) {
    assert.deepEqual(result[mode + '-secure'], { outcome: 'inconclusive', proof: false, severity: null, stops: 0,
      weak_rejected: true, reordered_rejected: true, prepared: true })
    assert.deepEqual(result[mode + '-vulnerable'], { outcome: 'confirmed', proof: true, severity: 'medium', stops: mode === 'src' ? 1 : 0,
      weak_rejected: true, reordered_rejected: true, prepared: true })
  }
})
