/** Fork keeps its parent's composition; enforce legacy denied capabilities at dispatch. */
export const name = 'dsh-purge-preset-child-policy'
export const inject = ['tools']

export function childPolicyDenial(deny, execution) {
  if (!deny.has(execution.name)) return undefined
  const session = execution.agent?.session || execution.session
  if (!session?.header) return { code: 'PRESET_CHILD_SESSION_REQUIRED', reason: 'Child tool policy requires an actual session identity.' }
  const parent = session.header.parentSession
  if (parent == null || parent === '') return undefined
  return { code: 'PRESET_CHILD_TOOL_DENIED', reason: `The inherited child policy excludes ${execution.name}. Return this task to the parent.` }
}

export function apply(ctx, config) {
  if (!Array.isArray(config?.deny) || !config.deny.length || config.deny.some(value => typeof value !== 'string' || !value)
    || new Set(config.deny).size !== config.deny.length) throw new Error('Invalid inherited child tool policy')
  if (typeof ctx.tools?.guard !== 'function') throw new Error('Inherited fork child policy requires the host tools.guard service')
  const deny = new Set(config.deny)
  ctx.effect(() => ctx.tools.guard(execution => childPolicyDenial(deny, execution)))
}
