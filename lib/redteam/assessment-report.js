/** Combined delivery metadata. It never initializes, finalizes or contacts a target. */
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { assertNoLinkedDescendants } from '../path-boundary.js'
import { atomicWriteFileSync } from './atomic-write.js'
import { ASSESSMENT_ENGINE, INTERNAL_PROJECT_ID, readNativeContext, nativeRuntimeOf,
  currentNativeProject, callAssessmentRuntime } from './native-assessment.js'
import { assessmentContinuationOf, campaignProgressOf } from './assessment-guidance.js'
import { assessmentPreferencesOf } from './settings.js'
import { describeScoreEvidence } from './score-evidence.js'
import { evaluateScoreBoard, loadScoreMeta } from './score-rules.js'
import { reportText, reportLocator, reportEvidenceRefs, redteamPrivateValues } from './report-text.js'
import { isScopedAssessmentMode } from './assessment-policy.js'
import { resolvePage, nextPage } from './page-token.js'
import { srcSubmissionDisposition } from './src-submission.js'

const count = value => Number.isSafeInteger(value) && value >= 0
const countsOf = value => Object.fromEntries(Object.entries(value || {}).filter(([, item]) => count(item)))
const publicMetadata = (value, text) => typeof value === 'string' ? text(value)
  : Array.isArray(value) ? value.map(item => publicMetadata(item, text))
    : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value)
      .map(([key, item]) => [key, publicMetadata(item, text)])) : value
const bounded = (value, fallback, maximum) => {
  if (value === undefined) return fallback
  if (!count(value) || value > maximum) throw new Error('delivery report pagination must use bounded nonnegative integers')
  return value
}
const claimsOf = dimensions => Object.fromEntries(Object.entries(dimensions || {}).map(([key, value]) => [key,
  (Array.isArray(value) ? value : [value]).filter(row => row?.computed_by === 'engine'
    && count(row.numerator) && (row.denominator === null || count(row.denominator))
    && (row.denominator === null || row.numerator <= row.denominator))
    .map(row => ({ dimension: row.dimension, scope: row.scope, numerator: row.numerator, denominator: row.denominator,
      ratio: typeof row.ratio === 'number' && row.ratio >= 0 && row.ratio <= 1 ? row.ratio : null,
      status: row.status, unknown_extent: row.unknown_extent, computed_by: 'engine',
      ...(key === 'hypothesis' ? { disposition_rate: row.disposition_rate ?? null,
        outcomes: countsOf(row.dependency?.outcomes) } : {}) }))]))

