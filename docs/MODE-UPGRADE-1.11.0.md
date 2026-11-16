# 1.11.0 实施与验证

输入与计划：2026-11-14。源码收拢与隔离回归：2026-11-14 至 15。当前工作区升级为 `dsh-purge-community` 1.11.0。本轮开始时已经存在大量 1.10.0 未提交工作，继续保留；这些历史改动不全部计入本轮成果。

## 对照分析与实际选择

读取本机 Pojun 0.4.70 和 dsh-purge，结合《Pojun优点融入dsh-purge分析-20261114》《Pojun-vs-dsh-purge-三模式深度锐评-20261114》。逐项处置见 [升级方案](MODE-UPGRADE-1.11.0-PLAN.md)。Pojun 使用 AGPLv3，仅借鉴机制；本轮源码和八篇专题独立编写，不复制其代码、脚本或技能全文。本项目 MIT 与随包 awa-ddd 2.2.0 版权/来源清单保留。

已有 continuation 的真实材料去重、最多三次提醒，已有模式政策生成和渗透独立阶段继续使用。新增能力接在现有 typed 门面，不新增任意 shell/文件执行或模型自授证明。不采用 shell 正则“找不到目标即放行”、LLM 兜底裁判、自动深度利用或远程情报同步。

## 交付能力

| 能力 | 主要源码 | 可见结果 |
| --- | --- | --- |
| 当前证据差分 | `evidence-diff.js` | 两个完整 E-ID 的结构/文本差异、明确忽略项、来源摘要、脱敏分页 |
| sourcemap 发现 | `sourcemap-discovery.js` | 真实 inline/external map 离线解析，固定哈希源码目录、来源 manifest 和有界提示 |
| 批量采集 | `assessment-batch.js` / `awa-integration.js` | 1–20 项明确只读请求，逐项 guard 与原生幂等；保留 index/E-ID/run，未知/不完整/取消停止 |
| 本地材料 | `assessment-workspace.js` | 三个固定目录，完整脱敏后分页、明确缺失/省略，链接/凭据/任意路径拒绝 |
| 离线情报 | `vulnerability-intel.js` | 本地 NVD/KEV/GHSA 导入、源哈希、结构化版本候选、KEV/CWE 关联，完整缓存校验 |
| 技能导航 | `skill-catalog.js` / `skills.js` / 专题 | 实际消费 cwe/class/requires，模式限制显式展示，未核实的运行前提保留 unknown |
| 工作反馈 | `failure-attribution.js` / `workflow-advisor.js` | typed 失败类别、每类三样本、当前 proof/停止驱动的离线建议 |
| 分页与调度 | `page-token.js` / report/UI/tools / `agent-scheduler.js` | stop_offset 独立；没有可信未开始回执的派发失败保留 lease |
| 共享政策与生成物 | `role-prompts.js` / `assessment-policy.js` / 构建脚本 | 三模式证据契约共享、原生技能固定枚举、模式/技能/政策和面板同步 |

发现、情报和本地读取仅提供候选或未经核实的材料，回执不授予漏洞确认或安全覆盖。模型文本不能登记 observed；确认继续依赖当前靶标的固定 collector 和精确 native proof。SRC 停测、模式持久绑定、身份/fixture/变更约束和严重级上限保留。

## 回归期间修复的具体缺陷

- `workspace.read` 原复用 reportBlock 会在 128 KiB 后省略全文；改为独立 1 MiB 文件预算，完整脱敏后字符分页并保留换行。带引号的自定义认证值、JWT、已知秘密及没有 END 标记的私钥都在分页前处理。包含秘密的文件名直接省略/拒绝，防止返回改写后不可读的路径。
- 离线情报缓存原只检查 schema/source/identifiers，缺少 components/cwes/ranges 时会触发 TypeError；改为完整元数据模式校验，坏缓存和导入不覆盖原字节。GHSA 对象形式 first_patched_version 保留 identifier，复杂/转义 CPE 和逻辑保持 unknown，已知秘密不进入公开缓存。
- 原生重复预检返回 already_preflighted，初版批量入口会误拒绝已成功的同键请求；改为仅沿精确原生恢复契约、核实实际方法，再调用重检全部前提的 capture。隔离核心回归核对同键返回原 E-ID 且没有新合成 transport 调用。
- 失败归因使用真实 typed code/status，范围排除错误显式带 `ASSESSMENT_SCOPE` 与当前零发送回执；未知历史 run 和缺少派发终态不能作为新执行授权。
- 工作建议不再用 operation_id 猜测 v1 obligation 契约，缺精确关联时只返回当前模型的 action.help。SRC 停止采用同一 sourceStopMatches；同目标查询变体仍停止。
- 无 token 页原把 stop_offset 取自 finding_offset，已独立恢复并贯通报告/工具/API。工具体错误可能被宿主转成普通 isError 回执，缺少可信 no-start 不再释放实际委派占位。
- 整仓首次回归发现 sourcemap 静态导入 Acorn 影响缺件的隔离安装初始化；改为实际 JavaScript 注释分析时才加载当前安装的解析器，缺件返回 typed 受阻，不扫描其他安装或自动补依赖。

