import { isIP } from 'node:net'
import { createHash } from 'node:crypto'
import { isModeAllowedTool, isModeAllowedOperation, modeRestrictedOperations } from './mode-tools.js'
import { MODEL_EVIDENCE_GUIDANCE } from './role-prompts.js'
export { isModeAllowedTool, isModeAllowedOperation, isPresentationTool } from './mode-tools.js'

export const ASSESSMENT_MODES = Object.freeze(['redteam', 'src', 'pentest'])
export const SRC_ROLES = Object.freeze(['plan', 'recon', 'assess', 'vuln-scan'])
export const PENTEST_ROLES = Object.freeze(['plan', 'recon', 'assess', 'vuln-scan'])
export const SRC_STAGES = Object.freeze([
  { code: 'recon', name: '范围与资产', goal: '整理已授权资产与已有材料' },
  { code: 'discovery', name: '可提交漏洞发现', goal: '寻找具体安全缺陷，过滤纯加固建议和信息项' },
  { code: 'verification', name: '直接证据', goal: '最小验证，直接证据到位后停止该漏洞' },
  { code: 'report', name: '报告交付', goal: '复核证据、描述影响范围及修复建议' },
].map((stage, i) => Object.freeze({ ...stage, subtitle: 'SRC', color: '#06b6d4', scored: 0, sections: [], tools: '内置评估', transition: '', sort_order: i })))
export const PENTEST_STAGES = Object.freeze([
  { code: 'recon', name: '范围与资产', goal: '登记测试范围、身份、资源与实际资产' },
  { code: 'discovery', name: '攻击面与加固检查', goal: '覆盖漏洞候选、配置缺陷及安全控制缺口' },
  { code: 'verification', name: '安全测试与影响核验', goal: '按身份、输入、控制及变更契约核验实际漏洞影响' },
  { code: 'report', name: '完整渗透交付', goal: '分开交付已核实漏洞、加固建议、复现、恢复和未完成覆盖' },
].map((stage, i) => Object.freeze({ ...stage, subtitle: '渗透测试', color: '#a78bfa', scored: 0,
  sections: [], tools: '内置评估', transition: '', sort_order: i })))

export const isScopedAssessmentMode = mode => mode === 'src' || mode === 'pentest'
export const requiresBoundAssessment = policy => isScopedAssessmentMode(policy?.assessment_mode)
  || policy?.assessment_mode === 'redteam' && (policy.scope?.length > 0 || policy.exclude?.length > 0)

export const assessmentModeContract = mode => ({
  src: { finding_intake: 'src_security_defects_only', report_profile: 'src_submission',
    verification: 'minimal_direct_evidence', stop_on_direct_evidence: true, credential_management: false },
  pentest: { finding_intake: 'security_defects_and_hardening', report_profile: 'full_pentest',
    verification: 'authorized_controls_and_impact', stop_on_direct_evidence: false, credential_management: true },
  redteam: { finding_intake: 'engagement_objectives', report_profile: 'redteam_delivery',
    verification: 'authorized_objectives_and_controls', stop_on_direct_evidence: false, credential_management: true },
}[normalizeAssessmentMode(mode)])

