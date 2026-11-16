/** Read only artifacts owned by the current, fixed internal assessment project. */
import { createHash } from 'node:crypto'
import { lstatSync, readFileSync } from 'node:fs'
import { isAbsolute, join, resolve } from 'node:path'
import { DatabaseSync } from './sqlite-runtime.js'
import { assertNoLinkedDescendants, within } from '../path-boundary.js'
import { INTERNAL_PROJECT_ID, readNativeContext } from './native-assessment.js'

export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
export const artifactError = (code, message) => Object.assign(new Error(message), { code, recovery: { requests_sent: 0 } })

export function assessmentProjectBase(store, id, context = readNativeContext(store, id)) {
  if (!context || context.engagement_id !== id || context.project_id !== INTERNAL_PROJECT_ID) {
    throw artifactError('ASSESSMENT_CONTEXT_REQUIRED', 'Prepare the current engagement before reading its assessment artifacts')
  }
  return assertNoLinkedDescendants(store.dirOf(id), join(context.workspace, 'projects', INTERNAL_PROJECT_ID))
}

/** WSL output is mapped only beneath this project's own already selected path. */
function ownedPath(base, value, context) {
  if (typeof value !== 'string' || !value || /[\x00-\x1f]/.test(value)) throw artifactError('ASSESSMENT_ARTIFACT_PATH', 'Invalid assessment artifact path')
  let candidate = value
  if (process.platform === 'win32' && context.executionBackend === 'wsl' && value.startsWith('/')) {
    let linuxBase
    const drive = /^([a-z]):[\\/](.*)$/i.exec(base)
    const unc = /^\\\\(?:wsl\$|wsl\.localhost)\\([^\\]+)\\(.*)$/i.exec(base)
    if (drive) linuxBase = '/mnt/' + drive[1].toLowerCase() + '/' + drive[2].replaceAll('\\', '/')
    else if (unc && unc[1].toLowerCase() === context.wslDistribution.toLowerCase()) linuxBase = '/' + unc[2].replaceAll('\\', '/')
    if (!linuxBase || !value.startsWith(linuxBase + '/')) throw artifactError('ASSESSMENT_ARTIFACT_PATH', 'WSL artifact is outside the current internal project')
    const parts = value.slice(linuxBase.length + 1).split('/')
    if (parts.some(part => !part || part === '.' || part === '..' || part.includes('\\'))) throw artifactError('ASSESSMENT_ARTIFACT_PATH', 'Invalid WSL artifact path')
    candidate = join(base, ...parts)
  } else candidate = isAbsolute(value) ? resolve(value) : resolve(base, value)
  if (!within(base, candidate)) throw artifactError('ASSESSMENT_ARTIFACT_PATH', 'Assessment artifact is outside the current internal project')
  return assertNoLinkedDescendants(base, candidate)
}

export function ownedAssessmentPath(store, id, value, context = readNativeContext(store, id)) {
  return ownedPath(assessmentProjectBase(store, id, context), value, context)
}

/** Model-supplied imports and report paths stay within this engagement. */
export function ownedAssessmentInputPath(store, id, value, context = readNativeContext(store, id)) {
  return ownedPath(store.dirOf(id), value, context || {})
}

export function readAssessmentArtifact(store, id, file, expectedHash, { context, maxBytes = 12 * 1024 * 1024 } = {}) {
  if (!/^[a-f0-9]{64}$/.test(expectedHash || '')) throw artifactError('ASSESSMENT_ARTIFACT_HASH', 'A complete artifact digest is required')
  const path = ownedAssessmentPath(store, id, file, context)
  const stat = lstatSync(path)
  if (!stat.isFile() || stat.nlink > 1 || stat.size > maxBytes) throw artifactError('ASSESSMENT_ARTIFACT_BUDGET', 'Assessment artifact must be a bounded regular file')
  const bytes = readFileSync(path)
  if (bytes.length > maxBytes || sha256(bytes) !== expectedHash) throw artifactError('ASSESSMENT_ARTIFACT_CHANGED', 'Assessment artifact no longer matches its recorded digest')
  return { path, bytes }
}

export function withAssessmentDatabase(store, id, context, read) {
  const base = assessmentProjectBase(store, id, context)
  const path = assertNoLinkedDescendants(base, join(base, 'assessment.sqlite3'))
  if (!lstatSync(path).isFile()) throw artifactError('ASSESSMENT_DATABASE_REQUIRED', 'The current assessment database is unavailable')
  const db = new DatabaseSync(path, { readOnly: true })
  try { return read(db) } finally { db.close() }
}

export function readEngineEvidence(store, id, evidenceId, context) {
  if (typeof evidenceId !== 'string' || !/^E-[a-f0-9]{32}$/.test(evidenceId)) throw artifactError('ASSESSMENT_EVIDENCE_ID', 'Use an actual evidence ID returned by this assessment')
  const record = withAssessmentDatabase(store, id, context, db => {
    const row = db.prepare("SELECT document FROM entities WHERE kind = 'evidence' AND id = ?").get(evidenceId)
    if (!row || Buffer.byteLength(row.document) > 4 * 1024 * 1024) throw artifactError('ASSESSMENT_EVIDENCE_MISSING', 'Evidence is absent from the current internal project')
    return JSON.parse(row.document)
  })
  if (record.id !== evidenceId || record.kind !== 'http' || record.artifact_path !== 'evidence/' + evidenceId + '.json') {
    throw artifactError('ASSESSMENT_EVIDENCE_ID', 'Only the current project\'s HTTP evidence can be read')
  }
  const { bytes } = readAssessmentArtifact(store, id, record.artifact_path, record.sha256, { context })
  const artifact = JSON.parse(bytes.toString('utf8'))
  const encoded = artifact.response?.body_base64
  if (typeof encoded !== 'string' || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) {
    throw artifactError('ASSESSMENT_EVIDENCE_BODY', 'Evidence response bytes are malformed')
  }
  const body = Buffer.from(encoded, 'base64')
  if (body.length !== artifact.response.length || sha256(body) !== artifact.response.body_sha256) {
    throw artifactError('ASSESSMENT_EVIDENCE_BODY', 'Evidence response bytes do not match their recorded digest')
  }
  return { record, artifact, body }
}
