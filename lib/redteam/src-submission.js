/** SRC intake is based on a security defect, never a severity label or scanner wording alone. */
const informationalKinds = new Set(['hardening', 'informational', 'configuration', 'best_practice'])
const informationalCategories = new Set([
  'missing_security_headers', 'security_headers', 'missing_headers', 'header_missing', 'headers',
  'version_disclosure', 'banner_disclosure', 'tls_configuration', 'ssl_configuration', 'cookie_flags',
  'best_practice', 'hardening', 'informational', 'configuration',
])
const informationalTitle = /(?:缺失|缺少|未设置|未配置|missing|absent|not\s+set|not\s+configured).{0,80}(?:安全.{0,6}头|请求头|响应头|security\s+headers?|headers?|HSTS|CSP|X-Frame-Options|X-Content-Type-Options|Referrer-Policy|Permissions-Policy)|(?:安全.{0,6}头|请求头|响应头|security\s+headers?|HSTS|CSP|X-Frame-Options|X-Content-Type-Options|Referrer-Policy|Permissions-Policy).{0,80}(?:缺失|缺少|未设置|未配置|missing|absent|not\s+set)|(?:版本|banner|version).{0,24}(?:泄露|披露|disclosure)|(?:TLS|SSL).{0,24}(?:弱配置|配置建议|configuration)|(?:Cookie).{0,40}(?:缺少|缺失|未设置|missing).{0,24}(?:Secure|HttpOnly|SameSite)/i
const mechanismTitle = /SQL.{0,8}(?:注入|injection)|\b(?:SQLi|XSS|SSRF|XXE|IDOR|RCE)\b|越权|未授权访问|敏感(?:信息|数据)泄露|任意文件(?:读取|写入|下载|上传)|路径遍历|命令注入|模板注入|反序列化|access.control|authorization|injection|path.traversal|deserial|account.takeover|sensitive.data/i
const mechanismCategories = new Set([
  'access_control', 'authorization', 'idor', 'authentication', 'account_takeover', 'sql_injection',
  'xss', 'ssrf', 'xxe', 'path_traversal', 'command_injection', 'template_injection', 'deserialization',
  'file_read', 'file_write', 'file_upload', 'sensitive_data_exposure', 'business_logic', 'csrf', 'cors', 'extraction',
])
export const SUBMISSION_FIELDS = Object.freeze({ program: 256, policy_reference: 2048, policy_basis: 4096,
  prerequisites: 4096, expected_result: 8192, duplicate_reference: 2048 })

/** These are analyst draft fields. They never certify proof or platform acceptance. */
export function normalizeSubmissionDraft(value = {}) {
  if (typeof value === 'string') value = JSON.parse(value)
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).some(key => !Object.hasOwn(SUBMISSION_FIELDS, key) && key !== 'duplicate_check')) {
    throw Object.assign(new Error('invalid SRC submission draft fields'), { code: 'SRC_SUBMISSION_FIELDS' })
  }
  const out = {}
  for (const [key, limit] of Object.entries(SUBMISSION_FIELDS)) {
    if (value[key] === undefined || value[key] === null) continue
    if (typeof value[key] !== 'string' || value[key].length > limit || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value[key])) {
      throw Object.assign(new Error('invalid bounded submission field: ' + key), { code: 'SRC_SUBMISSION_FIELDS' })
    }
    out[key] = value[key].trim()
  }
  out.duplicate_check = value.duplicate_check ?? 'not_checked'
  if (!['not_checked', 'checked_local', 'potential_duplicate'].includes(out.duplicate_check)) {
    throw Object.assign(new Error('invalid submission duplicate_check'), { code: 'SRC_SUBMISSION_FIELDS' })
  }
  return out
}

export function srcSubmissionDisposition(value = {}, proofs = []) {
  const category = String(value.category || '').trim().toLowerCase()
  const kind = String(value.finding_kind || '').trim().toLowerCase()
  const title = String(value.title || '')
  // finding-proof.js supplies this flag only after its full trusted, current,
  // exact-claim contract. Do not maintain another drifting native scope list.
  const directMechanism = proofs.length > 0 && proofs.every(proof => proof.security_defect === true)
  const configurationOnly = informationalKinds.has(kind) || informationalCategories.has(category) || informationalTitle.test(title)
  if (configurationOnly && !directMechanism) return {
    eligible: false, disposition: 'excluded_hardening', reason: 'configuration_or_information_without_proven_security_impact',
  }
  const actionable = mechanismCategories.has(category) || mechanismTitle.test(title) || directMechanism
  const draft = normalizeSubmissionDraft(value.submission ?? value.submission_json ?? {})
  const missing = []
  if (!directMechanism) missing.push('current_bound_security_proof')
  for (const key of ['program', 'policy_reference', 'policy_basis', 'prerequisites', 'expected_result']) {
    if (!draft[key]) missing.push(key)
  }
  for (const key of ['reproduction', 'impact', 'remediation']) if (!String(value[key] || '').trim()) missing.push(key)
  if (draft.duplicate_check !== 'checked_local') missing.push('duplicate_check')
  return { eligible: true, disposition: directMechanism ? missing.length ? 'report_incomplete' : 'submission_ready'
    : actionable ? 'security_candidate' : 'impact_review_required',
    reason: directMechanism ? 'current_bound_security_proof' : actionable ? 'security_mechanism_requires_verification' : 'concrete_security_impact_requires_verification',
    proof_verified: directMechanism, missing_fields: missing, platform_acceptance: 'not_assessed', submitted: false }
}

export function assertSrcSubmission(value, proofs = []) {
  const result = srcSubmissionDisposition(value, proofs)
  if (!result.eligible) throw Object.assign(new Error('SRC does not record configuration-only or informational findings without a proven security impact'), {
    code: 'SRC_NOT_SUBMITTABLE', disposition: result.disposition,
    recovery: { requests_sent: 0, recorded: false, reason: result.reason,
      next_action: 'redteam_src_runbook', resource: 'submission', automatic_retry: false },
  })
  return result
}
