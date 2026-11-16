// The bundled `unrestricted` preset is a skeleton: it must stay a valid agent
// composition, install idempotently, and keep the anchors that patches #24 / #76
// are written against — otherwise installing it silently disables those patches.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { installPreset, presetStatus, bundledPresetDir, userPresetDir } from "../lib/presets.js";
import { readPresetDefinition } from "../lib/redteam/preset-composition.js";
import { ALL_PATCHES, applyReplacementsToText } from "../lib/core.js";
import { apply as applyPresetPlugin, PENTEST_PRESET, SRC_PRESET } from "../lib/presets-plugin.js";

const template = () => fs.readFileSync(path.join(bundledPresetDir(), "agent.cordis.yml"), "utf8");

test("the bundled preset is present and still matches the patch anchors", () => {
  const text = template();
  assert(text.length > 1000, "template should be a full composition, not a stub");
  assert(text.includes("- id: persona"), "persona row");
  assert(text.includes("@deepseek-ai/dsh-tool-bash"), "shell tool row");
  assert(text.includes("- id: tool-web"), "web tool row");
  // #24 flips preset fetch on; the anchor must exist or the patch silently skips.
  const fetchPatch = ALL_PATCHES.find((p) => p.id === 24);
  assert.equal(applyReplacementsToText(text, fetchPatch).changed, true, "#24 anchor");
  // #76 is optional for this preset: it must not mangle a preset that never used
  // the stock identity line.
  const stripPatch = ALL_PATCHES.find((p) => p.id === 76);
  assert.equal(applyReplacementsToText(text, stripPatch).changed, false, "#76 stays optional");
});

