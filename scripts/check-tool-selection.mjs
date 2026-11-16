import { createHash } from 'node:crypto'
import { lstatSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { evaluateToolSelection, TOOL_SELECTION_CASES } from './lib/tool-selection-benchmark.mjs'

try {
  const flags = process.argv.slice(2)
  if (flags.length === 1 && flags[0] === '--cases') {
    console.log(JSON.stringify({ schema: 'purge-tool-selection-cases/v1', cases: TOOL_SELECTION_CASES,
      mode: 'fixed_observable_fixtures_no_target_execution' }, null, 2))
  } else {
    if (flags.length !== 2 || flags[0] !== '--input') throw new Error('Use --cases or --input <recorded-trace.json>')
    const input = resolve(flags[1]), state = lstatSync(input)
    if (!state.isFile() || state.isSymbolicLink() || state.size > 4 * 1024 * 1024) throw new Error('Trace must be a regular JSON file of at most 4 MiB')
    const bytes = readFileSync(input)
    const trace = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
    const result = evaluateToolSelection(trace)
    console.log(JSON.stringify({ ...result, trace_sha256: createHash('sha256').update(bytes).digest('hex') }, null, 2))
    if (result.summary.failed) process.exitCode = 1
  }
} catch (error) {
  console.error('Tool-selection evaluation failed: ' + (error instanceof SyntaxError ? 'Invalid trace JSON' : error.message))
  process.exitCode = 1
}
