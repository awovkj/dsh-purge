# 维护、迁移与恢复

当前源码版本 **1.13.0**。包名 `dsh-purge-community`，正式发行渠道为本仓库 GitHub Releases；保留内部 Cordis ID `dsh-purge`、HTTP `/dsh-purge/*` 及用户数据目录。本版移除插件内置的检查更新子系统，并清空测试与草稿产物；升级改为显式安装发行包。[发行说明](releases/1.13.0.md)。主安装步骤与镜像故障决策树统一见 [安装指南](INSTALLATION.md)；[AGENTS.md](../AGENTS.md) 是 Agent 操作说明。

## 1.12.0 路由与证明维护

`tool.route` 是只读建议，不是运行探测或工具调度；需要实际执行时复用返回的 next 参数。安装回执、MCP 握手、browser 缓存和旧能力回执不能当成当前受支持 profile。明确 runtime/file/profile/backend 变化后重新显式准备，不改源/代理/后端或自动下载依赖。

维护者核对随包改动用 `npm run check:assessment`。明确审阅 allowlist 内的本地适配后可用 `node scripts/sync-assessment-engine.mjs --record-local` 记录新字节哈希；这不验证代码正确性或工具运行，也不改变上游哈希。未审阅文件变更/未知新增文件拒绝记录。原始 upstream/许可和历史升级结果保留。

## 1.11.0 发现辅助维护

新动作契约见 [发现工作流](DISCOVERY-WORKFLOW.md)。`assessment/discovery/sourcemaps/<maphash>/` 保存哈希来源与私有源码，不依目标给出的来源路径写入。`intel/catalogue.json` 是靶标内离线元数据缓存，声明来源没有被远程核实；缓存损坏时保留原文，不自动清空、修复、同步或执行。`workspace.list/read` 的固定材料目录不包括此缓存、凭据或原生数据库。三者均不构成 observed/confirmed 或覆盖完成。

新增技能专题及元数据由 `build:modes/check:modes` 核对；读取索引时实际模式优先于能力声明，unknown 不表示可运行。派发失败缺少可信 no-start 回执时保留 lease，真实完成后回收。得分、发现和 SRC 停止的 offset 独立，优先复用签名 `next.arguments`。本轮没有改变随包 awa-ddd 的来源源码或发布独立面板版本。

## 内置评估源码与历史数据

awa-ddd 2.2.0 的生产评估源码随 `lib/redteam/assessment-engine/` 分发，MIT 许可证、NOTICE 和 `provenance.json` 保留上游来源及逐文件哈希。1.10.0 更新来源停止/浏览器发送前适配的 bundled 摘要和本地适配版本；自有 helper 标 origin:dsh-purge，不改变上游版本及原来源哈希。`node scripts/sync-assessment-engine.mjs --check` 离线核对本包来源，本轮结果记录在实施说明。显式 --source 仅对匹配确切已记录上游哈希的适配保留本地版本，漂移须重审，--force 不自动授权覆盖契约。运行时直接使用随包核心，不自动查询或同步独立 AWA 项目。[维护流程和当前边界](MODE-UPGRADE-1.10.0.md)。

每个 engagement 的 `<靶标目录>/assessment` 是独立评估工作区，内部项目固定为 `assessment`；模型不能替换 code/workspace。旧 `settings.json` 的外部路径/工作区及 `awa-binding.json` 保留为历史数据，不选择或执行外部引擎。独立 awa-ddd 2.2.0 升级、用户提示词和设置不因嵌入改写；维护源码不自动部署、应用补丁、初始化目标评估或重启正在运行的 DSH。

## 1.10.0 三模式维护

模式注册从当前 profile 的 Loader 和安装锚点取证，只有 AST 证明 control 主插件已经登记 `list_agents` 时才移除冗余旧行。spawn 使用等价子预设，fork 继承父历史并在 `tools.guard` 执行原 deny；缺守卫时失败。服务代际回收、各模式独立失败预算和卸载取消共用注册驱动；原用户 YAML 保留。

SRC 分类字段与提交草稿在正常数据库升级时添加，历史加固项保留但不进入漏洞分母；真实低危缺陷保留。先通过 `redteam_src_runbook resource:submission` 读取实际规则、最小验证、查重及草稿步骤。当前机器证明和材料完整性分别显示，报告包含候选、待复核、停止和剩余。渗透的 vulnerability 与 recommendations 分开计数，测试凭据使用句柄。源码维护只迁移临时测试数据库，没有改正式用户数据。

`assessmentContinuationGuard` 默认开，`requireAssessmentForHighValueScore` 新默认开启，操作者已明确保存的 false 保留；设置位于 `$DSH_HOME/redteam/settings.json`，模型输入不改设置。续跑钩子登记只证明注册，不能代替真实回合事件执行记录。

