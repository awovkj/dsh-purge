---
name: redteam-setup
description: 按当前任务识别真实运行前提，复用已有工具或使用固定版本与摘要部署，保留具体缺口。
whenToUse: 当前任务缺少工具或运行前提，或操作者明确要求准备红队环境时。
role: plan
enabled: true
metadata:
  cwe: []
  class: [runtime, workflow]
  requires: []
---

<!-- generated:skill-requirements -->
执行需求：离线整理，不要求目标执行能力。
执行前核对当前模式技能索引的 availability、requires 与 missing。模式禁止或本轮明确缺失的能力保留 blocked；运行前提未核实则为 unknown。受阻时不执行正文命令、不换工具绕过；只继续当前模式已有前提的 typed 或离线工作。技能标签、文件已存在和部署回执不授权执行，也不证明漏洞、权限或运行就绪。
<!-- /generated:skill-requirements -->

# 当前任务的环境准备

先识别本任务需要的真实能力。读取当前靶标绑定、范围、已测材料和 `redteam_preflight`，按工具、内置评估、浏览器、身份、资源及远端设施分别列前提。`onboarding.complete`、文件存在和历史回执只是状态线索；不能把它们作为当前执行或认证成功的证明。

已有授权足够时继续具备前提的工作。缺失信息只影响依赖任务：FOFA 不可用不阻塞已有 URL 测试，VPS 不可用不阻塞本地 HTTP 评估，缺浏览器不阻塞已有前提的纯 HTTP 控制。需要操作者补充的信息一次说明用途和受阻项，不要求先补齐整个工具箱。

## 分发与固定部署

dsh-purge-community 随包提供 `scripts/redteam-setup.sh`、`redteam-tool-download.py`、`redteam-tools.lock.json` 与 `wsl-install-tools.sh`。插件加载时将它们分发到实际 `$DSH_HOME/redteam/`，入口名为 `setup.sh`。安装插件不会自动执行下载助手；缺附件时先确认实际安装版本与路径，不再判断为“npm 版没有脚本”。

优先在环境适配面板配置已有工具。确需部署时，使用当前平台的固定 repo/tag/asset 与 SHA256。Linux/WSL x86_64 的随包锁只固定已知发行；空 pin 或缺摘要必须保持受阻，不能追 latest、任选同名资产或编造摘要。

```bash
# 完全离线的文件/回执清单，不执行任何二进制或网络探测
bash "$DSH_HOME/redteam/setup.sh" --check

# 已明确选择并审阅操作者覆盖锁时，只部署所选工具
bash "$DSH_HOME/redteam/setup.sh" --yes --tool=fscan --lock=/absolute/operator/tools-lock.json
```

默认锁中 `sha256:null` 不是成功校验。助手仅接受操作者实际摘要或确切官方资产提供的 SHA256；源码归档需要操作者摘要。详见 [固定工具部署](../../docs/TOOLKIT-PINS.md)。本技能不替维护上下文运行这些命令；用户要求不测试/验证时保留源码状态即可。

已有未认证或内容变化的文件保持原样；明确选择 `--force` 才备份并替换选定文件。其他工具、用户源码内容与 venv 保留。不会自动重装损坏文件、运行下载的工具、创建浮动 Python/npm 依赖、更新 nuclei 模板或修改系统源/代理。

## 任务依赖

| 前提 | 何时需要 | 保存与使用 |
| --- | --- | --- |
| FOFA 或其他测绘 key | 本任务选择相应 API 数据源时 | 操作者环境配置；不写仓库、任务书或报告，按实际服务限额使用 |
| 实际远端设施 | 本任务确实需要该连接或中转时 | 明确主机、用途、密钥路径与允许能力；缺失只阻塞关联任务 |
| 已有扫描器与模板 | 当前任务使用其具体检测能力时 | 面板记录正确路径及固定来源；模板独立固定版本/commit与摘要 |
| 内置评估 | 当前 Web/API 安全控制时 | Node ≥22.19、Python ≥3.10，当前靶标固定工作区 |
| 浏览器 | UI、浏览器消费点或相应 oracle 时 | 已有模块及可运行浏览器；文件、模块和启动状态分别记录 |
| 测试身份和 fixture | 身份间授权、所有权或变更控制时 | 凭据句柄、真实 verified session、自有资源与匹配变更许可 |

FOFA key 由操作者从 <https://fofa.info> 的账户 API 设置取得。部署助手不代写 `.env`、校验 API key 或连接 VPS。环境变量的实际生效依宿主加载方式；需要重新加载进程时说明原因和未生效项，保留操作者手动处理，不自动重启 DSH。

新目标凭据通过 `redteam_credential_add` 取得 `cred_<id>` 句柄。任务书与报告引用句柄，固定请求器本地应用，session 固定 origin 并在后续 `identity.verify` 核实实际服务端主体/角色。不要用完成标记、凭据存在或登录成功代替身份验证。

## 回执与恢复

部署回执保存确切 repo/tag/asset/id、归档和文件摘要、摘要来源、时间与备份 ID。`runtime_probed:false` 和 `capability_ready:false` 表示尚未执行能力探测；`.setup-complete` 仅是部署元数据。禁止手写时间戳把当前环境改称可用。

如果当前任务允许运行探测，记录实际 runtime/tool 回执并与目标观察分开。源码维护或用户禁止测试时不运行探测，交付中明确未测。本地工具帮助能启动也不能证明目标可达、认证成功、控制完整或漏洞成立。

失败返回缺失项、对应依赖、已有材料和可恢复前提。对未知写入先检查原 run 及只读读回，不通过环境修复自动重放。向操作者交付当前可做的工作、受阻分母和下一步；不因某个资源缺失推断整个范围无法评估。
