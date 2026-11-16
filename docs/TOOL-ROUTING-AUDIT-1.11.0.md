# Playwright / Yakit / TscanPlus / WSL：调用与按需选工具专项审查

日期：2026-11-15。基线：当前工作区 1.11.0 与随包 awa-ddd 2.2.0。本文补充 [三模式源码锐评](THREE-MODE-AUDIT-1.11.0.md)。源码里的名称是 **TscanPlus / tscanplus**，不是 tsanplus。

**结论：不能认定当前项目能充分、稳定、按需有效调用这些工具。不仅有执行和参数问题，能力回执、场景选择、结果闭环也没有贯通。Playwright 部分场景有方法指引，但 Yakit / TscanPlus 更依赖模型主动查帮助；没有证据证明 AI 的按需选工具召回已经达标。**

用户要求的不是“程序找到了 exe”，而是完整五层：

| 层次 | 应证明的事实 | 当前审查状态 |
| --- | --- | --- |
| 可发现 | 模型能知道工具的用途、模式和入口 | 部分存在；顶层评估工具说明与技能对 Yakit / TscanPlus 的提示不足 |
| 会选择 | 有需求时选择正确 provider / profile，不需要时不乱用 | 缺完整场景路由；本轮未跑真实模型选择基准 |
| 会调用 | 参数、后端、身份、路径、协议正确 | 已复现 readiness、WSL 包装动作和 Yakit 协议问题 |
| 真执行 | 对应本机 / WSL 工具或浏览器真正运行并返回事实 | 本轮没有真实工具运行验收，文件和历史回执不能代替 |
| 能闭环 | 结果进入发现、控制、当前证明和剩余工作 | v2 浏览器判据接口断接；多个手动工具入口不进入自动配方闭环 |

## 1. 四类工具实际接入到了哪里

| 工具 | 已有调用路径 | 实际能力边界 | AI 按需选择的不足 |
| --- | --- | --- | --- |
| Playwright | `redteam_assessment_run` → `browser.probe/visit` 或 `test.run_browser` → 包内 Python → Node Playwright | 真实受控页面观察、导航和部分 UI 操作；不是任意 JS / 上传入口；身份、fixture、scope 和 SRC 停止仍生效 | browser 专题能提示 DOM/UI 需求，但没有普遍的场景 → 可执行配方；成功 probe 不进入当前能力快照，v2 XSS 判据又断接 |
| Yakit | `tool.probe adapter:yakit` → 本机 / 当前后端的 `yak` MCP stdio → `tool.yakit_replay` 或 `test.run_external` | 当前主要是公开 HTTP GET 单包重放；没有通用扫描、PoC、认证重放或任意 Yak 脚本调用 | 握手成功被当成 profile ready；技能 / 预设没有明确工具专用路由，主要靠 `action.help` 自行发现 |
| TscanPlus | `tool.probe adapter:tscanplus` → loopback Streamable HTTP MCP → results / summary / routes / bounded request | 能读既有结果、摘要、路由候选和有界请求；不是完整扫描 / PoC / 爆破 / JWT 功能；POST 需实际 fixture | 配置与读取成功仍显示 unconfigured；不被 `test.run_external` 支持，也不被普通自动配方主动选中 |
| WSL / Kali | 平台工具定位桥与固定评估后端两条路径 | 是运行环境，不是一个能自动解决安全测试的万能工具；Linux 命令、Python、Node、浏览器与控制服务分别有前提 | 两套配置分离；工具定位不等于模式允许调用；包装动作路径漏转换，后端 / loopback 拓扑没有统一就绪判断 |

不能把上述窄 profile 当成整个工具的全部功能，也不能把窄 profile 的限制都说成 bug。真正的缺陷是：产品没有把“实现了什么、什么时候该用、现在能否用、用完如何推进”可靠地交给 AI。

## 2. 已复现的调用链问题

### R-01 · P1：v2 浏览器 XSS 判据的字段契约对不上

