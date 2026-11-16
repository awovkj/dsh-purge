# 三模式1.12.0实施与验证

持续实施日期：2026-11-15至16。依据 [三模式优化方案](THREE-MODE-OPTIMIZATION-PLAN.md)、[1.11.0源码审计](THREE-MODE-AUDIT-1.11.0.md) 及 [工具路由审计](TOOL-ROUTING-AUDIT-1.11.0.md)。本页汇总本轮源码、生成物和实际验证，不把旧审计错误断言或1.10.0 Loader回执当作新版本验收。

## 正确性与证明

- SQL Boolean改为真实非空quoted_string_equality基线及两组独立true/false，共五项控制。精确请求、输入、身份、选择器和互异完整E-ID均重验；count-only差异不能授予SQL当前证明，级别上限medium。
- 模板仅适配显式jinja_expression和非计算器消费点，使用字面、有效表达式、不完整语法及第二算式四项独立控制。字面反射和正常业务计算不确认。
- 模型review保存reviewed_draft；self-filled actual/human_independent不产生supported、finding或SRC新停止。review.bind只能复用当前机器证明，标题/影响不能扩大机器claim。
- 新SRC停止必须具备当前安全证明；旧停止保持不可撤销。baseline、401、HTTP200和报告不覆盖未完成安全测试。
- 收尾回归发现普通v1 analyst草稿错误进入SRC停止校验并抛Unknown obligation。草稿现在保留reviewed_draft证明分类，不自动停测；显式record_stop也返回src_stop_proof而非接受草稿。精确绑定的本地浏览器或机器证明仍完整重验。旧间接配方测试已改为真实冻结campaign成员，不放宽生产成员约束。
- 复审发现的N/A漏洞已修：not_applicable仅保存同operation当前材料支持的inferred草稿，verified:false/can_exclude:false；保留原分母及unverified_applicability，不授予exhaustion。机器适用性排除provider尚未实现。

核心变化位于随包 `execution/input_contract.py`、`oracle_profiles.py`、`review_engine.py`、`proof_claim.py` 及v1评估契约；来源门面继续使用当前精确finding-proof核验。

## 活动、发现与恢复

v2 membership冻结HYP/case/gap和初始状态，campaign_hypothesis独立投影本活动状态。coverage、scheduler、run、finding和report使用相同成员视图；新增活动不污染旧分母，也不继承旧run的证明。实际尝试、冷却、未知效果、lease和SRC停止仍全靶标共享。

KnownCase按origin、method/protocol/media及真实input匹配；歧义保持blocked。ownership、角色与租户义务保留。字段按token去噪，profile_id不因包含file制造上传任务。inconclusive保留尝试与未完成分母，返回离线复核或明确前提，不自动重放。

同活动离线verify从实际run寻找配方；多个配方必须明确recipe_id/run_id，不依赖不存在的recipe.campaign_id。多个活动共用HYP时disposition要求实际campaign_id。旧campaign缺冻结材料时保持legacy_unknown。

普通source map的sourcesContent增加有限JS引用图：常量、相对导入、fetch/axios及局部query/hash→DOM sink线索，保守处理shadowing与赋值。动态、循环、缺失模块、TS/其它语言及indexed map保留gap。固定hash目录、不按声明路径落盘、脱敏和完整来源不变量保留。

intel.search默认按CVE/GHSA去重，任一源匹配后保留关联其它源与版本冲突；intel.get仍读单个原始源。源SHA256、版本范围、KEV/CVSS均不授予本目标漏洞或严重级。运行组件证明和根因级漏洞合并尚未实现。

## 工具、身份与执行成本

新 `tool.route` 读取当前实际operation/evidence/campaign及native profile回执。已有JS/map优先离线；HTML材料或明确HTML/DOM消费需求触发Playwright；公开GET重放使用Yak fuzzer/TLS/no-follow；TscanPlus读取绑定namespace的已有结果。WSL使用操作者固定后端，模型不能填写ready、工具表或运行位置。

路由、顶层工具描述、共享模式政策、技能和workflow均提供触发。缺camp的身份workflow不再输出不存在的campaign.next参数；当前campaign.next建议携带真实operation。认证重放备用路径保留已核实session_id，Cookie不匹配时返回身份准备，不丢弃身份。SRC停测建议只读已有材料。

继续复审修复了提供E-ID后仍默认挑首个允许会话、回到operation默认URL的问题：native建议绑定唯一实际请求、身份和代际；多请求/身份歧义、匿名Cookie和不能保留的额外业务头不安排执行，实际绑定URL也重查SRC停止。公开输出若脱敏了URL，next/fallback明确转为准备状态，不拿占位文本或丢query后的URL凑适配。当前缺通用私有请求句柄执行入口；Yak只构造公开无正文GET，不是任意头部的完整原包重放。

