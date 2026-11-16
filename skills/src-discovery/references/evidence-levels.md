---
name: assessment-evidence-levels
description: 用 L1-L4 解释材料与影响的距离，保留可信来源、精确命题和原生证明上限。
metadata:
  cwe: []
  class: [evidence, review, methodology]
  requires: []
---

# 材料与影响的解释阶梯

L1-L4 用来帮助审查“材料实际证明到了哪一步”，不是账本状态，也不是模型可填写的观察权限。等级名称、长篇影响描述和完整哈希都不能授予 observed、confirmed 或提高严重度。

| 解释层级 | 材料能说明什么 | 仍不能据此宣称什么 |
| --- | --- | --- |
| L1 可达性与处理 | 接口有响应、请求被处理、正常功能存在 | 安全缺陷、身份间权限、未测覆盖完成 |
| L2 可控差异 | 精确输入影响了可观察行为，相关对照有差异 | 数据获取、系统命令执行、完整漏洞确认 |
| L3 有界实际安全影响 | 已核实本不应发生的具体读取、授权或执行结果 | 同 URL 的另一命题、更大权限或整个范围穷尽 |
| L4 关键实际成果 | 已核实指定关键目标的具体成果 | 其他系统/域/身份的控制，以及未经证明的扩大影响 |

这些层级不与 severity 一一对应。真实低危漏洞可以达到 L3；SQL 有界计数差异与模板表达式分别受原生 proof cap 和 limitations 限制。不能因为自填 L3/L4 就把 medium 改为 high/critical，也不能把源代码、扫描器和响应头线索标成实际系统接管。

三模式模型输入只登记 claimed/inferred。observed 来自固定可信采集代码的不可编辑回执；普通工具采集的 `direct_evidence:false` 不独立确认漏洞。历史无回执 observed、旧 confirmed 和缺 claim contract 的 machine 标签保留为待复核。

来源确认须逐项对应本靶标、同发现、具体目标、operation/input/category、原生 finding/decision、完整哈希、机器标题、proof_scope、limitations 和级别上限。改被证明语义或借用同 URL 的其他结果都需要重新核实。来源文字不能通过 review.bind 转移为原生影响。

SRC 提交检查分开呈现当前证明与草稿缺项。项目、规则、前提、预期结果、复现、影响、修复和本地查重通过，仍只表示本地 submission_ready，始终由操作者提交和平台复核。SRC 直接证据后停止该项；阶梯解释不撤销停止。
