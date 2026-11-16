import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { RedteamStore } from '../lib/redteam/store-core.js'
import { removeTreeNoFollowSync } from '../lib/remove-tree.js'
import { assessmentRun } from '../lib/redteam/awa-integration.js'
import { listAssessmentWorkspace, readAssessmentWorkspace } from '../lib/redteam/assessment-workspace.js'
import { importVulnerabilityIntel, searchVulnerabilityIntel, getVulnerabilityIntel, advisoryVersionStatus } from '../lib/redteam/vulnerability-intel.js'
import { analyzeSourcemapModules } from '../lib/redteam/sourcemap-graph.js'

const scope = 'https://local-material.fixture.invalid/'
const secret = 'SYNTHETIC-VAULT-SECRET-DO-NOT-PUBLISH'
const hash = value => createHash('sha256').update(value).digest('hex')
function fixture(t, mode = 'pentest') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'purge-local-discovery-'))
  const store = new RedteamStore(root)
  const id = store.openEngagement('local-only fixture', [scope], {
    assessment_mode: mode, exclude: [scope + 'excluded'], bindCurrent: false,
  }).id
  const base = store.dirOf(id)
  t.after(() => {
    store.close()
    assert.equal(path.dirname(path.resolve(root)), path.resolve(os.tmpdir()))
    assert(path.basename(root).startsWith('purge-local-discovery-'))
    removeTreeNoFollowSync(path.resolve(root))
  })
  const put = (relative, value) => {
    const target = path.join(base, ...relative.split('/'))
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, value)
    return target
  }
  const run = (action, input = {}) => assessmentRun(store, id, action, input, {
    invokeEngine() { throw new Error('Local helper must not invoke the native engine or a transport') },
  })
  return { root, base, store, id, put, run }
}
function assertAdvisoryOnly(result) {
  assert.equal(result.requests_sent, 0)
  assert.equal(result.data.can_confirm, false)
  assert.equal(result.data.security_coverage_granted, false)
}
const nvd = (id = 'CVE-2026-12345', configurations = [{ nodes: [{ operator: 'OR', cpeMatch: [{
  vulnerable: true, criteria: 'cpe:2.3:a:fixture:widget:*:*:*:*:*:*:*:*',
  versionStartIncluding: '1.9', versionEndExcluding: '1.10',
}] }] }]) => ({ vulnerabilities: [{ cve: {
  id, descriptions: [{ lang: 'en', value: 'A synthetic authorization defect in widget' }],
  weaknesses: [{ description: [{ lang: 'en', value: 'CWE-639' }] }], configurations,
  metrics: { cvssMetricV31: [{ cvssData: { baseSeverity: 'HIGH', baseScore: 8.1 } }] },
  references: [{ url: 'https://advisory.fixture.invalid/entry' }],
} }] })
const ghsa = () => ({
  ghsa_id: 'GHSA-2345-6789-cfgh', cve_id: 'CVE-2026-23456',
  summary: 'Synthetic package input flaw', description: 'Synthetic advisory metadata only', severity: 'medium',
  cwe_ids: ['CWE-79'], vulnerabilities: [{ package: { ecosystem: 'npm', name: 'fixture-package' },
    vulnerable_version_range: '>= 1.9, < 1.10', first_patched_version: { identifier: '1.10.0' } }],
  references: [{ url: 'https://advisory.fixture.invalid/package' }],
})
function importDocument(f, source, value, name = source + '.json') {
  f.put('incoming/' + name, JSON.stringify(value))
  return importVulnerabilityIntel(f.store, f.id, { source, file: 'incoming/' + name })
}

