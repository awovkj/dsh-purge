import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { parseSkillDocument, mergeSkillDocument, listSkills } from '../lib/skills.js'
import { skillCatalog, relatedSkills, ASSESSMENT_TOPICS } from '../lib/redteam/skill-catalog.js'
import { readAssessmentRunbook, readPentestRunbook, installAssessmentSkills,
  SRC_RUNBOOK_RESOURCES, PENTEST_RUNBOOK_RESOURCES, SRC_NATIVE_SKILL_RESOURCES } from '../lib/redteam/assessment-skills.js'
import { DEFAULT_PROMPTS, MODEL_EVIDENCE_CONTRACT, MODEL_EVIDENCE_GUIDANCE } from '../lib/redteam/role-prompts.js'
import { withAssessmentGuidance } from '../lib/redteam/assessment-guidance.js'
import { removeTreeNoFollowSync } from '../lib/remove-tree.js'

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'purge-skill-catalog-'))
  t.after(() => {
    const target = path.resolve(root)
    const relative = path.relative(path.resolve(os.tmpdir()), target)
    assert(relative && !relative.startsWith('..') && !path.isAbsolute(relative))
    assert(path.basename(target).startsWith('purge-skill-catalog-'))
    removeTreeNoFollowSync(target)
  })
  return root
}
const runtime = { assessment: true, browser: true, shell: true, credentials: true, subagent: true }
const currentTools = ['redteam_assessment_run', 'redteam_credential_add', 'bash', 'subagent']
const document = `---
name: fixture-skill
description: A literal fixture skill.
disable-model-invocation: true
user-invocable: false
metadata:
  cwe: [cwe-639, CWE-862, CWE-639]
  class: [Authorization, methodology]
  requires:
    - assessment
    - browser
---

Preserved fixture body.
`

test('discovery metadata parses canonical and compatibility forms without changing invocation policy', () => {
  const parsed = parseSkillDocument(document)
  assert.equal(parsed.ok, true)
  assert.deepEqual(parsed.tags, { cwe: ['CWE-639', 'CWE-862'], class: ['authorization', 'methodology'] })
  assert.deepEqual(parsed.requires, ['assessment', 'browser'])
  assert.deepEqual(parsed.metadataErrors, [])
  assert.equal(parsed.modelInvocable, false)
  assert.equal(parsed.userInvocable, false)
  const legacy = parseSkillDocument(`---\nname: legacy\ndescription: Fixture.\ncwe: [CWE-89]\nrequires: shell\ntags:\n  class: [injection]\n  cwe: [CWE-79]\n---\nbody`)
  assert.deepEqual(legacy.tags, { cwe: ['CWE-89', 'CWE-79'], class: ['injection'] })
  assert.deepEqual(legacy.requires, ['shell'])
  const ignoredBody = parseSkillDocument('---\nname: fixture\ndescription: Fixture.\n---\nmetadata:\n  requires: [shell]')
  assert.deepEqual(ignoredBody.requires, [])
})

test('malformed optional tags are reported and cannot be mistaken for valid execution requirements', () => {
  for (const field of ['requires: [$(do-not-execute)]', 'cwe: [CWE-0]', 'class: [&alias]', 'requires: {shell: true}']) {
    const parsed = parseSkillDocument('---\nname: fixture\ndescription: Fixture.\nmetadata:\n  ' + field + '\n---\nbody')
    assert.equal(parsed.ok, true, 'an optional metadata fault does not rewrite an imported document')
    assert.equal(parsed.metadataErrors.length, 1)
  }
  assert.throws(() => skillCatalog({ cwe: 'CWE-89 $(do-not-execute)' }), /invalid skill filter/)
  assert.throws(() => skillCatalog({ capabilities: { shell: 'located' } }), /verified booleans/)
})

test('skill editing and actual listing preserve metadata and invocation flags', async t => {
  const root = fixture(t)
  const merged = mergeSkillDocument('fixture-skill', 'Updated fixture description.', document)
  const parsed = parseSkillDocument(merged)
  assert.equal(parsed.description, 'Updated fixture description.')
  assert.deepEqual(parsed.requires, ['assessment', 'browser'])
  assert.equal(parsed.modelInvocable, false)
  assert.equal(parsed.userInvocable, false)
  assert(parsed.body.includes('Preserved fixture body.'))
  fs.mkdirSync(path.join(root, 'skills', 'fixture-skill'), { recursive: true })
  fs.writeFileSync(path.join(root, 'skills', 'fixture-skill', 'SKILL.md'), merged, 'utf8')
  const listed = await listSkills(root)
  assert.equal(listed.length, 1)
  assert.deepEqual(listed[0].tags.cwe, ['CWE-639', 'CWE-862'])
  assert.deepEqual(listed[0].requires, ['assessment', 'browser'])
  assert.equal(listed[0].modelInvocable, false)
})

test('mode and current tool visibility take precedence over optimistic capability booleans', () => {
  const scoped = skillCatalog({ mode: 'redteam', bounded: true, tools: currentTools, capabilities: runtime })
  const shell = scoped.items.find(item => item.name === 'active-scan')
  assert.equal(shell.availability, 'blocked')
  assert.equal(shell.next, null)
  assert.equal(shell.missing[0].reason, 'mode_does_not_provide_capability')
  assert.equal(scoped.items.find(item => item.name === 'asset-correlation').availability, 'available')
  const missing = skillCatalog({ mode: 'redteam', tools: ['redteam_assessment_run'], capabilities: runtime })
  assert.equal(missing.items.find(item => item.name === 'active-scan').missing[0].reason, 'tool_not_registered')
  const ordinary = skillCatalog({ mode: 'redteam', tools: currentTools, capabilities: runtime })
  assert.equal(ordinary.items.find(item => item.name === 'active-scan').availability, 'available')
  assert.equal(ordinary.execution_authorized, false)
  assert.equal(ordinary.can_confirm, false)
  assert.equal(ordinary.requests_sent, 0)
})

