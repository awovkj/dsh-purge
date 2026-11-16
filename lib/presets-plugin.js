// Registers the bundled unrestricted, bounded SRC and pentest agent presets.
//
// DSH 0.1.7+ 的模式下拉只认 `agentPresets.register()`：把文件夹丢进
// `~/.dsh/.agent-presets/` 不会出现在下拉里（红队预设早期也踩过这个坑）。
// 所以这里和 lib/redteam/index.js 一样，等 registry 就绪后软注册一次，
// 卸载时释放。
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { readPresetDefinition, preparePresetTools } from "./redteam/preset-composition.js";
import { UNRESTRICTED_PRESET, bundledPresetDir, userPresetDir, installPreset } from "./presets.js";
import { findDshHome } from "./core.js";
import { withLegacyChildIds, migratePresetDefinition, backupPresetMigration } from "./preset-compat.js";
import { installAssessmentSkills, withSrcSkillTools } from "./redteam/assessment-skills.js";
import { withPresetDefaults } from './preset-defaults.js';
import { installPresetRegistration } from './preset-registration.js';
import { withModePersona } from './redteam/assessment-policy.js';

export const name = "dsh-purge-presets";
export const inject = [];

export const SRC_PRESET = 'src';
export const PENTEST_PRESET = 'pentest';

function presetDir(name = UNRESTRICTED_PRESET) {
  // 用户改过就用磁盘上那份，否则用包内模板。
  try {
    const user = userPresetDir(undefined, name);
    if (existsSync(join(user, "agent.cordis.yml")) || existsSync(join(user, "preset.yml"))) return user;
  } catch {
    /* 没有 DSH_HOME 时退回包内 */
  }
  return bundledPresetDir(name);
}

/** Last registration result per bundled preset; support can read this without the UI. */
function writePresetStatus(presetName, patch) {
  try {
    const file = join(findDshHome(), "dsh-purge-community", "preset-declare.json");
    mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
    let previous = {};
    try { previous = JSON.parse(readFileSync(file, "utf8")); } catch { /* first write */ }
    const all = previous && typeof previous === "object" && !Array.isArray(previous) ? previous : {};
    all[presetName] = { ...(all[presetName] || {}), ...patch, at: new Date().toISOString() };
    writeFileSync(file, JSON.stringify(all, null, 2) + "\n", "utf8");
  } catch {
    /* Diagnostics must never break preset registration. */
  }
}

export function apply(ctx) {
  return installPresetRegistration(ctx, {
    ids: [UNRESTRICTED_PRESET, SRC_PRESET, PENTEST_PRESET],
    status: writePresetStatus,
    async prepare(presetName, stage) {
      if (presetName === SRC_PRESET) installAssessmentSkills(findDshHome());
      try { installPreset({ name: presetName, force: false }); }
      catch (error) { ctx.logger?.warn?.('dsh-purge-presets: %s', error.message); }
      const dir = presetDir(presetName);
      const readDefinition = withModePersona(withPresetDefaults(withSrcSkillTools(readPresetDefinition(presetName, dir))));
      stage({ phase: 'loading-tools', id: presetName, name: readDefinition.name, plugins: readDefinition.plugins.length });
      const definition = await preparePresetTools(readDefinition, ctx);
      const migrated = migratePresetDefinition(definition, { stableChildIds: true });
      const backup = backupPresetMigration({ home: findDshHome(), dir, id: definition.id, policies: migrated.policies });
      if (backup) stage({ migration_backup: backup });
      return { definition, definitions: withLegacyChildIds(migrated, findDshHome()) };
    },
  });
}