test("install is idempotent and never overwrites user edits without force", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "purge-preset-"));
  try {
    assert.equal(presetStatus(home).installed, false);
    const first = installPreset({ home });
    assert.equal(first.action, "installed");
    const file = path.join(first.dir, "agent.cordis.yml");
    assert(fs.existsSync(file));
    // 落盘时就合并了 #24：模板里的 fetch: false 会被打开
    const installed = fs.readFileSync(file, "utf8");
    assert(installed.includes("fetch: true"), "preset ships with web fetch enabled");
    // 精确断言：装完以后 #24 已无活可干（模板注释里提到 fetch: false 不算）
    assert.equal(
      applyReplacementsToText(installed, ALL_PATCHES.find((p) => p.id === 24)).changed,
      false,
      "no pending #24 anchor left behind",
    );

    fs.writeFileSync(file, "user edited\n");
    const second = installPreset({ home });
    assert.equal(second.action, "kept");
    assert.equal(fs.readFileSync(file, "utf8"), "user edited\n");

    const forced = installPreset({ home, force: true });
    assert.equal(forced.action, "updated");
    assert.equal(fs.readFileSync(file, "utf8"), installed);
    assert.equal(presetStatus(home).installed, true);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test("the bundled preset parses into a registry definition", () => {
  const def = readPresetDefinition("unrestricted", bundledPresetDir());
  assert.equal(def.id, "unrestricted");
  assert.equal(def.name, "无限制模式");
  assert.equal(def.order, 20);
  assert(Array.isArray(def.plugins), "plugins rows");
  assert(def.plugins.length >= 12, `expected a full composition, got ${def.plugins.length}`);
  const ids = def.plugins.map((row) => row && row.id).filter(Boolean);
  assert(ids.includes("persona"), "persona row kept");
  assert(!ids.includes("redteam-tools"), "red team rows stripped");
});

test("installed unrestricted preset preserves native skill discovery", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "purge-skill-roots-"));
  try {
    const { dir } = installPreset({ home });
    const def = readPresetDefinition("unrestricted", dir);
    const provider = def.plugins.find((row) => row.id === "skill-filesystem");
    assert(provider, "filesystem skill provider is registered");
    assert.equal(provider.config.includeDefaultRoots, true,
      "user-agents and project skills must remain discoverable after installation");
    assert.equal(provider.config.customSkillDirs, undefined,
      "the default DSH home root should not also be registered as a custom root");
    assert(def.plugins.some((row) => row.id === "tool-skill"), "skill loader remains available");
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test("legacy template markers and incomplete presets never authorize a reset", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "purge-preset-managed-"));
  try {
    installPreset({ home });
    const file = path.join(userPresetDir(home), "agent.cordis.yml");
    // Ownership markers often survive user edits.
    fs.writeFileSync(file, "# managed-by: dsh-purge\nold template\n");
    const updated = installPreset({ home });
    assert.equal(updated.action, "kept");
    assert.match(fs.readFileSync(file, "utf8"), /old template/);
    fs.unlinkSync(file);
    assert.equal(installPreset({ home }).action, "kept");
    assert.equal(fs.existsSync(file), false);
    fs.writeFileSync(file, "# my own preset\n");
    assert.equal(installPreset({ home }).action, "kept");
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test("the bundled pentest preset uses the bounded assessment tool plane", () => {
  const def = readPresetDefinition(PENTEST_PRESET, bundledPresetDir(PENTEST_PRESET));
  assert.equal(def.id, "pentest");
  assert.equal(def.name, "渗透模式");
  assert.equal(def.order, 11);

  const rows = def.plugins;
  const ids = rows.map((row) => row && row.id).filter(Boolean);
  assert.deepEqual(ids, [
    "persona",
    "time-context",
    "agent-instructions",
    "redteam-tools",
    "tool-todo",
    "tool-present",
    "compaction",
  ]);
  assert.equal(
    rows.find((row) => row.id === "redteam-tools").config.assessmentMode,
    "pentest",
  );
  assert.equal(
    rows.find((row) => row.id === "tool-todo").config.allowParallelInProgress,
    true,
  );

  const names = rows.map((row) => row.name);
  assert(!names.includes("@deepseek-ai/dsh-skill-filesystem"));
  assert(!names.includes("@deepseek-ai/dsh-tool-skill"));
  assert(!names.some((name) => /dsh-tool-(?:bash|pwsh|web|subagent|fs)/.test(name)));
  assert(!names.some((name) => /dsh-(?:workflow|tool-workflow|tool-ralph)/.test(name)));

  const persona = rows.find((row) => row.id === "persona").config.prefix;
  for (const contract of [
    "assessment_mode=pentest",
    "scope 必须非空",
    "exclude 必须明确",
    "随包的 awa-ddd 核心",
    "当前会话",
    "redteam_assessment_status",
    "redteam_assessment_status/start",
    "redteam_assessment_run",
    "redteam_assessment_import",
    "redteam_assessment_review",
    "redteam_pentest_report",
    "action.help",
    "当前机器",
    "保留分母",
    "checkpoint",
    "未核实项目",
    "文字陈述先作为候选",
    "报告只整理本地台账",
    "不适用 SRC 的直接证据停测规则",
    "不指定外部源码或工作区",
    "实际 JSON 结构",
  ]) {
    assert(persona.includes(contract), `pentest persona must state: ${contract}`);
  }
});

test("pentest installation keeps custom on-disk bytes", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "purge-pentest-preset-"));
  try {
    const first = installPreset({ home, name: PENTEST_PRESET });
    assert.equal(first.action, "installed");
    const agentFile = path.join(first.dir, "agent.cordis.yml");
    const metadataFile = path.join(first.dir, "preset.yml");
    const customAgent = fs.readFileSync(agentFile, "utf8") + "\n# user-owned pentest edit\n";
    const customMetadata = fs.readFileSync(metadataFile, "utf8") + "# user-owned metadata edit\n";
    fs.writeFileSync(agentFile, customAgent);
    fs.writeFileSync(metadataFile, customMetadata);

    const second = installPreset({ home, name: PENTEST_PRESET });
    assert.equal(second.action, "kept");
    assert.equal(fs.readFileSync(agentFile, "utf8"), customAgent);
    assert.equal(fs.readFileSync(metadataFile, "utf8"), customMetadata);
    assert.equal(presetStatus(home, PENTEST_PRESET).installed, true);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test("the running preset plugin registers pentest and releases every declaration", async (t) => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "purge-all-presets-"));
  const oldHome = process.env.DSH_HOME;
  process.env.DSH_HOME = home;
  const definitions = [];
  const released = [];
  const effects = [];
  const registry = {
    register: async (definition) => {
      definitions.push(definition);
      return () => released.push(definition.id);
    },
    resolve: async () => ({ broken: null }),
  };
  const ctx = {
    agentPresets: registry,
    get: () => undefined,
    logger: { info() {}, warn() {} },
    effect: (fn) => { effects.push(fn()); },
  };
  t.after(async () => {
    for (const effect of effects) await effect();
    if (oldHome === undefined) delete process.env.DSH_HOME;
    else process.env.DSH_HOME = oldHome;
    fs.rmSync(home, { recursive: true, force: true });
  });

  const installed = installPreset({ home, name: PENTEST_PRESET });
  const customAgentFile = path.join(installed.dir, "agent.cordis.yml");
  const customMetadataFile = path.join(installed.dir, "preset.yml");
  fs.appendFileSync(customAgentFile, "\n# user-owned pentest lifecycle edit\n");
  fs.appendFileSync(customMetadataFile, "# user-owned pentest metadata edit\n");
  const customAgent = fs.readFileSync(customAgentFile);
  const customMetadata = fs.readFileSync(customMetadataFile);

  applyPresetPlugin(ctx);
  for (let i = 0; i < 100 && !definitions.some((definition) => definition.id === PENTEST_PRESET); i += 1)
    await new Promise((resolve) => setImmediate(resolve));

  const parentIds = definitions
    .map((definition) => definition.id)
    .filter((id) => ["unrestricted", SRC_PRESET, PENTEST_PRESET].includes(id));
  assert.deepEqual(parentIds, ["unrestricted", SRC_PRESET, PENTEST_PRESET]);
  const pentest = definitions.find((definition) => definition.id === PENTEST_PRESET);
  assert.equal(pentest.name, "渗透模式");
  assert.equal(
    pentest.plugins.find((row) => row.id === "redteam-tools").config.assessmentMode,
    "pentest",
  );
  const status = JSON.parse(
    fs.readFileSync(path.join(home, "dsh-purge-community/preset-declare.json"), "utf8"),
  );
  assert.equal(status.pentest.ok, true);
  assert.equal(status.pentest.phase, "registered");
  assert.deepEqual(fs.readFileSync(customAgentFile), customAgent);
  assert.deepEqual(fs.readFileSync(customMetadataFile), customMetadata);

  for (const effect of effects.splice(0)) await effect();
  assert.equal(released.length, definitions.length);
  assert.equal(new Set(released).size, released.length);
});
