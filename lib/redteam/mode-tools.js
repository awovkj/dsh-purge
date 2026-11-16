/** Explicit tool and store-operation contracts. New names require a policy decision. */
export const PRESENTATION_TOOL_NAMES = Object.freeze(['todo_write', 'present'])
const presentation = new Set(PRESENTATION_TOOL_NAMES)
export const isPresentationTool = name => presentation.has(name)

const commonTools = [
  'redteam_engagement_open', 'redteam_session_bind', 'redteam_session_info', 'redteam_preflight', 'redteam_agent_slot',
  'redteam_asset_add', 'redteam_asset_link', 'redteam_asset_query', 'redteam_asset_get', 'redteam_asset_stats', 'redteam_asset_graph',
  'redteam_role_prompt', 'redteam_roles', 'redteam_asset_test', 'redteam_asset_assess', 'redteam_asset_timeline',
  'redteam_vuln_add', 'redteam_vuln_query', 'redteam_vuln_update', 'redteam_shot_add', 'redteam_shot_list', 'redteam_shot_delete',
  'redteam_role_prompt_reset', 'redteam_web_list', 'redteam_domain_index', 'redteam_http_evidence_add', 'redteam_chain_add', 'redteam_chain',
  'redteam_report', 'redteam_evidence_record', 'redteam_evidence_verify', 'redteam_evidence_upgrade',
  'redteam_evidence_list', 'redteam_unverified_count', 'redteam_unknown_record', 'redteam_unknown_resolve', 'redteam_unknown_list',
  'redteam_delivery_report', 'redteam_assessment_status', 'redteam_assessment_start', 'redteam_assessment_run',
  'redteam_assessment_import', 'redteam_assessment_review', 'redteam_poc_search', 'redteam_poc_get', 'redteam_poc_list',
]
const credentialTools = ['redteam_credential_add', 'redteam_credential_list', 'redteam_credential_reveal']
const redteamTools = [
  'redteam_report_targets',
  ...credentialTools, 'redteam_access_add', 'redteam_access_list', 'redteam_sessions',
  'redteam_webshell_add', 'redteam_webshell_list', 'redteam_webshell_update', 'redteam_tunnel_add',
  'redteam_tunnel_list', 'redteam_tunnel_update', 'redteam_session_check', 'redteam_attack_path',
  'redteam_score_list', 'redteam_score_hit', 'redteam_score_point_save', 'redteam_attack_file_add',
  'redteam_attack_file_list', 'redteam_attack_chain', 'redteam_score_report',
  'redteam_poc_add', 'redteam_poc_update', 'redteam_poc_use',
]
const tools = {
  redteam: new Set([...commonTools, ...redteamTools]),
  src: new Set([...commonTools, 'redteam_src_report', 'redteam_src_runbook']),
  pentest: new Set([...commonTools, ...credentialTools, 'redteam_pentest_report', 'redteam_pentest_runbook']),
}
export const isModeAllowedTool = (mode, name) => tools[mode]?.has(name) === true
export const modeToolNames = mode => Object.freeze([...(tools[mode] || [])])

const commonOperations = [
  'assessmentPolicy', 'snapshot', 'assets', 'asset', 'graph', 'attackGraph', 'stats', 'vulns', 'addVuln', 'updateVuln',
  'vulnStats', 'shots', 'shotAdd', 'shotDelete', 'shotData', 'domains', 'web', 'httpEvidence', 'addHttpEvidence',
  'chain', 'addChainStep', 'report', 'assetTest', 'assessAsset', 'activeTests', 'testStats', 'consoleDigest',
  'stages', 'saveStage', 'discoveryTimeline', 'import', 'prompts', 'savePrompt', 'resetPrompts',
  'assessmentStatus', 'assessmentStart', 'assessmentRun', 'assessmentImport', 'assessmentReview', 'deliveryReport',
  'awaStatus', 'awaStart', 'awaCall', 'awaSync', 'awaReviews',
]
const credentialOperations = ['credentials', 'credentialReveal', 'addCredential']
const operations = {
  src: new Set([...commonOperations, 'srcFindings', 'srcStops', 'srcReport']),
  pentest: new Set([...commonOperations, ...credentialOperations, 'pentestReport']),
  redteam: new Set([...commonOperations, ...credentialOperations, 'reportTargets', 'access', 'addAccess', 'sessions', 'webshells',
    'addWebshell', 'updateWebshell', 'tunnels', 'addTunnel', 'updateTunnel', 'probeSessions', 'scores',
    'saveScorePoint', 'deleteScorePoint', 'addScoreHit', 'scoreChain', 'scoreReport', 'saveStage',
    'attackFiles', 'addAttackFile', 'readAttackFile']),
}
export const isModeAllowedOperation = (mode, operation) => operations[mode]?.has(operation) === true
  || isModeAllowedTool(mode, operation)

const mutationOperations = Object.freeze(['addCredential', 'addAccess', 'addWebshell', 'updateWebshell',
  'addTunnel', 'updateTunnel', 'probeSessions', 'addScoreHit', 'saveScorePoint', 'deleteScorePoint', 'addAttackFile'])
export const modeRestrictedOperations = mode => Object.freeze(mutationOperations.filter(operation => !isModeAllowedOperation(mode, operation)))

// These tools can manage a presentation or an inherited child session.
// Arbitrary code, file mutations, jobs, web fetch and other providers cannot
// enforce a declared target scope; bounded redteam uses the typed executor
// and its workspace.list/read helpers for local material. Do not advertise
// read_file/list_directory aliases that the host does not register.
const boundedRedteamTools = new Set([
  ...PRESENTATION_TOOL_NAMES, 'skill',
  'ask_user_question', 'goal', 'goal_set', 'goal_get', 'goal_update',
  'subagent', 'subagent_fork', 'subagent_control', 'list_agents', 'send_message', 'wait_agent', 'resume_agent', 'close_agent',
])
export const isBoundedRedteamTool = name => isModeAllowedTool('redteam', name) || boundedRedteamTools.has(name)
