/** Host guidance derived from engine contracts; it never grants execution or proof. */
import { createHash } from 'node:crypto'
import { compactContinuation } from './assessment-engine/src/bridge.mjs'
import { assessmentWorkflow } from './assessment-workflow.js'
import { MODEL_EVIDENCE_CONTRACT } from './role-prompts.js'

const COUNTS = ['ready_total', 'review_total', 'blocked_total', 'actionable_total', 'unresolved_total']
const V1_NEXT = new Set(['plan.next', 'plan.audit', 'plan.checkpoint', 'plan.finalize', 'surface.list', 'report.build'])
const ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,199}$/
const count = value => Number.isSafeInteger(value) && value >= 0
const object = value => value && typeof value === 'object' && !Array.isArray(value)
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')

/** Reject incomplete or contradictory stop controls instead of guessing exhaustion. */
export function assessmentContinuationOf(result) {
  const value = result?.ok === true ? result.data?.continuation : null
  if (!object(value) || value.contract_version !== 2 || value.stop_policy_version !== 1
    || value.stop_policy !== 'exhaustion_only' || typeof value.continue_required !== 'boolean'
    || COUNTS.some(key => !count(value[key]))
    || value.actionable_total !== value.ready_total + value.review_total
    || value.unresolved_total !== value.actionable_total + value.blocked_total
    || !ID.test(value.snapshot_id || '') || !count(value.frontier_rounds)
    || typeof value.can_finalize !== 'boolean' || typeof value.can_claim_complete !== 'boolean'
    || typeof value.automatic_stop_allowed !== 'boolean' || typeof value.frontier_review_required !== 'boolean') return null
  const complete = value.continue_required === false && value.automatic_stop_allowed === true
    && value.can_finalize === true && value.can_claim_complete === true && value.state === 'finalized'
    && value.coverage_status === 'complete' && value.frontier_review_required === false
    && value.frontier_rounds >= 2 && ID.test(value.finalization_id || '') && COUNTS.every(key => value[key] === 0)
  if (value.continue_required === false && !complete
    || value.continue_required === true && (value.automatic_stop_allowed || value.can_claim_complete)) return null
  return { model: 'v1', required: value.continue_required, complete,
    kind: complete ? 'completed' : value.actionable_total ? 'work' : value.blocked_total ? 'blocked' : 'frontier',
    key: hash([value.semantic_progress_id || value.progress_id || value.snapshot_id,
      value.frontier_rounds, value.frontier_review_required, value.coverage_status, value.can_finalize, value.finalization_id]),
    continuation: compactContinuation(value),
    next_action: V1_NEXT.has(value.next_action) ? value.next_action : 'plan.audit' }
}

/** v2 exposes Campaign delivery/coverage rather than a v1 continuation block. */
export function campaignProgressOf(result, campaignId) {
  const data = result?.ok === true ? result.data : null
  if (!object(data) || !object(data.campaign) || data.campaign.id !== campaignId
    || !/^CAM-[a-f0-9]+$/.test(campaignId || '') || data.campaign.model !== 'v2'
    || !['active', 'paused', 'delivered_partial', 'completed', 'abandoned'].includes(data.campaign.state)
    || !object(data.delivery) || data.delivery.computed_by !== 'engine'
    || typeof data.delivery.exhausted_authority !== 'boolean' || !Array.isArray(data.delivery.remaining)
    || data.delivery.remaining.length > 32
    || data.delivery.remaining.some(row => !object(row) || !count(row.count) || !ID.test(row.kind || ''))
    || !object(data.dimensions) || !object(data.finding_summary)
    || ['open_hypothesis_count', 'open_gap_count', 'unplanned_family_count', 'unregistered_route_count']
      .some(key => !count(data[key]))) return null
  const complete = data.campaign.state === 'completed' && data.campaign.delivery?.reason === 'completed'
    && data.campaign.delivery.exhausted_authority === true && data.delivery.exhausted_authority === true
    && data.delivery.remaining.length === 0 && data.open_hypothesis_count === 0 && data.open_gap_count === 0
    && data.unplanned_family_count === 0 && data.unregistered_route_count === 0
  const active = data.campaign.state === 'active' && data.campaign.user_stop !== true
  const outcomes = data.dimensions.hypothesis?.dependency?.outcomes || {}
  const blockedOnly = active && data.open_hypothesis_count > 0
    && count(outcomes.blocked) && outcomes.blocked === data.open_hypothesis_count
    && data.unplanned_family_count === 0 && data.unregistered_route_count === 0
  const progress = { campaign_id: campaignId, state: data.campaign.state, complete,
    exhausted_authority: complete, can_finalize: active && data.delivery.exhausted_authority === true,
    remaining: data.delivery.remaining.map(row => ({ kind: row.kind, count: row.count })),
    open_hypotheses: data.open_hypothesis_count, open_gaps: data.open_gap_count,
    unplanned_families: data.unplanned_family_count, unregistered_routes: data.unregistered_route_count,
    universe_snapshot: data.universe?.snapshot_hash || null, registered_scope_only: true }
  // Round/cursor/version changes are administrative activity, not security progress.
  const key = hash([progress, data.dimensions, data.finding_summary])
  return { model: 'v2', required: active && !complete, complete, kind: complete ? 'completed' : blockedOnly ? 'blocked' : active ? 'work' : 'inactive',
    key, progress, next_action: progress.can_finalize ? 'campaign.checkpoint' : 'campaign.next' }
}

