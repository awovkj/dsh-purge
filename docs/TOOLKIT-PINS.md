# 固定工具版本与部署回执

适用于 dsh-purge 1.9.0 的 Linux/WSL x86_64 工具部署源码。本轮未运行部署、下载、摘要检查或工具探测。

随包 `scripts/redteam-tools.lock.json` 固定已知发行：

| 工具 | 固定 tag | 资产 |
| --- | --- | --- |
| fscan | v2.2.2 | fscan-nolocal_2.2.2_linux_x64 |
| gogo | v2.15.0 | gogo_linux_amd64 |
| suo5 | v2.2.0 | suo5-linux-amd64 |
| frp | v0.72.0 | frp_0.72.0_linux_amd64.tar.gz |
| ksubdomain | v0.7 | ksubdomain_linux.zip |
| OneForAll | v0.4.5 | 固定 tag 源码归档；需操作者摘要 |

chisel、ProjectDiscovery 系列、ligolo 与 gowitness 没有在本次评审中确定发行版本；随包锁保留空 pin，等待操作者明确选择。已有本机工具继续可配置使用，不因空 pin 被删除。

**锁中的 `sha256:null` 表示未提供摘要，不能当作校验通过。** 二进制助手只查询确切 tag，唯一匹配资产 name/id/size；操作者有已审阅 SHA256 时使用该值并与官方摘要比较，否则只接受官方 API 对该固定资产提供的 `sha256:` 摘要。缺摘要明确受阻。这个官方摘要不是额外签名或独立审计。

源码归档不采用浮动 tag/commit，也不因 API 缺摘要免检；OneForAll 需要操作者在覆盖锁中登记实际审阅的归档 SHA256。不会自动创建 venv、升级 pip 或安装未锁定依赖。

## 操作者覆盖

覆盖锁放在用户自己管理的路径，以环境变量 `PURGE_TOOL_LOCK` 或 `--lock=绝对路径` 指定。插件只分发默认锁，不改操作者覆盖文件。

覆盖 JSON 使用 `schema:dsh-purge-tool-lock/v1`、`platform:linux-amd64` 和 `tools`。每个被覆盖工具提供完整 entry：repo、tag、asset 或 source_archive、format、SHA256、明确文件映射。不要填 latest、正则资产名、未知版本或虚构摘要。

支持 `raw/gzip/zip/tar`；每个 source 名或 basename 必须唯一，源码树必须指定准确 tree 前缀。仅将声明成员安装到 toolkit 内；拒绝路径穿越、重复成员、链接、特殊文件及超预算内容。先暂存下载、匹配摘要和大小，再发布声明文件。

显式使用入口：

```bash
# 完全离线，只看现有文件与回执；不运行任何二进制
bash "$DSH_HOME/redteam/setup.sh" --check

# 只部署明确选定工具，采用操作者审阅的覆盖锁
bash "$DSH_HOME/redteam/setup.sh" --yes --tool=fscan --lock=/absolute/operator/tools-lock.json
```

仓库中的入口为 `scripts/redteam-setup.sh`。安装源码会一并分发 setup.sh、redteam-tool-download.py、redteam-tools.lock.json 和 wsl-install-tools.sh；setup 内容没变也会处理缺失附件。

已有文件没有匹配回执或哈希不符时保留并返回 `present_unattested/changed_or_different_pin` 或受阻。明确 `--force` 才替换选定工具文件，并备份到 toolkit 的 `.download-backups/<id>/`，其他文件、源码树内追加内容和用户 venv 保留。不会通过版本/帮助命令诊断后自动删除现有文件。

回执在 `.receipts/<tool>.json`，包含 repo、tag、asset/id、归档摘要、摘要来源、安装文件摘要、时间和备份 ID。`runtime_probed:false`、`capability_ready:false` 明确说明部署没有执行工具；单独的真实运行探测仍是必要前提。`.setup-complete` 只保存部署元数据，不表示认证、网络或工具运行成功。

## WSL 与系统包

在选定分发中显式设置真实 `DSH_HOME` 后调用 `wsl-install-tools.sh`。脚本不根据 root 的 home 猜 profile，不替换 Kali 源，不改 proxy、不执行 apt update。

可选 `--apt-lock=绝对路径` 必须每行一项 `package=exact-version`；复用操作者已有源及索引，找不到确切版本保持失败。`--check/--inventory` 不安装包或创建系统链接。可选 `--system-links` 在同 toolkit 部署锁内读取本地回执及全部文件摘要，仅为缺失的 `/usr/local/bin` 入口链接到回执内的实际可执行文件；无回执、文件变化或既有入口均保留。这个本地回执不是额外签名，链接创建也不表示运行成功；直接工具使用仍优先在面板设置正确路径。

浏览器优先复用已有明确 executable/module；不使用 `npx --yes @playwright/cli@latest` 自动下载。实际浏览器能力、身份和材料验证与文件部署分开记录。
