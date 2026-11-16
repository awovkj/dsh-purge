**DSH Purge 1.8.1 项目评审与优化方案**

评审日期：2026-11-14。评审对象为 `D:\Backup\Downloads\dsh-purge` 的当前工作树，包括已有修改及新增文件；内置评估核心为 awa-ddd 2.2.0，文档目标宿主为 DSH Desktop 0.2.2-rc.1。本轮仅分析与隔离验证，没有修改项目源码，没有安装、打包、应用补丁或重启 DSH，没有访问真实靶标。

我的总体判断是：**宿主维护、模式管控、证据留存和报告的工程化，明显领先于自主安全评估的实际闭环。** 项目已经具备相当完整的安全工作台结构，但模型结论与工具证明之间仍有关键缺口；v2 部分自动配方也缺少实际可执行性。当前最有价值的改进集中在证明语义、请求与判据衔接、身份建立、实际任务调度及完整交付验收。

以下 P1/P2/P3 表示工程修复优先级，不是对真实目标漏洞的评级。每项问题分别说明源码事实、隔离复现与未验证边界。

**整个项目的评价**

项目同时承担了 86 条宿主补丁、提示词与规则管理、预设注册、状态自检、跨平台安装和换包、备份回滚、工具接入、证据账本、v1/v2 评估、三种模式及双端面板。维护对象横跨 DSH 源码锚点、Electron 运行时、Node SDK、Python 核心和前端生成物。这样的规模使宿主版本变化、工具注册失败和评估契约变化容易相互影响。

工程优点很实在：宿主补丁有锚点回归和诊断；安装、更新、备份与回滚有完整事务意识；内置核心带许可证、NOTICE 和逐文件来源/哈希；运行状态会区分 pending、unknown、broken；报告保留未测与受阻分母，分页和返回预算也经过处理。根目录 `client.js` 是前端生成产物，应按构建一致性管理。

维护负担主要集中在边界交叉。约 5,600 行的 [store-core.js](D:/Backup/Downloads/dsh-purge/lib/redteam/store-core.js:1) 同时容纳角色文本、持久化、策略、积分及接口等职责，增加了变更影响判断的难度。三模式共用工具加载路径，导入异常可能让三个预设一起缺失；已有回执提升了可诊断性，但仍需要原宿主的实际验收。基础包 Node ≥18 与红队的 `node:sqlite` / 内置评估运行前提也应在运行状态中清楚区分。

产品最需要警惕的评价偏差是：把工具调用次数、材料数量、报告篇幅或执行意愿当作安全评估完成度。应主要看真实身份是否验证、安全控制是否执行、证明是否绑定准确、未完成项是否如实保留。

**三种模式的定位与锐评**

| 模式 | 实际定位 | 已有强项 | 当前最明显的短板 | 我的使用评价 |
| --- | --- | --- | --- | --- |
| 红队 | 工具面广泛的作战与协作工作台，支持 Shell、扫描、文件、委派和积分 | 自由度高；角色、资产、任务与战果台账齐全 | 角色分工多靠提示词；模型可以自授 observed；同靶标并发上限没有全局强制 | 有人监督时有实用价值，自动战果可信度还需要加强 |
| SRC | 范围固定、低影响、直接证据确认后停止的发现工作流 | 会话/范围绑定、执行前限制和持久停止较扎实 | GET/HEAD/OPTIONS 与 64 KiB/15 秒预算限制认证和业务覆盖；确认的来源账本仍可跨命题复用证明 | 适合受限发现和证据整理，自动确认链须优先修补 |
| 渗透 | 保留身份、fixture、变更前提与完整报告的范围内 Web/API 评估 | 普通 assessment 策略；专门认证指引；完整报告与未完成项 | 缺少通用 Shell、外部适配器和委派；v2 自动配方覆盖有限；历史会话认证和安全测试闭环明显不足 | 更适合受控 Web/API 测试，报告交付能力领先于自主测试闭环 |

红队的最大问题是执行自由与事实认证之间的落差。六个角色和分工文本可以改善组织，但指挥会话仍拥有执行工具；角色标签本身不形成确定性的交付依赖和资源隔离。积分有去重和上限机制，却仍能接受模型自述的“观察”，这会直接影响自动战果汇总。

