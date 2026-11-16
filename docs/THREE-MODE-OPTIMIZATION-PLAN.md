# 三模式优化升级方案：先正确，再高效，再扩覆盖

日期：2026-11-15。基线：当前工作区 1.11.0。依据：[源码锐评](THREE-MODE-AUDIT-1.11.0.md) 与 [隔离复现结果](THREE-MODE-AUDIT-1.11.0-results.json)。

**这是待实施方案，不是升级完成记录。** 不预先用新版本号包装效果，不自动安装、apply、改变用户配置或重启正式 DSH。

## 1. 升级目标与不做的事

目标按顺序排列：

1. 不把安全业务差异、模型判断、重复材料或错误服务关联变成当前安全证明。
2. 不漏掉已登记的身份 / 归属安全边界；未完成项必须既可解释，也有安全的恢复路径。
3. 降低一次真实、有效验证所需的模型往返、进程启动和目标请求成本。
4. 增加经过真值验证的 provider，而不是只增加漏洞族名称、payload 和技能文档。
5. 用分模式、分漏洞族、固定预算的基准测量效果；未知、不支持与模式禁止独立展示。

不做以下“伪优化”：

- 不通过关闭审批 / 范围 / 证明校验、开放任意 shell 或取消 SRC 边界来换吞吐。
- 不让模型填写 confidence、impact、reviewer 类型或运行就绪来获得更强事实权限。
- 不把采集到 HTTP 200、发现 CVE 版本候选、生成 N/A 或保存报告算作验证完成。
- 不自动撤销旧 SRC 停止，不把原 SRC 靶标改成渗透靶标继续测。
- 不用候选数、严重级数量、积分或工具调用数作为“挖洞准确率”。

## 2. 应有的数据闭环

```text
当前范围与模式
  → 真实来源 artifact / 明确接口声明
  → 可区分服务的 operation + input / branch / consumer
  → 机制明确的候选假设
  → 模式允许的 provider + 身份 / fixture / 观察前提
  → 冻结的 typed recipe 与独立控制
  → 有回执的实际采集
  → 版本化安全 oracle 判定
  → 当前证明核验与精确来源绑定
  → SRC 本地提交准备 / 渗透交付 / 红队成果核实
```

每层都要区分“声明”和“实测”。模型负责提出候选、选择已允许配方和整理草稿；可信代码负责范围、派发、观察提取、结论权限和成本计量。

新增设计对象应在现有账本上增量实现，不另建一套互不相认的漏洞库：

| 对象 | 必须解决的问题 |
| --- | --- |
| 规范化 operation identity | 同路径不同 origin、method、协议、GraphQL operation、媒体类型不能误合并 |
| campaign membership | 冻结活动明确拥有哪些假设、输入、案例和有效证明；共享材料不等于共享成员 |
| verdict / proof basis | 判据版本、实际控制角色、身份、选择器、artifact 值、机制与证明范围可复核 |
| recovery item | inconclusive / blocked / unknown 对应具体原因、已有材料和允许的下一步 |
| execution receipt | 实际 dispatch / response / cancellation / reuse / unknown，以及真实成本 |
| trusted capability profile | 来自当前宿主注册和受控探测，绑定服务代际；模型不能自填 ready |

## 3. M0：先建立判据真值与成本基线

这是所有后续升级的依赖，不能等“功能都加完”再补。

### 交付

- 在现有 `test/` 体系中加入审计反例对应的回归，预期固定为正确行为，而不是“当前错误行为也返回成功”。
- 建立仅本地 / 隔离靶场的 vulnerable / secure 成对实现；返回格式、业务数据与请求预算尽量一致，只改变安全控制。
- 为 native v1、v2 和三个公共模式入口共享真值案例，防止只测内核而漏掉门面、身份、导入、停止和报告。
- 记录基线：有效请求、实际 Python 启动、等待时间、重复请求、字节、离线读取与真实漏洞确认成本。宿主未提供 token 计量时显示 unknown。
- 记录每个案例的机制、目标服务、可用身份 / fixture、模式允许性、唯一漏洞真值与证据检查期望。

### 首批必须进入基准的案例