三模式模型只登记 claimed/inferred，observed 使用可信代码采集器及不可编辑 provenance。历史无回执 observed 保留 legacy_unattested，不批量删除或自动重认证。发现写入和报告共用精确 proof 契约；原生旧机器标签缺 claim_contract 时保留待复核。原有持久 SRC 停止不因标签待复核、发现编辑或删除而撤销。

同靶标 SQLite lease 在实际派发入口共享计数，registry/session ID 保存明确别名，未知派发状态保留占位。只有真实结束回收已派发任务；未派发 reservation 可过期，不能手工释放 running lease 冒充任务结束。新凭据使用 AES-256-GCM，默认查询为 cred_<id>；迁移数据须保留对应 `.credential-vault-key` 和 engagement 身份，密钥不可用时保留记录并显示 vault_unavailable。源码工作没有执行这些用户数据库迁移。

v2 自动 provider 的已实现能力与前提缺失分开呈现；失败保留 run、partial evidence、attempt/cooldown 和未知写入状态。只补齐真实相关前提再准备，不因行政变化重试。报告同时展示当前机器证明、待复核和未完成分母，不能用报告生成成功宣称任务完成。

SRC 专用根 `$DSH_HOME/redteam/src-skills/src-discovery/` 由随包技能/文档同步；红队根也提供同份技能。旧 SRC 预设在注册时只做内存适配，原用户 YAML 不重写。`redteam_src_runbook` 始终读取当前安装的固定资源，注册回执、技能同步和实际 GUI 加载分别记录。

来源 `src_source_stop` 是独立、不可更新或删除的停止台账；历史明确的 direct_evidence_obtained 停止会在正常数据库迁移时纳入，来源发现状态或目标编辑不会撤销原目标停止。可信门面同步固定工作区快照，HTTP、preflight、身份、间接配方和浏览器每次发送前同时检查来源与 native 停止；快照坏损时零发送失败。正式用户数据库尚未执行迁移。

`redteam_delivery_report` 与面板合并交付入口只读取当前已有覆盖，保存分页 Markdown/JSON。来源候选、复核和交付优先直接复用返回的签名 `next.arguments`；token 绑定服务、靶标、模式、流与验证语义，旧 offset 兼容。交付各流耗尽后不重复，切靶清空游标；不可读和未初始化的覆盖保持 unknown。报告与 checkpoint 不自动结项，SRC 不声明范围耗尽，独立 AWA 证据不跨账本确认。SRC 报告与渗透完整报告各遵守明确预算，超限在写入前失败。完整变更与未验收边界见 [1.10.0 升级说明](releases/1.10.0.md)。

## 兼容与操作边界

历史宿主与安装验收记录见 AGENTS 和对应维护文档；1.10.0 的 86 条宿主补丁源码目标仍是 Desktop 0.2.2-rc.1。实际 Desktop 0.2.2-rc.3 的专用 Electron 副本已核实预设 Loader 和空白工具目录，完整 GUI、补丁与实际调度未验收。缺失宿主布局时停止写入，组件版本不一致只报告。正常维护可使用 selfcheck/diagnose 逐条核对，本轮没有对正式安装执行。安装器支持 Windows 入口不等于完整 Windows 补丁/UI 已验收。

安装/更新、应用宿主补丁、重启是独立动作。安装前备份，应用宿主补丁前也备份；不因安装成功自动应用或重启。更新检查与自动安装分别设置，默认检查开、安装关，已有偏好继续保留。

## 快照

路径 `$DSH_HOME/dsh-purge-community/backups/<id>/manifest.json`，完整性清单含 SHA256 与原 profile、Purge bundles；大文件内容寻址去重在 `objects/`。默认保留最近 5 份、每天 1 份共 7 天、200MB 上限，当前操作快照受保护。维护锁防止并发；异常退出残留锁先确认没有维护进程，不能盲目删锁。

包含已安装 Purge 包、profile 的 package.json/cordis.patch.yml/pnpm-lock.yaml、Purge 状态、prompt-inject.md、规则。不会额外扫描独立凭证、会话或 Qwen 图库/模型。profile 本身可能含私密连接信息，**不要公开整个备份**。

## 失败恢复

下载/校验失败未进入迁移；迁移开始后先快照再安装。安装包复制到持久 pkgs 目录，避免 file: 依赖指向临时下载。失败返回备份 ID；原 package.json 仅在无其他依赖并发变更时恢复，不宣称整个 node_modules/锁文件已原子回滚。核对实际状态后再走回滚。

