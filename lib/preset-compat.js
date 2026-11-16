import { removeTreeNoFollowSync } from "./remove-tree.js";
// Translate legacy child-tool policies to native child Agent Presets. The user's
// source YAML is deliberately retained: migration changes the registered
// composition, not their persona, comments, expressions or other settings.
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { pathToFileURL, fileURLToPath } from 'node:url';

const CONTROL = "@deepseek-ai/dsh-tool-subagent-control";

function integratedListAgents(source) {
  // New hosts register a locally defined tool from registerListAgents(ctx).
  // Inspect that actual, unconditional apply path; a comment/string or a
  // same-named helper call without its implementation is not evidence.
  let tree;
  try { tree = createRequire(import.meta.url)('acorn').parse(source, { ecmaVersion: 'latest', sourceType: 'module' }); }
  catch { return false; }
  const functions = new Map();
  for (const item of tree.body) {
    const node = item.type === 'ExportNamedDeclaration' ? item.declaration : item;
    if (node?.type === 'FunctionDeclaration') functions.set(node.id.name, node);
  }
  const toolNamed = node => node?.type === 'ObjectExpression' && node.properties.some(property =>
    property.type === 'Property' && !property.computed && (property.key.name || property.key.value) === 'name'
      && property.value.type === 'Literal' && property.value.value === 'list_agents');
  const toolValue = node => toolNamed(node) || node?.type === 'CallExpression'
    && node.callee.type === 'Identifier' && node.callee.name === 'defineTool' && toolNamed(node.arguments[0]);
  const inspect = (fn, visited = new Set()) => {
    if (!fn || visited.has(fn) || fn.params[0]?.type !== 'Identifier') return false;
    visited.add(fn);
    const parameter = fn.params[0].name, values = new Set();
    const call = node => {
      if (node?.type !== 'CallExpression') return false;
      const callee = node.callee;
      if (callee.type === 'MemberExpression' && !callee.computed && callee.property.name === 'register'
        && callee.object.type === 'MemberExpression' && !callee.object.computed && callee.object.property.name === 'tools'
        && callee.object.object.type === 'Identifier' && callee.object.object.name === parameter) {
        const argument = node.arguments[0];
        return toolValue(argument) || argument?.type === 'Identifier' && values.has(argument.name);
      }
      return callee.type === 'Identifier' && node.arguments[0]?.type === 'Identifier'
        && node.arguments[0].name === parameter && inspect(functions.get(callee.name), visited);
    };
    for (const statement of fn.body.body) {
      if (statement.type === 'VariableDeclaration') {
        for (const declaration of statement.declarations) {
          if (toolValue(declaration.init) && declaration.id.type === 'Identifier') values.add(declaration.id.name);
          if (call(declaration.init)) return true;
        }
      } else if (statement.type === 'ExpressionStatement' && call(statement.expression)) return true;
      else if (statement.type === 'ReturnStatement') return call(statement.argument);
    }
    return false;
  };
  return inspect(functions.get('apply'));
}

function removeIntegratedListAgents(definition) {
  const adapt = rows => {
    const control = rows.filter(row => row.name === CONTROL);
    const hasProvider = control.length === 1 && [undefined, false].includes(control[0].disabled)
      && Object.keys(control[0]).every(key => ["id", "name", "disabled"].includes(key));
    return rows.filter(row => !(hasProvider && row.name === CONTROL + "/list-agents"
      && row.id === "tool-subagent-list-agents" && [false, undefined].includes(row.disabled)
      && Object.keys(row).every(key => ["id", "name", "disabled"].includes(key))))
      .map(row => row.group === true ? { ...row, config: adapt(row.config) } : row);
  };
  return { ...definition, plugins: adapt(definition.plugins) };
}

// The 0.2.2-rc.1 host moved list_agents into control.apply(). Use only the
// launching profile's dependency tree. Unknown layouts retain native errors.
export function adaptListAgents(definition, installAnchor) {
  if (!installAnchor) return definition;
  const require = createRequire(installAnchor);
  try {
    require.resolve(CONTROL + "/list-agents");
    return definition;
  } catch (error) {
    if (!["ERR_PACKAGE_PATH_NOT_EXPORTED", "MODULE_NOT_FOUND"].includes(error.code)) return definition;
  }
  let manifest;
  try {
    manifest = require(CONTROL + "/package.json");
  } catch (error) {
    // An opaque package is not evidence that the tool moved. Let the
    // host resolve the original composition and report its own result.
    if (["ERR_PACKAGE_PATH_NOT_EXPORTED", "MODULE_NOT_FOUND"].includes(error.code)) return definition;
    throw error;
  }
  if (manifest.name !== CONTROL) return definition;
  let source;
  try { source = fs.readFileSync(require.resolve(CONTROL), "utf8"); } catch { return definition; }
  return integratedListAgents(source) ? removeIntegratedListAgents(definition) : definition;
}

