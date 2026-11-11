/** The assessment core is part of this package; each engagement owns its state. */
import { createHash } from 'node:crypto'
import { existsSync, lstatSync, readFileSync } from 'node:fs'
import { isAbsolute, join, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { assertNoLinkedDescendants } from '../path-boundary.js'
import { atomicWriteFileSync } from './atomic-write.js'
import { awaSettingsOf, saveAwaSettings } from './settings.js'
import { normalizeScopeRules, targetWithinScope } from './assessment-policy.js'
import * as embedded from './assessment-engine/src/bridge.mjs'

export const ASSESSMENT_CONTEXT_SCHEMA = 'dsh-purge-assessment/v1'
export const INTERNAL_PROJECT_ID = 'assessment'
const manifest = JSON.parse(readFileSync(new URL('./assessment-engine/package.json', import.meta.url), 'utf8'))
export const ASSESSMENT_ENGINE = Object.freeze({ embedded: true, name: manifest.name, version: manifest.version })
const SETTINGS_FIELDS = ['pythonExecutable', 'executionBackend', 'wslDistribution',
  'wslPythonExecutable', 'timeoutMs', 'assessmentModel']
const queues = new WeakMap()
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const samePath = (left, right) => process.platform === 'win32'
  ? resolve(left).toLowerCase() === resolve(right).toLowerCase() : resolve(left) === resolve(right)

export const assessmentSourceId = (store, id) => 'rt-' + digest([resolve(store.root), id]).slice(0, 24)
export const assessmentPolicyOf = (store, id) => store.assessmentPolicy(id)

function workspaceOf(store, id) {
  const engagement = store.dirOf(id)
  return assertNoLinkedDescendants(engagement, join(engagement, 'assessment'))
}

function contextPath(store, id) {
  const engagement = store.dirOf(id)
  const file = assertNoLinkedDescendants(engagement, join(engagement, 'assessment-context.json'))
  if (existsSync(file) && !lstatSync(file).isFile()) throw new Error('invalid native assessment context file')
  return file
}

function urlRule(value) {
  if (typeof value !== 'string' || !/^https?:\/\//i.test(value)) throw new Error('assessment scope requires concrete HTTP(S) URLs')
  return new URL(normalizeScopeRules([value])[0]).href
}

function urlRules(values, { required = false } = {}) {
  if (!Array.isArray(values) || values.length > 256 || required && !values.length) {
    throw new Error('assessment scope/exclude must be a bounded URL array; scope cannot be empty')
  }
  return [...new Set(values.map(urlRule))]
}

function prefixContains(parent, child) {
  const left = new URL(parent), right = new URL(child)
  const path = left.pathname.replace(/\/$/, '')
  return left.origin === right.origin && (!path || right.pathname === path || right.pathname.startsWith(path + '/'))
}

function normalizedPolicy(store, id) {
  const policy = assessmentPolicyOf(store, id)
  return { ...policy, scope: normalizeScopeRules(policy.scope, { required: policy.assessment_mode === 'src' }),
    exclude: normalizeScopeRules(policy.exclude) }
}

export function assertAssessmentUrlAllowed(store, id, value) {
  if (typeof value !== 'string' || !/^https?:\/\//i.test(value) || /[\x00-\x20\\]/.test(value)) throw new Error('assessment requires an explicit HTTP(S) target URL without controls')
  const locator = new URL(value)
  if (locator.username || locator.password || locator.hash) throw new Error('assessment target URL cannot contain credentials or a fragment')
  const boundary = new URL(value)
  boundary.search = ''
  urlRule(boundary.href)
  const url = locator.href
  const policy = normalizedPolicy(store, id)
  if (policy.scope.length && !targetWithinScope(url, policy.scope, policy.exclude)
    || policy.exclude.length && targetWithinScope(url, [new URL(url).origin + '/'], policy.exclude) === false) {
    throw new Error((policy.assessment_mode === 'src' ? 'SRC ' : '') + 'assessment target outside scope or excluded')
  }
  return url
}

/** Read only the new internal metadata. Old awa-binding.json is left untouched. */
export function readNativeContext(store, id) {
  const file = contextPath(store, id)
  if (!existsSync(file)) return null
  let context
  try { context = JSON.parse(readFileSync(file, 'utf8')) }
  catch { throw new Error('invalid native assessment context; preserve the file and inspect its contents') }
  if (!context || typeof context !== 'object' || Array.isArray(context)
    || context.schema !== ASSESSMENT_CONTEXT_SCHEMA || context.engagement_id !== id
    || context.project_id !== INTERNAL_PROJECT_ID || context.source_engagement_id !== assessmentSourceId(store, id)
    || !isAbsolute(context.workspace || '') || !samePath(context.workspace, workspaceOf(store, id))
    || !['assessment', 'src'].includes(context.assessment_mode) || !['v1', 'v2'].includes(context.model)
    || !['native', 'wsl'].includes(context.executionBackend)) throw new Error('invalid fixed internal assessment context identity')
  urlRules(context.scope, { required: true }); urlRules(context.exclude)
  if (!targetWithinScope(urlRule(context.target), context.scope, context.exclude)) throw new Error('invalid internal assessment target boundary')
  if (context.import_ids !== undefined && (!Array.isArray(context.import_ids) || context.import_ids.length > 128
    || context.import_ids.some(value => typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,199}$/.test(value)))) {
    throw new Error('invalid internal assessment import history')
  }
  return context
}

export function persistNativeContext(store, id, context) {
  atomicWriteFileSync(contextPath(store, id), JSON.stringify(context, null, 2) + '\n')
}

function operatorConfig(store, env = process.env) {
  const saved = awaSettingsOf(store.root)
  // packagePath/workspace from an earlier bridge are inert historical settings.
  // Neither settings nor the environment select the installed assessment code.
  return { pythonExecutable: saved.pythonExecutable || env?.AWA_DDD_PYTHON || (process.platform === 'win32' ? 'python' : 'python3'),
    executionBackend: saved.executionBackend || 'native', wslDistribution: saved.wslDistribution || 'kali-linux',
    wslPythonExecutable: saved.wslPythonExecutable || 'python3', timeoutMs: saved.timeoutMs ?? 120000,
    assessmentModel: saved.assessmentModel || 'v1' }
}

export function assessmentConfigOf(store, id, env = process.env) {
  const context = readNativeContext(store, id)
  return embedded.resolveConfig({ ...operatorConfig(store, env), workspace: workspaceOf(store, id),
    assessmentModel: context?.model || operatorConfig(store, env).assessmentModel,
    assessmentMode: assessmentPolicyOf(store, id).assessment_mode === 'src' ? 'src' : 'assessment' })
}

export async function validateAssessmentSettings(store, patch, env = process.env) {
  embedded.validateJson(patch)
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)
    || Object.keys(patch).some(key => !SETTINGS_FIELDS.includes(key))) throw new Error('invalid native assessment configuration fields')
  const configured = { ...operatorConfig(store, env), ...patch }
  // Validate interpreter/backend preferences without selecting or creating state.
  const checked = embedded.resolveConfig({ ...configured, workspace: resolve(store.root, 'assessment-config-check') })
  return Object.fromEntries(SETTINGS_FIELDS.map(key => [key, checked[key]]))
}

