/** Maintainer-only source import. Production uses the checked-in internal engine. */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { assertNoLinkedDescendants, within } from '../lib/path-boundary.js';
import { atomicWriteFileSync } from '../lib/redteam/atomic-write.js';
import { adaptAssessmentBrowser } from './assessment-browser-adaptation.mjs';

const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCHEMA = 'dsh-purge-assessment-source/v1';
const IDENTITY = 'dsh-purge-assessment-engine';
const JS_FILES = ['src/actions.mjs', 'src/bridge.mjs', 'src/parse-js.mjs'];
const NATIVE_CONTEXT_PATH = 'awa_ddd/dsh_context.py';
const NATIVE_SOURCE_PATHS = [NATIVE_CONTEXT_PATH, 'awa_ddd/capture_batch.py', 'awa_ddd/execution/authorization_provider.py',
  'awa_ddd/execution/input_contract.py', 'awa_ddd/execution/request_builder.py', 'awa_ddd/execution/tool_router.py',
  'awa_ddd/planning/membership.py', 'awa_ddd/proof_claim.py'];
const REVIEWED_ADAPTATIONS = new Set(['awa_ddd/assessment.py', 'awa_ddd/contracts.py', 'awa_ddd/engine.py',
  'awa_ddd/transport.py', 'awa_ddd/browser.py', 'awa_ddd/integration.py', 'awa_ddd/domain/hypothesis.py',
  'awa_ddd/domain/test_recipe.py', 'awa_ddd/execution/capabilities.py', 'awa_ddd/execution/oracle_profiles.py',
  'awa_ddd/execution/recipe_builder.py', 'awa_ddd/execution/test_runner.py', 'awa_ddd/execution/review_engine.py',
  'awa_ddd/planning/campaign.py', 'awa_ddd/planning/scheduler.py', 'awa_ddd/planning/coverage.py',
  'awa_ddd/reporting/matrix.py', 'awa_ddd/reporting_legacy.py', 'awa_ddd/assessment_mode.py',
  'awa_ddd/__main__.py', 'awa_ddd/publication.py', 'awa_ddd/runtime.py', 'awa_ddd/external.py',
  'awa_ddd/tscanplus.py', 'awa_ddd/wsl_runner.py', 'awa_ddd/v2api.py', 'awa_ddd/oracle_contracts.py',
  'awa_ddd/domain/campaign.py', 'awa_ddd/domain/coverage_claim.py', 'awa_ddd/domain/finding.py',
  'awa_ddd/domain/known_case.py', 'awa_ddd/domain/repository.py', 'awa_ddd/domain/review.py',
  'awa_ddd/domain/test_run.py', 'awa_ddd/domain/universe.py', 'awa_ddd/planning/hypotheses.py',
  'awa_ddd/planning/known_cases.py', 'awa_ddd/execution/browser_provider.py',
  'awa_ddd/execution/external_provider.py', 'src/actions.mjs', 'src/bridge.mjs']);
const OWNED_ADAPTATIONS = new Map([
  [NATIVE_CONTEXT_PATH, 'Private atomic owner configuration; immutable mode and no target requests.'],
  ['awa_ddd/capture_batch.py', 'Bounded single worker with per-dispatch live engagement, source-stop and Cookie guards and actual cost receipts.'],
  ['awa_ddd/execution/authorization_provider.py', 'Independent verified principals and exact protected resource controls; status/length alone never confirms access.'],
  ['awa_ddd/execution/input_contract.py', 'Actual baseline input and explicit SQL/template context; independent mechanism controls and bounded proof.'],
  ['awa_ddd/execution/request_builder.py', 'Exact structured input request construction, preserving unrelated baseline fields and transport framing.'],
  ['awa_ddd/execution/tool_router.py', 'Zero-request demand-driven routes from actual context, supported profiles and current runtime receipts.'],
  ['awa_ddd/planning/membership.py', 'Frozen campaign membership and independent campaign state with shared execution/unknown-effect guards.'],
  ['awa_ddd/proof_claim.py', 'Current machine-only claim contracts reverify artifacts, exact inputs, oracle scope and severity caps.'],
]);
const UPSTREAM_REQUIRED_FILES = ['awa_ddd/__init__.py', 'awa_ddd/__main__.py', 'awa_ddd/store.py',
  'awa_ddd/engine.py', 'awa_ddd/assessment.py', 'awa_ddd/assessment_mode.py',
  'awa_ddd/integration.py', 'awa_ddd/execution/test_runner.py', ...JS_FILES, 'LICENSE'];
