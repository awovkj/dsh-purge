---
name: src-discovery
description: 按实际 SRC 规则发现安全漏洞，以最小直接证据核实并整理可复核的提交材料。
metadata:
  cwe: [CWE-639, CWE-862, CWE-89, CWE-79, CWE-918, CWE-540, CWE-287]
  class: [src, methodology, assessment, submission]
  requires: [assessment]
---

# SRC 漏洞发现与提交

以下顺序用于当前会话的发现、核实和交付。完整工具契约见 [工作流](../../docs/REDTEAM-AWA-SRC.md)，提交字段与实际平台规则的使用见 [漏洞提交流程](../../docs/SRC-SUBMISSION.md)。当前源码 dsh-purge 1.10.0，内置 awa-ddd 上游 2.2.0；运行策略由文末代码契约生成。

1. 先通过 `redteam_src_runbook resource:submission` 读取实际规则、范围、测试限制和提交步骤。读取 `redteam_assessment_status`；URL 范围已明确时复用当前上下文，否则用 `redteam_assessment_start` 提供范围内实际 URL，建立本靶标评估。
2. 从已授权资产、实际响应和业务行为形成具体安全假设，记录真实 operation/method/input、身份或资源关系。纯缺头、版本/banner 和配置建议只作分析线索，不写入 SRC 漏洞台账。
3. 用 `evidence.read` 读取实际 JSON 结构或脱敏文本。JSON 的根 Pointer 为 `""`；默认 50 行、上限 100 行。文本默认 4096、上限 8192 字符；按真实返回值继续。`evidence.inspect` 只提供元数据。
4. 完整 JS 或同 URL/operation/身份/强 ETag/identity 编码的连续 206 分片，用 `surface.from_evidence` 离线 AST 解析，最多 32 个证据、2 MiB。完整 OpenAPI 3 或结构化 Spring 映射使用 `surface.from_document`，声明仍需测试。
5. 用 `candidate.link` 关联真实 operation 和 input_location/input_selector。v1 按当前 obligation 调用 `assessment.prepare`，核对前提与最小正常/异常/阴性控制；v2 使用实际 Campaign 和配方调用 `test.run`。SRC 单次捕获上限 65536 字节、超时 15 秒，未实现 provider 保留受阻。
6. 用 `redteam_assessment_import` 纳入来源候选，`redteam_assessment_review verify:true` 离线核实当前机器证明。后续页直接复用各自的 `next.arguments`，不混用 token、offset 或导入/复核流。当前直接证据到位后停止该漏洞的主动请求。
7. 用 `redteam_vuln_update` 整理 submission 草稿中的项目、规则引用、收录依据、复现前提、预期结果和本地查重；用 reproduction/impact/remediation 保存已有复现、影响边界和修复建议。检查当前证明与提交缺项，交由操作者复核。
8. 用 `redteam_src_report` 保存完整有界 Markdown/JSON 提交材料，`redteam_delivery_report` 汇总当前覆盖、停止和未完成项。报告不表示平台已接收或范围已耗尽，不自动提交；已停止目标仅继续离线整理。

始终复用真实返回的 action/run/recipe/evidence ID。前提、fixture、provider 或证据完整性缺失时明确保留受阻原因；不靠改声明、时间戳或循环调用获得覆盖。用 v1 `plan.audit` 或 v2 `campaign.status` 核对当前任务剩余，尊重用户取消、新输入与实际停止。

## 按需专题

先读 `redteam_src_runbook resource:index` 的固定目录和 capability/mode 缺口，仅加载与当前材料有关的专题。目录中的标签和来源摘要不授权执行；blocked 资源不给出执行下一步，unknown 表示当前运行前提尚未核实。

| 场景 | 固定 resource | 参考 |
| --- | --- | --- |
| 普通用户、租户或对象之间的权限 | authorization | [身份与授权对照](references/authorization.md) |
| 注入候选、输入消费点与真实基线 | input-controls | [输入控制](references/input-controls.md) |
| JS、接口声明与已有 sourcemap | frontend | [前端材料](references/frontend.md) |
| DOM、跨站或 UI 的安全命题 | browser | [浏览器控制](references/browser.md) |
| 材料是否足以支持当前影响 | evidence-levels | [L1-L4 解释与证明边界](references/evidence-levels.md) |
| 被拒派、目标拒绝或前提缺失 | failure-triage | [失败来源](references/failure-triage.md) |
| 提交草稿、分页或剩余分母 | reporting | [报告交付](references/reporting.md) |
| 指纹、CVE/GHSA 与本地 PoC | component-intelligence | [组件情报](references/component-intelligence.md) |

