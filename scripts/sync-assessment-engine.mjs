/** Maintainer-only source import. Production uses the checked-in internal engine. */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { assertNoLinkedDescendants, within } from '../lib/path-boundary.js';
import { atomicWriteFileSync } from '../lib/redteam/atomic-write.js';

const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCHEMA = 'dsh-purge-assessment-source/v1';
const IDENTITY = 'dsh-purge-assessment-engine';
const JS_FILES = ['src/actions.mjs', 'src/bridge.mjs', 'src/parse-js.mjs'];
const NATIVE_CONTEXT_PATH = 'awa_ddd/dsh_context.py';
const UPSTREAM_REQUIRED_FILES = ['awa_ddd/__init__.py', 'awa_ddd/__main__.py', 'awa_ddd/store.py',
  'awa_ddd/engine.py', 'awa_ddd/assessment.py', 'awa_ddd/assessment_mode.py',
  'awa_ddd/integration.py', 'awa_ddd/execution/test_runner.py', ...JS_FILES, 'LICENSE'];
const REQUIRED_FILES = [...UPSTREAM_REQUIRED_FILES, NATIVE_CONTEXT_PATH];
const sha256 = value => createHash('sha256').update(value).digest('hex');
const digestRecords = records => sha256(JSON.stringify(records));
const upstreamDigest = records => digestRecords(records.filter(file => file.origin !== 'dsh-purge')
  .map(({ path, upstream_sha256 }) => ({ path, sha256: upstream_sha256 })));
const toPosix = value => value.replaceAll(path.sep, '/');
const embeddedRootOf = root => path.join(path.resolve(root), 'lib', 'redteam', 'assessment-engine');

// This owner adapter is part of dsh-purge, not an upstream/public AWA action.
// Keep its reviewed source here so every explicit upstream import preserves it.
const NATIVE_CONTEXT_SOURCE = String.raw`"""Private owner configuration for the physically embedded dsh-purge engine."""
from __future__ import annotations

from .assessment_mode import normalize_mode
from .contracts import _validate_json
from .scope import normalize_url, validate_config
from .store import EngineError, Project

MAX_RULES = 256
MAX_URL_BYTES = 8192
FIELDS = frozenset({"project_id", "assessment_mode", "scope", "exclude",
                    "required_assessment_mode"})
REQUIRED_FIELDS = FIELDS - {"required_assessment_mode"}


def _rules(value, *, nonempty=False):
    if not isinstance(value, list) or (nonempty and not value):
        raise EngineError("dsh_context_shape", "Owner scope must be a nonempty URL array and exclude must be a URL array")
    if len(value) > MAX_RULES:
        raise EngineError("dsh_context_budget", "Owner scope and exclude each permit at most 256 URL rules")
    normalized = []
    for rule in value:
        if not isinstance(rule, str):
            raise EngineError("dsh_context_shape", "Owner scope and exclude must contain only HTTP(S) URL strings")
        if len(rule.encode("utf-8")) > MAX_URL_BYTES:
            raise EngineError("dsh_context_budget", "Owner URL rules must not exceed 8192 UTF-8 bytes")
        normalized.append(normalize_url(rule))
    return normalized


def _merge(old, incoming):
    _rules(old)
    merged = list(old)
    known = {normalize_url(rule) for rule in old}
    for rule in incoming:
        if rule not in known:
            merged.append(rule)
            known.add(rule)
    if len(merged) > MAX_RULES:
        raise EngineError("dsh_context_budget", "Merged owner scope and exclude each permit at most 256 URL rules")
    return merged, len(merged) - len(old)


def _configure(workspace, args):
    if not isinstance(args, dict):
        raise EngineError("dsh_context_shape", "Owner configuration requires a JSON object")
    _validate_json(args)
    if set(args) - FIELDS or not REQUIRED_FIELDS.issubset(args):
        raise EngineError("dsh_context_shape", "Owner configuration accepts only project_id, assessment_mode, scope, exclude and optional required_assessment_mode")
    if args["project_id"] != "assessment":
        raise EngineError("dsh_context_project", "Owner configuration requires the internal assessment project")
    selected = args["assessment_mode"]
    if not isinstance(selected, str) or selected not in {"assessment", "src"}:
        raise EngineError("assessment_mode", "assessment_mode must be assessment or src")
    required = args.get("required_assessment_mode", selected)
    if not isinstance(required, str) or required not in {"assessment", "src"}:
        raise EngineError("assessment_mode", "required_assessment_mode must be assessment or src")
    scope = _rules(args["scope"], nonempty=True)
    exclude = _rules(args["exclude"])
    with Project(workspace, args["project_id"]) as project, project.transaction():
        current = project.config
        if not current:
            raise EngineError("dsh_context_project", "The internal assessment project must be initialized before owner configuration")
        actual = normalize_mode(current.get("assessment_mode"))
        if selected != actual or required != actual:
            raise EngineError("assessment_mode_mismatch", "Owner context and persisted project assessment modes must match",
                              {"assessment_mode": actual, "required_assessment_mode": required})
        merged_scope, added_scope = _merge(current.get("scope", []), scope)
        merged_exclude, added_exclude = _merge(current.get("exclude", []), exclude)
        proposed = {**current, "scope": merged_scope, "exclude": merged_exclude}
        # Validate the target without rewriting it or any unrelated owner state.
        validate_config(proposed)
        result = {"project_id": project.project_id, "assessment_mode": actual,
                  "changed": bool(added_scope or added_exclude),
                  "added_scope_count": added_scope, "added_exclude_count": added_exclude,
                  "scope_total": len(merged_scope), "exclude_total": len(merged_exclude),
                  "requests_sent": 0}
        if result["changed"]:
            project.set_config(proposed)
            project.event("dsh.context.configured", result)
        return result


def configure(workspace, args):
    """Merge authorized rules monotonically; never execute requests or change mode."""
    try:
        return _configure(workspace, args)
    except EngineError as exc:
        exc.details = {**exc.details, "requests_sent": 0}
        raise
`;

