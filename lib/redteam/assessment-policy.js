import { isIP } from 'node:net'

export const ASSESSMENT_MODES = Object.freeze(['redteam', 'src'])
export const SRC_ROLES = Object.freeze(['plan', 'recon', 'assess', 'vuln-scan'])
export const SRC_STAGES = Object.freeze([
  { code: 'recon', name: '范围与资产', goal: '整理已授权资产与已有材料' },
  { code: 'discovery', name: '漏洞发现', goal: '登记弱信号与待核实候选' },
  { code: 'verification', name: '直接证据', goal: '最小验证，直接证据到位后停止该漏洞' },
  { code: 'report', name: '报告交付', goal: '复核证据、描述影响范围及修复建议' },
].map((stage, i) => Object.freeze({ ...stage, subtitle: 'SRC', color: '#06b6d4', scored: 0, sections: [], tools: '内置评估', transition: '', sort_order: i })))

export function normalizeAssessmentMode(value) {
  const mode = value === undefined || value === null ? 'redteam' : String(value).trim().toLowerCase()
  if (!ASSESSMENT_MODES.includes(mode)) throw new Error('assessment_mode must be redteam or src')
  return mode
}

function ipNumber(ip) {
  if (isIP(ip) === 4) return ip.split('.').reduce((n, part) => (n << 8n) + BigInt(part), 0n)
  if (isIP(ip) !== 6) return null
  let text = ip.toLowerCase()
  const dotted = /([0-9]+(?:\.[0-9]+){3})$/.exec(text)
  if (dotted) {
    const parts = dotted[1].split('.').map(Number)
    text = text.slice(0, dotted.index) + ((parts[0] << 8) + parts[1]).toString(16) + ':' + ((parts[2] << 8) + parts[3]).toString(16)
  }
  const [head, tail] = text.split('::')
  const left = head ? head.split(':') : []
  const right = tail ? tail.split(':') : []
  const groups = tail === undefined ? left : [...left, ...Array(8 - left.length - right.length).fill('0'), ...right]
  return groups.reduce((n, part) => (n << 16n) + BigInt('0x' + part), 0n)
}

function scopeRule(raw) {
  if (typeof raw !== 'string' || !raw.trim() || raw.length > 2048 || /[\x00-\x20\\]/.test(raw.trim())) throw new Error('invalid SRC scope entry')
  const text = raw.trim()
  if (/^https?:\/\//i.test(text)) {
    const url = safeUrl(text)
    if (url.search || url.hash) throw new Error('SRC scope URL must omit query and fragment')
    return { kind: 'url', text: url.href.replace(/\/$/, ''), origin: url.origin, path: url.pathname.replace(/\/$/, '') || '/' }
  }
  if (text.includes('/')) {
    const [address, prefix, extra] = text.split('/')
    const version = isIP(address)
    const width = version === 4 ? 32 : version === 6 ? 128 : 0
    if (!width || extra !== undefined || !/^\d+$/.test(prefix) || Number(prefix) > width) throw new Error('invalid SRC scope CIDR')
    return { kind: 'cidr', text, address, prefix: Number(prefix), width }
  }
  if (isIP(text)) return { kind: 'host', text: text.toLowerCase(), host: text.toLowerCase() }
  const wildcard = text.startsWith('*.')
  const host = wildcard ? text.slice(2) : text
  if (!/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(host)) throw new Error('invalid SRC scope host')
  return { kind: wildcard ? 'domain' : 'host', text: text.toLowerCase(), host: host.toLowerCase() }
}

function safeUrl(text) {
  const url = new URL(text)
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || /[\\\x00-\x20]/.test(text)) throw new Error('invalid SRC target URL')
  // Encoded path separators and double encoding must not bypass a path prefix.
  if (/%(?:2f|5c|25)/i.test(url.pathname)) throw new Error('ambiguous SRC target path')
  return url
}

export function normalizeScopeRules(input, { required = false } = {}) {
  const values = input === undefined || input === null ? [] : typeof input === 'string' ? input.split(/[,\r\n]+/).map(v => v.trim()).filter(Boolean) : input
  if (!Array.isArray(values) || values.length > 256) throw new Error('scope/exclude must contain at most 256 entries')
  const result = [...new Set(values.map(value => scopeRule(value).text))]
  if (required && !result.length) throw new Error('SRC requires an explicit non-empty scope')
  return result
}

function targetParts(target) {
  const text = String(target || '').trim()
  if (!text) throw new Error('SRC target required')
  if (/^https?:\/\//i.test(text)) {
    const url = safeUrl(text)
    return { host: url.hostname.replace(/^\[|\]$/g, '').toLowerCase(), origin: url.origin, path: url.pathname, url: url.href }
  }
  if (isIP(text)) return { host: text.toLowerCase() }
  // A host:port is still an explicitly addressed target; no DNS lookup occurs.
  const url = safeUrl('http://' + text)
  if (url.pathname !== '/' || url.search || url.hash) throw new Error('SRC target must be an IP, hostname or explicit URL')
  return { host: url.hostname.replace(/^\[|\]$/g, '').toLowerCase() }
}