| 类型 | 必须观察的正确行为 |
| --- | --- |
| 安全参数化 SQL 查询，攻击字符串恰好是合法数据 | 不能创建 SQL 当前机器漏洞证明或 SRC 新停止 |
| 存在真实 SQL 解释缺陷的对应实现 | 只有满足机制特异控制才可确认，影响不超过实际观察 |
| 计算器 / 正常公式接口与不应执行模板的普通文本接口 | 不能仅因得到算术结果就确认模板注入 |
| 模板表达式字面反射 | inconclusive / refuted，不能靠模型 review 升级或停测 |
| 同 E-ID 冒充正常与攻击，或者 actual 不在 artifact 中 | 不授予 trusted detection / stop |
| 两个 origin 同路径的已知案例与证据 | 严格绑定到正确服务，歧义保持 unresolved |
| 登记 ownership 的资源、跨用户与跨租户身份 | 义务不丢失，身份未验证时保持具体前提 |
| 旧 / 新 campaign 先后增加库存 | 旧活动分母和调度成员不被新活动污染 |
| 噪声、选择器失配、缺 provider、过期身份 | 可解释、可恢复，不算安全 refutation 或完整覆盖 |
| 取消、未知写入、响应截断、重复幂等键 | 不自动重放未知请求，正确复用材料，未完成分母保留 |

### 门禁

先保证所有已知安全反例不进入 confirmed / current machine proof，所有不可信 review 不产生新的 SRC 停测。把未来性能与命中改进和同一基线比较；不得用本轮合成耗时当生产性能。

## 4. M1：证明与停测纠错，作为下一次发布阻断项

对应 A-01 / A-02。优先级高于增加任何新漏洞族。

### 4.1 SQL / 模板判据升级

主要修改边界：随包核心 `execution/oracle_profiles.py`、`execution/recipe_builder.py`、`execution/test_runner.py`、`proof_claim.py` 及 v1 对应判据。这些路径相对于 `lib/redteam/assessment-engine/awa_ddd/`。

- 计数、长度、状态码和一般错误差异只产生观察 / 候选，不能单独授予 SQL 漏洞 finding。
- recipe 必须声明真实输入消费点、语法上下文、数据类型、业务基线、观察选择器与允许的证明范围。
- 控制必须能排除正常数据选择、字面反射、合法计算器、时间波动和身份差异；不能只是两个任意正常字符串碰巧结果一样。
- 需要最小的机制特异控制组合；具体配方只在对应本地 secure / vulnerable 实现上证明区分能力后开放。
- 无法确定解析上下文或正确观察字段时返回明确 missing prerequisite，不继续使用固定 `/count` 或 `/value` 猜测。
- observation 从当前完整 artifact 由可信代码提取，不能由模型填写“实际值”。
- 判据版本进入证明依赖。升级版本后重新核验旧证明；不把旧 `supported` 标签直接继承为新版本当前证明。

独立复核应重新核对事实和机制，不只是重放同一个弱判断函数。用于确认的控制若无法排除安全实现反例，整个 provider 不能进入可确认能力清单。

### 4.2 Review 权限分级

主要修改边界：核心 `domain/review.py`、`execution/review_engine.py`、公开 action 契约、受信操作员入口。

| 分级 | 可以做什么 | 不能做什么 |
| --- | --- | --- |
| model / analyst draft | 保存分析、引用已有材料、提出复核请求 | 自授 observed、trusted detection、independent human 或 SRC 停止 |
| machine verdict | 固定 provider + 当前实际控制通过后生成受限证明 | 超出实际 mechanism / target / identity / proof cap |
| authenticated operator verification | 由宿主认证的操作员入口记录实际核实及范围 | 只凭模型提交 `human_independent` 枚举获得权限 |

- control group 必须绑定 run 中真实 controls 的角色、请求、身份和输入，不能靠模型任意重标 E-ID。
- 需要区分独立控制时必须是独立实际材料；仅 E-ID 不同或哈希相同都不自动证明独立性。
- `selector / actual` 重新读取 artifact 对比，引用范围与材料列表必须一致。
- reviewed draft 状态与 hypothesis 的安全 supported 分开，coverage 和报告不能把草稿当 verified detection。
- `record_stop()` 核验受信 verdict 或受信人工核实回执，不能只核验材料“完整且当前”。

### 验收

安全 SQL、正常计算器、字面反射、同 E-ID 控制、伪 actual、伪人类枚举全部不能确认或新建 SRC 停止。有效真实控制仍可确认，证明影响受限，SRC 正确停测并继续显示其他未完成项。

## 5. M2：修复任务模型，再谈自动调度