/** Fresh local engine summary, without the facade's automatic initialization. */
export async function readAssessmentCoverage(store, id, options = {}) {
  options.signal?.throwIfAborted()
  let context
  try {
    context = readNativeContext(store, id)
    if (!context) return { state: 'not_initialized', model: null, engine: ASSESSMENT_ENGINE,
      registered_scope_only: true, complete: false, can_claim_registered_complete: false,
      requests_sent: 0, reason: 'concrete_http_context_not_prepared' }
    const runtime = nativeRuntimeOf(store, id, options)
    const signal = AbortSignal.any([AbortSignal.timeout(30000), ...(options.signal ? [options.signal] : [])])
    const local = { ...options, signal }
    await currentNativeProject(store, id, runtime, context, local)
    const action = context.model === 'v2' ? 'campaign.status' : 'plan.audit'
    const input = context.model === 'v2' ? { campaign_id: context.campaign_id } : { offset: 0, limit: 1, parameter_limit: 1 }
    const result = await callAssessmentRuntime(runtime, action, { ...input, project_id: INTERNAL_PROJECT_ID }, local)
    options.signal?.throwIfAborted()
    const progress = context.model === 'v2' ? campaignProgressOf(result, context.campaign_id) : assessmentContinuationOf(result)
    if (!progress) throw Object.assign(new Error('current engine coverage contract is unavailable'), { code: 'ASSESSMENT_COVERAGE_UNKNOWN' })
    const latest = readNativeContext(store, id)
    if (!latest || latest.model !== context.model || latest.campaign_id !== context.campaign_id) {
      throw Object.assign(new Error('assessment binding changed while the snapshot was read'), { code: 'ASSESSMENT_SNAPSHOT_CHANGED' })
    }
    const data = result.data
    const common = { state: progress.complete ? 'completed_registered_scope' : progress.kind === 'blocked' ? 'blocked'
      : progress.kind === 'inactive' ? 'inactive_unfinished' : 'unfinished', model: context.model,
      engine: ASSESSMENT_ENGINE, complete: progress.complete, can_claim_registered_complete: progress.complete,
      registered_scope_only: true, source_action: action, requests_sent: 0, snapshot_read_at: new Date().toISOString() }
    if (context.model === 'v2') return { ...common, campaign_id: context.campaign_id,
      campaign_state: data.campaign.state, progress: progress.progress, dimensions: claimsOf(data.dimensions),
      universe: { id: data.universe?.id, snapshot_hash: data.universe?.snapshot_hash,
        completeness_level: data.universe?.completeness_level, unknown_counts: countsOf(data.universe?.unknown_counts) },
      finding_summary: countsOf(data.finding_summary), delivery: { status: data.delivery.delivery_status,
        exhausted_authority: data.delivery.exhausted_authority, recorded_reason: data.campaign.delivery?.reason || null },
      remaining: data.delivery.remaining.map(row => ({ kind: row.kind, count: row.count })),
      family_matrix: (data.family_matrix || []).slice(0, 32).map(row => ({ family: row.test_family,
        status: row.status, total: row.total, outcomes: countsOf(row.counts) })) }
    return { ...common, continuation: progress.continuation,
      completion: { status: data.completion?.status, ...countsOf(data.completion) },
      security_coverage: countsOf(data.security_coverage),
      layers: Object.fromEntries(Object.entries(data.layers || {}).map(([key, value]) => [key, countsOf(value)])),
      remaining: Object.entries(countsOf(data.completion)).filter(([, total]) => total > 0)
        .map(([kind, total]) => ({ kind, count: total }))
        .concat(count(data.security_coverage?.operations_without_security_tests) && data.security_coverage.operations_without_security_tests > 0
          ? [{ kind: 'operations_without_security_tests', count: data.security_coverage.operations_without_security_tests }] : []),
      family_matrix: (data.category_matrix || []).slice(0, 32).map(row => ({ family: row.test_family,
        status: row.status, total: row.total, evaluated: row.evaluated, open: row.open,
        blocked: row.blocked, not_applicable: row.not_applicable, untraced_inputs: row.untraced_inputs })) }
  } catch (error) {
    options.signal?.throwIfAborted()
    return { state: 'unavailable', model: context?.model || null, engine: ASSESSMENT_ENGINE,
      complete: false, can_claim_registered_complete: false, registered_scope_only: true, requests_sent: 0,
      reason: typeof error.code === 'string' ? error.code : 'local_coverage_read_failed',
      note: 'Current local coverage could not be read. Preserve unfinished items; an unavailable audit is not exhaustion.' }
  }
}

