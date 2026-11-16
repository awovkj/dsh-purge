import { build } from "esbuild";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const community = process.argv.includes("--community");
const projectRoot = path.resolve(root, "../..");
const pkg = JSON.parse(
  await fs.readFile(
    path.join(community ? projectRoot : root, "package.json"),
    "utf8",
  ),
);
async function compile(entry, id) {
  const result = await build({
    absWorkingDir: root,
    entryPoints: [entry],
    bundle: true,
    write: false,
    platform: "browser",
    format: "cjs",
    target: "es2022",
    external: ["react", "react-dom"],
    treeShaking: true,
    legalComments: "inline",
    loader: { ".css": "text" },
    define: {
      __PANEL_VERSION__: JSON.stringify(pkg.version),
      __COMMUNITY__: JSON.stringify(community),
    },
  });
  const output =
    "// Generated from src/ by npm run build. Do not edit.\n" +
    "// Derived UI: YuJunZhiXue/dsh-purge (MIT), see LICENSE.\n" +
    "(()=>{const __PURGE_MODULE_URL__ = typeof document !== 'undefined' ? document.currentScript?.src : undefined;\n" +
    "window.__ModuleLoader__.load({id:" +
    JSON.stringify(id) +
    ",factory:(require)=>{\n" +
    "var module={exports:{}};var exports=module.exports;\n" +
    result.outputFiles[0].text +
    "\nreturn module.exports;\n}});})();\n";
  return output;
}
const targets = [
  {
    entry: "src/entry.js",
    id: pkg.name,
    dest: path.join(community ? projectRoot : root, "client.js"),
  },
];
if (community)
  targets.push({
    entry: "src/community/redteam-standalone.js",
    id: "dsh-purge",
    dest: path.join(projectRoot, "lib/redteam/client.js"),
  });
const outputs = await Promise.all(
  targets.map(async (target) => ({
    ...target,
    output: await compile(target.entry, target.id),
  })),
);
for (const { dest, output } of outputs) {
  if (process.argv.includes("--check")) {
    if ((await fs.readFile(dest, "utf8")) !== output)
      throw new Error(
        `${path.relative(projectRoot, dest)} is stale; run npm run build:client and commit the output.`,
      );
    console.log("PASS: checked-in bundle matches source");
  } else {
    await fs.writeFile(dest, output);
    console.log(
      `Built ${path.relative(projectRoot, dest)} @${pkg.version}: ${Buffer.byteLength(output)} bytes`,
    );
  }
}