对应 A-03 / A-04 / A-05 / A-06 / A-08。

### 5.1 保留安全语义与规范化服务身份

- Universe 投影完整保留 ownership、allowed_roles、真实 origin / URL、协议与 operation_name，以及必要的 schema branch / content type。
- 来源区分声明、推断与已观察；模型声明 ownership 可生成待核实义务，但不能替代真实资源归属证明。
- operation identity 至少区分 origin、method、protocol、operation_name、媒体类型和路径模板；实际请求绑定还需确切 input / branch。
- route 和 KnownCase 使用同一个规范化实现；匹配不唯一时返回歧义，不选择列表第一项。
- 不把无来源的配置哈希命名为实际目标 build。没有可靠部署材料时 target build 为 unknown；范围 epoch、库存 snapshot 与目标部署版本分别表达。

### 5.2 冻结 campaign 成员

- 增加明确的 campaign → hypothesis / known_case / operation / input 关联。
- coverage、scheduler、report 与 checkpoint 都经过同一成员投影接口，不再默认读取项目全表作为本活动成员。
- 相同材料和同任务失败历史可以共享，但应用到活动必须检查范围、operation signature、身份、证明版本和来源当前性。
- 动态发现产生新 snapshot / 新成员版本，经明确纳入后才改变分母；不能悄悄改旧冻结 campaign。
- 旧活动不能可靠重建成员时标记 legacy / unknown 并保留历史结果，不伪造“已恢复准确覆盖”。

### 5.3 把尝试过、获得结论和恢复任务分开

建议使用分离状态，不用一个 covered 包办所有含义：

| 状态 / 指标 | 含义 |
| --- | --- |
| attempted | 有实际安全测试尝试，不代表已获得结论 |
| supported_current | 当前机制证明成立且未超范围 |
| refuted_current | 有适用且足以否定该命题的真实控制 |
| inconclusive | 测过但不能得结论，仍留在未完成分母 |
| blocked / unknown | 前提缺失或能力未知，独立显示 |
| stopped | SRC 已触发停止，禁止为了补覆盖继续测试 |

恢复项分类为：缺身份、缺资源归属 / fixture、消费点未知、观察选择器失配、控制不独立、响应噪声、provider 缺失、运行件缺失、未知派发与 SRC 停止。

每项返回已有 run / E-ID、具体前提、允许的 action、准确 `next.arguments`、offline_only / target_request_required 与 automatic_retry_allowed。优先离线读取、重评已有控制和补齐真实前提；不因 inconclusive 自动重新发送请求。

仅在真实前提补齐或可辨别控制变化后生成新 recipe；原失败历史、未知写入、cooldown 和 SRC 停止继续有效。仅改时间戳、分页、标题或行政状态不算新进展。

### 5.4 清理噪声假设

- 字段名按 snake_case / camelCase / JSON Pointer token 分词，而不是子串命中。
- 结合类型、约束、接口语义与已有 AST 消费证据；`profile_id` 不因含 `file` 就成为上传义务。
- 同目标 / 输入 / 机制合并重复来源，保留每条来源引用与可信程度。
- 无法确定机制时保留 discovery gap，不凭关键词制造看似高价值的测试义务。

### 验收

ownership 反例生成应有义务；两个 origin 同路径独立匹配；新增 campaign 不改变旧成员。一次 inconclusive 必须呈现“尝试 1、确定结论 0、未完成 1”，并给出离线复核或具体前提，而不是无任务可选且没有恢复说明。

## 6. M3：执行和交互降本，不删除守卫

对应 A-09 / A-10 / A-12。M1 与 M2 通过后再引入执行优化。

### 6.1 有界原生批量 worker

主要边界：`lib/redteam/assessment-batch.js`、`lib/redteam/awa-integration.js`、`lib/redteam/native-assessment.js`、固定 bridge 与原生 transport。

先实现**一次调用内的固定原生批量 worker**，不要一开始引入常驻服务、任意脚本或跨项目运行后端：