export function normalizeAssessmentMode(value) {
  const mode = value === undefined || value === null ? 'redteam' : String(value).trim().toLowerCase()
  if (!ASSESSMENT_MODES.includes(mode)) throw new Error('assessment_mode must be redteam, src or pentest')
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

export const isSrcAllowedTool = toolName => isModeAllowedTool('src', toolName)
export const isPentestAllowedTool = toolName => isModeAllowedTool('pentest', toolName)

// Compatibility exports derive from the live operation table, not a second deny list.
export const SRC_BLOCKED_OPERATIONS = new Set(modeRestrictedOperations('src'))
export const PENTEST_BLOCKED_OPERATIONS = new Set(modeRestrictedOperations('pentest'))

const DISCOVERY_GUIDANCE = `技能与方法按 skill.index 的 CWE/class/requires 索引选择；能力 blocked 时先处理明确前提，unknown 不等于运行可用。SRC/渗透专题按 runbook 的 index、authorization、input-controls、frontend、browser、evidence-levels、failure-triage、reporting、component-intelligence 加载。
每次遇到新的消费点、浏览器需求、复放问题或扫描材料时先用 tool.route，按实际 operation_id/evidence_ids 和 purpose:auto/frontend/browser/request_replay/scanner_results/sql_verification 选择工具，复用返回的 next_step；它只读当前材料，不探测、不自动派发。
已有完整 JS/map 优先离线 AST/sourcemap，不为静态路由启动浏览器；DOM、SPA 或真实脚本执行需要 Playwright。公开无正文 GET 按绑定 URL 重放需要 Yak 的已核实 fuzzer、TLS 和禁止重定向契约，不是任意头部的完整原包重放；安装 Yakit 或 codec 握手不足。提供证据时保留原请求身份与 URL，多身份歧义、额外业务头或已脱敏 URL 先处理 missing，不能换成匿名、首个会话或默认 URL。已有扫描结果优先 TscanPlus 的独立项目 namespace 只读入口，不把读结果当主动扫描或确认漏洞。
WSL Kali 是操作者固定的运行后端，不是模型可随意切换的另一套权限；Linux 路径、发行版、Python、模块与浏览器缓存必须分别核实。工具未就绪时保留 missing，加载准备契约或处理不依赖它的任务，不能凭文件存在宣称可有效调用。
evidence.diff 对比两条当前完整 E-ID；surface.from_sourcemap 只分析已采集 map 或实际 inline map。差分、路由、源码和疑似秘密保持线索，不自动定级或发新请求。
http.capture_batch 每次最多20条明确只读请求；没有匿名 cookie_evidence_ids 时使用单个原生worker，匿名Cookie链保留逐项门面。每项重新核实范围、身份、Cookie、SRC停止和原生preflight；保留独立idempotency_key，取消和未知派发后先查已有run，不自动重放。实际发送、接收、字节与耗时按回执统计，复用为0新请求，未知保留null。
workspace.list/read 只读本靶标固定材料目录；intel.import/search/get 从 incoming 的 NVD/KEV/GHSA JSON 整理本地情报，来源声明和版本范围不能证明目标存在漏洞。
workflow.advice 只整理当前有效证明、已有候选和剩余前提；SRC停止优先，其他模式的后续影响核验仍需当前范围、真实身份、fixture和已实现typed provider。N/A处置只保存适用性草稿，没有机器排除证明时保留原分母和unverified_applicability，不据此结项。平台派发拒绝与目标HTTP响应分开记录，403不自动归为WAF。`

export const SRC_POLICY_TEXT = `你在 SRC 模式中执行授权范围内的漏洞发现。先读取当前靶标的 scope 和 exclude。
用 redteam_engagement_open 创建 assessment_mode=src 的独立靶标，scope 必须非空，exclude 必须明确（可为空）。会话和祖先绑定固定，切换预设不改变已有任务。
目标是提交 SRC 的真实漏洞；只登记具有具体安全机制与待核实影响的候选。单独缺失请求/响应安全头、版本/banner 暴露、TLS 或 Cookie 配置建议不写入漏洞台账，也不作为漏洞数量。
不能通过改标题、提高严重级或自称影响把加固建议变成漏洞。低危真实漏洞仍可保留；未知机制须先核实具体越权、数据泄露或执行等影响，平台最终接收以实际项目规则为准。
先用 redteam_src_runbook 加载随包 src-discovery 指引；四个角色稿在当前会话分阶段使用，不派生子会话。
开始记录时读 resource:submission 的漏洞提交流程：实际平台规则与范围、具体安全假设、最小验证、查重、复现/预期与实际/影响/修复/证据、操作者提交和平台复核。
submission 草稿记录实际项目、规则引用和收录依据、复现前提、预期安全结果与本地查重；reproduction/impact/remediation 整理已有材料。证明与草稿完整性分别显示，不能自称已提交或平台已接收。
实际响应先用 redteam_assessment_run 的 evidence.read 查看 JSON 字段结构或脱敏文本，根 JSON Pointer 是空字符串；不猜字段，不对 HTML/JS 使用 JSON 判据。
完整前端 JS 或带同一强 ETag 的连续 Range 片段可用 surface.from_evidence 离线解析；静态 API/DOM 线索保持未核实。大型响应截断后先查看运行记录，不循环重试或把片段当完整证据。
${DISCOVERY_GUIDANCE}
action.help 不传 name 时查看目录；陌生动作传确切名称。SRC 不提供 working_directory、独立 awa_*、scenario.run 或业务写入；缺浏览器保留 blocked，不把文件定位当运行成功。
只收集证明漏洞所需的最少直接证据；扫描命中、版本指纹、反射字符串或子智能体回报先登记为 candidate。
${MODEL_EVIDENCE_GUIDANCE}
一旦获得直接证据，停止该漏洞的后续探测，记录 stop_reason=direct_evidence_obtained，整理复现与修复建议。
不提取业务数据、不爆破凭据、不执行系统命令、不上传可执行文件、不建立 Shell/隧道、不横向移动、不维持权限。
continue_required=true 时按 next_step 继续当前获准工作；v2 读取 Campaign 覆盖和配方，离线准备不授权目标请求。
用户取消、新任务和实际前提优先；无进展或仅受阻时保留 checkpoint 与分母，不循环重试。
未知结果保留为 candidate/blocked；不以缺少深入利用结果为由重复验证已确认漏洞。`

export const REDTEAM_POLICY_TEXT = `你在红队模式中围绕当前演练任务组织资产、目标、协作和成果交付。
操作者声明的 scope/exclude 由本靶标持久策略固定，排除项优先；会话及父子绑定继承，换预设不扩大范围。
已声明范围的任务使用 redteam_assessment_run 的 typed 执行及本地台账；通用 shell、任意代码、后台命令、文件写入和未知工具不能证明范围，派发前拒绝。
${DISCOVERY_GUIDANCE}
未声明范围的历史任务保持原工具兼容，但不能宣称通用 shell 有目标围栏。具体测试仍遵循实际任务、引擎前提与变更策略。
同靶标全部根会话共享实际委派 lease 和名额；执行子会话为叶子，不再委派。未知派发结果先查持久状态，不重放任务。
${MODEL_EVIDENCE_GUIDANCE}
凭据使用本地加密句柄和明确用途，认证后仍须验证实际服务端主体与角色；报告隐藏秘密。
高价值成果必须匹配当前目标、可信观察与实际 score_outcome 档位，文字、旧标签或无关漏洞证明不能升级成果。
发现、得分、覆盖和剩余工作分别交付。报告、checkpoint 或零候选不代表整个范围已穷尽。
优先复用工具返回的 next.arguments；用户取消、新任务、实际缺失前提和未知写入优先，保留受阻分母和失败历史。`

export function srcRolePrompt(role) {
  if (!SRC_ROLES.includes(role)) throw new Error('SRC does not provide exploit/internal roles')
  const task = { plan: '在当前会话组织范围内的发现、证据复核与报告；依次使用角色稿，不创建子会话。', recon: '整理已有公开与本地材料，仅登记范围内资产。', assess: '核对资产、请求、参数与覆盖缺口，排除超出范围的项目。', 'vuln-scan': '通过项目内置 redteam_assessment_run 执行最小验证，直接证据到位后停止该漏洞。' }[role]
  return `当前角色：${role}。${task}\n当前 SRC 模式契约由人设及运行时策略统一提供；开始发现前加载 redteam_src_runbook。\n`
}

export const PENTEST_POLICY_TEXT = `你在渗透模式中使用本插件随包的 awa-ddd 核心完成授权范围内的渗透测试。
完整报告收录真实漏洞和独立的配置/加固建议；缺安全头等建议标为 hardening，不计为已证实可利用漏洞。测试覆盖、影响核验、授权变更与恢复状态均保留，取得直接证据后继续获准评估。
开始发现前加载 redteam_pentest_runbook resource:skill；认证和验证阶段分别读 resource:authentication/verification。固定指引在当前会话使用。
用 redteam_engagement_open 创建 assessment_mode=pentest 的独立靶标，scope 必须非空，exclude 必须明确（可为空）。
在当前会话依次完成范围与资产、攻击面登记、测试、证据复核和报告；不派生子会话，不指定外部源码或工作区。
用 redteam_assessment_status/start 准备靶标内的评估，redteam_assessment_run 执行 typed action；陌生动作先查询 action.help。
v1 使用 surface、plan、assessment 与 finding；v2 使用 Campaign、recon、test 与 review。模型首次选定后保持固定。
先用 evidence.read 读取实际 JSON 结构或脱敏文本；完整 JS/同强 ETag 连续分片用 surface.from_evidence 离线生成 API 线索。baseline 不能代替漏洞测试，也不把源码线索标为确认。
JSON 小页可加 include_values:true 批量读取脱敏标量。每个完整 JS 分别导入，不把不同资源拼成一个 Range 资产。
${DISCOVERY_GUIDANCE}
真实客户端需 SHA-256 时用 value.hash 计算已提供测试值，不猜哈希、不借外部工具执行代码。用 evidence.headers 检查状态头；http.capture/http.preflight 的 cookie_evidence_ids 私下传递同一匿名链的 Cookies。
登录后用 identity.session_from_evidence 建立未验证会话，再显式 identity.verify 验证真实自我信息端点；缺一个身份或浏览器只阻塞依赖它的项目，继续处理其他已具备前提的 HTTP 测试。
已有凭据使用本靶标 cred_<id> 句柄，identity.session 带 credential_url/credential_auth 私下应用并在首次验证前固定 origin，不回显密码。
优先解开共享认证前提，并按实际消费点覆盖输入测试族、正常/攻击/阴性控制与判据。声明 consumer、HTTP 200、401、读取队列或基线决策都不替代安全测试。
具体目标与测试必须遵循本靶标 scope、exclude 及引擎的前提和变更策略；渗透模式不适用 SRC 的直接证据停测规则。
扫描命中、来源 confirmed 标签和文字陈述先作为候选；用真实当前机器证据核验具体输入、漏洞及影响。
${MODEL_EVIDENCE_GUIDANCE}
v2 自动 provider 只覆盖明确上下文中的双组 SQL 布尔控制、模板控制、三种 GET 对象访问边界、HTML markup 反射 XSS 浏览器闭环及 generic；其它上下文/漏洞族保留受阻。自填 human review 只存草稿，不确认漏洞；补身份不能补出未实现 provider。重复失败保留历史和冷却，未知写入先检查与读回。
交付前调用 redteam_assessment_import 与 redteam_assessment_review verify:true 分别分页；来源模型发现与当前机器复核分开，未核实项目继续保留分母。
按当前 next_step 推进获准工作；用户取消、缺失前提和无进展时保留 checkpoint，未测、受阻和 inconclusive 保留分母。
通过 redteam_pentest_report 交付完整渗透测试报告，包含发现、证据、复现、影响、修复建议、覆盖和未完成项。
报告只整理本地台账，不发目标请求、不自动结项，不用报告生成成功推断整个授权范围已经耗尽。`

export function pentestRolePrompt(role) {
  if (!PENTEST_ROLES.includes(role)) throw new Error('pentest roles are plan, recon, assess and vuln-scan')
  const task = { plan: '组织当前靶标的评估、复核与完整报告交付。', recon: '登记本范围内实际资产、URL、路由与输入。',
    assess: '根据当前引擎覆盖与测试前提整理攻击面和待测项。', 'vuln-scan': '执行内置引擎测试，核验实际证据与漏洞影响，保留未核实项。' }[role]
  return `当前角色：${role}。${task}\n当前渗透模式契约由人设及运行时策略统一提供；按阶段加载 redteam_pentest_runbook。\n`
}

export const policyTextForMode = mode => ({ src: SRC_POLICY_TEXT, pentest: PENTEST_POLICY_TEXT, redteam: REDTEAM_POLICY_TEXT }[mode] || '')

const policyDigest = value => createHash('sha256').update(value).digest('hex')
export function generatedModePolicy(mode) {
  const policy = policyTextForMode(mode)
  if (!policy) throw new Error('Unknown generated policy mode')
  return `<!-- dsh-purge:mode-policy ${mode} sha256=${policyDigest(policy)} -->\n${policy}\n<!-- /dsh-purge:mode-policy -->`
}

/** Package generation can replace a self-consistent old block; runtime recognizes only current bytes. */
export function stripGeneratedModePolicy(prefix, mode, { packageOwned = false } = {}) {
  const policy = policyTextForMode(mode)
  const block = /^<!-- dsh-purge:mode-policy (src|pentest|redteam) sha256=([a-f0-9]{64}) -->\n([\s\S]*?)\n<!-- \/dsh-purge:mode-policy -->(?:\n|$)/.exec(prefix)
  if (block && block[1] === mode && policyDigest(block[3]) === block[2]
    && (packageOwned || block[3] === policy)) return prefix.slice(block[0].length)
  if (prefix === policy || prefix.trim() === policy) return ''
  if (prefix.startsWith(policy + '\n')) return prefix.slice(policy.length + 1)
  return prefix
}

/** One live policy section; custom YAML and unknown policy blocks stay intact. */
export function withModePersona(definition) {
  const mode = definition.id === 'src' ? 'src' : definition.id === 'pentest' ? 'pentest'
    : definition.id === 'redteam' ? 'redteam' : null
  const policy = policyTextForMode(mode)
  if (!policy) return definition
  const adapt = rows => rows.map(row => {
    if (row.group === true) return { ...row, config: adapt(row.config) }
    if (row.name !== '@deepseek-ai/dsh-persona' || typeof row.config?.prefix !== 'string') return row
    const prefix = row.config.prefix
    const rest = stripGeneratedModePolicy(prefix, mode)
    if (rest === prefix) return row
    return { ...row, config: { ...row.config, prefix: rest.trim()
      ? rest : { src: '当前任务采用 SRC 漏洞发现模式。', pentest: '当前任务采用渗透测试模式。', redteam: '当前任务采用红队演练模式。' }[mode] } }
  })
  return { ...definition, order: { src: 10, pentest: 11, redteam: 12 }[mode], plugins: adapt(definition.plugins) }
}