SRC 的最大优点是把范围、会话归属和停止规则落实到了代码。SDK 的执行前守卫可以拒绝禁止工具，即使审批层返回允许也不能派发；普通 Purge 注入在 SRC 与渗透会话关闭。参见 [session-policy.js](D:/Backup/Downloads/dsh-purge/lib/redteam/session-policy.js:176) 与 [preset-injection.js](D:/Backup/Downloads/dsh-purge/lib/preset-injection.js:20)。不过，SRC 的只读契约会明确拒绝 POST 登录和很多业务路径，因此应把缺少可用身份列为覆盖前提。将全部 SRC 测试理解成完整的认证业务测试，会造成预期偏差。

SRC 停止还存在精度取舍：原生核心按 operation/endpoint/template 约束后续测试，来源停止也保留具体目标；同端点其他输入或漏洞族可能因此保留未测。这是偏保守的机制选择，应准确展示停止粒度与剩余覆盖，不能由一个确认项推导该端点其他漏洞族全部完成。参见 [assessment_mode.py](D:/Backup/Downloads/dsh-purge/lib/redteam/assessment-engine/awa_ddd/assessment_mode.py:56) 与 [awa-integration.js](D:/Backup/Downloads/dsh-purge/lib/redteam/awa-integration.js:154)。

渗透模式与 SRC 的区别已进入策略层：它保留普通 assessment 的身份、控制实验、fixture 和变更要求，使用专门的 runbook 与完整报告。其定位仍主要落在受控 Web/API 评估。基础设施攻防、终端执行、内网横向和多智能体作战属于红队工具面的能力范围。产品应给出明确的能力矩阵及恢复前提，帮助操作者选择模式。

**已确认问题 1：同 URL 的真实证明可以被用于确认其他未证明的漏洞，P1**

通过实际 SDK 工具，在 SRC 与渗透两种会话里均完成隔离复现。内置 v2 的三控制实验产生一个 `template_injection` 机器发现；其实际证明范围是表达式求值，并明确保留“未证明代码执行”的限制。随后 `assessmentReview verify:true` 正常生成 observed 证据。

将这条证据引用到同 URL 的另一条 `critical` 远程命令执行声明，`redteam_vuln_add` 接受了 `confirmed`；将原来源发现编辑成 `critical` 数据库管理员控制，`redteam_vuln_update` 也接受了。SRC 报告将这些来源条目放入“已取得直接证据的发现”。

根因在 [store-core.js](D:/Backup/Downloads/dsh-purge/lib/redteam/store-core.js:1110)：确认检查包括同靶标、同目标、observed 权威、完整哈希及直接证据类型，却没有将当前条目的漏洞类别、输入、证明命题和严重级别绑定到证明。更新入口会复用既有证据。报告进一步使用来源表中的标题与严重级别，参见 [src-report.js](D:/Backup/Downloads/dsh-purge/lib/redteam/src-report.js:39)。

原生机器 finding 保持原有类别、证明范围和限制，污染出现在来源账本及 SRC 报告。渗透合并报告对来源条目额外设置 `source_label_requires_current_proof`，这个保护应保留，参见 [pentest-report.js](D:/Backup/Downloads/dsh-purge/lib/redteam/pentest-report.js:54)。因此，本项证明了两模式来源确认链的缺口，以及 SRC 报告的错误确认展示，不能据此声称原生 finding 或所有渗透报告确认机制都被篡改。

**已确认问题 2：普通红队能自授 observed，并通过高价值积分门槛，P1**

实际 SDK 隔离复现中，开启 `requireAssessmentForHighValueScore:true` 后，模型提交一段明确属于合成、未执行的管理员控制文字，自填 `confidence:observed`、`authority:tool-output` 与 `score_outcome:{code:server-host,points:50}`。后续积分工具接受 50 分，返回 `counted:true` 和 `evidence_state:observed`。