test('embedded source references resolve constants and input sinks while retaining shadowing, cycles and missing modules', async () => {
  const graph = await analyzeSourcemapModules({ sources: ['src/constants.js', 'src/page.js', 'src/cycle.js', 'src/component.ts'],
    sourcesContent: ['export const BASE="/api"; export const input=new URLSearchParams(location.search).get("query");',
      'import {BASE,input} from "./constants.js"; fetch(BASE+"/records"); document.body.innerHTML=input; '
      + 'function other(BASE){fetch(BASE+"/shadowed");} function safe(input){document.body.innerHTML=input;} '
      + 'import {missing} from "./absent.js"; fetch(missing);',
      'import {cycle} from "./cycle.js"; export const other=cycle; fetch(other);',
      'const unsupported: string="typescript";'] })
  assert(graph.routes.some(row => row.url === '/api/records' && row.method === 'GET'))
  assert.equal(graph.routes.some(row => row.url.includes('shadowed')), false)
  assert.equal(graph.input_sink_links.length, 1)
  assert.equal(graph.input_sink_links[0].input_source_index, 0)
  assert.equal(graph.input_sink_links[0].source_index, 1)
  assert.equal(graph.input_sink_links[0].input_name, 'query')
  assert(graph.gaps.some(row => row.code === 'module_reference_unresolved'))
  assert(graph.gaps.some(row => row.code === 'dynamic_request_unresolved'))
  assert(graph.gaps.some(row => row.code === 'source_language_unsupported'))
  assert.equal(graph.can_confirm, false)
  assert.equal(graph.runtime_verified, false)
})

test('source hints do not mistake hoisted, loop, catch or class bindings and mutated objects for global calls', async () => {
  const graph = await analyzeSourcemapModules({ sources: ['src/page.js'], sourcesContent: [
    'function local(){if(flag){var fetch=wrapper;}fetch("/hoisted");}'
    + 'for(const fetch of wrappers){fetch("/loop");}try{}catch(fetch){fetch("/catch");}'
    + 'const Builder=class fetch{run(){fetch("/class");}};'
    + 'const options={url:"/before"};options.url="/after";fetch(options.url);'
    + 'const normal="/real";fetch(normal);',
  ] })
  assert.deepEqual(graph.routes.map(row => row.url), ['/real'])
  assert(graph.gaps.some(row => row.code === 'mutable_binding_unresolved'))
  assert(graph.gaps.some(row => row.code === 'dynamic_request_unresolved'))
  assert.equal(graph.can_confirm, false)
})

test('workspace facade reads all large UTF-8 material through redacted character pages without initializing an engine', async t => {
  const f = fixture(t)
  f.store.addCredential(f.id, { host: scope, username: 'fixture', secret_value: secret })
  const source = 'header\r\n' + 'a'.repeat(8180) + secret + '\r\n' + 'middle-line\n'.repeat(17000) + 'FINAL-MATERIAL-MARKER\n'
  assert(Buffer.byteLength(source) > 128 * 1024)
  f.put('reports/large.md', source)
  const listing = await f.run('workspace.list', { directory: 'reports', limit: 1 })
  assert.equal(listing.data.items[0].file, 'reports/large.md')
  let offset = 0, material = '', first
  do {
    const result = await f.run('workspace.read', { file: listing.data.items[0].file, offset, limit: 8192 })
    first ||= result
    assertAdvisoryOnly(result)
    assert.equal(result.data.offset, offset)
    assert.equal(result.data.content_trust, 'untrusted_local_material')
    assert(!JSON.stringify(result).includes(secret))
    material += result.data.text
    offset = result.data.next_offset
  } while (offset !== null)
  assert(material.endsWith('FINAL-MATERIAL-MARKER\n'))
  assert(material.includes('header\n') && material.includes('middle-line\n'))
  assert(!material.includes('\r') && !material.includes(secret))
  assert.equal(material.length, first.data.total)
  assert.equal(first.data.artifact_sha256, hash(Buffer.from(source)))
  assert.equal(first.data.source_bytes, Buffer.byteLength(source))
  assert(!fs.existsSync(path.join(f.base, 'assessment')))
})

