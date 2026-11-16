#!/usr/bin/env node
import { removeTreeNoFollowSync } from "../lib/remove-tree.js";
/**
 * 把一个靶标的得分报告导出成可移动的交付包：`<outDir>/<靶标>-红队成果复现报告.md` + `<outDir>/shots/`。
 *
 * 面板下载的 markdown 里，证据截图走绝对路径，发给别人会碎图。
 * 这里把 shots/ 一并拷到输出目录，markdown 用相对路径。
 *
 * 跑法：
 *   node scripts/export-engagement-report.mjs
 *   node scripts/export-engagement-report.mjs --out ~/交付/靶标名
 *   node scripts/export-engagement-report.mjs --engagement <id>
 *   node scripts/export-engagement-report.mjs --engagement <id> --delivery --out <目录>
 */
import { mkdirSync, writeFileSync, cpSync, rmSync, existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, relative, resolve } from "node:path";
import { RedteamStore } from "../lib/redteam/store-core.js";
import { buildAssessmentDeliveryReport } from "../lib/redteam/assessment-report.js";
import { buildPentestReport } from "../lib/redteam/pentest-report.js";
import { readAssessmentArtifact } from "../lib/redteam/assessment-artifacts.js";
import { assertNoLinkedDescendants } from "../lib/path-boundary.js";
import { atomicWriteSync } from "../lib/atomic-files.js";

const argv = process.argv.slice(2);
const argOf = (name, fallback) => {
  const i = argv.indexOf("--" + name);
  return i === -1 || argv[i + 1] === undefined ? fallback : argv[i + 1];
};

const root = process.env.REDTEAM_HOME || join(process.env.DSH_HOME || join(homedir(), ".dsh"), "redteam");
const store = new RedteamStore(root);
const id = argOf("engagement", store.activeEngagementId());
if (!id) {
  console.error("没有可用靶标：先用面板创建，或用 --engagement <id> 指定");
  process.exit(1);
}
const outDir = resolve(argOf("out", process.cwd()));
mkdirSync(outDir, { recursive: true });

if (argv.includes('--pentest') || !argv.includes('--delivery') && store.assessmentPolicy(id).assessment_mode === 'pentest') {
  try {
    if (argv.includes('--delivery')) throw new Error('--pentest 与 --delivery 分别导出完整报告和合并交付页，请一次选择一个');
    const result = await buildPentestReport(store, id, { save: false });
    const name = String(id).replace(/[<>:"/\\|?*\x00-\x1f]/g, '_');
    const native = result.report.native_report;
    const attachmentName = name + '-渗透测试附件';
    const attachments = assertNoLinkedDescendants(outDir, join(outDir, attachmentName));
    const prepared = [];
    let totalBytes = 0;
    if (native.state === 'generated') {
      if (!Array.isArray(native.files) || native.files.length > 2000) throw new Error('内置报告附件超过导出预算，请保留原报告单独导出');
      for (const file of native.files) {
        const source = assertNoLinkedDescendants(dirname(native.path), resolve(dirname(native.path), file.path));
        const artifact = readAssessmentArtifact(store, id, source, file.sha256, { maxBytes: 16 * 1024 * 1024 });
        totalBytes += artifact.bytes.length;
        if (totalBytes > 64 * 1024 * 1024) throw new Error('完整附件超过64 MiB导出预算，请保留原报告单独导出');
        prepared.push({ target: assertNoLinkedDescendants(attachments, resolve(attachments, file.path)), bytes: artifact.bytes });
      }
    }
    for (const artifact of prepared) atomicWriteSync(artifact.target, artifact.bytes, 'utf8', { mode: 0o600 });
    let markdown = result.markdown;
    if (native.path) {
      const originalPrefix = relative(join(store.dirOf(id), 'reports'), dirname(native.path)).replaceAll('\\', '/') + '/';
      markdown = markdown.split(originalPrefix).join(attachmentName + '/');
      markdown = markdown.split(dirname(native.path)).join(attachmentName);
      for (const field of ['path', 'summary_path', 'manifest_path']) if (native[field]) native[field] = attachmentName + '/' + basename(native[field]);
    }
    result.report.export_artifacts = { relative_root: native.path ? attachmentName : null, files: prepared.length, bytes: totalBytes };
    const markdownPath = assertNoLinkedDescendants(outDir, join(outDir, name + '-渗透测试报告.md'));
    const jsonPath = assertNoLinkedDescendants(outDir, join(outDir, name + '-渗透测试报告.json'));
    atomicWriteSync(markdownPath, markdown, 'utf8', { mode: 0o600 });
    atomicWriteSync(jsonPath, JSON.stringify(result.report, null, 2) + '\n', 'utf8', { mode: 0o600 });
    console.log('报告：' + markdownPath);
    console.log('快照：' + jsonPath + ' · 覆盖状态 ' + result.report.assessment.state);
    console.log('附件：' + prepared.length + ' 个文件；报告未发送目标请求');
  } finally { store.close(); }
  process.exit(0);
}

if (argv.includes('--delivery')) {
  try {
    const report = await buildAssessmentDeliveryReport(store, id, { save: false });
    const name = String(id).replace(/[<>:"/\\|?*\x00-\x1f]/g, '_');
    const markdownPath = join(outDir, name + '-评估交付报告.md');
    const jsonPath = join(outDir, name + '-评估交付报告.json');
    const { markdown, path: reportPath, snapshot_path, ...snapshot } = report;
    writeFileSync(markdownPath, markdown, 'utf8');
    writeFileSync(jsonPath, JSON.stringify(snapshot, null, 2) + '\n', 'utf8');
    console.log('报告：' + markdownPath);
    console.log('快照：' + jsonPath + ' · 覆盖状态 ' + report.assessment.state);
  } finally { store.close(); }
  process.exit(0);
}

const shotsSrc = join(root, "engagements", id, "shots");
const shotsDst = join(outDir, "shots");
if (existsSync(shotsSrc)) {
  removeTreeNoFollowSync(shotsDst);
  cpSync(shotsSrc, shotsDst, { recursive: true });
}

const rep = store.scoreReport(id, { shotRef: "relative" });
const name = String(rep.target || id).replace(/[/\\:*?"<>|]/g, "_");
const outFile = join(outDir, name + "-红队成果复现报告.md");
writeFileSync(outFile, rep.markdown, "utf8");
store.close();

const imgs = (rep.markdown.match(/!\[[^\]]*\]\([^)]+\)/g) || []).length;
console.log("✓ 报告：" + outFile);
console.log("  合计 " + rep.summary.points + " 分 · " + rep.items.length + " 条正文 · 嵌入截图 " + imgs + " 张"
  + (existsSync(shotsDst) ? "（shots/ " + readdirSync(shotsDst).length + " 个文件，随报告一起拷走即可）" : ""));
