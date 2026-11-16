/** Bootstrap output budget based on completed host steps, independent of language. */
export const name = 'dsh-purge-redteam-anchor'

export function decidePromotion(state, config) {
  if (config.anchorGate !== false) return state.steps >= config.maxBootstrapSteps
  return state.toolCalled || config.promoteAfterFirstResponse === true && state.responded && state.turnEnded
}

function positiveInteger(value, fallback) {
  const number = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value
  return Number.isSafeInteger(number) && number > 0 ? number : fallback
}

const promotionBySession = new WeakMap()
function stateFor(session) {
  let state = promotionBySession.get(session)
  if (!state) {
    state = { next: 0, lastEvent: null, seen: new WeakSet(), seenIds: new Set(),
      steps: 0, promoted: false, toolCalled: false, responded: false, turnEnded: false }
    promotionBySession.set(session, state)
  }
  return state
}

function reset(state) {
  state.steps = 0; state.promoted = false; state.toolCalled = false
  state.responded = false; state.turnEnded = false
}

function scanEvents(state, session) {
  const events = Array.isArray(session?.events) ? session.events
    : typeof session?.snapshotEvents === 'function' ? session.snapshotEvents() : []
  if (state.next > events.length || state.next && events[state.next - 1] !== state.lastEvent) state.next = 0
  for (; state.next < events.length; state.next++) {
    const event = events[state.next]
    if (!event || typeof event !== 'object') continue
    state.lastEvent = event
    const id = event.id ?? event.event_id
    const key = id == null ? null : event.type + ':' + id
    if (state.seen.has(event) || key && state.seenIds.has(key)) continue
    state.seen.add(event)
    if (key) state.seenIds.add(key)
    if (event.type === 'compaction/end') reset(state)
    else if (event.type === 'tool/call') state.toolCalled = true
    else if (event.type === 'step/end') state.steps++
    else if (event.type === 'turn/end') state.turnEnded = true
    else if (event.type === 'assistant/message') state.responded = true
  }
}

export function apply(ctx, config = {}) {
  const policy = { anchorGate: config.anchorGate !== false,
    maxBootstrapSteps: positiveInteger(config.maxBootstrapSteps, 2),
    bootstrapMaxTokens: positiveInteger(config.bootstrapMaxTokens, 8192),
    promoteAfterFirstResponse: config.promoteAfterFirstResponse !== false }
  const on = (...args) => {
    const release = ctx.on(...args)
    if (typeof release === 'function' && typeof ctx.effect === 'function') ctx.effect(() => release)
  }
  on('session/event', (session, event) => {
    if (event?.type !== 'compaction/end' || !session) return
    const state = stateFor(session)
    reset(state)
    state.seen.add(event)
    const id = event.id ?? event.event_id
    if (id != null) state.seenIds.add(event.type + ':' + id)
  })
  on('agent/request', async (payload, next) => {
    const resolved = await next()
    const session = payload?.agent?.session
    if (!session || !resolved || typeof resolved !== 'object') return resolved
    const state = stateFor(session)
    scanEvents(state, session)
    if (!state.promoted && decidePromotion(state, policy)) state.promoted = true
    if (state.promoted) return resolved
    const nativeLimit = resolved.maxTokens
    return { ...resolved, maxTokens: typeof nativeLimit === 'number' && Number.isFinite(nativeLimit) && nativeLimit > 0
      ? Math.min(nativeLimit, policy.bootstrapMaxTokens) : policy.bootstrapMaxTokens }
  }, { prepend: true })
}
