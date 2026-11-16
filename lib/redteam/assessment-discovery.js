/** Offline API-document ingestion from current evidence, using the native importer. */
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { assertNoLinkedDescendants } from '../path-boundary.js'
import { atomicWriteSync } from '../atomic-files.js'
import { artifactError, sha256 } from './assessment-artifacts.js'
import { readCurrentAssessmentCapture } from './assessment-observation.js'
import { INTERNAL_PROJECT_ID, callAssessmentRuntime } from './native-assessment.js'

const METHODS = new Set(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'])
const HELP = { required: ['evidence_id', 'format'], fields: {
  evidence_id: 'One complete, current HTTP JSON E-ID in this internal assessment',
  format: 'openapi (OpenAPI 3.x) | spring-mappings (actual Actuator contexts/mappings/dispatcherServlets document)' },
notes: ['Offline, hash-checked API discovery; no target requests. Routes outside scope remain rejected by the native importer.',
  'Spring mappings are converted into declared OpenAPI routes and exact declared methods. Unknown methods, wildcards and regex paths remain unresolved; no auth policy, DTO field or vulnerability is invented.',
  'Native sources refer to the derived document hash. The original evidence and artifact hashes are returned separately; document import is reconnaissance, not runtime proof.'] }
export const isDocumentDiscoveryAction = action => action === 'surface.from_document'
export function documentDiscoveryActionHelp(name) {
  return isDocumentDiscoveryAction(name) ? { ok: true, data: { action: name, group: 'dsh_embedded_observation',
    contract_version: 1, project_required: true, ...HELP }, requests_sent: 0 } : null
}

/** Only structured method/pattern declarations count; predicate prose is never parsed. */
export function springMappingsDocument(document, origin) {
  if (!document?.contexts || typeof document.contexts !== 'object' || Array.isArray(document.contexts)) {
    throw artifactError('ASSESSMENT_MAPPING_FORMAT', 'Use an actual Spring Actuator contexts/mappings document')
  }
  const paths = Object.create(null), unresolved = []
  let handlers = 0, declared = 0
  const skip = (index, reason) => { if (unresolved.length < 1000) unresolved.push({ handler_index: index, reason }) }
  for (const context of Object.values(document.contexts)) {
    const servlets = context?.mappings?.dispatcherServlets
    if (!servlets || typeof servlets !== 'object' || Array.isArray(servlets)) continue
    for (const rows of Object.values(servlets)) {
      if (!Array.isArray(rows)) throw artifactError('ASSESSMENT_MAPPING_FORMAT', 'Dispatcher servlet mappings must contain arrays')
      for (const row of rows) {
        const index = handlers++
        if (handlers > 5000) throw artifactError('ASSESSMENT_MAPPING_BUDGET', 'Mapping discovery exceeds 5000 handlers')
        const conditions = row?.details?.requestMappingConditions
        const patterns = conditions?.patterns, methods = conditions?.methods
        if (!Array.isArray(patterns) || !patterns.length || !Array.isArray(methods) || !methods.length) {
          skip(index, 'exact_path_or_method_not_declared'); continue
        }
        if (patterns.length > 100 || methods.length > 7) throw artifactError('ASSESSMENT_MAPPING_BUDGET', 'Mapping condition exceeds its route budget')
        if (conditions.params !== undefined && (!Array.isArray(conditions.params) || conditions.params.length > 100)) {
          throw artifactError('ASSESSMENT_MAPPING_FORMAT', 'Mapping params must be a bounded array of actual conditions')
        }
        let supported = false
        for (const path of patterns) {
          if (typeof path !== 'string' || path.length > 2048 || !path.startsWith('/') || path.startsWith('//')
            || /[\\\x00-\x20*?#]/.test(path) || /\{[^}]*:/.test(path)
            || (path.replace(/\{[A-Za-z_][\w-]*\}/g, '').match(/[{}]/))) {
            skip(index, 'wildcard_regex_or_ambiguous_path'); continue
          }
          for (const method of methods) {
            if (!METHODS.has(method)) { skip(index, 'method_requires_explicit_review'); continue }
            const parameters = [...path.matchAll(/\{([A-Za-z_][\w-]*)\}/g)].map(match => ({
              name: match[1], in: 'path', required: true, schema: { type: 'string' } }))
            // Mapping params specify conditions, not arbitrary DTO/body fields.
            for (const param of conditions.params || []) {
              const name = typeof param === 'string' ? /^([A-Za-z_][\w.-]*)(?:=.*)?$/.exec(param)?.[1] : null
              if (name) parameters.push({ name, in: 'query', required: true, schema: { type: 'string' } })
            }
            paths[path] ||= Object.create(null)
            if (!Object.hasOwn(paths[path], method.toLowerCase())) declared++
            if (declared > 5000) throw artifactError('ASSESSMENT_MAPPING_BUDGET', 'Mapping discovery exceeds 5000 method/path pairs')
            const existing = paths[path][method.toLowerCase()]?.parameters || []
            const combined = new Map([...existing, ...parameters].map(parameter => [parameter.in + ':' + parameter.name, parameter]))
            paths[path][method.toLowerCase()] = { parameters: [...combined.values()], responses: { default: { description: 'Response shape and access policy remain unverified' } } }
            supported = true
          }
        }
        if (!supported && !unresolved.some(item => item.handler_index === index)) skip(index, 'unresolved_mapping')
      }
    }
  }
  if (!handlers) throw artifactError('ASSESSMENT_MAPPING_FORMAT', 'No structured dispatcher servlet mappings were present')
  return { document: { openapi: '3.0.3', info: { title: 'Observed Spring mapping declarations', version: '1' },
    servers: [{ url: new URL(origin).origin }], paths }, handlers, declared, unresolved,
    unresolved_truncated: unresolved.length === 1000 }
}
export async function discoverAssessmentDocument(store, id, runtime, context, input, options = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)
    || Object.keys(input).some(key => !['evidence_id', 'format'].includes(key))
    || !['openapi', 'spring-mappings'].includes(input.format)) {
    throw artifactError('ASSESSMENT_DOCUMENT_FIELDS', 'Use action.help for surface.from_document evidence_id and format')
  }
  const captured = await readCurrentAssessmentCapture(store, id, runtime, context, input.evidence_id, options)
  if (captured.record.complete !== true || captured.artifact.complete !== true || captured.body.length > 2 * 1024 * 1024) {
    throw artifactError('ASSESSMENT_DOCUMENT_COMPLETE', 'API discovery requires a complete current JSON capture of at most 2 MiB')
  }
  let source
  try { source = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(captured.body)) }
  catch { throw artifactError('ASSESSMENT_DOCUMENT_JSON', 'The captured API document must be intact UTF-8 JSON') }
  const conversion = input.format === 'spring-mappings' ? springMappingsDocument(source, captured.artifact.request.url) : null
  if (!conversion && (!source || typeof source !== 'object' || !/^3\./.test(source.openapi || ''))) {
    throw artifactError('ASSESSMENT_DOCUMENT_FORMAT', 'openapi requires an actual OpenAPI 3.x document')
  }
  const body = conversion ? Buffer.from(JSON.stringify(conversion.document), 'utf8') : captured.body
  if (body.length > 2 * 1024 * 1024) throw artifactError('ASSESSMENT_DOCUMENT_BUDGET', 'Derived API document exceeds 2 MiB')
  const base = store.dirOf(id), dir = assertNoLinkedDescendants(base, join(base, 'assessment', 'discovery'))
  mkdirSync(dir, { recursive: true, mode: 0o700 })
  const path = assertNoLinkedDescendants(base, join(dir, sha256(body) + '.json'))
  atomicWriteSync(path, body, 'utf8', { mode: 0o600 })
  const result = await callAssessmentRuntime(runtime, 'surface.import', { project_id: INTERNAL_PROJECT_ID,
    path, format: 'openapi', base_url: captured.artifact.request.url }, options)
  return { ...result, source_evidence_ids: [captured.record.id], source_artifact_sha256: captured.record.sha256,
    source_body_sha256: sha256(captured.body), derived_sha256: sha256(body), source_format: input.format,
    ...(conversion ? { mapping_summary: { handlers: conversion.handlers, declared: conversion.declared,
      unresolved: conversion.unresolved, unresolved_truncated: conversion.unresolved_truncated } } : {}),
    reconnaissance_only: true, can_confirm: false, requests_sent: 0 }
}