- 宿主只启动本安装的固定模块，固定 workspace / project / mode，沿既有 JSON 校验与取消协议。
- 已初始化上下文中，一个 batch 的状态校验与逐项执行由同一 worker 完成，目标为最多一次 worker 启动；这是待验收目标，不是当前能力。
- 不跳过 scope、exclude、身份、Cookie、证据当前性和 SRC 停止；每项派发前重新核对动态状态与版本，不能把第一项通过当整批通行证。
- 每项保留独立幂等键、run 状态、实际 dispatch 与保存回执；取消、截断或未知派发立即中止后续项。
- 默认串行，保持现有最多 20 项只读 batch 边界。只有规则与操作者配置允许时才引入有界并发。
- worker 或连接池的复用按 engagement、模式、origin、身份代际与凭据目的地隔离；不同身份不能共享认证状态。
- 长期 worker 仅在首次优化仍有测得瓶颈后评估，并有服务代际失效、凭据清理与退出回收。

### 6.2 连接与材料复用

- 同 origin / 同身份代际的连续请求可以复用连接；服务端关闭后只能按已知状态重新建立连接，不自动重放未知派发。
- Cookie 的 origin / path / Secure / expiry / 覆盖与删除继续私下处理，禁止把连接复用变成 Cookie 越界。
- JSON 结构、AST、sourcemap 和脱敏投影按完整材料哈希缓存；有界内容读取不重复启动原生解析。
- 请求材料复用需明确 freshness、输入、身份、operation signature 和证明用途；同 URL 不是同命题，同请求也不自动保证目标状态未变化。
- 不完整、截断、过期或旧 lineage 材料不可用于确认。复用结果必须标明原 E-ID 和未产生新请求。

### 6.3 能力就绪与身份最短链

- `skill.index` 消费当前宿主的受信工具注册和已验证 runtime profile，绑定安装路径、服务代际、模式与有效期；不接收模型自填 capabilities。
- HTTP ready、Python ready、browser module ready、browser executable ready 分开；浏览器缺件不阻断已满足前提的 HTTP 验证。
- 身份流程返回最短合法下一步：已有 Cookie 证据 → 未验证会话 → 实际服务端身份 / 角色核验 → 对应安全控制。
- 复用已有 `value.hash`、`identity.session_from_evidence`、`identity.verify` 和脱敏结构读取，不新建任意代码执行快捷通道。
- 认证、测试与 fixture 前提按当前模式执行；SRC 凭据与业务写入限制不因工作流便捷化而放宽。
- 提示只显示本模式当前阶段与可执行前沿；专题按需读取。不要把长 runbook 每轮重复粘贴当作“增强智能”。

### 6.4 需求驱动工具路由：让 AI 需要时想到并选对

不能以“工具已安装 / 能启动”替代按需调用。补充依据见 [工具调用与路由专项审查](TOOL-ROUTING-AUDIT-1.11.0.md)。先修当前浏览器判据字段、能力回执、TLS 与 WSL 包装动作问题，再增加调用触发。

- 从真实页面消费需求、operation / input / 身份 / fixture、既有 scanner 结果和当前 mode / backend 推导工具需求，不能只从漏洞关键词猜工具。
- 路由输出 provider、受支持 profile、事实依据、readiness 来源、准确准备参数、允许的执行参数、缺失前提、证明去向与合法 fallback。
- DOM / SPA / 跨站 / UI 需要实际消费观察时推荐 Playwright；单纯静态证据可离线处理时不无目的打开浏览器。
- 公开 GET 原始重放需求匹配当前 Yakit profile；必须校验 MCP schema、TLS 和 redirect，认证需求不能通过丢弃身份强行适配。
- 当前靶标已有 TscanPlus namespace 和结果时优先读取 summary / results / routes，减少重新扫描；原 scanner 声明仍不能确认漏洞。
- WSL 是已配置的执行后端，不是模型任意选择的万能工具；联合检查发行版、路径、解释器、浏览器与控制 endpoint，禁止 Windows 直接执行 Linux 路径或私自切换后端。
- 把 provider 可发现性与实际 readiness 接入技能索引、workflow 和人设的共享来源；避免握手成功但不支持 profile 的假 ready，以及已配置仍 unavailable 的假受阻。
- 陌生参数先给精确 action.help / 准备入口，获得真实绑定后再推荐执行；不要给模型一长串工具名让它自行撞参数。
- 推荐本身不派发请求；实际执行继续通过原范围、身份、fixture、取消、真实进展预算和 SRC 不可撤销停止。
- 记录实际工具选择与调用，不要求读取模型隐式思维。用真实模型场景回归验证“必需时选对、不需时不选、缺前提时准备、禁止时不调用”。