function nativeFiles() {
  const bytes = Buffer.from(NATIVE_CONTEXT_SOURCE, 'utf8');
  return [{ path: NATIVE_CONTEXT_PATH, origin: 'dsh-purge', bytes,
    upstream_sha256: null, bundled_sha256: sha256(bytes),
    adaptations: ['Private owner-only, atomic monotonic scope/exclude merge; immutable mode and mutation policy; no target requests.'] }];
}

function safeFile(root, relative) {
  if (typeof relative !== 'string' || !relative || relative.includes('\\') || relative.includes('\0')
      || relative.split('/').some(part => !part || part === '.' || part === '..')) throw new Error('Invalid managed assessment path');
  const target = assertNoLinkedDescendants(root, path.resolve(root, relative));
  if (!within(root, target)) throw new Error('Managed assessment path escapes the embedded component');
  if (fs.existsSync(target)) {
    const stat = fs.lstatSync(target);
    if (!stat.isFile() || stat.nlink > 1) throw new Error('Managed assessment file must be a regular, unaliased file: ' + relative);
  }
  return target;
}

function productionPythonFiles(root) {
  const result = [];
  const visit = dir => {
    assertNoLinkedDescendants(root, dir);
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.name === '__pycache__' || entry.name.startsWith('.')) continue;
      const full = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) throw new Error('Assessment sources cannot contain linked files');
      if (entry.isDirectory()) visit(full);
      else if (entry.isFile() && entry.name.endsWith('.py')) {
        const relative = toPosix(path.relative(root, full));
        // execution/test_runner.py is a production runtime, not a unittest file.
        if (!/^awa_ddd\/tests_[^/]+\.py$/.test(relative)) result.push(relative);
      }
    }
  };
  visit(path.join(root, 'awa_ddd'));
  return result.sort();
}

