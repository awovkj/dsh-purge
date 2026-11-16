/** Explicit value formatting and stateful HTTP from owned evidence, without exposing cookies. */
import { createHash, randomBytes } from 'node:crypto'
import { artifactError, withAssessmentDatabase } from './assessment-artifacts.js'
import { readCurrentAssessmentCapture } from './assessment-observation.js'
import { INTERNAL_PROJECT_ID, assertAssessmentUrlAllowed, callAssessmentRuntime } from './native-assessment.js'

const ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,199}$/
const TOKEN = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/
const HELP = {
  'value.hash': { project_required: false, required: ['value'], fields: {
    value: 'Explicit UTF-8 string, at most 4096 bytes; never a file path or an executable expression',
    algorithm: 'sha256 (default); returns the lowercase hex digest without echoing the value' },
  notes: ['Offline formatting for the actual client protocol, including a supplied test-account password. No guessing, code execution or evidence upgrade.'] },
  'identity.session_from_evidence': { project_required: true, required: ['actor_id', 'url', 'evidence_ids'], fields: {
    actor_id: 'Existing actor with the actual server-side subject; roles must be server-verifiable',
    url: 'Exact scoped URL where the cookies will be used for identity verification',
    evidence_ids: '1..25 complete, current HTTP E-IDs in capture order from the same anonymous cookie flow',
    ttl_seconds: '1..86400; default 7200, capped by the captured cookie expiry' },
  notes: ['Creates an UNVERIFIED native session using captured Set-Cookie headers privately. Cookies and credentials are never returned.',
    'Run identity.verify explicitly on the actual self-profile operation and its real subject/role selectors. A login success, actor label or cookie is not identity proof.',
    'The facade retains cookie origin, path, Secure and expiry constraints, including before the first identity.verify.'] },
}
export const isAuthenticationAction = action => Object.hasOwn(HELP, action)
export function authenticationActionHelp(name) {
  return HELP[name] ? { ok: true, data: { action: name, group: 'dsh_embedded_authentication',
    contract_version: 1, ...HELP[name] }, requests_sent: 0 } : null
}
export const authenticationActionCatalog = () => Object.keys(HELP).map(name => authenticationActionHelp(name).data)
export function withCookieCaptureHelp(result, name) {
  if (result?.ok !== true) return result
  if (name === 'identity.session') return { ...result, data: { ...result.data, fields: { ...result.data.fields,
    credential_handle: 'Optional facade field: one cred_<id> handle from this engagement; applies the value privately as Authorization',
    credential_url: 'Required with credential_handle: the actual scoped HTTP(S) URL on the recorded host/service',
    credential_auth: 'basic (default) or bearer; cannot mix a handle with headers, headers_file or renew' },
    notes: [...(result.data.notes || []), 'A credential handle creates an UNVERIFIED session fixed to credential_url origin before its first verification. Verify the actual server subject/roles with identity.verify; the value is not returned.'] } }
  if (!['http.capture', 'http.preflight'].includes(name)) return result
  return { ...result, data: { ...result.data, fields: { ...result.data.fields,
    cookie_evidence_ids: 'Facade field: 1..25 complete current E-IDs in capture order from this anonymous flow; privately applies matching Set-Cookie values, mutually exclusive with session_id, anonymous_cookie and Cookie headers' },
  notes: [...(result.data.notes || []), 'Carry the full cookie evidence chain through captcha/token/send/login requests. This preserves anonymous state; authenticated operations still require identity.verify.'] } }
}
function fields(input, allowed) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => !allowed.includes(key))) {
    throw artifactError('ASSESSMENT_AUTH_FIELDS', 'Use action.help for the exact authentication fields')
  }
}
export function hashAssessmentValue(input) {
  fields(input, ['value', 'algorithm'])
  if (typeof input.value !== 'string' || Buffer.byteLength(input.value) > 4096 || (input.algorithm ?? 'sha256') !== 'sha256') {
    throw artifactError('ASSESSMENT_HASH_INPUT', 'value.hash requires a UTF-8 string of at most 4096 bytes and algorithm:sha256')
  }
  return { ok: true, data: { algorithm: 'sha256', encoding: 'hex',
    digest: createHash('sha256').update(input.value, 'utf8').digest('hex'), input_bytes: Buffer.byteLength(input.value),
    can_confirm: false, security_coverage_granted: false }, requests_sent: 0 }
}
const pathMatches = (path, prefix) => path === prefix || path.startsWith(prefix.endsWith('/') ? prefix : prefix + '/')
const defaultPath = path => path.slice(0, path.lastIndexOf('/')) || '/'
function cookiePairs(header) {
  const result = new Map()
  for (const part of (header || '').split(';').filter(part => part.trim())) {
    const split = part.indexOf('='), name = part.slice(0, split).trim(), value = part.slice(split + 1).trim()
    if (split < 1 || !TOKEN.test(name) || result.has(name)) throw artifactError('ASSESSMENT_COOKIE_FLOW', 'Ambiguous request cookies; preserve the original flow')
    result.set(name, value)
  }
  return result
}
function setCookie(raw, source, capturedAt) {
  if (typeof raw !== 'string' || raw.length > 8192 || /[\x00-\x08\x0a-\x1f\x7f]/.test(raw)) {
    throw artifactError('ASSESSMENT_COOKIE_HEADER', 'Malformed or oversized Set-Cookie header')
  }
  const [first, ...parts] = raw.split(';'), split = first.indexOf('='), name = first.slice(0, split).trim()
  let value = first.slice(split + 1).trim()
  if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1)
  if (split < 1 || !TOKEN.test(name) || name.length > 128 || value.length > 4096
    || /[^\x21\x23-\x2b\x2d-\x3a\x3c-\x5b\x5d-\x7e]/.test(value)) {
    throw artifactError('ASSESSMENT_COOKIE_HEADER', 'Set-Cookie must contain one valid cookie pair')
  }
  const attrs = new Map()
  for (const part of parts) {
    const pos = part.indexOf('='), key = (pos < 0 ? part : part.slice(0, pos)).trim().toLowerCase()
    if (!['domain', 'path', 'secure', 'httponly', 'samesite', 'max-age', 'expires'].includes(key)) continue
    if (attrs.has(key)) throw artifactError('ASSESSMENT_COOKIE_HEADER', 'Duplicate cookie attributes are ambiguous')
    attrs.set(key, pos < 0 ? true : part.slice(pos + 1).trim())
  }
  const domain = String(attrs.get('domain') || source.hostname).replace(/^\./, '').toLowerCase()
  if (domain !== source.hostname.toLowerCase()
    && !(source.hostname.toLowerCase().endsWith('.' + domain) && domain.includes('.') && !/^\[|^[0-9.]+$/.test(source.hostname))) {
    throw artifactError('ASSESSMENT_COOKIE_ORIGIN', 'The captured cookie domain does not match its response origin')
  }
  const explicitPath = attrs.get('path'), path = typeof explicitPath === 'string' && explicitPath.startsWith('/')
    ? explicitPath : defaultPath(source.pathname)
  const secure = attrs.has('secure')
  if (/[\\\x00-\x1f\x7f]/.test(path) || secure && source.protocol !== 'https:'
    || name.startsWith('__Secure-') && !secure
    || name.startsWith('__Host-') && (!secure || explicitPath !== '/' || attrs.has('domain'))
    || String(attrs.get('samesite')).toLowerCase() === 'none' && !secure) {
    throw artifactError('ASSESSMENT_COOKIE_POLICY', 'The captured cookie violates its path, Secure or prefix policy')
  }
  let expires = null
  if (attrs.has('expires')) {
    expires = Date.parse(String(attrs.get('expires')))
    if (!Number.isFinite(expires)) throw artifactError('ASSESSMENT_COOKIE_EXPIRY', 'Invalid captured cookie expiry')
  }
  if (attrs.has('max-age')) {
    const age = String(attrs.get('max-age'))
    if (!/^-?\d+$/.test(age) || !Number.isSafeInteger(Number(age))) throw artifactError('ASSESSMENT_COOKIE_EXPIRY', 'Invalid captured cookie Max-Age')
    expires = Number(age) <= 0 ? 0 : capturedAt + Math.min(Number(age), 315360000) * 1000
  }
  // Even a domain cookie stays bound to the exact observed origin in this facade.
  return { name, value, domain, path, secure, expires, origin: source.origin }
}
function applicable(jar, target, at) {
  return [...jar.values()].filter(cookie => (cookie.expires === null || cookie.expires > at)
    && cookie.origin === target.origin && (!cookie.secure || target.protocol === 'https:')
    && pathMatches(target.pathname, cookie.path))
    .sort((a, b) => b.path.length - a.path.length || a.order - b.order)
}