const REQUIRED_FILES = [...UPSTREAM_REQUIRED_FILES, ...NATIVE_SOURCE_PATHS];
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

function nativeFiles(repositoryRoot = REPOSITORY_ROOT) {
  const bytes = Buffer.from(NATIVE_CONTEXT_SOURCE, 'utf8');
  return [{ path: NATIVE_CONTEXT_PATH, origin: 'dsh-purge', bytes,
    upstream_sha256: null, bundled_sha256: sha256(bytes),
    adaptations: ['Private owner-only, atomic monotonic scope/exclude merge; immutable mode and mutation policy; no target requests.'] },
  ...NATIVE_SOURCE_PATHS.filter(relative => relative !== NATIVE_CONTEXT_PATH).map(relative => {
    const bytes = fs.readFileSync(safeFile(embeddedRootOf(repositoryRoot), relative));
    return { path: relative, origin: 'dsh-purge', bytes, upstream_sha256: null, bundled_sha256: sha256(bytes),
      adaptations: [OWNED_ADAPTATIONS.get(relative)] };
  })];
}

function adaptationVersion(repositoryRoot) {
  const manifest = JSON.parse(fs.readFileSync(safeFile(path.resolve(repositoryRoot), 'package.json'), 'utf8'));
  if (!/^\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$/.test(manifest.version || '')) throw new Error('The owning package needs an explicit adaptation version');
  return manifest.version;
}

