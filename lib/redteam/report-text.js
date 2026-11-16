/** Public report metadata: omit request bytes, URL queries and known secrets. */
const PUBLIC_EVIDENCE_LIMIT = 32
import { credentialValueOf } from './credential-vault.js'
export const PRIVATE_HEADER_NAME = /authorization|cookie|password|passwd|secret|token|api[-_]?key|credential|session/i

/** Learn both header strings and their credential fragments before publication. */
export function addPrivateHeaderValues(values, name, value, classified = false) {
  if (!classified && !PRIVATE_HEADER_NAME.test(name) || typeof value !== 'string' || !value) return
  values.add(value)
  if (/authorization/i.test(name) || /^(?:Bearer|Basic)\s/i.test(value)) {
    const match = /^[A-Za-z][A-Za-z0-9_-]*\s+(.+)$/.exec(value.trim())
    if (match) {
      values.add(match[1])
      if (/^Basic\s/i.test(value) && /^[A-Za-z0-9+/]+={0,2}$/.test(match[1])) {
        const decoded = Buffer.from(match[1], 'base64').toString('utf8')
        values.add(decoded)
        const separator = decoded.indexOf(':')
        if (separator >= 0 && decoded.slice(separator + 1)) values.add(decoded.slice(separator + 1))
      }
    }
  }
  if (/cookie/i.test(name)) for (const part of value.split(';')) {
    const separator = part.indexOf('=')
    if (separator >= 0) {
      if (/set-cookie/i.test(name) && /^(?:path|domain|expires|max-age|samesite)$/i.test(part.slice(0, separator).trim())) continue
      const credential = part.slice(separator + 1).trim().replace(/^"(.*)"$/, '$1')
      if (credential) values.add(credential)
    }
  }
}

export function redactKnownValues(value, privateValues = []) {
  let result = String(value ?? '')
  for (const secret of privateValues) {
    if (!secret) continue
    const variants = [secret]
    try { variants.push(encodeURIComponent(secret), encodeURIComponent(secret).replaceAll('%20', '+')) } catch { /* A malformed stored scalar stays literal. */ }
    for (const variant of new Set(variants)) {
      // Short credential values are not substrings of every unrelated ID or
      // route. Hide exact scalars/quoted values while keeping those IDs usable.
      if (variant.length < 4) {
        if (result === variant) result = '[redacted]'
        else for (const quote of ['"', "'"]) result = result.split(quote + variant + quote).join(quote + '[redacted]' + quote)
      } else result = result.split(variant).join('[redacted]')
    }
  }
  return result
}

/** Keep legacy strings in storage, but expose only bounded ledger references. */
export function reportEvidenceRefs(value) {
  let refs
  try { refs = typeof value === 'string' ? JSON.parse(value) : value ?? [] } catch {
    throw new Error('report evidence references contain malformed JSON')
  }
  if (!Array.isArray(refs) || refs.some(ref => typeof ref !== 'string')) {
    throw new Error('report evidence references must be an array of strings')
  }
  const ledgerRefs = [...new Set(refs.filter(ref => /^ev_[a-f0-9]{64}$/.test(ref)))]
  return { evidence_refs: ledgerRefs.slice(0, PUBLIC_EVIDENCE_LIMIT),
    omitted_non_ledger_refs: refs.filter(ref => !/^ev_[a-f0-9]{64}$/.test(ref)).length,
    omitted_ledger_refs: Math.max(0, ledgerRefs.length - PUBLIC_EVIDENCE_LIMIT) }
}

export function redteamPrivateValues(db) {
  const values = new Set()
  for (const [table, column] of [['credential', 'secret_value'], ['webshell', 'pass_key']]) {
    if (db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${column} IS NOT NULL`).get().n > 2000) {
      throw new Error('private credential context exceeds the report/exchange budget; use a reviewed offline manifest')
    }
    for (const row of db.prepare(`SELECT * FROM ${table} WHERE ${column} IS NOT NULL LIMIT 2000`).all()) {
      const secret = table === 'credential' ? credentialValueOf(db, row) : row[column]
      if (typeof secret === 'string' && secret.length) values.add(secret)
    }
  }
  return [...values].sort((left, right) => right.length - left.length)
}

export function reportLocator(value, privateValues = []) {
  try {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return '[redacted URL]'
    url.search = ''; url.hash = ''
    let decoded = url.href
    for (let index = 0; index < 3; index++) {
      if (privateValues.some(secret => secret.length >= 4 && decoded.includes(secret))) return '[redacted URL]'
      try { decoded = decodeURIComponent(decoded) } catch { break }
    }
    return url.href
  } catch { return String(value ?? '') }
}

function cleanReportText(value, privateValues) {
  let text = String(value ?? '')
  if (text.length > 128 * 1024) return '[oversized material omitted]'
  text = redactKnownValues(text, privateValues)
  return text
    .replace(/https?:\/\/[^\s<>"']+/gi, locator => reportLocator(locator, privateValues))
    .replace(/((?:authorization|cookie|set-cookie)\s*[:=]\s*)[^\r\n;]+/gi, '$1[redacted]')
    .replace(/\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi, 'Bearer [redacted]')
    .replace(/\bBasic\s+[A-Za-z0-9+/]+=*/gi, 'Basic [redacted]')
    .replace(/((?:authorization|cookie|set-cookie|password|passwd|secret|token|api[-_]?key)\s*[:=]\s*)[^\s,;]+/gi, '$1[redacted]')
    .replace(/\|/g, '\\|').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function reportText(value, privateValues = [], limit = 1200) {
  return cleanReportText(value, privateValues)
    .replace(/[\r\n\x00-\x1f\x7f]+/g, ' ')
    .slice(0, limit)
}

/** Preserve reproduction steps and complete bounded draft fields after redaction. */
export function reportBlock(value, privateValues = [], limit = 8192) {
  return cleanReportText(value, privateValues).replace(/\r\n?/g, '\n')
    .replace(/[\x00-\x09\x0b-\x1f\x7f]/g, ' ').slice(0, limit)
}