test('workspace redacts nested JSON keys, quoted custom Authorization, known values, JWT and private-key text through EOF', t => {
  const f = fixture(t)
  f.store.addCredential(f.id, { host: scope, username: 'fixture', secret_value: secret })
  f.put('incoming/nested.json', JSON.stringify({ normal: 'retained', nested: [{ password: 'nested-private',
    credential: { unknown: 'nested-object-secret' }, token: 'opaque-token' }], echo: secret }))
  const json = readAssessmentWorkspace(f.store, f.id, { file: 'incoming/nested.json', limit: 8192 })
  assert.match(json.data.text, /"normal":\s*"retained"/)
  for (const value of ['nested-private', 'nested-object-secret', 'opaque-token', secret]) assert(!json.data.text.includes(value))
  const jwt = 'eyJhbGciOiJub25lIn0.eyJzdWIiOiJmaXh0dXJlIn0.signature'
  const source = 'before\nconst h = {"Authorization": "Custom opaque-scheme-value"};\n'
    + "const h2 = {'client_secret': 'quoted-secret-value'};\n" + secret + '\n' + jwt
    + '\n-----BEGIN PRIVATE KEY-----\nsynthetic-pem-without-end'
  f.put('incoming/sample.js', source)
  const text = readAssessmentWorkspace(f.store, f.id, { file: 'incoming/sample.js', limit: 8192 })
  assert(text.data.text.startsWith('before\n'))
  for (const value of ['opaque-scheme-value', 'quoted-secret-value', secret, jwt, 'synthetic-pem-without-end']) {
    assert(!text.data.text.includes(value), 'must redact ' + value)
  }
  assertAdvisoryOnly(text)
})

test('workspace accepts fixed roots and rejects arbitrary paths, secrets, bad UTF-8 and binary material', t => {
  const f = fixture(t)
  f.store.addCredential(f.id, { host: scope, username: 'fixture', secret_value: secret })
  for (const relative of ['incoming/a.txt', 'reports/a.md', 'assessment/discovery/routes.json']) f.put(relative, 'ordinary')
  f.put('incoming/' + secret + '.txt', 'filename must not be published')
  f.put('incoming/credentials.txt', 'private')
  f.put('incoming/.hidden.txt', 'hidden')
  f.put('incoming/bad.txt', Buffer.from([0xc3, 0x28]))
  f.put('incoming/binary.txt', Buffer.from([65, 0, 66]))
  f.put('incoming/oversized.txt', Buffer.alloc(1024 * 1024 + 1, 65))
  const listed = listAssessmentWorkspace(f.store, f.id)
  assert.equal(listed.data.items.some(row => row.file.includes(secret)), false)
  assert.equal(listed.data.items.some(row => row.file.includes('credentials') || row.file.includes('.hidden')), false)
  for (const file of ['../outside.txt', 'incoming/../outside.txt', 'incoming\\a.txt', 'C:/arbitrary.txt',
    '/arbitrary.txt', 'assessment/evidence/raw.json', 'incoming/credentials.txt', 'incoming/.hidden.txt',
    'incoming/' + secret + '.txt', 'incoming/a.txt:stream', 'incoming/oversized.txt']) {
    assert.throws(() => readAssessmentWorkspace(f.store, f.id, { file }), error => /^ASSESSMENT_WORKSPACE_/.test(error.code))
  }
  for (const file of ['incoming/bad.txt', 'incoming/binary.txt']) assert.throws(
    () => readAssessmentWorkspace(f.store, f.id, { file }), error => error.code === 'ASSESSMENT_WORKSPACE_TEXT')
  for (const directory of ['incoming', 'reports', 'assessment/discovery']) assert.equal(
    listAssessmentWorkspace(f.store, f.id, { directory }).data.state, 'present')
  assert.throws(() => listAssessmentWorkspace(f.store, f.id, { directory: '../' }), /fixed material directory/)
  for (const input of [{ file: 'incoming/a.txt', limit: 0 }, { file: 'incoming/a.txt', offset: -1 },
    { file: 'incoming/a.txt', limit: 8193 }, { file: 'incoming/a.txt', workspace: f.root }]) {
    assert.throws(() => readAssessmentWorkspace(f.store, f.id, input), error => /^ASSESSMENT_WORKSPACE_/.test(error.code))
  }
})

