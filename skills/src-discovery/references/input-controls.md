---
name: assessment-input-controls
description: 根据真实消费点组织正常、攻击、阴性控制，保留完整基线、请求绑定与未实现测试族。
metadata:
  cwe: [CWE-89, CWE-79, CWE-918, CWE-22, CWE-78, CWE-94, CWE-502, CWE-611]
  class: [input-controls, injection, methodology]
  requires: [assessment]
---

# 输入消费点与控制

参数名、反射字符串和报错差异是线索。先确认真实 operation、方法、输入位置与 selector，再判断它是否有对应消费点。`surface.declare_consumer` 使用实际动作 help 的族名；`access_control` 属于授权义务，不是 consumer 的测试族。不能把未实现族塞进 generic 来获得一个看似成功的决策。

完整基线必须属于同一 operation、身份和资源。保留所有非测试字段，使用准确 query 名、JSON Pointer 或路径参数；JSON Pointer 中 `~` 和 `/` 的转义不能靠字段名猜测。认证、Cookie 和传输 framing 由固定请求器处理，不从其他证据复制敏感头。

| 控制 | 作用 | 常见无效替代 |
| --- | --- | --- |
| 正常 | 确认实际功能和稳定结果 | 任意首页 200、与本输入无关的请求 |
| 攻击 | 只改变被测试输入，观察具体安全命题 | 同时换方法、身份和多个业务字段 |
| 阴性 | 排除正常运算、反射、缓存和噪声解释 | 与攻击相同的输入，或不存在的业务对象 |

按当前引擎已实现的 oracle 解释结果。SQL 的有界计数差异不证明访问任意表、数据转储或数据库管理员权限。模板表达式需要明确非计算器消费点及真实正常/阴性预期；表达式求值不等于系统命令执行。HTTP 状态、响应长度和单个引号报错不独立证明注入。

v1 先 `assessment.prepare`，再按实际返回组织控制和判据。v2 先读取配方冻结的控制顺序与绑定，再执行实际 `test.run`。写控制的真实请求数应与变更预算一致，前态、fixture 和读回不能省略。SRC 的只读最小验证和直接证据停止优先。

执行失败保留 run、已有证据、attempt、冷却和未知写入。只有相关身份、完整基线或 fixture 改善后才重新准备；改描述、时间戳、分页或行政处置不构成改善。离线 verify 使用真实互异控制且不发送请求，不覆盖原运行或协调未知写入。