export function assessmentNextStep(progress, engagement, { offlineOnly = false } = {}) {
  if (!progress || progress.complete || !progress.required) return null
  const action = offlineOnly ? progress.model === 'v2' ? 'campaign.next' : 'plan.audit' : progress.next_action
  const input = progress.model === 'v2' && action.startsWith('campaign.')
    ? { campaign_id: progress.progress.campaign_id, ...(action === 'campaign.next' ? { limit: 3 } : {}) }
    : ['plan.next', 'plan.audit', 'surface.list', 'review.evidence'].includes(action) ? { offset: 0, limit: 3 } : {}
  return { tool: 'redteam_assessment_run', arguments: { engagement, action, input },
    offline_only: offlineOnly, authorization: 'existing_scope_and_prerequisites_only',
    note: offlineOnly && progress.model === 'v2'
      ? 'campaign.next 只在本地准备配方并推进游标；本提示不安排 test.run 或新的目标请求。缺失前提先离线整理。'
      : '先处理当前未复核材料与前提；队列读取、checkpoint 和文字说明不构成证据闭环。' }
}

/** Preserve the engine envelope and expose a bounded, actionable facade hint. */
function currentAssessmentGuidance(result, engagement, context, action) {
  if (result?.ok !== true) return result
  const progress = assessmentContinuationOf(result)
    || (context?.model === 'v2' ? campaignProgressOf(result, context.campaign_id) : null)
  if (progress) return { ...result, next_step: assessmentNextStep(progress, engagement),
    assessment_progress: progress.model === 'v2' ? progress.progress : {
      model: 'v1', required: progress.required, complete: progress.complete, registered_scope_only: true },
    workflow_note: progress.required ? '当前评估仍未完成；按 next_step 继续处理获准工作，尊重取消与 SRC 停止。'
      : '当前引擎结项只覆盖已登记范围；报告不得推断未知攻击面已耗尽。' }
  if (context?.model === 'v2' && action !== 'action.help' && action !== 'runtime.probe') {
    return { ...result, next_step: { tool: 'redteam_assessment_run', arguments: {
      engagement, action: 'campaign.status', input: { campaign_id: context.campaign_id } }, offline_only: true },
    workflow_note: '先读取当前 Campaign 的真实覆盖与剩余项；配方、测试或报告返回不等于完成。' }
  }
  return result
}

export function withAssessmentGuidance(result, engagement, context, action, input = {}) {
  const guided = currentAssessmentGuidance(result, engagement, context, action)
  const workflow = assessmentWorkflow(result, engagement, context, action, input)
  if (workflow) return { ...guided, ...workflow, evidence_contract: MODEL_EVIDENCE_CONTRACT }
  return guided?.next_step ? { ...guided, evidence_contract: MODEL_EVIDENCE_CONTRACT } : guided
}
