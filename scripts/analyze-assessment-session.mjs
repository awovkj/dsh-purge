#!/usr/bin/env node
/** Read a DSH JSONL export; publish counts and references, never session text or credentials. */
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const safeName = value => typeof value === 'string' && /^[A-Za-z0-9_.:-]{1,96}$/.test(value) ? value : 'unknown'
const parse = text => { try { return JSON.parse(text) } catch { return null } }
const messageText = message => (message?.content || []).filter(item => item.type === 'text').map(item => item.text || '').join('\n')
export function analyzeAssessmentSession(source) {
  const rows = [], invalidLines = []
  for (const [index, line] of source.split(/\r?\n/).entries()) {
    if (!line.trim()) continue
    const row = parse(line)
    if (!row || typeof row !== 'object' || Array.isArray(row)) { invalidLines.push(index + 1); continue }
    rows.push({ ...row, line: index + 1 })
  }
  const header = rows.find(row => row.type === 'session')
  const selections = rows.filter(row => row.type === 'agent-preset/selected').map(row => ({
    line: row.line, preset: safeName(row.data?.agentPreset) }))
  const results = new Map(rows.filter(row => row.type === 'tool/result').map(row => [row.data?.message?.toolCallId, row]))
  const counts = {}, failures = [], oracleTypes = {}, findingModes = {}, captures = { complete: 0, incomplete: 0, unknown: 0 },
    reads = { calls: 0, distinct_evidence: 0, scalar_only_calls: 0 }, evidenceIds = new Set()
  let rejectedItems = 0, unparsedResults = 0, unmatchedCalls = 0, apiDocumentCaptures = 0
  const calls = rows.filter(row => row.type === 'tool/call')
  for (const row of calls) {
    const args = parse(row.data.arguments), tool = safeName(row.data.name), action = args?.action === undefined ? null : safeName(args.action)
    const key = action ? tool + ':' + action : tool
    counts[key] = (counts[key] || 0) + 1
    const resultRow = results.get(row.data.callId), result = parse(messageText(resultRow?.data?.message))
    if (!resultRow) unmatchedCalls++
    else if (!result) unparsedResults++
    if (resultRow?.data?.message?.isError || result?.ok === false) failures.push({ line: row.line,
      step: row.data.step, tool, action, error_code: safeName(result?.error_code || result?.error?.code) })
    rejectedItems += (Array.isArray(result?.data?.results) ? result.data.results : []).filter(item => item?.status === 'rejected' || item?.ok === false).length
    if (action === 'http.capture') {
      captures[result?.data?.complete === true ? 'complete' : result?.data?.complete === false ? 'incomplete' : 'unknown']++
      try { if (/\/(?:actuator\/mappings|v3\/api-docs|swagger\.json)\/?$/.test(new URL(args.input?.url).pathname)) apiDocumentCaptures++ } catch { /* absent URL */ }
    }
    if (action === 'evidence.read') { reads.calls++; if (args.input?.evidence_id) evidenceIds.add(args.input.evidence_id); if (args.input?.selector !== undefined) reads.scalar_only_calls++ }
    if (action === 'assessment.evaluate') { const type = safeName(args.input?.oracle?.type); oracleTypes[type] = (oracleTypes[type] || 0) + 1 }
    if (action === 'finding.record') { const mode = safeName(args.input?.mode || (args.input?.decision_id ? 'machine' : 'unspecified')); findingModes[mode] = (findingModes[mode] || 0) + 1 }
  }
  reads.distinct_evidence = evidenceIds.size
  let lastContinuation = null
  for (const row of rows.filter(row => row.type === 'tool/result')) {
    const data = parse(messageText(row.data.message))?.data?.continuation
    if (data) lastContinuation = { line: row.line, ...Object.fromEntries(Object.entries(data).filter(([key, value]) =>
      /^(ready_total|review_total|blocked_total|unresolved_total|actionable_total|frontier_rounds|continue_required|can_finalize|coverage_status)$/.test(key)
        && (typeof value === 'boolean' || Number.isSafeInteger(value) || ['partial', 'complete', 'unknown'].includes(value)))) }
  }
  return { schema: 'dsh-assessment-session-analysis/v1', source_sha256: createHash('sha256').update(source, 'utf8').digest('hex'),
    events: rows.length, invalid_lines: invalidLines, header_preset: safeName(header?.agentPreset), selections,
    selected_preset: selections.at(-1)?.preset || safeName(header?.agentPreset),
    steps_started: rows.filter(row => row.type === 'step/start').length, steps_ended: rows.filter(row => row.type === 'step/end').length,
    tool_calls: calls.length, failures, failed_calls: failures.length, rejected_batch_items: rejectedItems,
    unparsed_results: unparsedResults, unmatched_calls: unmatchedCalls,
    action_counts: Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1])),
    captures, reads, api_document_captures: apiDocumentCaptures, oracle_types: oracleTypes, finding_modes: findingModes,
    continuation_notices: rows.filter(row => row.type === 'user/message' && row.data?.source?.kind === 'dsh-purge-assessment-continuation').length,
    last_continuation: lastContinuation, raw_content_included: false, target_requests_sent: 0 }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [file, flag, output] = process.argv.slice(2)
  if (!file || flag && (flag !== '--out' || !output) || process.argv.length > 5) {
    console.error('Usage: node scripts/analyze-assessment-session.mjs <session.jsonl> [--out <summary.json>]')
    process.exitCode = 1
  } else {
    const summary = JSON.stringify(analyzeAssessmentSession(readFileSync(file, 'utf8')), null, 2) + '\n'
    if (output) writeFileSync(output, summary, 'utf8')
    else process.stdout.write(summary)
  }
}
