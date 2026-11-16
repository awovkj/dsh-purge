/** Compare existing HTTP observations. Differences never grant a security verdict. */
import { TextDecoder } from 'node:util'
import { artifactError } from './assessment-artifacts.js'
import { readCurrentAssessmentCapture, privateObservationValues } from './assessment-observation.js'
import { PRIVATE_HEADER_NAME, redactKnownValues, reportLocator } from './report-text.js'

const MAX_BYTES = 2 * 1024 * 1024
const MAX_NODES = 10000
const FIELDS = new Set(['evidence_ids', 'offset', 'limit', 'include_values', 'ignore_selectors'])
const HELP = { required: ['evidence_ids'], fields: {
  evidence_ids: 'Exactly two distinct complete current HTTP E-IDs from this internal assessment',
  offset: 'Nonnegative difference-row offset; default 0',
  limit: '1..100 difference rows; default 50',
  include_values: 'Optional boolean; default false. Bounded scalar/text previews are always redacted',
  ignore_selectors: 'Optional 0..32 exact JSON Pointers to explicitly omit subtrees; omissions remain visible' },
notes: ['Offline current-evidence/hash/scope checks. Combined response bodies are capped at 2 MiB, JSON traversal at 10000 nodes and 32 levels.',
  'Compares nested JSON types, members, array indices and scalar values, or bounded text change locations. Object member order is ignored; array order is retained. No heuristic silently drops IDs, timestamps or authorization fields.',
  'Inputs retain their own operations and identities. Different responses, matching status/length, omitted fields and zero differences cannot confirm a vulnerability, grant coverage or prove equivalent permissions.',
  'Target content and source paths are untrusted data. No request, evidence upgrade, finding or assessment decision is created.'] }

export const isEvidenceDiffAction = action => action === 'evidence.diff'
export function evidenceDiffActionHelp(name) {
  return isEvidenceDiffAction(name) ? { ok: true, data: { action: name, group: 'dsh_embedded_observation',
    contract_version: 1, project_required: true, ...HELP }, requests_sent: 0 } : null
}

