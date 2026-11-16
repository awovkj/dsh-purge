/** Offline sourcemap extraction from captured bytes. No source is executed or fetched. */
import { mkdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { TextDecoder } from 'node:util'
import { assertNoLinkedDescendants } from '../path-boundary.js'
import { atomicWriteSync } from '../atomic-files.js'
import { artifactError, sha256 } from './assessment-artifacts.js'
import { readCurrentAssessmentCapture, privateObservationValues } from './assessment-observation.js'
import { assertAssessmentUrlAllowed } from './native-assessment.js'
import { reportLocator } from './report-text.js'
import { safeDiscoveryText } from './evidence-diff.js'
import { analyzeSourcemapModules } from './sourcemap-graph.js'

const MAX_BYTES = 2 * 1024 * 1024
const MAX_SOURCES = 500
const FIELDS = new Set(['evidence_id', 'map_evidence_id', 'offset', 'limit', 'save'])
const HELP = { required: ['evidence_id'], fields: {
  evidence_id: 'One complete current GET capture of a v3 JSON sourcemap, or JavaScript containing an actual sourceMappingURL comment',
  map_evidence_id: 'Optional complete current GET capture at the exact declared external map URL, with matching capture identity',
  offset: 'Nonnegative source-row offset; default 0',
  limit: '1..100 source rows; default 50',
  save: 'Optional boolean; default true. Saves private reconstructed text under fixed hash names, never declared sources paths' },
notes: ['Offline only; external map references without an explicit captured map remain declarations. No fallback .map request, redirect, sourceRoot request or source execution occurs.',
  'Only regular v3 maps with bounded sources/sourcesContent are supported; indexed sections remain unsupported. Source bytes and reconstructed contents are capped at 2 MiB; at most 500 source entries are accepted.',
  'Bounded cross-module constant imports, AST request references and query/hash-to-HTML sink references are retained as declarations. Unsupported languages, missing modules, dynamic expressions and parser gaps remain explicit.',
  'Original source names, route literals and credential patterns are untrusted reconnaissance declarations. Sensitive values are not returned; a pattern match, public source or CVE association cannot confirm a vulnerability or set severity.',
  'Hashes bind source artifacts and each reconstructed file. Current evidence, engagement scope and optional JS/map identity bindings are checked before derived files are saved.'] }

export const isSourcemapDiscoveryAction = action => action === 'surface.from_sourcemap'
export function sourcemapDiscoveryActionHelp(name) {
  return isSourcemapDiscoveryAction(name) ? { ok: true, data: { action: name, group: 'dsh_embedded_observation',
    contract_version: 1, project_required: true, ...HELP }, requests_sent: 0 } : null
}

function integer(value, fallback, maximum) {
  if (value === undefined) return fallback
  if (!Number.isSafeInteger(value) || value < 0 || value > maximum) throw artifactError('ASSESSMENT_SOURCEMAP_PAGINATION', 'Use bounded nonnegative source offsets and limits')
  return value
}
function decode(bytes) {
  if (bytes.length > MAX_BYTES) throw artifactError('ASSESSMENT_SOURCEMAP_BUDGET', 'Sourcemap/source bytes exceed 2 MiB')
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes) }
  catch { throw artifactError('ASSESSMENT_SOURCEMAP_ENCODING', 'Sourcemap/source bytes must be intact UTF-8') }
}
async function references(source) {
  let tokenizer
  try { ({ tokenizer } = await import('acorn')) }
  catch { throw artifactError('ASSESSMENT_SOURCEMAP_PARSER', 'The installed Acorn parser is unavailable; preserve the captured source and inspect the package dependency before JavaScript sourcemap discovery') }
  if (typeof tokenizer !== 'function') throw artifactError('ASSESSMENT_SOURCEMAP_PARSER', 'The installed parser does not provide its expected tokenizer')
  const values = []
  let tokens = 0
  try {
    const scan = tokenizer(source, { ecmaVersion: 'latest', allowHashBang: true, onComment(_block, text) {
      const match = /(?:^|[\r\n])\s*[#@]\s*sourceMappingURL\s*=\s*(\S+)\s*$/.exec(text)
      if (match) values.push(match[1])
      if (values.length > 32) throw artifactError('ASSESSMENT_SOURCEMAP_REFERENCES', 'Too many sourcemap comments')
    } })
    while (scan.getToken().type.label !== 'eof') if (++tokens > 500000) throw artifactError('ASSESSMENT_SOURCEMAP_BUDGET', 'JavaScript tokenization exceeds its bounded budget')
  } catch (error) {
    if (error.code) throw error
    throw artifactError('ASSESSMENT_SOURCEMAP_JAVASCRIPT', 'Captured JavaScript could not be tokenized; sourceMappingURL strings are not substituted for comments')
  }
  const unique = [...new Set(values)]
  if (unique.length > 1) throw artifactError('ASSESSMENT_SOURCEMAP_REFERENCES', 'Different sourcemap comments are ambiguous; retain the source for review')
  return unique[0] || null
}
function inlineMap(reference) {
  const match = /^data:application\/json(?:;charset=utf-8)?(;base64)?,(.*)$/i.exec(reference)
  if (!match) throw artifactError('ASSESSMENT_SOURCEMAP_INLINE', 'Inline sourcemaps require application/json UTF-8 data')
  const value = match[2]
  if (value.length > MAX_BYTES * 4) throw artifactError('ASSESSMENT_SOURCEMAP_BUDGET', 'Encoded inline map exceeds its bounded budget')
  if (match[1]) {
    if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) throw artifactError('ASSESSMENT_SOURCEMAP_INLINE', 'Inline map base64 is malformed')
    const bytes = Buffer.from(value, 'base64')
    if (bytes.toString('base64') !== value) throw artifactError('ASSESSMENT_SOURCEMAP_INLINE', 'Inline map base64 is noncanonical')
    decode(bytes)
    return bytes
  }
  try { const bytes = Buffer.from(decodeURIComponent(value), 'utf8'); decode(bytes); return bytes }
  catch (error) { if (error.code) throw error; throw artifactError('ASSESSMENT_SOURCEMAP_INLINE', 'Inline map percent encoding is malformed') }
}
function parseMap(bytes) {
  let document
  try { document = JSON.parse(decode(bytes)) }
  catch (error) { if (error.code) throw error; throw artifactError('ASSESSMENT_SOURCEMAP_JSON', 'A source map must be complete UTF-8 JSON, not an HTML fallback response') }
  if (!document || typeof document !== 'object' || Array.isArray(document) || document.version !== 3 || document.sections !== undefined
    || !Array.isArray(document.sources) || document.sources.length > MAX_SOURCES
    || document.sources.some(source => typeof source !== 'string' || source.length > 4096)
    || typeof document.mappings !== 'string'
    || document.sourcesContent !== undefined && (!Array.isArray(document.sourcesContent) || document.sourcesContent.length !== document.sources.length
      || document.sourcesContent.some(content => content !== null && typeof content !== 'string'))
    || document.names !== undefined && (!Array.isArray(document.names) || document.names.length > 10000 || document.names.some(name => typeof name !== 'string' || name.length > 4096))
    || document.sourceRoot !== undefined && (typeof document.sourceRoot !== 'string' || document.sourceRoot.length > 4096)
    || document.file !== undefined && (typeof document.file !== 'string' || document.file.length > 4096)) {
    throw artifactError('ASSESSMENT_SOURCEMAP_FORMAT', 'Use a bounded regular v3 map with sources, mappings and aligned optional sourcesContent; indexed sections remain unsupported')
  }
  let total = 0
  for (const content of document.sourcesContent || []) {
    if (typeof content === 'string' && Buffer.from(content, 'utf8').toString('utf8') !== content) {
      throw artifactError('ASSESSMENT_SOURCEMAP_ENCODING', 'Reconstructed source strings contain unpaired Unicode surrogates; preserve the original map')
    }
    total += content === null ? 0 : Buffer.byteLength(content)
    if (total > MAX_BYTES) throw artifactError('ASSESSMENT_SOURCEMAP_BUDGET', 'Reconstructed source contents exceed 2 MiB')
  }
  return { document, total }
}
const SECRET_PATTERNS = [
  ['private_key_literal', /-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----/g],
  ['cloud_access_key_literal', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g],
  ['jwt_literal', /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g],
  ['credential_assignment_literal', /(?:password|passwd|api[_-]?key|access[_-]?token|secret[_-]?key|client[_-]?secret)["']?\s*[:=]\s*["'][^"'\r\n]{8,512}["']/gi],
]
function signalsOf(content, index) {
  return SECRET_PATTERNS.flatMap(([type, pattern]) => {
    pattern.lastIndex = 0
    let count = 0
    while (pattern.exec(content)) { count++; if (count >= 100) break }
    return count ? [{ source_index: index, type, count, count_capped: count === 100, interpretation: 'unverified_literal' }] : []
  })
}
function routeHints(content, index, origin, store, id, secrets, hints) {
  const pattern = /["'`]((?:https?:\/\/[^"'`\s<>]{1,2048}|\/(?:api|v\d+|rest|gateway|service|prod-api|dev-api)(?:\/[^"'`\s<>]{0,2000})?))["'`]/gi
  let match, attempts = 0
  while (hints.length < 50 && (match = pattern.exec(content)) && ++attempts <= 100) {
    let url
    try { url = new URL(match[1], origin).href } catch { continue }
    let allowed = true
    try { assertAssessmentUrlAllowed(store, id, url) } catch { allowed = false }
    const label = safeDiscoveryText(reportLocator(url, secrets), secrets, 2048)
    if (hints.some(hint => hint.url === label && hint.source_index === index)) continue
    hints.push({ source_index: index, url: label, in_scope: allowed, declaration_only: true,
      registration_required: true, runtime_verified: false })
  }
}
async function captureOf(store, id, runtime, context, evidenceId, options) {
  const captured = await readCurrentAssessmentCapture(store, id, runtime, context, evidenceId, options)
  if (captured.record.complete !== true || captured.artifact.complete !== true || captured.artifact.request.method !== 'GET'
    || captured.artifact.response.status !== 200) throw artifactError('ASSESSMENT_SOURCEMAP_COMPLETE', 'Sourcemap discovery requires complete current 200 GET captures')
  decode(captured.body)
  return captured
}

export async function discoverAssessmentSourcemap(store, id, runtime, context, input, options = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => !FIELDS.has(key))) throw artifactError('ASSESSMENT_SOURCEMAP_FIELDS', 'Use action.help for the exact surface.from_sourcemap fields')
  const offset = integer(input.offset, 0, Number.MAX_SAFE_INTEGER), limit = integer(input.limit, 50, 100)
  if (!limit) throw artifactError('ASSESSMENT_SOURCEMAP_PAGINATION', 'Source limit must be 1..100')
  if (input.save !== undefined && typeof input.save !== 'boolean') throw artifactError('ASSESSMENT_SOURCEMAP_FIELDS', 'save must be a boolean')
  const first = await captureOf(store, id, runtime, context, input.evidence_id, options)
  const captures = [first], source = decode(first.body)
  let mapBytes, sourceKind = 'captured_map'
  let parsed
  try { parsed = JSON.parse(source) } catch { /* A real JavaScript comment may declare an inline/external map. */ }
  if (parsed?.version === 3) {
    if (input.map_evidence_id !== undefined) throw artifactError('ASSESSMENT_SOURCEMAP_FIELDS', 'A captured map does not accept a second map override')
    mapBytes = first.body
  } else {
    const contentType = (first.artifact.response.headers || []).find(([name]) => String(name).toLowerCase() === 'content-type')?.[1] || ''
    if (!/\.(?:js|mjs)$/i.test(new URL(first.artifact.request.url).pathname) && !/javascript|ecmascript/i.test(contentType)) {
      throw artifactError('ASSESSMENT_SOURCEMAP_TYPE', 'Capture an actual v3 map or JavaScript asset, not an HTML or arbitrary JSON fallback')
    }
    const reference = await references(source)
    if (!reference) return { ok: true, data: { state: 'no_declared_sourcemap', evidence_id: first.record.id,
      artifact_sha256: first.record.sha256, body_sha256: first.artifact.response.body_sha256,
      can_confirm: false, reconnaissance_only: true, security_coverage_granted: false,
      note: 'No sourceMappingURL comment was observed. This does not prove that source maps or source exposure are absent.' }, requests_sent: 0 }
    if (reference.startsWith('data:')) {
      if (input.map_evidence_id !== undefined) throw artifactError('ASSESSMENT_SOURCEMAP_FIELDS', 'An inline map cannot be replaced by another capture')
      mapBytes = inlineMap(reference); sourceKind = 'inline_map'
    } else {
      let mapUrl
      try { mapUrl = new URL(reference, first.artifact.request.url).href; assertAssessmentUrlAllowed(store, id, mapUrl) }
      catch { throw artifactError('ASSESSMENT_SOURCEMAP_SCOPE', 'The declared map URL is invalid, outside scope or excluded; no request was sent') }
      if (input.map_evidence_id === undefined) {
        const secrets = privateObservationValues(store, id, context, captures)
        return { ok: true, data: { state: 'external_map_declared', evidence_id: first.record.id,
          artifact_sha256: first.record.sha256, map_url: safeDiscoveryText(reportLocator(mapUrl, secrets), secrets, 2048),
          declaration_only: true, requires_explicit_capture: true, can_confirm: false, reconnaissance_only: true,
          security_coverage_granted: false, note: 'Use an explicitly authorized existing HTTP capture of the exact declared map URL; no target request was sent.' }, requests_sent: 0 }
      }
      const map = await captureOf(store, id, runtime, context, input.map_evidence_id, options)
      if (map.artifact.request.url !== mapUrl || ['actor_id', 'actor_signature', 'session_id', 'session_generation', 'credential_signature']
        .some(key => (map.record[key] ?? null) !== (first.record[key] ?? null))) {
        throw artifactError('ASSESSMENT_SOURCEMAP_BINDING', 'The external map capture must match the exact declared URL and capture identity')
      }
      captures.push(map); mapBytes = map.body; sourceKind = 'declared_external_map'
    }
  }
  const { document, total } = parseMap(mapBytes), mapHash = sha256(mapBytes)
  const secrets = privateObservationValues(store, id, context, captures)
  const analyzed = await analyzeSourcemapModules(document, options)
  const graph = { ...analyzed, routes: analyzed.routes.map(row => {
    let url, inScope = false
    try { url = new URL(row.url, first.artifact.request.url).href; assertAssessmentUrlAllowed(store, id, url); inScope = true }
    catch { url ||= row.url }
    return { ...row, url: safeDiscoveryText(reportLocator(url, secrets), secrets, 2048), in_scope: inScope,
      declaration_only: true, runtime_verified: false, registration_required: true }
  }), input_sink_links: analyzed.input_sink_links.map(row => ({ ...row, input_name: safeDiscoveryText(row.input_name, secrets, 256) })) }
  const base = store.dirOf(id), dir = assertNoLinkedDescendants(base, join(base, 'assessment', 'discovery', 'sourcemaps', mapHash))
  const save = input.save !== false, rows = [], signals = [], hints = graph.routes.slice(0, 50)
  if (save) mkdirSync(dir, { recursive: true, mode: 0o700 })
  for (const [index, name] of document.sources.entries()) {
    options.signal?.throwIfAborted()
    const content = document.sourcesContent?.[index], present = typeof content === 'string'
    const bytes = present ? Buffer.from(content, 'utf8') : null, hash = bytes ? sha256(bytes) : null
    const path = bytes ? assertNoLinkedDescendants(base, join(dir, index.toString().padStart(4, '0') + '-' + hash + '.txt')) : null
    if (save && bytes) atomicWriteSync(path, bytes, 'utf8', { mode: 0o600 })
    rows.push({ index, declared_name: safeDiscoveryText(name, secrets, 240), declaration_only: true,
      content_present: present, content_bytes: bytes?.length ?? 0, content_sha256: hash,
      ...(save && path ? { source_file: relative(base, path).replaceAll('\\', '/') } : {}) })
    if (present) { signals.push(...signalsOf(content, index)); routeHints(content, index, first.artifact.request.url, store, id, secrets, hints) }
  }
  let manifestPath, manifestHash
  if (save) {
    const manifest = { schema: 'dsh-purge-sourcemap/v1', map_sha256: mapHash, source_kind: sourceKind,
      source_evidence_ids: captures.map(capture => capture.record.id), source_artifact_sha256: captures.map(capture => capture.record.sha256),
      reconstructed_bytes: total, sources: rows, source_graph: graph, can_confirm: false, reconnaissance_only: true }
    const manifestBytes = Buffer.from(JSON.stringify(manifest, null, 2) + '\n', 'utf8')
    manifestHash = sha256(manifestBytes)
    manifestPath = assertNoLinkedDescendants(base, join(dir, 'manifest-' + manifestHash + '.json'))
    atomicWriteSync(manifestPath, manifestBytes, 'utf8', { mode: 0o600 })
  }
  return { ok: true, data: { state: 'sourcemap_parsed', source_kind: sourceKind,
    source_evidence_ids: captures.map(capture => capture.record.id), source_artifact_sha256: captures.map(capture => capture.record.sha256),
    map_sha256: mapHash, declared_source_root: safeDiscoveryText(document.sourceRoot || '', secrets, 240),
    declared_file: safeDiscoveryText(document.file || '', secrets, 240), sources: rows.slice(offset, offset + limit),
    total: rows.length, offset, limit, next_offset: offset + limit < rows.length ? offset + limit : null,
    sources_with_content: rows.filter(row => row.content_present).length, reconstructed_bytes: total,
    secret_signals: signals.slice(0, 100), secret_signals_total: signals.length, secret_signals_truncated: signals.length > 100,
    route_hints: hints, route_hints_limit: 50, routes_registered: 0,
    source_graph: { ...graph, routes: graph.routes.slice(0, 100), module_links: graph.module_links.slice(0, 100),
      input_sink_links: graph.input_sink_links.slice(0, 100), gaps: graph.gaps.slice(0, 100),
      totals: { routes: graph.routes.length, module_links: graph.module_links.length, input_sink_links: graph.input_sink_links.length, gaps: graph.gaps.length },
      preview_truncated: [graph.routes, graph.module_links, graph.input_sink_links, graph.gaps].some(rows => rows.length > 100) },
    ...(manifestPath ? { manifest_path: relative(base, manifestPath).replaceAll('\\', '/'), manifest_sha256: manifestHash } : {}),
    private_sources_saved: save, content_trust: 'untrusted_target_data', reconnaissance_only: true,
    can_confirm: false, security_coverage_granted: false, severity_assigned: false,
    note: 'Source names, route strings and secret patterns are declarations. Reconstructed bytes remain private local files; no source was executed and no target was requested. Validate specific real impact through current native controls before recording any vulnerability.' }, requests_sent: 0 }
}