export async function configureAssessment(store, patch, env) {
  const config = await validateAssessmentSettings(store, patch, env)
  saveAwaSettings(store.root, config)
  return { ok: true, engine: ASSESSMENT_ENGINE, config, requests_sent: 0 }
}

export function nativeRuntimeOf(store, id, options = {}, model) {
  const configured = assessmentConfigOf(store, id, options.env)
  return { bridge: embedded, packagePath: embedded.PACKAGE_ROOT, version: manifest.version,
    config: embedded.resolveConfig({ ...configured, assessmentModel: model || configured.assessmentModel, assessmentMode: 'assessment' }),
    invokeEngine: typeof options.invokeEngine === 'function' ? options.invokeEngine : embedded.invokeEngine }
}

export async function callAssessmentRuntime(runtime, action, args, options = {}) {
  try { return await runtime.invokeEngine(runtime.config, action, args, { signal: options.signal }) }
  catch (error) {
    const recovery = embedded.safeErrorDetails(error.details)
    if (recovery) error.recovery = recovery
    if (error[embedded.ENGINE_DISPATCH_UNCERTAIN]) error.dispatch_uncertain = true
    throw error
  }
}

function matchesRuntime(context, runtime) {
  if (!samePath(context.workspace, runtime.config.workspace)
    || context.executionBackend !== runtime.config.executionBackend
    || context.model !== runtime.config.assessmentModel
    || context.executionBackend === 'wsl' && context.wslDistribution !== runtime.config.wslDistribution) {
    throw new Error('assessment runtime differs from the persistent internal context; restore its original backend')
  }
}

