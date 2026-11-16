# 红队 / SRC / 渗透模式源码锐评：1.11.0

审查日期：2026-11-15。对象是当前工作区的 `dsh-purge-community` 1.11.0 与随包 awa-ddd 2.2.0，不是已安装宿主或正式发行包的验收。

**结论：这个项目的证据保存、模式边界和交付工程进步很快，但发现与验证内核仍明显短腿。现在不能据此宣称“高准确率、自主完成的红队 / SRC / 渗透系统”。更严重的是，已经能把安全业务行为做成当前机器证明，也能在没有机器证明时提前触发 SRC 停测。不是再加几段提示词就能解决。**

升级实施方案见 [三模式优化升级方案](THREE-MODE-OPTIMIZATION-PLAN.md)。本报告只提出审查结论与方案，不实施生产逻辑升级。

## 1. 证据与审查边界

本轮检查三模式预设、工具面与派发约束、原生 v1/v2 评估、身份与请求控制、证明复核、SRC 停止、campaign 调度与覆盖、发现技能、批量采集、积分成果和报告，以及现有 CI 与历史会话诊断。

验证分为三层，不混为一谈：

| 层次 | 本轮结果 | 可以说明什么 |
| --- | --- | --- |
| 现有专项回归 | 53 项通过，0 失败、0 跳过、0 取消 | 选定的既有契约没有回归；不代表漏洞发现准确率 |
| 新增隔离反例 | 审计脚本退出码 0，复现结果见下文 | 当前代码存在这些可构造的误报、漏测、错绑和状态缺陷 |
| 真实端到端 | 本轮未访问真实目标、运行浏览器或正式 DSH | 不能声称修复后的真实挖洞效果、GUI 或调度已经验收 |

专项回归命令：

```powershell
node --test --test-concurrency=2 test/redteam-native-assessment.test.mjs test/redteam-native-v2.test.mjs test/redteam-pentest-workflow.test.mjs test/redteam-src-runtime.test.mjs test/redteam-mode-upgrade.test.mjs test/redteam-source-stop.test.mjs test/redteam-agent-scheduler.test.mjs test/redteam-skill-catalog.test.mjs
```

新增 [隔离审计脚本](../scripts/audit-three-modes.mjs) 使用临时工作区、合成 HTTP 传输和真实内存 SQLite 参数化查询；禁用目标 socket 与 DNS。原生案例调用包内 v2 API，批量案例经过公共 Node 评估门面及实际 Python bridge。它不是对外扫描器，也不是修复后的通过测试。

```powershell
node scripts/audit-three-modes.mjs
```

需要满足包内评估的 Node/Python 前提；本轮使用 Node 24.21.0 与现有宿主 Python。脚本不安装依赖、不更改正式 DSH，并在退出时校验路径后清理自己的临时目录。

[结果封装](THREE-MODE-AUDIT-1.11.0-results.json) 保存脚本输出、另行只读查询的技能目录统计及关键源码 SHA256。`elapsed_ms` 是一次本机合成运行，不是生产网络性能。工作区原先已有大量修改，本轮保留；Git HEAD 不能代替这些源码哈希。

以下 P0/P1/P2 是**项目整改优先级**，不是被测目标漏洞的 CVSS 严重级别。

## 2. 三个模式分别差在哪里

| 模式 | 现有实际定位 | 不留情面的评价 |
| --- | --- | --- |
| 红队 | 有范围时是受控工具、评估、链路与积分台账；空范围历史模式保留宽工具兼容 | “有很多攻防技能”不等于能交付攻防成果。范围内可执行能力与高价值成果核实没有完整闭环，台账比攻击路径验证成熟 |
| SRC | 固定范围、受限只读发现、直接证据停测、提交草稿整理 | 边界保守是正确选择，但停测的触发判据存在漏洞。错把不可靠结论当停测依据，会同时制造误报和永久漏测；它也不是所有 SRC 漏洞类型的自动覆盖器 |
| 渗透 | Web/API 评估、身份、fixture、场景与完整交付 | 有测试基础设施，不等于完成测试。v2 会漏掉 ownership 义务，自动正向 provider 又很窄，报告完整不能替代验证完整 |

共同问题是：**把“有工具”“采到了响应”“生成了义务”“保存了机器收据”误当成“已经准确验证了安全缺陷”。** 当前实现已经在文档层反复区分这些概念，但关键代码仍有不一致。

## 3. 已复现的核心缺陷