/** The native Loader also resolves packages that are absent from profile/node_modules. */
export async function prepareListAgents(definition, ctx) {
  let usesLegacy = false;
  visit(definition.plugins, row => { if (row.name === CONTROL + "/list-agents") usesLegacy = true; });
  if (!usesLegacy) return definition;
  let loader, profile;
  try { loader = ctx.get?.("loader"); profile = ctx.get?.("profileContext"); } catch { /* older host */ }
  if (typeof loader?.internal?.import !== "function") return adaptListAgents(definition, profile?.installAnchor);
  const anchor = profile?.installAnchor || ctx.baseUrl;
  if (!anchor) return definition;
  let module;
  try { module = await loader.internal.import(CONTROL, String(anchor).startsWith('file:') ? anchor : pathToFileURL(anchor).href, {}); }
  catch (cause) {
    throw Object.assign(new Error(`${definition.id}: current host subagent control import failed: ${cause?.message || cause}`, { cause }),
      { code: "PRESET_CONTROL_IMPORT_FAILED" });
  }
  const apply = module?.apply || module?.default?.apply;
  if (typeof apply !== 'function') return definition;
  let source = Function.prototype.toString.call(apply);
  if (typeof loader.internal.resolve === 'function' || typeof loader.internal.resolveSync === 'function') {
    try {
      const baseUrl = String(anchor).startsWith('file:') ? anchor : pathToFileURL(anchor).href;
      let resolved;
      if (typeof loader.internal.resolve === 'function') resolved = await loader.internal.resolve(CONTROL, baseUrl, {});
      else if (typeof loader.internal.getOrCreateModuleJob === 'function' || loader.internal.version === 'v2') {
        resolved = loader.internal.resolveSync(baseUrl, { specifier: CONTROL, attributes: {} });
      } else if (typeof loader.internal.getModuleJobForImport === 'function' || loader.internal.version === 'v1') {
        resolved = loader.internal.resolveSync(CONTROL, baseUrl, {});
      }
      const url = typeof resolved === 'string' ? resolved : resolved?.url;
      if (typeof url === 'string' && url.startsWith('file:')) source = fs.readFileSync(fileURLToPath(url), 'utf8');
    } catch { /* An opaque source retains the old row and its native diagnostic. */ }
  }
  return integratedListAgents(source) ? removeIntegratedListAgents(definition) : definition;
}

const SUBAGENT = "@deepseek-ai/dsh-tool-subagent";
const TOOL_NAMES = new Map([
  ["@deepseek-ai/dsh-tool-workflow", "workflow"],
  ["@deepseek-ai/dsh-tool-ralph", "ralph"],
]);
const hash = (value) => createHash("sha256").update(value).digest("hex");

function toolName(row) {
  return row.name === SUBAGENT
    ? (row.config?.toolName ?? "subagent")
    : TOOL_NAMES.get(row.name);
}
function visit(rows, fn, parent = []) {
  for (const [i, row] of rows.entries()) {
    const at = [...parent, i];
    fn(row, at);
    if (row.group === true) visit(row.config, fn, [...at, "config"]);
  }
}
function rowAt(rows, at) {
  return at.reduce((value, key) => value[key], rows);
}

