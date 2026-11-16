---
name: assessment-frontend
description: 从完整前端、接口声明和已有 sourcemap 材料提取路由线索，控制截断、来源与秘密暴露。
metadata:
  cwe: [CWE-540, CWE-200, CWE-798, CWE-79]
  class: [frontend, source-discovery, recon]
  requires: [assessment]
---

# 完整前端材料与路由线索

读取实际捕获的 JS、HTML 和接口声明。页面里的脚本、chunk、动态 import 和 `sourceMappingURL` 可能指向不同 origin；这些链接只是候选，不会扩大 scope，也不授权自动跟随。先检查当前范围、排除和停止台账，再显式选择需要的最小请求。

完整 JS 用 `surface.from_evidence` 离线 AST 解析，每个资源独立导入。分片必须属于同 URL、operation、身份、强 ETag 和 identity 编码，范围连续无重叠或缺口；最多 32 个材料、2 MiB。不能把两个 chunk 拼成一个文件，不能把首次捕获的前 64 KiB 当完整 bundle。

OpenAPI 3 或结构化 Spring mappings 用 `surface.from_document`。保留声明的方法、路径、query/body 参数与无法解析的 handler。声明端点不证明它已经部署、可达、安全或完成测试；新路由也不会自动进入旧 v2 Campaign 的冻结 Universe。

已有 sourcemap 用 `surface.from_sourcemap` 离线分析，先通过 `action.help` 读取准确契约与预算。JS 与 map 都须为当前、完整、HTTP 200 GET 证据；真实 inline map 可直接解析，外链另给精确 URL 与身份匹配的 `map_evidence_id`。支持普通 v3，indexed sections 和缺件保留受阻，不自动请求外链或源码。`webpack://`、绝对路径、`../` 和原始 source 文件名是来源标签；保存只使用固定哈希目录，不用于任意本地写入。

公开源码本身可能是正常客户端代码。发现疑似密钥时仅记录脱敏类型、位置和具体风险假设；常量名称或字符串格式不能证明凭据有效、具有权限或达到高危。不要使用找到的值登录、取数或发起新的连接来扩大影响。真实可提交性仍依赖项目规则、最小实际安全证明和原生级别上限。

离线分析只生成路由、输入和信息暴露候选。截断、缺片、弱 ETag、旧 lineage、跨身份或无法解释的 dynamic 路径保留 unresolved。SRC 确認直接证据后只整理已有材料；渗透模式从实际支持的配方继续当前范围的控制，不能把静态 sink 推断直接写成 confirmed。