test('workspace rejects junction descendants and hardlinked files without following external material', t => {
  const f = fixture(t)
  const outside = path.join(f.root, 'outside')
  fs.mkdirSync(outside)
  fs.writeFileSync(path.join(outside, 'external.txt'), 'EXTERNAL-CONTENT-MUST-NOT-READ')
  f.put('incoming/ordinary.txt', 'ordinary')
  fs.symlinkSync(outside, path.join(f.base, 'incoming', 'linked'), process.platform === 'win32' ? 'junction' : 'dir')
  fs.linkSync(path.join(outside, 'external.txt'), path.join(f.base, 'incoming', 'hardlinked.txt'))
  assert.throws(() => readAssessmentWorkspace(f.store, f.id, { file: 'incoming/linked/external.txt' }), error => error.code === 'ASSESSMENT_WORKSPACE_PATH')
  assert.throws(() => readAssessmentWorkspace(f.store, f.id, { file: 'incoming/hardlinked.txt' }), error => error.code === 'ASSESSMENT_WORKSPACE_FILE')
  const result = listAssessmentWorkspace(f.store, f.id)
  assert.deepEqual(result.data.items.map(row => row.file), ['incoming/ordinary.txt'])
  assert(result.data.omitted >= 2)
  assert.equal(fs.readFileSync(path.join(outside, 'external.txt'), 'utf8'), 'EXTERNAL-CONTENT-MUST-NOT-READ')
})

test('workspace missing directories and SRC local helpers stay offline and cannot create a native assessment', async t => {
  const f = fixture(t, 'src')
  const missing = await f.run('workspace.list')
  assert.equal(missing.data.state, 'missing')
  assert.deepEqual(missing.data.items, [])
  const intel = await f.run('intel.search')
  assert.equal(intel.data.state, 'not_imported')
  assertAdvisoryOnly(intel)
  assert(!fs.existsSync(path.join(f.base, 'assessment')))
})

test('NVD and KEV import retain bounded provenance and compare numeric 1.9 and 1.10 without declaring findings', t => {
  const f = fixture(t)
  const document = nvd()
  const imported = importDocument(f, 'nvd', document)
  assertAdvisoryOnly(imported)
  assert.equal(imported.data.source_sha256, hash(Buffer.from(JSON.stringify(document))))
  importDocument(f, 'kev', { vulnerabilities: [{ cveID: 'CVE-2026-12345', product: 'widget',
    vulnerabilityName: 'Known exploited advisory metadata', shortDescription: 'Fixture', cwes: ['CWE-639'], dateAdded: '2026-11-14' }] })
  const matching = searchVulnerabilityIntel(f.store, f.id, { component: 'widget', version: '1.9.0', kev_only: true })
  const advisory = matching.data.items.find(row => row.source === 'nvd')
  assert.equal(advisory.version_status, 'candidate_in_range')
  assert.equal(advisory.known_exploited_catalogue, true)
  assert.equal(advisory.source_origin_verified, false)
  assert.equal(advisory.logical_applicability, 'not_assessed')
  assert.deepEqual(advisory.cwes, ['CWE-639'])
  assert.equal(advisory.ranges[0].versionEndExcluding, '1.10')
  const outside = searchVulnerabilityIntel(f.store, f.id, { component: 'widget', version: '1.10' })
  assert.equal(outside.data.items.find(row => row.source === 'nvd').version_status, 'outside_known_ranges')
  assert.equal(searchVulnerabilityIntel(f.store, f.id, { component: 'widget', version: '1.9-beta' }).data.items[0].version_status, 'unknown')
  assertAdvisoryOnly(matching)
  assert.equal(matching.data.confidence, 'inferred')
  assert.equal(f.store.db(f.id).prepare('SELECT COUNT(*) AS n FROM vuln').get().n, 0)
  assert(!fs.existsSync(path.join(f.base, 'assessment')))
})