readiness绑定backend/profile、完整probe artifact、30分钟TTL及工具stat，区分模块/浏览器文件/实际launch；codec-only、缺TLS、旧回执、替换文件、跨backend或namespace不保持ready。WSL包装动作转换明确文件字段并私下传递允许的操作者浏览器环境，不重编码URL/正文或接受任意环境。

没有匿名cookie_evidence_ids的1–20项只读batch使用一个固定native worker。逐派发重新读取固定靶标台账，核scope/exclude、身份、Cookie origin/path/Secure/expiry及live SRC停止；匿名Cookie链仍使用per_item_facade。独立幂等键、取消、截断和未知派发守卫保留。

单worker回执分别计量实际dispatch_attempts、requests_sent、responses_received、已采集response_bytes及elapsed_ms；正文bytes不等于网络总bytes。精确复用为0新请求，未知为null。campaign成本仅归因本活动实际test runs，其它工具保留inventory；没有可信宿主tokens或浏览器子请求回执时保持unknown。成本排序使用实际family/backend耗时中位数并保留family公平，命中概率仍为未校准启发式。

## Provider边界

| Provider | 本轮实现 | 验证边界 |
| --- | --- | --- |
| SQL Boolean | 真实基线、双组布尔控制、当前有界证明 | 真实SQLite查询真值；HTTP传输在安全机制反例中模拟 |
| 模板 | 显式Jinja表达式消费契约和四控制 | 安全/计算器/模板响应fixture，未做真实部署模板服务 |
| GET访问边界 | authentication_enforcement、role_authorization、principal_tenant_boundary | 核实不同主体、角色/租户、同对象及精确受保护数据；HTTP仍模拟 |
| 反射HTML XSS | 独立native浏览器控制、实际消费hash、精确dialog/URL、原生run闭环 | 浏览器观察模拟；实际Playwright尚未运行 |
| 其它族 | 保留声明、手动已有typed契约和未完成项 | 未实现自动provider不授予覆盖或finding |

浏览器松散xss_evaluate保持inconclusive。状态、长度、客户端角色、字符串反射或扫描标签不授予安全证明。高价值权限成果采集器仍未实现，默认策略保持pending，普通工具或漏洞输出不能获得权限成果。

上述机器判据证明的是固定契约下的有界行为；登记consumer/test_contract/allowed_roles不独立核实实际业务意图或平台规则。合法模板编辑、查询功能或正常业务授权仍需来源与安全边界复核，当前没有通用业务规则真实性provider。严格hash/身份绑定不能代替这项语义验证。

## 本轮实际验证

Windows使用Node24.21.0、DSH现有Python3.12.14。Kali实际Python3.14.7、Node路径和工具目录已核实。所有HTTP测试只访问自有localhost服务；工具控制验收只连接本机TscanPlus endpoint。

| 检查 | 本次结果 | 能证明的范围 |
| --- | --- | --- |
| 正确性与路由首轮专项 | 8/8通过 | SQL/模板、review权限、成员/分母/恢复、访问控制、模拟浏览器及路由 |
| 最终路由与选择评分器专项 | 9/9通过 | 当前路由契约及评分器反例；合成trace不代表真实模型 |
| evidence-discovery独立重跑 | 16/16通过 | 当前材料、差分、map、脱敏、范围和来源隔离；约142秒 |
| UI | community检查及24/24通过 | 生成界面、分页、异步切靶、SRC/渗透报告和凭据显示契约 |
| 独立面板 | 构建一致及31/31通过，前置契约脚本通过 | 受控交互、切会话、API/真实localhost子路径、维护/重启回执；不是正式GUI验收 |
| 面板格式 | 通过 | 使用原有Prettier配置，没有新增formatter |
| build:modes / build:client | 通过 | 三模式人设/技能/政策及两份客户端生成物 |
| check:assessment / modes / client | 通过 | 来源完整性、模式同源和bundle一致性 |
| 真实WSL worker | 最终复测1/1通过 | 实际Linux执行、localhost采集、E-ID复用、范围拒绝、AST路径和sqlmap版本probe；约23.1秒 |
| 真实TscanPlus | 最终复测1/1通过 | 实际MCP及三个只读profile、隔离空namespace、零目标测试；此前目录探测广告36项，复测约0.52秒 |
| 完整npm test主套件 | 753项：723通过、0失败、30跳过、0取消 | 当前源码完整回归，约249.3秒；平台/真实Electron前提不足的跳过不算通过 |
| npm test后置优化专项 | 22项：22通过、0失败、0跳过、0取消 | 最新正确性、路由/选择评分器与真实本地批量/Cookie/取消回归，约139.6秒 |

真实localhost批量专项覆盖三个模式每批20项与单worker、精确复用、两个origin、多身份、Cookie路径/删除/过期、live SRC新增停止、截断及取消未知键。单项恢复沿原run，不重放已未知请求。此前Cookie和discovery长测试曾有夹具字段/运行超时，修正夹具并独立重跑；没有据模拟观测宣称实际浏览器可用，也没有覆盖历史1.11.0审计结果文件。