function localAdaptationNote(relative, version) {
  let contract = 'fixed public action contracts and current evidence guards';
  if (relative.includes('/planning/') || relative.includes('/domain/') || relative.includes('/reporting/')) {
    contract = 'frozen campaign membership, independent state, exact input/origin attribution and measured coverage';
  } else if (/runtime|external|tscanplus|wsl_runner|bridge/.test(relative)) {
    contract = 'typed backend, executable/profile binding, operator-only environment and current readiness receipts';
  } else if (/oracle|assessment|browser_provider|recipe_builder|test_runner|review_engine/.test(relative)) {
    contract = 'independent actual controls, current bounded machine proof and draft-only model review authority';
  } else if (relative.endsWith('/transport.py')) {
    contract = 'actual bounded dispatch, sent/received counts and uncertain-request preservation';
  }
  return 'Local ' + version + ' reviewed adaptation: ' + contract + '; upstream attribution and hashes are retained.';
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

function adaptedBytes(relative, source, repositoryRoot = REPOSITORY_ROOT) {
  if (REVIEWED_ADAPTATIONS.has(relative)) {
    const root = embeddedRootOf(repositoryRoot);
    const provenance = JSON.parse(fs.readFileSync(safeFile(root, 'provenance.json'), 'utf8'));
    const record = provenance.files.find(file => file.path === relative && file.origin !== 'dsh-purge');
    if (!record || sha256(source) !== record.upstream_sha256) {
      throw new Error('Upstream ' + relative + ' differs from the reviewed adaptation; review the contract and source hash before importing. --force does not authorize contract drift.');
    }
    const bytes = fs.readFileSync(safeFile(root, relative));
    if (sha256(bytes) !== record.bundled_sha256) throw new Error('Preserve and record the local adaptation before importing: ' + relative);
    return { bytes, adaptations: [...record.adaptations] };
  }
  if (relative === 'awa_ddd/browser.py') return adaptAssessmentBrowser(source);
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

function sourceSnapshot(sourceDirectory, repositoryRoot = REPOSITORY_ROOT) {
  const root = fs.realpathSync(path.resolve(sourceDirectory));
  const manifest = JSON.parse(fs.readFileSync(safeFile(root, 'package.json'), 'utf8'));
  if (manifest.name !== 'awa-ddd' || !/^\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$/.test(manifest.version || '')) throw new Error('Expected a locally reviewed awa-ddd source checkout');
  const paths = [...productionPythonFiles(root), ...JS_FILES, 'LICENSE'].sort();
  if (paths.some(relative => NATIVE_SOURCE_PATHS.includes(relative))) throw new Error('Upstream now owns a private dsh-purge module name; review the embedded adaptation before synchronizing');
  for (const required of UPSTREAM_REQUIRED_FILES) if (!paths.includes(required) || !fs.existsSync(safeFile(root, required))) throw new Error('Missing production assessment source: ' + required);
  const files = [...paths.map(relative => {
    const source = fs.readFileSync(safeFile(root, relative));
    const adapted = adaptedBytes(relative, source, repositoryRoot);
    return { path: relative, origin: 'awa-ddd', bytes: adapted.bytes, upstream_sha256: sha256(source),
      bundled_sha256: sha256(adapted.bytes), adaptations: adapted.adaptations };
  }), ...nativeFiles(repositoryRoot)].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  return { version: manifest.version, files, upstream_sha256: upstreamDigest(files) };
}

export function checkEmbeddedAssessment(repositoryRoot = REPOSITORY_ROOT, sourceDirectory) {
  const root = embeddedRootOf(repositoryRoot);
  assertNoLinkedDescendants(path.resolve(repositoryRoot), root);
  const manifest = JSON.parse(fs.readFileSync(safeFile(root, 'package.json'), 'utf8'));
  const provenance = JSON.parse(fs.readFileSync(safeFile(root, 'provenance.json'), 'utf8'));
  if (manifest.name !== IDENTITY || manifest.private !== true || manifest.type !== 'module'
      || provenance.schema !== SCHEMA || provenance.upstream?.name !== 'awa-ddd'
      || manifest.version !== provenance.upstream.version || !Array.isArray(provenance.files)
      || !/^\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$/.test(manifest.dshPurgeAdaptationVersion || '')
      || manifest.dshPurgeAdaptationVersion !== provenance.dshPurgeAdaptationVersion) throw new Error('Invalid embedded assessment identity or provenance');
  const names = new Set();
  for (const file of provenance.files) {
    const native = file?.origin === 'dsh-purge';
    if (!file || names.has(file.path) || !['awa-ddd', 'dsh-purge'].includes(file.origin || 'awa-ddd')
        || NATIVE_SOURCE_PATHS.includes(file.path) !== native
        || (native ? !NATIVE_SOURCE_PATHS.includes(file.path) || file.upstream_sha256 !== null
          : !/^[a-f0-9]{64}$/.test(file.upstream_sha256 || ''))
        || !/^[a-f0-9]{64}$/.test(file.bundled_sha256 || '')
        || !Array.isArray(file.adaptations) || file.adaptations.some(value => typeof value !== 'string')) throw new Error('Invalid embedded assessment source record');
    names.add(file.path);
    if (sha256(fs.readFileSync(safeFile(root, file.path))) !== file.bundled_sha256) throw new Error('Embedded assessment integrity mismatch: ' + file.path);
    if (file.path === NATIVE_CONTEXT_PATH && file.bundled_sha256 !== sha256(Buffer.from(NATIVE_CONTEXT_SOURCE, 'utf8'))) throw new Error('Private assessment owner adapter is stale; review and synchronize the component');
  }
  for (const required of REQUIRED_FILES) if (!names.has(required)) throw new Error('Embedded assessment is missing ' + required);
  const actual = [...productionPythonFiles(root), ...JS_FILES, 'LICENSE'].sort();
  if (JSON.stringify(actual) !== JSON.stringify([...names].sort())) throw new Error('Unrecorded or stale production assessment file');
  const upstreamHash = upstreamDigest(provenance.files);
  if (upstreamHash !== provenance.upstream.source_sha256) throw new Error('Embedded assessment upstream digest mismatch');
  if (sourceDirectory) {
    const source = sourceSnapshot(sourceDirectory, repositoryRoot);
    if (source.version !== provenance.upstream.version || source.upstream_sha256 !== upstreamHash) throw new Error('Reviewed source checkout differs from the checked-in assessment component');
    if (source.files.some(expected => provenance.files.find(file => file.path === expected.path)?.bundled_sha256 !== expected.bundled_sha256)) throw new Error('Embedded adaptations differ from the reviewed source import');
  }
  return { name: IDENTITY, version: manifest.version, adaptation_version: manifest.dshPurgeAdaptationVersion, files: names.size,
    python_files: actual.filter(file => file.endsWith('.py')).length, javascript_files: JS_FILES.length,
    source_sha256: upstreamHash, external_source_required: false };
}

export function recordReviewedLocalAssessment({ repositoryRoot = REPOSITORY_ROOT } = {}) {
  const root = embeddedRootOf(repositoryRoot);
  assertNoLinkedDescendants(path.resolve(repositoryRoot), root);
  const version = adaptationVersion(repositoryRoot);
  const manifest = JSON.parse(fs.readFileSync(safeFile(root, 'package.json'), 'utf8'));
  const provenance = JSON.parse(fs.readFileSync(safeFile(root, 'provenance.json'), 'utf8'));
  if (manifest.name !== IDENTITY || manifest.private !== true || manifest.type !== 'module'
      || provenance.schema !== SCHEMA || provenance.upstream?.name !== 'awa-ddd'
      || manifest.version !== provenance.upstream.version || !Array.isArray(provenance.files)) throw new Error('Invalid local assessment identity or provenance');
  const records = new Map();
  for (const file of provenance.files) {
    const native = file?.origin === 'dsh-purge';
    if (!file || records.has(file.path) || !['awa-ddd', 'dsh-purge'].includes(file.origin)
        || NATIVE_SOURCE_PATHS.includes(file.path) !== native
        || (native ? file.upstream_sha256 !== null : !/^[a-f0-9]{64}$/.test(file.upstream_sha256 || ''))
        || !/^[a-f0-9]{64}$/.test(file.bundled_sha256 || '') || !Array.isArray(file.adaptations)
        || file.adaptations.some(value => typeof value !== 'string')) throw new Error('Invalid prior assessment source record');
    records.set(file.path, file);
  }
  if (upstreamDigest(provenance.files) !== provenance.upstream.source_sha256) throw new Error('The upstream digest must not change during local adaptation recording');
  const actual = [...productionPythonFiles(root), ...JS_FILES, 'LICENSE'].sort();
  if (provenance.files.some(file => !actual.includes(file.path))) throw new Error('Recording cannot remove formerly managed assessment sources');
  const files = actual.map(relative => {
    const bytes = fs.readFileSync(safeFile(root, relative)), hash = sha256(bytes);
    const prior = records.get(relative);
    if (!prior && !NATIVE_SOURCE_PATHS.includes(relative)) throw new Error('Unreviewed new assessment source: ' + relative);
    if (prior && prior.bundled_sha256 !== hash && !NATIVE_SOURCE_PATHS.includes(relative) && !REVIEWED_ADAPTATIONS.has(relative)) {
      throw new Error('Unreviewed changed assessment source: ' + relative);
    }
    if (relative === NATIVE_CONTEXT_PATH && hash !== sha256(Buffer.from(NATIVE_CONTEXT_SOURCE, 'utf8'))) throw new Error('The private owner context must match its reviewed template');
    const note = NATIVE_SOURCE_PATHS.includes(relative) ? OWNED_ADAPTATIONS.get(relative) : localAdaptationNote(relative, version);
    const changed = !prior || prior.bundled_sha256 !== hash;
    return { ...(prior || { path: relative, origin: 'dsh-purge', upstream_sha256: null, adaptations: [] }),
      bundled_sha256: hash, adaptations: changed ? [...new Set([...(prior?.adaptations || []), note])] : [...prior.adaptations] };
  });
  for (const required of REQUIRED_FILES) if (!actual.includes(required)) throw new Error('Missing reviewed assessment source: ' + required);
  const next = { ...provenance, dshPurgeAdaptationVersion: version, files };
  if (upstreamDigest(files) !== provenance.upstream.source_sha256) throw new Error('Local adaptation changed upstream attribution');
  atomicWriteFileSync(safeFile(root, 'provenance.json'), JSON.stringify(next, null, 2) + '\n');
  atomicWriteFileSync(safeFile(root, 'package.json'), JSON.stringify({ ...manifest, dshPurgeAdaptationVersion: version }, null, 2) + '\n');
  writeComponentDocumentation(root, version, provenance.upstream.version);
  return { ...checkEmbeddedAssessment(repositoryRoot), adaptation_version: version,
    local_adaptations_recorded: true, source_verification_performed: false, runtime_probed: false };
}

export function synchronizeEmbeddedAssessment(sourceDirectory, { repositoryRoot = REPOSITORY_ROOT, force = false } = {}) {
  const source = sourceSnapshot(sourceDirectory, repositoryRoot);
  const root = embeddedRootOf(repositoryRoot);
  const version = adaptationVersion(repositoryRoot);
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
    dshPurgeAdaptationVersion: version,
    description: 'Internal evidence assessment component owned and shipped by dsh-purge.',
    engines: { node: '>=22.19.0' }, python: '>=3.10',
    runtimeDependencies: { acorn: '8.19.0' } };
  const provenance = { schema: SCHEMA, upstream: { name: 'awa-ddd', version: source.version,
    license: 'MIT', copyright: 'Copyright (c) 2026 awa-ddd contributors', source_sha256: source.upstream_sha256 },
    dshPurgeAdaptationVersion: version,
    distribution: 'Checked-in production source; no external AWA project is consulted at runtime.',
    files: source.files.map(({ path, origin, upstream_sha256, bundled_sha256, adaptations }) => ({ path, origin, upstream_sha256, bundled_sha256, adaptations })) };
  atomicWriteFileSync(safeFile(root, 'package.json'), JSON.stringify(manifest, null, 2) + '\n');
  atomicWriteFileSync(safeFile(root, 'provenance.json'), JSON.stringify(provenance, null, 2) + '\n');
  writeComponentDocumentation(root, version, source.version);
  for (const file of stale) {
    const target = safeFile(root, file.path);
    if (fs.existsSync(target)) fs.unlinkSync(target);
  }
  return checkEmbeddedAssessment(repositoryRoot, sourceDirectory);
}

function writeComponentDocumentation(root, version, upstreamVersion) {
  atomicWriteFileSync(safeFile(root, 'NOTICE.md'), '# Internal assessment component\n\n'
    + 'Production assessment code is derived from awa-ddd ' + upstreamVersion + ' (MIT).\n'
    + 'Copyright (c) 2026 awa-ddd contributors. The complete license is in LICENSE.\n\n'
    + 'This directory is dsh-purge source and is shipped in the dsh-purge package.\n'
    + 'It contains the Python assessment engine, action catalog, bounded process\n'
    + 'runtime, AST helper and private dsh-purge owner context adapter. That adapter\n'
    + 'only merges authorized scope/exclude rules atomically; it never sends target\n'
    + 'requests or changes mode, target or mutation policy. It is not public AWA API.\n'
    + 'The component does not contain the standalone AWA plugin, host\n'
    + 'SDKs, command-line installer, node_modules, tests, user data or credentials.\n'
    + 'provenance.json records upstream and bundled SHA-256 values and adaptations.\n\n'
    + 'dsh-purge ' + version + ' additionally owns the structured request, bounded machine\n'
    + 'claim, campaign membership, access-control, batch worker and tool-routing\n'
    + 'helpers. Reviewed local identity, oracle, recovery and report adaptations\n'
    + 'are retained only for the recorded upstream file hashes. New\n'
    + 'upstream bytes require explicit contract review, including with --force.\n\n'
    + "The source-stop adaptation reads the trusted facade's fixed workspace\n"
    + 'snapshot before sending HTTP, identity, indirect recipe and browser requests.\n'
    + 'Browser routing refreshes it for each subrequest; invalid or stopped snapshots\n'
    + 'fail before sending. Offline verification and report access remain available.\n\n'
    + 'The local browser adaptation selects an existing Playwright package through\n'
    + 'operator environment and the actual DSH_HOME, while keeping browser caches\n'
    + 'separate from module discovery. It does not install dependencies, send target\n'
    + 'requests during discovery, or change the browser scope and write guards.\n\n'
    + 'Provenance covers the original per-file bytes, with Git preserving reviewed\n'
    + 'LF/CRLF source and explicit LF for the generated browser adaptation.\n\n'
    + 'Upgrade checks are recorded in docs/MODE-UPGRADE-' + version + '.md. Source hashes\n'
    + 'describe the bundled bytes and do not claim runtime or assessment success.\n');
  atomicWriteFileSync(safeFile(root, 'README.md'), '# dsh-purge internal assessment engine\n\n'
    + 'This directory is production source shipped inside dsh-purge. Its assessment\n'
    + 'logic derives from the locally reviewed awa-ddd ' + upstreamVersion + ' source,\n'
    + 'with explicit dsh-purge adaptations recorded in provenance.json. Runtime\n'
    + 'never selects or imports a separate awa-ddd checkout or plugin installation.\n\n'
    + 'The component contains Python production source, including private owner,\n'
    + 'structured-request, bounded-claim, membership, access-control, batch and\n'
    + 'tool-routing helpers, and three JavaScript runtime\n'
    + 'files: the bounded process bridge, public\n'
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
    + 'The dsh-purge pentest preset uses the ordinary assessment engine mode within\n'
    + 'its own fixed engagement. It does not connect to an external AWA installation.\n'
    + "Full penetration reports are generated through this component's report.build;\n"
    + 'source labels, baseline observations and report snapshots do not grant proof\n'
    + 'or finalization authority.\n\n'
    + 'The local dsh-purge adaptation version is ' + version + '; the upstream version remains\n'
    + 'awa-ddd ' + upstreamVersion + '. Current native proofs bind operation/input, identity, complete\n'
    + 'artifacts and oracle-generated claim scope, limitations and severity cap.\n'
    + 'Historical machine labels without the current contract remain pending.\n'
    + 'Automatic builders provide actual-baseline double Boolean SQL controls,\n'
    + 'explicit non-calculator template controls, verified-principal GET access\n'
    + 'boundaries, native reflected HTML XSS controls and bounded generic tests.\n'
    + 'Missing providers remain blocked. Model reviews and N/A applicability drafts\n'
    + 'cannot grant a finding, a new SRC stop or a smaller coverage denominator.\n'
    + 'Campaign members and verdicts are projected independently while actual\n'
    + 'attempts, cooldown, uncertainty and stops remain engagement-wide.\n'
    + 'Failed runs preserve attempts, evidence, cooldown and unknown writes.\n'
    + 'Offline verification neither replays requests nor reconciles unknown effects.\n\n'
    + 'tool.route reads actual existing IDs and saved, profile-bound runtime receipts\n'
    + 'without probing or target traffic. Existing scripts/maps use offline discovery;\n'
    + 'DOM needs select Playwright, public GET replay requires Yak fuzzer/TLS controls,\n'
    + 'and existing scanner results reuse the exact TscanPlus namespace. WSL remains\n'
    + 'operator-selected. Requests without anonymous cookie_evidence_ids use one\n'
    + 'fixed batch worker; anonymous Cookie chains retain per-item facade handling.\n'
    + 'Each dispatch rechecks live scope, identity, Cookie and SRC restrictions.\n'
    + 'Execution receipts count actual sends/receives/bytes/time; reuse is zero new\n'
    + 'requests and unmeasured costs remain null.\n\n'
    + 'SRC reads the facade-owned dsh-source-stops.json snapshot from its fixed\n'
    + 'workspace before HTTP, preflight, identity, indirect recipe and browser\n'
    + 'requests. Browser routing refreshes that snapshot for every subrequest.\n'
    + 'Stopped resources and invalid snapshots fail before sending. Offline evidence\n'
    + 'inspection, verification and reports remain available. Models cannot select\n'
    + 'the snapshot path or supply its contents.\n\n'
    + 'The local browser adaptation reuses an existing playwright or playwright-core\n'
    + 'package selected by operator PURGE_PLAYWRIGHT_ROOT, the actual DSH_HOME, or the\n'
    + 'legacy default module location. Chromium caches are discovered separately on\n'
    + 'Windows/macOS/Linux. A cache is not a Node module, and file discovery is not a\n'
    + 'successful launch. No package or browser is installed automatically. The\n'
    + 'adaptation template is maintained in scripts/assessment-browser-adaptation.mjs;\n'
    + 'explicit imports retain the recorded local adaptation only against its exact\n'
    + 'reviewed upstream hash, with provenance recorded in provenance.json.\n\n'
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
    + 'compares its snapshot. Native helpers and reviewed local adaptations\n'
    + 'are retained against their exact upstream hashes; changed upstream bytes\n'
    + 'require explicit contract review before any import, including --force.\n'
    + 'Modified managed source is preserved unless --force explicitly authorizes\n'
    + 'resynchronization. --record-local records only allowlisted reviewed local\n'
    + 'changes and retains upstream attribution; it does not verify source origin\n'
    + 'or runtime correctness. Production never runs these maintainer commands.\n\n'
    + "Provenance covers exact source bytes. Git retains the managed component's\n"
    + 'reviewed LF/CRLF bytes; browser.py is generated with explicit LF line endings.\n\n'
    + 'Upgrade checks are recorded in docs/MODE-UPGRADE-' + version + '.md. Generating the\n'
    + 'provenance manifest is not an integrity check, runtime probe or assessment.\n'
    + 'It did not install dependencies, package, deploy, patch or restart the host.\n');
}

function argumentsOf(argv) {
  const options = { check: false, recordLocal: false, force: false, source: undefined };
  for (let index = 0; index < argv.length; index++) {
    const flag = argv[index];
    if (flag === '--check') options.check = true;
    else if (flag === '--record-local') options.recordLocal = true;
    else if (flag === '--force') options.force = true;
    else if (flag === '--source' && argv[index + 1] && !argv[index + 1].startsWith('--')) options.source = argv[++index];
    else throw new Error('Usage: node scripts/sync-assessment-engine.mjs --check [--source PATH] | --source PATH [--force] | --record-local');
  }
  if (options.recordLocal && (options.check || options.force || options.source)) throw new Error('--record-local cannot be combined with an import, --check or --force');
  if (!options.check && !options.source && !options.recordLocal) throw new Error('Source import requires an explicitly selected reviewed checkout; --check is fully offline.');
  if (options.check && options.force) throw new Error('--force cannot be used with --check');
  return options;
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  try {
    const options = argumentsOf(process.argv.slice(2));
    const result = options.recordLocal ? recordReviewedLocalAssessment() : options.check ? checkEmbeddedAssessment(REPOSITORY_ROOT, options.source)
      : synchronizeEmbeddedAssessment(options.source, { force: options.force });
    console.log(JSON.stringify(result));
  } catch (error) {
    console.error('Assessment source check/import failed: ' + error.message);
    process.exitCode = 1;
  }
}
