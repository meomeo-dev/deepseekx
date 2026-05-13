# DeepSeek JSON Output 严格修复方案

## 范围

本文记录 DeepSeek Chat Completions 下结构化最终输出
（structured final output）的适配方案。

目标链路是 Codex 的 `final_output_json_schema`：

- CLI：`codex exec --output-schema FILE`。
- App Server v2：`turn/start.output_schema`。
- Core turn：`final_output_json_schema` 进入 `Prompt.output_schema`。
- OpenAI Responses：`text.format = json_schema`，带 `strict` 和 schema。
- DeepSeek Chat Completions：降级为 `response_format: json_object`。

本文只讨论最终 assistant 输出的 JSON strict 语义，不讨论 function
tool strict schema。tool strict 的 DeepSeek beta 规则另见
`deepseek-chat-cache-tool-audit.md`。

## 官方能力边界

DeepSeek JSON Output 官方要求：

- 请求设置 `response_format = {"type":"json_object"}`。
- system 或 user prompt 中必须包含 `json` 字样。
- prompt 需要给出期望的 JSON 格式样例。
- `max_tokens` 需要足够，避免 JSON 被截断。
- JSON Output 仍可能返回空 `content`。

该能力只保证模型生成合法 JSON 字符串的概率和约束，不等价于
OpenAI Responses 的 provider-side JSON Schema strict。

因此，DeepSeek adapter 不能声明原生支持
`final_output_json_schema` strict。若界面或上层 API 要求 strict，
DeepSeek 路径必须由客户端建立校验门（validation gate）。

## 产品语义

DeepSeek 的 strict 语义定义为客户端校验严格模式
（client-validated strict）：

- DeepSeek 负责 JSON mode 生成。
- Codex 负责 JSON parse 与 JSON Schema 校验。
- 只有校验通过的 JSON 可以进入最终输出事件。
- 校验失败不能把坏 JSON 返回给 UI、App Server 或 CLI。
- 修复失败必须返回明确错误，而不是返回不符合 schema 的 JSON。

该语义不同于 OpenAI provider strict：

- OpenAI Responses strict 是 provider-side strict。
- DeepSeek strict 是 JSON mode 加本地校验和修复。

当 `Prompt.output_schema_strict` 为 `false` 时，DeepSeek 仍可使用
JSON mode 和 prompt 注入，但不启用本地 schema repair gate。
这与 OpenAI Responses 中 `strict: false` 的语义保持一致。

对上层使用者而言，核心可见承诺是：

- 成功时一定返回 schema-valid JSON。
- 失败时返回结构化错误。
- 不返回 schema-invalid JSON。

## 方案概述

采用虚拟文件 patch 修复（virtual file patch repair）：

1. 首轮 DeepSeek 请求使用 `response_format: {"type":"json_object"}`。
2. adapter 在 prompt 中注入 JSON 输出要求、schema 和样例。
3. 收到完整 assistant content 后，先缓冲，不立即下发最终输出。
4. 将 content 作为内存虚拟文件 `response.json` 的当前内容。
5. 本地执行 JSON parse。
6. 本地执行 JSON Schema 校验。
7. 若通过，释放最终 JSON。
8. 若失败，启动有限次数的 repair turn。
9. repair turn 要求模型只产出 patch，修改虚拟 `response.json`。
10. 程序把 patch 应用到内存字符串后重新校验。
11. 通过则释放最终 JSON，超过次数则失败。

严格性来自本地校验门，而不是模型自觉遵守 prompt。
patch 只用于降低修复面，使模型修改局部错误。
它不要求模型重新生成整段 JSON。

## Patch 能力复用边界

现有 `apply_patch` 工具分为两类能力：

- patch grammar、parser、streaming parser、diff 形状。
- 真实文件写入、审批、sandbox、hook 和 UI patch 事件。

DeepSeek JSON repair 应复用第一类，不应复用第二类。

不应调用普通 `ApplyPatchHandler` 或 `ApplyPatchRuntime`，原因是：

- repair 对象是内存虚拟文件，不是工作区文件。
- 不应触发真实文件审批。
- 不应修改用户磁盘。
- 不应生成用户可见的工作区 patch 事件。
- 不应污染 turn diff tracker。

建议新增内部工具或内部修复协议：

- 名称：`apply_json_output_patch`。
- 输入：patch 文本。
- 允许路径：仅 `response.json`。
- 执行位置：内存 JSON repair engine。
- 输出：校验结果或下一轮错误摘要。

如果复用 Chat Completions function tool 形状，可使用：

```json
{
  "name": "apply_json_output_patch",
  "parameters": {
    "type": "object",
    "additionalProperties": false,
    "properties": {
      "input": {
        "type": "string",
        "description": "Patch for the virtual response.json file."
      }
    },
    "required": ["input"]
  }
}
```

