/** Persisted session bindings and pre-dispatch guards for scoped assessment modes. */
import { isScopedAssessmentMode, policyTextForMode, requiresBoundAssessment, isModeAllowedTool } from './assessment-policy.js'
import { isPresentationTool, isBoundedRedteamTool } from './mode-tools.js'
import { sessionAgentPreset } from '../identity.js'
import { SRC_NATIVE_SKILL_RESOURCES } from './assessment-skills.js'

export const platformPolicyDenial = reason => '【Purge 平台管控】' + reason
  + ' 此调用在派发前被拒绝，requests_sent:0；请按当前模式和绑定处理，不将此回执记作目标响应或防护证据。'

const activeStores = new Set()
const initializedBindings = new WeakSet()
const knownProtected = new WeakMap()
function rememberPolicy(store, chain, policy) {
  let known = knownProtected.get(store)
  if (!known) { known = new Map(); knownProtected.set(store, known) }
  for (const { id } of chain) {
    if (requiresBoundAssessment(policy)) known.set(id, policy.assessment_mode)
    else known.delete(id)
  }
}
function knownPolicyFault(store, context) {
  try {
    const chain = sessionChainOf(context)
    return hasSrcPreset(context, chain) || hasPentestPreset(context, chain)
      || chain.some(({ id }) => knownProtected.get(store)?.has(id))
  } catch { return false }
}
function hasSrcPreset(context, chain) {
  const selected = value => String(sessionAgentPreset(value) || '').trim().toLowerCase() === 'src'
  return selected(context) || chain.slice(1).some(({ session }) => session && selected({ session }))
}
function hasPentestPreset(context, chain) {
  const selected = value => String(sessionAgentPreset(value) || '').trim().toLowerCase() === 'pentest'
  return selected(context) || chain.slice(1).some(({ session }) => session && selected({ session }))
}

export function sessionChainOf(context) {
  const ids = []
  let session = context?.agent?.session || context?.session
  const visited = new Set()
  for (let depth = 0; session && depth < 64; depth++) {
    const id = session.id == null ? null : String(session.id)
    if (!id || visited.has(id)) break
    visited.add(id); ids.push({ id, session })
    const parentId = session.header?.parentSession
    if (parentId == null || parentId === '') break
    let parent
    try { parent = session.store?.get?.(String(parentId)) } catch { /* Cold parent: its durable binding still applies. */ }
    if (!parent) { ids.push({ id: String(parentId), session: null }); break }
    session = parent
  }
  return ids
}

function bindingDb(store) {
  if (typeof store.kb !== 'function') return null
  const db = store.kb()
  if (initializedBindings.has(db)) return db
  db.exec(`CREATE TABLE IF NOT EXISTS assessment_session_binding (
    session_id TEXT PRIMARY KEY, engagement_id TEXT NOT NULL, assessment_mode TEXT NOT NULL,
    bound_at TEXT NOT NULL
  ); CREATE TABLE IF NOT EXISTS assessment_session_parent (
    session_id TEXT PRIMARY KEY, parent_session_id TEXT NOT NULL
  )`)
  initializedBindings.add(db)
  return db
}

function durableChain(store, context) {
  const chain = sessionChainOf(context)
  if (!chain.length) return { chain, db: null }
  const db = bindingDb(store)
  if (!db) return { chain, db }
  const parentOf = db.prepare('SELECT parent_session_id FROM assessment_session_parent WHERE session_id = ?')
  const remember = db.prepare('INSERT OR IGNORE INTO assessment_session_parent VALUES(?,?)')
  for (const { id, session } of chain) {
    const parent = session?.header?.parentSession
    if (parent == null || parent === '') continue
    const known = parentOf.get(id)
    if (known && known.parent_session_id !== String(parent)) throw new Error('session ancestry changed after its durable binding')
    if (!known) remember.run(id, String(parent))
  }
  const ids = new Set(chain.map(item => item.id))
  while (chain.length) {
    const parent = parentOf.get(chain[chain.length - 1].id)?.parent_session_id
    if (!parent) break
    if (ids.has(parent) || chain.length >= 64) throw new Error('invalid durable session ancestry')
    ids.add(parent); chain.push({ id: parent, session: null })
  }
  return { chain, db }
}