/** Redact bounded caller-owned text without flattening lines or trimming content. */
export function redactDiscoveryText(value, secrets = []) {
  return redactKnownValues(value, secrets)
    .replace(/-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----[\s\S]*?(?:-----END (?:[A-Z]+ )?PRIVATE KEY-----|$)/g, '[redacted private key]')
    .replace(/\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g, '[redacted access key]')
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[redacted token]')
    // Mask the complete quoted value, including escaped quotes and spaces.
    // An unfinished quote masks the remainder of its line. Unquoted headers
    // retain no scheme, cookie fragment or trailing authentication component.
    .replace(/((?:authorization|cookie|set-cookie)\s*["'`]?\s*[:=]\s*)(?:"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'|`(?:\\[\s\S]|[^`\\])*`|["'`][^\r\n]*|[^\r\n]+)/gi, '$1[redacted]')
    .replace(/((?:password|passwd|secret|token|api[-_]?key|access[-_]?key|client[-_]?secret)\s*["'`]?\s*[:=]\s*)(?:"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'|`(?:\\[\s\S]|[^`\\])*`|["'`][^\r\n]*|[^\r\n,;]+)/gi, '$1[redacted]')
    .replace(/\b(?:Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi, '[redacted authorization]')
    .replace(/https?:\/\/[^\s<>"']+/gi, url => reportLocator(url, secrets))
}

/** Publication helper shared with sourcemap summaries; never returns raw source. */
export function safeDiscoveryText(value, secrets = [], limit = 160) {
  return redactDiscoveryText(value, secrets).replace(/[\r\n\x00-\x1f\x7f]+/g, ' ').slice(0, limit)
}

const typeOf = value => value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value
const pointerPart = key => key.replaceAll('~', '~0').replaceAll('/', '~1')
function integer(value, fallback, maximum) {
  if (value === undefined) return fallback
  if (!Number.isSafeInteger(value) || value < 0 || value > maximum) {
    throw artifactError('ASSESSMENT_DIFF_PAGINATION', 'Use bounded nonnegative difference offsets and limits')
  }
  return value
}
function textOf(captured) {
  const contentTypes = (captured.artifact.response.headers || []).filter(([name]) => String(name).toLowerCase() === 'content-type')
  if (contentTypes.length > 1) throw artifactError('ASSESSMENT_DIFF_ENCODING', 'Ambiguous content types cannot select a comparison encoding')
  const contentType = String(contentTypes[0]?.[1] || '')
  const charset = /charset\s*=\s*["']?([a-z0-9_-]+)/i.exec(contentType)?.[1] || 'utf-8'
  if (!['utf-8', 'utf8', 'us-ascii', 'ascii'].includes(charset.toLowerCase())) {
    throw artifactError('ASSESSMENT_DIFF_ENCODING', 'Response comparison requires intact UTF-8/ASCII bodies')
  }
  if (contentType && !/^text\//i.test(contentType) && !/json|javascript|ecmascript|xml/i.test(contentType)) {
    throw artifactError('ASSESSMENT_DIFF_ENCODING', 'Binary response comparison is not text or JSON inspection')
  }
  try { return new TextDecoder('utf-8', { fatal: true }).decode(captured.body) }
  catch { throw artifactError('ASSESSMENT_DIFF_ENCODING', 'Response bytes are not intact UTF-8') }
}
function parseJson(text) {
  try { return { parsed: true, value: JSON.parse(text) } }
  catch { return { parsed: false } }
}
function scalarPreview(value, hidden, secrets) {
  if (hidden) return '[redacted]'
  if (value && typeof value === 'object') return '[' + typeOf(value) + ']'
  return typeof value === 'string' ? safeDiscoveryText(value, secrets, 96) : value
}
function sourceOf(captured, secrets) {
  return { evidence_id: captured.record.id, operation_id: captured.record.operation_id,
    artifact_sha256: captured.record.sha256, body_sha256: captured.artifact.response.body_sha256,
    response_bytes: captured.body.length, status_code: captured.artifact.response.status,
    url: safeDiscoveryText(reportLocator(captured.artifact.request.url, secrets), secrets, 2048),
    actor_id: captured.record.actor_id || null, session_id: captured.record.session_id || null,
    session_generation: captured.record.session_generation || null,
    capture_complete: true, lineage: captured.lineage }
}

export async function compareAssessmentEvidence(store, id, runtime, context, input, options = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => !FIELDS.has(key))) {
    throw artifactError('ASSESSMENT_DIFF_FIELDS', 'Use action.help for the exact evidence.diff fields')
  }
  const ids = input.evidence_ids
  if (!Array.isArray(ids) || ids.length !== 2 || ids[0] === ids[1]) {
    throw artifactError('ASSESSMENT_DIFF_IDS', 'Supply exactly two distinct current HTTP evidence IDs')
  }
  const offset = integer(input.offset, 0, Number.MAX_SAFE_INTEGER), limit = integer(input.limit, 50, 100)
  if (!limit) throw artifactError('ASSESSMENT_DIFF_PAGINATION', 'Difference limit must be 1..100')
  if (input.include_values !== undefined && typeof input.include_values !== 'boolean') {
    throw artifactError('ASSESSMENT_DIFF_FIELDS', 'include_values must be a boolean')
  }
  const ignores = input.ignore_selectors ?? []
  if (!Array.isArray(ignores) || ignores.length > 32 || new Set(ignores).size !== ignores.length
    || ignores.some(pointer => typeof pointer !== 'string' || pointer.length > 1024
      || pointer !== '' && !pointer.startsWith('/') || /~(?![01])/g.test(pointer))) {
    throw artifactError('ASSESSMENT_DIFF_SELECTORS', 'ignore_selectors must be distinct bounded exact JSON Pointers')
  }
  const captures = []
  for (const evidenceId of ids) {
    options.signal?.throwIfAborted()
    const captured = await readCurrentAssessmentCapture(store, id, runtime, context, evidenceId, options)
    if (captured.record.complete !== true || captured.artifact.complete !== true) {
      throw artifactError('ASSESSMENT_DIFF_COMPLETE', 'Response comparison requires complete current captures')
    }
    captures.push(captured)
  }
  const [left, right] = captures
  if (left.body.length + right.body.length > MAX_BYTES) {
    throw artifactError('ASSESSMENT_DIFF_BUDGET', 'Combined comparison bodies exceed 2 MiB')
  }
  const secrets = privateObservationValues(store, id, context, captures)
  const a = textOf(left), b = textOf(right), jsonA = parseJson(a), jsonB = parseJson(b)
  const rows = [], omitted = [], usedIgnores = new Set(), includeValues = input.include_values === true
  const json = jsonA.parsed && jsonB.parsed
  let inspected = 0
  if (json) {
    const stack = [{ a: jsonA.value, b: jsonB.value, hasA: true, hasB: true, pointer: '', depth: 0, hidden: false }]
    while (stack.length) {
      options.signal?.throwIfAborted()
      const item = stack.pop()
      if (++inspected > MAX_NODES || item.depth > 32) {
        throw artifactError('ASSESSMENT_DIFF_BUDGET', 'JSON comparison exceeds 10000 nodes or 32 levels; use explicit subtree omissions')
      }
      if (ignores.includes(item.pointer)) { usedIgnores.add(item.pointer); omitted.push(item.pointer); continue }
      for (const value of [item.a, item.b]) if (typeof value === 'number'
        && (!Number.isFinite(value) || Number.isInteger(value) && !Number.isSafeInteger(value))) {
        throw artifactError('ASSESSMENT_DIFF_JSON_NUMBER', 'JSON numbers outside lossless JavaScript comparison remain unresolved; inspect the original response bytes')
      }
      const kindA = item.hasA ? typeOf(item.a) : 'absent', kindB = item.hasB ? typeOf(item.b) : 'absent'
      if (item.hasA && item.hasB && kindA === kindB && ['object', 'array'].includes(kindA)) {
        const keys = [...new Set([...Object.keys(item.a), ...Object.keys(item.b)])].sort((x, y) => kindA === 'array' ? Number(x) - Number(y) : x.localeCompare(y))
        if (keys.length + stack.length + inspected > MAX_NODES) throw artifactError('ASSESSMENT_DIFF_BUDGET', 'JSON comparison exceeds its bounded structure budget')
        for (const key of keys.reverse()) stack.push({ a: item.a[key], b: item.b[key],
          hasA: Object.hasOwn(item.a, key), hasB: Object.hasOwn(item.b, key),
          pointer: item.pointer + '/' + pointerPart(key), depth: item.depth + 1,
          hidden: item.hidden || PRIVATE_HEADER_NAME.test(key) })
        continue
      }
      if (item.hasA && item.hasB && kindA === kindB && Object.is(item.a, item.b)) continue
      rows.push({ selector: safeDiscoveryText(item.pointer, secrets, 1024),
        change: !item.hasA ? 'added' : !item.hasB ? 'removed' : kindA !== kindB ? 'type_changed' : 'value_changed',
        type_a: kindA, type_b: kindB, ...(item.hidden ? { private: true } : {}),
        ...(includeValues ? { value_a: item.hasA ? scalarPreview(item.a, item.hidden, secrets) : '[absent]',
          value_b: item.hasB ? scalarPreview(item.b, item.hidden, secrets) : '[absent]' } : {}) })
    }
  } else {
    if (ignores.length) throw artifactError('ASSESSMENT_DIFF_SELECTORS', 'JSON subtree omissions cannot be applied to non-JSON responses')
    if (a !== b) {
      let start = 0, endA = a.length, endB = b.length
      while (start < Math.min(endA, endB) && a[start] === b[start]) start++
      while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) { endA--; endB-- }
      rows.push({ change: 'text_changed', character_offset: start, changed_characters_a: endA - start,
        changed_characters_b: endB - start,
        ...(includeValues ? { value_a: safeDiscoveryText(a.slice(Math.max(0, start - 32), endA + 32), secrets, 160),
          value_b: safeDiscoveryText(b.slice(Math.max(0, start - 32), endB + 32), secrets, 160) } : {}) })
    }
  }
  return { ok: true, data: { kind: json ? 'json_structure_diff' : 'text_diff', sources: captures.map(capture => sourceOf(capture, secrets)),
    same_status: left.artifact.response.status === right.artifact.response.status,
    exact_body_match: left.body.equals(right.body), compared_values_match: rows.length === 0,
    comparison_complete: true, inspected_nodes: inspected,
    ignored_selectors: ignores.map(pointer => ({ selector: safeDiscoveryText(pointer, secrets, 1024), present: usedIgnores.has(pointer) })),
    omitted_subtrees: omitted.length, items: rows.slice(offset, offset + limit), total: rows.length, offset, limit,
    next_offset: offset + limit < rows.length ? offset + limit : null,
    content_trust: 'untrusted_target_data', reconnaissance_only: true, can_confirm: false, security_coverage_granted: false,
    note: 'Difference and equality summaries do not establish a vulnerability, identity equivalence or completed security tests. JSON compares parsed values; original body digests preserve exact bytes.' }, requests_sent: 0 }
}
