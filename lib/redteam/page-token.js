/** Service-local cursors bind the engagement, mode, stream, size and review semantics. */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

const keys = new WeakMap()
const keyOf = store => {
  let key = keys.get(store)
  if (!key) keys.set(store, key = randomBytes(32))
  return key
}
const invalid = reason => Object.assign(new Error('Invalid page_token: ' + reason), {
  code: 'ASSESSMENT_PAGE_TOKEN', recovery: { requests_sent: 0, automatic_retry_allowed: false,
    next_action: 'restart_first_page', reason },
})
const integer = (value, fallback, maximum) => {
  if (value === undefined) return fallback
  if (!Number.isSafeInteger(value) || value < 0 || value > maximum) throw invalid('pagination must use bounded nonnegative integers')
  return value
}
const signature = (store, text) => createHmac('sha256', keyOf(store)).update(text).digest()
const offsetNames = ['offset', 'finding_offset', 'stop_offset']

export function resolvePage(store, id, stream, args, { maximum = 100, verify } = {}) {
  const mode = store.assessmentPolicy(id).assessment_mode
  if (args.page_token === undefined) {
    const limit = integer(args.limit, 50, maximum)
    if (!limit) throw invalid('limit must be positive')
    return { limit, offset: integer(args.offset, 0, Number.MAX_SAFE_INTEGER),
      finding_offset: integer(args.finding_offset, 0, Number.MAX_SAFE_INTEGER),
      stop_offset: integer(args.stop_offset, 0, Number.MAX_SAFE_INTEGER), ...(verify !== undefined ? { verify } : {}) }
  }
  if (offsetNames.some(name => args[name] !== undefined)) throw invalid('token and offsets cannot be mixed')
  if (typeof args.page_token !== 'string' || args.page_token.length > 2048) throw invalid('malformed cursor')
  const [encoded, mac, extra] = args.page_token.split('.')
  if (!encoded || !mac || extra !== undefined || !/^[A-Za-z0-9_-]+$/.test(encoded) || !/^[A-Za-z0-9_-]{43}$/.test(mac)) throw invalid('malformed cursor')
  const actual = Buffer.from(mac, 'base64url'), expected = signature(store, encoded)
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw invalid('signature or service lifetime')
  let page
  try { page = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) } catch { throw invalid('malformed payload') }
  if (!page || page.v !== 1 || page.id !== id || page.mode !== mode || page.stream !== stream) throw invalid('engagement, mode or stream mismatch')
  if (args.limit !== undefined && args.limit !== page.limit) throw invalid('limit conflict')
  if (!integer(page.limit, 0, maximum)) throw invalid('invalid size')
  for (const name of offsetNames) integer(page[name], 0, Number.MAX_SAFE_INTEGER)
  if (stream === 'assessment_candidates' && (typeof page.verify !== 'boolean' || args.verify !== undefined && args.verify !== page.verify)) throw invalid('review semantics conflict')
  return page
}

export function nextPage(store, id, stream, page, cursors, tool, extra = {}) {
  if (!Object.values(cursors).some(value => value !== null)) return null
  const payload = { v: 1, id, mode: store.assessmentPolicy(id).assessment_mode, stream, limit: page.limit,
    offset: cursors.offset ?? page.offset, finding_offset: cursors.finding_offset ?? page.finding_offset,
    stop_offset: cursors.stop_offset ?? page.stop_offset,
    ...(page.verify !== undefined ? { verify: page.verify } : {}) }
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const page_token = encoded + '.' + signature(store, encoded).toString('base64url')
  return { tool, arguments: { engagement: id, page_token, ...extra,
    ...(page.verify !== undefined ? { verify: page.verify } : {}) } }
}
