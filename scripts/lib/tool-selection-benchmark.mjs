const engagement = 'tool-selection-fixture'
const operation = 'O-0123456789abcdef0123456789abcdef'
const evidence = 'E-0123456789abcdef0123456789abcdef'
const campaign = 'CAM-0123456789abcdef0123456789abcdef'
const session = 'S-0123456789abcdef0123456789abcdef'
const url = 'https://tool-selection.fixture.invalid/page'
const terminal = (action, input) => ({ name: 'redteam_assessment_run', arguments: { engagement, action, input } })
const scenario = (id, mode, task, purpose, calls, extra = {}) => ({ id, mode, task,
  facts: { engagement, operation_id: operation, evidence_ids: [evidence], url, ...extra },
  routing_purposes: purpose, expected_calls: calls,
  instruction: '使用当前模式的真实工具调用记录；复用给定事实和返回的准确参数。口头说将调用不算调用。该基准不发送请求。' })

export const TOOL_SELECTION_CASES = [
  scenario('javascript_offline', 'pentest', '已有当前完整JavaScript，提取静态接口，避免新请求和浏览器。', ['auto', 'frontend'],
    [terminal('surface.from_evidence', { evidence_ids: [evidence] })], { material: 'complete_javascript' }),
  scenario('sourcemap_offline', 'src', '已有当前完整source map，离线分析源码与来源。', ['auto', 'frontend'],
    [terminal('surface.from_sourcemap', { evidence_id: evidence })], { material: 'complete_source_map' }),
  scenario('dom_ready', 'pentest', '明确HTML/DOM消费需求，native Playwright当前profile已实际探测成功。', ['auto', 'browser'],
    [terminal('browser.visit', { url, allow_write: false, headless: true, timeout: 15 })], { browser_ready: true, execution_required: true }),
  scenario('browser_missing', 'src', '需要DOM观察，但缺当前browser probe回执；先准备运行前提。', ['auto', 'browser'],
    [terminal('browser.probe', {})], { browser_ready: null }),
  scenario('json_read_only', 'redteam', '只需读取已有JSON字段，当前没有DOM或扫描需求。', [],
    [terminal('evidence.read', { evidence_id: evidence })], { material: 'complete_json' }),
  scenario('yak_http', 'redteam', '需要公开无正文GET按绑定URL重放，Yak的fuzzer/TLS/no-follow契约已核实，不是任意头部的完整原包重放。', ['request_replay'],
    [terminal('tool.yakit_replay', { operation_id: operation, url: 'http://tool-selection.fixture.invalid/read', effect: 'read_only' })],
    { url: 'http://tool-selection.fixture.invalid/read', yak_ready: true, execution_required: true }),
  scenario('yak_https', 'pentest', '需要HTTPS公开GET原包复放，必须保留协议与禁止重定向。', ['request_replay'],
    [terminal('tool.yakit_replay', { operation_id: operation, url: 'https://tool-selection.fixture.invalid/read', effect: 'read_only' })],
    { url: 'https://tool-selection.fixture.invalid/read', yak_ready: true, execution_required: true }),
  scenario('yak_missing_tls', 'pentest', 'Yak广告schema缺TLS控制，不能宣称重放ready；读取准备契约。', ['request_replay'],
    [terminal('action.help', { name: 'tool.probe' })], { yak_ready: false }),
  scenario('authenticated_replay', 'pentest', '已有核实身份，Yak不支持认证重放；使用保持同一身份的原生preflight备用路径。', ['request_replay'],
    [terminal('http.preflight', { operation_id: operation, session_id: session })], { auth: 'authenticated', session_id: session }),
  scenario('src_replay_denied', 'src', 'SRC不允许主动Yak重放，读取限制或使用无目标发送的原生preflight。', ['request_replay'],
    [terminal('action.help', { name: 'tool.yakit_replay' }), terminal('http.preflight', { operation_id: operation })], { yak_ready: false }),
  scenario('scanner_existing', 'src', '已有绑定本靶标的TscanPlus namespace及当前回执，先读摘要、已有结果或路由候选。', ['auto', 'scanner_results'],
    [terminal('tool.tscanplus_summary', {}), terminal('tool.tscanplus_results', { table: 'poccheck', result_limit: 20 }), terminal('tool.tscanplus_routes', {})],
    { scanner_ready: true, scanner_project: 'MCP-fixture', execution_required: true }),
  scenario('wsl_backend_mismatch', 'pentest', '操作者固定WSL后端，scanner回执来自native，需重新读准备契约，不能私自切后端或用通用shell。', ['auto', 'scanner_results'],
    [terminal('action.help', { name: 'tool.probe' })], { execution_backend: 'wsl', scanner_ready: false }),
  scenario('src_stopped_browser', 'src', '该operation已经直接证据停测，保留当前材料，只能离线检查。', ['auto', 'browser'],
    [terminal('evidence.inspect', { evidence_id: evidence }), terminal('surface.inspect', { operation_id: operation })], { stopped: true }),
  scenario('sql_v1_prepare', 'pentest', '当前固定v1，准备已登记SQL输入的实际基线与控制，不能切v2或直接dump。', ['sql_verification'],
    [terminal('assessment.prepare', { operation_id: operation })], { assessment_model: 'v1' }),
  scenario('sql_v2_prepare', 'redteam', '当前固定v2，SQL真实上下文与本活动冻结成员已就绪，读取当前活动配方。', ['sql_verification'],
    [terminal('campaign.next', { campaign_id: campaign, limit: 3 })], { assessment_model: 'v2', campaign_id: campaign }),
]

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const equal = (left, right) => {
  if (left === right) return true
  if (Array.isArray(left) || Array.isArray(right)) return Array.isArray(left) && Array.isArray(right)
    && left.length === right.length && left.every((value, index) => equal(value, right[index]))
  return object(left) && object(right) && Object.keys(left).length === Object.keys(right).length
    && Object.keys(left).every(key => Object.hasOwn(right, key) && equal(left[key], right[key]))
}
const ratio = (numerator, denominator) => denominator ? numerator / denominator : null

