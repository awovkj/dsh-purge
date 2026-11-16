# 三模式按需工具路由（1.12.0）

`tool.route` 把当前操作、已有材料与有效能力回执转成准确的准备或调用参数。动作不初始化工程、不主动探测、不发目标请求；实际执行继续由当前固定模式、范围、身份、Cookie、fixture和停止状态决定。

## 调用契约

```json
{"action":"tool.route","input":{"purpose":"auto","operation_id":"<实际 O-ID>","evidence_ids":["<实际完整 E-ID>"],"limit":5}}
```

通过当前会话的 `redteam_assessment_run` 调用，engagement使用当前持久绑定。陌生动作先查 `action.help input:{name:"tool.route"}`。已有内置评估是前提；未准备时返回 `ASSESSMENT_ROUTE_CONTEXT`，按当前范围准备真实HTTP上下文。

| 参数 | 约束 |
| --- | --- |
| `purpose` | auto、frontend、browser、request_replay、scanner_results、sql_verification；默认auto |
| `operation_id` | 当前靶标的准确操作；有证据时必须绑定同一操作 |
| `evidence_ids` | 最多32个不同、完整、当前且通过哈希/lineage核验的E-ID；参数名是数组形式 |
| `campaign_id` | SQL控制准备时选择实际冻结活动，不能用另一个活动的任务或证明 |
| `limit` | 1–10，默认5 |

模型不能填写 mode、backend、ready、tools、workspace或project_id。空ID、错误类型、跨操作材料和不相关SQL活动拒绝。路由返回 `items[].next` 与可选 `fallback`；门面还提供同engagement的 `tool_advice[].next_step`。优先复用完整参数，不自行补工具命令、选择器或身份。

## 何时调用什么

| 当前需求 | 优先路径 | 前提与结果边界 |
| --- | --- | --- |
| 已有完整JS | `surface.from_evidence` | 离线AST；不为静态接口启动浏览器 |
| 已有普通完整source map | `surface.from_sourcemap` | 离线引用图与线索；没有运行事实或漏洞确认权限 |
| HTML材料或明确HTML/DOM消费需求 | Playwright `browser.visit` | 必须有当前native probe、具体GET页与实际身份；缺前提返回准备入口 |
| 公开无正文GET按绑定URL重放 | Yak `tool.yakit_replay` | 当前唯一fuzzer、typed TLS、no-follow、禁用调用者fuzztag；不是任意头部的完整原包重放 |
| 认证GET需要重放 | 原生 `http.preflight` 备用路径 | Yak当前profile不支持认证；保留已核实session_id，缺身份先核实，不能丢身份凑适配 |
| 已有本靶标scanner结果 | TscanPlus summary/results/routes | 复用当前backend绑定的非默认namespace；只读不扫描、不运行PoC |
| v1 SQL实际控制 | `assessment.prepare` | 保持v1，读取实际操作/义务的准确契约 |
| v2 SQL实际控制 | 当前 `campaign.next` | 真实SQL上下文、冻结成员与准确活动；多活动不选择“最近活动” |
| 缺执行需求 | surface/evidence离线检查 | 不因安装了工具就安排目标请求 |
| SRC禁用或已停测 | 限制说明、离线检查及提交材料 | 已停测操作不准备新浏览器、重放或SQL请求 |

auto读取已有事实；明确的HTML/DOM消费声明可以触发浏览器准备建议，声明仍不等于实际脚本执行。只有JS/map材料时先离线发现，后续确实需要DOM观察再使用browser。请求重放和SQL验证需求使用对应purpose，不能依靠漏洞关键词猜全部工具。

提供证据时，运行建议绑定唯一实际请求的URL、session及身份代际，不改用该操作的首个管理员会话。混合请求/身份、多会话歧义、匿名Cookie或无法保留的额外业务头保持准备状态；没有证据的认证操作也不随意选第一个会话。公开参数中的URL若被脱敏，next/fallback改为契约准备，返回public_locator_requires_private_binding；不把占位文本或去掉query的默认URL当成可执行参数。当前尚无通用的私有原请求句柄执行入口，这一缺口仍影响复杂页面与原包工作流。

WSL/Kali是操作者固定的执行后端。平台工具定位配置与内置评估settings分别显示；模型不能把路径定位成功当作后端已选定，不能自行换到Windows或WSL。Windows/WSL的Python、Node、浏览器、控制端和SQLite工作区分别核实，目标URL不自动改写。

## 就绪的证据

