/** Fixed installed knowledge resources. This module never executes tools or visits targets. */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { parseSkillDocument } from '../skills.js'

const root = fileURLToPath(new URL('../../', import.meta.url))
const MODES = new Set(['src', 'pentest', 'redteam'])
const CAPABILITY_TOOLS = Object.freeze({ assessment: ['redteam_assessment_run'],
  browser: ['redteam_assessment_run'], shell: ['bash', 'pwsh'],
  credentials: ['redteam_credential_add'], subagent: ['subagent', 'subagent_fork'],
  listener: ['listener_start'] })
export const ASSESSMENT_TOPICS = Object.freeze(['authorization', 'input-controls', 'frontend', 'browser',
  'evidence-levels', 'failure-triage', 'reporting', 'component-intelligence'])
export const ASSESSMENT_TOPIC_FILES = Object.freeze(Object.fromEntries(ASSESSMENT_TOPICS.map(topic =>
  [topic, Object.freeze(['skills', 'src-discovery', 'references', topic + '.md'])])))

function literals(value, pattern, upper = false) {
  if (value === undefined) return []
  const values = typeof value === 'string' ? [value] : value
  if (!Array.isArray(values) || values.length > 64) throw new Error('skill filters must contain at most 64 literal tags')
  return [...new Set(values.map(item => {
    if (typeof item !== 'string' || item.length > 64) throw new Error('invalid skill filter')
    const text = upper ? item.trim().toUpperCase() : item.trim().toLowerCase()
    if (!pattern.test(text)) throw new Error('invalid skill filter')
    return text
  }))]
}

function requirementState(requirement, options, visible) {
  if (requirement === 'shell' && (options.mode !== 'redteam' || options.bounded)
    || requirement === 'credentials' && options.mode === 'src'
    || requirement === 'subagent' && options.mode !== 'redteam') {
    return { requirement, state: 'blocked', reason: 'mode_does_not_provide_capability' }
  }
  const expectedTools = CAPABILITY_TOOLS[requirement]
  if (!expectedTools) return { requirement, state: 'blocked', reason: 'capability_not_implemented' }
  if (visible && !expectedTools.some(name => visible.has(name))) {
    return { requirement, state: 'blocked', reason: 'tool_not_registered' }
  }
  const runtime = options.capabilities?.[requirement]
  if (runtime === false) return { requirement, state: 'blocked', reason: 'runtime_unavailable' }
  if (!visible || runtime !== true) return { requirement, state: 'unknown', reason: 'current_runtime_not_verified' }
  return { requirement, state: 'available', reason: 'current_tool_and_runtime' }
}

function resources(mode) {
  const pack = mode === 'pentest' ? 'pentest-discovery' : 'src-discovery'
  const files = []
  if (mode !== 'redteam') files.push({ id: pack, name: pack, resource: 'skill',
    skill_resource: 'SKILL.md', path: ['skills', pack, 'SKILL.md'] })
  if (mode === 'pentest') for (const topic of ['authentication', 'verification']) {
    files.push({ id: pack + '/' + topic, name: pack, resource: topic,
      skill_resource: 'references/' + topic + '.md', path: ['skills', pack, 'references', topic + '.md'],
      fallback: { description: topic === 'authentication' ? '实际测试身份、匿名状态与凭据句柄' : '输入、安全控制与当前机器复核',
        tags: { cwe: topic === 'authentication' ? ['CWE-287', 'CWE-613'] : ['CWE-89', 'CWE-79', 'CWE-862'],
          class: [topic] }, requires: ['assessment'] } })
  }
  for (const topic of ASSESSMENT_TOPICS) files.push({ id: pack + '/' + topic, name: pack, resource: topic,
    skill_resource: 'references/' + topic + '.md', path: ASSESSMENT_TOPIC_FILES[topic] })
  if (mode === 'redteam') for (const file of readdirSync(join(root, 'skills', 'redteam')).sort()) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*\.md$/.test(file)) continue
    const name = file.slice(0, -3)
    files.push({ id: name, name, resource: 'skill', skill_resource: 'SKILL.md', path: ['skills', 'redteam', file] })
  }
  return files
}

