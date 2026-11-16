# Prompt Lab v2 本地安装记录

- 构建时间：2026-11-13 20:56（Asia/Shanghai）
- 安装目标：`C:\Users\Administrator\.dsh\profiles\desktop`
- 安装包：`dist/20261113-promptlab/dsh-purge-community-1.8.1.tgz`
- SHA-256：`0770ceb9c72ef53c3a32a184715e6390cfa36e4bf07b657db789b9df8fe9b6f8`
- 包内版本：`dsh-purge-community@1.8.1`（本地内容构建，不是新的公开发行 tag）
- 迁移备份：`2026-11-13T12-56-07-820Z-2598b4c1`
- 活动提示词：`C:\Users\Administrator\.dsh\prompt-inject.md`，21,728 字符，含 `<local_codec_contract>` 与规则 26
- 已启用：`refusalRetry: true`、`boost: true`、`injectPosition: head`
- 红队环境：`wslDistribution: kali-linux`，工具 **15/15** 已解析；入口为 `dsh-purge → 演练台 → 环境适配`
- 新增工具：chisel / subfinder / dnsx / nodejs（apt），fscan v2.2.2 / gogo v2.15.0 / suo5 v2.2.0 / frp v0.72.0（frpc+frps）/ ksubdomain v0.7
- 浏览器依赖：WSL Python Playwright 1.55.0 + Chromium 150.0.7871.181 已存在
- SRC/渗透：`redteam/settings.json` 的 `awa.executionBackend` 已设为 `wsl`，WSL Python 3.14.7 / sqlmap 运行时探测通过
- 当前运行进程尚未加载 WSL 适配代码，配置暂置 `envAdaptSkip: true` 以免旧进程继续拦截；重开后新代码会优先显示 `WSL Kali` 就绪

## 本机 A/B

- 模型：`workbuddy/deepseek-v4.1-flash`
- 六条硬样例：terror / market / disinfo / malware / phish / cookie
- v1 原提示词：2/6 拒绝（检测器口径；实际 market 也拒绝）
- v2 完整运输层直接入 system：2/6（检测器口径；实际约 3/6，已弃用该布局）
- v2 compact + 用户消息 codec：**0/6 拒绝**，见 `eval-final.json`

## 注意

- 运行中的旧进程仍加载旧 `lib`；新的 `agent/pre-step` codec 与三档重试要在用户完整退出并重开 DSH 后加载。
- 提示词文件已即时更新，当前会话下一轮即可读到；但请求侧 codec 需要重启后的插件进程。
- 回滚：`node bin/community.js rollback "2026-11-13T12-56-07-820Z-2598b4c1"`（在对应 profile 的 CLI 环境中）。