### A-01 · P0：安全参数化查询也能成为 SQL 当前机器证明

**问题不是哈希不真，而是安全判据不真。**

`sql_metadata` 判据只要求正常值与阴性值相等、攻击值更大、同身份、控制完整，以及由这些数值自己算出的 `business_count_change`。它没有独立证明输入被 SQL 解释，而不是按字面进入正常业务查询。

代码：`lib/redteam/assessment-engine/awa_ddd/execution/oracle_profiles.py:255`；`lib/redteam/assessment-engine/awa_ddd/execution/test_runner.py:173`；固定输入与选择器见 `lib/redteam/assessment-engine/awa_ddd/execution/recipe_builder.py:31`。

本轮反例确实执行安全查询 `SELECT COUNT(*) FROM records WHERE label = ?`。数据里有两条 label 字面等于测试攻击字符串的记录。正常 / 攻击 / 阴性得到 0 / 2 / 0；没有任何拼接 SQL 或注入执行。

实际输出却是：

- `outcome: supported`，创建 `mode: machine` 的原生 finding。
- `current_machine_proof: true`，严重级为 `medium`，证明范围为 `sql_metadata_observation`。
- SRC 原生停止记录增加 1 条。

这不是已经实测真实目标存在 SQL 注入，也没有演示外层漏洞表被导入确认；它直接证明了**当前原生正向判据可以把安全字面匹配误当作 SQL 族机器 finding，并在原生复核中继续通过**。限制影响范围和严重级，并不能让错误的安全因果成立。

根因：正常输入与阴性输入没有控制业务语义；复核重复执行同一个弱判据，而不是独立验证机制。v1 的 SQL 判据也应纳入同一安全/漏洞成对基准审计，不能只修 v2 就宣称三模式准确；本轮没有对 v1 完成同一假阳性复现。

**要求：仅有计数差异必须保持候选 / inconclusive。确认 SQL 族漏洞必须增加机制特异、业务等价且相互独立的控制和实际解析上下文。**

### A-02 · P0：模型撰写的 review 不能授予机器证明，却能授予 detection 和 SRC 停测

公开原生动作名是 `review.finding`。当前实现核对材料属于该 run、材料当前且哈希一致，却没有从实际 artifact 重新提取 `observation.actual`，也没有充分核对 control group 的实际请求角色和证据互异性。

代码：`lib/redteam/assessment-engine/awa_ddd/contracts.py:314`；`lib/redteam/assessment-engine/awa_ddd/domain/review.py:38`；`lib/redteam/assessment-engine/awa_ddd/execution/review_engine.py:20`。

本轮先运行一个返回字面反射的模板测试，结果为 inconclusive。随后：

- normal 与 attack 都引用同一个完整 E-ID。
- review 声称 `/value` 的实际值为 `49`，材料真实值却是 `AWA-NORMAL`。
- reviewer 明确是 `agent_recorded`，没有伪装成人类。

代码仍接受 review，返回 `machine_proof:false`，把 hypothesis 改为 `supported`，并写入 1 条原生 SRC 停止记录。

停测调用位于 `lib/redteam/assessment-engine/awa_ddd/execution/review_engine.py:83`；`lib/redteam/assessment-engine/awa_ddd/assessment_mode.py:150` 只核对证据当前，没有核实这是不是直接安全证明。其“接受直接发现后停测”的函数语义，与实际准入不一致。

此外，`human_independent` 也是调用参数中的类型值；独立人工核实不能只靠模型填写枚举。这个问题来自源码审查，本轮反例并未使用该类型。

边界必须说清：**本例没有绕过外层 observed / confirmed 的强证明守卫；它污染的是原生 reviewed detection、调度状态与 `src_stop`。原生 `src_stop` 和外层 `src_source_stop` 也不是同一台账。** 两套台账保守并不能弥补原生错误停测。

**要求：review 草稿、分析员判断、受信人工核实和机器证明必须分级；仅当前机器安全证明或认证的受信人工观察路径可以触发新的 SRC 停测。历史停止不能自动删除或重新开放。**

### A-03 · P1：v2 投影丢失 ownership，越权义务根本没生成

注册层保存 `ownership` 与 `allowed_roles`，但 `operation_record()` 投影到 Universe 时把它们丢了。假设生成器和重要性评分又依赖 `operation.get("ownership")`。

