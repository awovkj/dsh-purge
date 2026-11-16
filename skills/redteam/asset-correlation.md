---
name: asset-correlation
description: 资产关联：域名↔IP↔C 段↔证书↔服务的图谱化
whenToUse: 信息收集阶段性收口，需要形成资产关系视图时
role: recon
enabled: true
metadata:
  cwe: []
  class: [recon, asset-analysis]
  requires: []
---

<!-- generated:skill-requirements -->
执行需求：离线整理，不要求目标执行能力。
执行前核对当前模式技能索引的 availability、requires 与 missing。模式禁止或本轮明确缺失的能力保留 blocked；运行前提未核实则为 unknown。受阻时不执行正文命令、不换工具绕过；只继续当前模式已有前提的 typed 或离线工作。技能标签、文件已存在和部署回执不授权执行，也不证明漏洞、权限或运行就绪。
<!-- /generated:skill-requirements -->

## 关联规则
- 域名解析 → `resolves` 边（domain → asset）
- C 段归属 → `contains` 边（segment → asset）
- 端口开放 → `exposes` 边（asset → port）
- 证书 SAN 共享 → `shares_cert` 边

## 落库要求
通过 redteam_asset_link 写入 edge 表；重复关系幂等。