回滚先验证快照、备份当前状态，用当前实例 DSH CLI 安装快照代码，仅恢复 Purge 启用入口，保留现在的提示词、规则和其他插件配置。用户内容若要取回，从快照按文件人工选择；不整份覆盖 profile。安装器失败的原锁文件可供核对，不能覆盖别的插件的新变化。

```sh
purge-community backup
purge-community rollback <backup-id>
# 已装插件无法加载时，用另行校验过的发行包 CLI：
# 设置 PURGE_DSH_CLI / DSH_HOME / DSH_PROFILE 后执行
node package/bin/community.js rollback <backup-id>
```

profile 不存在/有多个且未明确选择时停止。Web/Headless 只用当前服务 CLI；见 [实例定位](WEB-MAINTENANCE.md)。不扫描并误操作其他桌面安装。

## 发行与安装

插件内不再检查或安装更新。升级由官方 CLI 显式安装目标版本发行包，安装前自动备份；独立安装器负责来源、SHA256 与下载预算校验。镜像与 GitHub 密钥配置随更新通道一起移除，旧配置文件不再读写。

## 发布约束

同步 package.json、release-notes、README.md、README.zh-CN.md、英文指南、AGENTS.md、维护与安装文档的当前版本。`npm run check:docs` 检查中文副本一致及关键安装边界。CI 运行功能/打包回归和三个操作系统的安装器测试，Windows 入口同时跑 PowerShell 5.1/7；通过后 tag 发布 tgz、稳定别名、SHA256。市场索引跟随正式 release。真实宿主验收与模拟测试分别报告，不把未知平台写成已验证。

## Windows 换包状态与离线恢复（issue #10）

1.6.26 不再通过定时退出后台或杀掉桌面壳换包。用户点「应用」后助手等待所有同安装路径的 DSH 进程退出，保存唯一的原归档备份，验证 SHA256，然后停止；用户自行打开。正在运行的其他安装不受影响。等待期间官方替换归档会报错并保留新归档，须对新版本重新应用。

诊断位于 `resources/app.asar.purge-handoff.json` 和 `.json.log`。`starting` 不是就绪，`waiting_for_quit` 不是完成，磁盘补丁数不是当前进程已加载。助手没有确认就绪、提前结束或超时时，宿主保持运行。不要仅删除 pending 标记就宣布修复，不要禁用防病毒软件、全局调整权限或修改宿主崩溃提示来掩盖错误。

启动错误另见 `.json.broker.log`、`.json.launch.log`、`.json.launch.log.error`。实机发现 Electron 的 detached PowerShell 会退出 0 却不执行脚本，因此用短 broker 启动独立助手。broker 成功不代表握手成功；最终以状态文件为准。维护回归必须提供真实 Electron，并验证启动进程退出后助手仍存活，直到归档换包完成。

助手始终没有完成时：先保留日志，从系统托盘完整退出 DSH，确认任务管理器没有**该安装路径**的进程。仅当本次「应用」已成功、`resources/app/package.json` 及宿主文件完整时，才在独立 PowerShell 中将 `resources/app.asar` **改名保留**为新的带时间戳 `.bak`，再手动打开 DSH。这绕开的是失效的交接进程，不是重写补丁。若文件仍被占用/权限不足，保持原件并停止；不要删除 app.asar 或强杀所有 Electron。此步骤不能套到刚被官方更新替换的新归档。

回到原宿主：完整退出后，核对状态文件记录的 `backup` 与 `archive_sha256`，用 `Get-FileHash -Algorithm SHA256` 校验该原归档备份，确认没有跨官方版本。保留当前解包目录及现存归档，再将原备份复制回 `resources/app.asar`，手动打开。此过程不恢复 profile，不覆盖当前提示词、规则或其他插件设置。插件版本回滚仍使用前文 `rollback <id>`，两种回滚不要混淆。

## 原生设置接口与 #42 迁移（issue #9）

新版在原生 `describe` / `replace` 宿主只补设置更新事件，不制造混合 API。已注入的精确旧版 legacy shim 会在下次「应用」移除，需手动退出重开后生效。用户的 entry Config、settings.yaml/imported/legacy 文档均保留；这次修复不会把历史写入错误存储的数据静默合并。若其他插件此前把数据写入旧文档，先备份后由用户选择性迁移。未知第三方改写的 shim 停止应用，保留原文件、备份与诊断。

## 解包后 pnpm 路径缺失

1.6.9 预发布后发现 Windows 相对 junction 会随启动目录指错。1.6.26 使用绝对目标，安装前修复当前实例的链接，旧错误链接改名留存。若旧更新器已报 pnpm.mjs 不存在，使用独立安装入口固定 1.6.26；不要删除 app/runtime 目录内容或手动清空锁文件。换包前运行时不可用时保留原归档。