test('GHSA first-patched object and exact source identifiers survive import while related skills remain methodology', async t => {
  const f = fixture(t)
  importDocument(f, 'ghsa', ghsa())
  const result = await f.run('intel.get', { id: 'GHSA-2345-6789-cfgh' })
  const row = result.data.items[0]
  assert.deepEqual(row.identifiers, ['GHSA-2345-6789-CFGH', 'CVE-2026-23456'])
  assert.equal(row.ranges[0].first_patched_version, '1.10.0')
  assert.equal(row.ranges[0].ecosystem, 'npm')
  assert(row.related_skills.length > 0)
  assert(row.related_skills.every(item => item.resource && item.tags.cwe.includes('CWE-79')
    && item.source === 'installed_package' && (item.next === null || item.next.offline_only === true)))
  assert.equal(row.linkage, 'methodology_only_not_vulnerability_proof')
  assert.equal(searchVulnerabilityIntel(f.store, f.id, { component: 'fixture-package', version: '1.9' }).data.items[0].version_status, 'candidate_in_range')
  assert.equal(searchVulnerabilityIntel(f.store, f.id, { component: 'fixture-package', version: '1.10' }).data.items[0].version_status, 'outside_known_ranges')
  assertAdvisoryOnly(result)
})

test('shared CVE intelligence groups source references and retains contradictory version ranges', t => {
  const current = fixture(t)
  importDocument(current, 'nvd', nvd())
  importDocument(current, 'kev', { vulnerabilities: [{ cveID: 'CVE-2026-12345', product: 'widget', vulnerabilityName: 'Fixture' }] })
  const advisory = { ...ghsa(), cve_id: 'CVE-2026-12345', vulnerabilities: [{ package: { ecosystem: 'npm', name: 'widget' },
    vulnerable_version_range: '>= 2.0, < 3.0', first_patched_version: '3.0' }] }
  importDocument(current, 'ghsa', advisory)
  const grouped = searchVulnerabilityIntel(current.store, current.id, { component: 'widget', version: '1.9' })
  assert.equal(grouped.data.total, 1)
  assert.equal(grouped.data.matching_source_records, 3)
  assert.equal(grouped.data.items[0].source, 'nvd')
  assert.equal(grouped.data.items[0].version_status, 'conflicting_source_ranges')
  assert.equal(grouped.data.items[0].source_records.length, 3)
  assert.equal(grouped.data.items[0].known_exploited_catalogue, true)
  assert.equal(grouped.data.items[0].target_component_verified, false)
  assert.equal(grouped.data.items[0].target_affected, 'not_assessed')
  const details = getVulnerabilityIntel(current.store, current.id, { id: 'CVE-2026-12345' })
  assert.equal(details.data.total, 3)
  assert.equal(details.data.deduplicated, false)
  assertAdvisoryOnly(grouped)
  const filtered = searchVulnerabilityIntel(current.store, current.id, { query: 'authorization defect', component: 'widget', version: '1.9' })
  assert.equal(filtered.data.total, 1)
  assert.equal(filtered.data.items[0].source_records_total, 3)
  assert.equal(filtered.data.items[0].version_status, 'conflicting_source_ranges')
})

test('complex NVD applicability, escaped CPEs and unsupported GHSA version syntax remain unknown', t => {
  const f = fixture(t)
  const match = { vulnerable: true, criteria: 'cpe:2.3:a:fixture:widget:1.9:*:*:*:*:*:*:*' }
  importDocument(f, 'nvd', nvd('CVE-2026-34567', [{ operator: 'AND', nodes: [{ operator: 'OR', cpeMatch: [match] },
    { operator: 'OR', cpeMatch: [{ vulnerable: false, criteria: 'cpe:2.3:o:fixture:platform:*:*:*:*:*:*:*:*' }] }] }]), 'complex.json')
  importDocument(f, 'nvd', nvd('CVE-2026-45678', [{ nodes: [{ operator: 'OR', cpeMatch: [{ ...match,
    criteria: 'cpe:2.3:a:fixture:widget:1.9:*:*:*:desktop\\:edition:*:*' }] }] }]), 'escaped.json')
  for (const id of ['CVE-2026-34567', 'CVE-2026-45678']) {
    const row = getVulnerabilityIntel(f.store, f.id, { id }).data.items[0]
    assert(row, 'unsupported applicability should remain available as metadata')
    assert.equal(advisoryVersionStatus(row, 'widget', '1.9'), 'unknown')
  }
  const unsupported = ghsa()
  unsupported.vulnerabilities[0].vulnerable_version_range = '^1.9 || >= 2.0'
  importDocument(f, 'ghsa', unsupported)
  assert.equal(searchVulnerabilityIntel(f.store, f.id, { component: 'fixture-package', version: '1.9' }).data.items[0].version_status, 'unknown')
})