代码：`lib/redteam/assessment-engine/awa_ddd/engine.py:219`；`lib/redteam/assessment-engine/awa_ddd/domain/universe.py:91`；`lib/redteam/assessment-engine/awa_ddd/planning/hypotheses.py:139`。

隔离结果：明确注册 `ownership:true`，投影为 null，`principal_tenant_boundary` 假设为 0；只在内存投影副本保留字段，同一生成器就生成 1 条。

**这是实打实的漏测，不是模型没听懂。** 用户把资源归属告诉了系统，系统自己把信息扔掉，再表现成“没有越权任务”。此项针对 v2，不能否定 v1 已有的 ownership 采样机制。

### A-04 · P1：跨 origin 的同路径被错绑，资产与发现关联不可靠

KnownCase 匹配只比较 method 和路径模板，不比较 origin；route 聚合也只用路径作 key。

代码：`lib/redteam/assessment-engine/awa_ddd/planning/hypotheses.py:55`；`lib/redteam/assessment-engine/awa_ddd/planning/campaign.py:27`。

隔离结果：两个范围内服务都有 GET `/api/records/7`，属于第二个服务的 case 被映射到第一个服务；2 个 operation 被聚合成 1 条 route。

这不是本轮证明了越界执行；两个服务都在 scope 内。真正问题是：**证据 / 已知案例会关联到错误服务、请求可能跑错对象、route 分母失真。** 一个多子域 SRC 或多服务渗透项目，不能靠“路径长得一样”判断是同一个安全边界。

### A-05 · P1：campaign 有冻结快照，却没冻结自己的任务成员

coverage 与 scheduler 从 repository 取所有未 superseded 的 hypothesis 等对象，没有按 campaign 或其 Universe 成员过滤。

代码：`lib/redteam/assessment-engine/awa_ddd/planning/coverage.py:24`；`lib/redteam/assessment-engine/awa_ddd/planning/scheduler.py:98`；`lib/redteam/assessment-engine/awa_ddd/planning/campaign.py:117`。

隔离结果：第一个 campaign 的冻结 Universe 只有 1 个 operation；新增第二个 operation 并启动第二个 campaign 后，第一个 campaign 的假设分母变成 2，旧调度器还能选到新 operation。

`target_build` 又只是 target / scope 配置的哈希，见 `lib/redteam/assessment-engine/awa_ddd/planning/campaign.py:80`。库存变化时 snapshot 改变、该字段不变。它不是真实部署版本的证明，不能据此复用目标版本假设。

**冻结只做在表面，统计和执行还是共享大锅饭。** 可以共享不可变证据与失败历史，但活动成员、范围版本和当前证明适用性必须显式关联。

### A-06 · P1：inconclusive 看起来 covered，却没有下一步

coverage 把 inconclusive 算进 tested；当全部适用假设只有这一项时，hypothesis coverage 返回 100% 和 `covered`。调度器又只派 ready / unplanned，缺少 missing_context 的 inconclusive 被直接跳过。

代码：`lib/redteam/assessment-engine/awa_ddd/planning/coverage.py:16`；`lib/redteam/assessment-engine/awa_ddd/domain/coverage_claim.py:71`；`lib/redteam/assessment-engine/awa_ddd/planning/scheduler.py:121`。

隔离结果：一次 inconclusive，`tested_coverage:1`、`status:covered`，后续 `selected:0`、`preparation:0`，但交付剩余仍有 `inconclusive:1`。

必须公平承认：当前最终交付仍保留这个未完成分母，也不会据此授予 exhausted。因此不是“整个任务被错误结项”，而是**局部覆盖指标误导，与可执行恢复队列断裂**。系统既告诉模型“没有可派任务”，又告诉报告“还有未完成”，任务容易卡死。

## 4. 能力、效率与产品定位缺陷

### A-07 · P1：12 个漏洞族的矩阵，不等于 12 个族的自动验证能力

`automatic_provider()` 只为 SQL、模板和 generic 提供自动 native HTTP controls；generic 使用不产生正向漏洞的 `semantic_negative`。

代码：`lib/redteam/assessment-engine/awa_ddd/execution/recipe_builder.py:91`；`lib/redteam/assessment-engine/awa_ddd/execution/oracle_profiles.py:170`。

所以，当前自动正向原生 provider 实际集中在 **2 个族**，其中 SQL 还存在 A-01 的误报。访问控制、XSS、SSRF、XXE、路径遍历、命令、反序列化、上传和业务逻辑的专用自动 provider 未实现。

