# session.v4 SRC 会话诊断与源码修复

日期：2026-11-12。输入为用户提供的本地 `session.v4.jsonl`。本文只记录脱敏计数、契约错误和源码处理，不包含真实目标地址、凭据、请求正文、模型原始消息或完整会话；原文件没有复制进仓库。

这是一份已有会话的分析，不是本次新进行的渗透测试。用户要求不运行验证和测试，本次没有回放目标请求、调用评估工具、探测浏览器或改动用户数据库。下面的修复均为未实测的本地源码改动。

## 会话实际完成到哪里

文件共 540 个事件、80 个 step、133 次工具调用。初始 header 中的预设是 `standard`，第 7 行的选择事件改为 `src`；不能仅凭 header 判断整次会话的模式。

有 21 次失败工具调用，另有一次成功返回的 assessment 批次包含失败子项。提供方还出现一次首回合 429 配额错误，这是独立的提供方故障，没有证据表明是 Purge 注入或 SRC 工具故障。

末尾台账保留 ready 0、review 35、blocked 1、unresolved 36，frontier 轮数为 0，没有 finalization；另有 28 个操作缺少安全测试义务。会话没有调用 `redteam_assessment_review`。多次 `assessment.evaluate` 和两批评估使用的是正常 `baseline`，这些结果不能等同于实际漏洞测试或漏洞不存在的证明。

因此此次交付应描述为发现与正常响应观察的阶段稿，保留未测、受阻和待复核项。统一的 fallback 页面、HTTP 200 或相同响应长度不能支持“全部接口安全”“不存在某类漏洞”或“整个范围已耗尽”的结论。

## 失败分类

| 现象 | 失败调用数 | 原因与处理 |
| --- | ---: | --- |
| `working_directory` 与两次独立 `awa_project` 被拒绝 | 3 | SRC 只使用当前靶标内置入口；保留边界，在预设和指引中明确正确工具 |
| `action_name` | 1 | 把 `actions` 当动作名；目录应使用 `action.help input:{}` |
| `scenario_extract` | 1 | 自行添加未支持的正则提取/断言字段；先读取该动作真实 help |
| `response_json` | 1 | 对 HTML 使用 JSON Pointer；新增离线正文类型与结构读取 |
| `pagination` | 1 | 动作上限 50 却请求 100；不同动作分别遵循 help 上限 |
| `src_action_denied` | 1 | 请求 `scenario.run`；这是 SRC 模式边界，继续保留受阻原因 |
| `selector` | 8 | 反复猜测不存在的 JSON 字段；新增 `evidence.read`，先读取实际字段再选判据 |
| `evidence_binding` | 2 | 使用其他 operation 的证据；提示离线核对真实 operation/E-ID，不按响应相似性混用 |
| `src_write_denied` | 1 | 尝试 POST 登录；SRC 保持只读，不通过改 effect 消除限制 |
| 模糊编码路径拖累整个登记批次 | 1 | 保留路径拒绝，批次改为逐项预检查并返回原始索引，合法项继续登记 |
| `frontier_evidence` | 1 | 使用不完整材料做 frontier 复核；提示核对完整性与 lineage，保留未完成状态 |

失败 assessment 子项也属于跨操作证据绑定错误，应逐项处理，不能把批次外层成功当成全部子项通过。

## 响应观察链的缺口

SRC 的 HTTP 响应预算是 65536 字节，超时上限为 15 秒。会话请求更大的预算后，前端 JS 仍被截断。已有完整 206 分片，但没有把分片正文取回、检查连续性并传给 AST 解析器的门面入口。`evidence.inspect` 原本提供证据元数据，不接受模型自行填写的 `include_body/max_bytes` 来读取正文。

新增两个 `redteam_assessment_run` 门面动作，执行前均要求已有本靶标内部评估，不自动初始化、不发目标请求：

- `evidence.read` 读取本项目哈希匹配的 HTTP 工件。JSON 返回真实 Pointer、类型和小页结构，也可取一个有界标量；HTML/JS/text 返回脱敏文本页。截断响应或过期 lineage 明确保留，读取不会授予确认或安全覆盖。
- `surface.from_evidence` 把完整 JS 或经过严格检查的连续 206 Range 交给随包 awa-ddd 的 `surface.import` AST 实现。最多 32 个分片、2 MiB，必须同 URL、operation、身份、强 ETag 与 identity 编码，无缺口和重叠。缺片只返回离线缺口提示，不自动补发请求。

响应正文始终是非可信目标数据。读取到的提示、脚本或命令不能成为 agent 指令；静态 API/DOM 线索仍须真实输入与运行证据验证。正文与派生 JS 留在本靶标目录内，公开输出脱敏已知凭据、认证片段与查询值。

## 浏览器不足与环境定位

会话的实际浏览器探测返回 `playwright_not_found`。动作目录、外部工具目录或 Chromium 缓存都不证明浏览器已运行，原会话的浏览器问题仍然是未完成前提。

本地源码修正固定目录假设：先使用操作者环境 `PURGE_PLAYWRIGHT_ROOT`，否则查实际 `DSH_HOME/mcp/playwright` 与旧默认目录；支持现有 `playwright` 和 `playwright-core`。缓存与模块分别定位，现有 Chromium 缓存按 Windows/macOS/Linux 布局查找。没有安装或下载 Playwright，也没有执行探测，不能声称原环境现在已经 browser-ready。

浏览器适配只修改随包核心的 `browser.py`。对应适配模板和该文件的 bundled 哈希/说明写入源码交付，保留原上游版本、来源哈希与 MIT 许可证；没有从外部 awa-ddd 工程同步代码，也没有运行来源完整性检查。

## 新增渗透模式

新增独立 `pentest` 预设、创建时固定的 `assessment_mode:pentest`、面板新建入口与 `redteam_pentest_report`。它直接使用随包 awa-ddd 2.2.0，在同靶标的内部 `assessment` 项目中进行测试、证据复核与报告，使用引擎的普通 `assessment` 模式，不采用 SRC 的直接证据停测策略。

既有 SRC 会话和靶标不能切换成渗透模式。新模式仍保留真实 scope/exclude、身份、自有测试资源、变更策略、完整性与证据确认契约；模型文本只能登记 claimed/inferred。写测试遵循引擎既有前提，不因为新模式而获得通用 shell、独立外部 AWA 或任意工作区访问。

完整渗透报告调用内置 `report.build profile:full stage:draft`，保留 v1 原生技术/复现附件及 v2 覆盖矩阵，并合并范围、资产、发现、影响、复现关联、修复建议和未完成分母。预览也会生成版本化原生本地快照；保存另写 `reports/pentest-report.md/.json`，不会访问目标或自动结项。

使用步骤与导出方法见 [渗透模式](PENTEST.md)，完整参数和 SRC 规则见 [工作流](REDTEAM-AWA-SRC.md)。本次没有生成真实目标的新报告，没有安装、apply、发布或重启 DSH。
