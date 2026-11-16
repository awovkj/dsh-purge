/** Concrete local next steps from real receipts; no guessed HTTP or oracle inputs. */
const id = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,199}$/.test(value)
const step = (engagement, action, input) => ({ tool: 'redteam_assessment_run',
  arguments: { engagement, action, input }, offline_only: true })
const preparationStep = (engagement, context) => context?.model === 'v2'
  ? id(context.campaign_id) ? step(engagement, 'campaign.next', { campaign_id: context.campaign_id, limit: 3 })
    : step(engagement, 'action.help', { name: 'campaign.start' })
  : step(engagement, 'plan.next', { offset: 0, limit: 3 })

export function assessmentWorkflow(result, engagement, context, action, input = {}) {
  if (result?.ok !== true) return null
  const data = result.data || {}
  if (action === 'tool.route' && Array.isArray(data.items)) {
    const advice = data.items.slice(0, 10).filter(row => typeof row.next?.action === 'string' && row.next?.input
      && typeof row.next.input === 'object' && !Array.isArray(row.next.input)).map(row => ({ ...row,
      next_step: { tool: 'redteam_assessment_run', arguments: { engagement, action: row.next.action, input: row.next.input },
        offline_only: row.offline_only === true, automatic_dispatch: false } }))
    return { workflow_phase: 'tool_selection', tool_advice: advice,
      ...(advice.length ? { next_step: advice[0].next_step } : {}),
      workflow_note: '按当前事实选工具，而非按工具名称猜能力；缺件先准备，已有证据先离线复核，不切换操作者固定的 native/WSL 后端。' }
  }
  if (['identity.session', 'identity.session_from_evidence'].includes(action)) {
    const session = data.session || data
    if (session.verified_at) return { workflow_phase: 'control_preparation', identity_prerequisite: {
      session_id: session.id, verified: true, generation: session.generation },
      next_step: preparationStep(engagement, context) }
    return { workflow_phase: 'authentication', identity_prerequisite: {
      session_id: id(session.id) ? session.id : null, verified: false,
      missing: ['actual_server_subject_and_role_verification'] },
    next_step: step(engagement, 'action.help', { name: 'identity.verify' }),
    workflow_note: '凭据或登录成功尚未证明主体。按实际自资料接口及真实主体/角色字段执行 identity.verify，再准备安全控制。' }
  }
  if (action === 'identity.verify' && data.session?.verified_at) return {
    workflow_phase: 'control_preparation', identity_prerequisite: { session_id: data.session.id,
      verified: true, generation: data.session.generation },
    next_step: preparationStep(engagement, context) }
  if (action === 'campaign.next') {
    const ready = (data.recipes || []).filter(row => id(row.recipe?.id) && !row.prerequisites?.length)
    const blocked = (data.preparation || []).slice(0, 20).map(row => ({ hypothesis_id: row.hypothesis_id,
      operation_id: row.operation_id,
      family: row.family, missing: row.missing || row.missing_context || [], provider_supported: row.provider_supported,
      reason: row.provider_supported === false ? 'dedicated_control_provider_not_implemented' : row.reason || row.state_reason }))
    const selectedOperation = ready[0]?.target?.operation_id || ready[0]?.hypothesis?.operation_id || blocked[0]?.operation_id
    return { workflow_phase: ready.length ? 'control_inspection' : 'blocked',
      prepared_tests: ready.slice(0, 3).map(row => ({ recipe_id: row.recipe.id,
        hypothesis_id: row.hypothesis?.id, operation_id: row.target?.operation_id,
        session_id: row.target?.session_id, controls: row.controls, target_requests_scheduled: false })),
      blocked_prerequisites: blocked,
      tool_selection: step(engagement, 'tool.route', { purpose: 'auto', limit: 5,
        ...(id(selectedOperation) ? { operation_id: selectedOperation } : {}) }),
      ...(ready.length ? { next_step: step(engagement, 'test.inspect', { recipe_id: ready[0].recipe.id }) } : {}),
      workflow_note: ready.length ? '本地配方已准备。检查冻结控制后，已有明确测试授权的任务可按 runbook 执行 test.run；本回执不安排目标请求。'
        : '按缺失前提处理。provider 未实现时保留受阻分母，增加身份或重复 campaign.next 不能补出该 provider。' }
  }
  if (['test.run', 'test.run_browser', 'test.run_scenario', 'test.run_external', 'assessment.evaluate'].includes(action)) {
    const outcome = data.outcome || data.run?.outcome
    if (['supported', 'confirmed'].includes(outcome) && input.oracle?.type !== 'baseline') return {
      workflow_phase: 'native_review', next_step: { tool: context?.import_ids?.length
        ? 'redteam_assessment_review' : 'redteam_assessment_import', arguments: { engagement,
          ...(context?.import_ids?.length ? { verify: true } : { offset: 0, limit: 50 }) }, offline_only: true },
      workflow_note: '按来源条目与当前 operation/input 关联，再复核真实机器证明；报告确认沿用证明范围与严重级别上限。' }
    return { workflow_phase: 'remaining_work', workflow_note: '保存实际控制结果及局限性，继续当前可执行义务；baseline、inconclusive 和报告均不消除未完成项。' }
  }
  return null
}