/** Build declarations without executing expressions or changing the input. */
export function migratePresetDefinition(definition, { stableChildIds = false } = {}) {
  const parent = structuredClone(definition);
  const policies = [];
  visit(parent.plugins, (row, at) => {
    if (row.name !== SUBAGENT || !Object.hasOwn(row.config ?? {}, "toolFilter"))
      return;
    const config = row.config;
    const filter = config.toolFilter;
    if (
      !["spawn", "fork"].includes(config.provider) ||
      config.agentPreset !== undefined ||
      config.allowedAgentPresets !== undefined
    )
      throw Error(
        `${definition.id}/${row.id}: legacy toolFilter requires an unambiguous spawn/fork provider; configuration retained`,
      );
    if (
      !filter ||
      Object.keys(filter).some((key) => key !== "deny") ||
      !Array.isArray(filter.deny) ||
      filter.deny.some((value) => typeof value !== "string" || !value) ||
      new Set(filter.deny).size !== filter.deny.length
    )
      throw Error(
        `${definition.id}/${row.id}: unsupported legacy toolFilter; configuration retained`,
      );
    const names = new Set();
    visit(parent.plugins, (item) => {
      const name = toolName(item);
      if (name) names.add(name);
    });
    const unknown = filter.deny.filter((name) => !names.has(name));
    if (unknown.length)
      throw Error(
        `${definition.id}/${row.id}: cannot preserve toolFilter for ${unknown.join(", ")}; configuration retained`,
      );
    const identity = stableChildIds ? { id: definition.id, deny: [...filter.deny].sort() } : { at, deny: filter.deny };
    const childId = `${definition.id}-child-${hash(JSON.stringify(identity)).slice(0, 10)}`;
    policies.push({
      at,
      childId,
      deny: [...filter.deny],
      rowId: row.id ?? at.join("."),
      provider: config.provider,
    });
  });
  // A child with another independently filtered spawn needs a policy graph,
  // not a guessed recursive reference. Refuse until that graph is supported.
  if (policies.length > 1 && policies.some(policy =>
    JSON.stringify([...policy.deny].sort()) !== JSON.stringify([...policies[0].deny].sort())))
    throw Error(
      `${definition.id}: multiple legacy child policies require explicit migration; configuration retained`,
    );
  if (!policies.length) return { definitions: [parent], policies };

  const policy = policies[0];
  for (const item of policies) item.childId = policy.childId;
  const child = structuredClone(parent);
  child.id = policy.childId;
  child.name = `${definition.name ?? definition.id} · 子任务`;
  child.description = `兼容子预设：继承父预设提示词和设置，排除 ${policy.deny.join("、")}。主会话请选择 ${definition.name ?? definition.id}。`;
  child.order = (definition.order ?? 20) + 0.1;
  // Keep the child's spawn/depth settings; omitting agentPreset there means
  // inheritance, and avoids a self-referential read during eager registration.
  for (const item of policies) delete rowAt(child.plugins, item.at).config.toolFilter;
  const filterRows = (rows) =>
    rows
      .filter((row) => !policy.deny.includes(toolName(row)))
      .map((row) => {
        if (row.group === true) row.config = filterRows(row.config);
        return row;
      });
  child.plugins = filterRows(child.plugins);
  for (const item of policies) {
    const config = rowAt(parent.plugins, item.at).config;
    delete config.toolFilter;
    // Fork inherits its parent's preset/history and rejects independent preset
    // selection. Its legacy filter is retained by a scoped dispatch guard.
    if (config.provider === 'spawn') config.agentPreset = child.id;
  }
  if (policies.some(item => item.provider === 'fork')) {
    const row = { id: `dsh-purge-child-policy-${hash(JSON.stringify(policy.deny)).slice(0, 10)}`,
      name: new URL('./preset-child-policy.js', import.meta.url).href, config: { deny: [...policy.deny] } };
    for (const definition of [parent, child]) {
      let collision = false;
      visit(definition.plugins, item => { if (item.id === row.id) collision = true; });
      if (collision) throw Error(`${definition.id}: inherited child policy id conflict; configuration retained`);
      definition.plugins.push(structuredClone(row));
    }
  }
  return { definitions: [child, parent], policies };
}

/** Immutable, content-addressed backup, made before registering the migration.
 * A pre-existing partial/corrupt backup is an error, never silently accepted.
 */
export function backupPresetMigration({ home, dir, id, policies }) {
  if (!policies.length) return undefined;
  if (!home)
    throw Error(
      "Preset migration requires a writable DSH_HOME backup directory",
    );
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(id))
    throw Error("Invalid preset id for migration backup");
  const files = ["agent.cordis.yml", "preset.yml"].map((name) => ({
    name,
    bytes: fs.readFileSync(path.join(dir, name)),
  }));
  const digest = hash(
    Buffer.concat(
      files.flatMap((file) => [Buffer.from(file.name + "\0"), file.bytes]),
    ),
  );
  const base = path.join(home, "dsh-purge-community", "preset-migrations");
  const target = path.join(base, `${id}-${digest.slice(0, 16)}`);
  const validate = () => {
    for (const file of files)
      if (!fs.readFileSync(path.join(target, file.name)).equals(file.bytes))
        throw Error(`Preset backup mismatch: ${file.name}`);
    const manifest = JSON.parse(
      fs.readFileSync(path.join(target, "manifest.json"), "utf8"),
    );
    if (manifest.digest !== digest)
      throw Error("Preset backup manifest mismatch");
  };
  if (fs.existsSync(target)) {
    validate();
    return target;
  }
  fs.mkdirSync(base, { recursive: true, mode: 0o700 });
  const staging = fs.mkdtempSync(path.join(base, ".staging-"));
  try {
    for (const file of files)
      fs.writeFileSync(path.join(staging, file.name), file.bytes, {
        mode: 0o600,
        flag: "wx",
      });
    fs.writeFileSync(
      path.join(staging, "manifest.json"),
      JSON.stringify(
        {
          schema: 1,
          id,
          digest,
          created: new Date().toISOString(),
          policies,
          files: files.map((file) => ({
            name: file.name,
            sha256: hash(file.bytes),
          })),
          sourceUnchanged: true,
        },
        null,
        2,
      ) + "\n",
      { mode: 0o600, flag: "wx" },
    );
    fs.renameSync(staging, target);
    validate();
  } finally {
    removeTreeNoFollowSync(staging);
  }
  return target;
}