该工具不应进入普通 Codex tool router。它属于 DeepSeek JSON Output
adapter 的内部修复循环。

## 修复循环

每次 repair request 应包含：

- 当前 `response.json` 内容。
- JSON parse error 或 schema validation errors。
- 原始 JSON Schema。
- patch 语法要求。
- 只允许修改 `response.json` 的约束。
- 禁止输出解释性文字。

推荐最大修复次数为 2 到 3 次。超过次数后返回错误。

repair request 不应要求模型重新回答用户问题。它只修复已有 JSON
文档。这样可以减少模型二次推理漂移，也能保护最终答案语义。

## Prompt 注入

首轮 JSON mode prompt 必须满足 DeepSeek 官方要求：

- 明确包含 `json` 字样。
- 要求最终输出为 JSON object。
- 给出 schema 和最小格式样例。
- 提醒不要输出 Markdown、解释或代码块。

示例注入片段：

```text
Your final response must be a JSON object. Do not wrap it in Markdown.
The JSON object must satisfy this JSON Schema:
<schema>

Example JSON output:
{}
```

样例可以由 schema 生成最小 object。
若 schema 太复杂，样例可以退化为 `{}`，但仍必须保留完整 schema。

## 校验规则

本地校验应至少包含：

- `content` 非空。
- `content` 是合法 JSON。
- JSON 顶层类型符合 schema。
- JSON Schema validation 通过。
- 成功输出应序列化为规范 JSON 字符串，避免携带 Markdown 包裹。

实现使用维护中的 `jsonschema` crate 作为运行时 JSON Schema validator。
依赖以 `default-features = false` 接入，避免默认 HTTP/file `$ref`
解析面。不能用字符串搜索、手写关键字分支或局部规则模拟 schema
校验。

## 流式输出边界

DeepSeek JSON strict repair 与普通 streaming final text 存在冲突。

当 `Prompt.output_schema` 存在且 provider 为 DeepSeek 时：

- assistant content delta 可以内部缓冲。
- 不应提前向 UI 发出 final assistant text delta。
- 只有校验成功后，才发送最终完整 JSON。
- 校验失败应发送错误事件或转为现有模型错误路径。

这样能避免 UI 先看到无效 JSON，后续又被 repair 结果覆盖。

## 与工具调用的关系

JSON Output repair 只处理最终 assistant content。

它不替代普通 tool calls，也不改变用户可见工具执行流程。
如果同一 turn 同时有普通工具调用和最终 JSON 输出：

- 工具调用仍按现有 DeepSeek Chat Completions tool-call 规则执行。
- 最终 assistant content 在工具流程结束后进入 JSON repair gate。
- repair 内部工具不得暴露给普通工具路由和用户审批系统。

## 错误语义

修复失败时返回明确错误，建议包含：

- `json_output_validation_failed` 错误类别。
- parse 或 schema 校验摘要。
- repair 尝试次数。
- provider 为 DeepSeek。

错误中不应包含密钥、完整 prompt、完整内部历史或私有路径。
是否包含最终坏 JSON 片段应谨慎处理，可只保留短摘要。

## 维护不变量

后续实现必须保护以下不变量：

- DeepSeek JSON Output 不能宣称 provider-side schema strict。
- `response_format: json_object` 只在有 `Prompt.output_schema` 时启用。
- DeepSeek JSON mode prompt 必须包含 `json` 和格式样例。
- schema-invalid JSON 不能作为最终 assistant message 释放。
- 本地 schema repair gate 只在 `Prompt.output_schema_strict = true`
  时启用。
- 若同一采样轮次返回普通工具调用，不进入最终 JSON repair gate，
  而是保留工具调用事件并继续原有 follow-up 流程。
- JSON Schema 校验必须由维护中的通用 validator 完成，不能自造
  schema validator。
- repair patch 只能修改内存虚拟文件 `response.json`。
- repair 不得写入工作区文件。
- repair 不得调用普通 `apply_patch` runtime。
- repair 不得触发真实文件审批、sandbox 或 hook。
- repair 失败必须返回错误，不返回坏 JSON。
- 文档和测试应明确 DeepSeek 是 client-validated strict。

## 建议测试

实现该方案时应至少覆盖：

- DeepSeek output schema 请求包含 `response_format: json_object`。
- DeepSeek output schema prompt 包含 `json`、schema 和样例。
- 首轮返回合法且 schema-valid JSON 时直接成功。
- 首轮返回合法但 schema-invalid JSON 时进入 patch repair。
- patch 修复后 schema-valid JSON 被释放。
- patch 仍失败时返回错误，不释放坏 JSON。
- repair patch 试图修改非 `response.json` 时被拒绝。
- 非 DeepSeek Chat Completions provider 行为不变。
- OpenAI Responses 仍使用 `text.format = json_schema`。