[tools.js](D:/Backup/Downloads/dsh-purge/lib/redteam/tools.js:1983) 只对 SRC/渗透限制自授 observed；普通红队仍开放自由记录与升级。[evidence-ledger.mjs](D:/Backup/Downloads/dsh-purge/lib/redteam/evidence-ledger.mjs:247) 的自由升级检查非空 `verified_result`，没有独立执行结果作为必需输入。[score-evidence.js](D:/Backup/Downloads/dsh-purge/lib/redteam/score-evidence.js:48) 校验的是这些账本字段及 outcome 关联，并明确返回 `machine_privilege_proof:false`。

这是自主报告场景中的信任分工缺口。项目已经说明积分关联不能独立证明权限，但工具将模型文字标记为 observed 并计入积分，仍容易让操作者高估战果。内容哈希保证已登记内容的一致性；真实执行与主体核实需要另外的可信路径。

**已确认问题 3：v2 自动 SQL 配方存在多层衔接缺陷，P1**

实际调用 `campaign.next → test.run` 时，正常控制完成一次合成 HTTP 请求；攻击控制因 URL 含未编码空格被拒绝，错误为 `URL must be an absolute HTTP(S) URL without controls`。三控制没有完成。

[recipe_builder.py](D:/Backup/Downloads/dsh-purge/lib/redteam/assessment-engine/awa_ddd/execution/recipe_builder.py:76) 直接拼接 query，丢弃已有 query 参数；body 的 JSON Pointer 也被作为顶层字面 key，而非构造嵌套 JSON。离线构造确认 `/filter/label` 会成为单个顶层字段。

SQL 观察值到判据的适配同样缺失：给现有 evaluator 输入正常/攻击/阴性计数 1/9/1，得到 `inconclusive`，缺少 baseline、attack、business_count_change、same_identity。补齐声明字段后仍不能支持结论，因为 [oracle_profiles.py](D:/Backup/Downloads/dsh-purge/lib/redteam/assessment-engine/awa_ddd/execution/oracle_profiles.py:61) 的 requires 使用 `business_count_change`，判断代码读取 `business_count_changed`，参见 [oracle_profiles.py](D:/Backup/Downloads/dsh-purge/lib/redteam/assessment-engine/awa_ddd/execution/oracle_profiles.py:252)。

相邻的能力表达问题是：自动 builder 对 `access_control` 无条件返回 blocked，缺少专门的三主体控制 provider；仅补 verified identities 不能使该 builder 生成配方，参见 [recipe_builder.py](D:/Backup/Downloads/dsh-purge/lib/redteam/assessment-engine/awa_ddd/execution/recipe_builder.py:111)。应把 provider 未实现与操作者尚未提供前提明确区分。

本项范围限定为 **v2 自动配方路径**。默认评估模型仍是 v1，参见 [native-assessment.js](D:/Backup/Downloads/dsh-purge/lib/redteam/native-assessment.js:159)；v1 和专门 scenario/browser 路径具有其他实现，本轮结果不能推广为项目全部 SQL 测试失效。

**已确认问题 4：同靶标最多三个执行智能体没有全局落实，P2**

实际 SDK 的 slot 工具中，同一 engagement 的两个根会话各获得三个 reservation，合计六个被接受。另用无执行能力的注册表模拟两个 running 子会话与两个不相干的 pending reservation，状态返回 used=2、free=1。

[tools.js](D:/Backup/Downloads/dsh-purge/lib/redteam/tools.js:858) 声明同靶标最多三个，实际 owner 却是根会话 ID；使用 `Math.max(live.running,reserved.length)`，不能正确计算没有关联的运行项与待派发项。reservation 也没有可靠的 child ID 关联。slot 调用与实际 spawn/fork 分离，不能把提示词中的派发前占位当作硬限制。

新模板经实际预设解析/迁移后没有生成 child policy；spawn 有 maxDepth:1，fork 未显式规定相同深度与子工具限制。模板中的职责说明需与真实组合结果一致，参见 [agent.cordis.yml](D:/Backup/Downloads/dsh-purge/presets/redteam/agent.cordis.yml:316) 和 [preset-compat.js](D:/Backup/Downloads/dsh-purge/lib/preset-compat.js:73)。本轮没有真正创建智能体，也没有证明宿主运行时发生了递归委派越界。

