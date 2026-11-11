/** Persisted session bindings and a monotonic, pre-dispatch SRC tool guard. */
import { isSrcAllowedTool, SRC_POLICY_TEXT } from './assessment-policy.js'
import { sessionAgentPreset } from '../identity.js'

const activeStores = new Set()
const initializedBindings = new WeakSet()
const presentationTools = new Set(['todo_write', 'present'])
function hasSrcPreset(context, chain) {
  const selected = value => String(sessionAgentPreset(value) || '').trim().toLowerCase() === 'src'
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
    if (selected?.assessment_mode === 'src' && candidate.assessment_mode === 'src'
      && selected.engagement_id !== candidate.engagement_id) throw new Error('conflicting SRC ancestor bindings')
    if (!selected || candidate.assessment_mode === 'src') selected = candidate
  }
  if (hasSrcPreset(context, chain) && selected?.assessment_mode !== 'src') {
    return { engagement_id: null, assessment_mode: 'src' }
  }
  return selected
}

export function bindTrustedSession(store, context, engagementId) {
  const { chain } = durableChain(store, context)
  if (!chain.length) return
  const policy = store.assessmentPolicy(engagementId)
  const existing = sessionPolicyOf(store, context)
  if (existing?.assessment_mode === 'src' && policy.assessment_mode !== 'src') throw new Error('SRC session cannot bind a redteam engagement')
  if (existing?.assessment_mode === 'src' && existing.engagement_id && existing.engagement_id !== engagementId) throw new Error('SRC session is already bound; use a new SRC session for another engagement')
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
}

export function isSrcProtected(context) {
  try {
    if (hasSrcPreset(context, sessionChainOf(context))) return true
  } catch { return activeStores.size > 0 }
  for (const store of activeStores) {
    try { if (sessionPolicyOf(store, context)?.assessment_mode === 'src') return true }
    catch { return true }
  }
  return false
}

export function srcToolDenial(store, execution) {
  let policy
  try { policy = sessionPolicyOf(store, execution) }
  catch { return 'SRC policy is unavailable; restore the persistent session binding before executing tools.' }
  if (policy?.assessment_mode !== 'src') return undefined
  if (policy.engagement_id) {
    try { bindTrustedSession(store, execution, policy.engagement_id) }
    catch { return 'SRC inherited policy could not be persisted; restore its session binding before execution.' }
  }
  const toolName = execution?.name
  if (!isSrcAllowedTool(toolName) && !presentationTools.has(toolName)) {
    return 'SRC discovery mode blocks this tool before dispatch; use the internal redteam_assessment_run or offline evidence tools.'
  }
  const explicit = execution?.arguments?.engagement
  if (policy.engagement_id && explicit && explicit !== policy.engagement_id) return 'SRC tool arguments cannot replace the bound engagement.'
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
      if (policy?.assessment_mode === 'src' && policy.engagement_id) bindTrustedSession(store, context, policy.engagement_id)
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
    } else throw new Error('SRC execution guard requires the host tool dispatch API')
  }
  if (typeof ctx.inject === 'function') ctx.inject(['tools'], install)
  else if (ctx.tools) install(ctx)
  if (typeof ctx.inject === 'function') {
    ctx.inject(['systemPrompt'], scope => scope.systemPrompt.section({ name: 'src:discovery-policy', order: 430,
      text: context => sessionPolicyOf(store, context)?.assessment_mode === 'src' ? SRC_POLICY_TEXT : '' }))
  }
}