export function sessionPolicyOf(store, context) {
  const { chain, db } = durableChain(store, context)
  let selected = null
  for (const { id } of chain) {
    const binding = db?.prepare('SELECT engagement_id, assessment_mode FROM assessment_session_binding WHERE session_id = ?').get(id)
    if (!binding) continue
    const policy = store.assessmentPolicy(binding.engagement_id)
    if (policy.assessment_mode !== binding.assessment_mode) throw new Error('persistent session assessment mode does not match its engagement')
    const candidate = { engagement_id: binding.engagement_id, ...policy }
    if (requiresBoundAssessment(selected) && requiresBoundAssessment(candidate)
      && (selected.engagement_id !== candidate.engagement_id || selected.assessment_mode !== candidate.assessment_mode)) {
      throw new Error('conflicting scoped assessment ancestor bindings')
    }
    if (!selected || requiresBoundAssessment(candidate)) selected = candidate
  }
  if (!requiresBoundAssessment(selected)) {
    if (hasSrcPreset(context, chain)) return { engagement_id: null, assessment_mode: 'src' }
    if (hasPentestPreset(context, chain)) return { engagement_id: null, assessment_mode: 'pentest' }
    if (sessionAgentPreset(context) === 'redteam') return { engagement_id: null, assessment_mode: 'redteam', scope: [], exclude: [] }
  }
  rememberPolicy(store, chain, selected)
  return selected
}

export function bindTrustedSession(store, context, engagementId) {
  const { chain } = durableChain(store, context)
  if (!chain.length) return
  const policy = store.assessmentPolicy(engagementId)
  const existing = sessionPolicyOf(store, context)
  if (requiresBoundAssessment(existing)) {
    const label = existing.assessment_mode === 'src' ? 'SRC' : existing.assessment_mode
    if (policy.assessment_mode !== existing.assessment_mode) throw new Error(label + ' session cannot bind a ' + policy.assessment_mode + ' engagement')
    if (existing.engagement_id && existing.engagement_id !== engagementId) throw new Error(label + ' session is already bound; use a new session for another engagement')
  }
  const db = bindingDb(store)
  if (!db) throw new Error('durable session binding store unavailable')
  // Every observed ancestor gets its durable policy. A cold intermediate
  // parent cannot hide the root policy from a grandchild with another preset.
  const write = db.prepare(`INSERT INTO assessment_session_binding VALUES(?,?,?,?) ON CONFLICT(session_id)
    DO UPDATE SET engagement_id=excluded.engagement_id,assessment_mode=excluded.assessment_mode,bound_at=excluded.bound_at`)
  db.exec('SAVEPOINT session_policy_bind')
  try {
    for (const { id } of chain) write.run(id, engagementId, policy.assessment_mode, new Date().toISOString())
    db.exec('RELEASE session_policy_bind')
  } catch (error) { db.exec('ROLLBACK TO session_policy_bind; RELEASE session_policy_bind'); throw error }
  if (context?.agent) {
    try { context.agent.redteamEngagementId = engagementId } catch { /* Role rendering only; enforcement uses the database. */ }
    try { context.agent.redteamAssessmentMode = policy.assessment_mode } catch { /* Presentation only. */ }
  }
  rememberPolicy(store, chain, policy)
}

export function isSrcProtected(context) {
  try {
    if (hasSrcPreset(context, sessionChainOf(context))) return true
  } catch { /* A different store does not establish this session's mode. */ }
  for (const store of activeStores) {
    try { if (sessionPolicyOf(store, context)?.assessment_mode === 'src') return true }
    catch { if (knownPolicyFault(store, context)) return true }
  }
  return false
}