**已确认问题 5：v2 严重级别上限未用于 finding，P2**

表达式判据声明 `severity_cap:medium`，实际 native finding 仍生成 high。根因是 [test_runner.py](D:/Backup/Downloads/dsh-purge/lib/redteam/assessment-engine/awa_ddd/execution/test_runner.py:360) 按漏洞族硬编码严重级别，没有使用 [oracle_profiles.py](D:/Backup/Downloads/dsh-purge/lib/redteam/assessment-engine/awa_ddd/execution/oracle_profiles.py:75) 的证明上限。

现有 [redteam-native-v2.test.mjs](D:/Backup/Downloads/dsh-purge/test/redteam-native-v2.test.mjs:291) 还断言 high，说明回归预期本身已固定了契约偏差。隔离复现确认的是上限被忽略；本轮没有确立“正常计算器被误报为漏洞”，正常/阴性控制不符合预期时会返回 inconclusive。

**既有真实会话暴露的产品问题**

两份 session.v4 文档提供了有用的历史运行证据。它们描述修复前会话，不能用来断定最新源码仍然复现相同故障。

| 历史会话 | 有效指标 | 对评估完成度的含义 |
| --- | --- | --- |
| SRC | 133 次工具调用，21 次失败；没有 assessment_review；末尾 unresolved 36，另有 28 个 operation 缺少安全测试义务 | 多次 baseline 与发现登记没有形成漏洞验证/复核闭环 |
| 渗透 | 279 次工具调用，73 次 HTTP 捕获，58 次正文读取；identity.session/verify 为 0/0；scenario.run/v2 test.run 为 0/0；末尾 unresolved 227 | 大量采集与阅读没有转化为认证后安全控制和完整机器复核 |

证据分别见 [SRC 会话诊断](D:/Backup/Downloads/dsh-purge/docs/src-session-v4-analysis.md:9) 和 [渗透会话诊断](D:/Backup/Downloads/dsh-purge/docs/pentest-session-v4-analysis.md:11)。这些 unresolved 计数是引擎台账中的未完成工作，不能直接解释成未确认漏洞数。

当前源码已加入值哈希、Cookie 链、脱敏头、身份衔接、结构化路由导入、固定 runbook、有界报告回执和续跑预算修复。这些改进针对实际会话症状，方向正确。剩余关键问题是需要从“工具入口可用”继续走到“真实身份可用、控制实验可执行、原生复核可确认、最终报告可追溯”。原靶标和完整 GUI 尚未重新验收，因此本评审保留这一边界。

重复采集并非总是错误，最值得监测的是：新增材料有没有用于仍未完成的安全义务；状态变化有没有对应实际控制；新增身份是否通过服务端验证；报告结论有没有可追溯的当前证明。现在的 continuation 已避免大量行政状态变化重置提醒预算，后续应把下一步推荐与可执行前提、固定任务失败历史结合。

**本轮验证与证据强度**

`npm run test:redteam` 共 79 项通过、0 项失败、0 项跳过，退出码 0，耗时约 157 秒。测试日志保存在 [测试日志](C:/Users/Administrator/AppData/Local/Temp/purge-mode-review-23045a9fd0054dacb8707e37bca93fda.log)。这些回归证明已覆盖的契约能够通过，不代表覆盖了所有证明语义与真实端到端流程。

补充复现调用实际 DSH SDK，评估代码使用当前安装副本中的内置核心，Python 使用本机已有 3.12.15 解释器。HTTP 为合成响应，真实 socket/DNS 被阻断。工具的会话、来源账本、原生评估与报告链在独立临时安装/数据库中运行；并发运行注册表为无执行能力的模拟对象。

原始隔离结果见 [results.json](C:/Users/Administrator/AppData/Local/Temp/purge-project-review-ce33890d94c841349f7b567027927d9b/results.json)；错误确认展示见 [合成 SRC 报告](C:/Users/Administrator/AppData/Local/Temp/purge-project-review-ce33890d94c841349f7b567027927d9b/synthetic-src-report.md)。现有复现已经完成，没有必要为本评审再次运行。

