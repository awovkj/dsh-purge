---
name: web-fingerprint
description: Web 服务指纹识别：框架、中间件、CMS、组件版本
whenToUse: 已发现 HTTP/HTTPS 服务，需要识别技术栈时
role: recon
enabled: true
metadata:
  cwe: [CWE-200]
  class: [recon, component-intelligence]
  requires: [shell]
---

<!-- generated:skill-requirements -->
执行需求：shell。
执行前核对当前模式技能索引的 availability、requires 与 missing。模式禁止或本轮明确缺失的能力保留 blocked；运行前提未核实则为 unknown。受阻时不执行正文命令、不换工具绕过；只继续当前模式已有前提的 typed 或离线工作。技能标签、文件已存在和部署回执不授权执行，也不证明漏洞、权限或运行就绪。
<!-- /generated:skill-requirements -->

## 方法
1. 响应头：`Server`、`X-Powered-By`、`Set-Cookie` 特征。
2. 页面特征：favicon 哈希、静态资源路径、报错页、robots.txt。
3. 主动探测：nuclei 技术识别模板 `nuclei -u <url> -tags tech`；HTTP 存活与技术栈汇总用 `~/.local/bin/pd-httpx -l urls.txt -tech-detect -title -status-code -web-server`（**ProjectDiscovery 版必须用 pd-httpx，`/usr/bin/httpx` 是 Python 库的 CLI**）。
4. 大网段批量指纹用技能 `gogo-intranet`（`gogo -i <cidr> -p top2 -v --af`，主动指纹要加 `-v`）。
5. 版本比对：从指纹推断产品与版本，为漏洞检测做准备。

## 落库要求
写入 fingerprint 表：category（框架/中间件/CMS/组件）、vendor、product、version、evidence。