function checkedProjectConfig(store, id, context, config) {
  if (!config || typeof config !== 'object') throw new Error('internal assessment status is missing its persisted configuration')
  const actual = config.assessment_mode || 'assessment'
  const policy = normalizedPolicy(store, id)
  const expected = policy.assessment_mode === 'src' ? 'src' : 'assessment'
  if (actual !== expected || context.assessment_mode !== actual) throw new Error('assessment mode does not match this engagement')
  if (expected === 'src' && config.allow_mutation !== false) throw new Error('SRC assessment cannot permit mutation')
  const scope = urlRules(config.scope, { required: true }), exclude = urlRules(config.exclude || [])
  assertAssessmentUrlAllowed(store, id, config.target)
  for (const rule of scope) assertAssessmentUrlAllowed(store, id, rule)
  for (const excluded of policy.exclude.filter(value => /^https?:\/\//i.test(value)).map(urlRule)) {
    if (scope.some(rule => prefixContains(rule, excluded)) && !exclude.some(rule => prefixContains(rule, excluded))) {
      throw new Error('assessment scope must preserve the engagement exclusion: ' + excluded)
    }
  }
  if (!targetWithinScope(config.target, scope, exclude)) throw new Error('invalid internal assessment target boundary')
  return { ...config, scope, exclude }
}

async function loadNativeProject(store, id, runtime, context, options = {}, preparingModel = false) {
  matchesRuntime(context, runtime)
  const result = await callAssessmentRuntime(runtime, 'project.status', { project_id: INTERNAL_PROJECT_ID, limit: 1 }, options)
  checkedProjectConfig(store, id, context, result.data?.config)
  if (!preparingModel && (result.data.config.assessment_model || 'v1') !== context.model) {
    throw new Error('assessment model does not match the persistent internal context')
  }
  if (context.assessment_mode === 'src') runtime.config = embedded.resolveConfig({ ...runtime.config, assessmentMode: 'src' })
  return result
}

export async function currentNativeProject(store, id, runtime, context, options = {}) {
  return loadNativeProject(store, id, runtime, context, options)
}

/** Only real stored HTTP locators are considered; names/IPs never imply a URL. */
function storedUrls(store, id) {
  const db = store.db(id)
  const urls = []
  for (const [table, field] of [['vuln', 'target'], ['http_evidence', 'url'], ['port', 'url']]) {
    for (const row of db.prepare(`SELECT ${field} AS url FROM ${table} WHERE ${field} IS NOT NULL ORDER BY id LIMIT 128`).all()) {
      if (typeof row.url !== 'string' || !/^https?:\/\//i.test(row.url)) continue
      try {
        const url = new URL(row.url)
        if (url.username || url.password) continue
        url.search = ''; url.hash = ''
        urls.push(assertAssessmentUrlAllowed(store, id, url.href))
      } catch { /* Unusable/excluded stored locators remain in their source table. */ }
    }
  }
  return [...new Set(urls)].slice(0, 256)
}

export function assessmentScopesForUrls(store, id, urls) {
  const policy = normalizedPolicy(store, id)
  const explicit = policy.scope.filter(value => /^https?:\/\//i.test(value)).map(urlRule)
  const result = []
  for (const value of urls) {
    const url = assertAssessmentUrlAllowed(store, id, value)
    const declared = explicit.filter(rule => prefixContains(rule, url))
    if (declared.length) result.push(...declared)
    else {
      const locator = new URL(url); locator.search = ''
      result.push(policy.scope.length ? locator.origin + '/' : locator.href)
    }
  }
  return urlRules([...new Set(result)], { required: true })
}

function seedOf(store, id, args) {
  embedded.validateJson(args)
  if (!args || typeof args !== 'object' || Array.isArray(args)
    || Object.keys(args).some(key => !['target', 'scope', 'exclude', 'assessmentModel'].includes(key))) {
    throw new Error('native assessment arguments cannot replace its fixed internal project or runtime')
  }
  if (args.assessmentModel !== undefined && !['v1', 'v2'].includes(args.assessmentModel)) throw new Error('assessmentModel must be v1 or v2')
  const policy = normalizedPolicy(store, id)
  const declared = policy.scope.filter(rule => /^https?:\/\//i.test(rule)).map(urlRule)
    .filter(rule => targetWithinScope(rule, policy.scope, policy.exclude))
  const known = storedUrls(store, id)
  let scope = args.scope === undefined ? declared : urlRules(args.scope, { required: true })
  const target = args.target === undefined ? known.find(url => !scope.length || scope.some(rule => prefixContains(rule, url))) || scope[0] || known[0]
    : assertAssessmentUrlAllowed(store, id, urlRule(args.target))
  if (!target) return null
  if (!scope.length) scope = assessmentScopesForUrls(store, id, [target, ...known])
  for (const rule of scope) assertAssessmentUrlAllowed(store, id, rule)
  const exclude = urlRules([...new Set([...(args.exclude === undefined ? [] : urlRules(args.exclude)),
    ...policy.exclude.filter(rule => /^https?:\/\//i.test(rule)).map(urlRule)])])
  if (!targetWithinScope(target, scope, exclude)) throw new Error('assessment target outside scope or excluded')
  return { target, scope, exclude, assessment_mode: policy.assessment_mode === 'src' ? 'src' : 'assessment',
    model: args.assessmentModel }
}

function newContext(store, id, runtime, seed) {
  return { schema: ASSESSMENT_CONTEXT_SCHEMA, engagement_id: id, project_id: INTERNAL_PROJECT_ID,
    source_engagement_id: assessmentSourceId(store, id), workspace: runtime.config.workspace,
    executionBackend: runtime.config.executionBackend, wslDistribution: runtime.config.wslDistribution,
    assessment_mode: seed.assessment_mode, model: runtime.config.assessmentModel,
    target: seed.target, scope: seed.scope, exclude: seed.exclude, created_at: new Date().toISOString() }
}

/** Recover the identity from immutable start events, without changing Python state. */
function recoverCampaignId(store, id, target) {
  const workspace = workspaceOf(store, id)
  const file = assertNoLinkedDescendants(workspace, join(workspace, 'projects', INTERNAL_PROJECT_ID, 'assessment.sqlite3'))
  const db = new DatabaseSync(file, { readOnly: true })
  try {
    const common = `SELECT entity.id FROM events AS event JOIN entities AS entity
      ON entity.kind = 'v2_campaign' AND entity.id = json_extract(event.document, '$.campaign_id')
      WHERE event.type = 'v2.campaign_started' AND json_valid(entity.document)
        AND json_extract(entity.document, '$.project_id') = ?
        AND json_extract(entity.document, '$.model') = 'v2'
        AND json_extract(entity.document, '$.target') = ?`
    // Multiple campaigns are explicitly supported. The last durable start event
    // selects the current active campaign; terminal history is only a fallback
    // for offline report recovery when no campaign remains active.
    const active = db.prepare(common + " AND json_extract(entity.document, '$.state') = 'active' ORDER BY event.seq DESC LIMIT 1")
      .get(INTERNAL_PROJECT_ID, target)
    const row = active || db.prepare(common + ' ORDER BY event.seq DESC LIMIT 1').get(INTERNAL_PROJECT_ID, target)
    if (!row || typeof row.id !== 'string' || !/^CAM-[a-f0-9]+$/.test(row.id)) throw new Error('internal v2 campaign identity cannot be recovered from its persisted start events')
    return row.id
  } finally { db.close() }
}

function serializeInitialization(store, id, task) {
  let map = queues.get(store)
  if (!map) queues.set(store, map = new Map())
  const prior = map.get(id) || Promise.resolve()
  const next = prior.catch(() => {}).then(task)
  map.set(id, next)
  return next.finally(() => { if (map.get(id) === next) map.delete(id) })
}

/** Idempotent preparation/recovery and scope bookkeeping; this never captures. */
export async function initializeAssessment(store, id, args = {}, options = {}) {
  return serializeInitialization(store, id, async () => {
    const seed = seedOf(store, id, args)
    const existing = readNativeContext(store, id)
    if (!seed && !existing) return assessmentStatus(store, id, options)
    if (existing && seed?.model && seed.model !== existing.model) throw new Error('assessment model is fixed for the existing internal context')
    const runtime = nativeRuntimeOf(store, id, options, existing?.model || seed?.model)
    let context = existing || newContext(store, id, runtime, seed)
    let status
    if (existing) {
      status = await currentNativeProject(store, id, runtime, context, options)
      const current = checkedProjectConfig(store, id, context, status.data?.config)
      if (seed && (seed.scope.some(rule => !current.scope.includes(rule)) || seed.exclude.some(rule => !current.exclude.includes(rule)))) {
        // This private adapter only merges URL rules already checked against the
        // source engagement. Public model calls can never invoke a dsh.* action.
        await callAssessmentRuntime(runtime, 'dsh.context.configure', { project_id: INTERNAL_PROJECT_ID,
          assessment_mode: context.assessment_mode, scope: seed.scope, exclude: seed.exclude }, options)
        status = await currentNativeProject(store, id, runtime, context, options)
      }
    } else {
      const db = assertNoLinkedDescendants(runtime.config.workspace,
        join(runtime.config.workspace, 'projects', INTERNAL_PROJECT_ID, 'assessment.sqlite3'))
      if (existsSync(db)) status = await loadNativeProject(store, id, runtime, context, options, true)
      else {
        try { await callAssessmentRuntime(runtime, 'project.create', { project_id: INTERNAL_PROJECT_ID,
          target: seed.target, scope: seed.scope, exclude: seed.exclude,
          assessment_mode: seed.assessment_mode, allow_mutation: false }, options) }
        catch (error) { if (error.code !== 'project_exists') throw error }
        status = await loadNativeProject(store, id, runtime, context, options, true)
      }
    }
    let configured = checkedProjectConfig(store, id, context, status.data?.config)
    // Recover a completed Python initialization whose final metadata write was
    // interrupted. An explicit conflicting model still fails below.
    if (!existing && !seed?.model && configured.assessment_model === 'v2') {
      context = { ...context, model: 'v2' }
      runtime.config = embedded.resolveConfig({ ...runtime.config, assessmentModel: 'v2' })
    }
    if (context.model === 'v2' && (configured.assessment_model || 'v1') !== 'v2') {
      const campaign = await callAssessmentRuntime(runtime, 'campaign.start', { project_id: INTERNAL_PROJECT_ID,
        target: configured.target, model: 'v2' }, options)
      if (typeof campaign.data?.campaign?.id !== 'string') throw new Error('internal v2 campaign initialization returned no campaign identity')
      context = { ...context, campaign_id: campaign.data.campaign.id }
      status = await currentNativeProject(store, id, runtime, context, options)
      configured = checkedProjectConfig(store, id, context, status.data?.config)
    }
    if ((configured.assessment_model || 'v1') !== context.model) throw new Error('assessment model does not match the selected internal context')
    if (context.model === 'v2' && !context.campaign_id) context = { ...context, campaign_id: recoverCampaignId(store, id, configured.target) }
    // Initialization awaits Python while another local import can commit. Read
    // its metadata again immediately before this synchronous atomic write.
    const latest = readNativeContext(store, id)
    if (latest) matchesRuntime(latest, runtime)
    context = { ...context, ...(latest || {}), target: configured.target, scope: configured.scope, exclude: configured.exclude,
      updated_at: new Date().toISOString() }
    persistNativeContext(store, id, context)
    return { ...status, engine: ASSESSMENT_ENGINE, context: { ...context, ready: true }, binding: context,
      bound: true, assessment_policy: assessmentPolicyOf(store, id), requests_sent: 0 }
  })
}

export const ensureNativeAssessment = initializeAssessment

/** Readiness describes local metadata only, and cannot launch Python or a scan. */
export async function assessmentStatus(store, id, options = {}) {
  if (!id) return { ok: true, available: true, engine: ASSESSMENT_ENGINE, context: { ready: false },
    assessment_policy: null, requests_sent: 0 }
  const context = readNativeContext(store, id)
  const runtime = nativeRuntimeOf(store, id, options)
  if (context) {
    matchesRuntime(context, runtime)
    const expected = assessmentPolicyOf(store, id).assessment_mode === 'src' ? 'src' : 'assessment'
    if (context.assessment_mode !== expected) throw new Error('assessment mode does not match this engagement')
    checkedProjectConfig(store, id, context, { ...context, allow_mutation: false })
  }
  return { ok: true, available: true, engine: ASSESSMENT_ENGINE,
    context: context ? { ...context, ready: true } : { ready: false, model: runtime.config.assessmentModel,
      reason: 'concrete_http_scope_required' }, assessment_policy: assessmentPolicyOf(store, id), requests_sent: 0,
    note: 'Local readiness only; preparation and report actions send no target requests.' }
}

/** Backward source compatibility with the former AWA API, using only this core. */
export async function nativeProject(store, id, args = {}, options = {}) {
  embedded.validateJson(args)
  if (!args || typeof args !== 'object' || Array.isArray(args)
    || Object.keys(args).some(key => !['mode', 'project_id', 'engagement', 'target', 'scope', 'exclude', 'assessmentModel'].includes(key))) {
    throw new Error('native assessment arguments cannot replace its fixed internal project or runtime')
  }
  const mode = args.mode || 'status'
  if (!['status', 'create', 'bind'].includes(mode)) throw new Error('invalid assessment project mode')
  if (args.project_id !== undefined && args.project_id !== INTERNAL_PROJECT_ID) throw new Error('cannot replace the fixed internal assessment project')
  if (mode === 'status') {
    const context = readNativeContext(store, id)
    if (!context) return { ...(await assessmentStatus(store, id, options)), binding: null, bound: false }
    const runtime = nativeRuntimeOf(store, id, options)
    const status = await currentNativeProject(store, id, runtime, context, options)
    return { ...status, engine: ASSESSMENT_ENGINE, binding: context, context: { ...context, ready: true }, bound: true, requests_sent: 0 }
  }
  const seed = Object.fromEntries(['target', 'scope', 'exclude', 'assessmentModel'].filter(key => args[key] !== undefined).map(key => [key, args[key]]))
  return initializeAssessment(store, id, seed, options)
}

export const embeddedAssessmentBridge = embedded