function scoreSnapshot(store, id, page) {
  const db = store.db(id), meta = loadScoreMeta(db)
  const rows = db.prepare(`SELECT h.id, h.point_id, h.asset_id, h.vuln_id, h.target, h.port, h.points,
    h.multiplier, h.self_created, h.evidence_refs, h.recorded_at, p.code, p.name AS point_name,
    p.category, p.points AS default_points FROM score_hit h LEFT JOIN score_point p ON p.id = h.point_id
    ORDER BY h.recorded_at, h.id`).all()
  const evaluated = evaluateScoreBoard(db, rows, { meta, enabledOnly: true })
  const counts = { recorded_hits: rows.length, counted_hits: 0, points: 0, observed: 0, pending: 0, legacy_text: 0,
    self_created_excluded: 0, capped_excluded: 0, disabled_excluded: 0 }
  if (isScopedAssessmentMode(store.assessmentPolicy(id).assessment_mode)) return { enabled: false, summary: counts, categories: [],
    items: [], ...page, next_offset: null, page_kind: 'delivery_scores', proof_note: 'Scoped assessment modes use vulnerability evidence and coverage, without privilege scores.' }
  const originals = new Map(rows.map(row => [row.id, row]))
  const items = [], categories = new Map()
  for (const row of evaluated.items) {
    if (Number(row.self_created) === 1) { counts.self_created_excluded++; continue }
    if (evaluated.disabledIds.has(row.id)) { counts.disabled_excluded++; continue }
    if (row.capped) { counts.capped_excluded++; continue }
    const original = originals.get(row.id)
    const evidence = describeScoreEvidence(db, id, original.evidence_refs, original.target,
      { code: row.code, points: Number(original.points ?? original.default_points) })
    const index = counts.counted_hits++
    counts.points += row.points
    counts[evidence.state]++
    const group = categories.get(row.category || '') || { category: row.category || '', points: 0, hits: 0 }
    group.points += row.points; group.hits++; categories.set(group.category, group)
    if (index >= page.offset && items.length < page.limit) items.push({ id: row.id, code: row.code, name: row.point_name,
      target: row.target, points: row.points, evidence_state: evidence.state, evidence_refs: evidence.evidence_refs,
      outcome_bound: evidence.outcome_bound, pending: evidence.pending, recorded_at: row.recorded_at })
  }
  return { enabled: store.assessmentPolicy(id).assessment_mode !== 'src', summary: counts, categories: [...categories.values()],
    items, ...page, next_offset: page.offset + items.length < counts.counted_hits ? page.offset + items.length : null,
    page_kind: 'delivery_scores', proof_note: 'Observed is a ledger reference/outcome policy, not independent machine proof of every privilege or tier.' }
}

function findingSnapshot(store, id, page) {
  const db = store.db(id)
  const src = store.assessmentPolicy(id).assessment_mode === 'src'
  const filter = src ? ' WHERE src_eligible = 1' : ''
  const grouped = db.prepare('SELECT status, COUNT(*) AS total FROM vuln' + filter + ' GROUP BY status').all()
  const byStatus = Object.fromEntries(grouped.map(row => [row.status, row.total]))
  const total = grouped.reduce((sum, row) => sum + row.total, 0)
  const kinds = Object.fromEntries(db.prepare('SELECT finding_kind, COUNT(*) AS total FROM vuln' + filter + ' GROUP BY finding_kind').all()
    .map(row => [row.finding_kind, row.total]))
  const excluded_hardening = src ? db.prepare('SELECT COUNT(*) AS total FROM vuln WHERE src_eligible = 0').get().total : 0
  const items = db.prepare('SELECT * FROM vuln' + filter + ' ORDER BY id LIMIT ? OFFSET ?')
    .all(page.limit, page.offset).map(row => {
      const proof = store.findingProof(id, row)
      return { id: row.id, title: row.title, severity: row.severity, status: row.status, target: row.target,
        category: row.category, finding_kind: row.finding_kind, stop_reason: row.stop_reason,
        confirmation_state: proof.verified ? 'verified' : ['confirmed', 'exploited'].includes(row.status) ? 'pending_proof' : 'unverified',
        ...(src ? { submission: srcSubmissionDisposition(row, proof.verified ? proof.proofs : []) } : {}),
        ...reportEvidenceRefs(row.evidence_refs) }
    })
  return { registered_total: total, by_status: byStatus, by_kind: kinds, vulnerabilities: kinds.vulnerability || 0,
    hardening: kinds.hardening || 0, informational: kinds.informational || 0, excluded_hardening, items, ...page,
    next_offset: page.offset + items.length < total ? page.offset + items.length : null, page_kind: 'delivery_findings',
    note: 'Source status labels are declarations; current native proof review remains the confirmation boundary.' }
}

