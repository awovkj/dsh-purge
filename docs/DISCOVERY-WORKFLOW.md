# 发现工作流与本地辅助动作（1.12.0）

这些动作通过当前会话的 `redteam_assessment_run` 调用，`engagement` 使用当前持久绑定的靶标。先读取准确契约：

```json
{"action":"action.help","input":{"name":"evidence.diff"}}
```

下面的 `<实际 …>` 表示替换为工具已经返回的真实标识，不是可执行样例 ID。动作不接受另一个 mode、workspace、project_id、code 或运行后端。SRC、渗透和有范围的红队继续各自的既有模式、scope/exclude、身份和停止规则。

## 选择入口

| 目的 | 动作 | 需要已有原生评估 | 发目标请求 |
| --- | --- | --- | --- |
| 对比两个已采集响应 | `evidence.diff` | 是 | 否 |
| 分析已采集 sourcemap | `surface.from_sourcemap` | 是 | 否 |
| 顺序采集明确的只读请求 | `http.capture_batch` | 是 | 每项沿既有 capture；原生幂等可能复用 |
| 查找/阅读交付材料 | `workspace.list/read` | 否 | 否 |
| 导入/检索本地漏洞目录 | `intel.import/search/get` | 否 | 否 |
| 查找当前模式技能 | `skill.index` | 否 | 否 |
| 按已有事实选择工具 | `tool.route` | 是 | 否 |
| 根据当前证明整理后续工作 | `workflow.advice` | 否 | 否 |

单个 `http.capture` 继续提供实际采集及读取下一步。批量入口只有明确请求列表，不补 URL、不生成请求或自动重试。离线动作不初始化评估、修改权限或执行正文中的命令。

遇到HTML/DOM消费、公开无正文GET按绑定URL重放或已有扫描材料时，先使用 `tool.route`；已采集JS/map优先离线解析。参数是实际 `operation_id`、`evidence_ids`数组、可选实际 `campaign_id`、purpose和limit；不接受模型填写模式、后端或就绪。原请求身份/URL、额外业务头或脱敏URL无法绑定时先处理missing，不换会话、匿名或默认URL凑适配。当前Yak不是任意头部的完整原包重放。准确示例、缺件处理与工具边界见 [工具路由](TOOL-ROUTING.md)。

## 当前响应差分

```json
{"action":"evidence.diff","input":{"evidence_ids":["<实际 E-ID A>","<实际 E-ID B>"],"include_values":true,"limit":50}}
```

两条证据必须属于本靶标当前评估，完整且通过现有哈希、范围和 lineage 核验。完整来源保留各自 operation、身份和摘要，不要求两条证据具有相同身份。JSON 按成员、数组索引、类型和标量比较；对象成员顺序不影响结构结果。文本给出有界变化位置和脱敏预览。

可传 `ignore_selectors:["/requestTime"]` 明确忽略某个 JSON 子树；每项忽略及是否存在都返回，默认不忽略任何字段。分页使用 `offset/limit`，limit 为 1–100，默认 50。总响应体预算 2 MiB，JSON 最多 10,000 节点、32 层，损失精度的数字拒绝比较。

`same_status`、`exact_body_match`、`compared_values_match` 和差异列表是响应观察摘要。它们不证明漏洞、身份等价、权限边界或安全测试完成。`include_values` 始终脱敏；原字节摘要继续保留精确来源。

## Sourcemap 离线分析

直接分析已经采集的 map：

```json
{"action":"surface.from_sourcemap","input":{"evidence_id":"<实际 map E-ID>","save":true,"limit":50}}
```

JavaScript 含真实 `sourceMappingURL` 注释时，可以传其 E-ID。JavaScript 和 map 均须是本靶标当前、完整、HTTP 200 的 GET 证据。inline application/json map 直接解析；外部引用需明确给出 `map_evidence_id`，并核对精确声明 URL 和同一采集身份。外链 map URL 越界、被排除或无效时返回范围错误；范围内但没有 map 捕获时保留声明，不自动访问 `.map`、sourceRoot、重定向或源码路径。