function routeMatches(call, entry) {
  if (call?.name !== 'redteam_assessment_run' || call.arguments?.engagement !== entry.facts.engagement
    || call.arguments?.action !== 'tool.route' || !object(call.arguments.input)
    || Object.keys(call.arguments).some(key => !['engagement', 'action', 'input'].includes(key))) return false
  const input = call.arguments.input
  return !Object.keys(input).some(key => !['purpose', 'operation_id', 'evidence_ids', 'campaign_id', 'limit'].includes(key))
    && entry.routing_purposes.includes(input.purpose ?? 'auto')
    && (input.operation_id === entry.facts.operation_id || input.operation_id === undefined && entry.id === 'scanner_existing')
    && (input.campaign_id === undefined || input.campaign_id === entry.facts.campaign_id)
    && (input.limit === undefined || Number.isSafeInteger(input.limit) && input.limit >= 1 && input.limit <= 10)
    && (input.evidence_ids === undefined || Array.isArray(input.evidence_ids) && input.evidence_ids.length <= 32
      && new Set(input.evidence_ids).size === input.evidence_ids.length
      && input.evidence_ids.every(identity => entry.facts.evidence_ids.includes(identity)))
}

function evaluateCase(entry, trace) {
  const calls = trace?.calls || []
  const issues = [], selected = [], valid = [], seen = []
  let routed = entry.routing_purposes.length === 0
  for (const [index, call] of calls.entries()) {
    if (seen.some(previous => equal(previous, call))) issues.push('duplicate_call_without_new_fixture_material')
    seen.push(call)
    if (routeMatches(call, entry)) { routed = true; valid.push(index); continue }
    if (entry.expected_calls.some(expected => equal(call, expected))) {
      selected.push(index)
      valid.push(index)
      if (!routed) issues.push('routing_trigger_missing_before_selection')
      continue
    }
    issues.push(call?.arguments?.action === 'tool.route' ? 'route_arguments_mismatch' : 'unexpected_tool_or_arguments')
  }
  if (!calls.length) issues.push('no_recorded_tool_calls')
  if (!selected.length) issues.push('expected_terminal_call_missing')
  return { id: entry.id, mode: entry.mode, calls: calls.length, exact_argument_calls: valid.length,
    selected: selected.length > 0, execution_required: entry.facts.execution_required === true,
    pass: selected.length > 0 && issues.length === 0, issues: [...new Set(issues)] }
}

export function evaluateToolSelection(trace) {
  if (!object(trace) || trace.schema !== 'purge-tool-selection-trace/v1' || !Array.isArray(trace.cases)
    || trace.cases.length > TOOL_SELECTION_CASES.length) throw new Error('Expected a bounded purge-tool-selection-trace/v1 cases array')
  const records = new Map()
  for (const row of trace.cases) {
    if (!object(row) || typeof row.id !== 'string' || !TOOL_SELECTION_CASES.some(entry => entry.id === row.id)
      || records.has(row.id) || !Array.isArray(row.calls) || row.calls.length > 32
      || row.calls.some(call => !object(call))) throw new Error('Unknown, duplicate or invalid benchmark case/call record')
    records.set(row.id, row)
  }
  const cases = TOOL_SELECTION_CASES.map(entry => evaluateCase(entry, records.get(entry.id)))
  const needed = cases.filter(row => row.execution_required)
  const calls = cases.reduce((total, row) => total + row.calls, 0)
  const legal = cases.reduce((total, row) => total + row.exact_argument_calls, 0)
  return { schema: 'purge-tool-selection-evaluation/v1', cases,
    summary: { total: cases.length, received: records.size, missing: cases.length - records.size,
      passed: cases.filter(row => row.pass).length, failed: cases.filter(row => !row.pass).length,
      scenario_success_rate: ratio(cases.filter(row => row.pass).length, cases.length),
      required_terminal_selection_recall: ratio(needed.filter(row => row.pass).length, needed.length),
      exact_argument_rate: ratio(legal, calls), tool_calls: calls, exact_argument_calls: legal },
    metric_scope: 'fixed_fixture_syntactic_selection_and_exact_binding_only',
    trace_origin_verified: false, real_model_selection_verified: false, runtime_execution_verified: false,
    execution_success_rate: null, target_requests: null, tokens: null,
    notice: 'A trace digest preserves supplied bytes. This scorer does not authenticate a model, execute tools, confirm vulnerabilities or measure real traffic/cost.' }
}
