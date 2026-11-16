/** Fixed local helpers share the existing mode-bound facade; none initializes an engine. */
import { requiresBoundAssessment } from './assessment-policy.js'
import { artifactError } from './assessment-artifacts.js'
import { workspaceActionHelp, workspaceActionCatalog, isWorkspaceAction,
  listAssessmentWorkspace, readAssessmentWorkspace } from './assessment-workspace.js'
import { isIntelAction, intelActionHelp, intelActionCatalog,
  importVulnerabilityIntel, searchVulnerabilityIntel, getVulnerabilityIntel } from './vulnerability-intel.js'
import { buildWorkflowAdvice } from './workflow-advisor.js'
import { skillCatalog } from './skill-catalog.js'

const HELP = {
  'workflow.advice': { fields: { limit: '1..20 per list, default 5' }, notes: [
    'Reads bounded existing findings, current exact proofs and SRC stops. No project initialization, dispatch or target request.',
    'Confirmed source labels without current proof remain pending. Suggestions do not widen scope, grant a provider or erase remaining coverage.' ] },
  'skill.index': { fields: { cwe: 'Optional CWE identifier array', classes: 'Optional literal skill class array',
    include_blocked: 'Boolean, default true', limit: '1..100, default 50' }, notes: [
    'Fixed installed skills and exact runbook resources. The current engagement fixes the mode and bounded-tool policy.',
    'Callers cannot supply tools, mode, capability readiness or another skill directory. Current scoped tool registration and saved native readiness are read internally without probing; missing receipts remain unknown.' ] },
}
export const isLocalAssessmentAction = action => Object.hasOwn(HELP, action) || isWorkspaceAction(action) || isIntelAction(action)
export function localAssessmentActionHelp(name) {
  if (HELP[name]) return { ok: true, data: { action: name, group: 'dsh_embedded_local',
    contract_version: 1, project_required: false, ...HELP[name] }, requests_sent: 0 }
  return workspaceActionHelp(name) || intelActionHelp(name)
}
export const localAssessmentActionCatalog = () => [
  ...Object.keys(HELP).map(name => localAssessmentActionHelp(name).data),
  ...workspaceActionCatalog(), ...intelActionCatalog(),
]

export function currentSkillOptions(store, id, options = {}) {
  const policy = store.assessmentPolicy(id)
  return { mode: policy.assessment_mode, bounded: requiresBoundAssessment(policy),
    tools: options.registeredTools, capabilities: options.skillRuntime }
}
function withRelatedSkills(result, options) {
  if (!result?.ok || !Array.isArray(result.data?.items)) return result
  const catalog = skillCatalog({ ...options, limit: 100 })
  return { ...result, data: { ...result.data, items: result.data.items.map(row => ({ ...row,
    related_skills: catalog.items.filter(item => row.cwes.some(cwe => item.tags.cwe.includes(cwe))).slice(0, 8),
    linkage: 'methodology_only_not_vulnerability_proof' })) } }
}
export function runLocalAssessmentAction(store, id, action, input = {}, options = {}) {
  options.signal?.throwIfAborted()
  if (action === 'workspace.list') return listAssessmentWorkspace(store, id, input)
  if (action === 'workspace.read') return readAssessmentWorkspace(store, id, input)
  if (action === 'workflow.advice') return buildWorkflowAdvice(store, id, input)
  const skillOptions = currentSkillOptions(store, id, options)
  if (action === 'skill.index') {
    if (!input || typeof input !== 'object' || Array.isArray(input)
      || Object.keys(input).some(key => !['cwe', 'classes', 'include_blocked', 'limit'].includes(key))
      || input.include_blocked !== undefined && typeof input.include_blocked !== 'boolean') {
      throw artifactError('ASSESSMENT_SKILL_INDEX_FIELDS', 'Use literal filters only; the current mode and runtime capabilities cannot be supplied')
    }
    return { ok: true, data: skillCatalog({ ...skillOptions, cwe: input.cwe, classes: input.classes,
      includeBlocked: input.include_blocked !== false, limit: input.limit }), requests_sent: 0 }
  }
  if (action === 'intel.import') return importVulnerabilityIntel(store, id, input)
  if (action === 'intel.search') return withRelatedSkills(searchVulnerabilityIntel(store, id, input), skillOptions)
  if (action === 'intel.get') return withRelatedSkills(getVulnerabilityIntel(store, id, input), skillOptions)
  throw artifactError('ASSESSMENT_LOCAL_ACTION', 'Unknown local assessment action')
}