`evaluate_xss()` 实际生成的观察字段包括 `application_triggered`、`attack_dialog`、`normal_dialog`、`same_identity`。

但 `browser_runtime` 的前置 requires 要求 `application_triggered_dialog`、`attack_controls`、`normal_control_no_dialog`、`same_identity_control_group`。调用没有传入第三个 controls 参数，也没有生成这四个字段，通用缺项检查先返回 inconclusive；其后真正的判定分支又使用旧字段名。

代码：`lib/redteam/assessment-engine/awa_ddd/execution/browser_provider.py:19`；`lib/redteam/assessment-engine/awa_ddd/execution/oracle_profiles.py:108`；`lib/redteam/assessment-engine/awa_ddd/execution/oracle_profiles.py:159`；`lib/redteam/assessment-engine/awa_ddd/execution/oracle_profiles.py:220`。

本轮给出模拟的本地浏览器成功观察：应用触发 marker 弹窗、正常控制无弹窗、同身份、消费页和内容版本均有值。真实原生 handler 仍返回这四项 missing、inconclusive，未创建 v2 finding 或 v2 run。门面后续为 `remaining_work → campaign.status`。

**即使 AI 想到并调用 Playwright，这条 v2 XSS 评估入口也不能按当前契约闭环。** 这是接口错误，不是浏览器未安装。它不代表 `browser.visit`、v1 浏览器路径或所有 Playwright 操作都不能用。

修复必须统一共享观察 schema、producer、requires 和判定分支，并把真实浏览器控制绑定到 v2 run / hypothesis / finding；不能让模型自行补四个 true，也不能把 inconclusive 强行改为 supported。

### R-02 · P1：能力表同时存在假 ready 和假 unavailable

代码：`lib/redteam/assessment-engine/awa_ddd/execution/capabilities.py:55`；探测写入路径见 `lib/redteam/assessment-engine/awa_ddd/external.py:364`、`lib/redteam/assessment-engine/awa_ddd/tscanplus.py:279`、`lib/redteam/assessment-engine/awa_ddd/__main__.py:117`。

隔离结果：

- 模拟 Playwright probe 成功，能力快照仍 `ready:false`、`catalog_verified:false`，继续要求 runtime probe 和 host MCP catalogue。native 页面观察不该无条件依赖可选 host MCP。
- 模拟 Yak MCP 只广告 `codec`，没有 HTTP fuzzer，能力表仍 `ready:true`；实际 replay 失败 `mcp_capability`，没有派发 MCP tool call。
- TscanPlus probe 保存配置且 summary profile 调用成功，能力表仍 `configured:false/ready:false`，原因仍是 unconfigured / loopback_mcp_required。
- `ready_for(public_get_replay, method:POST)` 仍可返回 true；method 参数没有参与 profile 判断。实际 GET 限制没有被绕过，错的是就绪信号。

`capabilities.record()` 没有查到包内生产调用，`ready_for()` 也没有被当前自动配方消费。`multi_role_xss` 的独立上下文原因被无条件追加，当前接口没有补齐后解除该原因的路径。

**给 AI 错的能力信号，谈“需要时会想到调用”没有意义：能用的它可能一直避开，不能用的它又被鼓励尝试。** 就绪必须按真实 probe、具体 profile、身份 / 方法 / 效果与当前代际计算，不从“工具握手成功”推导全部能力。

### R-03 · P1：Yakit schema 未提供 TLS 控制时，HTTP / HTTPS 参数会相同

当前重放只在广告 schema 包含 `isHttps/is_https/https` 时设置 TLS 标记；必需检查只强制 redirect 和 fuzzTag 控制。

代码：`lib/redteam/assessment-engine/awa_ddd/external.py:695`。

隔离 MCP schema 提供 request、noFollowRedirect、fuzzTagMode，不提供 TLS 字段，仍被接受。相同 host / path 的 HTTP 与 HTTPS operation 最终提交完全相同的 MCP 参数，两个模拟调用均标 succeeded。

