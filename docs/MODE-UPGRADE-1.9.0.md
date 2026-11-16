# 三模式完整源码升级说明

版本：dsh-purge-community **1.9.0**；日期：2026-11-14；宿主源码目标：DSH Desktop **0.2.2-rc.1**。内置 awa-ddd 上游版本为 **2.2.0**，本地适配来源分别记录在 `provenance.json`。

**交付状态：源码已编辑，面板与来源清单已生成；本轮没有测试或验证。** 未执行源码检查、回归、自检、运行时探测、真实登录、HTTP/浏览器控制或智能体委派。没有打包、发布、安装、apply 或重启。历史评审用例、既有 session.v4 与其他宿主验收不代表本轮改动已通过。

## 优化目标与实际模式

本轮根据改动前项目评审，优先修正自动结论可信度、实际请求到判据的衔接及靶标级调度，再完善凭据、工作流、运行前提和可复现部署。

| 模式 | 执行定位 | 确认和停止 | 仍需具备的前提 |
| --- | --- | --- | --- |
| 红队 | 操作者授权范围内的工具与协作工作台 | 模型文字不能自授 observed；确认和高价值成果须有对应可信证明 | 实际工具、范围、身份和影响测试前提；叶子任务禁止继续委派 |
| SRC | 固定 scope/exclude、有限请求预算的发现流程 | 精确命题取得直接证据后持久停止；旧标签和新命题分别复核 | 只读方法、实际消费点、完整证据与可用身份；写登录或业务控制保持受阻 |
| 渗透 | 固定靶标中的受控 Web/API 评估 | 普通 assessment 策略，保留完整控制、覆盖与报告 | 实际服务端身份、匹配资源/fixture、变更许可及所需浏览器；不提供通用 shell 或委派 |

角色名称约定任务职责。代码守卫落实范围、证据、委派叶子和并发限制；角色文本本身不构成完整的角色能力隔离证明。

## 可信观察与精确发现证明

`evidence-ledger.mjs` 的普通记录路径拒绝 `observed`。模型入口统一登记 `claimed/inferred`；代码使用 `recordObserved/upgradeObserved` 及固定 collector 保存不可编辑来源回执。回执绑定实际调用、材料摘要和证明上下文，数据库触发器禁止直接更新或删除来源记录。

可信来源包括原生评估复核、宿主实际工具返回值以及可信操作者核实代码路径。普通工具采集保留实际返回值和哈希，但标记 `direct_evidence:false`；它不能独立确认漏洞或高价值权限。旧 observed 数据不会被删除或自动重认证，显示 `legacy_unattested`。

来源发现确认与离线报告统一调用 `finding-proof.js`。一项证明须匹配 engagement、vuln id、具体目标、operation、input、category、原生 finding/decision、材料哈希、机器标题、proof_scope、limitations 和 severity cap。证明依赖发生实质变化、支持材料缺失或超出影响范围时，显示待复核原因。

例如，某 URL 上的表达式求值证明仅支持其实际表达式命题；同 URL 的系统命令执行、数据库管理员控制或更高严重度继续作为待复核声明。补充叙述与修复建议可以保留；改变已确认标题、被证明权限或超出级别上限须重新核实。

原生 v1/v2 的机器表述由 `proof_claim.py` 产生。`finding.record` 的人工标题/影响保留为 `source_claim`，机器发现采用判据对应表述。v2 `review.bind` 重用该 run 已产生且重新核验的机器发现，不复制人工标题和严重度、不重复增加检测数。旧机器发现缺少新契约时，报告明确标为待复核；历史原材料保留。

高价值积分的新默认开启 `requireAssessmentForHighValueScore`，操作者已经明确保存的 false 继续生效。`server-host/central-system/domain-control` 需要同具体目标或服务、可信 collector 认证的 `score_outcome` 和基础档位。积分是台账关联，报告仍保留 `machine_privilege_proof:false`；普通漏洞证明不会自动成为权限成果。

## v2 请求、控制与失败恢复

`execution/request_builder.py` 从同 operation、同实际身份和 current 完整 HTTP 观察选择基线。复用非测试 query/body/header，规范编码选定 query；JSON 使用真实嵌套 Pointer；路径输入只替换模板中准确匹配的实际参数。重复字段、未绑定路径和未知非测试业务值明确受阻。

认证头由已验证 session 私下应用。基线中的 Cookie、Authorization、自定义 credential headers 及传输 framing 不进入新业务头。`transport.request_parts` 与 `verify_control_evidence` 共用执行器实际生成的请求语义，包括 Host、Accept-Encoding、Connection、Content-Length 和 Content-Type。执行结果、离线 `test.run mode:verify` 与原生 integration 复核都检查完整材料、operation、身份/generation、资源、URL、方法、body 和头。

SQL 正常/攻击/阴性观察统一提供 baseline、attack、negative_control、business_count_change、same_identity 与 controls_complete。判据仅允许同身份下正常和阴性一致、攻击产生有界可区分计数变化；该结果不声明表访问、数据转储或权限控制。模板判据要求明确的非计算器 template consumer、正常与阴性预期及反射排除，级别不超过 medium。其他 oracle 同样服从其 proof_scope 与 severity cap。

