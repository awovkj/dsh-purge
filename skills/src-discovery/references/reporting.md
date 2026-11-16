---
name: assessment-reporting
description: 把当前证明、提交草稿、加固建议和未完成分母分开交付，正确复用有界分页。
metadata:
  cwe: []
  class: [reporting, submission, review]
  requires: []
---

# 当前证明与可交付材料

先核对当前 engagement 和模式，以及来源发现与原生结果的对应关系。confirmed 标签本身不代表当前证明仍有效；报告必须重新呈现精确命题、当前 proof_scope、limitations、级别上限、待复核及停止状态。不得为了使报告“完整”把缺证明项删除或改为已测。

SRC 用 `redteam_src_report` 保存完整 Markdown/JSON 提交材料。草稿记录实际 program、policy_reference、policy_basis、prerequisites、expected_result、本地 duplicate_check 和既有 reproduction/impact/remediation。`checked_local` 只说明当前本地材料查重，不能宣称查过平台全库。submission_ready 不是 submitted 或平台接收。

渗透用 `redteam_pentest_report save:true` 合并发现、复现、影响、修复、覆盖、变更/恢复和未完成项。hardening/informational 与真实 vulnerability 分开计数。save:false 仍会创建版本化原生本地快照，仅省略合并文件保存，不是目标执行或结项。

| 流 | 应复用的游标 | 不能混用的内容 |
| --- | --- | --- |
| 来源导入 | `redteam_assessment_import` 返回的 `next.arguments` | 复核 offset/token |
| 当前候选复核 | `redteam_assessment_review` 的 `next.arguments`，保持 verify 语义 | 导入 ID、其他靶标或模式的 token |
| 合并交付 | `redteam_delivery_report` 的 `next.arguments` | 得分 offset、finding/stop 页不可互相代用 |
| 完整 SRC/渗透材料 | 本地完整文件和有界回执 | 默认小页、被截断工具输出不能当全部正文 |

完整交付包含具体目标、operation/input、实际身份和控制、run/decision/finding/ev_id、证明限制、复现/预期与实际/修复、具体受阻和未测分母。只引用本账本的合法 ev_id，独立 awa_* 的证据不能跨账本确认。

报告和导出只读已有材料，不自动初始化、发目标请求、撤销 SRC 停止或结项。零候选、成功保存报告、默认小页和一条已确认漏洞都不说明未知攻击面已耗尽。尚未初始化或无法读取的覆盖必须保持 unknown/unfinished，不能显示零剩余。

保留最小脱敏证明与相对附件引用。凭据值、Cookie、Token、命令里的认证参数和敏感原文不能直接进入任务书或共享报告；实际值由本地限定入口处理。报告预算超限或附件哈希不符时保留旧产物并报告错误，不截断后假装成功。
