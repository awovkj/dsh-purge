// Local identity of the running plugin copy: no network, no channel, no update
// state. `runningVersion()` is captured once at module evaluation, so it reports
// the code this process actually loaded, not what is currently on disk.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { installedCommunityPackage } from "./installed-package.js";
import { resolveProfile } from "./instance.js";
import { findDshHome } from "./core.js";

export const PLUGIN_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function pluginRoot() {
  return PLUGIN_ROOT;
}

export function localVersion() {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(PLUGIN_ROOT, "package.json"), "utf8"));
    return String(pkg.version || "");
  } catch {
    return "";
  }
}

const LOADED_VERSION = localVersion();

export function runningVersion() {
  return LOADED_VERSION;
}

export function installedVersion(home = findDshHome()) {
  const profile = resolveProfile(home).directory;
  return installedCommunityPackage(profile).package.version;
}