| 自动配方族 | 当前源码能力 |
| --- | --- |
| SQL | 同 operation/input/身份的三控制；缺完整多输入基线则受阻 |
| 模板 | 明确非计算器消费点下的表达式三控制；有限证明与级别上限 |
| generic | 有界语义对照；不产生通用漏洞确认 |
| access-control、XSS、SSRF、XXE、命令、反序列化、上传、业务状态等 | 自动 builder 不提供专门 provider；保留未实现原因，按当前模式允许的独立 typed 场景/浏览器/适配器契约处理 |

写配方预算必须与冻结写控制数量一致，三写控制不能声明一写预算；身份、自有资源、verified fixture 及 campaign/project 变更许可继续必需。相同任务有未完成 run 或未协调的未知写入时拒绝再次执行。

正常执行失败保存 run、已取得证据及明确恢复入口；hypothesis 不因处理异常留作已完成。相关实际身份、基线或资源前提变化后，可在 `campaign.next` 离线重新准备自动任务；失败次数和冷却不会由时间戳、分页或行政状态重置。未知写入保持受阻，须读取原 run 并核实实际资源状态，不能自动重放。进程被外部终止且缺少完成回执的 run 保留 unfinished，不凭空恢复成成功。

离线 verify 必须按冻结控制顺序提供完整、互异且精确匹配的证据；它不发送请求、不覆盖原执行结果或协调未知写入。同一离线验证沿用已有回执，不增加重复 attempt。

## 同靶标调度

`agent-scheduler.js` 在共享 SQLite 中以 engagement 为限流键，在实际委派入口原子计数和占位。显式 `redteam_agent_slot acquire` 为预留，真实派发可消费本会话预留；跳过显式 slot 也经过派发限流。

registry ID 与 session ID 保存明确别名关联。已运行子任务恢复复用 lease；已结束子任务重新启动才申请新名额。结束按真实关联 ID 释放，未派发预留过期；缺少结束/失败证明的 dispatch 保留占位。身份冲突保持受阻，不能用“最早预留”猜测归属。

所有根会话共享操作者上限，默认 3，设置允许 1–10。执行子会话在运行时禁止继续委派，spawn/fork 配置均约束叶子。此源码改动未经真实宿主并发或 GUI 验收。

## 凭据与身份

新 `secret_value` 使用 AES-256-GCM，AAD 绑定 engagement、host、username、secret_type。密钥位于 `$DSH_HOME/redteam/.credential-vault-key`，使用平台私密文件权限；并发创建禁止替换既有密钥。它是本地加密存储，不是系统密钥托管，也不防御已经取得本机文件读取权限的进程。

默认列表、会话概览与报告返回 `cred_<id>`、是否可用及 storage/state。旧明文不批量迁移，默认仍隐藏值；密钥不可用时保留句柄，显示 vault_unavailable。备份或迁移凭据数据时必须同时保留对应密钥和 engagement 身份，否则无法解密；本轮没有执行数据迁移。

`identity.session` 可带 `credential_handle`、`credential_url`、`credential_auth:basic/bearer`，请求器本地应用 Authorization。native session 的 `credential_origin` 在创建时持久固定，并进入凭据快照；第一次 identity.verify、HTTP、场景和浏览器均保持目的地限制。它仍是未验证身份，后续须核实实际自资料 subject/roles/tenant。

双端面板默认隐藏秘密；点击“复制实际值”才限定读取单条与用途。`redteam_credential_reveal` 受当前模式能力守卫限制；SRC 的凭据入口继续被拒绝。不要把句柄、登录成功或 Cookie 存在当作身份/权限证明。

## 维护与交付

Purge 基础能力 Node ≥18；红队 SQLite/工具 Node ≥22.5；内置评估 Node ≥22.19、Python ≥3.10；真实浏览器另需现有 Playwright 模块与可启动浏览器。运行状态分别解释各层要求，文件定位与历史回执不替代执行证明。

工具部署使用 [固定版本与摘要流程](TOOLKIT-PINS.md)。不会追 latest、自动删坏文件、改系统源/代理或安装浮动 Python/npm 依赖。源码同步保留上游 2.2.0 来源哈希及 MIT 版权，新增 helper 标 `origin:dsh-purge`；已审阅适配仅匹配确切上游哈希时保留，漂移要求重新审阅。

默认角色文本、SRC/渗透 runbook、双端面板和报告统一解释当前证明、凭据句柄、真实前提与未完成分母。自有模块包括 role-prompts、finding-proof、evidence-collectors、credential-vault、agent-scheduler、runtime-requirements、sqlite-runtime 和 assessment-workflow。原有工作树修改以及用户提示词、规则、设置和 YAML 原文保留。

本轮按用户要求到源码和生成物交付为止，没有测试或验证，也没有操作当前 DSH 安装与原靶标。1.9.0 TGZ 链接仅在未来正式发布后可用。