test('a browser failure blocks its own guidance while independent HTTP and offline resources remain usable', () => {
  const catalog = skillCatalog({ mode: 'pentest', tools: currentTools, capabilities: { ...runtime, browser: false } })
  assert.equal(catalog.items.find(item => item.resource === 'browser').availability, 'blocked')
  assert.equal(catalog.items.find(item => item.resource === 'browser').next, null)
  assert.equal(catalog.items.find(item => item.resource === 'authorization').availability, 'available')
  assert.equal(catalog.items.find(item => item.resource === 'evidence-levels').availability, 'available')
  const unknown = skillCatalog({ mode: 'src', tools: currentTools })
  assert.equal(unknown.items.find(item => item.resource === 'authorization').availability, 'unknown')
  assert.equal(unknown.items.find(item => item.resource === 'reporting').availability, 'available')
})

test('CWE and class matching returns bounded concrete resources with fixed offline loading arguments', () => {
  const related = relatedSkills(['cwe-639', 'CWE-639'], { mode: 'src', tools: currentTools, capabilities: runtime })
  assert(related.some(item => item.resource === 'authorization'))
  assert(related.every(item => item.tags.cwe.includes('CWE-639')))
  assert(related.every(item => item.next.tool === 'redteam_src_runbook' && item.next.offline_only === true))
  assert.equal(new Set(related.map(item => item.id)).size, related.length)
  assert.deepEqual(relatedSkills([], { mode: 'redteam' }), [])
  assert.deepEqual(relatedSkills(['CWE-999999'], { mode: 'src' }), [])
  const filtered = skillCatalog({ mode: 'pentest', classes: ['reporting'], limit: 1 })
  assert.equal(filtered.items.length, 1)
  assert.equal(filtered.truncated, true)
  assert(filtered.total > filtered.items.length)
  assert(filtered.items[0].tags.class.includes('reporting'))
  assert.throws(() => skillCatalog({ mode: 'src', limit: 0 }), /1-100/)
})

test('both fixed runbook tools expose all topical resources and reject path overrides', () => {
  for (const topic of ASSESSMENT_TOPICS) {
    assert(SRC_RUNBOOK_RESOURCES.includes(topic))
    assert(PENTEST_RUNBOOK_RESOURCES.includes(topic))
    assert(SRC_NATIVE_SKILL_RESOURCES.includes('references/' + topic + '.md'))
    const src = readAssessmentRunbook(topic)
    const pentest = readPentestRunbook(topic)
    assert.equal(src.content, pentest.content, 'the common topic has one installed source')
    assert(src.content.length > 500)
    assert.equal(src.requests_sent, 0)
    assert.equal(pentest.requests_sent, 0)
  }
  for (const invalid of ['../../settings', 'references/../../settings', '__proto__']) {
    assert.throws(() => readAssessmentRunbook(invalid), /resource must/)
    assert.throws(() => readPentestRunbook(invalid), /resource must/)
  }
  const index = readAssessmentRunbook('index', { mode: 'redteam', tools: currentTools, capabilities: runtime })
  assert.equal(index.mode, 'src', 'caller options cannot change the fixed mode')
  assert(index.items.every(item => item.next?.tool === 'redteam_src_runbook'))
  assert(index.content.includes('authorization'))
})

test('package-only synchronization delivers topical files idempotently and preserves unrelated user skills', t => {
  const root = fixture(t)
  const user = path.join(root, 'skills', 'user-owned', 'SKILL.md')
  fs.mkdirSync(path.dirname(user), { recursive: true })
  fs.writeFileSync(user, 'user-owned fixture text', 'utf8')
  const first = installAssessmentSkills(root)
  assert.equal(first.action, 'updated')
  for (const managed of first.roots) for (const topic of ASSESSMENT_TOPICS) {
    const file = path.join(managed, 'src-discovery', 'references', topic + '.md')
    assert.equal(fs.readFileSync(file, 'utf8'), readAssessmentRunbook(topic).content)
  }
  assert.equal(installAssessmentSkills(root).action, 'kept')
  assert.equal(fs.readFileSync(user, 'utf8'), 'user-owned fixture text')
})

test('roles and facade guidance consume one shared model evidence contract without granting proof', () => {
  for (const prompt of Object.values(DEFAULT_PROMPTS)) assert.equal(prompt.split(MODEL_EVIDENCE_GUIDANCE).length, 2)
  assert(Object.isFrozen(MODEL_EVIDENCE_CONTRACT))
  assert(Object.isFrozen(MODEL_EVIDENCE_CONTRACT.model_confidence))
  const guided = withAssessmentGuidance({ ok: true, data: {} }, 'fixture',
    { model: 'v2', campaign_id: 'CAM-abc' }, 'run.inspect')
  assert.deepEqual(guided.evidence_contract.model_confidence, ['claimed', 'inferred'])
  assert.equal(guided.evidence_contract.ordinary_tool_direct_evidence, false)
  assert.equal(guided.evidence_contract.confirmation, 'current_exact_native_proof')
  assert.equal(guided.next_step.offline_only, true)
})
