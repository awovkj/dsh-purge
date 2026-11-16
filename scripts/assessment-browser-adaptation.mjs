/** Reviewed local browser adaptation, regenerated during explicit source imports. */
export function adaptAssessmentBrowser(source) {
  let text = source.toString('utf8').replaceAll('\r\n', '\n');
  const adaptations = [];
  const replace = (original, adapted, explanation) => {
    if (text.split(original).length !== 2) throw new Error('Upstream awa_ddd/browser.py changed; review the browser adaptation before synchronizing');
    text = text.replace(original, adapted);
    adaptations.push(explanation);
  };
  replace('import json\nimport hashlib\n', 'import json\nimport hashlib\nimport os\n',
    'Reads operator browser environment without model-controlled runtime fields; browser source uses UTF-8 LF.');
  replace(`# Candidate locations for a Node + playwright-core installation. Checked in order;
# the first one whose chromium can actually launch wins.
_BROWSER_ROOTS = (
    Path.home() / ".dsh" / "mcp" / "playwright",
    Path.home() / ".cache" / "ms-playwright",
)
`, `# Operator configuration selects an existing Playwright installation only.
# Browser caches never stand in for the Node module; nothing is installed here.
def _browser_roots():
    configured = os.environ.get("PURGE_PLAYWRIGHT_ROOT", "").strip()
    if configured:
        return (Path(configured).expanduser(),)
    home = Path(os.environ.get("DSH_HOME") or Path.home() / ".dsh").expanduser()
    return tuple(dict.fromkeys((home / "mcp" / "playwright",
                               Path.home() / ".dsh" / "mcp" / "playwright")))
`, 'Uses explicit PURGE_PLAYWRIGHT_ROOT or the actual DSH_HOME and legacy module location, without installation or cache-as-module fallback.');
  replace(`def _playwright_module():
    """Return the directory containing node_modules/playwright-core, if any."""
    for root in _BROWSER_ROOTS:
        candidate = root / "node_modules" / "playwright-core"
        if candidate.is_dir():
            return root
        if root.name == "ms-playwright" and root.is_dir():
            # Browsers installed without a local playwright package; the caller may
            # still have one elsewhere, so report the browser cache and let the probe decide.
            return root
    return None
`, `def _playwright_module():
    """Return an installation root and its actual playwright(-core) package."""
    for root in _browser_roots():
        candidates = [root] if root.name in {"playwright", "playwright-core"} else []
        candidates += [root / "node_modules" / name for name in ("playwright-core", "playwright")]
        for candidate in candidates:
            if candidate.is_dir() and (candidate / "package.json").is_file():
                return root, candidate
    return None
`, 'Supports existing playwright and playwright-core project roots or direct package directories.');
  replace(`    module_root = _playwright_module()
    if module_root is None:
        return {"available": False, "reason": "playwright_not_found",
                "detail": "No playwright-core installation was found under ~/.dsh/mcp/playwright.",
                "node": node}
    return {"available": True, "node": node, "module_root": str(module_root)}
`, `    module = _playwright_module()
    if module is None:
        return {"available": False, "reason": "playwright_not_found",
                "detail": "No existing playwright(-core) module was found. Select its installation "
                          "with operator environment PURGE_PLAYWRIGHT_ROOT or use DSH_HOME/mcp/playwright. "
                          "A Chromium cache alone is not a Playwright module.",
                "node": node}
    return {"available": True, "node": node, "module_root": str(module[0]),
            "module_path": str(module[1])}
`, 'Reports the actual selected module separately from Chromium launch readiness.');
  replace('const path = process.argv[2];', 'const modulePath = process.argv[2];',
    'Probe receives an actual package path instead of assuming playwright-core under a fixed project root.');
  replace("try { ({ chromium } = require(path + '/node_modules/playwright-core')); }",
    'try { ({ chromium } = require(modulePath)); }', 'Probe loads the selected existing Playwright package.');
  replace("const os = require('os');", "const os = require('os');\nconst path = require('path');",
    'Uses native path joins for browser cache discovery.');
  replace(`  const cache = process.env.PLAYWRIGHT_BROWSERS_PATH || (os.homedir() + '/AppData/Local/ms-playwright');
  try {
    for (const entry of fs.readdirSync(cache)) {`, `  const configuredCache = process.env.PLAYWRIGHT_BROWSERS_PATH;
  const cache = configuredCache && configuredCache !== '0' ? configuredCache
    : process.platform === 'win32' ? path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'ms-playwright')
    : process.platform === 'darwin' ? path.join(os.homedir(), 'Library', 'Caches', 'ms-playwright')
    : path.join(os.homedir(), '.cache', 'ms-playwright');
  try {
    for (const entry of configuredCache === '0' ? [] : fs.readdirSync(cache)) {`,
    'Honors PLAYWRIGHT_BROWSERS_PATH and native Windows/macOS/Linux caches; package-local mode does not fall back to a global cache.');
  replace("      for (const rel of ['chrome-win64/chrome.exe', 'chrome-win/chrome.exe', 'chrome-linux/chrome']) {",
    `      for (const rel of ['chrome-win64/chrome.exe', 'chrome-win/chrome.exe', 'chrome-linux/chrome',
          'chrome-linux64/chrome', 'chrome-mac/Chromium.app/Contents/MacOS/Chromium',
          'chrome-mac-arm64/Chromium.app/Contents/MacOS/Chromium', 'chrome-mac-x64/Chromium.app/Contents/MacOS/Chromium']) {`,
    'Finds existing Chromium layouts on all supported desktop platforms without downloading a browser.');
  replace('            process = subprocess.run([state["node"], str(script), state["module_root"]],',
    '            process = subprocess.run([state["node"], str(script), state["module_path"]],',
    'Passes the selected module path to the isolated local probe.');
  replace('const [moduleRoot, specPath] = process.argv.slice(2);', 'const [modulePath, specPath] = process.argv.slice(2);',
    'Browser visits receive the selected module path.');
  replace("    const { chromium } = require(moduleRoot + '/node_modules/playwright-core');",
    '    const { chromium } = require(modulePath);', 'Browser visits load the same existing package as the probe; scope and write guards stay intact.');
  replace('            process = subprocess.run([state["node"], str(script_path), state["module_root"], str(spec_path)],',
    '            process = subprocess.run([state["node"], str(script_path), state["module_path"], str(spec_path)],',
    'Passes the chosen package path to the owned browser subprocess.');
  replace('def _browser_identity(project, args, url):\n    from .engine import session_valid',
    'def _browser_identity(project, args, url):\n    from .engine import session_valid, require_session_origin',
    'Uses the same creation-time credential origin policy as HTTP and scenario execution.');
  replace('    if session:\n        evidence = project.get("evidence", session["verification_evidence_id"])',
    '    if session:\n        require_session_origin(project, session, url)\n        evidence = project.get("evidence", session["verification_evidence_id"])',
    'Retains native credential destination constraints before applying browser headers.');
  return { bytes: Buffer.from(text, 'utf8'), adaptations };
}