单独统计工具选择召回 / 精度、参数合法及语义绑定率、就绪后执行成功率、预期观察 / 证明闭环率和不必要请求成本。当前没有真实模型选择基线，指标先测再定门槛，不能把模拟适配器通过或口头“我会用”当达标。

### 验收

已准备上下文的 2 / 20 项 batch、精确幂等复用、同 / 异 origin、同 / 异身份、Cookie 删除与过期、取消、并发新增停止全部实测。统计实际 Python 启动与发送数量；任何 unknown 不伪装成 0。性能改善必须在相同有效验证与请求预算下成立。

## 7. M4：优先补齐真正有用的验证 provider

对应 A-07。按高频缺口排序，不一口气宣称支持全部漏洞族。

### 7.1 第一优先：访问控制、IDOR 与租户边界

- 将已验证的两个测试主体、实际角色、租户与受控资源归属接入配方。
- 构造合法访问、非授权主体访问及必要匿名 / 阴性控制，保持资源、输入与业务状态可比。
- 观察实际受保护对象或授权行为；HTTP 200、长度差异、客户端角色声明都不能单独证明越权。
- 区分用户级、角色级、租户级与业务状态边界，生成精确 proof scope。
- 前提缺失时给 identity / ownership / fixture 的具体恢复路径，不把匿名 401 算作完成身份间测试。

首先在渗透和有范围红队允许的测试身份契约中实现。SRC 不具备或禁止的身份前提保持 blocked；不能拿切换 preset 绕过模式限制。

### 7.2 第二优先：上下文适配的 SQL / 模板

在 M1 的判据纠错上补齐结构选择器、真实语法上下文与类型约束。每种适配都需要安全实现、漏洞实现、字面反射、正常业务计算和噪声对照；无法适配的维持候选，不自动降级成弱 count / length oracle。

### 7.3 第三优先：实际浏览器消费的 XSS

- 使用现有固定 Playwright 入口与独立身份上下文，保留模块 / 浏览器运行前提。
- 建立来源输入 → 实际消费页 / DOM sink → 可观察影响的证据链。
- 区分反射、DOM 与存储型；正确转义、纯文本显示和不可达 sink 为阴性对照。
- 非执行字符串反射不能确认 XSS；无真实浏览器运行回执则保持候选。
- 写入或多角色场景只在模式与受控 fixture 允许时执行；SRC 现有浏览器观察与写入禁用边界不变。

### 7.4 后续：SSRF / 路径 / 上传 / 业务逻辑等

逐项实现最小 typed adapter 与固定观察契约：使用明确授权的控制端、非执行 canary 和受控 fixture，不使用任意外部执行体。

SSRF 要区分实际服务端访问与客户端 / 代理行为；路径类要区分授权内容与测试可读材料；上传类要核实实际存储 / 消费，不把上传成功当执行；业务逻辑要有服务端前后状态和合法流程控制。

未知写入必须先核实实际 fixture 状态，不自动重试或清理。所有 SRC 禁用项仍为 blocked；检测矩阵显示“模式允许 / provider 实现 / 实际前提 / 判据可确认”四个不同维度。

### Provider 上线门禁

每个 provider 交付固定输入契约、消费点要求、控制独立性、实际观察提取、证明范围、严重级上限、效果 / fixture 契约、取消恢复和 secure / vulnerable 基准。缺任一项只能是实验性候选 provider，不能创建 confirmed 或宣称自动覆盖。

## 8. M5：发现与情报变得有针对性，红队成果变得可核实

### 8.1 证据驱动的攻击面图

- 复用现有 JavaScript AST、OpenAPI / mappings 和 sourcemap 入口，增量建立 origin → route → input → consumer → 数据对象 / 身份边界图。
- 把 sourcemap 的 `sourcesContent` 纳入有界跨模块引用与输入 / sink 检索；声明源码路径仍不用于落盘。
- indexed sourcemap 等扩展必须限制递归、总大小、source 数和哈希目录；缺片、动态表达式与未解析模块保留 gap。
- 动态 URL 或声明路由只生成候选；目标请求仍需要精确 URL 和逐项 scope 校验，不自动追踪声明中的外部域。
- 参数类型、约束与服务端消费机制优先于字段关键词；所有推断保留来源与置信类别，不能自升 observed。

### 8.2 组件情报与去重

