/** Discovery report with evidence stops and an explicit unfinished denominator. */
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { atomicWriteFileSync } from './atomic-write.js'
import { assertNoLinkedDescendants } from '../path-boundary.js'
import { awaReviewRows } from './awa-integration.js'
import { reportText as safeText, reportBlock as safeBlock, reportLocator as safeLocator, reportEvidenceRefs, redteamPrivateValues } from './report-text.js'
import { normalizeSubmissionDraft, SUBMISSION_FIELDS } from './src-submission.js'

const MAX_REPORT_BYTES = 16 * 1024 * 1024, MAX_REPORT_ROWS = 10000, MAX_REPORT_LINES = 100000
const budgetError = () => Object.assign(new Error('SRC report exceeds the local delivery budget; use bounded finding/delivery pages and a reviewed offline export.'), {
  code: 'SRC_REPORT_BUDGET', recovery: { requests_sent: 0, automatic_retry: false, next_action: 'redteam_delivery_report' },
})

export function buildSrcReport(store, id, { save = true } = {}) {
  const policy = store.assessmentPolicy(id)
  store.assertAssessmentMode(id, 'src')
  const db = store.db(id)
  if (db.prepare("SELECT COUNT(*) AS total FROM vuln WHERE src_eligible = 1 AND status IN ('confirmed','exploited','fixed')").get().total > MAX_REPORT_ROWS
    || db.prepare('SELECT COUNT(*) AS total FROM src_source_stop').get().total > MAX_REPORT_ROWS) throw budgetError()
  const findings = store.srcFindings(id)
  const pendingConfirmations = store.pendingSourceFindings(id)
  const stops = store.srcStops(id)
  const privateValues = redteamPrivateValues(db)
  const text = value => safeText(value, privateValues, 16384)
  const block = (value, limit = 65536) => safeBlock(value, privateValues, limit)
  const generatedAt = new Date().toISOString()
  const counts = db.prepare(`SELECT COUNT(*) AS total,
    SUM(status = 'candidate') AS candidates, SUM(status = 'confirmed') AS confirmed,
    SUM(status = 'false-positive') AS false_positives, SUM(status = 'fixed') AS fixed FROM vuln WHERE src_eligible = 1`).get()
  const excludedHardening = db.prepare('SELECT COUNT(*) AS total FROM vuln WHERE src_eligible = 0').get().total
  const reviews = awaReviewRows(store, id)
  const unresolved = Number(counts.candidates || 0) + pendingConfirmations.length
  const hasUnknowns = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'residual_unknown'").get()
  const unknownCounts = hasUnknowns ? db.prepare('SELECT status, COUNT(*) AS total FROM residual_unknown GROUP BY status').all() : []
  const unknowns = hasUnknowns ? db.prepare('SELECT unk_id, question, status, recommended_probe, resolution FROM residual_unknown ORDER BY rowid LIMIT 100').all() : []
  const unknownTotal = unknownCounts.reduce((sum, row) => sum + row.total, 0)
  const candidates = db.prepare("SELECT id, title, target, severity FROM vuln WHERE status = 'candidate' AND src_eligible = 1 ORDER BY id LIMIT 100").all()
  const submissionReady = findings.filter(row => row.submission.disposition === 'submission_ready').length
  const lines = ['# SRC 漏洞发现报告', '',
    '本报告记录范围内已取得直接证据的发现。每项确认后停止进一步探测；发现停止与整体评估耗尽分别记录。', '',
    `靶标：${text(id)}`, `生成时间：${generatedAt}`, '',
    '## 范围', '', ...policy.scope.map(rule => '- ' + text(rule)), '',
    '排除：' + (policy.exclude.map(text).join('；') || '无额外排除项'), '',
    '## 发现状态', '',
    `已登记 ${Number(counts.total)} 项；直接证据确认 ${findings.length} 项；待核实 ${unresolved} 项；误报 ${Number(counts.false_positives || 0)} 项；已修复 ${Number(counts.fixed || 0)} 项。`,
    `提交草稿完整 ${submissionReady} 项；已核实但材料待补 ${findings.length - submissionReady} 项。历史配置/信息项 ${excludedHardening} 项保留原记录，已从 SRC 漏洞分母排除。`,
    '“提交草稿完整”仅表示本地证据和字段检查通过。平台是否接收、是否重复、最终严重级和奖励以实际 SRC 项目复核为准；本报告未提交到平台。',
    `持久停止记录 ${stops.length} 条，覆盖 ${new Set(stops.map(stop => stop.target)).size} 个具体目标；修复或改变发现状态后原停止仍有效。`,
    `待办台账 ${unknownTotal} 项：${unknownCounts.map(row => text(row.status) + ' ' + row.total).join('；') || '尚无登记'}。`,
    '以上分母仅为已登记发现和待办，不表示未知攻击面已穷尽，也不替代内置评估的最终覆盖与结项判据。',
    '正常 baseline、HTTP 200、相同响应长度或源码指纹不能确认漏洞，也不能证明未测试的路径、漏洞族或业务接口安全。', '',
    '## 已取得直接证据的发现', '']
  for (const finding of findings) {
    const draft = normalizeSubmissionDraft(finding.submission_json)
    lines.push(`### ${finding.id}. ${text(finding.title)}`, '',
      `目标：${text(safeLocator(finding.target, privateValues))}`, `严重级：${text(finding.severity)}；类别：${text(finding.category)}`, '停止原因：direct_evidence_obtained', '',
      '提交项目：' + text(draft.program || '待填写实际 SRC 项目'),
      '规则引用：' + block(safeLocator(draft.policy_reference || '', privateValues), 2048),
      '收录依据（草稿）：' + block(draft.policy_basis || '尚未依据实际项目规则核对'),
      '查重记录：' + text(draft.duplicate_check) + (draft.duplicate_reference ? '；' + text(draft.duplicate_reference) : ''), '',
      '复现前提：' + block(draft.prerequisites || '待补充实际账号角色、资源及必要前提'), '',
      '最小复现步骤（已有材料）：', '', block(finding.reproduction || '尚未整理；只离线补齐，不再次请求已停止目标'), '',
      '预期安全结果：' + block(draft.expected_result || '待补充正常权限或安全控制应有的结果'), '',
      '实际观察（当前可信证明）：', '',
      ...finding.proofs.map(proof => `- ${text(proof.proof_type)}：${block(proof.observation)}；证据 ${proof.ev_id}`), '',
      ...finding.proofs.map(proof => `- 证明范围：${text(proof.proof_scope)}；操作 ${text(proof.operation_id)}；输入 ${text(proof.input_key || [proof.input_location, proof.input_selector].filter(Boolean).join(':') || 'operation')}；级别上限 ${text(proof.severity_cap)}。${proof.limitations.map(text).join('；')}`), '',
      '影响分析（提交草稿）：' + block(finding.impact || '待按上述实际证明补充，不能推断更深影响'), '',
      '影响限于所列目标与证据观察，未扩展验证更高权限或更深影响。', '')
    lines.push('修复建议：' + block(finding.remediation || '待结合具体漏洞根因补充'), '',
      finding.submission.missing_fields.length ? '提交前待补：' + finding.submission.missing_fields.map(text).join('、')
        : '本地提交草稿字段已齐备，待操作者按实际平台规则复核并提交。', '')
  }
  if (!findings.length) lines.push('尚无通过直接证据检查的确认项。', '')
  if (pendingConfirmations.length) lines.push('## 来源标签待复核', '',
    '历史确认标签保留在原台账；以下条目缺少当前可信命题证明，不计入本报告确认项。', '',
    ...pendingConfirmations.map(row => `- ${row.id}. ${text(row.title)}：${row.confirmation.pending.map(text).join('；')}`), '')
  lines.push('## 持久停止台账', '', '| 发现 ID | 原停止目标 | 停止时间 | 证据引用 |', '| --- | --- | --- | --- |')
  for (const stop of stops) {
    const refs = reportEvidenceRefs(stop.evidence_refs)
    lines.push(`| ${stop.vuln_id} | ${text(safeLocator(stop.target, privateValues))} | ${text(stop.stopped_at)} | ${refs.evidence_refs.join('、') || '—'} |`)
  }
  if (!stops.length) lines.push('| — | 尚无停止记录 | — | — |')
  lines.push('', '停止记录保留原目标与当时证据，后续编辑或修复不授权再次请求。需要新的复测范围时使用新的明确任务。', '')
  lines.push('## 后续复核', '',
    `近期复核回执 ${reviews.length} 份；未经当前判据核实的来源命中仍为候选。`,
    '根据候选和实际前提继续最小验证；已确认目标仅做离线证据、修复建议和报告整理。', '',
    '本报告不包含 Shell、隧道、凭据或权限维持交付要求。', '')
  lines.push('## 待核实候选', '', '| ID | 标题 | 目标 | 严重级 |', '| --- | --- | --- | --- |',
    ...candidates.map(row => `| ${row.id} | ${text(row.title)} | ${text(safeLocator(row.target, privateValues))} | ${text(row.severity)} |`), '',
    `本页展示 ${candidates.length}/${unresolved} 个候选；剩余候选使用 redteam_vuln_query 分页，不因报告页限而移出分母。`, '',
    '## 受阻与恢复条件', '', '| ID | 状态 | 问题 | 恢复条件 |', '| --- | --- | --- | --- |',
    ...unknowns.map(row => `| ${text(row.unk_id)} | ${text(row.status)} | ${text(row.question)} | ${text(row.resolution || row.recommended_probe || '按实际前提补齐')} |`), '',
    `本页展示 ${unknowns.length}/${unknownTotal} 项待办；未展示的记录仍保留，使用 redteam_unknown_list 查看。`,
    '本发现报告没有读取当前引擎覆盖契约。使用 redteam_delivery_report 查看真实覆盖和剩余项；零确认或零候选不能推断任务完成。', '',
    '公开报告省略目标 URL 查询值；完整请求保留在受保护的证据工件中。', '')
  const markdown = lines.join('\n')
  const snapshot = { schema: 'dsh-purge-src-submission/v1', engagement: id, assessment_mode: 'src',
    generated_at: generatedAt, scope: policy.scope.map(text), exclude: policy.exclude.map(text),
    counts: { registered: Number(counts.total), verified: findings.length, submission_ready: submissionReady,
      report_incomplete: findings.length - submissionReady, candidates: unresolved, excluded_hardening: excludedHardening,
      false_positives: Number(counts.false_positives || 0), fixed: Number(counts.fixed || 0), unknowns: unknownTotal,
      pending_proof: pendingConfirmations.length, stop_records: stops.length },
    findings: findings.map(row => ({ id: row.id, title: text(row.title), target: safeLocator(row.target, privateValues),
      severity: text(row.severity), category: text(row.category), submission: row.submission,
      draft: Object.fromEntries(Object.entries(normalizeSubmissionDraft(row.submission_json)).map(([key, value]) => [key,
        key === 'policy_reference' ? block(safeLocator(value, privateValues), 16384) : block(value, (SUBMISSION_FIELDS[key] || 128) * 8)])),
      reproduction: block(row.reproduction), impact_analysis: block(row.impact), remediation: block(row.remediation),
      proofs: row.proofs.map(proof => ({ ev_id: proof.ev_id, security_defect: true,
        target: safeLocator(proof.target, privateValues), title: text(proof.title),
        ...Object.fromEntries(['operation', 'authority', 'recorded_at', 'proof_type', 'category', 'operation_id',
          'input_location', 'input_selector', 'input_key', 'proof_scope', 'severity_cap'].map(key => [key, text(proof[key])])),
        observation: block(proof.observation), limitations: proof.limitations.map(value => block(value, 4096)) })) })),
    pending_confirmations: pendingConfirmations.map(row => ({ id: row.id, title: text(row.title),
      target: safeLocator(row.target, privateValues), pending: row.confirmation.pending.map(text) })),
    stops: stops.map(row => ({ vuln_id: row.vuln_id, target: safeLocator(row.target, privateValues),
      stopped_at: text(row.stopped_at), ...reportEvidenceRefs(row.evidence_refs) })),
    candidates: candidates.map(row => ({ id: row.id, title: text(row.title), target: safeLocator(row.target, privateValues), severity: text(row.severity) })),
    unknowns: unknowns.map(row => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, text(value)]))),
    pages: { candidates_shown: candidates.length, candidates_total: Number(counts.candidates || 0),
      unknowns_shown: unknowns.length, unknowns_total: unknownTotal, page_limit: 100 },
    submitted: false, platform_acceptance: 'not_assessed', whole_scope_exhausted: false, requests_sent: 0 }
  const json = JSON.stringify(snapshot, null, 2) + '\n'
  if (Buffer.byteLength(markdown) > MAX_REPORT_BYTES || Buffer.byteLength(json) > MAX_REPORT_BYTES
    || markdown.split('\n').length > MAX_REPORT_LINES) throw budgetError()
  let path = null, jsonPath = null
  if (save) {
    const base = store.dirOf(id)
    const dir = assertNoLinkedDescendants(base, join(base, 'reports'))
    mkdirSync(dir, { recursive: true })
    path = assertNoLinkedDescendants(base, join(dir, 'src-findings.md'))
    jsonPath = assertNoLinkedDescendants(base, join(dir, 'src-findings.json'))
    atomicWriteFileSync(jsonPath, json)
    atomicWriteFileSync(path, markdown)
  }
  return { ok: true, engagement: id, assessment_mode: 'src', path, json_path: jsonPath, markdown, report: snapshot,
    confirmed: findings.length, candidates: unresolved, registered_findings: Number(counts.total),
    submission_ready: submissionReady, report_incomplete: findings.length - submissionReady, excluded_hardening: excludedHardening,
    source_confirmed_pending_proof: pendingConfirmations.length,
    unknown_total: unknownTotal, unknown_by_status: Object.fromEntries(unknownCounts.map(row => [row.status, row.total])),
    unknowns_shown: unknowns.length, candidates_shown: candidates.length,
    stopped_targets: new Set(stops.map(stop => stop.target)).size, stop_records: stops.length,
    coverage_exhausted: false, can_claim_complete: false, requests_sent: 0 }
}

export function srcReportReceipt(result) {
  return { ok: result.ok, engagement: result.engagement, assessment_mode: 'src', path: result.path, json_path: result.json_path,
    confirmed: result.confirmed, candidates: result.candidates, registered_findings: result.registered_findings,
    submission_ready: result.submission_ready, report_incomplete: result.report_incomplete, excluded_hardening: result.excluded_hardening,
    stopped_targets: result.stopped_targets, stop_records: result.stop_records,
    source_confirmed_pending_proof: result.source_confirmed_pending_proof,
    requests_sent: 0, submitted: false, platform_acceptance: 'not_assessed', coverage_exhausted: false, can_claim_complete: false,
    full_report_included: false, note: '完整提交草稿保存在返回的 Markdown/JSON 路径；平台接收和最终严重级需按实际项目规则复核。' }
}