function adaptedBytes(relative, source) {
  if (!['src/bridge.mjs', 'awa_ddd/__main__.py'].includes(relative)) return { bytes: source, adaptations: [] };
  let text = source.toString('utf8');
  const adaptations = [];
  const replace = (original, adapted, explanation) => {
    if (text.split(original).length !== 2) throw new Error('Upstream ' + relative + ' changed; review the embedded adaptation before synchronizing');
    text = text.replace(original, adapted);
    adaptations.push(explanation);
  };
  if (relative === 'src/bridge.mjs') {
    replace("export const DEFAULT_WORKSPACE = join(homedir(), '.dsh', 'awa-ddd-data');",
      "export const DEFAULT_WORKSPACE = join(homedir(), '.dsh', 'redteam', 'assessment-data');",
      'Default state directory belongs to dsh-purge; engagement runtime supplies its own explicit workspace.');
    const newline = text.includes('\r\n') ? '\r\n' : '\n';
    replace("import { ALL_ACTIONS as VALID_ACTIONS } from './actions.mjs';",
      "import { ALL_ACTIONS as PUBLIC_ACTIONS } from './actions.mjs';" + newline
        + "const VALID_ACTIONS = Object.freeze([...PUBLIC_ACTIONS, 'dsh.context.configure']);",
      'Transport accepts the private owner context action; public action catalogs and help remain unchanged.');
  } else {
    const newline = text.includes('\r\n') ? '\r\n' : '\n';
    replace('def _dispatch(workspace,action,args):', [
      'def _dispatch(workspace,action,args):',
      '    if action == "dsh.context.configure":',
      '        from .dsh_context import configure',
      '        return configure(workspace, args)',
    ].join(newline), 'Dispatches the private owner configuration before public AWA contracts; no new public action.');
  }
  return { bytes: Buffer.from(text, 'utf8'), adaptations };
}

function sourceSnapshot(sourceDirectory) {
  const root = fs.realpathSync(path.resolve(sourceDirectory));
  const manifest = JSON.parse(fs.readFileSync(safeFile(root, 'package.json'), 'utf8'));
  if (manifest.name !== 'awa-ddd' || !/^\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$/.test(manifest.version || '')) throw new Error('Expected a locally reviewed awa-ddd source checkout');
  const paths = [...productionPythonFiles(root), ...JS_FILES, 'LICENSE'].sort();
  if (paths.includes(NATIVE_CONTEXT_PATH)) throw new Error('Upstream now owns the private context module name; review the embedded adaptation before synchronizing');
  for (const required of UPSTREAM_REQUIRED_FILES) if (!paths.includes(required) || !fs.existsSync(safeFile(root, required))) throw new Error('Missing production assessment source: ' + required);
  const files = [...paths.map(relative => {
    const source = fs.readFileSync(safeFile(root, relative));
    const adapted = adaptedBytes(relative, source);
    return { path: relative, origin: 'awa-ddd', bytes: adapted.bytes, upstream_sha256: sha256(source),
      bundled_sha256: sha256(adapted.bytes), adaptations: adapted.adaptations };
  }), ...nativeFiles()].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  return { version: manifest.version, files, upstream_sha256: upstreamDigest(files) };
}

export function checkEmbeddedAssessment(repositoryRoot = REPOSITORY_ROOT, sourceDirectory) {
  const root = embeddedRootOf(repositoryRoot);
  assertNoLinkedDescendants(path.resolve(repositoryRoot), root);
  const manifest = JSON.parse(fs.readFileSync(safeFile(root, 'package.json'), 'utf8'));
  const provenance = JSON.parse(fs.readFileSync(safeFile(root, 'provenance.json'), 'utf8'));
  if (manifest.name !== IDENTITY || manifest.private !== true || manifest.type !== 'module'
      || provenance.schema !== SCHEMA || provenance.upstream?.name !== 'awa-ddd'
      || manifest.version !== provenance.upstream.version || !Array.isArray(provenance.files)) throw new Error('Invalid embedded assessment identity or provenance');
  const names = new Set();
  for (const file of provenance.files) {
    const native = file?.origin === 'dsh-purge';
    if (!file || names.has(file.path) || !['awa-ddd', 'dsh-purge'].includes(file.origin || 'awa-ddd')
        || (file.path === NATIVE_CONTEXT_PATH) !== native
        || (native ? file.path !== NATIVE_CONTEXT_PATH || file.upstream_sha256 !== null
          : !/^[a-f0-9]{64}$/.test(file.upstream_sha256 || ''))
        || !/^[a-f0-9]{64}$/.test(file.bundled_sha256 || '')
        || !Array.isArray(file.adaptations) || file.adaptations.some(value => typeof value !== 'string')) throw new Error('Invalid embedded assessment source record');
    names.add(file.path);
    if (sha256(fs.readFileSync(safeFile(root, file.path))) !== file.bundled_sha256) throw new Error('Embedded assessment integrity mismatch: ' + file.path);
    if (native && file.bundled_sha256 !== sha256(Buffer.from(NATIVE_CONTEXT_SOURCE, 'utf8'))) throw new Error('Private assessment owner adapter is stale; review and synchronize the component');
  }
  for (const required of REQUIRED_FILES) if (!names.has(required)) throw new Error('Embedded assessment is missing ' + required);
  const actual = [...productionPythonFiles(root), ...JS_FILES, 'LICENSE'].sort();
  if (JSON.stringify(actual) !== JSON.stringify([...names].sort())) throw new Error('Unrecorded or stale production assessment file');
  const upstreamHash = upstreamDigest(provenance.files);
  if (upstreamHash !== provenance.upstream.source_sha256) throw new Error('Embedded assessment upstream digest mismatch');
  if (sourceDirectory) {
    const source = sourceSnapshot(sourceDirectory);
    if (source.version !== provenance.upstream.version || source.upstream_sha256 !== upstreamHash) throw new Error('Reviewed source checkout differs from the checked-in assessment component');
    if (source.files.some(expected => provenance.files.find(file => file.path === expected.path)?.bundled_sha256 !== expected.bundled_sha256)) throw new Error('Embedded adaptations differ from the reviewed source import');
  }
  return { name: IDENTITY, version: manifest.version, files: names.size,
    python_files: actual.filter(file => file.endsWith('.py')).length, javascript_files: JS_FILES.length,
    source_sha256: upstreamHash, external_source_required: false };
}