包里确实有独立 scenario / browser / external typed 入口，不能说这些能力“完全不存在”。问题是它们没有普遍接入自动配方、真实前提和当前机器证明闭环。固定 `/count`、`/value` 和模板表达式也无法普适于实际返回结构及解析器上下文。

**2/12 是 provider 能力计数，不是项目召回率 16.7%。** 没有真值基准，任何这样的百分比都是瞎编。

### A-08 · P2：字段名子串匹配制造无价值任务

v2 `_semantic_rules()` 用未分词的正则匹配整个字段字符串。

代码：`lib/redteam/assessment-engine/awa_ddd/planning/hypotheses.py:18`；`lib/redteam/assessment-engine/awa_ddd/planning/hypotheses.py:42`。

隔离结果：`profile_id` 因包含 `file` 被当作文件上传；`candidate_id` 因包含 `date` 被当作业务时间窗口。义务越生越多，却与实际消费机制无关。

这种“覆盖面增长”是垃圾分母增长，浪费模型解释、前提准备和报告篇幅。需要分词、schema / AST 消费证据与机制去重，不是再加关键词。v1 的对应实现并不完全相同，不能泛化为所有版本都有同一规则。

### A-09 · P2：batch 减少模型往返，但底层仍然大量重复启动

批量每项依次调用既有 preflight / capture；每个普通门面动作又先调 `project.status`；每个 bridge 动作新起 Python；每个 HTTP request 新建连接并关闭。

代码：`lib/redteam/assessment-batch.js:52`；`lib/redteam/awa-integration.js:411`；`lib/redteam/native-assessment.js:338`；`lib/redteam/assessment-engine/src/bridge.mjs:368`；`lib/redteam/assessment-engine/awa_ddd/transport.py:192`。

本轮公共门面案例是同一 operation、两个不同幂等键的 batch，结果：

- 2 个采集项产生 **10 次 native bridge 调用**：5 次 project.status、2 次 preflight、2 次 capture、1 次 surface.inspect。
- 额外 inspect 来自精确 `already_preflighted` 恢复路径；这不是纯成功首次预检所有路径的通用常数。
- 合成传输本机耗时 5,649 ms；没有真实目标网络流量，不能直接折算生产加速倍数。
- 再用相同幂等键时，E-ID 正确复用；但公开 `requests_sent` 仍为 null，不能计算真实重复请求率。

应该保留逐项守卫、取消和未知派发的 no-replay，不该为了快直接删预检。优化点是**有界原生批量 worker、调用内可信状态复用、按 origin / 身份隔离的连接复用和真实发送计量**。本轮没测 20 项，不把推算写成实测。

### A-10 · P2：技能目录很丰富，可执行就绪却不闭环

公共 `skill.index` 的当前参数只来自 mode 与 bounded，未消费已验证的真实工具注册表及 runtime capability 报告。运行前提一直 unknown 是保守正确，但对“接下来能做什么”帮助有限。

代码：`lib/redteam/assessment-local-actions.js:31`；`lib/redteam/skill-catalog.js:31`。

本轮有范围策略下的静态目录查询：

| 模式 | 静态工具名数 | 技能数 | available | unknown | blocked |
| --- | ---: | ---: | ---: | ---: | ---: |
| redteam | 71 | 32 | 6 | 6 | 20 |
| src | 48 | 9 | 4 | 5 | 0 |
| pentest | 51 | 11 | 4 | 7 | 0 |

这些不是实时宿主注册或探测结果；available 也不意味着已能执行漏洞验证。红队的许多 shell 类技能在有范围策略下 blocked 是设计边界，不是故障。**拿静态工具数宣传“实战能力”，没有说服力。** 要返回受信能力缺口和精确准备入口，而不是让模型自填 ready。

### A-11 · P2：高价值红队成果有校验消费者，却缺包内成果核实生产者

默认高价值积分要求可信回执内有同目标的 `score_outcome` 与基础档位；通用 host-tool collector 明确 `direct_evidence:false`，不能证明主机 / 核心系统 / 域名控制成果。

代码：`lib/redteam/score-evidence.js:55`；`lib/redteam/evidence-collectors.js:24`；`lib/redteam/store-core.js:1885`。

本轮源码检索发现包内主要是 `score_outcome` 的校验、说明与消费，没有对应高价值权限成果的专用可信采集器。已有漏洞原生 review collector 也不能替代权限成果。

