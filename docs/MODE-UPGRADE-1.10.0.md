# 三模式优化升级实施记录（1.10.0）

日期：2026-11-14。来源评审：仓库外《dsh-purge-三模式全面锐评-20261114.md》。先编写了 [完整方案](MODE-UPGRADE-1.10.0-PLAN.md)，再实施本次升级。保留工作副本中已有的 1.9.0 修改与历史材料。

当前源码为 dsh-purge-community 1.10.0；宿主补丁源码目标仍是 DSH Desktop 0.2.2-rc.1，随包 awa-ddd 上游仍为 2.2.0。DSH Desktop 0.2.2-rc.3 已通过专用 Electron 副本的预设 Loader 和空白 Agent 工具目录隔离验收；该结果不能代替正式安装、完整 GUI 或 86 条宿主补丁验收。

本轮测试使用临时 home、数据库、独立安装副本、实际 SDK/Python 进程和合成响应。没有调用模型、向真实目标发送请求、运行真实浏览器、发布/安装发行包、apply 或退出重启正式 DSH。用户提示词、设置、凭据、YAML 原文及其他插件没有被此次源码维护改写。

## 1. 三模式的最终区别

| 维度 | SRC | 渗透 | 红队 |
| --- | --- | --- | --- |
| 目标 | 可提交 SRC 的具体安全漏洞 | 完整安全测试、影响核验和修复交付 | 演练目标、资产、协作和成果 |
| 纯缺安全头、版本/banner、配置建议 | 拒绝写入漏洞表；历史项保留并排除分母 | hardening/informational 独立收录和计数 | 依任务收录，与漏洞及成果证明分开 |
| 真实低危漏洞 | 保留，与实际平台规则核对 | 保留 | 依当前任务记录 |
| 直接证据到位 | 停止该漏洞的主动请求，继续离线整理 | 继续满足当前前提的授权评估 | 依任务及实际控制继续 |
| 凭据 | 禁止获取/保存/读取入口 | 可使用本范围测试凭据句柄，验证实际主体 | 凭据句柄、实际身份与成果档位核验 |
| 调度 | 当前会话阶段稿 | 当前会话阶段稿 | 同靶标共享 lease，执行子会话为叶子 |
| 交付 | SRC 提交草稿、直接证据、停测和剩余 | 完整报告、配置建议、复现、恢复及覆盖 | 成果、证据、覆盖、剩余和停测汇总 |

保留三个独立入口，没有采用评审的合并 SRC/渗透建议：用户要求两种不同的发现和交付目标。共享核心继续使用，但收录策略、阶段、凭据能力、停止和报告契约独立定义。菜单顺序为 SRC、渗透、红队；既有会话的固定模式不随下拉选择改变。

## 2. 红队不显示：实际原因与修复

既有红队回执的错误为 `tool-subagent-list-agents (@deepseek-ai/dsh-tool-subagent-control/list-agents): never started`。在实际 rc.3 宿主源码中，`list_agents` 已由 control 主插件的 `apply` 无条件调用本地 helper 注册，旧子路径行会使整个预设 broken 并从模式列表过滤。

`preset-compat.js` 从当前 profile 的实际 Loader 解析主模块，兼容 Node 内部 Loader 的 v1/v2 `resolveSync` 签名。使用 AST 核实真实 helper 的登记路径，只有旧行与主行没有自定义配置冲突时，才在内存中移除冗余行；注释、条件分支、未知源码或未知宿主布局不作为兼容证明。

隔离实测还发现第二个真实阻塞：原 `toolFilter` 迁移给 fork 设置了 `agentPreset`，而 rc.3 的 fork 继承父历史/合成，不支持独立预设选择。现在 spawn 选择等价子预设；fork 保留 provider、历史、后台方式和 maxDepth，通过当前预设范围内的 `preset-child-policy.js` 在真实派发前执行相同 deny 集合。缺少 `tools.guard` 时注册失败，不能静默放开。fork 的工具目录仍可能呈现继承工具，派发守卫与红队叶子守卫拒绝禁止调用；没有把目录可见误写为能力可执行。

统一注册驱动串行注册与回收，按模式独立限制失败次数，核查 registry 的实际 broken 状态。服务代际改变时，即使 registry 仍为同一对象也先释放旧声明；卸载取消重试并回收迟到的注册，失败清理保留可重试的 ownership 和错误信息。用户原 YAML 原文不变。

## 3. 范围和停止贯通实际执行

工具名、存储操作和展示工具由 `mode-tools.js` 的显式清单提供。未知名字不能因前缀自动放行，红队不能调用 SRC/渗透专属报告返回空壳。

声明了 scope/exclude 的红队也使用持久会话/父子绑定和范围断言。范围外资产、关联目标、发现、凭据、截图、攻击链、隧道和 WebShell 写入被拒绝。通用 shell、任意代码、后台命令、文件写入及未知工具不能证明其目标范围，派发前拒绝；采用内置 typed 评估入口。没有用命令中的简单 URL 正则声称完整执行围栏。空范围历史红队保持兼容，不宣称具备目标围栏。