function matches(target, rule) {
  if (rule.kind === 'url') return target.origin === rule.origin && (rule.path === '/' || target.path === rule.path || target.path?.startsWith(rule.path + '/'))
  if (rule.kind === 'domain') return target.host.endsWith('.' + rule.host)
  if (rule.kind === 'host') {
    if (isIP(target.host) && isIP(rule.host)) return isIP(target.host) === isIP(rule.host) && ipNumber(target.host) === ipNumber(rule.host)
    return target.host === rule.host
  }
  if (isIP(target.host) !== (rule.width === 32 ? 4 : 6)) return false
  const shift = BigInt(rule.width - rule.prefix)
  return (ipNumber(target.host) >> shift) === (ipNumber(rule.address) >> shift)
}

export function targetWithinScope(target, scope, exclude = []) {
  const parts = targetParts(target)
  return scope.some(raw => matches(parts, scopeRule(raw))) && !exclude.some(raw => matches(parts, scopeRule(raw)))
}

export function sameEvidenceTarget(left, right) {
  try {
    const a = targetParts(left), b = targetParts(right)
    return a.url && b.url ? a.url === b.url : !a.url && !b.url && a.host === b.host
  } catch { return false }
}

const SRC_TOOL_NAMES = new Set([
  'redteam_engagement_open', 'redteam_session_bind', 'redteam_session_info', 'redteam_preflight', 'redteam_agent_slot',
  'redteam_asset_add', 'redteam_asset_link', 'redteam_asset_query', 'redteam_asset_get', 'redteam_asset_stats', 'redteam_asset_graph',
  'redteam_role_prompt', 'redteam_roles', 'redteam_asset_test', 'redteam_asset_assess', 'redteam_asset_timeline',
  'redteam_vuln_add', 'redteam_vuln_query', 'redteam_vuln_update', 'redteam_shot_add', 'redteam_shot_list', 'redteam_shot_delete',
  'redteam_role_prompt_reset', 'redteam_web_list', 'redteam_domain_index', 'redteam_http_evidence_add', 'redteam_chain_add', 'redteam_chain',
  'redteam_report_targets', 'redteam_report', 'redteam_evidence_record', 'redteam_evidence_verify', 'redteam_evidence_upgrade',
  'redteam_evidence_list', 'redteam_unverified_count', 'redteam_unknown_record', 'redteam_unknown_resolve', 'redteam_unknown_list',
  'redteam_awa_status', 'redteam_awa_project', 'redteam_awa_sync', 'redteam_awa_call', 'redteam_src_report',
  'redteam_assessment_status', 'redteam_assessment_start', 'redteam_assessment_run',
  'redteam_assessment_import', 'redteam_assessment_review',
])

export function isSrcAllowedTool(toolName) { return SRC_TOOL_NAMES.has(String(toolName || '')) }

export const SRC_BLOCKED_OPERATIONS = new Set([
  'addCredential', 'addAccess', 'addWebshell', 'updateWebshell', 'addTunnel', 'updateTunnel', 'probeSessions',
  'addScoreHit', 'saveScorePoint', 'deleteScorePoint', 'addAttackFile',
])

export const SRC_POLICY_TEXT = `你在 SRC 模式中执行授权范围内的漏洞发现。先读取当前靶标的 scope 和 exclude。
只收集证明漏洞所需的最少直接证据；扫描命中、版本指纹、反射字符串或子智能体回报先登记为 candidate。
confirmed 必须绑定本靶标内已核实的 observed 证据，明确目标、请求/响应或现场证据及适用范围。
一旦获得直接证据，停止该漏洞的后续探测，记录 stop_reason=direct_evidence_obtained，整理复现与修复建议。
不提取业务数据、不爆破凭据、不执行系统命令、不上传可执行文件、不建立 Shell/隧道、不横向移动、不维持权限。
未知结果保留为 candidate/blocked；不以缺少深入利用结果为由重复验证已确认漏洞。`

export function srcRolePrompt(role) {
  if (!SRC_ROLES.includes(role)) throw new Error('SRC does not provide exploit/internal roles')
  const task = { plan: '组织范围内的发现、证据复核与报告；只派 recon/assess/vuln-scan。', recon: '整理已有公开与本地材料，仅登记范围内资产。', assess: '核对资产、请求、参数与覆盖缺口，排除超出范围的项目。', 'vuln-scan': '通过项目内置 redteam_assessment_run 执行最小验证，直接证据到位后停止该漏洞。' }[role]
  return `${SRC_POLICY_TEXT}\n\n当前角色：${role}。${task}\n`
}
