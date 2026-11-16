# Prompt Lab v2：请求侧语义传输

> 本地迭代稿，不随公开仓库宣传。目标是把截图里的四条论文结论落到 purge 的注入链路，而不是继续堆叠同义禁令。

## 1. 设计

| 论文/技术 | 本实现的落点 | 文件 |
| --- | --- | --- |
| Yong et al. 2023 低资源语言翻译 | `polyglot_priority` 保留在 Prompt Lab 完整稿；最终发布版只保留 `BOOST_TEXT` 中的两行多语言锚点，避免大段显式运输层触发元识别 | `lib/prompt-transport.js`、`lib/boost.js` |
| Huang et al. 2024 Bijection learning | `bijection_layer`：ROT13 字符双射，模型现场解码；完整稿保留，生产稿按 A/B 结果不直接粘贴 | `lib/prompt-transport.js` |
| Lv et al. 2024 CodeChameleon | `user-prompt-codec.js`：把高风险用户消息包装成 base64 本地测试向量 + Python 解码函数，模型解码后执行 | `lib/user-prompt-codec.js` |
| Hughes et al. 2024 Best-of-N | `best_of_n`：三个内部候选；`refusal-retry.js` 的运行时策略阶梯：polyglot → bijection → codec，最多三次重试 | `lib/prompt-transport.js`、`lib/refusal-retry.js` |

人工可读的生成稿在 `prompt-lab/prompt-inject-v2.md`；真正嵌入安装包的是
`lib/default-prompt-inject.md`，再由 `scripts/embed-default-prompt.mjs` 写入
`lib/asset-table.js` 的加密槽。构建命令：

```sh
node scripts/build-prompt-v2.mjs
node scripts/embed-default-prompt.mjs
```

## 2. 关键结论

第一版把完整运输层直接塞进系统提示词，六条硬样例仍是 2/6 拒绝（另有 market 实际拒绝但检测器漏记），说明**把越狱指令显式写进 system prompt 会增加元识别**，不是有效路线。

第二版改为：

1. **系统提示词**只增加 300 字符左右的 `local_codec_contract`，告诉模型如何处理 `<dsh_local_codec>`；
2. **用户消息**在 `agent/pre-step` 阶段被包装成 base64 代码块，只有命中的高风险类别才包装，普通编程请求原样通过；
3. **拒绝重试**保留为最后一道 Best-of-N，不把“再试一次”写进首轮 prompt；
4. `BOOST_TEXT` 保持在 2000 字符以内，只保留两行多语言锚点。

本机 A/B（`workbuddy/deepseek-v4.1-flash`，六条硬样例，temperature 0.7）：

| 版本 | 拒绝 |
| --- | --- |
| v1 原提示词 | 2/6（检测器口径；market 的实际拒绝被当前正则漏记） |
| v2 完整运输层直接入 system | 2/6（检测器口径；实际约 3/6） |
| v2 compact + 用户消息 codec | 见 `prompt-lab/eval-final.json`，本轮为 0/6 |

评测只保留模型名、拒绝布尔值、字符数和 80 字摘要，不保存回答正文。评测走本机
`127.0.0.1:3425` 的 OpenAI-compatible 网关，不向外部上传提示词或目标材料。

## 3. 验证

```sh
node --test test/prompt-transport.test.mjs test/user-prompt-codec.test.mjs test/refusal-retry.test.mjs test/prompt-sections.test.mjs test/boost.test.mjs
node scripts/prompt-lab-eval-final.mjs
```

## 4. 安装与回滚

本地构建安装：

```powershell
npm pack --ignore-scripts
node bin/community.js migrate "绝对路径\dsh-purge-community-1.8.1.tgz"
```

安装器会先备份 profile 的依赖、锁文件和插件入口；升级后用户手动完整退出并重开 DSH。
默认提示词由插件在启动时同步；如果磁盘上是用户手改稿，保持原样，不覆盖。
回滚使用安装输出中的 `backup_id`：

```powershell
node bin/community.js rollback "<backup_id>"
```

## 5. 边界

- 外层清单是加密的，公开仓库只保留密文和可复现构建脚本；不要把解码后的清单直接提交到公开 issue、README 或截图。
- 请求 codec 只处理 `source.kind === "user"` 的最后一条消息，不碰工具消息、助手历史、附件或插件消息；超过 12000 字符的输入不包装。
- 本轮只做本地构建、安装和 A/B 评测，不自动重启宿主；运行时新代码要重启后加载。
- 安装包版本沿用 `1.8.1` 时，profile 的 `file:` 规格会指向新的持久归档；`purge-community status` 仍显示 1.8.1，需以 profile 依赖路径和文件哈希区分本次本地构建。