这是**协议信息丢失**的证据，不是本轮真实 Yak 请求成功。raw HTTP 报文本身不能区分同 host / path 的 HTTP 和 HTTPS；不能依赖未核实的工具默认值或自动探测。

修复应验证受支持的、类型明确的 TLS 控制，或明确把该 schema 限定为可证明的协议 profile；缺前提时拒绝 / blocked，不偷偷按另一协议执行。

### R-04 · P1：WSL 只转换直达动作，漏掉部分 v2 包装动作

代码：`lib/redteam/assessment-engine/awa_ddd/runtime.py:37`；`lib/redteam/assessment-engine/awa_ddd/runtime.py:214`；WSL worker 入口见 `lib/redteam/assessment-engine/awa_ddd/wsl_runner.py:160`。

隔离结果：

- `scenario.run` 能转换 step.body_file；`test.run_scenario` 的同一字段原样保留 Windows 路径。
- `tool.sqlmap` 能转换 sqlmap_path；`test.run_external` 的同一字段不转换。

包装后的 handler 最终仍消费这些路径。在 WSL 后端，Windows 绝对路径可能被当作错误的 Linux 路径而拒绝 / 失败。使用纯 Linux 或相对受控路径的调用不一定受影响；本例没启动真实 WSL。

应按共享 action 参数契约覆盖直达与包装入口，只转换明确路径字段，不能对任意字符串、URL、Cookie 或请求正文做全局替换。

## 3. “AI 需要时会想到”到底缺什么

### R-05 · P1：工具选择主要靠模型自行联想，没有完整需求路由

现有 browser runbook 明确提到 DOM/XSS、跨站和 UI 需要真实浏览器，这不是“完全没有指引”。但从实际接口和当前控制状态到可执行工具调用，仍有断层：

- 顶层 `redteam_assessment_run` 描述主要列 HTTP、证据、发现、情报和本地材料，没有明确提 Playwright / Yakit / TscanPlus 或对应执行动作。
- 当前 `skills/` 与 `presets/` 检索未发现 Yakit / TscanPlus 专用名称。它们仍可从原生 `action.help` 目录被发现，但依赖模型主动探索。
- `automatic_provider()` 只选择 native_http_controls；不会因 XSS 自动选 Playwright，也不会因已有扫描结果自动选 TscanPlus。
- `assessmentWorkflow()` 主要围绕身份、campaign.next、通用测试和复核；没有通用的“需求 / 当前证据 → provider / profile / 参数准备”分支。
- `workflow.advice` 是离线证明 / 候选整理器，不是工具规划器；不能把其名称当作已经有智能工具路由。
- 公共 `skill.index` 没消费实际工具注册与已验证 runtime 状态，browser 等执行前提持续 unknown。

代码：`lib/redteam/tools.js:2379`；`lib/redteam/assessment-engine/awa_ddd/execution/recipe_builder.py:91`；`lib/redteam/assessment-workflow.js:6`；`lib/redteam/workflow-advisor.js:27`；`lib/redteam/assessment-local-actions.js:31`。已有浏览器方法见 `skills/src-discovery/references/browser.md:10`。

**不能据此断言模型永远不会选工具；也不能只因某次主动查 help 就宣称按需选择可靠。** 必须给出可消费的场景路由，并用真实模型调用记录测量，而不是猜模型脑子里“应该想到了”。

### R-06 · P2：Yakit / TscanPlus 接入是窄适配器，不是整套工具调用

当前 Yakit 启动的是 `yak mcp` 引擎，不是操作 Yakit GUI。即使加载组包含 httpflow / codec，公共适配器也没有普遍开放这些工具；当前 replay 是 public GET，认证重放会被拒绝。

TscanPlus 有严格的 endpoint、catalogue、namespace 和 schema 验证，这是应保留的正确边界。但读取 pwdcrack / poccheck 等表不等于运行破解或 PoC；路由候选不等于执行路由。`test.run_external` 只接受 sqlmap / yakit，TscanPlus 使用独立动作。