/** Private result: callers must never publish header or cookie values. */
export function cookiesFromCaptures(captures, url, at = Date.now()) {
  const target = new URL(url), jar = new Map()
  let previousTime = -Infinity, order = 0, total = 0
  for (const captured of captures) {
    const source = new URL(captured.artifact.request.url)
    const capturedAt = Date.parse(captured.artifact.completed_at || captured.record.created_at)
    if (source.origin !== target.origin || !Number.isFinite(capturedAt) || capturedAt < previousTime || capturedAt > at) {
      throw artifactError('ASSESSMENT_COOKIE_ORIGIN', 'Use captures in time order from the same exact origin')
    }
    previousTime = capturedAt
    const headers = Object.entries(captured.artifact.request.headers || {}).filter(([name]) => name.toLowerCase() === 'cookie')
    if (headers.length > 1) throw artifactError('ASSESSMENT_COOKIE_FLOW', 'Ambiguous captured request Cookie headers')
    const actual = cookiePairs(headers[0]?.[1]), expectedCookies = applicable(jar, source, capturedAt)
    // Duplicate names at different paths are legal in HTTP but cannot be matched
    // unambiguously to this flow. Do not silently pick one identity value.
    if (new Set(expectedCookies.map(cookie => cookie.name)).size !== expectedCookies.length
      || actual.size !== expectedCookies.length || expectedCookies.some(cookie => actual.get(cookie.name) !== cookie.value)) {
      throw artifactError('ASSESSMENT_COOKIE_FLOW', 'These captures were not made with the same cookie flow; supply the full chain actually carried between requests')
    }
    for (const pair of captured.artifact.response.headers || []) {
      if (!Array.isArray(pair) || pair.length !== 2 || String(pair[0]).toLowerCase() !== 'set-cookie') continue
      if (++total > 128) throw artifactError('ASSESSMENT_COOKIE_BUDGET', 'Cookie evidence exceeds the 128-cookie budget')
      const cookie = setCookie(pair[1], source, capturedAt), key = JSON.stringify([cookie.name, cookie.domain, cookie.path])
      if (cookie.expires !== null && cookie.expires <= capturedAt) jar.delete(key)
      else jar.set(key, { ...cookie, order: jar.get(key)?.order ?? order++ })
    }
  }
  const cookies = applicable(jar, target, at)
  if (!cookies.length) throw artifactError('ASSESSMENT_COOKIE_EMPTY', 'No unexpired captured cookie applies to this URL')
  if (new Set(cookies.map(cookie => cookie.name)).size !== cookies.length) throw artifactError('ASSESSMENT_COOKIE_FLOW', 'Duplicate cookie names at different paths require a separate reviewed flow')
  const header = cookies.map(cookie => cookie.name + '=' + cookie.value).join('; ')
  if (Buffer.byteLength(header) > 8192) throw artifactError('ASSESSMENT_COOKIE_BUDGET', 'Captured Cookie header exceeds 8192 bytes')
  return { header, cookies, expires: Math.min(...cookies.map(cookie => cookie.expires ?? Infinity)) }
}
async function cookieEvidence(store, id, runtime, context, ids, url, options) {
  if (!Array.isArray(ids) || ids.length < 1 || ids.length > 25 || new Set(ids).size !== ids.length) {
    throw artifactError('ASSESSMENT_COOKIE_IDS', 'Supply 1..25 distinct HTTP E-IDs in actual cookie-flow order')
  }
  assertAssessmentUrlAllowed(store, id, url)
  const captures = []
  for (const evidenceId of ids) {
    options.signal?.throwIfAborted()
    const captured = await readCurrentAssessmentCapture(store, id, runtime, context, evidenceId, options)
    if (captured.record.complete !== true || captured.artifact.complete !== true
      || captured.record.session_id || captured.record.actor_id || captured.record.credential_header_names?.length) {
      throw artifactError('ASSESSMENT_COOKIE_EVIDENCE', 'Cookie bootstrap requires complete current anonymous HTTP captures; another actor or incomplete evidence cannot supply a flow')
    }
    captures.push(captured)
  }
  return cookiesFromCaptures(captures, url)
}
async function requestUrl(store, id, runtime, context, input, options) {
  if (input.url !== undefined) return assertAssessmentUrlAllowed(store, id, input.url)
  if (!ID.test(input.operation_id || '')) throw artifactError('ASSESSMENT_COOKIE_OPERATION', 'A concrete URL or actual operation_id is required for cookie selection')
  const result = await callAssessmentRuntime(runtime, 'surface.inspect', { project_id: INTERNAL_PROJECT_ID, operation_id: input.operation_id }, options)
  const url = result?.ok === true ? result.data?.operation?.url : null
  if (!url || /[{}]/.test(url)) throw artifactError('ASSESSMENT_COOKIE_OPERATION', 'Resolve the operation to an explicit URL before selecting cookies')
  return assertAssessmentUrlAllowed(store, id, url)
}
export async function prepareCookieCapture(store, id, runtime, context, input, options = {}) {
  const { cookie_evidence_ids: ids, ...request } = input
  if (request.session_id || request.anonymous_cookie !== undefined
    || Object.keys(request.headers || {}).some(name => name.toLowerCase() === 'cookie')) {
    throw artifactError('ASSESSMENT_COOKIE_CONFLICT', 'cookie_evidence_ids cannot replace a session, explicit anonymous_cookie or Cookie header')
  }
  const url = await requestUrl(store, id, runtime, context, request, options)
  const selected = await cookieEvidence(store, id, runtime, context, ids, url, options)
  return { ...request, url, anonymous_cookie: selected.header }
}
function cookieSessionTable(store, id) {
  const db = store.db(id)
  db.exec('CREATE TABLE IF NOT EXISTS assessment_cookie_session (session_id TEXT PRIMARY KEY, document TEXT NOT NULL)')
  return db
}
export async function createCookieSession(store, id, runtime, context, input, options = {}) {
  fields(input, ['actor_id', 'url', 'evidence_ids', 'ttl_seconds'])
  if (!ID.test(input.actor_id || '')) throw artifactError('ASSESSMENT_COOKIE_ACTOR', 'Use the actual existing actor_id')
  const requestedTtl = input.ttl_seconds ?? 7200
  if (!Number.isSafeInteger(requestedTtl) || requestedTtl < 1 || requestedTtl > 86400) throw artifactError('ASSESSMENT_COOKIE_TTL', 'Session TTL must be 1..86400 seconds')
  const selected = await cookieEvidence(store, id, runtime, context, input.evidence_ids, input.url, options)
  const ttl = Math.min(requestedTtl, Math.floor((selected.expires - Date.now()) / 1000))
  if (ttl < 1) throw artifactError('ASSESSMENT_COOKIE_EXPIRY', 'The captured cookie has expired; acquire state explicitly before creating a session')
  const sessionId = 'SES-' + randomBytes(16).toString('hex')
  const document = { generation: 1, origin: new URL(input.url).origin,
    evidence_ids: input.evidence_ids, cookies: selected.cookies.map(({ name, path, secure, expires }) => ({ name, path, secure, expires })) }
  // Retain the destination constraint before dispatch. If creation is interrupted,
  // an existing native session can never be left without its origin restriction.
  cookieSessionTable(store, id).prepare('INSERT INTO assessment_cookie_session(session_id,document) VALUES(?,?)').run(sessionId, JSON.stringify(document))
  let result
  try { result = await callAssessmentRuntime(runtime, 'identity.session', { project_id: INTERNAL_PROJECT_ID,
    session_id: sessionId, actor_id: input.actor_id, origin_url: input.url,
    headers: { Cookie: selected.header }, ttl_seconds: ttl }, options) }
  catch (error) { error.recovery = { ...error.recovery, session_id: sessionId, requests_sent: 0 }; throw error }
  if (result?.ok !== true || result.data?.id !== sessionId || result.data?.generation !== 1
    || result.data.verified_at) throw artifactError('ASSESSMENT_COOKIE_SESSION', 'The engine did not create an unverified cookie session')
  return { ...result, cookie_context: { evidence_ids: input.evidence_ids, cookie_names: selected.cookies.map(cookie => cookie.name),
    values_returned: false, identity_verified: false }, requests_sent: 0,
  next_step: { tool: 'redteam_assessment_run', arguments: { engagement: id, action: 'action.help', input: { name: 'identity.verify' } }, offline_only: true },
  note: 'The native session is unverified. Explicitly verify the actual self-profile operation and its server-side subject/roles before using authenticated requests.' }
}

