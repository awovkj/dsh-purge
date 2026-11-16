# WSL Kali 适配

当前源码版本 **1.9.0**。本轮只修改源码和指引，没有执行 WSL 命令、下载、安装、探测、测试或验证；历史单机工具记录不作为当前版本能力证明。

## 配置入口与实例

使用 `dsh-purge → 演练台 → 环境适配` 保存当前平台、实际 WSL 分发及工具路径。配置位于实际 `$DSH_HOME/redteam/config.json`；分发名称由操作者选择，不能默认认为本机已有 kali-linux。操作者已有的配置不由源码升级覆盖。

Windows 宿主的既有适配逻辑会读取分发及平台信息并缓存工具定位。定位到 `/usr/bin/nmap` 等文件时，实际执行应使用本次返回的 `wsl.exe --distribution <实际分发> --exec <实际工具路径>`，不能在 Windows 直接执行 Linux 路径，也不能把 `\\wsl$` 路径当成可执行入口。

文件可解析、分发存在和历史命令记录不等于当前工具能启动。宿主工具、红队 SQLite、内置 Node/Python 核心和实际浏览器分别展示；缺一项只阻塞其依赖任务。

## 固定部署

仓库入口是 `scripts/wsl-install-tools.sh`，安装后的随包副本为 `$DSH_HOME/redteam/wsl-install-tools.sh`。先在选定分发中设置本实例**实际 DSH_HOME 的 Linux 路径**；Windows home 可使用对应 `/mnt/...` 映射，不自动选择 root 的 home 或另建 profile。

下面是离线清单的调用模板，路径、分发与用户名须替换为实际值；本轮没有执行：

```powershell
wsl.exe --distribution kali-linux --user operator --exec env DSH_HOME=/mnt/c/path/to/actual-dsh-home bash /absolute/path/wsl-install-tools.sh --check
```

`--check/--inventory` 只读取现有文件和部署回执，不执行任何二进制、不安装系统包或创建系统链接。实际部署时按已审阅覆盖锁显式选择 `--tool=<工具ID>` 与 `--lock=/absolute/operator/tools-lock.json`。随包锁针对 Linux/WSL x86_64；其他架构复用操作者已准备的本机工具，不任选相似资产。

固定发行包括 fscan v2.2.2、gogo v2.15.0、suo5 v2.2.0、frp v0.72.0、ksubdomain v0.7 与 OneForAll v0.4.5。具体资产、摘要缺失与源码归档条件见 [固定工具部署](TOOLKIT-PINS.md)。锁中空 pin 或 sha256:null 都不表示可以省略核验；没有实际官方或操作者摘要时保持受阻。

脚本复用既有源、代理与索引，不执行 apt update，不引入临时 Kali 源。可选 `--apt-lock=/absolute/packages.lock` 每行一项 `package=exact-version`，仅在明确的分发与权限下安装这些版本，失败不退回浮动版本。不会自动更新 nuclei 模板、创建 OneForAll venv 或安装 Playwright。

可选 `--system-links` 在同 toolkit 的部署锁内读取匹配本地回执与全部文件摘要，只为缺失 `/usr/local/bin` 入口链接声明的可执行文件。既有入口、无回执文件和内容变化均保留；创建链接不表示工具运行成功。优先在面板直接配置已有准确路径，不要求全局链接。

## SRC / 渗透评估后端

两种模式使用本安装的内置 awa-ddd 2.2.0 及本地 1.9.0 适配。操作者在「内置评估」页保存后端、分发、Python 与超时，相关字段位于 `$DSH_HOME/redteam/settings.json` 的 `awa` 配置。以下仅解释字段，不用于覆盖现有设置：

```json
{
  "awa": {
    "executionBackend": "wsl",
    "wslDistribution": "kali-linux",
    "wslPythonExecutable": "python3",
    "timeoutMs": 120000
  }
}
```

评估要求 Node ≥22.19、Python ≥3.10。WSL 使用该分发实际解释器与模块；Windows 上已有 Playwright 或 Chromium 缓存不能证明 WSL 浏览器可启动。`PURGE_PLAYWRIGHT_ROOT` 指向已有实际模块，`PLAYWRIGHT_BROWSERS_PATH` 只影响缓存选择，模块定位与浏览器运行分开记录。

SRC 仍只开放固定 typed 动作，拒绝凭据、Shell、委派、业务写入与主动外部适配器，持久直接证据停止保留。渗透模式保留实际身份、正常/攻击/阴性控制、自有 fixture 和变更许可；WSL 后端不扩大范围或提供通用 Shell。真实身份和控制材料与本地运行探测是不同证据。

## 故障与历史边界

`Wsl/Service/E_UNEXPECTED`、分发缺失、解释器或模块缺件分别记录具体失败与受阻项。先保留现有任务和回执，定位实际分发、入口与设置；不要自动 `wsl --shutdown` 终止所有分发，或换源、改代理、重装工具掩盖原因。需要重启服务时由操作者在安排现有任务后处理。

旧文档记录过特定机器上的 nmap/nuclei/masscan/ffuf/httpx/impacket 定位、fscan/gogo/suo5/ksubdomain 启动，以及 Node 24.19.0、python3-playwright 1.55.0、Chromium 150.0.7871.181 和 15/15 路径解析。这些属于改动前的单机历史，不证明当前工具、浏览器、GUI 或 1.9.0 评估闭环。历史版本与当前源码状态应分别陈述。

本轮没有安装、apply、重启 DSH、访问目标或运行上述清单与探测。完整三模式变化和未测边界见 [1.9.0 升级说明](MODE-UPGRADE-1.9.0.md)。