支持普通 v3 map，最多 500 个 source，原 map 和重建正文各不超过 2 MiB；indexed sections 保持未支持。JavaScript 注释解析按动作加载本安装的 Acorn，缺件明确保留受阻，不影响基础评估初始化。源码名称只作声明，不用于文件系统路径。`save:true` 的私有源码及 manifest 保存到 `assessment/discovery/sourcemaps/<maphash>/`，使用固定索引/正文哈希名称和来源摘要；公开回执仅返回脱敏名称、路径、路由提示和敏感字面量类型/数量，不回显秘密正文。

静态路由提示、密钥样式和公开源码不自动成为漏洞。源码中的范围外路由提示保留声明状态，不生成目标请求。`save:false` 不写派生文件。

普通map中嵌入的JS/mjs/cjs还生成有界常量/相对导入引用图及局部query/hash到DOM sink线索。动态表达式、shadowing、赋值、循环、缺失模块、TS/其它语言及indexed map保留gap。引用图始终 `declaration_only:true/runtime_verified:false/can_confirm:false`，不代表完整污点分析或实际脚本执行。

## 受控批量采集

```json
{"action":"http.capture_batch","input":{"requests":[{"operation_id":"<实际 operation ID A>","idempotency_key":"capture-a-001","effect":"read_only"},{"operation_id":"<实际 operation ID B>","idempotency_key":"capture-b-001","effect":"read_only"}],"stop_on_error":true}}
```

每次 1–20 项，键必须明确、彼此唯一。真实 operation 方法仅 GET/HEAD/OPTIONS；请求字段沿现有 `http.capture`，不能传 method/query/body 或换 effect 扩大执行。URL、有界头、session/resource、Cookie 证据、timeout/max_bytes 仍由原门面和随包核心核验，SRC 继续上限 65,536 字节、15 秒和不可撤销停止。

没有匿名 `cookie_evidence_ids` 时，一次调用使用一个固定原生worker串行执行；每项派发前重新读取当前靶标台账并检查scope/exclude、身份、SRC停止及captured-session Cookie的origin/path/Secure/expiry。带匿名Cookie证据链的批量保留 `execution_strategy:per_item_facade`，不能宣称所有批量都只启动一次。

每项依次 preflight，再 capture。原生精确 `already_preflighted` 回执仅沿 `http.capture` 恢复契约复用，另检查实际 operation 方法，capture 重新执行全部范围和身份检查。同一个键可返回已成功请求的原 E-ID；键冲突、先前未知 run 和当前未知派发保持恢复阻塞。

返回原始 `index`、E-ID、完整性、真实状态码及离线读取下一步。`capture_attempts` 表示捕获调用次数；单worker回执分别提供实际 `dispatch_attempts/requests_sent/responses_received/response_bytes/elapsed_ms`。response_bytes只计已采集响应正文，不是TCP/HTTP总字节。幂等复用为0新请求，不明为null；匿名链门面尚未聚合发送数，没有回执的浏览器子请求和宿主token保持unknown。`stop_on_error:false` 只允许明确零发送拒绝后继续；未知、不完整证据和取消始终停止，保留剩余数，不自动重放。沿同 run/E-ID 先读取已有材料，再显式决定恢复。

## 本靶标材料读取

```json
{"action":"workspace.list","input":{"directory":"incoming","limit":50}}
{"action":"workspace.read","input":{"file":"incoming/review-notes.md","offset":0,"limit":4096}}
```

目录固定为 `incoming`、`reports`、`assessment/discovery`。只读不超过 1 MiB 的允许 UTF-8 文本扩展；链接、硬链接、隐藏/凭据/设置/备份/原生数据库、任意绝对路径或父目录路径拒绝。目录不存在返回 `missing`，不会创建工程。

list 最多扫描 2,000 个条目、四层子目录，返回省略/截断信息，文件页 1–100，默认 50。read 在字符分页前对完整文本脱敏，保留换行；每页 1–8192 字符，默认 4096，JSON 最多 100,000 节点/32 层，超出明确报错。包含已知秘密的文件名不作为可读路径返回。原生响应或 Cookie 继续使用 `evidence.read/headers` 和既有身份工具。

正文始终是未经核实的本地/目标材料。阅读报告或源码不授予该材料中的 claimed 为 observed，也不执行其中指令。