/** Native sessions derived here retain cookie constraints before and after verification. */
export function assertCookieSessionRequest(store, id, context, input, action = 'http.capture') {
  if (input.run_id && !input.recipe_id && !input.session_id && input.mode !== 'verify') {
    const recipeId = withAssessmentDatabase(store, id, context, native => {
      const row = native.prepare("SELECT document FROM entities WHERE kind='v2_run' AND id=?").get(input.run_id)
      return row ? JSON.parse(row.document).recipe_id : null
    })
    if (recipeId) return assertCookieSessionRequest(store, id, context, { ...input, recipe_id: recipeId }, action)
  }
  if (input.hypothesis_id && !input.recipe_id && !input.session_id && input.mode !== 'verify') {
    const source = store.db(id)
    if (source.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='assessment_cookie_session'").get()
      && source.prepare('SELECT 1 FROM assessment_cookie_session LIMIT 1').get()) {
      const needsSession = withAssessmentDatabase(store, id, context, native => {
        const row = native.prepare("SELECT document FROM entities WHERE kind='v2_hypothesis' AND id=?").get(input.hypothesis_id)
        if (!row) return false
        const hypothesis = JSON.parse(row.document)
        const operation = native.prepare("SELECT document FROM entities WHERE kind='operation' AND id=?").get(hypothesis.operation_id)
        return hypothesis.family === 'access_control' || operation && JSON.parse(operation.document).auth !== 'public'
      })
      if (needsSession) throw artifactError('ASSESSMENT_COOKIE_RECIPE_REQUIRED', 'Use campaign.next and the returned frozen recipe_id so every captured-cookie control destination can be checked before execution')
    }
  }
  if (input.recipe_id && !input.session_id) {
    const recipe = withAssessmentDatabase(store, id, context, native => {
      const row = native.prepare("SELECT document FROM entities WHERE kind='v2_recipe' AND id=?").get(input.recipe_id)
      return row ? JSON.parse(row.document) : null
    })
    if (recipe) {
      const groups = recipe.private_capsule?.control_groups || recipe.control_groups || []
      for (const group of groups) for (const control of group.controls || []) {
        const sessionId = Object.hasOwn(control, 'session') ? control.session?.session_id : recipe.bindings?.session?.session_id
        if (!sessionId) continue
        assertCookieSessionRequest(store, id, context, { session_id: sessionId, url: control.request?.url,
          operation_id: recipe.bindings.operation_id }, recipe.provider?.name === 'browser' ? 'browser.visit' : action)
      }
    }
    return
  }
  if (!input.session_id) return
  const db = store.db(id)
  if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='assessment_cookie_session'").get()) return
  const row = db.prepare('SELECT document FROM assessment_cookie_session WHERE session_id=?').get(input.session_id)
  if (!row) return
  const policy = JSON.parse(row.document)
  const session = withAssessmentDatabase(store, id, context, native => {
    const row = native.prepare("SELECT document FROM entities WHERE kind='session' AND id=?").get(input.session_id)
    return row ? JSON.parse(row.document) : null
  })
  // Explicit recreation uses new credentials and a new generation. The normal
  // native identity contract handles it; it is no longer a captured-cookie session.
  if (!session || session.generation !== policy.generation) return
  if (action === 'browser.visit' && policy.cookies.some(cookie => cookie.path !== '/')) {
    throw artifactError('ASSESSMENT_COOKIE_BROWSER_SCOPE', 'Path-scoped cookies require a browser provider that preserves cookie paths; this session remains usable for matching explicit HTTP requests')
  }
  let url = input.url || input.verify_url || input.consumer_url || input.entry_url
  if (!url && input.operation_id) url = withAssessmentDatabase(store, id, context, native => {
    const row = native.prepare("SELECT document FROM entities WHERE kind='operation' AND id=?").get(input.operation_id)
    return row ? JSON.parse(row.document).url : null
  })
  if (!url) throw artifactError('ASSESSMENT_COOKIE_OPERATION', 'A captured-cookie session requires a concrete destination URL')
  const target = new URL(assertAssessmentUrlAllowed(store, id, url)), at = Date.now()
  if (target.origin !== policy.origin || policy.cookies.some(cookie => !pathMatches(target.pathname, cookie.path)
    || cookie.secure && target.protocol !== 'https:' || cookie.expires !== null && cookie.expires <= at)) {
    throw artifactError('ASSESSMENT_COOKIE_DESTINATION', 'Captured session cookies cannot be forwarded outside their observed origin, path, Secure or expiry constraints')
  }
}

export function withCookieToolAdvice(store, id, context, result) {
  if (result?.ok !== true || !Array.isArray(result.data?.items)) return result
  const items = result.data.items.map(row => {
    if (row.next?.action !== 'browser.visit' || !row.next.input?.session_id) return row
    try {
      assertCookieSessionRequest(store, id, context, row.next.input, 'browser.visit')
      return row
    } catch (error) {
      if (!/^ASSESSMENT_COOKIE_/.test(error.code || '')) throw error
      return { ...row, ready: false, state: 'preparation_required', offline_only: true,
        missing: [...new Set([...(row.missing || []), error.code])],
        reason: 'The captured-cookie session cannot satisfy this exact browser destination/profile; keep its origin/path/Secure/expiry policy',
        next: { action: 'action.help', input: { name: 'browser.visit' } } }
    }
  })
  return { ...result, data: { ...result.data, items } }
}