export function synchronizeEmbeddedAssessment(sourceDirectory, { repositoryRoot = REPOSITORY_ROOT, force = false } = {}) {
  const source = sourceSnapshot(sourceDirectory);
  const root = embeddedRootOf(repositoryRoot);
  assertNoLinkedDescendants(path.resolve(repositoryRoot), root);
  let previous;
  if (fs.existsSync(path.join(root, 'provenance.json'))) {
    previous = JSON.parse(fs.readFileSync(safeFile(root, 'provenance.json'), 'utf8'));
    if (!force) checkEmbeddedAssessment(repositoryRoot);
  }
  const nextNames = new Set(source.files.map(file => file.path));
  const stale = (previous?.files || []).filter(file => !nextNames.has(file.path));
  // Never recursively erase a directory. Only verified, previously managed
  // regular files can be removed when the explicit maintainer import drops them.
  for (const file of stale) {
    const target = safeFile(root, file.path);
    if (fs.existsSync(target) && sha256(fs.readFileSync(target)) !== file.bundled_sha256) throw new Error('Preserve modified former assessment source before synchronizing: ' + file.path);
  }
  for (const file of source.files) {
    const target = safeFile(root, file.path);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    atomicWriteFileSync(target, file.bytes);
  }
  const manifest = { name: IDENTITY, version: source.version, private: true, type: 'module', license: 'MIT',
    description: 'Internal evidence assessment component owned and shipped by dsh-purge.',
    engines: { node: '>=22.19.0' }, python: '>=3.10',
    runtimeDependencies: { acorn: '8.19.0' } };
  const provenance = { schema: SCHEMA, upstream: { name: 'awa-ddd', version: source.version,
    license: 'MIT', copyright: 'Copyright (c) 2026 awa-ddd contributors', source_sha256: source.upstream_sha256 },
    distribution: 'Checked-in production source; no external AWA project is consulted at runtime.',
    files: source.files.map(({ path, origin, upstream_sha256, bundled_sha256, adaptations }) => ({ path, origin, upstream_sha256, bundled_sha256, adaptations })) };
  atomicWriteFileSync(safeFile(root, 'package.json'), JSON.stringify(manifest, null, 2) + '\n');
  atomicWriteFileSync(safeFile(root, 'provenance.json'), JSON.stringify(provenance, null, 2) + '\n');
  atomicWriteFileSync(safeFile(root, 'NOTICE.md'), '# Internal assessment component\n\n'
    + 'Production assessment code is derived from awa-ddd ' + source.version + ' (MIT).\n'
    + 'Copyright (c) 2026 awa-ddd contributors. The complete license is in LICENSE.\n\n'
    + 'This directory is dsh-purge source and is shipped in the dsh-purge package.\n'
    + 'It contains the Python assessment engine, action catalog, bounded process\n'
    + 'runtime, AST helper and private dsh-purge owner context adapter. That adapter\n'
    + 'only merges authorized scope/exclude rules atomically; it never sends target\n'
    + 'requests or changes mode, target or mutation policy. It is not public AWA API.\n'
    + 'The component does not contain the standalone AWA plugin, host\n'
    + 'SDKs, command-line installer, node_modules, tests, user data or credentials.\n'
    + 'provenance.json records upstream and bundled SHA-256 values and adaptations.\n');
  atomicWriteFileSync(safeFile(root, 'README.md'), '# dsh-purge internal assessment engine\n\n'
    + 'This directory is production source shipped inside dsh-purge. Its assessment\n'
    + 'logic derives from the locally reviewed awa-ddd ' + source.version + ' source,\n'
    + 'with explicit dsh-purge adaptations recorded in provenance.json. Runtime\n'
    + 'never selects or imports a separate awa-ddd checkout or plugin installation.\n\n'
    + 'The component contains ' + source.files.filter(file => file.path.endsWith('.py')).length
    + ' Python production files, including the private owner context adapter,\n'
    + 'and three JavaScript runtime files: the bounded process bridge, public\n'
    + 'action catalog and inert-source AST helper. Python 3.10+ and Node 22.19+ are\n'
    + 'runtime requirements. acorn@8.19.0 is installed through the dsh-purge root\n'
    + 'package dependencies; host SDKs and standalone AWA UI/plugin code are not\n'
    + 'part of this component. The original MIT license is retained in LICENSE.\n\n'
    + 'The dsh-purge native assessment facade owns initialization, workspace and\n'
    + 'project identity. Each engagement uses its own assessment/ state directory\n'
    + 'and the internal project ID assessment. Both assessment and SRC retain the\n'
    + 'persisted project mode. SRC is discovery-only, rejects prohibited writes\n'
    + 'and execution adapters, and stops the operation once direct proof exists.\n'
    + 'Imported scanner confirmations remain unverified claims until independent\n'
    + 'current machine evidence supports the matching operation and exact input.\n\n'
    + 'The private dsh.context.configure action is available only to the trusted\n'
    + 'dsh-purge owner facade; public AWA action catalogs and help do not list it.\n'
    + 'It requires project_id:assessment, assessment_mode, a nonempty scope array\n'
    + 'and an exclude array (which may be empty), plus optional\n'
    + 'required_assessment_mode. URL rules are\n'
    + 'normalized HTTP(S) values, limited to 8192 UTF-8 bytes per rule and 256 rules\n'
    + 'per array, including the merged total. It only appends new scope/exclude\n'
    + 'rules, preserves target, mode, mutation policy and unrelated configuration,\n'
    + 'and atomically records an event only when something changes. It sends no\n'
    + 'target requests and rejects unknown configuration fields.\n\n'
    + 'Maintainers run node scripts/sync-assessment-engine.mjs --check from the\n'
    + 'dsh-purge root for a fully offline integrity check. An explicit --source\n'
    + 'PATH imports a reviewed upstream checkout; --check --source PATH also\n'
    + 'compares its snapshot. Known local adaptations and the native owner module\n'
    + 'are regenerated by this script, and upstream anchor changes require review.\n'
    + 'Modified managed source is preserved unless --force explicitly authorizes\n'
    + 'resynchronization. Production never runs this source-import command.\n');
  for (const file of stale) {
    const target = safeFile(root, file.path);
    if (fs.existsSync(target)) fs.unlinkSync(target);
  }
  return checkEmbeddedAssessment(repositoryRoot, sourceDirectory);
}

function argumentsOf(argv) {
  const options = { check: false, force: false, source: undefined };
  for (let index = 0; index < argv.length; index++) {
    const flag = argv[index];
    if (flag === '--check') options.check = true;
    else if (flag === '--force') options.force = true;
    else if (flag === '--source' && argv[index + 1] && !argv[index + 1].startsWith('--')) options.source = argv[++index];
    else throw new Error('Usage: node scripts/sync-assessment-engine.mjs --check [--source PATH] | --source PATH [--force]');
  }
  if (!options.check && !options.source) throw new Error('Source import requires an explicitly selected reviewed checkout; --check is fully offline.');
  if (options.check && options.force) throw new Error('--force cannot be used with --check');
  return options;
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  try {
    const options = argumentsOf(process.argv.slice(2));
    const result = options.check ? checkEmbeddedAssessment(REPOSITORY_ROOT, options.source)
      : synchronizeEmbeddedAssessment(options.source, { force: options.force });
    console.log(JSON.stringify(result));
  } catch (error) {
    console.error('Assessment source check/import failed: ' + error.message);
    process.exitCode = 1;
  }
}
