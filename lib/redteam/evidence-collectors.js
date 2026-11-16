/** Host execution receipts record actual returned values, with no privilege oracle. */
import { createHash, randomUUID } from 'node:crypto'
import { EvidenceLedger } from './evidence-ledger.mjs'
import { sessionPolicyOf } from './session-policy.js'
import { redteamPrivateValues, redactKnownValues } from './report-text.js'

export function installEvidenceCollectors(ctx, store) {
  const install = scope => {
    const release = scope.on('tools/execute', async (execution, next) => {
      const result = await next()
      if (result?.isError !== false || execution.signal?.aborted || execution.name.startsWith('redteam_')
        || ['skill', 'todo_write', 'present', 'subagent_control', 'list_agents'].includes(execution.name)) return result
      try {
        const policy = sessionPolicyOf(store, execution)
        if (policy?.assessment_mode !== 'redteam' || !policy.engagement_id) return result
        const db = store.db(policy.engagement_id)
        const serialized = JSON.stringify(result.value)
        if (typeof serialized !== 'string') return result
        const hash = createHash('sha256').update(serialized).digest('hex')
        const text = redactKnownValues(serialized, redteamPrivateValues(db))
        const receipt = new EvidenceLedger(db).recordObserved({ operation: 'tool_execution:' + execution.name,
          parameters: { tool: execution.name, session_id: execution.agent?.session?.id },
          result: { observation: text.slice(0, 32768), complete: Buffer.byteLength(text) <= 32768,
            direct_evidence: false, proof_type: 'tool_output', output_sha256: hash,
            proof_scope: 'actual_tool_return_value' }, authority: 'tool-output',
          limitations: ['A tool return value does not independently certify vulnerabilities or privilege outcomes.'],
          recorded_by: 'host-tool-collector', engagement_id: policy.engagement_id },
          { collector: 'host-tool-dispatch', invocation_id: randomUUID(), material_sha256: [hash] })
        if (!receipt.ok) return result
        return { ...result, content: [...(result.content || []), { type: 'text', text:
          `工具观察证据：${receipt.ev_id}。证明范围为实际工具返回值；漏洞确认及权限成果仍需对应的可信判据。` }] }
      } catch {
        // Collection cannot turn successful execution into a false task
        // failure, or certify evidence when its private context is unavailable.
        scope.logger?.warn?.('redteam execution completed, but no trusted observation receipt could be persisted')
        return result
      }
    }, { global: true })
    if (typeof release === 'function') scope.effect(() => release)
  }
  if (typeof ctx.inject === 'function') ctx.inject(['tools'], install)
  else if (ctx.tools) install(ctx)
}