本轮没有完整项目全量回归、真实 DSH GUI 生命周期验收、浏览器实际观察、原靶标回放或真实智能体递归调度。已有安装/Electron CI 和先前运行证据可用于说明工程投入，不能替代当前工作树整版验收。

**优化方案：第一批先修证明语义与可信观察，P1**

影响模块：`store-core.js`、`evidence-ledger.mjs`、`tools.js`、`awa-integration.js`、`score-evidence.js`、`src-report.js`、`pentest-report.js`。

建议让“已确认命题”拥有由可信路径产生的固定字段：engagement、具体 operation、input_key、漏洞类别、实际测试/判据 ID、完整证据哈希、proof_scope、limitations 和严重级别上限。来源发现引用证明时逐项检查这些字段；同一证据可以用于多个条目的引用材料，每个条目的确认仍须独立匹配已证明命题。

模型可以编辑表述与补充影响分析；改变漏洞类别、测试输入、被证明权限或超出证明的严重级别，应进入待复核状态。报告根据当前证明生成确认标签与影响边界，避免只信来源表的 `status:confirmed`。原生报告已有的来源标签保护应延续。

普通红队的 observed 应由真实工具采集器、原生复核或可信操作者路径产生；模型文字保留 claimed/inferred。可信采集器自动写入调用关联、实际结果和证明范围，让自主执行直接获得可核查证据。积分汇总明确展示申报战果与已核实战果，默认对高价值积分应用可信证据门槛。

验收标准：

- 本轮表达式证据不能将同 URL 的命令执行或数据库管理员声明确认为 critical；编辑语义后必须拒绝确认或降为待复核。
- 准确绑定的原生发现仍能正常确认；普通文字编辑不破坏合法证明。
- 普通红队提交任意 JSON 或非空 verified_result 不能自授 observed，不能进入已核实高价值积分。
- 完整哈希不匹配、证明过时、目标/输入/类别不一致、支持材料不完整时，报告明确显示待复核与原因。

**优化方案：第二批修 v2 的可执行契约，P1，严重级别同时处理**

影响模块：内置 `recipe_builder.py`、`test_runner.py`、`oracle_profiles.py` 及配方相关能力展示；同步时遵循既有随包来源/哈希维护规则。

建议将请求构建统一为结构化处理：保留实际基线请求的已有参数和非测试字段，按 query/header/path/body 的真实位置只修改目标输入，使用规范编码与 JSON Pointer 写入。不要让一个字符串模板承担所有位置的构造。

每种 oracle 使用单一观察 schema；控制实验的真实返回值经专门适配器生成所需字段，requires 和 evaluator 从同一契约获得名称。只比较字节变化或计数变化不足以推导更深影响，仍保留身份、控制与局限性。

finding 严重级别应受到实际 proof_scope 和 oracle severity_cap 的限制。对没有实现的 access-control 三主体 provider 返回准确的“不支持此自动配方”及可用替代路径；如果要实现，则必须关联匿名、允许与禁止三个实际主体及同资源控制。

验收标准：

- SQL 正常/攻击/阴性三个控制都实际执行，URL 中空格、引号、`&` 和已有 query 正确处理；嵌套 body 写入保持原结构。
- 完整真实控制满足 SQL 判据时可以产生有限证明；缺少身份、缺少阴性控制或不可区分变化时保留 inconclusive。
- expression finding 的级别不超过声明上限；正常公式业务、反射与控制失败不会靠标题或字段自述升级结论。
- provider 不支持和可补齐前提具有不同原因及下一步，减少无法完成的重复身份准备。

**优化方案：第三批落实同靶标调度与叶子执行角色，P2**

影响模块：`tools.js` 的 slot 与 SDK 委派入口、`preset-compat.js`、红队预设及生命周期监听。

建议用 engagement 作为共享限流键，在实际 spawn/fork 派发处原子占位，关联唯一 child ID；统计已运行 child 与尚未进入运行状态的 reservation 的去重集合。派发失败、完成、取消和超时均按同一身份回收资源。