模块文件存在、浏览器缓存存在、部署摘要正确、MCP握手成功与具体profile可执行分别表达。HTTP-ready不依赖浏览器就绪；native Playwright不因可选宿主MCP名称缺失而假受阻。

native能力回执最多保留30分钟就绪，绑定backend、profile、来源artifact和文件stat；浏览器还绑定Node、模块manifest及实际launch的浏览器文件。后端切换、二进制替换、旧/过期回执、缺TLS或codec-only catalogue都不能保持ready。TscanPlus读取须使用同backend、同namespace及当前schema，不接受借用另一个项目结果。

`skill.index` 内部消费当前真实agent的工具schema及已有native能力回执，不接模型自填可见性，不主动probe。未核实为unknown；明确禁用、未实现或已失败为blocked。准备建议不是执行授权，工具输出仍为未核实来源，需要具体安全控制才可进入当前证明。

captured-cookie会话的HTTP备用路径保留origin/path/Secure/expiry；浏览器无法保留path-scoped Cookie时保持受阻。间接配方执行使用返回的frozen recipe_id，不能以hypothesis_id隐式选择另一身份或请求。

## 本轮真实验收与限制

2026-11-16在现有kali-linux中运行了固定WSL worker：Linux Python运行元数据、真实本地HTTP采集、准确E-ID复用、排除范围零发送、Windows输入文件到WSL的AST路径转换、实际sqlmap版本probe通过。SQLmap没有进行目标SQL检测。该验收使用自有临时工作区与WSL内部loopback服务，不更改正式评估后端或用户设置。

现有 `http://127.0.0.1:8088/mcp` 的TscanPlus实际初始化及tools/list成功，广告36个工具；当前适配的三个只读profile均通过。测试使用随机隔离空namespace，未主动扫描、读取其它项目结果或验证真实目标漏洞；大结果分页、真实结果导入和完整工作流仍待验收。

当前默认环境未找到Playwright模块及默认Yak文件，Kali PATH也未找到Yak。没有安装或下载它们，不能由此断言整机没有自定义安装，也不能宣称实际浏览器或Yak调用通过。本轮浏览器判据与Yak协议/schema回归仍使用受控模拟。

显式复测已有环境：

```powershell
$env:PURGE_TEST_WSL_DISTRIBUTION = 'kali-linux'
$env:PURGE_TEST_TSCANPLUS_URL = 'http://127.0.0.1:8088/mcp'
npm run test:tool-runtime
```

这两个测试不自动安装环境；未提供相应配置时明确skip。它们不作为完整GUI、实际宿主调度或真实目标验收。

## AI工具选择基准

新 `scripts/check-tool-selection.mjs` 提供15个固定可观察场景，覆盖静态JS/map、DOM、浏览器缺件、HTTP/HTTPS Yak、认证备用、SRC禁用/停测、scanner结果、WSL后端失配及v1/v2 SQL准备。

```powershell
node scripts/check-tool-selection.mjs --cases
node scripts/check-tool-selection.mjs --input <实际工具调用trace.json>
```

trace格式为 `schema:purge-tool-selection-trace/v1`、`cases:[{id,calls:[{name,arguments}]}]`。cases入口供维护者检查完整固定事实、预期参数和模式，不能把含expected_calls的整条记录直接喂给待测模型。独立模型benchmark驱动器只提供任务、事实、真实工具schema及相同fixture工具回执，评分答案留在独立评分端，保存所有实际调用；这些fixture ID不能用于真实靶标。转换日志时保留失败、未调用、额外和重复调用，不能只挑成功案例。

评分读取可观察调用，不读取隐藏思维。口头“将使用”不计调用；错误URL/协议/身份/活动/namespace、私填ready/backend、无必要浏览器以及没有新fixture材料的精确重复调用使场景失败。遗漏场景仍保留15项分母，输出场景成功率、所需终端选择召回和准确参数率。

这是固定fixture的严格参数基准，合法等价调用未全部覆盖，不是通用schema验证器。输入SHA256仅保留提供的trace字节，不能认证模型或宿主。`real_model_selection_verified/runtime_execution_verified` 始终false，实际执行成功率、目标请求与tokens保持null。合成trace测试通过不证明真实模型已经“需要时想到并选对”；真实模型基线仍需独立采集。

实现与完整验证见 [升级记录](MODE-UPGRADE-1.12.0.md)，当前剩余缺口见 [升级后复审](THREE-MODE-REVIEW-1.12.0.md)。