test('invalid imports and malformed existing caches reject with typed errors while preserving the exact original cache', t => {
  const f = fixture(t)
  importDocument(f, 'nvd', nvd())
  const cache = path.join(f.base, 'intel', 'catalogue.json')
  const original = fs.readFileSync(cache)
  const invalid = [
    { source: 'nvd', value: { vulnerabilities: [{ cve: { id: 'CVE-2026-12345', descriptions: {} } }] } },
    { source: 'nvd', value: { vulnerabilities: [{ cve: { id: 'not-an-id' } }] } },
    { source: 'ghsa', value: { ...ghsa(), vulnerabilities: {} } },
    { source: 'kev', value: { vulnerabilities: [] } },
  ]
  for (const [index, item] of invalid.entries()) {
    f.put('incoming/invalid-' + index + '.json', JSON.stringify(item.value))
    assert.throws(() => importVulnerabilityIntel(f.store, f.id, { source: item.source, file: 'incoming/invalid-' + index + '.json' }),
      error => /^INTEL_/.test(error.code))
    assert.deepEqual(fs.readFileSync(cache), original)
  }
  for (const configuration of [{ negate: 'true', nodes: [] }, { operator: {}, nodes: [] },
    { nodes: [{ cpeMatch: [{ vulnerable: 'true', criteria: 'cpe:2.3:a:fixture:widget:*:*:*:*:*:*:*:*' }] }] },
    { nodes: [{ cpeMatch: [{ vulnerable: true, criteria: 'cpe:2.3:a:fixture:widget:*:*:*:*:*:*:*:*', versionEndExcluding: {} }] }] }]) {
    f.put('incoming/invalid-range.json', JSON.stringify(nvd('CVE-2026-56789', [configuration])))
    assert.throws(() => importVulnerabilityIntel(f.store, f.id, { source: 'nvd', file: 'incoming/invalid-range.json' }),
      error => error.code === 'INTEL_RANGE_FORMAT')
    assert.deepEqual(fs.readFileSync(cache), original)
  }
  f.put('incoming/bad.json', Buffer.from([0xff]))
  assert.throws(() => importVulnerabilityIntel(f.store, f.id, { source: 'nvd', file: 'incoming/bad.json' }), error => error.code === 'INTEL_JSON')
  assert.deepEqual(fs.readFileSync(cache), original)
  const row = JSON.parse(original).records[0]
  for (const broken of [{ source: 'nvd', id: 'CVE-2026-12345', identifiers: ['CVE-2026-12345'] },
    { ...row, components: {} }, { ...row, cwes: [123] }, { ...row, ranges: [{ ...row.ranges[0], versionStartIncluding: {} }] },
    { ...row, source_origin_verified: true }, { ...row, source_sha256: 'invalid-hash' },
    { ...row, identifiers: ['CVE-2026-99999'] }, { ...row, raw_headers: { Authorization: secret } },
    { ...row, password: secret }, { ...row, private_notes: secret }, { ...row, evidence_state: 'observed' },
    { ...row, confirmed: true }]) {
    const corrupt = JSON.stringify({ schema: 'dsh-vulnerability-intel/v1', records: [broken] })
    fs.writeFileSync(cache, corrupt)
    assert.throws(() => searchVulnerabilityIntel(f.store, f.id, { query: 'fixture' }), error => error.code === 'INTEL_CACHE')
    assert.throws(() => getVulnerabilityIntel(f.store, f.id, { id: row.id }), error => error.code === 'INTEL_CACHE')
    assert.throws(() => importVulnerabilityIntel(f.store, f.id, { source: 'nvd', file: 'incoming/nvd.json' }), error => error.code === 'INTEL_CACHE')
    assert.equal(fs.readFileSync(cache, 'utf8'), corrupt)
  }
  const documentWithSecret = JSON.stringify({ ...JSON.parse(original), raw_headers: { Authorization: secret } })
  fs.writeFileSync(cache, documentWithSecret)
  assert.throws(() => searchVulnerabilityIntel(f.store, f.id), error => error.code === 'INTEL_CACHE')
  assert.throws(() => getVulnerabilityIntel(f.store, f.id, { id: row.id }), error => error.code === 'INTEL_CACHE')
  assert.throws(() => importVulnerabilityIntel(f.store, f.id, { source: 'nvd', file: 'incoming/nvd.json' }), error => error.code === 'INTEL_CACHE')
  assert.equal(fs.readFileSync(cache, 'utf8'), documentWithSecret)
})