/** Capability presence and policy are advisory metadata, never execution authorization or proof. */
export function skillCatalog(options = {}) {
  const mode = options.mode ?? 'redteam'
  if (!MODES.has(mode)) throw new Error('skill catalog mode must be src, pentest or redteam')
  if (options.bounded !== undefined && typeof options.bounded !== 'boolean') throw new Error('bounded must be a boolean')
  const bounded = mode !== 'redteam' || options.bounded === true
  const cwes = literals(options.cwe, /^CWE-[1-9][0-9]{0,6}$/, true)
  const classes = literals(options.classes, /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/)
  const limit = options.limit ?? 50
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new Error('skill catalog limit must be 1-100')
  if (options.capabilities !== undefined && (!options.capabilities || typeof options.capabilities !== 'object'
    || Array.isArray(options.capabilities) || Object.values(options.capabilities).some(value => ![true, false, null].includes(value)))) {
    throw new Error('skill capabilities must contain verified booleans or null')
  }
  let visible = null
  if (options.tools !== undefined) {
    const list = options.tools instanceof Set ? [...options.tools] : options.tools
    if (!Array.isArray(list) || list.length > 1024) throw new Error('skill tools must be a bounded current tool list')
    visible = new Set(list.map(item => typeof item === 'string' ? item : item?.name).filter(name => typeof name === 'string'))
  }
  const normalized = { ...options, mode, bounded }
  const items = []
  for (const entry of resources(mode)) {
    const content = readFileSync(join(root, ...entry.path), 'utf8')
    if (Buffer.byteLength(content, 'utf8') > 256 * 1024) throw new Error('bundled skill resource exceeds its read budget')
    const parsed = parseSkillDocument(content)
    if (!parsed.ok && !entry.fallback) throw new Error('invalid bundled skill metadata: ' + entry.id)
    const metadata = parsed.ok ? parsed : entry.fallback
    const tags = metadata.tags || { cwe: [], class: [] }
    if (cwes.length && !cwes.some(cwe => tags.cwe.includes(cwe))
      || classes.length && !classes.some(tag => tags.class.includes(tag))) continue
    const requirements = (metadata.requires || []).map(requirement => requirementState(requirement, normalized, visible))
    const invalidMetadata = metadata.metadataErrors?.length > 0
    const availability = invalidMetadata || requirements.some(item => item.state === 'blocked') ? 'blocked'
      : requirements.some(item => item.state === 'unknown') ? 'unknown' : 'available'
    if (availability === 'blocked' && options.includeBlocked === false) continue
    const next = mode === 'redteam' ? { tool: 'skill', arguments: { name: entry.name,
      ...(entry.skill_resource === 'SKILL.md' ? {} : { resource: entry.skill_resource }) } }
      : { tool: mode === 'src' ? 'redteam_src_runbook' : 'redteam_pentest_runbook', arguments: { resource: entry.resource } }
    items.push({ id: entry.id, name: entry.name, resource: entry.resource, description: metadata.description,
      when_to_use: metadata.whenToUse || '', tags, requires: metadata.requires || [], availability,
      missing: requirements.filter(item => item.state !== 'available'), metadata_errors: metadata.metadataErrors || [],
      source: 'installed_package', source_sha256: createHash('sha256').update(content).digest('hex'),
      next: availability === 'blocked' ? null : { ...next, offline_only: true } })
  }
  const counts = { available: 0, unknown: 0, blocked: 0 }
  for (const item of items) counts[item.availability]++
  return { ok: true, mode, bounded, source: 'installed_package', requests_sent: 0,
    can_confirm: false, execution_authorized: false, total: items.length, counts,
    items: items.slice(0, limit), truncated: items.length > limit,
    note: '技能目录只选择固定指引；缺件和模式限制保留受阻。目录、标签和文件摘要不证明运行、漏洞或权限，也不授权目标请求。' }
}

/** Return concrete, loadable resources rather than treating a CWE match as a confirmed vulnerability. */
export function relatedSkills(cwes, options = {}) {
  if (cwes === undefined || Array.isArray(cwes) && cwes.length === 0) return []
  return skillCatalog({ ...options, cwe: cwes }).items
}

export function renderSkillIndex(catalog) {
  return ['# 当前模式技能索引', catalog.note,
    ...catalog.items.map(item => '- ' + item.id + '：' + item.description + ' [' + item.availability + ']'
      + (item.missing.length ? '；' + item.missing.map(row => row.requirement + '=' + row.reason).join(', ') : '')
      + (item.next ? '\n  加载：' + item.next.tool + ' ' + JSON.stringify(item.next.arguments) : ''))].join('\n')
}

/** Generated ahead of command examples so loading a guide cannot imply missing capabilities. */
export function generatedSkillRequirementNote(metadata) {
  const needs = metadata.requires?.length ? metadata.requires.join(', ') : '离线整理，不要求目标执行能力'
  return '<!-- generated:skill-requirements -->\n执行需求：' + needs + '。\n'
    + '执行前核对当前模式技能索引的 availability、requires 与 missing。模式禁止或本轮明确缺失的能力保留 blocked；运行前提未核实则为 unknown。'
    + '受阻时不执行正文命令、不换工具绕过；只继续当前模式已有前提的 typed 或离线工作。'
    + '技能标签、文件已存在和部署回执不授权执行，也不证明漏洞、权限或运行就绪。\n'
    + '<!-- /generated:skill-requirements -->'
}