## 验证记录

本地验证使用临时目录、SQLite 台账、合成证据与响应。实际随包 Python 核心在禁止 socket 的 fixture 中运行；junction/hardlink 用测试目录验证，正式 profile 没有被修改。环境为 Node **24.21.0**、现有 Desktop 自带 Python **3.12.14**，没有安装依赖。

| 实际命令或检查 | 结果 |
| --- | --- |
| `npm test` | **747 项：717 通过、0 失败、30 跳过、0 取消**；退出码 0，263,018.2005 ms |
| 七份新增发现与反馈测试，已纳入 `npm test` | 56 项通过：证据发现 16、批量门面 7、本地材料/情报 11、技能导航 9、工作建议/分页/调度 13；这些数字属于整仓结果的子集 |
| `node --test test/redteam-evidence-discovery.test.mjs` | 最后补充隔离基础门面导入断言后，证据专项 **16/16 通过、0 跳过** |
| `npm run test:ui` | 面板社区 bundle 契约通过，UI 分页测试 **24/24 通过** |
| `npm run check:docs` | 1.11.0 版本、发布说明与文档一致 |
| `npm run check:modes` | `changed:[]`；预设、人设、技能与模式政策生成物一致 |
| `npm run check:client` | 根面板与红队面板两份社区 bundle 都与源码一致 |
| `node packages/purge-panel/scripts/build.mjs --check` | 独立面板 bundle 与源码一致；独立面板版本仍为 1.1.2 |
| `npm run check:assessment` | 随包 awa-ddd 2.2.0 来源核对通过，80 文件（76 Python、3 JavaScript） |
| `git diff --check` | 通过；已有 LF/CRLF 工作区提示没有构成差分错误 |

30 项跳过中，27 项依赖 POSIX/Linux/macOS 的权限、链接或启动环境；2 项需要明确的 Windows Electron 测试可执行文件，本轮没有提供或启动；1 项旧 TLS 代理用例直接从 PATH 调用 `openssl`，当前入口不可用且未提供 `PURGE_TEST_TLS_DIR`。这些跳过不计为通过，也不授予对应宿主或 TLS 运行验收。

首次完整回归为 746 项、711 通过、5 失败、30 跳过；五处均由新增 Sourcemap 模块的顶层 Acorn 导入导致隔离安装初始化失败。修复动态加载后增加缺解析器回归，覆盖隔离基础评估门面导入、直接 JSON map 可用，以及 JavaScript 分析明确 `ASSESSMENT_SOURCEMAP_PARSER`/零请求。随后一次执行随会话中断，未产生最终统计；上表采用 2026-11-15 恢复后的完整成功执行，不把中断日志计为通过。

最终整仓日志位于本机临时目录 `dsh-purge-1.11.0-npm-test-20261115-resume.log`，同名 `.exit-code` 文件为 0。随包来源 SHA256 为 `881cbc6a6d7463e29832524bce6a81f043517e8f1fef9c665304c37aad6cfa05`；本轮没有同步或修改随包来源源码。两份社区生成物为 1.11.0，独立面板 1.1.2 的生成物也完成更新。

## 未验收与部署边界

没有打包发行 TGZ、发布、安装、apply、退出或重启正式 DSH，没有改写用户提示词/配置、独立 Pojun 或独立 AWA 工程。没有访问真实目标、下载情报/工具、运行真实浏览器或新增实际委派调度验收。

86 条宿主补丁源码目标继续为 DSH Desktop 0.2.2-rc.1。1.10.0 的 rc.3 专用 Electron Loader 和空白 Agent 工具目录结果保留在 [原实施记录](MODE-UPGRADE-1.10.0.md)，不是本版新增 GUI 验收。整版 GUI、真实补丁、目标、浏览器与宿主实际调度仍需对应环境验证。1.11.0 固定下载 URL 只供未来正式发布后使用，独立面板包版本未另行发布。

准确参数和预算见 [发现动作指南](DISCOVERY-WORKFLOW.md)，三模式总体规则见 [REDTEAM-AWA-SRC](REDTEAM-AWA-SRC.md)、[SRC 提交](SRC-SUBMISSION.md) 和 [渗透模式](PENTEST.md)。