指挥与执行角色需要明确交付契约：执行角色接收范围、当前输入/义务、允许能力、预期控制、证据和受阻返回格式。固定叶子预设与运行时策略共同限制进一步委派；用户自定义 YAML 继续按既有保留规则处理。

验收标准：两个根会话同时绑定同一靶标时，第四个实际任务被拒绝；两个 running 加两个不重叠 reservation 计为四；跳过显式 slot 调用也不能绕过派发上限；子会话失败后名额释放；模板说明与实际组合一致。委派深度必须在隔离真实宿主上验证。

**优化方案：第四批把认证、控制和报告做成完整验收链，P2**

影响模块：`assessment-auth.js`、`assessment-readiness.js`、`assessment-continuation.js`、固定 SRC/渗透 runbook、评估门面与报告模块。

建议按真实恢复前提调度：先确定目标模式与 runtime 能力，再获取/延续实际认证材料并核实服务端主体；之后选择当前可执行的安全义务，运行控制，复核，最后报告。模型的 next_step 应指出具体任务与缺失材料，避免在帮助目录、声明、baseline 和 checkpoint 上循环。

发现与登记要有预算和阶段边界。任务分母增长后，优先明确哪些能测试、哪些缺身份或 fixture、哪些 provider 未支持；不能用 N/A 或管理状态变化消除实际未完成义务。SRC 保留其只读与停止契约；认证业务需求由明确具备相应前提的独立评估任务承担。

验收必须包含至少一条隔离 Web/API 完整链：实际登录与 Cookie 延续 → 服务端身份/角色核实 → 正常/攻击/阴性或三主体控制 → 原生 review → 来源确认 → 报告及附件。还应包含安全对照服务、缺少浏览器、身份错误、截断响应和中途取消，确认不会错误结项。

指标建议使用：身份核实成功率、实际安全控制完成率、每个闭环的工具调用成本、同任务重复失败次数、未完成原因分布、证明到报告的可追溯率。工具调用总数与报告长度仅作为资源指标。

**优化方案：第五批降低维护成本和结果漂移，P3；凭据暴露可按使用场景提前到 P2**

`store-core.js` 应按范围/会话策略、证据、发现、战果、报告和持久化拆出可单独评审的模块。优先确保来源确认与报告共用同一套证明判据，减少政策重复实现。双端面板继续通过生成一致性校验维护。

凭据当前有意明文保存并可由查询工具返回，参见 [tools.js](D:/Backup/Downloads/dsh-purge/lib/redteam/tools.js:1240) 与 [store-core.js](D:/Backup/Downloads/dsh-purge/lib/redteam/store-core.js:2452)。建议默认以 opaque handle 使用凭据，由请求/执行器在本地应用，模型与报告获取必要的类型、用途和验证状态；需要实际值的明确操作再限定读取范围。是否采用系统密钥存储，应结合跨平台支持成本设计。

工具部署的 latest 下载和缺少校验值会造成评估环境漂移，参见 [redteam-setup.sh](D:/Backup/Downloads/dsh-purge/scripts/redteam-setup.sh:87)。建议固定发行版本、记录摘要与实际能力，保留操作者选择升级的入口；浏览器工具的 `@latest` 同样应纳入可复现环境记录。

运行状态应分别呈现 Purge 基础能力、红队 SDK 工具、内置 Python 核心和浏览器能力，准确报告 Node/Python 前提与独立导入失败。宿主补丁继续按版本锚点回归，完整 GUI/换包验收独立记录。拆模块时以既有隔离证据用例保护行为，避免一次性同时改动宿主补丁、证据模型和所有 UI。

**最终评价与实施顺序**

工程维护底座值得肯定；三模式的策略区别也已经落实。现阶段最薄弱的是自动结论的可信认证以及安全测试到交付的持续闭环。红队应先解决自述战果与核实战果的区别，SRC 应先封住来源确认的跨命题复用，渗透应先把认证和可执行安全控制贯通。

建议按“可信确认 → v2 可执行配方 → 全局调度 → 完整流程验收 → 模块化与环境固定”的顺序实施。先完成前两批，才能让后续编排、角色和面板改进建立在可靠的结果上。本报告仅交付评价和优化方案，上述改动均未实施。