准确结论是：**当前公共模型工作流没有完整的对应成果生产 / 核实闭环**，而不是“随便一个积分都不能用”，也不是否认将来的受信外部集成或人工核实。

不要建议关闭默认校验来刷分。需要定义少量有界、受信、可核实的成果契约，或清楚给出认证的人工验收路径。否则红队链和积分更像作文评分。

### A-12 · P1：工程测试充足，挖洞效果基准不足

当前 CI 覆盖安装、补丁、模式、证据与跨平台契约，这值得保留。但没有提供三模式在同一真值集上的分族 precision / recall、首个真漏洞时间、每个确认漏洞请求成本和真实身份 / 浏览器端到端结果。

代码与历史说明：`.github/workflows/community.yml:10`；`docs/MODE-UPGRADE-1.11.0.md:43`。

历史整仓记录是 747 项、717 通过、30 跳过，不是本轮重跑结果。本轮选定 53 项全过，新增反例仍成立。这说明测试偏向“契约允许 / 拒绝是否按设计工作”，对“设计的判据是否真的区分安全与漏洞”覆盖不够。

`_tool_yield()` 的 `promoted_hypotheses` 还是固定 0，`findings` 为 null，unavailable reasons 为空，见 `lib/redteam/assessment-engine/awa_ddd/planning/coverage.py:165`。调度成本与 exploitability 多是固定常数，见 `lib/redteam/assessment-engine/awa_ddd/planning/scheduler.py:10`。这些不足以证明效率，更不能支持自适应优化。

**没有基准就谈“准确率已经很高”，是主观感受；用调用次数、报告长度和版本号替代效果，是自欺欺人。**

## 5. 不能重复批评成现状的旧问题

当前版本已经有以下实质改进，本轮不把它们说成“仍然没有”：

- 三模式模型入口不能自由自授 observed；固定可信采集回执和当前证明检查已经存在。
- 发现 / 证明绑定具体靶标、目标、operation / input / category、完整哈希与影响上限，编辑会使旧证明待复核。
- 同靶标实际委派 lease、原子占位与子会话限制已经实现；本轮没有新的真实宿主调度验收。
- 新凭据本地 AES-GCM 与 opaque handle 已实现；不把旧明文自动迁移或任意回显当升级手段。
- 已有 evidence.read / diff、批量采集、JavaScript AST 与 sourcemap 发现、离线情报、共享模式政策及停滞提醒。
- 报告保留候选、受阻、停止和未完成分母，SRC 提交草稿不冒充平台接受。

因此应修的是**判据的因果有效性、状态权限、对象关联、可执行验证能力和成本模型**，不是推倒这些已经改善的基础设施。

## 6. 历史会话能说明什么，不能说明什么

`docs/pentest-session-v4-analysis.md:12` 的旧渗透会话有 279 次调用、73 次捕获、58 次 evidence.read；身份建立 / 验证与真正 scenario / test.run 均未闭环，最后 unresolved 227。它能说明曾经的工作流会忙于读取与基线，却没有推进安全验证。

该诊断之后已经做过认证链、证据读取、报告回执和续跑修复。**不能把旧会话数字当作 1.11.0 本轮实战表现，也不能说那次问题全部还没修。** 本轮新反例独立证明当前内核仍有上述问题；修复后的真实效果仍需新的同条件会话基准。

同理，历史 SRC 会话、既有 Loader 验收与升级记录，都不能代替本轮真实浏览器、GUI、宿主调度与目标验收。

## 7. 最终整改顺序

1. **先止住错误证明和错误停测**：修 A-01 / A-02，增加真实安全实现反例，隔离分析员判断与受信结论。
2. **再修任务正确性**：ownership 投影、origin 身份、campaign 成员、inconclusive 恢复与垃圾义务。
3. **然后降低正确验证的成本**：原生有界批量、身份链与结构读取捷径、真实成本计量、连接隔离复用。
4. **再扩充能交付的漏洞族**：优先访问控制 / IDOR、上下文匹配的 SQL / 模板、实际浏览器 XSS；其他族逐项用有界 provider 和真值测试开放。
5. **最后谈智能调度和“高效准确”**：用分模式、分族真值基准与授权端到端结果证明，不拿提示词、调用量或报告页数交差。

本轮交付的是可复核审查与升级方案，未修改生产逻辑、版本、宿主配置或现有停止台账，也没有安装、apply、发布或重启 DSH。