// Only recover a historical ID when its original restriction set matches.
export function withLegacyChildIds(migration, home, warn = console.warn) {
  if (!migration.policies.length) return migration.definitions;
  const [child, parent] = migration.definitions;
  const policy = migration.policies[0];
  const prefix = parent.id + "-child-";
  const legacyId = ({ at, deny }) => prefix + hash(JSON.stringify({ at, deny })).slice(0, 10);
  const ids = new Set([legacyId(policy)]);
  const denied = JSON.stringify([...policy.deny].sort());
  const base = path.join(home, "dsh-purge-community", "preset-migrations");
  for (const entry of fs.readdirSync(base, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith(parent.id + "-")) continue;
    const suffix = entry.name.slice(parent.id.length + 1);
    if (!/^[a-f0-9]{16}$/.test(suffix)) continue;
    try {
      const dir = path.join(base, entry.name);
      const manifest = JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8"));
      const bytes = ["agent.cordis.yml", "preset.yml"].flatMap(name => [
        Buffer.from(name + "\0"), fs.readFileSync(path.join(dir, name)),
      ]);
      if (manifest.id !== parent.id || manifest.digest !== hash(Buffer.concat(bytes)) ||
          manifest.digest.slice(0, 16) !== suffix || !Array.isArray(manifest.policies))
        throw Error("invalid migration manifest");
      for (const old of manifest.policies) {
        if (Array.isArray(old?.at) && Array.isArray(old.deny) && old.childId === legacyId(old) &&
            JSON.stringify([...old.deny].sort()) === denied) ids.add(old.childId);
      }
    } catch (error) {
      warn(`Historical preset aliases skipped for ${entry.name}: ${error.message}`);
    }
  }
  ids.delete(child.id);
  const aliases = Array.from(ids, id => ({
    ...structuredClone(child), id,
    name: `${child.name}（历史兼容 · ${id.slice(prefix.length)}）`,
  }));
  return [child, ...aliases, parent];
}

// The loader composes the active profile before it activates the plugins.
// Restrict ownership to the same root Include used by DSH's config editor.
// Never inspect other profiles on disk or treat a Cordis row id as a preset id.
export function profileOwnsPreset(ctx, id) {
  const loader = ctx.get?.("loader");
  if (typeof loader?.entries !== "function") return false;
  for (const entry of loader.entries()) {
    if (entry.parent?.tree?.ctx?.fiber?.entry?.id !== "include") continue;
    if (entry.options?.name === "@deepseek-ai/dsh-agent-preset" &&
        entry.options.config?.id === id && !entry.disabled) return true;
  }
  return false;
}

/** Register helpers before their parent; unwind all declarations on failure. */
export async function registerPresetDefinitions(registry, definitions) {
  const releases = [];
  const dispose = async () => {
    // Parent must be gone before its helpers. Keep unfinished releases so a
    // disposal failure can be retried without losing ownership of the rows.
    while (releases.length) {
      await releases.at(-1)();
      releases.pop();
    }
  };
  try {
    for (const definition of definitions) {
      const release = await registry.register(definition);
      if (typeof release !== 'function') throw Object.assign(Error(`${definition.id}: registry did not provide a disposer`),
        { code: 'PRESET_DISPOSER_REQUIRED' });
      releases.push(release);
      // register() may succeed with a broken record. Do not equate its disposer
      // with successful activation. resolve() audits the actual Loader tree.
      if (typeof registry.resolve === "function") {
        const state = await registry.resolve(definition.id);
        if (!state) throw Object.assign(Error(`${definition.id}: registry did not confirm the declaration`),
          { code: "PRESET_REGISTRATION_UNCONFIRMED" });
        if (state.broken) throw Object.assign(Error(`${definition.id}: ${state.broken}`),
          { code: "PRESET_ACTIVATION_FAILED", preset_id: definition.id, broken: state.broken });
      } else throw Object.assign(Error(`${definition.id}: registry health cannot be confirmed`),
        { code: 'PRESET_REGISTRATION_UNCONFIRMED' });
    }
  } catch (error) {
    try { await dispose(); } catch (cleanupError) {
      error.cleanup_errors = [cleanupError];
      error.cleanup = dispose;
    }
    throw error;
  }
  return dispose;
}