`source-stop.js` 统一来源停止匹配：保留 origin、端口和具体路径，支持编码等价、IPv6 与单段路由模板，忽略 query/fragment，拒绝歧义编码。换发现 id、改标题、标 fixed、改变引用或切预设不撤销停止；明确其他资源仍可按实际前提处理。

可信门面将本靶标不可编辑停止表同步为该评估工作区的固定 `dsh-source-stops.json`。原生 HTTP、preflight、身份验证和间接 recipe 在发送前检查来源与 native 停止；浏览器入口及每个子请求重新读取固定快照，后续并发停止同样生效。损坏快照零发送失败，不由模型提供快照路径。离线 `test.run mode:verify`、证据阅读、导入、复核和报告仍可使用。

相关 Python 文件保留上游哈希和 MIT，更新 bundled 哈希与 1.10.0 适配说明。没有搜索、选择或同步独立 awa-ddd 工程。

另外核实随包来源有已记录的 LF 与 CRLF 文件。Git 属性现在保留受管核心的原始字节，只有按 LF 生成的 browser.py 明确固定 LF；不统一改写上游字节或重新计算历史来源摘要，避免跨平台 checkout 产生伪漂移。三份界面生成文件也明确固定 LF，与构建检查比较的字节一致。

## 4. SRC 按漏洞提交流程发现和记录

固定指引为 [SRC 漏洞提交流程](SRC-SUBMISSION.md)，工具入口 `redteam_src_runbook resource:submission`。流程依次为实际项目规则与范围、具体安全假设、最小真实对照、查重、整理提交字段、操作者提交及平台复核。没有具体平台规则时保留缺项，不猜接收或奖励，也不自动提交。

新增 `finding_kind/category/src_eligible/submission_json` 兼容字段，类型与提交状态由代码计算。只改严重级、类别或影响不能将纯加固项转为漏洞。可信证明必须完整匹配当前发现命题；部分合格证明列表不能获得确认或“提交草稿完整”状态。

| 提交状态 | 含义 |
| --- | --- |
| security_candidate | 具体安全漏洞候选，仍需当前证据 |
| impact_review_required | 安全影响需要核实 |
| report_incomplete | 当前证明通过，提交材料未齐 |
| submission_ready | 当前证明及本地提交字段齐备，待操作者复核 |
| excluded_hardening | 历史配置/信息项，不进入 SRC 漏洞分母 |

submission 草稿包含 `program/policy_reference/policy_basis/prerequisites/expected_result/duplicate_check/duplicate_reference`；`reproduction/impact/remediation` 保存步骤、影响边界和修复建议。`checked_local` 只表示本地或已提供资料的查重，不能声称查过平台全库。所有输出保持 `submitted:false`、`platform_acceptance:not_assessed`。

`redteam_src_report` 保存 `reports/src-findings.md/.json`，包括完整有界草稿、可信观察、证明限制、候选、待复核标签、持久停止和未完成分母。长复现步骤保留换行，所有公开 proof/draft 字段统一脱敏，URL 查询值省略。报告每种产物上限 16 MiB，已确认标签/停止明细各上限 10,000，Markdown 上限 100,000 行；超限在写入前失败并保留旧报告。候选与待办每页最多 100，未展示项仍在分母。

## 5. 渗透报告和界面

渗透保留真实漏洞及独立 `recommendations`，严重级和确认统计只计算 vulnerability，配置建议单列。沿当前随包核心的 full draft 报告保留复现、影响、修复、实际覆盖和恢复/未完成项。

面板可编辑 SRC 提交草稿，显示当前证明与缺项；更新 proof 不覆盖尚未保存的草稿。快速重复保存只提交一次，切靶/卸载后迟到结果不写新页面。发现查询、状态更新和单条凭据复制同样使用代际隔离，防止 A→B→A 后复活旧回执。

修复了渗透测试凭据页签可点击但内容仍显示漏洞列表的问题。SRC 不读取凭据集合，渗透可以查看本范围测试句柄。

当前面板和兼容控制台从同一组件源生成，`build:client/check:client` 同时覆盖两份文件；历史 `scripts/build-client.mjs` 转发到新生成器，避免将陈旧控制台重新嵌入当前面板。

## 6. 策略、输出预算和分页

模式正文在 `assessment-policy.js` 集中维护，生成包内中文人设、技能政策段和 `MODE-POLICIES.md`。角色稿只补充阶段职责；注册时只移除已识别的生成政策副本，自定义与未知块保留。todo/pruner/present 共用样板，明确用户值和表达式不被默认值覆盖。

收尾时发现本轮整理的两份技能前缀有中文被写成问号，已恢复为 UTF-8 的实际流程与元数据；固定资源逐项读取核对。模式生成检查现在拒绝无效 UTF-8、缺失/错误技能名，以及描述中的损坏问号或替代字符，避免只检查政策段而漏掉技能说明。

红队 bootstrap 按实际完成步骤与压缩事件计数，不使用英文代词。两步配置不能被首响应提前短路；保留宿主更低的 maxTokens 与完整工作区说明。