代码：`lib/redteam/assessment-engine/awa_ddd/external.py:246`；`lib/redteam/assessment-engine/awa_ddd/execution/external_provider.py:61`；`lib/redteam/assessment-engine/awa_ddd/tscanplus.py:187`；`lib/redteam/assessment-engine/awa_ddd/execution/capabilities.py:14`。

要增加工具利用率，应扩充经过审查的 typed profile 与闭环，而不是让模型把任意 MCP 参数透传出去。当前未实现的功能必须明确标 unsupported，不能用更多调用次数掩盖。

### R-07 · P2：WSL / Kali 的环境展示和评估后端不是同一条链

- 平台适配配置来自 `redteam/config.json`；内置评估后端来自 `redteam/settings.json` 的 awa 字段。平台显示 WSL Kali 不等于评估已经选用同一个 WSL 后端。
- Windows 下显式配置 Linux 工具路径先经过 Windows existsSync 检查；本轮配置一个不存在的 Linux 路径后直接 missing，WSL 解析调用为 0。正确做法是 backend-aware Linux 路径字段，而不是把它当 Windows 路径或静默换工具。
- 评估 WSL 使用固定 Python 模块和独立 workspace，有 UTF-8、取消和自有 Linux 进程组清理，不能批评成“完全没有 WSL 执行桥”。
- Windows 与 WSL 的 Node、Playwright 模块、Chromium、环境变量、凭据目的地和 Cookie 状态不天然共享。bridge 显式传代码目录、workspace 和解释器，没有统一配置浏览器环境映射；不能默认 Windows 的模块目录在 Linux 可用。
- TscanPlus endpoint 只允许 loopback。普通 WSL2 NAT 下，WSL 的 127.0.0.1 不是 Windows 控制服务的 127.0.0.1；mirrored networking 等拓扑另当别论。代码没有证明当前控制服务跨后端可达。本轮没有验证本机网络模式。
- nmap / nuclei / ffuf 等的 runtime 列表明确是 `catalog_only`。有范围模式不提供任意 shell，定位出路径不能自动变成可运行的 scoped adapter。

代码：`lib/redteam/platform-config.js:371`；`lib/redteam/native-assessment.js:156`；`lib/redteam/assessment-engine/src/bridge.mjs:434`；`lib/redteam/assessment-engine/awa_ddd/browser.py:49`；`lib/redteam/assessment-engine/awa_ddd/mcp_http.py:33`；`lib/redteam/assessment-engine/awa_ddd/runtime.py:268`；`lib/redteam/mode-tools.js:61`。

本机只确认 `wsl.exe` 入口存在，没有启动发行版、探测其 Python / Node / 浏览器、运行 Kali 工具或连接实际 TscanPlus。不能据此说本机已充分可用。

## 4. 应落地的按需工具路由

不要求 AI 每次碰到页面都开浏览器，也不要求它为了“会用工具”把工具轮流调用一遍。要求当前材料出现明确需求时，给它正确且可执行的路径：

| 真实需求 / 触发条件 | 应推荐的路径 | 禁止的错误选择 |
| --- | --- | --- |
| DOM/SPA 消费、跨站读取或 UI 流程无法由静态 HTTP 观察 | 浏览器 profile readiness → 精确 browser 动作 → 实际控制 / 观察 → 原生复核 | 只读 HTTP 反射后报 XSS；反复抓静态 HTML；没运行浏览器就说无漏洞 |
| 需要公开 GET 单包重放和原始响应对照 | 兼容 Yak profile / TLS / redirect 校验 → `tool.yakit_replay` → 保留结果 → 独立引擎验证 | 以 GUI 安装代替 yak 引擎；把认证请求降为匿名来适配；MCP 完成当漏洞证明 |
| 当前靶标有已配置 scanner namespace 的结果可复用 | TscanPlus summary / results / routes → 范围内候选 → 最小独立验证 | 重新全量扫描；其他 namespace 串项目；读扫描表当本项目已验证 |
| 工具只在已选定 WSL 后端提供 | 当前 backend / distro / interpreter / path / control endpoint 联合就绪 → typed adapter | Windows 直接执行 Linux 路径；把 UNC 当 exe；模型私自改后端 |
| 缺身份或 fixture 的 UI / 业务控制 | 当前允许的身份核验 / fixture 准备 → 对应工具 | 用正常 baseline 代替安全测试；补身份冒充 provider 已实现 |
| 已有完整证据足以离线解析 / 对比 | evidence / AST / map / intel 本地动作优先 | 每次都重新请求目标或无目的打开浏览器 |
| SRC 禁用动作或已经停测 | 解释具体限制 → 离线复核 / 提交草稿 / 保留分母 | 用 Yakit、WSL 或切换 preset 绕过边界 |

