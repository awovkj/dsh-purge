/** Discovery report with evidence stops and an explicit unfinished denominator. */
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { atomicWriteFileSync } from './atomic-write.js'
import { assertNoLinkedDescendants } from '../path-boundary.js'
import { awaReviewRows, redteamPrivateValues } from './awa-integration.js'

function safeLocator(value, privateValues = []) {
  try {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return '[redacted URL]'
    url.search = ''; url.hash = ''
    let decoded = url.href
    for (let index = 0; index < 3; index++) {
      if (privateValues.some(secret => decoded.includes(secret))) return '[redacted URL]'
      try { decoded = decodeURIComponent(decoded) } catch { break }
    }
    return url.href
  } catch { return String(value ?? '') }
}

function safeText(value, privateValues) {
  let text = String(value ?? '')
  if (text.length > 128 * 1024) return '[oversized material omitted]'
  for (const secret of privateValues) text = text.split(secret).join('[redacted]')
  return text
  .replace(/https?:\/\/[^\s<>"']+/gi, locator => safeLocator(locator, privateValues))
  .replace(/((?:authorization|cookie|set-cookie)\s*[:=]\s*)[^\r\n;]+/gi, '$1[redacted]')
  .replace(/\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi, 'Bearer [redacted]')
  .replace(/[\r\n]+/g, ' ').slice(0, 1200)
  .replace(/((?:authorization|cookie|set-cookie|password|passwd|secret|token|api[-_]?key)\s*[:=]\s*)[^\s,;]+/gi, '$1[redacted]')
  .replace(/\|/g, '\\|')
  .replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function buildSrcReport(store, id, { save = true } = {}) {
  const policy = store.assessmentPolicy(id)
  if (policy.assessment_mode !== 'src') throw new Error('SRC report requires a SRC engagement')
  const findings = store.srcFindings(id)
  const db = store.db(id)
  const privateValues = redteamPrivateValues(db)
  const text = value => safeText(value, privateValues)
  const counts = db.prepare(`SELECT COUNT(*) AS total,
    SUM(status = 'candidate') AS candidates, SUM(status = 'confirmed') AS confirmed,
    SUM(status = 'false-positive') AS false_positives, SUM(status = 'fixed') AS fixed FROM vuln`).get()
  const reviews = awaReviewRows(store, id)
  const unresolved = Number(counts.candidates || 0)
  const lines = ['# SRC 漏洞发现报告', '',
    '本报告记录范围内已取得直接证据的发现。每项确认后停止进一步探测；发现停止与整体评估耗尽分别记录。', '',
    `靶标：${text(id)}`, `生成时间：${new Date().toISOString()}`, '',
    '## 范围', '', ...policy.scope.map(rule => '- ' + text(rule)), '',
    '排除：' + (policy.exclude.map(text).join('；') || '无额外排除项'), '',
    '## 发现状态', '',
    `已登记 ${Number(counts.total)} 项；直接证据确认 ${findings.length} 项；待核实 ${unresolved} 项；误报 ${Number(counts.false_positives || 0)} 项；已修复 ${Number(counts.fixed || 0)} 项。`,
    '以上分母仅为已登记发现，不表示未知攻击面已穷尽，也不替代内置评估的最终覆盖与结项判据。', '',
    '## 已取得直接证据的发现', '']
  for (const finding of findings) {
    lines.push(`### ${finding.id}. ${text(finding.title)}`, '',
      `目标：${text(safeLocator(finding.target, privateValues))}`, `严重级：${text(finding.severity)}`, '停止原因：direct_evidence_obtained', '',
      ...finding.proofs.map(proof => `- ${text(proof.proof_type)}：${text(proof.observation)}；证据 ${proof.ev_id}`), '',
      '影响限于所列目标与证据观察，未扩展验证更高权限或更深影响。', '')
  }
  if (!findings.length) lines.push('尚无通过直接证据检查的确认项。', '')
  lines.push('## 后续复核', '',
    `近期复核回执 ${reviews.length} 份；未经当前判据核实的来源命中仍为候选。`,
    '根据候选和实际前提继续最小验证；已确认目标仅做离线证据、修复建议和报告整理。', '',
    '本报告不包含 Shell、隧道、凭据或权限维持交付要求。', '')
  lines.push('公开报告省略目标 URL 查询值；完整请求保留在受保护的证据工件中。', '')
  const markdown = lines.join('\n')
  let path = null
  if (save) {
    const base = store.dirOf(id)
    const dir = assertNoLinkedDescendants(base, join(base, 'reports'))
    mkdirSync(dir, { recursive: true })
    path = assertNoLinkedDescendants(base, join(dir, 'src-findings.md'))
    atomicWriteFileSync(path, markdown)
  }
  return { ok: true, engagement: id, assessment_mode: 'src', path, markdown,
    confirmed: findings.length, candidates: unresolved, registered_findings: Number(counts.total),
    coverage_exhausted: false, can_claim_complete: false, requests_sent: 0 }
}
