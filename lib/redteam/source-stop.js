/** Frozen SRC resources: queries do not reopen a resource; route placeholders match one segment. */
import { isIP } from 'node:net'

export const SOURCE_STOP_FILE = 'dsh-source-stops.json'
export const SOURCE_STOP_SCHEMA = 'dsh-purge-source-stops/v1'
export const SOURCE_STOP_MAX_BYTES = 2 * 1024 * 1024

function endpoint(raw) {
  if (typeof raw !== 'string' || !raw || raw.length > 8192 || /[\x00-\x20\\]/.test(raw)) throw new Error('invalid source stop locator')
  const match = /^(https?):\/\/([^/?#]+)([^?#]*)/i.exec(raw)
  if (!match) throw new Error('source stop requires an HTTP(S) locator')
  const url = new URL(raw)
  if (url.username || url.password) throw new Error('source stop cannot contain credentials')
  const path = decodeURIComponent(match[3] || '/')
  if (/%(?:25|2f|5c)/i.test(match[3]) || /[\x00-\x1f\\]/.test(path) || path.includes('//')
    || path.split('/').some(part => part === '.' || part === '..')) throw new Error('ambiguous source stop path')
  return { origin: url.origin, path, host: url.hostname.replace(/^\[|\]$/g, ''), port: Number(url.port || (url.protocol === 'https:' ? 443 : 80)) }
}

export function sourceStopRule(target, extra = {}) {
  if (/^https?:\/\//i.test(target)) {
    const { origin, path } = endpoint(target)
    return { ...extra, kind: 'url', origin, path }
  }
  if (typeof target !== 'string' || !target || /[\x00-\x20\\/?#@]/.test(target)) throw new Error('invalid source stop host')
  const raw = isIP(target) === 6 ? '[' + target + ']' : target
  const url = new URL('http://' + raw)
  if (url.pathname !== '/' || url.username || url.password) throw new Error('invalid source stop host')
  const portMatch = /(?:\]|[^:]):([0-9]+)$/.exec(raw)
  const port = portMatch ? Number(portMatch[1]) : null
  if (port !== null && (!Number.isInteger(port) || port < 1 || port > 65535)) throw new Error('invalid source stop port')
  return { ...extra, kind: 'host', host: url.hostname.replace(/^\[|\]$/g, ''), port }
}

export function sourceRuleMatches(rule, locator, method) {
  const current = endpoint(locator)
  if (rule.method && method && rule.method !== method.toUpperCase()) return false
  if (rule.kind === 'host') return rule.host === current.host && (rule.port == null || rule.port === current.port)
  if (rule.kind !== 'url' || rule.origin !== current.origin) return false
  const expression = rule.path.split(/(\{[A-Za-z_][\w-]*\})/g).map(part => /^\{[A-Za-z_][\w-]*\}$/.test(part)
    ? '[^/]+' : part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('')
  return new RegExp('^' + expression + '$').test(current.path)
}

export const sourceStopMatches = (target, locator, method) => sourceRuleMatches(sourceStopRule(target), locator, method)