首轮完整主套件为753项：720通过、3失败、30跳过。两项SRC兼容/旧冻结成员夹具已修；另一项是测试默认OpenSSL路径不存在，使用本机已有的绝对路径PURGE_TEST_OPENSSL_EXEC复跑，不安装或改生产设置。三项针对性回归3/3通过。中间主套件723通过、0失败、30跳过；后置专项21通过、1失败，是新夹具把门面null-prototype脱敏对象与普通对象比较，参数实际相同。夹具改为比较完整JSON语义，Cookie专项通过。随后扩大原请求绑定反例，修复默认换身份/丢URL及脱敏URL假就绪；最新路由与选择评分器9/9通过。首轮与中间日志保留，最终完整结果单列，不隐去失败或沿用旧数字。

一次后续完整运行出现未涉及本轮修改的Windows换包等待态测试失败：722通过、1失败、30跳过，npm因此没有运行后置专项。没有修改换包代码或测试；独立复跑该项1/1通过，再复跑完整npm test得到上表的723主通过与22后置通过。该间歇失败仍是环境/时序稳定性风险，不因最终通过抹去。最终日志为`.scratch/verification-1.12.0-acceptance.log`，失败日志分别保留在`verification-1.12.0-full.log`、`verification-1.12.0-final.log`与`verification-1.12.0-complete.log`；工具复测与独立面板日志也留在本机`.scratch`，不是正式宿主验收或发布附件。

机器可读的[本地验收摘要](validation/1.12.0-local.json)保留最终分项计数、全部失败阶段、选定源码/生成物及本机日志SHA256、真实工具验收范围和未测指标。摘要仅标识本次工作区字节，不签名认证模型/日志来源，不是发行摘要或完整仓库证明；本机日志不会随源码包分发，重叠专项不能累加为独立测试数。

实际TscanPlus读的是新随机空namespace，不证明大结果分页、真实目标发现导入、扫描或PoC可用。实际WSL验收不证明所有Kali工具都已接入typed adapter，sqlmap只跑版本probe。nmap/nuclei/ffuf等当前仍是catalog-only。

当前默认环境未找到Playwright模块或默认Yak文件，Kali PATH未找到Yak。没有下载/安装这些组件，不推断所有自定义安装不存在。真实Playwright/Yak、真实模型工具选择和tokens、完整GUI/86条补丁/宿主委派与turn-stopping、授权预生产目标均未验收。

## 来源与维护

awa-ddd上游仍为2.2.0，保留MIT、原版权、LICENSE/NOTICE及逐文件来源摘要。当前随包清单85项：81个Python、3个JS、1个LICENSE；8个dsh-purge owned辅助模块不伪装为上游来源。

上游source SHA256保持 `881cbc6a6d7463e29832524bce6a81f043517e8f1fef9c665304c37aad6cfa05`。`--record-local`只记录allowlist内已审阅变化与指定owned模块，拒绝未审阅路径，保留upstream hash/origin；同步更新组件README/NOTICE版本，manifest与provenance适配版本必须一致。写摘要不等于来源认证、逻辑验证或运行证明。

模式正文及面板由原有共享源生成。版本、README中英文、安装/维护文档与release-notes统一1.12.0；1.12.0 TGZ地址仍为待发布地址。

没有pack/publish、安装本插件、apply、退出或重启正式DSH。用户提示词、规则、操作者设置/偏好、凭据、旧审计与原工作区变更保留；没有新分支或提交。

## 相对方案的完成度

| 工程阶段 | 当前状态 | 仍需完成 |
| --- | --- | --- |
| M0真值/成本基线 | 首批反例和真实本地采集完成 | 扩大成对靶场、三模式完整共同真值与真实模型基线 |
| M1证明/停测纠错 | 当前实现及本地反例通过 | 更多语法上下文、独立浏览器与部署真值验收 |
| M2任务模型 | 成员、服务身份、归属、恢复和N/A分母保护完成 | 大库存及历史迁移/性能基准 |
| M3执行/路由降本 | 单worker、精确复用、当前profile与需求触发完成 | 连接池、匿名链聚合、真实浏览器/Yak及模型选择 |
| M4验证provider | 有界SQL/模板、GET边界与反射XSS代码完成 | 实际浏览器、更多安全机制和真实服务对照 |
| M5发现/情报/成果 | 有限JS图及advisory去重完成 | indexed map、运行组件证明、根因合并、权限成果collector |
| M6成本/端到端 | 实际成本投影与回归门禁完成 | 可信tokens、命中校准、专用宿主/GUI/实际调度与预生产验收 |

剩余问题和可验收的下一批方案见 [升级后复审](THREE-MODE-REVIEW-1.12.0.md)。动作参数见 [工具路由](TOOL-ROUTING.md) 和 [发现工作流](DISCOVERY-WORKFLOW.md)。