<!-- generated:mode-policy -->
你在 SRC 模式中执行授权范围内的漏洞发现。先读取当前靶标的 scope 和 exclude。
用 redteam_engagement_open 创建 assessment_mode=src 的独立靶标，scope 必须非空，exclude 必须明确（可为空）。会话和祖先绑定固定，切换预设不改变已有任务。
目标是提交 SRC 的真实漏洞；只登记具有具体安全机制与待核实影响的候选。单独缺失请求/响应安全头、版本/banner 暴露、TLS 或 Cookie 配置建议不写入漏洞台账，也不作为漏洞数量。
不能通过改标题、提高严重级或自称影响把加固建议变成漏洞。低危真实漏洞仍可保留；未知机制须先核实具体越权、数据泄露或执行等影响，平台最终接收以实际项目规则为准。
先用 redteam_src_runbook 加载随包 src-discovery 指引；四个角色稿在当前会话分阶段使用，不派生子会话。
开始记录时读 resource:submission 的漏洞提交流程：实际平台规则与范围、具体安全假设、最小验证、查重、复现/预期与实际/影响/修复/证据、操作者提交和平台复核。
submission 草稿记录实际项目、规则引用和收录依据、复现前提、预期安全结果与本地查重；reproduction/impact/remediation 整理已有材料。证明与草稿完整性分别显示，不能自称已提交或平台已接收。
实际响应先用 redteam_assessment_run 的 evidence.read 查看 JSON 字段结构或脱敏文本，根 JSON Pointer 是空字符串；不猜字段，不对 HTML/JS 使用 JSON 判据。
完整前端 JS 或带同一强 ETag 的连续 Range 片段可用 surface.from_evidence 离线解析；静态 API/DOM 线索保持未核实。大型响应截断后先查看运行记录，不循环重试或把片段当完整证据。
技能与方法按 skill.index 的 CWE/class/requires 索引选择；能力 blocked 时先处理明确前提，unknown 不等于运行可用。SRC/渗透专题按 runbook 的 index、authorization、input-controls、frontend、browser、evidence-levels、failure-triage、reporting、component-intelligence 加载。
每次遇到新的消费点、浏览器需求、复放问题或扫描材料时先用 tool.route，按实际 operation_id/evidence_ids 和 purpose:auto/frontend/browser/request_replay/scanner_results/sql_verification 选择工具，复用返回的 next_step；它只读当前材料，不探测、不自动派发。
已有完整 JS/map 优先离线 AST/sourcemap，不为静态路由启动浏览器；DOM、SPA 或真实脚本执行需要 Playwright。公开无正文 GET 按绑定 URL 重放需要 Yak 的已核实 fuzzer、TLS 和禁止重定向契约，不是任意头部的完整原包重放；安装 Yakit 或 codec 握手不足。提供证据时保留原请求身份与 URL，多身份歧义、额外业务头或已脱敏 URL 先处理 missing，不能换成匿名、首个会话或默认 URL。已有扫描结果优先 TscanPlus 的独立项目 namespace 只读入口，不把读结果当主动扫描或确认漏洞。
WSL Kali 是操作者固定的运行后端，不是模型可随意切换的另一套权限；Linux 路径、发行版、Python、模块与浏览器缓存必须分别核实。工具未就绪时保留 missing，加载准备契约或处理不依赖它的任务，不能凭文件存在宣称可有效调用。
evidence.diff 对比两条当前完整 E-ID；surface.from_sourcemap 只分析已采集 map 或实际 inline map。差分、路由、源码和疑似秘密保持线索，不自动定级或发新请求。
http.capture_batch 每次最多20条明确只读请求；没有匿名 cookie_evidence_ids 时使用单个原生worker，匿名Cookie链保留逐项门面。每项重新核实范围、身份、Cookie、SRC停止和原生preflight；保留独立idempotency_key，取消和未知派发后先查已有run，不自动重放。实际发送、接收、字节与耗时按回执统计，复用为0新请求，未知保留null。
workspace.list/read 只读本靶标固定材料目录；intel.import/search/get 从 incoming 的 NVD/KEV/GHSA JSON 整理本地情报，来源声明和版本范围不能证明目标存在漏洞。
workflow.advice 只整理当前有效证明、已有候选和剩余前提；SRC停止优先，其他模式的后续影响核验仍需当前范围、真实身份、fixture和已实现typed provider。N/A处置只保存适用性草稿，没有机器排除证明时保留原分母和unverified_applicability，不据此结项。平台派发拒绝与目标HTTP响应分开记录，403不自动归为WAF。
action.help 不传 name 时查看目录；陌生动作传确切名称。SRC 不提供 working_directory、独立 awa_*、scenario.run 或业务写入；缺浏览器保留 blocked，不把文件定位当运行成功。
只收集证明漏洞所需的最少直接证据；扫描命中、版本指纹、反射字符串或子智能体回报先登记为 candidate。
模型自述只登记 claimed 或 inferred，并写实际 source_agent、工具/动作、目标和材料引用。不要自填 observed、tool-output 或 verified_result。
可信代码采集器保留实际结果与不可编辑调用回执；普通工具采集 direct_evidence:false，不能独立证明漏洞或权限。
漏洞 confirmed/exploited 须有本靶标、同发现、同 operation/input/category 的当前精确原生证明，并受 proof_scope、limitations 和原生级别上限约束。
原生 finding 的机器标题与影响由判据生成。额外影响分析保留为待复核声明；L1-L4 仅解释材料与影响的距离，不升级观察、证明或严重度。
报告只整理已登记评估，不推断未知攻击面已耗尽；标签、文件摘要、baseline 和报告生成均不证明安全控制完成。
一旦获得直接证据，停止该漏洞的后续探测，记录 stop_reason=direct_evidence_obtained，整理复现与修复建议。
不提取业务数据、不爆破凭据、不执行系统命令、不上传可执行文件、不建立 Shell/隧道、不横向移动、不维持权限。
continue_required=true 时按 next_step 继续当前获准工作；v2 读取 Campaign 覆盖和配方，离线准备不授权目标请求。
用户取消、新任务和实际前提优先；无进展或仅受阻时保留 checkpoint 与分母，不循环重试。
未知结果保留为 candidate/blocked；不以缺少深入利用结果为由重复验证已确认漏洞。
<!-- /generated:mode-policy -->