## 命令重名、接口 404 与自检黄色项（1.6.26）

#12 的作者已更正最初推测：实测中断点是 `/rewind` 重名，不是 inactive context。新版保留命令原持有者，并通过备用命令继续提供 Purge 功能。无需卸载其他插件或添加进程级轮询。

#15 将文件原值与有效值混淆。新版把 `inferred`、`unknown` 与 `broken` 分开；面板问号展示证据和范围。CLI 不执行配置表达式、不通过扫描别的安装猜测当前实例。参见 AGENTS §16；不要自动修改用户权限。
## 预设迁移与回滚（1.6.26）

`tool-subagent: toolFilter is no longer supported` 是预设激活兼容问题，不能用权限自检或“YAML 能解析”代替验收。新版会在注册前将可表达的旧 spawn deny 策略转换为原生子预设，原始用户文件不动。备份位于 `$DSH_HOME/dsh-purge-community/preset-migrations/`，每份带 SHA256 清单；缺少备份权限或已有快照损坏时停止。

不要使用 `preset install --force` 覆盖自定义文件来消除红框，不要只删除 `toolFilter`。父会话工具完整，子会话仍排除原来的工具，深度、人设和设置保留。现阶段只支持单个 spawn deny 清单，未知工具/已有 agentPreset/allow/多策略需要单独设计，不能自动猜测。

使用当前 Desktop 的真实 Electron 在隔离 home 中手工复现原错误、真实父/子 Agent 工具目录、重复加载、卸载和备份字节校验；此检查创建空白 Agent，不发送模型请求。本仓库已不附带该测试脚本。代码回滚会撤销运行时转换，不需要覆盖用户文件


## 1.6.26 权限恢复与只读诊断

[#20](https://github.com/kingcharleslzy-ai/dsh-purge/issues/20) 的原子替换丢失可执行位已修复。CLI 备份失败会停止写入；旧备份保留。回滚启动器时需同时恢复内容与普通 rwx 权限，不能只复制文本。备份为同目录 `.dsh-purge.bak`；若备份来自已损坏权限的版本，不能据此假定它具有正确执行位。不要对整个应用递归 chmod，也不要为了修复启动器去应用宿主补丁或重启应用。

[#19](https://github.com/kingcharleslzy-ai/dsh-purge/issues/19) 保持排查中。使用 `purge-community host-status` 或状态接口 `host_layout`，分别核对磁盘布局和当前服务入口。磁盘存在 app.asar 不足以证明当前服务从归档加载；归档已移走也不足以证明旧进程已经重载。Web/CLI 路径与 Desktop 路径不同，应保留并对照具体实例证据；不要直接移走归档、覆盖旧备份或反复重启来“消红”。

本次只调整通用文件操作、CLI错误上报和只读诊断；未更改宿主补丁、换包助手、提示词或权限策略。完整验证见 [1.6.26](releases/1.6.26.md)。

## 1.6.29：回滚与网络

面板回滚通过归档安装并校验新进程加载，失败恢复本轮前的依赖图。更新代理只作用于插件请求，不修改系统；token 仅发往 GitHub API。环境变量需由实际宿主进程继承。旧版本损坏 link 可用校验后的新版发行包通过独立入口恢复；不要删用户设置或全局缓存。限制及实测方法见 [维护说明](maintenance-issues-34-35.md)。

## 1.6.39：慢网更新与审计属主

归档预算使用 `PURGE_DOWNLOAD_TIMEOUT_MS`（默认 180000，范围 30000–900000）；可选 `PURGE_GH_MIRROR` 仅传输社区 TGZ，官方摘要不可用就停止。容器 root home 需明确服务 UID/GID；不要扩大权限或改全局代理。完整步骤、变量及测试边界见 [维护说明](maintenance-issues-44-47.md)。不自动重启。

独立安装器下载与网络排查见 [#52 维护说明](maintenance-issue-52.md)，不要将网络失败误判为安装破坏或要求用户清配置。

## 1.6.41：更新状态核对

旧版已卡住时先手动安装新版，由用户手动退出重开一次；不要删除设置或自动重启。插件已无更新开关。

## 更新通道网络与 Windows 凭据保护（1.6.67 / #122）

Windows 首次读取旧凭据时迁移 ACL；写入前保护暂存目录及文件，原子替换失败保留旧文件。不要关闭防护、扩大普通用户权限或修改全局代理。凭据保护实现见 `lib/secret-file.js`。

## 1.6.75 安装布局、镜像与市场

修复范围、真实运行证据及 Windows Defender 阻断见 [1.6.75 发行说明](releases/1.6.75.md)
