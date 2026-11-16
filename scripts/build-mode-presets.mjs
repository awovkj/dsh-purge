// Generate package-owned policy and common composition blocks; never DSH_HOME.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'yaml'
import { policyTextForMode, generatedModePolicy, stripGeneratedModePolicy } from '../lib/redteam/assessment-policy.js'
import { SHARED_TODO_YAML, SHARED_PRESENT_YAML, SHARED_COMPACTION_YAML } from '../lib/preset-defaults.js'
import { parseSkillDocument } from '../lib/skills.js'
import { generatedSkillRequirementNote, ASSESSMENT_TOPIC_FILES } from '../lib/redteam/skill-catalog.js'
import { DEFAULT_PROMPTS, MODEL_EVIDENCE_GUIDANCE } from '../lib/redteam/role-prompts.js'

const root = fileURLToPath(new URL('../', import.meta.url))
const check = process.argv.includes('--check')
const changed = []
function readText(file) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(fs.readFileSync(file)).replaceAll('\r\n', '\n')
  } catch (error) {
    throw new Error('Cannot read valid UTF-8 mode source: ' + path.relative(root, file), { cause: error })
  }
}
function assertSkillMetadata(relative, body, mode) {
  const frontmatter = /^---\n([\s\S]*?)\n---(?:\n|$)/.exec(body)
  const metadata = frontmatter && parse(frontmatter[1])
  const expectedName = mode + '-discovery'
  if (!metadata || metadata.name !== expectedName || typeof metadata.description !== 'string'
    || !metadata.description.trim() || /\?{3,}|\uFFFD/.test(metadata.description)) {
    throw new Error('Invalid or corrupted fixed skill metadata: ' + relative)
  }
  const discovery = parseSkillDocument(body)
  if (!discovery.ok || discovery.metadataErrors.length) throw new Error('Invalid fixed skill discovery metadata: ' + relative)
}
function write(relative, generated) {
  const file = path.join(root, relative), before = readText(file)
  if (before === generated) return
  changed.push(relative)
  if (!check) fs.writeFileSync(file, generated, 'utf8')
}
function replaceRow(source, id, value) {
  const lines = source.split('\n'), start = lines.findIndex(line => line === '- id: ' + id)
  if (start < 0) throw new Error('Missing shared row: ' + id)
  let end = start + 1
  while (end < lines.length && !lines[end].startsWith('- id: ')) end++
  lines.splice(start, end - start, value.trimEnd(), '')
  return lines.join('\n')
}
for (const [role, prompt] of Object.entries(DEFAULT_PROMPTS)) {
  if (prompt.split(MODEL_EVIDENCE_GUIDANCE).length !== 2) {
    throw new Error('Role does not consume the shared evidence contract exactly once: ' + role)
  }
}
for (const file of fs.readdirSync(path.join(root, 'skills', 'redteam')).sort()) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*\.md$/.test(file)) continue
  const relative = 'skills/redteam/' + file
  let source = readText(path.join(root, relative))
  const metadata = parseSkillDocument(source)
  if (!metadata.ok || metadata.name !== file.slice(0, -3) || metadata.metadataErrors.length) {
    throw new Error('Invalid bundled redteam skill discovery metadata: ' + relative)
  }
  const block = generatedSkillRequirementNote(metadata)
  const pattern = /<!-- generated:skill-requirements -->[\s\S]*?<!-- \/generated:skill-requirements -->/
  source = pattern.test(source) ? source.replace(pattern, block)
    : source.replace(/^(---\n[\s\S]*?\n---\n)/, '$1\n' + block + '\n')
  write(relative, source)
}
for (const [topic, segments] of Object.entries(ASSESSMENT_TOPIC_FILES)) {
  const metadata = parseSkillDocument(readText(path.join(root, ...segments)))
  if (!metadata.ok || metadata.metadataErrors.length) throw new Error('Invalid fixed assessment topic metadata: ' + topic)
}
for (const mode of ['src', 'pentest', 'redteam', 'unrestricted']) {
  const file = 'presets/' + mode + '/agent.cordis.yml'
  let source = readText(path.join(root, file))
  if (mode !== 'unrestricted') {
    const expression = /(^    prefix: \|\n)((?: {6}.*\n|\n)*)/m
    const match = expression.exec(source)
    if (!match) throw new Error('Missing persona block: ' + mode)
    let prefix = generatedModePolicy(mode)
    if (mode === 'redteam') {
      let existing = match[2].split('\n').map(line => line.startsWith('      ') ? line.slice(6) : line).join('\n').trimEnd()
      existing = stripGeneratedModePolicy(existing, mode, { packageOwned: true })
      if (existing.trim()) prefix += '\n' + existing
    }
    source = source.replace(expression, (_all, heading) => heading + prefix.split('\n').map(line => line ? '      ' + line : '').join('\n') + '\n')
  }
  source = replaceRow(source, 'tool-todo', SHARED_TODO_YAML)
  if (source.includes('- id: tool-present\n')) source = replaceRow(source, 'tool-present', SHARED_PRESENT_YAML)
  else if (source.includes('- id: present\n')) source = replaceRow(source, 'present', SHARED_PRESENT_YAML.replace('tool-present\n', 'present\n'))
  else if (mode === 'redteam') source = source.trimEnd() + '\n\n' + SHARED_PRESENT_YAML
  else throw new Error('Missing presentation row: ' + mode)
  source = replaceRow(source, 'compaction', SHARED_COMPACTION_YAML)
  write(file, source.trimEnd() + '\n')
  if (mode !== 'unrestricted') {
    const skill = 'skills/' + (mode === 'src' ? 'src-discovery' : mode === 'pentest' ? 'pentest-discovery' : 'redteam') + '/SKILL.md'
    if (fs.existsSync(path.join(root, skill))) {
      let body = readText(path.join(root, skill))
      if (mode !== 'redteam') assertSkillMetadata(skill, body, mode)
      const block = '<!-- generated:mode-policy -->\n' + policyTextForMode(mode) + '\n<!-- /generated:mode-policy -->'
      const pattern = /<!-- generated:mode-policy -->[\s\S]*?<!-- \/generated:mode-policy -->/
      body = pattern.test(body) ? body.replace(pattern, block) : body.trimEnd() + '\n\n' + block + '\n'
      write(skill, body)
    }
  }
}
const doc = 'docs/MODE-POLICIES.md'
const policyDoc = '# 三模式运行策略\n\n此页由 scripts/build-mode-presets.mjs 从代码契约生成。包内人设保留相同正文，注册时移除已知生成副本，由单个运行策略 section 提供。用户自定义原文保留。\n\n'
  + ['src', 'pentest', 'redteam'].map(mode => '## ' + mode + '\n\n' + policyTextForMode(mode) + '\n').join('\n')
if (!fs.existsSync(path.join(root, doc))) { changed.push(doc); if (!check) fs.writeFileSync(path.join(root, doc), policyDoc, 'utf8') }
else write(doc, policyDoc)
if (check && changed.length) { console.error('Generated mode files differ: ' + changed.join(', ')); process.exitCode = 1 }
else console.log(JSON.stringify({ check, changed }))