export function isAssessmentProtected(context) {
  try {
    const chain = sessionChainOf(context)
    if (hasSrcPreset(context, chain) || hasPentestPreset(context, chain)) return true
  } catch { /* Only a known binding or actual preset establishes protection. */ }
  for (const store of activeStores) {
    try { if (isScopedAssessmentMode(sessionPolicyOf(store, context)?.assessment_mode)) return true }
    catch { if (knownPolicyFault(store, context)) return true }
  }
  return false
}

export function srcToolDenial(store, execution) {
  let policy
  try { policy = sessionPolicyOf(store, execution) }
  catch { return knownPolicyFault(store, execution)
    ? platformPolicyDenial('Assessment policy is unavailable; restore the persistent session binding before executing tools.') : undefined }
  if (!requiresBoundAssessment(policy)) return undefined
  const label = policy.assessment_mode === 'src' ? 'SRC' : policy.assessment_mode
  if (policy.engagement_id) {
    try { bindTrustedSession(store, execution, policy.engagement_id) }
    catch { return platformPolicyDenial(label + ' inherited policy could not be persisted; restore its session binding before execution.') }
  }
  const toolName = execution?.name
  if (toolName === 'skill' && policy.assessment_mode === 'src') {
    const args = execution?.arguments
    // Catalog/root overrides or other skills cannot turn this read-only loader
    // into general filesystem access in a protected SRC session.
    if (args?.name !== 'src-discovery' || Object.keys(args).some(key =>
      !['name', 'resource'].includes(key)) || args.resource !== undefined
        && !SRC_NATIVE_SKILL_RESOURCES.includes(args.resource)) {
      return platformPolicyDenial('SRC skill loading is limited to the bundled src-discovery runbook and its fixed references.')
    }
    return undefined
  }
  const allowed = policy.assessment_mode === 'redteam' ? isBoundedRedteamTool(toolName) : isModeAllowedTool(policy.assessment_mode, toolName)
  if (!allowed && !isPresentationTool(toolName)) {
    return platformPolicyDenial(label + ' mode blocks this tool before dispatch; use redteam_assessment_run with action.help, workspace.list/read or offline evidence tools.')
  }
  const explicit = execution?.arguments?.engagement
  if (policy.engagement_id && explicit && toolName !== 'redteam_session_bind' && explicit !== policy.engagement_id) return platformPolicyDenial(label + ' tool arguments cannot replace the bound engagement.')
  return undefined
}

export function installSrcExecutionGuard(ctx, store) {
  if (!ctx || !store || typeof store.assessmentPolicy !== 'function') return
  activeStores.add(store)
  ctx.effect(() => () => activeStores.delete(store))
  if (typeof ctx.on === 'function') {
    const release = ctx.on('session/created', session => {
      const context = { session }
      const policy = sessionPolicyOf(store, context)
      if (policy?.engagement_id) bindTrustedSession(store, context, policy.engagement_id)
    }, { global: true })
    if (typeof release === 'function') ctx.effect(() => release)
  }
  const install = scope => {
    const tools = scope.tools
    const deny = execution => srcToolDenial(store, execution)
    if (typeof tools?.guard === 'function') {
      // SDK guards run after the extensible approval waterfall. An approval
      // plugin cannot turn another guard's denial into an allowed execution.
      const release = tools.guard(deny)
      if (typeof release === 'function') scope.effect(() => release)
    } else if (typeof scope.on === 'function') {
      const release = scope.on('tools/execute', async (execution, next) => {
        const reason = deny(execution)
        if (reason) throw new Error(reason)
        return next()
      }, { global: true, prepend: true })
      if (typeof release === 'function') scope.effect(() => release)
    } else throw new Error('Scoped assessment execution guard requires the host tool dispatch API')
  }
  if (typeof ctx.inject === 'function') ctx.inject(['tools'], install)
  else if (ctx.tools) install(ctx)
  if (typeof ctx.inject === 'function') {
    ctx.inject(['systemPrompt'], scope => {
      scope.effect(() => scope.systemPrompt.section({ name: 'assessment:mode-policy', order: 430,
        text: context => {
          const mode = sessionPolicyOf(store, context)?.assessment_mode
          return policyTextForMode(mode)
        } }), 'assessment.mode-policy')
    })
  }
}
