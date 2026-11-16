/** Engagement-wide delegation leases enforced at the real tool dispatch. */
import { AsyncLocalStorage } from 'node:async_hooks'
import { randomUUID } from 'node:crypto'
import { maxAgentsOf } from './settings.js'
import { bindTrustedSession, sessionPolicyOf, sessionChainOf } from './session-policy.js'
import { sessionAgentPreset } from '../identity.js'

const schedulers = new WeakMap()
const dispatchContext = new AsyncLocalStorage()
const delegationNames = new Set(['subagent', 'subagent_fork', 'subagent_codex', 'subagent_claude_code',
  'workflow', 'ralph', 'spawn_teammate'])
const dispatching = execution => delegationNames.has(execution.name)
  || execution.name === 'subagent_control' && ['resume', 'continue', 'start'].includes(execution.arguments?.action)
const resumable = execution => execution.name === 'subagent_control'
  && ['resume', 'continue', 'start'].includes(execution.arguments?.action)
const failure = (code, message) => Object.assign(new Error(message), { code })
const validId = value => (typeof value === 'string' || typeof value === 'number')
  && String(value).length > 0 && String(value).length <= 240 && !/[\x00-\x20]/.test(String(value))
function childIds(info = {}) {
  if (!info || typeof info !== 'object' || Array.isArray(info)) return []
  const session = info.sessionId ?? info.session_id ?? info.session?.id
  const registry = info.subagentId ?? info.subagent_id ?? info.run_id ?? info.id
  return [...new Set([validId(session) ? 'session:' + session : null,
    validId(registry) ? 'registry:' + registry : null].filter(Boolean))]
}
function resumeIds(execution) {
  const args = execution.arguments || {}, values = [args.id, args.subagent_id, args.agent_id,
    args.session_id, args.sessionId].filter(validId)
  return [...new Set(values.flatMap(value => ['session:' + value, 'registry:' + value]))]
}
function resultIds(result) {
  let value = result?.structuredContent ?? result?.data ?? result?.value ?? result
  if (!childIds(value).length && Array.isArray(result?.content)) {
    const text = result.content.find(item => item.type === 'text' && typeof item.text === 'string' && item.text.length <= 65536)?.text
    if (text) { try { value = JSON.parse(text) } catch { /* no reliable child reference */ } }
  }
  return childIds(value)
}
const identity = execution => {
  const chain = sessionChainOf(execution)
  if (!chain.length) throw failure('AGENT_SESSION_REQUIRED', 'Delegation requires an actual bound session')
  return { owner: chain[0].id, root: chain[chain.length - 1].id, child: chain.length > 1 }
}
const DDL = `CREATE TABLE IF NOT EXISTS redteam_agent_lease (
  slot_id TEXT PRIMARY KEY, engagement_id TEXT NOT NULL, owner_session TEXT NOT NULL,
  root_session TEXT NOT NULL, child_session TEXT, label TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('reserved','dispatching','running','released')),
  created_at INTEGER NOT NULL, expires_at INTEGER
);
CREATE INDEX IF NOT EXISTS redteam_agent_lease_engagement ON redteam_agent_lease(engagement_id,state);
CREATE UNIQUE INDEX IF NOT EXISTS redteam_agent_lease_active_child ON redteam_agent_lease(child_session)
  WHERE child_session IS NOT NULL AND state != 'released';
CREATE TABLE IF NOT EXISTS redteam_agent_alias (
  engagement_id TEXT NOT NULL, alias_id TEXT NOT NULL, slot_id TEXT NOT NULL,
  PRIMARY KEY(engagement_id,alias_id)
);`

