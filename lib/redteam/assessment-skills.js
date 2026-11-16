/** Package-owned SRC runbook delivery, with no user skill or preset rewrites. */
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { atomicWriteFileSync } from './atomic-write.js'
import { assertNoLinkedDescendants } from '../path-boundary.js'
import { withPresetDefaults } from '../preset-defaults.js'
import { ASSESSMENT_TOPICS, ASSESSMENT_TOPIC_FILES, skillCatalog, renderSkillIndex } from './skill-catalog.js'

const packageRoot = fileURLToPath(new URL('../../', import.meta.url))
export const SRC_SKILL_NAME = 'src-discovery'
export const srcSkillRootOf = home => join(home, 'redteam', 'src-skills')
export const SRC_RUNBOOK_RESOURCES = Object.freeze(['skill', 'workflow', 'submission', 'index', ...ASSESSMENT_TOPICS])
export const PENTEST_RUNBOOK_RESOURCES = Object.freeze(['skill', 'workflow', 'authentication', 'verification', 'index', ...ASSESSMENT_TOPICS])
export const SRC_NATIVE_SKILL_RESOURCES = Object.freeze(['SKILL.md', 'references/REDTEAM-AWA-SRC.md',
  'references/SRC-SUBMISSION.md', ...ASSESSMENT_TOPICS.map(topic => 'references/' + topic + '.md')])

function runbookIndex(mode, options) {
  const catalog = skillCatalog({ ...options, mode })
  return { ...catalog, name: mode + '-discovery', resource: 'index', content: renderSkillIndex(catalog) }
}

/** Fixed package resources; useful when a host has not exposed its skill tool. */
export function readAssessmentRunbook(resource = 'skill', options = {}) {
  if (resource === 'index') return runbookIndex('src', options)
  const files = { skill: ['skills', SRC_SKILL_NAME, 'SKILL.md'], workflow: ['docs', 'REDTEAM-AWA-SRC.md'],
    submission: ['docs', 'SRC-SUBMISSION.md'], ...ASSESSMENT_TOPIC_FILES }
  if (!Object.hasOwn(files, resource)) throw new Error('SRC runbook resource must be one of: ' + SRC_RUNBOOK_RESOURCES.join(', '))
  const file = join(packageRoot, ...files[resource])
  return { ok: true, name: SRC_SKILL_NAME, resource, source: 'installed_package', content: readFileSync(file, 'utf8'), requests_sent: 0 }
}

/** Pentest has a fixed runbook tool even on hosts without a native skill tool. */
export function readPentestRunbook(resource = 'skill', options = {}) {
  if (resource === 'index') return runbookIndex('pentest', options)
  const files = { skill: ['skills', 'pentest-discovery', 'SKILL.md'], workflow: ['docs', 'PENTEST.md'],
    authentication: ['skills', 'pentest-discovery', 'references', 'authentication.md'],
    verification: ['skills', 'pentest-discovery', 'references', 'verification.md'], ...ASSESSMENT_TOPIC_FILES }
  if (!Object.hasOwn(files, resource)) throw new Error('pentest runbook resource must be one of: ' + PENTEST_RUNBOOK_RESOURCES.join(', '))
  return { ok: true, name: 'pentest-discovery', resource, source: 'installed_package',
    content: readFileSync(join(packageRoot, ...files[resource]), 'utf8'), requests_sent: 0 }
}

function writeManaged(root, relative, content) {
  const file = assertNoLinkedDescendants(root, join(root, relative))
  try { if (readFileSync(file, 'utf8') === content) return false } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
  atomicWriteFileSync(file, content)
  return true
}

/** The same runbook is visible to redteam and to SRC's dedicated skill root. */
export function installAssessmentSkills(home) {
  const source = join(packageRoot, 'skills', SRC_SKILL_NAME, 'SKILL.md')
  if (!existsSync(source)) throw new Error('bundled SRC discovery skill is missing')
  const body = readFileSync(source, 'utf8').replaceAll('../../docs/REDTEAM-AWA-SRC.md', 'references/REDTEAM-AWA-SRC.md')
    .replaceAll('../../docs/SRC-SUBMISSION.md', 'references/SRC-SUBMISSION.md')
  const reference = readFileSync(join(packageRoot, 'docs', 'REDTEAM-AWA-SRC.md'), 'utf8')
  const roots = [srcSkillRootOf(home), join(home, 'redteam', 'skills')]
  let copied = 0
  for (const root of roots) {
    assertNoLinkedDescendants(home, root)
    mkdirSync(root, { recursive: true })
    const dir = assertNoLinkedDescendants(root, join(root, SRC_SKILL_NAME))
    mkdirSync(assertNoLinkedDescendants(root, join(dir, 'references')), { recursive: true })
    if (writeManaged(root, join(SRC_SKILL_NAME, 'SKILL.md'), body)) copied++
    if (writeManaged(root, join(SRC_SKILL_NAME, 'references', 'REDTEAM-AWA-SRC.md'), reference)) copied++
    if (writeManaged(root, join(SRC_SKILL_NAME, 'references', 'SRC-SUBMISSION.md'), readFileSync(join(packageRoot, 'docs', 'SRC-SUBMISSION.md'), 'utf8'))) copied++
    for (const [topic, segments] of Object.entries(ASSESSMENT_TOPIC_FILES)) {
      if (writeManaged(root, join(SRC_SKILL_NAME, 'references', topic + '.md'), readFileSync(join(packageRoot, ...segments), 'utf8'))) copied++
    }
  }
  return { name: SRC_SKILL_NAME, action: copied ? 'updated' : 'kept', copied,
    path: join(roots[0], SRC_SKILL_NAME, 'SKILL.md'), roots }
}

/** Adapt old registered SRC compositions in memory; original YAML stays intact. */
export function withSrcSkillTools(definition) {
  if (definition?.id !== 'src') return definition
  const plugins = structuredClone(definition.plugins)
  const locate = name => plugins.some(row => row.name === name)
  if (!locate('@deepseek-ai/dsh-skill-filesystem')) plugins.push({ id: 'src-skill-filesystem',
    name: '@deepseek-ai/dsh-skill-filesystem', config: { includeDefaultRoots: false,
      customSkillDirs: [{ __jsExpr: "dshHomePath('redteam/src-skills')" }] } })
  if (!locate('@deepseek-ai/dsh-tool-skill')) plugins.push({ id: 'src-tool-skill', name: '@deepseek-ai/dsh-tool-skill' })
  return withPresetDefaults({ ...definition, plugins })
}