导入、复核和交付返回签名 `page_token` 与可直接复用的 `next.arguments`。token 绑定服务生命周期、靶标、模式、流、页大小和 verify 语义，篡改、错流、错靶或与旧 offset 混传均拒绝。合并 token 分别推进得分、发现和停止流，耗尽流不再重复。旧 offset 继续兼容；界面优先使用下一页操作，指定位置放在恢复读取选项中。报告始终离线，不初始化或自动结项。

SRC/渗透没有增加通用外站 fetch 能力。平台规则与 CVE 参考按实际提供资料整理，额外网络资料仍需明确动作与范围契约；未将“通用 web 可用”伪称为范围内测试能力。

模式生成与来源核对加入现有 CI。面板格式检查保留文件已有换行约定，消除 Windows CRLF 检出导致的全量格式误报；实际格式修改限于本轮改动的五个源/测试文件。另外通过独立进程确认 Node 文件参数后的测试选项会成为测试文件参数，旧 Windows CI 的追加并发限制没有生效；现在默认 npm test 将 `--test-concurrency=2` 放在文件列表之前，CI 直接调用该入口。

## 7. 本轮验证与边界

实际宿主隔离命令：

```powershell
node scripts/check-mode-loader.mjs --host-root 'E:\app\deepseek'
```

使用只读的正式归档、复制的 Electron 可执行文件、临时 home/profile，Electron 44.7.0 / Node 24.21.0 / DSH 0.2.2-rc.3。四个预设均健康，SRC/渗透专属工具互相隔离，红队/无限制 `list_agents` 挂载成功；模型调用和真实目标请求均为 0。

本地回归覆盖真实 SDK 派发、实际 Python v1/v2 初始化/复核/停止、合成浏览器路由发送前拦截、来源证明、SRC 收录/提交、分页、注册/卸载、bootstrap 与界面异步状态。最终结果如下，补充回归与默认套件有重叠，不相加计算总数。

| 执行入口 | 本轮结果 |
| --- | --- |
| `npm test` | 691 项：661 通过、30 跳过、0 失败；默认运行器有效并发为 2 |
| `npm run test:ui` | 社区生成物/入口契约与 22 项界面交互回归全部通过 |
| `npm --prefix packages/purge-panel test` | 31 项测试及配套构建、交互、请求、回退和会话检查全部通过 |
| `npm --prefix packages/purge-panel run format:check` | 全部匹配文件通过；保留已有 LF/CRLF 约定 |
| `node --test test/presets.test.mjs test/preset-compat.test.mjs test/preset-registration.test.mjs` | 最终人设生成与技能修正后的 23 项补充回归全部通过 |
| `npm run check:docs` | 1.10.0 版本、中文 README 副本、固定安装 URL 和安装边界一致 |
| `npm run check:modes` | 人设、政策和技能生成一致；固定技能元数据与 UTF-8 检查通过 |
| `npm run check:assessment` | 80 个受管文件的来源核对通过：76 个 Python、3 个 JavaScript 和许可证；不需要外部 AWA |
| `npm run check:client` | 当前面板和兼容控制台两份生成物均与源代码一致 |
| `git diff --check` | 通过；受管原始 CRLF 以仓库属性明确识别，不改写来源字节 |
| 专用 Electron 的 `check-mode-loader` | rc.3 四个预设健康，SRC/渗透工具目录互相隔离，红队/无限制挂载 `list_agents`；模型与真实目标请求均为 0 |

测试使用 Node 24.21.0、Python 3.12.14。默认套件的 30 个跳过项为本机 Windows 不适用的 POSIX/macOS 场景及未提供对应显式隔离 Electron 运行时的专项交接验收，未计为通过。初次默认套件唯一失败是 TLS 测试没有指定本机非默认 Git 安装内的 OpenSSL；使用既有 `PURGE_TEST_OPENSSL_EXEC` 参数指定现有可执行文件后，该项与最终默认套件均通过，没有安装依赖或修改 PATH、系统源、代理。

本机默认回归环境：

```powershell
$env:PURGE_PYTHON = 'E:\app\deepseek\resources\runtime\primary-runtime\dependencies\python\python.exe'
$env:AWA_DDD_TEST_PYTHON = $env:PURGE_PYTHON
$env:PURGE_TEST_OPENSSL_EXEC = 'E:\app\Git\usr\bin\openssl.exe'
npm test
```

当前安装的七个固定 runbook 资源均已离线读取核对，中文与提交指引正常；两个临时 SRC 技能根的同步内容和相对引用也已核对。该检查 `requests_sent:0`，临时副本清理完成，没有写实际用户技能根。最终生成物包括主面板与兼容控制台 1.10.0、独立面板 1.1.2；独立面板版本未随主包擅自提升。

没有执行正式安装、完整 GUI 交互、86 条宿主补丁、真实身份/目标请求、真实浏览器、实际委派调度、发布或重启。1.10.0 发行 URL 待正式发布后才可使用；当前源码修复与正式实例升级是独立步骤。