const table = (headers, rows) => ['| ' + headers.join(' | ') + ' |', '| ' + headers.map(() => '---').join(' | ') + ' |',
  ...rows.map(row => '| ' + row.join(' | ') + ' |')]
const stateLabel = { completed_registered_scope: '已登记任务已结项', unfinished: '仍有未完成项', blocked: '当前受阻',
  inactive_unfinished: '任务已暂停或部分交付', not_initialized: '尚未准备内部上下文', unavailable: '当前覆盖不可读取' }
const evidenceLabel = { observed: 'observed 引用', pending: '证据关联待补', legacy_text: '历史文字说明' }

export async function buildAssessmentDeliveryReport(store, id, args = {}, options = {}) {
  if (!args || typeof args !== 'object' || Array.isArray(args)
    || Object.keys(args).some(key => !['save', 'offset', 'finding_offset', 'stop_offset', 'limit', 'page_token'].includes(key))
    || args.save !== undefined && typeof args.save !== 'boolean') throw new Error('invalid delivery report fields')
  const page = resolvePage(store, id, 'delivery', args)
  const { limit } = page
  const scorePage = { offset: page.offset, limit }
  const findingPage = { offset: page.finding_offset, limit }
  const policy = store.assessmentPolicy(id), db = store.db(id)
  const privateValues = redteamPrivateValues(db), text = value => reportText(value, privateValues)
  const locator = value => text(reportLocator(value, privateValues))
  const coverage = await readAssessmentCoverage(store, id, options)
  options.signal?.throwIfAborted()
  const score = scoreSnapshot(store, id, scorePage), findings = findingSnapshot(store, id, findingPage)
  const stops = policy.assessment_mode === 'src' ? store.srcStops(id) : []
  const snapshot = { schema: 'dsh-purge-delivery/v1', generated_at: new Date().toISOString(), engagement: text(id),
    assessment_mode: policy.assessment_mode, scope: policy.scope.map(locator), exclude: policy.exclude.map(locator),
    assessment: publicMetadata(coverage, text), score: { ...score, categories: score.categories.map(row => ({ ...row, category: text(row.category) })),
      items: score.items.map(row => ({ ...row, name: text(row.name), target: locator(row.target) })) },
    findings: { ...findings, items: findings.items.map(row => ({ ...row, title: text(row.title), target: locator(row.target),
      severity: text(row.severity), status: text(row.status), stop_reason: row.stop_reason == null ? null : text(row.stop_reason) })) },
    src_stops: { records: stops.length, targets: new Set(stops.map(row => row.target)).size,
      items: stops.slice(page.stop_offset, page.stop_offset + limit).map(row => ({ vuln_id: row.vuln_id,
        target: locator(row.target), ...reportEvidenceRefs(row.evidence_refs), stopped_at: text(row.stopped_at) })),
      offset: page.stop_offset, limit, next_offset: page.stop_offset + limit < stops.length ? page.stop_offset + limit : null },
    preferences: assessmentPreferencesOf(store.root), requests_sent: 0, whole_scope_exhausted: false,
    can_claim_complete: policy.assessment_mode !== 'src' && coverage.can_claim_registered_complete,
    completion_scope: 'registered_assessment_only',
    boundaries: ['Scores, source labels and coverage are separate facts.', 'Known-case tracks retain separate denominators.',
      'SRC direct-evidence stops survive status edits and repair.', 'Unavailable or uninitialized coverage stays unknown.',
      'Independent awa_* workspaces and evidence do not confirm this embedded ledger.'] }
  const lines = ['# ' + (policy.assessment_mode === 'src' ? 'SRC 发现与评估交付报告' : policy.assessment_mode === 'pentest' ? '渗透测试与评估交付报告' : '红队得分与评估交付报告'), '',
    `靶标：${text(id)}`, `生成时间：${snapshot.generated_at}`, '', '## 范围', '',
    ...snapshot.scope.map(rule => '- ' + rule), '', '排除：' + (snapshot.exclude.join('；') || '无额外排除项'), '',
    '## 交付状态', '',
    `内置评估：${stateLabel[coverage.state] || text(coverage.state)}；模型：${coverage.model || '未选定'}；核心：${ASSESSMENT_ENGINE.version}。`,
    `来源已登记发现 ${findings.registered_total} 项：漏洞 ${findings.vulnerabilities} 项，加固建议 ${findings.hardening} 项，信息项 ${findings.informational} 项；候选 ${findings.by_status.candidate || 0} 项；来源 confirmed 标签 ${findings.by_status.confirmed || 0} 项。`,
    '得分仅反映现有计分规则；来源标签不能代替当前机器证明，报告和 checkpoint 不建立 finalization。',
    '覆盖和结项只对已登记任务成立，未知攻击面没有整体耗尽结论。', '']
  if (policy.assessment_mode === 'src') lines.push(`SRC 历史配置/信息项 ${findings.excluded_hardening} 项已排除，原材料保留。SRC 持久停止 ${snapshot.src_stops.records} 条，覆盖 ${snapshot.src_stops.targets} 个具体目标；修复和状态编辑后继续保留停止。`, '',
    ...table(['发现 ID', '停止目标', '时间', '证据引用'], snapshot.src_stops.items
      .map(row => [row.vuln_id, row.target, text(row.stopped_at), row.evidence_refs.map(text).join('、')])), '',
    `停止台账页：offset ${snapshot.src_stops.offset}，limit ${limit}；下一页 ${snapshot.src_stops.next_offset ?? '无'}。`, '')
  else if (policy.assessment_mode === 'redteam') lines.push('## 得分与证据', '', `当前计入 ${score.summary.counted_hits} 项，共 ${score.summary.points} 分。`,
    `observed 引用 ${score.summary.observed} 项；关联待补 ${score.summary.pending} 项；历史文字说明 ${score.summary.legacy_text} 项。`,
    'observed 引用表示本台账中的证据关联强度；高价值成果还需匹配 score_outcome 与基础分值档位，不等于引擎独立证明了全部权限。', '',
    ...table(['ID', '成果', '目标', '分数', '证据状态', '引用'], snapshot.score.items.map(row => [row.id, row.name, row.target,
      row.points, evidenceLabel[row.evidence_state], row.evidence_refs.join('、') || '—'])), '',
    `得分明细页：offset ${score.offset}，limit ${score.limit}；下一页 ${score.next_offset ?? '无'}。汇总使用全部已登记计分命中。`, '')
  lines.push('## 评估覆盖与未完成项', '')
  if (coverage.state === 'not_initialized' || coverage.state === 'unavailable') lines.push('覆盖状态：' + text(coverage.reason),
    '本报告保留当前来源记录，未初始化或不可读取的评估不记为零剩余，也不自动准备或重试。', '')
  else {
    if (coverage.model === 'v1') lines.push(`ready ${coverage.continuation.ready_total}；review ${coverage.continuation.review_total}；blocked ${coverage.continuation.blocked_total}；unresolved ${coverage.continuation.unresolved_total}。`,
      `frontier 轮数 ${coverage.continuation.frontier_rounds}；finalization ${text(coverage.continuation.finalization_id || '未结项')}。`, '')
    else lines.push(`Campaign：${coverage.campaign_id}；状态：${text(coverage.campaign_state)}；当前交付：${text(coverage.delivery.status)}。`,
      ...table(['维度/轨道', '分子', '分母', '状态'], Object.values(coverage.dimensions).flat().map(row =>
        [text(row.dimension + '/' + row.scope), row.numerator, row.denominator ?? '未知', text(row.status)])), '',
      'known_case 按轨道分别计数；处置率、实际测试率与机器证明质量分别解释。', '')
    lines.push(...table(['未完成类型', '数量'], coverage.remaining.map(row => [text(row.kind), row.count])), '',
      coverage.remaining.length ? '未测、受阻、未复核和 inconclusive 项保留在对应分母中；不同类型可能重叠，不合并成单一覆盖率。'
        : coverage.complete ? '当前引擎确认已登记任务结项。' : '当前零剩余计数尚不满足引擎结项门禁。', '')
    lines.push(...table(['漏洞族', '状态', '已登记'], coverage.family_matrix.map(row => [text(row.family), text(row.status), row.total])), '')
  }
  lines.push('## 来源发现与后续复核', '', ...table(['ID', '标题', '目标', '来源状态', '证据引用'], snapshot.findings.items
    .map(row => [row.id, row.title, row.target, text(row.status), row.evidence_refs.map(text).join('、') || '—'])), '',
    `来源发现页：offset ${findings.offset}，limit ${findings.limit}；下一页 ${findings.next_offset ?? '无'}。来源标签不自动升级为机器证明。`, '',
    '## 交付边界', '', '本报告省略原始请求、URL 查询值和凭据。完整复现材料保留在当前靶标的私有证据及得分复现报告中。',
    '公开证据引用每项最多 32 个合法 ev_id；非账本历史文字与超限引用只记录省略数量，原始记录仍保留在私有台账。',
    '内置 redteam_assessment_* 与独立 awa_* 使用不同工作区、项目和证据 ID；跨账本材料只能重新作为候选纳入，不能直接确认。',
    '报告生成只读取本地评估状态并按需保存报告，不访问目标、不自动结项或接受部分交付。', '')
  const markdown = lines.join('\n')
  snapshot.next = nextPage(store, id, 'delivery', { ...page,
    offset: score.offset + score.items.length, finding_offset: findings.offset + findings.items.length,
    stop_offset: page.stop_offset + snapshot.src_stops.items.length },
    { offset: score.next_offset, finding_offset: findings.next_offset, stop_offset: snapshot.src_stops.next_offset },
    'redteam_delivery_report', { save: args.save !== false })
  if (Buffer.byteLength(markdown) > 4 * 1024 * 1024 || Buffer.byteLength(JSON.stringify(snapshot)) > 4 * 1024 * 1024) {
    throw Object.assign(new Error('Delivery report exceeds its bounded 4 MiB page budget'), { code: 'ASSESSMENT_REPORT_BUDGET' })
  }
  let path = null, snapshotPath = null
  if (args.save !== false) {
    const base = store.dirOf(id), dir = assertNoLinkedDescendants(base, join(base, 'reports'))
    mkdirSync(dir, { recursive: true })
    const suffix = scorePage.offset || findingPage.offset || page.stop_offset ? `-${scorePage.offset}-${findingPage.offset}`
      + (page.stop_offset !== findingPage.offset ? `-${page.stop_offset}` : '') : ''
    path = assertNoLinkedDescendants(base, join(dir, 'assessment-delivery' + suffix + '.md'))
    snapshotPath = assertNoLinkedDescendants(base, join(dir, 'assessment-delivery' + suffix + '.json'))
    atomicWriteFileSync(snapshotPath, JSON.stringify(snapshot, null, 2) + '\n')
    atomicWriteFileSync(path, markdown)
  }
  return { ok: true, ...snapshot, path, snapshot_path: snapshotPath, markdown }
}

export function deliveryReportReceipt(result) {
  if (result?.ok !== true) return result
  const { markdown, findings, src_stops, ...metadata } = result
  return { ...metadata, findings: { ...findings, items: undefined }, src_stops: { ...src_stops, items: undefined },
    full_report_included: false, note: '完整交付页保存在返回路径和面板 API。翻页直接复用 next.arguments，汇总分母保留。' }
}
