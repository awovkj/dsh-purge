/** One serialized lifecycle for package-owned preset declarations. */
import { registerPresetDefinitions, profileOwnsPreset } from './preset-compat.js'

const registryOf = ctx => {
  try { if (typeof ctx.agentPresets?.register === 'function') return ctx.agentPresets } catch { /* service pending */ }
  try { const registry = ctx.get?.('agentPresets'); if (typeof registry?.register === 'function') return registry } catch { /* pending */ }
  return null
}

export function installPresetRegistration(ctx, { ids, prepare, status, prefix = 'dsh-purge-presets', retryLimit = 40, retryDelay = 1000 }) {
  let stopped = false, running = false, requested = false, timer, registry = null, epoch = 0, mountedEpoch = -1, registryAttempts = 0
  let serviceScoped = false, desiredRegistry = null, serviceTicket = null
  const declarations = new Map(), complete = new Set(), failures = new Map()
  const cancelTimer = () => { if (timer) clearTimeout(timer); timer = undefined }
  const releaseAll = async () => {
    const errors = []
    for (const [id, release] of [...declarations].reverse()) {
      try { await release(); if (declarations.get(id) === release) declarations.delete(id) }
      catch (error) { errors.push(error); ctx.logger?.warn?.('%s: %s', prefix, error?.message || String(error)) }
    }
    return errors
  }
  const report = (id, patch, generation = epoch) => { if (!stopped && epoch === generation) status(id, patch) }
  const schedule = () => {
    if (stopped || timer) return
    timer = setTimeout(() => { timer = undefined; void attempt() }, retryDelay)
    timer.unref?.()
  }
  const changeService = next => {
    desiredRegistry = next; epoch++; registryAttempts = 0
    complete.clear(); failures.clear(); cancelTimer()
    void attempt()
  }
  const attempt = async () => {
    if (stopped) return
    if (running) { requested = true; return }
    running = true; cancelTimer()
    try {
      const generation = epoch
      const next = serviceScoped ? desiredRegistry : registryOf(ctx)
      if (registry !== next || mountedEpoch !== generation) {
        const errors = await releaseAll()
        if (stopped || epoch !== generation) { requested = true; return }
        if (errors.length) {
          for (const id of ids) report(id, { ok: false, phase: 'registry-cleanup-failed',
            error_code: 'PRESET_CLEANUP_FAILED', error: errors.map(error => error.message || String(error)).join(';'), retry_pending: false })
          return
        }
        registry = next; mountedEpoch = generation; complete.clear(); failures.clear()
      }
      if (!next) {
        for (const id of ids) report(id, { ok: false, phase: registryAttempts < retryLimit ? 'waiting-registry' : 'timeout-waiting-registry' })
        if (registryAttempts++ < retryLimit) schedule()
        return
      }
      if (stopped) return
      const active = registry
      let retry = false
      for (const id of ids) {
        if (stopped || generation !== epoch) return
        if (complete.has(id) || (failures.get(id) || 0) >= retryLimit) continue
        const stage = patch => report(id, patch, generation)
        try {
          stage({ ok: false, phase: 'starting', error: null, error_code: null, broken: null })
          if (profileOwnsPreset(ctx, id)) {
            const state = typeof active.resolve === 'function' ? await active.resolve(id) : null
            if (state?.broken) throw Object.assign(Error(`${id}: ${state.broken}`), { code: 'PRESET_ACTIVATION_FAILED', broken: state.broken })
            if (!state) throw Object.assign(Error(`${id}: profile-owned registry health cannot be confirmed`),
              { code: 'PRESET_REGISTRATION_UNCONFIRMED' })
            if (stopped || generation !== epoch) return
            stage({ ok: true, phase: 'profile-owned', id })
            complete.add(id); continue
          }
          const prepared = await prepare(id, stage)
          if (stopped || generation !== epoch) return
          stage({ ok: false, phase: 'registering', id, name: prepared.definition.name, plugins: prepared.definition.plugins.length })
          const release = await registerPresetDefinitions(active, prepared.definitions)
          if (stopped || generation !== epoch) {
            try { await release() } catch (error) {
              declarations.set(id, release)
              ctx.logger?.warn?.('%s: late declaration cleanup failed: %s', prefix, error.message || String(error))
            }
            if (stopped) await releaseAll()
            return
          }
          declarations.set(id, release)
          complete.add(id)
          stage({ ok: true, phase: 'registered', error: null, error_code: null, broken: null,
            id, name: prepared.definition.name, plugins: prepared.definition.plugins.length, attempts: failures.get(id) || 0 })
          ctx.logger?.info?.('%s: 已注册预设 %s', prefix, id)
        } catch (error) {
          if (typeof error.cleanup === 'function') declarations.set(id, error.cleanup)
          if (stopped || generation !== epoch) { if (stopped) await releaseAll(); return }
          const attempts = (failures.get(id) || 0) + 1; failures.set(id, attempts)
          const terminal = error?.cleanup_errors?.length > 0 || error?.code === 'PRESET_DISPOSER_REQUIRED'
            || error?.name === 'CompositionError' || /configuration retained|already|duplicate|invalid configuration/i.test(error?.message || '')
          stage({ ok: false, phase: 'register-failed', error: error?.message || String(error),
            error_code: error?.code || null, broken: error?.broken || null, attempts,
            retry_pending: !terminal && attempts < retryLimit,
            cleanup_errors: error?.cleanup_errors?.map(value => String(value.message || value).slice(0, 4096)) || null,
            cause: error?.cause ? { code: error.cause.code || null, message: String(error.cause.message || error.cause).slice(0, 4096) } : null })
          ctx.logger?.warn?.('%s: 注册 %s 失败：%s', prefix, id, error?.message || String(error))
          if (terminal) complete.add(id)
          else if (attempts < retryLimit) retry = true
        }
      }
      if (retry) schedule()
    } finally {
      running = false
      if (requested && !stopped) { requested = false; queueMicrotask(() => { void attempt() }) }
    }
  }
  ctx.effect(() => async () => {
    stopped = true; epoch++; cancelTimer()
    await releaseAll()
  }, prefix + '.registration')
  if (typeof ctx.inject === 'function') ctx.inject(['agentPresets'], scope => {
    const ticket = {}; serviceTicket = ticket; serviceScoped = true
    changeService(registryOf(scope))
    scope.effect(() => () => {
      if (stopped || serviceTicket !== ticket) return
      serviceTicket = null; changeService(null)
    })
  })
  void attempt()
  return { retry: attempt }
}
