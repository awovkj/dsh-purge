# 红队、SRC 与渗透模式同时缺失的加载修复

这是 **1.8.1** 共享工具入口修复的历史记录。当时只读取已有回执和源码，未运行测试、验证、安装、apply 或重启。当前 **1.10.0** 还修复了 `list_agents` 与 fork 的实际 Loader 阻塞，并进行了隔离回归和 DSH Desktop 0.2.2-rc.3 四预设/工具目录验收，见 [本轮实施记录](MODE-UPGRADE-1.10.0.md)。下面的历史未测试说明只对应 1.8.1。

## 已有故障证据

2026-11-12 的既有注册回执中，`unrestricted` 为 `registered`；红队为 `registered-broken`，SRC 与渗透模式为 `register-failed`。三种模式的错误均指向同一行：

```text
redteam-tools (dsh-purge-community/redteam/tools): never started
```

宿主在导入插件失败时没有建立该行的 fiber，预设审计便返回 `never started`，客户端随后过滤该 broken 预设。这些回执确认了共同的加载失败位置，但没有保留底层导入异常；不能据此编造具体 Node 错误码，也不能当成新代码已在 GUI 恢复的证明。

## 源码修复

- `lib/redteam/tools.js` 移除模块顶层的 SDK 同步加载。插件进入 `apply` 后，从当前 `profileContext.installAnchor` 通过宿主 Loader 或原生异步 import 加载 `@deepseek-ai/dsh-tools`。有明确安装锚点时不转向其他 profile、工作目录或猜测的全局安装。SDK 导出、导入或解析失败保留实际错误和 cause，不提供假的工具实现。
- `lib/redteam/preset-composition.js` 在注册前预加载本安装的工具模块，把属于本包的工具行在内存中绑定到该模块的文件 URL。源码依赖缺失或导入失败直接进入注册回执，避免只剩宿主的 `never started` 摘要。此步骤不注册工具、不初始化评估或访问目标。
- `lib/presets-plugin.js` 与红队注册入口共用上述准备步骤。内置预设重试使用单个定时器和执行锁，各模式独立限制失败次数；卸载时取消定时器，异步完成后检查生命周期并释放迟到的注册。已停止的旧实例不再覆盖新实例的回执。
- 既有运行夹具同步等待工具插件的异步 `apply`；本次没有执行这些夹具。

用户 `agent.cordis.yml`、`preset.yml`、提示词和运行设置原文保留。固定 scope/exclude、会话绑定、SRC 停测与渗透报告继续使用现有策略。

## 后续读取回执

| 模式 | 本地回执 |
| --- | --- |
| 红队 | `$DSH_HOME/redteam/preset-declare.json` |
| SRC | `$DSH_HOME/dsh-purge-community/preset-declare.json` 的 `src` |
| 渗透 | 同一文件的 `pentest` |

关注 `phase`、`error`、`error_code`、`broken` 和 `at`。`loading-tools` 是准备阶段；`registered-broken` 或 `register-failed` 保留故障，文件存在或旧 `registered` 回执不代表当前 GUI 已加载。`REDTEAM_PRESET_TOOLS_IMPORT_FAILED` 表示随包工具源码导入失败；`REDTEAM_TOOL_SDK_LOAD_FAILED` 表示当前宿主 SDK 加载失败，其详细原因仍需读取实际错误。

修复保存在工作区，当前安装和运行进程没有替换或重载。真实模式下拉恢复仍待使用修复后的安装进行验收。