export function agentSchedulerOf(store, ctx) {
  if (schedulers.has(store)) {
    const scheduler = schedulers.get(store)
    if (ctx) scheduler.setContext(ctx)
    return scheduler
  }
  const db = store.kb()
  db.exec(DDL)
  let attached = false
  const cap = () => maxAgentsOf(store.root, process.env)
  const expire = () => db.prepare("UPDATE redteam_agent_lease SET state='released' WHERE state='reserved' AND child_session IS NULL AND expires_at IS NOT NULL AND expires_at < ?").run(Date.now())
  const rows = engagement => db.prepare("SELECT * FROM redteam_agent_lease WHERE engagement_id = ? AND state != 'released' ORDER BY created_at,slot_id").all(engagement)
  function transact(action) {
    const nested = db.isTransaction === true
    db.exec(nested ? 'SAVEPOINT agent_lease_write' : 'BEGIN IMMEDIATE')
    try { const result = action(); db.exec(nested ? 'RELEASE agent_lease_write' : 'COMMIT'); return result }
    catch (error) { db.exec(nested ? 'ROLLBACK TO agent_lease_write; RELEASE agent_lease_write' : 'ROLLBACK'); throw error }
  }

  const policyOf = execution => sessionPolicyOf(store, execution)
    || (/^redteam(?:$|-child-)/.test(String(sessionAgentPreset(execution) || ''))
      ? { assessment_mode: 'redteam', engagement_id: null } : null)

  function byAliases(engagement, ids, activeOnly = false) {
    const found = new Map()
    for (const alias of ids) {
      const row = db.prepare(`SELECT lease.* FROM redteam_agent_alias AS alias
        JOIN redteam_agent_lease AS lease ON lease.slot_id=alias.slot_id
        WHERE alias.engagement_id=? AND alias.alias_id=?`).get(engagement, alias)
      if (row && (!activeOnly || row.state !== 'released')) found.set(row.slot_id, row)
    }
    if (found.size > 1) throw failure('AGENT_IDENTITY_CONFLICT', 'Child registry/session references point to different leases; retain the tasks for explicit reconciliation')
    return [...found.values()][0] || null
  }

  function associate(engagement, slot, ids) {
    const active = byAliases(engagement, ids, true)
    if (active && active.slot_id !== slot) throw failure('AGENT_IDENTITY_CONFLICT', 'An actual child already belongs to another active lease')
    for (const alias of ids) db.prepare(`INSERT INTO redteam_agent_alias VALUES(?,?,?)
      ON CONFLICT(engagement_id,alias_id) DO UPDATE SET slot_id=excluded.slot_id`).run(engagement, alias, slot)
    const actual = ids.find(value => value.startsWith('session:'))?.slice(8)
    if (actual) db.prepare("UPDATE redteam_agent_lease SET child_session=?,state='running',expires_at=NULL WHERE slot_id=? AND state != 'released'").run(actual, slot)
  }

  async function reconcile(engagement) {
    expire()
    let registry
    try { registry = ctx?.get?.('subagents') } catch { /* leases still enforce dispatch */ }
    if (typeof registry?.listChildren !== 'function') return { registry_available: false, live: [] }
    const roots = new Set(rows(engagement).flatMap(row => [row.root_session, row.owner_session]))
    if (db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='assessment_session_binding'").get()) {
      for (const row of db.prepare('SELECT session_id FROM assessment_session_binding WHERE engagement_id = ?').all(engagement)) roots.add(row.session_id)
    }
    if (roots.size > 256) throw failure('AGENT_REGISTRY_BUDGET', 'Too many bound sessions to establish a complete delegation count')
    const childrenById = new Map()
    for (const parent of roots) {
      let children
      try { children = await registry.listChildren(parent) }
      catch { return { registry_available: false, live: [], registry_note: 'Registry lookup failed; existing leases remain active.' } }
      for (const child of Array.isArray(children) ? children : []) {
        if (child?.kind !== 'child') continue
        const ids = childIds(child)
        if (!ids.length) continue
        const terminal = ['completed', 'failed', 'cancelled', 'stopped', 'done', 'idle'].includes(child.activity)
        const id = ids.find(value => value.startsWith('session:')) || ids[0]
        const row = { id, ids, parent, terminal, activity: child.activity || 'unknown', label: String(child.label || id).slice(0, 160) }
        // Running wins over an older idle entry when a registry repeats a child.
        if (!childrenById.has(id) || !terminal) childrenById.set(id, row)
      }
    }
    transact(() => {
      for (const child of childrenById.values()) {
        let existing = byAliases(engagement, child.ids)
        const actual = child.ids.find(value => value.startsWith('session:'))?.slice(8)
        if (!existing && actual) existing = db.prepare('SELECT * FROM redteam_agent_lease WHERE engagement_id=? AND child_session=? ORDER BY created_at DESC LIMIT 1').get(engagement, actual)
        if (!existing) {
          const slot = randomUUID()
          db.prepare('INSERT INTO redteam_agent_lease VALUES(?,?,?,?,?,?,?,?,?)').run(slot, engagement,
            child.parent, child.parent, actual || child.id, child.label, child.terminal ? 'released' : 'running', Date.now(), null)
          existing = { slot_id: slot }
        } else db.prepare('UPDATE redteam_agent_lease SET state=?,expires_at=NULL WHERE slot_id=?').run(child.terminal ? 'released' : 'running', existing.slot_id)
        associate(engagement, existing.slot_id, child.ids)
      }
    })
    return { registry_available: true, live: [...childrenById.values()].filter(child => !child.terminal) }
  }

  function projection(engagement, registry = {}) {
    const active = rows(engagement)
    const used = new Set(active.map(row => row.child_session ? 'child:' + row.child_session : 'slot:' + row.slot_id)).size
    return { ok: true, engagement, max: cap(), used, free: Math.max(cap() - used, 0),
      scope: 'engagement', dispatch_enforced: attached, registry_available: registry.registry_available ?? false,
      registry_note: registry.registry_note, reservations: active.map(row => ({ key: row.slot_id,
        owner_session: row.owner_session, child_session: row.child_session, label: row.label,
        state: row.state, at: row.created_at, expires_at: row.expires_at })) }
  }

  function reserve(engagement, execution, label = 'task', consume = false) {
    const caller = identity(execution)
    if (caller.child) throw failure('REDTEAM_LEAF_DELEGATION_DENIED', 'A redteam execution child is a leaf; return findings and blockers to its commander')
    return transact(() => {
      expire()
      const active = rows(engagement)
      if (resumable(execution)) {
        const ids = resumeIds(execution), prior = byAliases(engagement, ids)
        if (!ids.length || !prior) throw failure('AGENT_RESUME_BINDING_REQUIRED', 'Resume requires the exact recorded child registry/session ID in this engagement')
        if (prior.owner_session !== caller.owner && prior.root_session !== caller.root) throw failure('AGENT_RESUME_OWNER', 'Only the recorded parent/root may resume this child')
        if (prior.state !== 'released') {
          db.prepare("UPDATE redteam_agent_lease SET state='dispatching',expires_at=NULL WHERE slot_id=?").run(prior.slot_id)
          return { slot: prior.slot_id, reused: true, resume: true, ...caller }
        }
        if (active.length >= cap()) throw failure('REDTEAM_AGENT_CAP', 'This engagement has reached its execution-agent limit')
        const slot = randomUUID()
        db.prepare('INSERT INTO redteam_agent_lease VALUES(?,?,?,?,?,?,?,?,?)').run(slot, engagement,
          caller.owner, caller.root, prior.child_session, String(label).slice(0, 160), 'dispatching', Date.now(), null)
        const recorded = db.prepare('SELECT alias_id FROM redteam_agent_alias WHERE engagement_id=? AND slot_id=?').all(engagement, prior.slot_id).map(row => row.alias_id)
        associate(engagement, slot, recorded)
        return { slot, resume: true, ...caller }
      }
      if (consume) {
        const existing = active.find(row => row.owner_session === caller.owner && row.state === 'reserved')
        if (existing) {
          db.prepare("UPDATE redteam_agent_lease SET state='dispatching',expires_at=? WHERE slot_id=?").run(Date.now() + 600000, existing.slot_id)
          return { slot: existing.slot_id, ...caller }
        }
      }
      // This write is inside SQLite's write transaction, shared across roots
      // and processes. No async call separates the count from the reservation.
      if (active.length >= cap()) throw failure('REDTEAM_AGENT_CAP', 'This engagement has reached its execution-agent limit')
      const slot = randomUUID()
      db.prepare('INSERT INTO redteam_agent_lease VALUES(?,?,?,?,?,?,?,?,?)').run(slot, engagement, caller.owner,
        caller.root, null, String(label).slice(0, 160), consume ? 'dispatching' : 'reserved', Date.now(), Date.now() + (consume ? 600000 : 300000))
      return { slot, ...caller }
    })
  }

  function release(engagement, execution, key) {
    const caller = identity(execution)
    const row = key ? db.prepare("SELECT * FROM redteam_agent_lease WHERE slot_id=? AND engagement_id=? AND owner_session=? AND state != 'released'").get(key, engagement, caller.owner)
      : rows(engagement).find(row => row.owner_session === caller.owner && row.state === 'reserved')
    if (!row) return false
    if (row.child_session || row.state !== 'reserved') throw failure('AGENT_STILL_ACTIVE', 'A running/dispatching child releases its own lease on completion; stop the child first')
    db.prepare("UPDATE redteam_agent_lease SET state='released' WHERE slot_id=?").run(row.slot_id)
    return true
  }

  function attachChild(session) {
    if (!session?.id || session?.header?.parentSession == null) return
    const execution = { session }, policy = sessionPolicyOf(store, execution)
    const parent = sessionChainOf(execution)[1]?.id
    if (!parent) throw failure('AGENT_PARENT_REQUIRED', 'A created child needs its actual parent session identity')
    if (policy?.assessment_mode !== 'redteam' || !policy.engagement_id) return
    bindTrustedSession(store, execution, policy.engagement_id)
    const current = dispatchContext.getStore()
    transact(() => {
      const already = db.prepare("SELECT slot_id FROM redteam_agent_lease WHERE child_session=? AND state != 'released'").get(String(session.id))
      if (already) { associate(policy.engagement_id, already.slot_id, ['session:' + session.id]); return }
      const slot = current?.engagement === policy.engagement_id && current.owner === String(parent)
        ? db.prepare("SELECT * FROM redteam_agent_lease WHERE slot_id=? AND state='dispatching' AND child_session IS NULL").get(current.slot)
        : null
      if (slot) associate(policy.engagement_id, slot.slot_id, ['session:' + session.id])
      else {
        expire()
        if (rows(policy.engagement_id).length >= cap()) throw failure('REDTEAM_AGENT_CAP', 'The engagement cannot start another child')
        const slotId = randomUUID()
        db.prepare('INSERT INTO redteam_agent_lease VALUES(?,?,?,?,?,?,?,?,?)').run(slotId, policy.engagement_id,
          String(parent), sessionChainOf(execution).at(-1)?.id || String(parent), String(session.id), 'child', 'running', Date.now(), null)
        associate(policy.engagement_id, slotId, ['session:' + session.id])
      }
    })
  }

  function endChild(info) {
    const ids = childIds(info)
    transact(() => {
      for (const alias of ids) for (const row of db.prepare('SELECT slot_id FROM redteam_agent_alias WHERE alias_id=?').all(alias)) {
        db.prepare("UPDATE redteam_agent_lease SET state='released' WHERE slot_id=?").run(row.slot_id)
      }
      const session = info?.sessionId ?? info?.session_id ?? info?.session?.id
      if (validId(session)) db.prepare("UPDATE redteam_agent_lease SET state='released' WHERE child_session=?").run(String(session))
    })
  }

  function denial(execution) {
    if (!dispatching(execution)) return undefined
    try {
      const policy = policyOf(execution)
      if (policy?.assessment_mode !== 'redteam') return undefined
      if (!policy.engagement_id) return 'Bind a redteam engagement before delegating a task.'
      if (identity(execution).child) return 'Redteam execution children are leaves; report to the parent instead of delegating.'
    } catch { return 'Delegation requires a readable durable engagement/session binding.' }
    return undefined
  }

  function settleDispatchFailure(lease, outcome) {
    // ToolRuntime may turn a thrown body error into an isError result and drop
    // its custom metadata. An error alone never proves that no child started.
    // Only an explicit trusted no-start receipt can release a fresh lease.
    const detail = outcome?.error || outcome
    const uncertain = outcome?.dispatch_uncertain === true || detail?.dispatch_uncertain === true
    const notStarted = !uncertain && (outcome?.dispatch_started === false || detail?.dispatch_started === false
      || outcome?.dispatch_not_started === true || detail?.dispatch_not_started === true)
    if (lease.reused) {
      db.prepare("UPDATE redteam_agent_lease SET state='running' WHERE slot_id=? AND state != 'released'").run(lease.slot)
    } else if (notStarted) {
      db.prepare("UPDATE redteam_agent_lease SET state='released' WHERE slot_id=? AND state != 'released'"
        + (lease.resume ? '' : ' AND child_session IS NULL')).run(lease.slot)
    }
    // Unknown dispatches retain dispatching/running occupancy until an exact
    // child identity and terminal receipt establish completion. No time-based
    // recovery is permitted for these leases.
  }

  async function around(execution, next) {
    if (!dispatching(execution)) return next()
    if (dispatchContext.getStore()?.execution === execution) return next()
    const policy = policyOf(execution)
    if (policy?.assessment_mode !== 'redteam') return next()
    const denied = denial(execution)
    if (denied) throw failure('REDTEAM_DELEGATION_DENIED', denied)
    await reconcile(policy.engagement_id)
    const lease = reserve(policy.engagement_id, execution, execution.arguments?.label || execution.name, true)
    return dispatchContext.run({ ...lease, engagement: policy.engagement_id, execution }, async () => {
      try {
        const result = await next()
        if (result?.isError) {
          settleDispatchFailure(lease, result)
        } else transact(() => associate(policy.engagement_id, lease.slot, resultIds(result)))
        return result
      } catch (error) {
        settleDispatchFailure(lease, error)
        throw error
      }
    })
  }

  const scheduler = { denial, around, attachChild, endChild, setContext: value => { ctx = value }, markAttached: () => { attached = true },
    async status(engagement) { return projection(engagement, await reconcile(engagement)) },
    async acquire(engagement, execution, label) {
      const registry = await reconcile(engagement), lease = reserve(engagement, execution, label)
      return { ...projection(engagement, registry), slot: lease.slot }
    },
    async release(engagement, execution, key) {
      const registry = await reconcile(engagement)
      const released = release(engagement, execution, key)
      return { ...projection(engagement, registry), released }
    } }
  schedulers.set(store, scheduler)
  return scheduler
}

export function installAgentScheduler(ctx, store) {
  const scheduler = agentSchedulerOf(store, ctx)
  const listen = (event, fn) => {
    const dispose = ctx.on(event, fn, { global: true, prepend: true })
    if (typeof dispose === 'function') ctx.effect(() => dispose)
  }
  listen('session/created', scheduler.attachChild)
  listen('subagent/end', scheduler.endChild)
  const install = scope => {
    const guard = scope.tools?.guard?.(scheduler.denial)
    if (typeof guard === 'function') scope.effect(() => guard)
    const release = scope.on('tools/execute', scheduler.around, { global: true, prepend: true })
    if (typeof release === 'function') scope.effect(() => release)
    scheduler.markAttached()
  }
  if (typeof ctx.inject === 'function') ctx.inject(['tools'], install)
  else if (ctx.tools) install(ctx)
}