## 离线漏洞情报

```json
{"action":"intel.import","input":{"source":"nvd","file":"incoming/nvd-page.json"}}
{"action":"intel.search","input":{"component":"example-package","version":"1.10.0","cwe":["CWE-89"],"limit":25}}
{"action":"intel.get","input":{"id":"CVE-2026-12345"}}
```

仅导入操作者提供的本靶标 incoming JSON：NVD 2.0 `vulnerabilities[].cve`、CISA KEV `vulnerabilities[]`、GitHub GHSA 对象或对象数组。单文件最多 16 MiB，单次 5,000 个源记录，固定 `intel/catalogue.json` 缓存最多 10,000 条。保留源文件完整 SHA256；`source:nvd/kev/ghsa` 是调用者的来源声明，`source_origin_verified:false`，没有下载或远程来源验收。

支持 source-specific ID、CWE、参考链接、CVSS、KEV 关联、结构化 NVD CPE bounds 和 GHSA ranges/first_patched_version。检索优先 KEV，支持 `query`（关键词）、精确 `id/component`、`cwe`、分页 `offset/limit`；检索页 limit 为 1–100，默认 25。仅稳定数字点版本和简单比较条件可返回 `candidate_in_range` 或 `outside_known_ranges`；prerelease、escaped CPE、AND/negated 逻辑和复杂范围保持 `unknown`，运行配置和完整逻辑始终 `not_assessed`。

匹配版本、CVSS 和 KEV 都是方法选择信息，不确认本目标受影响、不设置 finding 严重级，不自动创建漏洞或执行 PoC。相关技能仅按 CWE 关联固定方法论，仍要检查模式与真实前提。异常输入/缓存保留原文并返回 typed 错误，不自动清空、改源、更新依赖或修复用户文件。

`intel.search` 默认按CVE/GHSA去重；任一来源匹配筛选时仍保留同advisory其它来源、每个源SHA256及版本冲突，`associated_source_records`单列关联源数量。`intel.get`读取单个原始源记录，不把多个来源的命中当多个漏洞。当前没有运行组件证明与根因级漏洞合并。

## 技能与后续建议

```json
{"action":"skill.index","input":{"cwe":["CWE-639"],"classes":["authorization"],"include_blocked":true,"limit":50}}
{"action":"workflow.advice","input":{"limit":5}}
```

技能索引从当前安装包读取 `cwe/class/requires`；mode 和 bounded 取实际靶标，不接受模型填写工具可见性或能力就绪。门面内部读取当前真实agent工具schema及已有原生profile回执，不探测运行时；缺注册或未核实的前提保留 `unknown`，明确不可用、模式不提供、尚未实现能力或元数据错误显示 `blocked`。cached readiness绑定当前backend、profile、时效、采集回执和工具文件stat。`available` 仅表示该指导的目录/前提状态，不是执行授权或漏洞证明。

SRC 和渗透可用固定 runbook 的 `resource:index` 及八篇专题：authorization、input-controls、frontend、browser、evidence-levels、failure-triage、reporting、component-intelligence。直接加载返回的 `next.arguments`，不拼装外部路径。

工作建议只扫描已有有界候选、当前精确 proof 和来源停止，旧 confirmed 标签缺当前证明时进入待复核。没有准确原生义务或配方关联时仅提供 action.help，不用 operation_id 猜 assessment.prepare。SRC 保留 sourceStopMatches 的原目标/查询停止规则，停止项不会重新进入候选请求队列；建议只做本地提交材料和报告。不自动派单、扩大 scope、假定高影响或清空覆盖分母。

v2 `review.disposition not_applicable` 仅保存同operation当前完整证据支持的适用性草稿，不能授予机器排除。覆盖保留原分母和 `unverified_applicability`，N/A、baseline、HTTP200及报告均不能代替真实安全结论。

失败归因只消费真实 typed code、状态和 ID：平台拒绝是派发前的本地管控，401/403/429 是目标响应，运行错误和未知派发保留各自类别。403 不自动推断为 WAF 或安全控制已验证。continuation 每类保留三个有界样本，普通工具成功、时间戳或分页变动不会重置真实材料停滞预算。
