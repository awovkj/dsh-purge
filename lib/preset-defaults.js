/** Known required defaults; explicit user choices and expressions retain their semantics. */
export const PRESET_DEFAULTS = Object.freeze({
  todo: Object.freeze({ allowParallelInProgress: true }),
  pruner: Object.freeze({ thresholdChars: 8192, headChars: 4096, tailChars: 1024 }),
})

export function withPresetDefaults(definition) {
  const adapt = rows => rows.map(row => {
    const defaults = row.name === '@deepseek-ai/dsh-tool-todo' ? PRESET_DEFAULTS.todo
      : row.name === '@deepseek-ai/dsh-compaction-tool-result-pruner' ? PRESET_DEFAULTS.pruner : null
    const out = row.group === true ? { ...row, config: adapt(row.config) } : { ...row }
    if (defaults && (row.config === undefined || row.config === null
      || typeof row.config === 'object' && !Array.isArray(row.config) && !row.config.__jsExpr)) {
      out.config = { ...defaults, ...row.config }
    }
    return out
  })
  return { ...definition, plugins: adapt(definition.plugins) }
}

export const SHARED_TODO_YAML = `- id: tool-todo
  name: '@deepseek-ai/dsh-tool-todo'
  config:
    allowParallelInProgress: ${PRESET_DEFAULTS.todo.allowParallelInProgress}
`
export const SHARED_PRESENT_YAML = `- id: tool-present
  name: '@deepseek-ai/dsh-tool-present'
`
export const SHARED_COMPACTION_YAML = `- id: compaction
  name: cordis:group
  group: true
  isolate:
    compaction: true
    toolResultPruner: true
  config:
    - id: compaction-basic
      name: '@deepseek-ai/dsh-compaction-basic'
    - id: command-compact
      name: '@deepseek-ai/dsh-command-compact'
    - id: tool-result-pruner
      name: '@deepseek-ai/dsh-compaction-tool-result-pruner'
      config:
        thresholdChars: ${PRESET_DEFAULTS.pruner.thresholdChars}
        headChars: ${PRESET_DEFAULTS.pruner.headChars}
        tailChars: ${PRESET_DEFAULTS.pruner.tailChars}
`