test('intelligence cannot expose known credentials in output or persisted cache and retains the input document', async t => {
  const f = fixture(t)
  f.store.addCredential(f.id, { host: scope, username: 'fixture', secret_value: secret })
  const document = ghsa()
  document.summary = 'Synthetic title ' + secret
  document.description = 'Unlabelled known private scalar: ' + secret + '\n{"Authorization":"Custom advisory-secret-value"}'
  document.references = [{ url: 'https://advisory.fixture.invalid/' + secret }]
  const serialized = JSON.stringify(document)
  importDocument(f, 'ghsa', document)
  const result = await f.run('intel.search')
  const cached = fs.readFileSync(path.join(f.base, 'intel', 'catalogue.json'), 'utf8')
  for (const text of [JSON.stringify(result), cached]) {
    assert(!text.includes(secret))
    assert(!text.includes('advisory-secret-value'))
  }
  assert.equal(fs.readFileSync(path.join(f.base, 'incoming', 'ghsa.json'), 'utf8'), serialized)
  assertAdvisoryOnly(result)
})

test('intelligence rejects arbitrary, linked and hardlinked source/cache paths and bounded query violations', t => {
  const f = fixture(t)
  const file = f.put('incoming/nvd.json', JSON.stringify(nvd()))
  fs.linkSync(file, path.join(f.base, 'incoming', 'hardlinked.json'))
  assert.throws(() => importVulnerabilityIntel(f.store, f.id, { source: 'nvd', file: 'incoming/hardlinked.json' }), error => error.code === 'INTEL_FILE')
  fs.unlinkSync(path.join(f.base, 'incoming', 'hardlinked.json'))
  for (const input of [{ source: 'nvd', file: '../nvd.json' }, { source: 'nvd', file },
    { source: 'nvd', file: 'incoming/../nvd.json' }, { source: 'remote', file: 'incoming/nvd.json' }]) {
    assert.throws(() => importVulnerabilityIntel(f.store, f.id, input), error => error.code === 'INTEL_INPUT_PATH')
  }
  importVulnerabilityIntel(f.store, f.id, { source: 'nvd', file: 'incoming/nvd.json' })
  for (const input of [{ version: '1.9' }, { component: 'widget', limit: 101 }, { offset: -1 },
    { cwe: ['injection'] }, { id: 'unbounded-identifier' }, { packagePath: 'external' }]) {
    assert.throws(() => searchVulnerabilityIntel(f.store, f.id, input), error => /^INTEL_/.test(error.code))
  }
  assert.equal(getVulnerabilityIntel(f.store, f.id, { id: 'CVE-2026-99999' }).data.total, 0)
  const outside = path.join(f.root, 'outside-intel')
  fs.mkdirSync(outside)
  fs.writeFileSync(path.join(outside, 'linked.json'), JSON.stringify(nvd()))
  fs.symlinkSync(outside, path.join(f.base, 'incoming', 'linked'), process.platform === 'win32' ? 'junction' : 'dir')
  assert.throws(() => importVulnerabilityIntel(f.store, f.id, { source: 'nvd', file: 'incoming/linked/linked.json' }), /symbolic link/)
  const cache = path.join(f.base, 'intel', 'catalogue.json')
  fs.linkSync(cache, path.join(outside, 'cache-copy.json'))
  assert.throws(() => searchVulnerabilityIntel(f.store, f.id), error => error.code === 'INTEL_FILE')
})
