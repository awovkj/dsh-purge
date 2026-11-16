/** Local credential storage; public lists expose handles, never the value. */
import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto'
import { lstatSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { assertNoLinkedDescendants } from '../path-boundary.js'
import { protectSecretFile, writeSecretFile } from '../secret-file.js'

const contexts = new WeakMap()
const PREFIX = 'purge-vault:v1:'
export function registerCredentialContext(db, root, engagement) { contexts.set(db, { root, engagement }) }

function keyOf(root, create = false) {
  const path = assertNoLinkedDescendants(root, join(root, '.credential-vault-key'))
  try {
    const stat = lstatSync(path)
    if (!stat.isFile() || stat.nlink > 1 || ![32, 44].includes(stat.size)) throw new Error('Credential vault key is not a regular encoded 32-byte key')
    protectSecretFile(path)
    const stored = readFileSync(path)
    const bytes = stored.length === 32 ? stored : /^[A-Za-z0-9+/]{43}=$/.test(stored.toString('ascii'))
      ? Buffer.from(stored.toString('ascii'), 'base64') : Buffer.alloc(0)
    if (bytes.length !== 32) throw new Error('Credential vault key is incomplete')
    return bytes
  } catch (error) {
    if (error.code !== 'ENOENT' || !create) throw error
  }
  try {
    const key = randomBytes(32)
    writeSecretFile(path, key.toString('base64'), { exclusive: true })
    return key
  } catch (error) {
    if (error.code === 'EEXIST') return keyOf(root, false)
    throw error
  }
}

const aad = (context, row) => Buffer.from(JSON.stringify([context.engagement, row.host, row.username || '', row.secret_type || 'password']))
export function sealCredentialValue(db, row, value) {
  if (value == null) return null
  const context = contexts.get(db)
  if (!context) throw new Error('Credential vault requires the owned store context')
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', keyOf(context.root, true), iv)
  cipher.setAAD(aad(context, row))
  const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()])
  return PREFIX + [iv, cipher.getAuthTag(), encrypted].map(bytes => bytes.toString('base64')).join(':')
}

export function credentialValueOf(db, row) {
  const value = row.secret_value
  if (typeof value !== 'string' || !value.startsWith(PREFIX)) return value ?? null
  const context = contexts.get(db)
  if (!context) throw new Error('Encrypted credential requires its owned vault context')
  const parts = value.slice(PREFIX.length).split(':')
  if (parts.length !== 3 || parts.some(part => !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(part))) throw new Error('Malformed encrypted credential')
  const [iv, tag, encrypted] = parts.map(part => Buffer.from(part, 'base64'))
  if (iv.length !== 12 || tag.length !== 16) throw new Error('Malformed credential envelope')
  const decipher = createDecipheriv('aes-256-gcm', keyOf(context.root), iv)
  decipher.setAAD(aad(context, row)); decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
}

export function credentialProjection(db, row, { reveal = false } = {}) {
  const hasValue = typeof row.secret_value === 'string' && row.secret_value.length > 0
  const projected = { ...row }
  let secret = null, available = hasValue, state = hasValue ? 'available' : 'not_recorded'
  if (hasValue) {
    try { secret = credentialValueOf(db, row) }
    catch (error) {
      if (reveal) throw error
      available = false; state = 'vault_unavailable'
      for (const key of ['note', 'secret_ref', 'source', 'tool']) if (projected[key]) projected[key] = '[private context unavailable]'
    }
  }
  if (!reveal && hasValue) {
    if (secret) for (const key of ['note', 'secret_ref', 'source', 'tool']) {
      if (typeof projected[key] === 'string') projected[key] = secret.length >= 4
        ? projected[key].split(secret).join('[redacted]') : projected[key] === secret ? '[redacted]' : projected[key]
    }
  }
  return { ...projected, credential_handle: 'cred_' + row.id, secret_value: reveal ? secret : null,
    secret_available: available, secret_state: state,
    storage: !hasValue ? 'reference_only' : row.secret_value.startsWith(PREFIX) ? 'local_encrypted' : 'legacy_plaintext',
    secret_redacted: !reveal }
}

export function credentialByHandle(db, handle) {
  if (typeof handle !== 'string' || !/^cred_[1-9][0-9]{0,14}$/.test(handle)) throw new Error('Use a credential_handle from this engagement')
  const row = db.prepare('SELECT * FROM credential WHERE id = ?').get(Number(handle.slice(5)))
  if (!row) throw new Error('Credential handle is not present in this engagement')
  return row
}