- 本地 NVD / KEV / GHSA 缓存继续只提供候选，保存来源和未验证声明，不把 CVE 命中直接写漏洞表。
- 候选排序加入实际运行组件证据、可达入口、相关配置 / 权限前提；复杂版本逻辑或运行状态未知继续 unknown。
- 按规范化服务、输入 / branch、机制和根因合并重复候选，保留全部原始来源和未确认材料。
- 不因热点 CVE、版本号或模型自填高影响而提高严重级；当前目标最小验证仍须单独完成。

### 8.3 红队成果核实

- 为少量明确的高价值成果定义受信、同目标的实际授权行为核实契约，或认证的人工验收入口。
- 采集器固定实现、固定输出 schema 和可信身份，绑定实际目标 / 服务、观察材料、成果 code 与基础档位。
- 普通工具输出、漏洞证明和模型填写的 `score_outcome` 不能冒充权限成果。
- 未实现采集器的成果明确 pending；默认高价值校验保持开启，操作者既有显式偏好保留。
- 链路节点分别显示候选、已观察与已核实成果；积分是交付辅助，不是漏洞准确率或权限机器证明。

## 9. M6：真实成本调度与端到端发布门禁

### 9.1 用实测替代调度常数

先修 `_tool_yield()` 占位值和运行关联，再考虑调度模型。每个 provider / family 记录真实准备成本、请求数、耗时、inconclusive 原因、当前证明产出与复用收益；缺数据为 unknown，不把 null 填成好看的 0。

可解释排序由以下因素构成：校准的历史命中可能性、操作者定义的业务重要性、新覆盖收益、前提就绪度，以及测得的执行成本。

- 业务重要性不取模型自填 impact，命中概率不取模型自评 confidence。
- 共享身份 / fixture 的前提可聚合准备，避免每个假设重复登录或重复读取结构。
- 保留 family 探索公平性，避免低成本 SQL 永远挤占访问控制与业务逻辑。
- 只从当前 campaign 成员派发；全靶标共享范围、停止、实际委派 lease、速率预算和同任务失败历史。
- 401 / 403 / 429 分开处理；平台零发送拒绝与目标响应分开计量，不自动解释为 WAF。
- 无实际进展时仍遵守既有三次提醒限制；离线建议不得安排未经当前工作流允许的新目标请求。

### 9.2 必须公开的指标

| 指标 | 口径与防作弊要求 |
| --- | --- |
| Precision | 真值复核的唯一真实漏洞 / 所有被确认的唯一漏洞；不是候选通过率 |
| Supported-family recall | 命中的唯一真漏洞 / 固定支持清单中、模式允许且前提具备的真漏洞 |
| 整体能力缺口 | 另列不支持、模式禁止、前提缺失的真值项，不能删分母让 recall 变好看 |
| Wrong-proof / wrong-stop | 安全实现被确认、错误服务确认和不可信 review 触发停测的数量 |
| Conclusive coverage | 适用命题中有当前有效 supported / refuted 结论的比例；attempted 单列 |
| TTFV | 首个经真值复核漏洞的时间；首个候选时间另列 |
| Requests per confirmed | 实际出站请求 / 唯一真实确认漏洞；0 漏洞或发送不明时不给虚假比值 |
| Duplicate-request rate | 无 freshness / 控制必要性的新重复请求占比，明确原材料复用 |
| Runtime / token cost | 实际启动、CPU / 等待、字节和可信宿主 token 用量；未知不伪造 |
| Submission quality | SRC 本地材料、证明、查重口径与未完成项；平台接受必须另有平台事实 |

基线目前不能据现有材料给出真实 precision / recall，必须先测。建议初始留出基准目标为 precision ≥95%、受支持族 recall ≥85%；这只是验收目标，不是本项目已达指标或真实环境保证。

每个模式 / 漏洞族报告样本量、失败明细和置信区间；小样本不足以支持总体百分比。已知安全反例必须零错误确认、零错误新停止，即使总体指标看起来合格也不能豁免。

效率可设置同基准、同预算、同正确性下中位耗时降低 30% 的工程目标，但未实测前不能宣称已加速。降低请求数不能靠省略独立控制或少测漏洞族达成。

### 9.3 验收层次

