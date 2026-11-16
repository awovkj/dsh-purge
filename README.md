<div align="center">

# dsh-purge Community

**让 AI 更专注地辅助你的学习与动手实验。**

给 DeepSeek Harness 的自托管控件（俗称「破甲」插件）· 86 条宿主补丁 · 25 层状态自检 · 左侧栏整页设置

[![Release](https://img.shields.io/github/v/release/kingcharleslzy-ai/dsh-purge?label=release)](https://github.com/kingcharleslzy-ai/dsh-purge/releases)
[![Checks](https://github.com/kingcharleslzy-ai/dsh-purge/actions/workflows/community.yml/badge.svg)](https://github.com/kingcharleslzy-ai/dsh-purge/actions/workflows/community.yml)

当前源码版本 **1.12.0** · 宿主目标 **DSH Desktop 0.2.2-rc.1**（补丁源码目标；历史版本已适配 0.2.1-rc.1 / rc.2 / rc.3 / rc.5） · [English](docs/README.en.md)

1.12.0 按三模式锐评方案修正 SQL/模板证明、模型复核权限和活动覆盖串用；补真实身份访问控制、受控浏览器 XSS 配方、单 worker 批量及实际成本回执。新增 `tool.route`，按真实需求选择离线发现、Playwright、Yak 重放或 TscanPlus 结果；WSL 只使用操作者固定后端。源码图与情报去重仍为线索，不冒充漏洞。[优化方案](docs/THREE-MODE-OPTIMIZATION-PLAN.md) · [实施与验证](docs/MODE-UPGRADE-1.12.0.md) · [升级后锐评](docs/THREE-MODE-REVIEW-1.12.0.md) · [工具路由](docs/TOOL-ROUTING.md)。

1.11.0 结合 Pojun 对照分析，补齐真实证据差分、sourcemap 离线发现、受控批量 HTTP 采集、固定目录材料读取、本地 NVD/KEV/GHSA 情报与 CWE 技能导航。失败回执区分平台拒绝、目标响应和未知派发；后续建议依据当前证明，保留 SRC 停测与未完成分母。内置 awa-ddd 上游继续为 2.2.0。[升级方案](docs/MODE-UPGRADE-1.11.0-PLAN.md) · [实施与验证](docs/MODE-UPGRADE-1.11.0.md) · [动作使用](docs/DISCOVERY-WORKFLOW.md) · [版本说明](docs/releases/1.11.0.md)。

1.10.0 已修复宿主合并 `list_agents` 与 fork 子预设的加载阻塞，保留用户 YAML 与原子任务限制；当时的 DSH Desktop 0.2.2-rc.3 专用 Electron 副本验收覆盖四个预设及空白 Agent 工具目录。历史故障见 [模式加载修复](docs/preset-mode-loading.md)，原验收见 [1.10.0 记录](docs/MODE-UPGRADE-1.10.0.md)。

本轮交付源码与生成物，验证分为隔离真值/模拟适配器和真实 localhost HTTP。实际 Playwright、Yakit/Yak、TscanPlus、WSL Kali、模型工具选择、宿主/GUI 和委派调度未验收。没有打发行 TGZ、发布、安装、应用补丁、退出或重启正式 DSH；下文的 1.12.0 发行链接须在正式发布后使用。小样本与模拟不能证明总体准确率、召回率或实际工具可用；历史升级保留各自验证边界。

**原项目与作者**：小杨 / YuJunZhiXue 是历史上游 dsh-purge 的作者署名。本仓库独立维护社区版，保留上游版权和 MIT 许可证。历史署名不代表对当前同名 GitHub 账号身份的核实。详见[署名记录](NOTICE.md)与[许可证](LICENSE)。

</div>

---

## 搭配：本机出图（Qwen Studio）

破甲之后最直接的玩法，是把「生图」也搬到本机——不用网页、不用会员、不把提示词发到别人服务器。

配套插件 **Qwen Studio**（`dsh-qwen-studio`）把 Qwen Image 2.1 接进 DSH：

- **Apple Silicon Mac**：MLX / MFLUX 本机推理，模型用时加载、空闲释放；
- **Windows / Linux + NVIDIA**：连你自己的 GPU 网关（ComfyUI 或 vLLM-Omni 协议），也支持 SSH 按需拉起；
- 支持参考图编辑（按图改画风、换材质）、LoRA、ControlNet、蒙版、整套预设、图库与批量任务；
- 装好之后，会话里直接说「画一张…」或「把这张改成水彩」，Agent 调用 `qwen_generate_image` 并把图返回到对话里。

**组合效果**：破甲让 Agent 不再反复确认「要不要画」，出图插件让它真的画出来，全程在你自己的机器上完成。

**仓库**：[kingcharleslzy-ai/dsh-qwen-studio](https://github.com/kingcharleslzy-ai/dsh-qwen-studio) · **下载**：[最新 Releases](https://github.com/kingcharleslzy-ai/dsh-qwen-studio/releases/latest) · **安装与硬件自查**：[docs/SETUP.md](https://github.com/kingcharleslzy-ai/dsh-qwen-studio/blob/main/docs/SETUP.md)（先看「这台机器能不能跑」再动手）

## 它是什么

dsh-purge Community 是一个跑在你自己机器上的 Harness 附加组件。它把日常使用里最消耗注意力的几件事收敛到一处：

- **看清楚状态**：安装、补丁、注入到底有没有就绪，一条命令或一屏面板给结论；
- **少一些往返**：把反复出现的确认与打断，收敛成一次设置；
- **随时能回去**：应用、回滚、开关都留记录，操作前自动快照；
- **方便做实验**：提示词、规则、预设集中管理，改坏了能撤。

目标很简单：**让助手更连贯地配合你的学习与动手实验**，而不是每做一步都先停下来问一句。

社区里通常把它叫作「破甲」或「无限制模式」插件——指的是它降低了交互层面的摩擦，让 agent 能连续执行任务；它不改模型本身，也不改变你要做的事。

### 下载时报 `fetch failed`？

1.6.39 起，独立安装器会显示失败阶段和错误码，有限重试后可切换系统 curl；两条通道都保留来源、证书和 SHA256 校验。请先重新下载安装脚本再运行 dry-run，仍失败时提交脱敏诊断行即可。见 [下载排查说明](docs/maintenance-issue-52.md)。不会自动修改代理或重启 DSH。

### 让不同预设保留自己的提示词

1.6.40 新增 `excludePresets`：默认空列表，保持原有行为；可将 `roleplay`、`minimal` 等预设排除在 Purge 提示词注入之外，保留命令、面板与工具。切换预设、并行会话和子 Agent 各自判断，宿主兜底也遵守排除。配置示例、升级步骤与边界见 [按预设排除说明](docs/maintenance-issue-53.md)。这不会撤销全局宿主补丁。

## 设计原则

| 原则 | 含义 |
| --- | --- |
| 本机优先 | 全部逻辑在本机运行，不改云端账号、不上传提示词或配置 |
| 可见 | 每个动作都有状态与证据，不靠"应该生效了"这种判断 |
| 可回滚 | 应用 / 安装 / 回滚前自动快照，保留原文件与校验清单 |
| 不替你做决定 | 只减少摩擦，不改变你的目标；改什么、开什么，都由你确认 |

## 适用场景

本机学习、个人项目、自动化实验与维护工作。请在你拥有或已获授权的环境中使用；涉及他人系统时，先取得许可。

### 内置证据评估、SRC 与渗透模式

模型在三模式中只登记 claimed/inferred，observed 由可信代码采集回执产生。确认须绑定同靶标、同发现、具体操作/输入/类别与当前证明范围；历史标签和超出证明的影响在面板及报告中显示待复核。新凭据默认通过句柄使用，高价值积分可信证据策略默认开启，操作者明确保存的关闭偏好保留。v2 自动 provider 的未实现项会保留受阻，部署文件与真实运行能力分别呈现。

演练台的「内置评估」页直接使用当前靶标的范围、候选与证据。`lib/redteam/assessment-engine/` 是随包生产源码，保留 MIT 许可证及逐文件来源/哈希清单；每个靶标有独立的 `assessment` 工作区和内部固定项目。首次按真实 HTTP(S) URL 准备评估，无需绑定外部 awa-ddd；模型不能选择引擎代码路径或外部工作区。

SRC 使用创建时固定的范围与排除项，按实际平台规则发现具体安全漏洞、最小验证、查重并整理提交草稿。开始发现前用 `redteam_src_runbook` 读取随包 `src-discovery`，用 `resource:submission` 加载固定提交流程；四个角色稿在当前会话分阶段使用。面板可编辑规则引用、前提、预期结果、查重、复现、影响和修复，报告保存完整有界 Markdown/JSON。当前机器证明和材料完整性分别检查；提交草稿完整仍需操作者复核与提交，平台接收保持尚未判定。直接证据确认后持久停止该项，HTTP、身份、间接配方及浏览器发送前都检查停止，后续修复或状态编辑继续保留原停止。

「渗透模式」预设 `pentest` 创建独立靶标，明确 scope/exclude，使用同一随包核心完成测试、复核、覆盖与报告。先读取 `redteam_pentest_runbook`，补齐真实认证与状态前提，再按输入执行安全控制和机器复核。它使用引擎普通 assessment 策略，漏洞与加固建议分别计数，可使用本范围测试凭据句柄；既有 SRC 会话和靶标的模式保持固定。`redteam_pentest_report` 生成 `reports/pentest-report.md/.json`，合并 v1 原生技术/复现附件或 v2 覆盖矩阵及发现详解；工具返回路径、质量和未完成计数，完整正文在文件与面板 API。预览也创建版本化原生本地快照；生成报告不访问目标、不自动结项。[完整步骤与可移动导出](docs/PENTEST.md)。

评估动作先用 `action.help` 查真实字段。`evidence.read` 离线读取实际 JSON 结构或脱敏文本，`surface.from_evidence` 把完整 JS/严格连续的 206 Range 交给内置 AST 分析，避免猜字段和把截断响应当完整证据。正常 baseline、HTTP 200 或相同响应长度不能代替漏洞测试。具体源码修复与原会话未完成项见 [SRC 会话诊断](docs/src-session-v4-analysis.md)。

内置评估返回 `next_step`；宿主根据当前 v1 台账或 v2 Campaign 的实际状态有界提醒，尊重取消、新输入与缺失前提。「内置评估」页提供 Python/native/WSL 设置、运行环境信息及续跑偏好；现有 Playwright 可从实际 DSH_HOME 或操作者指定的 `PURGE_PLAYWRIGHT_ROOT` 复用，模块和 Chromium 缓存分别定位，缺件继续保留原因，不自动安装。

`redteam_delivery_report` 合并得分、证据关联、当前覆盖、来源发现和 SRC 停止，明细有界分页并可保存 Markdown/JSON。导入、复核和交付优先直接复用各自签名的 `next.arguments`，旧 offset 兼容。红队高价值记分的 observed 成果证据要求默认开启，操作者明确保存的关闭偏好保留；原详细得分复现报告仍可使用。有范围的红队沿持久绑定使用 typed 评估入口与显式工具清单。独立 AWA 与内置 `redteam_assessment_*` 各用自己的台账，跨账本材料重新作为候选纳入。旧外部 settings/binding 保留；内置核心仍为 2.2.0。[流程、源码来源和交付边界](docs/REDTEAM-AWA-SRC.md)。

## 1.6.39 更新

修复独立安装器只显示 `fetch failed` 的问题：分阶段诊断、有限重试和系统 curl 备用下载，继续严格校验官方来源、证书和 SHA256。下载失败不触碰现有安装。[发行说明](docs/releases/1.6.48.md) · [配置与验收](docs/maintenance-issue-52.md)

## 安装

**DSH 官方入口负责安装插件；下面的社区安装器由本仓库维护，不是 DeepSeek 官方脚本。** 首次安装可用官方界面或 CLI；已经装过 `dsh-purge` / 旧独立面板时，用社区安装器原地迁移，不要先卸载。安装、应用宿主补丁、手动重启是独立动作。

### 方式一：DSH 官方界面（首次安装）

1. 先打开 DSH 完成初始化。按当前官方文档，进入「插件」，点击「实验性插件」旁的「更多」，启用「自定义插件市场」；然后进入「发现 → 添加索引源」。
2. 本项目的**社区索引**：`https://kingcharleslzy-ai.github.io/dsh-purge/index.json`。
3. 选择 dsh-purge Community，核对来源为 `kingcharleslzy-ai/dsh-purge`、包名为 `dsh-purge-community`，确认后安装。

界面和安装协议由 DSH 提供，索引与插件由社区维护。不同 DSH 版本的入口文字可能不同；第三方 `dsh-market` 也可能有额外的筛选与迁移限制。已有旧包时请使用方式三。[官方市场说明](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/guide/plugin-market.zh.md)

### 方式二：DSH 官方 CLI（首次安装）

下面命令适用于**已经安装 `dsh` 命令、且使用 `web` profile 的 CLI/Web 用户**，在 macOS/Linux 终端或 Windows PowerShell 中运行。桌面版用户优先用上面的界面；不要为了安装插件再用 `npx` 下载另一套宿主。

下面是 1.12.0 正式发布后的固定版本命令。当前本地源码尚未发布，不应把此 URL 当作已有下载包。

```sh
dsh plugin --profile web add "https://github.com/kingcharleslzy-ai/dsh-purge/releases/download/v1.12.0/dsh-purge-community-1.12.0.tgz"
```

`web` 必须与实际启动的 profile 一致；自定义数据目录需要沿用该实例的 `DSH_HOME`。命令使用对应发行的固定版本 URL；不是 `npm install -g`，也不是安装裸 npm 包名。本项目通过 GitHub 发行，**不要替换成 `add dsh-purge` 或 `add dsh-purge-community`**。官方 CLI 的安装不会额外运行我们安装器的 Release SHA256 比对及迁移快照；需要这些功能时选方式三。[官方 CLI 安装说明](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/basic/publish.zh.md)

### 方式三：社区安装器（备份、旧版迁移、恢复）

先安装并打开一次 DSH，让实际 profile 初始化。以下命令下载**本仓库的脚本**，先校验，再安装；`dry-run` 通过仅代表前置检查、下载和 SHA256 通过，不代表依赖安装、迁移或启动已通过。请先阅读下载的脚本。

#### macOS Desktop

默认应用位置 `/Applications/DeepSeek Harness.app`、数据目录 `~/.dsh`、profile `desktop`。将下面两段放在同一个终端会话中执行：

```sh
PURGE_INSTALL_DIR="$(mktemp -d)"
curl -fSL --connect-timeout 20 --max-time 90 "https://raw.githubusercontent.com/kingcharleslzy-ai/dsh-purge/master/scripts/install.sh" -o "$PURGE_INSTALL_DIR/install.sh"
sh "$PURGE_INSTALL_DIR/install.sh" --dry-run
```

校验成功、核对目标实例后执行：

```sh
sh "$PURGE_INSTALL_DIR/install.sh"
```

自定义应用或 home 时，先设置 `DSH_APP` / `DSH_HOME`；自定义 profile 对两次命令都加 `--profile=实际名称`。不要照抄别人的路径。 macOS 支持从 XML/二进制 plist 读取真实可执行文件名；元数据无效会停止，不会换用其他应用。详见[定位边界](docs/INSTALLATION.md#应用定位边界pr-78)。

#### Windows Desktop · PowerShell 5.1 / 7

脚本会尝试定位唯一的 DSH Desktop，默认 home 为用户的 `.dsh`。旧 Desktop CLI 默认 profile 为 `desktop`，带独立 dsh CLI 的新壳默认为 `web`；自定义 profile 用 `-Profile` 指定。不要求管理员权限；路径含空格也支持。

```powershell
$PurgeInstaller = Join-Path $env:TEMP ('purge-install-' + [guid]::NewGuid().ToString('N') + '.ps1')
Invoke-WebRequest -UseBasicParsing -TimeoutSec 90 -Uri 'https://raw.githubusercontent.com/kingcharleslzy-ai/dsh-purge/master/scripts/install.ps1' -OutFile $PurgeInstaller
powershell -NoProfile -ExecutionPolicy Bypass -File "$PurgeInstaller" -DryRun
```

上一条退出码为 0、核对目标实例后，在同一个 PowerShell 会话中执行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "$PurgeInstaller"
```

找不到应用或有多个副本时，对两次命令都增加 `-DshExe '实际的 DeepSeek Harness.exe 完整路径'`；自定义目录用 `-DshHome`、profile 用 `-Profile`。`ExecutionPolicy Bypass` 只作用于这次子进程，不修改持久执行策略；组织策略仍可能禁止执行，遇到时报告错误，不修改系统策略。

#### Linux · CLI / Web

先安装 Node ≥18 和 DSH CLI，并初始化实际使用的 profile。以下从下载开始，不要求已 clone 本仓库：

```sh
PURGE_INSTALL_DIR="$(mktemp -d)"
curl -fSL --connect-timeout 20 --max-time 90 "https://raw.githubusercontent.com/kingcharleslzy-ai/dsh-purge/master/scripts/install.sh" -o "$PURGE_INSTALL_DIR/install.sh"
sh "$PURGE_INSTALL_DIR/install.sh" --dry-run
```

校验成功后，在同一终端执行 `sh "$PURGE_INSTALL_DIR/install.sh"`。默认使用 PATH 中的 `node` / `dsh` 与 `web` profile。自定义实例在两次调用中保持 `DSH_NODE`、`PURGE_DSH_CLI`、`DSH_HOME`、`--profile=名称` 一致。

### 安装会改什么，以及怎么确认

- 社区安装器在迁移前备份，调用当前实例的官方 `dsh plugin --profile … add …`，再核对安装版本和入口；保留提示词、规则、更新偏好及其他插件设置。
- **不是“完全不碰宿主目录”**：解包桌面布局缺失/损坏 `app/runtime` 链接时，会保留旧链接并修复到该安装的 runtime；冲突则停止。Linux 系统宿主只读时可能创建用户副本，并在成功后切换用户启动器。详见[安装指南](docs/INSTALLATION.md)。
- 插件加载前若市场安装失败（issue #7），插件本身尚未运行；先读脱敏错误、核对依赖来源，不能承诺安装器能修复所有市场或网络错误。
- 不自动应用宿主补丁、不自动重启、不改代理、不修改全局 npm 源或清空缓存。脚本和 bootstrap 从本仓库 `master` 下载；Release 包另做 SHA256 校验，这不是对下载脚本的独立签名验证。
- 命令退出码非零就视为失败。安装成功后记录 `backup_id`，核对磁盘版本；运行中的 DSH 仍可能显示旧版，待用户方便时手动退出重开。`dry-run` 成功、备份存在或市场卡片出现都不能替代安装成功证据。
- 回滚优先用「Purge → 状态 → 本机备份」，选择本次安装前的备份；无界面时按[安装指南中的 CLI 回滚](docs/INSTALLATION.md#cli-rollback)执行。不要假设 `purge-community` 已加入系统 PATH。

完整的实例选择、回滚与失败恢复步骤见 [安装指南](docs/INSTALLATION.md)，Agent 必须先读 [AGENTS.md §12](AGENTS.md#installation)。

## 面板

左侧栏一整页，不做悬浮按钮：

- 顶部一句话说明当前状态，主操作是「应用」；
- 其余分区折叠，说明收进 `?`，需要时再展开；
- 维护页可看最近动作、备份占用、更新偏好；
- 支持隐藏不用的入口（例如回退按钮），只影响显示。

## 常用命令

| 命令 | 作用 |
| --- | --- |
| `purge-community selfcheck [--json]` | 逐层状态与证据；不适用项单独标注 |
| `purge-community status` | 宿主路径与计数 |
| `purge-community host-status` | 只读查看安装布局与当前入口（不换包、不重启） |
| `purge-community diagnose` | 锚点漂移诊断，给出文件、行号与候选落点 |
| `purge-community reanchor …` | 把确认过的新锚点钉成本地覆盖，可撤销 |
| `purge-community probe [new]` | 生成运行时探针，验证注入确实送达模型 |
| `purge-community audit [--limit n]` | 最近动作记录 |
| `purge-community boost [on\|off]` | 尾部强化段开关 |
| `purge-community preset [status\|install]` | 「无限制模式」预设落盘 |
| `purge-community retry [on\|off]` | 回答被中断时的单次重试开关 |
| `purge-community usage` / `prune` | 备份占用与清理 |
| `purge-community backup` / `rollback <id>` | 快照 / 回滚插件 |

## 更新

维护页分别设置「自动检查」与「自动安装」，默认只检查，间隔 6 小时。安装完成不会自动重启——你决定什么时候重开。

## 兼容性

| 组件 | 值 |
| --- | --- |
| 插件 | `dsh-purge-community` 1.12.0 |
| 历史宿主覆盖 | DSH Desktop 0.2.2-rc.1 / 0.2.1-rc.1 / 0.2.1-rc.2 / 0.2.1-rc.3 / 0.2.1-rc.5；按对应历史验收解释 |
| 既有宿主验证 | DSH Desktop 0.2.2-rc.3：1.10.0 隔离 Loader 与空白 Agent 工具目录通过；完整 GUI、补丁及实际调度未验收 |
| 其它宿主 | 允许安装，自检会标「未验证」；先看 `diagnose` |
| Node | ≥18（桌面版自带运行时即可）；红队工具需 ≥22.5（`node:sqlite`） |
| 内置评估 | Node ≥22.19、Python ≥3.10；实际浏览器观察需现有 Playwright 运行时 |

## 出问题怎么办

```sh
purge-community selfcheck --json     # 先看哪一层不是 ok
purge-community diagnose             # 锚点漂移时看候选位置
purge-community audit --limit 20     # 最近动作
```

面板打不开时，先确认版本一致，再按 [维护文档](docs/MAINTENANCE.md) 恢复；不要直接覆盖 `Resources/app`。

## 开发与验证

```sh
npm test                 # 单元与契约测试
npm run check:docs       # 版本与文档一致性
npm run check:client     # 面板 bundle 与源码一致
npm run check:modes      # 人设、技能和模式政策生成一致
npm run check:assessment # 随包来源与摘要核对（离线）
npm run test:ui          # 界面交互与切靶回归
npm run test:discovery   # 证据发现、批量采集、情报、技能与工作建议
npm run test:electron    # 真实 Electron 环境（临时目录，不改安装）
npm run smoke            # 发行包冒烟
```

本轮实际执行与未执行项见 [1.12.0 验证记录](docs/MODE-UPGRADE-1.12.0.md)，`npm run test:optimization` 覆盖正确性、工具路由和真实本地批量专项，并接入 test/redteam/assessment 的 npm 后置门禁。预设 Loader 专项验收需显式提供现有宿主路径：`npm run check:mode-loader -- --host-root <绝对安装目录>`，使用专用副本，不调用模型或目标。面向 AI agent 的操作说明在 [AGENTS.md](AGENTS.md)，两者冲突时以它为准。

**关键词**：破甲 · 无限制模式 · unrestricted · prompt injection · jailbreak · DSH 插件 · 状态自检 · 备份回滚

## 贡献者

感谢原作者、代码贡献者，以及提供问题复现、分析与验证的朋友。头像链接直达 GitHub 主页；具体贡献见 [贡献记录](CONTRIBUTORS.md)，第三方来源见 [NOTICE.md](NOTICE.md)。

<!-- CONTRIBUTORS:START -->
<table>
  <tr>
    <td align="center" width="120"><a href="https://github.com/YuJunZhiXue"><img src="https://avatars.githubusercontent.com/u/188421097?s=112" width="56" height="56" alt="YuJunZhiXue" /><br /><sub>YuJunZhiXue</sub></a></td>
    <td align="center" width="120"><a href="https://github.com/kingcharleslzy-ai"><img src="https://avatars.githubusercontent.com/u/260348840?s=112" width="56" height="56" alt="kingcharleslzy-ai" /><br /><sub>kingcharleslzy-ai</sub></a></td>
    <td align="center" width="120"><a href="https://github.com/luowang-ui"><img src="https://avatars.githubusercontent.com/u/62333101?s=112" width="56" height="56" alt="luowang-ui" /><br /><sub>luowang-ui</sub></a></td>
    <td align="center" width="120"><a href="https://github.com/heigit"><img src="https://avatars.githubusercontent.com/u/8845668?s=112" width="56" height="56" alt="heigit" /><br /><sub>heigit</sub></a></td>
    <td align="center" width="120"><a href="https://github.com/OGHong"><img src="https://avatars.githubusercontent.com/u/130678941?s=112" width="56" height="56" alt="OGHong" /><br /><sub>OGHong</sub></a></td>
    <td align="center" width="120"><a href="https://github.com/Wangxiaolu0716"><img src="https://avatars.githubusercontent.com/u/110671501?s=112" width="56" height="56" alt="Wangxiaolu0716" /><br /><sub>Wangxiaolu0716</sub></a></td>
  </tr>
  <tr>
    <td align="center" width="120"><a href="https://github.com/wtfsb19"><img src="https://avatars.githubusercontent.com/u/70636030?s=112" width="56" height="56" alt="wtfsb19" /><br /><sub>wtfsb19</sub></a></td>
    <td align="center" width="120"><a href="https://github.com/MingShi350"><img src="https://avatars.githubusercontent.com/u/47762455?s=112" width="56" height="56" alt="MingShi350" /><br /><sub>MingShi350</sub></a></td>
    <td align="center" width="120"><a href="https://github.com/loLollipop"><img src="https://avatars.githubusercontent.com/u/168881978?s=112" width="56" height="56" alt="loLollipop" /><br /><sub>loLollipop</sub></a></td>
    <td align="center" width="120"><a href="https://github.com/youki258"><img src="https://avatars.githubusercontent.com/u/177468176?s=112" width="56" height="56" alt="youki258" /><br /><sub>youki258</sub></a></td>
    <td align="center" width="120"><a href="https://github.com/SimonQvQ"><img src="https://avatars.githubusercontent.com/u/154972131?s=112" width="56" height="56" alt="SimonQvQ" /><br /><sub>SimonQvQ</sub></a></td>
    <td align="center" width="120"><a href="https://github.com/alexopenfan-xiaxin"><img src="https://avatars.githubusercontent.com/u/267281196?s=112" width="56" height="56" alt="alexopenfan-xiaxin" /><br /><sub>alexopenfan-xiaxin</sub></a></td>
  </tr>
  <tr>
    <td align="center" width="120"><a href="https://github.com/Minervaowl7"><img src="https://avatars.githubusercontent.com/u/127482476?s=112" width="56" height="56" alt="Minervaowl7" /><br /><sub>Minervaowl7</sub></a></td>
    <td align="center" width="120"><a href="https://github.com/ShiTan-677"><img src="https://avatars.githubusercontent.com/u/91113050?s=112" width="56" height="56" alt="ShiTan-677" /><br /><sub>ShiTan-677</sub></a></td>
    <td align="center" width="120"><a href="https://github.com/Minggle"><img src="https://avatars.githubusercontent.com/u/35053182?s=112" width="56" height="56" alt="Minggle" /><br /><sub>Minggle</sub></a></td>
    <td align="center" width="120"><a href="https://github.com/Steooenwolf-666"><img src="https://avatars.githubusercontent.com/u/156271754?s=112" width="56" height="56" alt="Steooenwolf-666" /><br /><sub>Steooenwolf-666</sub></a></td>
    <td align="center" width="120"><a href="https://github.com/a320583781-create"><img src="https://avatars.githubusercontent.com/u/234735967?s=112" width="56" height="56" alt="a320583781-create" /><br /><sub>a320583781-create</sub></a></td>
    <td align="center" width="120"><a href="https://github.com/longyanbo1224-debug"><img src="https://avatars.githubusercontent.com/u/334267419?s=112" width="56" height="56" alt="longyanbo1224-debug" /><br /><sub>longyanbo1224-debug</sub></a></td>
  </tr>
  <tr>
    <td align="center" width="120"><a href="https://github.com/0xnuu"><img src="https://avatars.githubusercontent.com/u/113989865?s=112" width="56" height="56" alt="0xnuu" /><br /><sub>0xnuu</sub></a></td>
    <td align="center" width="120"><a href="https://github.com/21hbguo"><img src="https://avatars.githubusercontent.com/u/139569698?s=112" width="56" height="56" alt="21hbguo" /><br /><sub>21hbguo</sub></a></td>
    <td align="center" width="120"><a href="https://github.com/AkiraNyx"><img src="https://avatars.githubusercontent.com/u/176532870?s=112" width="56" height="56" alt="AkiraNyx" /><br /><sub>AkiraNyx</sub></a></td>
    <td align="center" width="120"><a href="https://github.com/cracer4869"><img src="https://avatars.githubusercontent.com/u/46320829?s=112" width="56" height="56" alt="cracer4869" /><br /><sub>cracer4869</sub></a></td>
    <td align="center" width="120"><a href="https://github.com/fomaper"><img src="https://avatars.githubusercontent.com/u/38674512?s=112" width="56" height="56" alt="fomaper" /><br /><sub>fomaper</sub></a></td>
    <td align="center" width="120"><a href="https://github.com/Kilig1058674225"><img src="https://avatars.githubusercontent.com/u/68159061?s=112" width="56" height="56" alt="Kilig1058674225" /><br /><sub>Kilig1058674225</sub></a></td>
  </tr>
  <tr>
    <td align="center" width="120"><a href="https://github.com/Legeo969"><img src="https://avatars.githubusercontent.com/u/79903511?s=112" width="56" height="56" alt="Legeo969" /><br /><sub>Legeo969</sub></a></td>
    <td align="center" width="120"><a href="https://github.com/LinyiAIGC"><img src="https://avatars.githubusercontent.com/u/68159061?s=112" width="56" height="56" alt="LinyiAIGC" /><br /><sub>LinyiAIGC</sub></a></td>
    <td align="center" width="120"><a href="https://github.com/lyufeng000"><img src="https://avatars.githubusercontent.com/u/168790556?s=112" width="56" height="56" alt="lyufeng000" /><br /><sub>lyufeng000</sub></a></td>
    <td align="center" width="120"><a href="https://github.com/Musan-34"><img src="https://avatars.githubusercontent.com/u/279201993?s=112" width="56" height="56" alt="Musan-34" /><br /><sub>Musan-34</sub></a></td>
    <td align="center" width="120"><a href="https://github.com/qianxuno"><img src="https://avatars.githubusercontent.com/u/179305118?s=112" width="56" height="56" alt="qianxuno" /><br /><sub>qianxuno</sub></a></td>
    <td align="center" width="120"><a href="https://github.com/TLcmmmm"><img src="https://avatars.githubusercontent.com/u/167976723?s=112" width="56" height="56" alt="TLcmmmm" /><br /><sub>TLcmmmm</sub></a></td>
  </tr>
  <tr>
    <td align="center" width="120"><a href="https://github.com/Tofu707"><img src="https://avatars.githubusercontent.com/u/178003727?s=112" width="56" height="56" alt="Tofu707" /><br /><sub>Tofu707</sub></a></td>
  </tr>
</table>
<!-- CONTRIBUTORS:END -->

名单合并 GitHub 提交者与人工鸣谢记录，自动每日刷新并保留历史贡献者。头像顺序不代表贡献排名，也不将问题报告者误记为代码作者。

### DSH Store 收录信息

DSH Store 申请必须填写 **Plugin path：`.`**，安装根目录的 `dsh-purge-community`；不要留空或选独立面板包。逐版本兼容声明已放入 manifest，未验证版本保持 `unknown`。元数据修正不等于市场已批准安装；[路径、兼容证据和收录边界](docs/DSH-STORE.md)。
