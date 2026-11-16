/** Local runtime visibility. File discovery is reported separately from a probe. */
import { accessSync, constants, existsSync, readFileSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, isAbsolute, join } from 'node:path'
import { runtimeRequirements } from './runtime-requirements.js'

function executablePath(executable, env) {
  const direct = isAbsolute(executable) || /[/\\]/.test(executable)
  const candidates = direct ? [executable] : String(env.PATH || env.Path || '').split(process.platform === 'win32' ? ';' : ':')
    .filter(Boolean).flatMap(dir => [join(dir, executable), ...(process.platform === 'win32' && !/\.exe$/i.test(executable)
      ? [join(dir, executable + '.exe')] : [])])
  for (const candidate of candidates) {
    try {
      if (!statSync(candidate).isFile()) continue
      accessSync(candidate, process.platform === 'win32' ? constants.F_OK : constants.X_OK)
      return candidate
    } catch { /* This is visibility only, not proof that an interpreter can start. */ }
  }
  return null
}

function presetRegistration(home, preset = 'src') {
  const file = join(home, 'dsh-purge-community', 'preset-declare.json')
  try {
    const row = JSON.parse(readFileSync(file, 'utf8'))[preset]
    if (!row || typeof row !== 'object' || Array.isArray(row)) return { state: 'unknown', phase: null }
    // A persisted registration receipt is not proof that the current GUI has
    // reloaded its preset. Preserve the receipt's own time and source.
    return { state: row.ok === true ? 'registered_receipt' : row.ok === false ? 'pending_or_failed' : 'unknown',
      phase: typeof row.phase === 'string' ? row.phase.slice(0, 96) : null,
      error: typeof row.error === 'string' ? preset + ' preset registration failed; inspect the local registration receipt.' : null,
      at: typeof row.at === 'string' ? row.at : null, source: 'registration_receipt', path: file }
  } catch (error) { return { state: error.code === 'ENOENT' ? 'not_recorded' : 'unreadable', phase: null, path: file } }
}

export function assessmentReadiness(config, engine, { context, env = process.env, probe } = {}) {
  const home = env.DSH_HOME || join(homedir(), '.dsh')
  const pythonPath = config.executionBackend === 'native' ? executablePath(config.pythonExecutable, env) : null
  const configuredBrowserRoot = typeof env.PURGE_PLAYWRIGHT_ROOT === 'string' ? env.PURGE_PLAYWRIGHT_ROOT.trim() : ''
  const browserRoots = configuredBrowserRoot ? [configuredBrowserRoot]
    : [...new Set([join(home, 'mcp', 'playwright'), join(homedir(), '.dsh', 'mcp', 'playwright')])]
  let candidate = null, modulePath = null
  if (config.executionBackend === 'native') for (const root of browserRoots) {
    const modules = [...(['playwright', 'playwright-core'].includes(basename(root)) ? [root] : []),
      ...['playwright-core', 'playwright'].map(name => join(root, 'node_modules', name))]
    const found = modules.find(module => { try { return statSync(join(module, 'package.json')).isFile() } catch { return false } })
    if (found) { candidate = root; modulePath = found; break }
  }
  const defaultCache = process.platform === 'win32' ? join(env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local'), 'ms-playwright')
    : process.platform === 'darwin' ? join(homedir(), 'Library', 'Caches', 'ms-playwright') : join(homedir(), '.cache', 'ms-playwright')
  const cacheRoots = env.PLAYWRIGHT_BROWSERS_PATH === '0' ? []
    : [env.PLAYWRIGHT_BROWSERS_PATH || defaultCache].filter(value => typeof value === 'string' && isAbsolute(value))
  const cache = config.executionBackend === 'native' ? cacheRoots.find(root => existsSync(root)) || null : null
  const python = probe?.python || { executable: config.executionBackend === 'wsl' ? config.wslPythonExecutable : config.pythonExecutable,
    path: pythonPath, version: null, state: config.executionBackend === 'wsl' ? 'not_checked'
      : pythonPath ? 'located' : 'not_found', verified: false,
    note: 'File visibility only; interpreter version and startup require an explicit local runtime probe.' }
  const browser = probe?.browser || { available: null, state: config.executionBackend === 'wsl' ? 'not_checked'
    : candidate ? 'module_located' : cache ? 'cache_located' : 'not_found', module_root: candidate, module_path: modulePath, cache_root: cache,
    module_search_roots: config.executionBackend === 'native' ? browserRoots : [],
    cache_search_roots: config.executionBackend === 'native' ? cacheRoots : [], verified: false,
    reason: candidate ? 'browser_probe_required' : 'playwright_not_found',
    note: 'A package or browser cache alone does not prove Chromium can launch. Independent host MCP availability is separate.' }
  const requirements = runtimeRequirements()
  return { engine, node: requirements.assessment, requirements,
    components: { purge: { state: requirements.purge.supported ? 'supported_runtime' : 'unsupported_runtime' },
      redteam_tools: { state: requirements.redteam.supported ? 'supported_runtime' : 'unsupported_runtime', minimum_node: '22.5.0' },
      assessment: { state: requirements.assessment.supported ? 'runtime_prerequisites_visible' : 'unsupported_runtime', minimum_node: '22.19.0', verified: false },
      browser: { state: browser.state, verified: browser.verified === true } },
    execution_backend: config.executionBackend, python, browser,
    src_preset: presetRegistration(home), pentest_preset: presetRegistration(home, 'pentest'),
    src_skill: { name: 'src-discovery', installed: existsSync(join(home, 'redteam', 'src-skills', 'src-discovery', 'SKILL.md')),
      source: 'package_owned', root: join(home, 'redteam', 'src-skills') },
    context_ready: context?.ready === true, checked_at: probe?.checked_at || null,
    target_traffic_sent: false, requests_sent: 0 }
}