1. 单元：oracle、投影、origin identity、membership、状态与角色绑定。
2. 隔离集成：实际本地安全 / 漏洞服务、SQLite 真值、两个 origin、多身份 / 租户、取消与隐私。
3. 三模式公共入口：准备 → 配方 / 身份 → 采集 → 复核 → 来源导入 → 报告 / 停止，确保内核与外层语义一致。
4. 真实本地浏览器：实际模块与浏览器、独立上下文、真实消费页与有界观察，不拿缓存文件当运行证明。
5. 专用 DSH 副本：实际预设加载、工具守卫、父子绑定、委派 cap、取消、turn-stopping 与 GUI 报告。
6. 授权预生产：操作者明确范围、规则与预算后验证实际目标工作流；不默认访问真实第三方或改变正式宿主。

缺件层必须标记 skipped / unknown / 未验收，不算通过。不用 mock、已有注册回执或旧 Loader 结果替代真实运行验收。

## 10. 迁移、兼容与交付约束

- 新 schema、oracle 和 proof 版本显式迁移；旧原始材料、文字、标签与 receipt 保留。
- 旧证明不符合新判据时显示 pending / legacy，不伪造历史“当时已经通过新判据”。
- 两层 SRC 停止台账都不自动删除、编辑撤销或重新开放。错误依据只追加审计标记；确需新任务由操作者按规则新建独立 engagement，不能自动续跑旧停止目标。
- origin / operation identity 迁移有明确 old → new 映射；冲突无法消解时保持未关联，不把不同服务材料合并。
- 旧 campaign 成员缺证据时维持 legacy / unknown，不用全项目当前库存补成“历史冻结范围”。
- 保留固定模式、session 绑定、scope / exclude、分页 token、凭据句柄、用户提示词与操作者偏好；模型不能切换后端、workspace 或另一个安装。
- 修改随包评估核心须按既有审阅与 provenance / SHA256 流程维护来源，保留 MIT / NOTICE，不运行时搜索或同步外部 AWA。
- 模式正文、技能、面板与兼容控制台按现有共享生成源更新；发版时才同步版本与文档并执行相应检查。
- 单独列出源码完成、隔离验证、浏览器、宿主、授权目标、打包 / 发布 / 安装等状态，不用“升级完成”一句话覆盖全部。

## 11. 可拆分的实施工单

| 顺序 | 工单 | 主模块 | 完成定义 |
| --- | --- | --- | --- |
| 1 | 安全实现成对基准与审计反例 | 现有 `test/`、隔离 fixture | 可重现旧问题，修复后断言正确安全语义 |
| 2 | SQL / 模板判据及 proof version | 原生 oracle / recipe / proof | 安全反例不确认，有效机制证明能确认 |
| 3 | review 草稿权限与 SRC 停止准入 | 原生 review / assessment_mode、可信入口 | 自填 actual / reviewer 无法授予结论或新停止 |
| 4 | ownership 投影与 origin identity | universe / hypotheses / campaign | 归属义务不丢失，同路径跨服务不混淆 |
| 5 | campaign 成员与恢复状态 | coverage / scheduler / reporting | 分母稳定，inconclusive 有准确恢复但不重放未知 |
| 6 | 去噪与真实执行计量 | hypothesis rules / receipts / tool_yield | 垃圾假设减少，未知成本不填零 |
| 7 | 固定原生 batch 与隔离复用 | Node 门面 / bridge / transport | 降低启动开销，所有动态守卫与取消测试通过 |
| 8 | 受信 readiness 与身份工作流 | skill / readiness / auth / workflow | 缺什么、如何补齐、哪些模式禁止一眼可见 |
| 9 | 访问控制 → SQL / 模板适配 → 浏览器 XSS | typed providers 与真值 fixture | 每项各有安全 / 漏洞对照及公共入口验收 |
| 10 | 证据攻击面图、情报去重、成果核实 | discovery / intel / score collectors | 候选更聚焦，成果权限不由模型自授 |
| 11 | 成本调度与真实宿主端到端 | scheduler、CI、专用宿主 | 指标可复算，实际守卫 / 委派 / 取消已验收 |

建议分小批次交付：M0+M1 为正确性批次，M2 为任务模型批次，M3 为效率批次，M4 每个 provider 独立批次，M5/M6 在基准证明有收益后推进。不要把所有功能堆成一次大版本再靠“全测通过”掩盖判据盲区。

**最终成功标准：不是工具更多、模型更敢、报告更长，而是同一规则和预算下，错误确认更少，正确确认更多，每个正确漏洞耗费更低，未完成与不支持项更透明。**