路由至少返回：需求类型、依据的 E-ID / operation / input、provider、profile、当前 mode / backend、readiness 来源、准确准备入口、允许的执行参数、缺失前提、证明去向、停止条件和合法 fallback。

需要字段不完整时先 `action.help` 或准备前提，不猜 selector、E-ID、角色、命令或 MCP 参数。推荐不直接发请求；实际执行仍走当前授权、取消、scope / exclude、身份、fixture 与不可撤销 SRC 停止。

## 5. 修复和验收顺序

1. **修接口与真实能力状态**：浏览器 schema / v2 闭环、profile-specific probe、TLS 与 WSL 包装参数。先让调用正确，不先逼 AI 多调用。
2. **接通场景路由**：把实际需求接到 provider / profile 与准确参数准备；能力缺失时给明确原因及合法替代。
3. **补必要 profile**：按模式允许的业务需求逐项补受控适配；不宣称整套 Yakit / TscanPlus 功能已开放。
4. **运行真实工具隔离验收**：实际 browser、yak MCP、TscanPlus 控制服务、选定 WSL / Kali；分别测试成功、缺件、失效和取消。
5. **运行真实模型场景回归**：同模型 / 预算 / 上下文条件下测试“需要时选对、不需要时不选、前提缺失时准备或受阻、禁止时不调用”。

必须分别统计：

- 工具选择召回：需工具且模式允许的场景是否实际选择正确 provider / profile，不把口头“会使用”算调用。
- 工具选择精度：实际选择是否必要、是否与当前任务匹配，避免开浏览器 / 全量扫描滥用。
- 参数合法率与语义绑定：schema、真实 ID、协议、后端、身份和 fixture 是否准确。
- 就绪后实际执行成功率：真实工具回执，不以文件存在或模拟握手算成功。
- 预期闭环率：该场景应得到的观察 / 当前判定是否进入正确账本；未测、受阻与阴性单列。
- 不必要请求、重复探测和错误拒绝率；模式禁止调用及错误新停测作为零容忍反例。

**本轮没有测真实模型的选择率，因此不给虚构百分比。** 详细按需路由已补入 [升级方案](THREE-MODE-OPTIMIZATION-PLAN.md)。

## 6. 本轮交付与验证边界

[隔离脚本](../scripts/audit-tool-routing.mjs) 调用真实原生 handler，但 MCP / browser 数据为受控模拟，socket / DNS 禁用，只写自有临时目录。[结果封装](TOOL-ROUTING-AUDIT-1.11.0-results.json) 保存结果与关键源码 SHA256。

```powershell
node scripts/audit-tool-routing.mjs
node --test --test-concurrency=2 test/platform-wsl.test.mjs test/redteam-skill-catalog.test.mjs
```

脚本退出码 0；既有专项 12 项通过、0 失败、0 跳过、0 取消。测试通过与这些新断点并存：现有测试不覆盖真实模型按需选择，也不能代替真实浏览器 / Yak / TscanPlus / WSL 验收。

本轮只新增审计材料并补充待实施方案，没有修复生产代码、修改用户配置、安装工具、启动真实浏览器 / WSL、访问目标、apply、发布或重启正式 DSH。
