# DeepSeek API 接入评估

## 范围

本文基于 `docs/deepseek-api/snapshots/` 中抓取的 DeepSeek 中文 API
文档，评估 DeepSeek 接入当前 Codex OpenAI 接入面的可行性。DeepSeek
当前暂缺搜索工具，因此搜索能力按不可映射处理。

## DeepSeek 文档事实

DeepSeek OpenAI 格式主接口是：

- `POST /chat/completions`
- `GET /models`

可用模型示例：

- `deepseek-v4-flash`
- `deepseek-v4-pro`

聊天补全请求支持的关键字段包括：

- `messages`
- `model`
- `thinking`
- `reasoning_effort`
- `max_tokens`
- `response_format`
- `stream`
- `stream_options.include_usage`
- `tools`
- `tool_choice`
- `temperature`

响应使用 Chat Completions 形状，核心字段包括：

- `choices[].message.content`
- `choices[].message.reasoning_content`
- `choices[].message.tool_calls`
- `choices[].finish_reason`
- `usage.prompt_cache_hit_tokens`
- `usage.prompt_cache_miss_tokens`

来源快照：

- `docs/deepseek-api/snapshots/create_chat_completion.md`
- `docs/deepseek-api/snapshots/list_models.md`

## 能力映射

| Codex 当前能力 | DeepSeek 文档能力 | 接入判断 |
| --- | --- | --- |
| 普通文本生成 | `messages` + assistant `content` | 可适配 |
| 流式文本 | `chat.completion.chunk` + `delta.content` | 可适配 |
| reasoning effort | `reasoning_effort: high/max` | 可部分适配 |
| raw reasoning | `reasoning_content` | 可适配但需保留历史 |
| reasoning summary | 未见等价字段 | 不可直接适配 |
| function tools | `tools` + `tool_calls` | 可适配基础函数工具 |
| strict schema | `strict: true`，beta base URL | 有条件适配 |
| JSON output | `response_format: json_object` | 可适配但不等价 |
| prompt cache key | 无客户端 key，默认缓存 | 不可直接适配 |
| cache usage | hit/miss usage 字段 | 可记录但字段需转换 |
| model list | `data[]` 普通模型列表 | 需转换或静态 catalog |
| web search | 暂缺 | 必须禁用 |
| image generation | 未见等价字段 | 必须禁用 |
| Responses namespace tools | 未见等价字段 | 必须降级或禁用 |
| Responses custom tools | 未见等价字段 | 必须降级或禁用 |
| Responses WebSocket | 未见等价接口 | 必须禁用 |

## 推荐接入方案

推荐新增 Chat Completions wire API（wire API）或 DeepSeek 专用
adapter。它应位于当前 provider/request/stream 边界附近，而不是散落在
turn loop 中。

建议分层如下：

- `model-provider-info`：新增 `WireApi::ChatCompletions` 或
  `WireApi::DeepSeekChat`，允许 provider 显式声明协议。
- `codex-api`：新增 chat completions endpoint client 与 SSE parser。
- `core::client`：在 `ModelClientSession::stream` 中增加 chat 分支。
- `core::client`：复用 `Prompt` 和 `ResponseItem`，但增加请求转换函数。
- `tools`：增加 Responses tools 到 Chat tools 的受限转换函数。
- `model-provider`：为 DeepSeek provider 关闭 web search、image
  generation、namespace hosted tools、WebSocket。
- `models-manager`：优先使用 `model_catalog_json` 或专用 `/models`
  adapter 转换 DeepSeek `data[]`。

## 请求转换

需要把 `Prompt` 转成 DeepSeek `messages[]`：

- `base_instructions.text` 转成第一条 `system` message。
- user `ResponseInputItem::Message` 转成 `role: user`。
- assistant `ResponseItem::Message` 转成 `role: assistant`。
- assistant function call 转成 `role: assistant` + `tool_calls`。
- function output 转成 `role: tool` + `tool_call_id`。
- reasoning item 若与工具调用相关，必须附回对应 assistant message 的
  `reasoning_content`。

不建议把所有 `ResponseItem` 无差别拼入 `messages[]`。Responses 的
`WebSearchCall`、`ImageGenerationCall`、`ToolSearchOutput`、
`ContextCompaction` 等没有 Chat Completions 等价消息。adapter 应该
明确拒绝、忽略或转成受控文本上下文。

## 响应转换

非流式或流式响应都应转换成内部 `ResponseEvent`：

- 首个 chunk 或完整 response 生成 `OutputItemAdded(Message)`。
- `delta.content` 转成 `OutputTextDelta`。
- `message.content` 汇总后生成 `OutputItemDone(Message)`。
- `delta.reasoning_content` 转成 `ReasoningContentDelta`，并在完成时生成
  `OutputItemDone(Reasoning)` 或挂接到内部可保留结构。
- `tool_calls[].function.arguments` 增量转成 `ToolCallInputDelta`。
- 完整 tool call 转成 `OutputItemDone(FunctionCall)`。
- `finish_reason = "tool_calls"` 触发 follow-up。
- `finish_reason = "stop"` 触发 completed。
- `usage` 转成 `TokenUsage`，其中 cache hit/miss 需映射到
  `cached_input_tokens` 或新增 DeepSeek 专用记录。

DeepSeek 流结束为 `data: [DONE]`。当前 Responses parser 依赖
`response.completed`，因此 chat parser 必须自己在最后一个有效 chunk
或 `[DONE]` 时生成 `ResponseEvent::Completed`。

## Reasoning 风险

DeepSeek 思考模式与当前 Responses reasoning 最大差异是历史回传规则。
文档要求：

- 没有工具调用时，后续请求可以不回传 `reasoning_content`。
- 有工具调用时，后续所有用户交互轮次必须完整回传对应
  `reasoning_content`。
- 未正确回传会导致 400。

当前 Codex 会记录 Responses `Reasoning` item，并在 OpenAI Responses
请求中通过 `include = ["reasoning.encrypted_content"]` 获取服务端可用的
reasoning token 表示。DeepSeek 没有这个 encrypted content 机制，adapter
必须显式保存并重放 `reasoning_content`。

接入时需要建立 invariant：

- 每个产生 tool call 的 assistant message 必须保留完整
  `reasoning_content`。
- 后续转换 `messages[]` 时，必须把该字段放回相同 assistant message。
- 历史压缩、恢复、分叉和 tool follow-up 不能丢失该字段。

这是 DeepSeek 接入的最高风险点。

## Tool Calls 风险

DeepSeek 支持 OpenAI Chat Completions function tools。当前 Codex 工具面
超过基础 function tools：

- namespace tools 没有直接等价。
- custom freeform tools 没有直接等价。
- hosted `web_search` 没有 DeepSeek 支持。
- hosted `image_generation` 没有 DeepSeek 支持。
- local shell、apply patch、MCP tools 可在 adapter 侧转换成 function
  tools，但名称、schema 和输出消息必须符合 Chat Completions 形状。

strict 模式是可选增强，不应作为普通 DeepSeek URL 的默认能力。
DeepSeek strict 需要 beta `base_url`，并要求函数 schema 满足更严格
限制。例如 object 所有属性必须 required，且
`additionalProperties: false`。

当前决策是：不新增配置，不动态切换 URL。只有用户显式配置
`base_url = "https://api.deepseek.com/beta"` 时，Chat adapter 才发送
`strict: true`，并把 function schema 规范化为 strict 兼容形态。

## apply_patch 兼容映射

Chat Completions 适配器必须把 `apply_patch` 做成兼容映射。OpenAI
Responses 和 DeepSeek Chat Completions 在 Codex 层的可用工具行为应
保持一致，不能通过关闭 `apply_patch` 规避 provider 差异。

DeepSeek 只暴露 Chat Completions function tools。适配器应把 Codex
内部的 freeform `apply_patch` 工具映射为名为 `apply_patch` 的
function tool，并使用包含 `input` 字段的参数结构承载 patch 文本。
当 DeepSeek 返回 `tool_calls[].function.name = "apply_patch"` 时，
适配器应还原为 Codex 的 patch 工具调用，并把 `input` 字段转换回
原始 patch 文本。

该规则是 provider parity invariant。OpenAI Responses 和 DeepSeek
Chat Completions 的 wire protocol 可以不同，但到达 Codex 工具路由层
时，`apply_patch` 的行为、权限边界和用户可见结果必须一致。

## JSON Output 风险

当前 Codex output schema 走 Responses `text.format`，通常可表达 JSON
Schema 与 strict。DeepSeek JSON Output 只要求：

- `response_format = {"type":"json_object"}`。
- prompt 中必须包含 `json` 字样，并给出输出样例。
- `content` 仍可能为空。

因此二者不等价。若用户配置了 output schema，adapter 可以首版降级为
`json_object`，并把 schema 作为 system/user 指令注入；但不能承诺
DeepSeek 会严格按 schema 校验。

## KV Cache

DeepSeek 上下文硬盘缓存默认开启，用户无需传入类似
`prompt_cache_key` 的字段。当前 Codex 会给 Responses 请求设置
`prompt_cache_key = thread_id`。DeepSeek adapter 应忽略该字段，不要
伪造等价能力。

返回 usage 中的 `prompt_cache_hit_tokens` 和
`prompt_cache_miss_tokens` 可用于 token usage 统计。若不新增字段，可把
hit 计入 `cached_input_tokens`，并保持
`input_tokens = hit + miss`。

## 模型目录策略

DeepSeek `GET /models` 返回普通 OpenAI 风格：

```json
{
  "object": "list",
  "data": [
    {
      "id": "deepseek-v4-flash",
      "object": "model",
      "owned_by": "deepseek"
    }
  ]
}
```

当前 Codex `ModelsClient` 期望 `ModelsResponse { models: Vec<ModelInfo> }`。
因此有两条可行路径：

- 首版使用 `model_catalog_json` 提供 DeepSeek 的静态 `ModelInfo`。
- 后续新增 DeepSeek `/models` adapter，把 `data[].id` 合成完整
  `ModelInfo`，并用本地模板填充工具、reasoning、context window 等
  元数据。

首版更稳，因为 DeepSeek `/models` 只给模型 id 和 owner，不足以构造
完整 Codex 模型能力元数据。

## Profile、Provider 与 Provider ID

`profile + provider` 是多厂商 DeepSeek 接入的正确配置形状。profile
负责选择 active provider，`/model` 只在该 provider 的模型目录内切换
具体模型和 reasoning effort。

自定义 provider 可以用不同 key 表达不同厂商：

```toml
[profiles.deepseek-vendor-a]
model_provider = "deepseek-vendor-a"
model = "deepseek-v4-pro[1m]"

[model_providers.deepseek-vendor-a]
name = "Vendor A"
base_url = "https://vendor.example/v1"
env_key = "VENDOR_DEEPSEEK_API_KEY"
wire_api = "chat_completions"
```

该配置依赖 `deepseek-vendor-a` 这个 provider ID 触发 DeepSeek
runtime。`name` 应是服务厂商展示名，而不是 API 适配行为。

不需要新增 `model_api_provider` 配置键。DeepSeek runtime 可复用
provider ID 命名空间。该方式与 `amazon-bedrock` 通过保留 provider ID
承载特殊 runtime 行为一致。

`wire_api` 只表达协议，不能替代 provider ID 的 runtime 选择。DeepSeek
runtime 还需要收窄工具能力、选择静态 catalog，并应用 DeepSeek
`reasoning_content` 历史规则。

DeepSeek 静态 catalog 默认上下文窗口为 384,000 token。若用户明确
需要 1M 上下文，可把模型配置为 `deepseek-v4-flash[1m]` 或
`deepseek-v4-pro[1m]`。该后缀是 Codex 侧别名，只影响模型元数据；
请求 DeepSeek API 时会移除后缀。
该别名也可用于厂商提供的其他 DeepSeek 模型 ID。用户需要确认
服务端实际支持 1M 上下文；Codex 不把别名当作服务端能力声明。

若配置了顶层 `model_context_window`，它优先于 `[1m]` 后缀和静态
catalog 默认值。例如：

```toml
model_provider = "deepseek-vendor-a"
model = "deepseek-v4-flash[1m]"
model_context_window = 384000
```

上述配置实际使用 384,000 token 窗口。
DeepSeek catalog 的最大窗口为 1,000,000 token，运行态会继续应用
95% 有效窗口比例。因此 `[1m]` 别名对应的运行事件窗口为
950,000 token。

## 不推荐方案

不推荐只添加如下 provider：

```toml
[model_providers.deepseek]
name = "DeepSeek"
base_url = "https://api.deepseek.com"
env_key = "DEEPSEEK_API_KEY"
wire_api = "responses"
```

原因：

- Codex 会请求 `POST https://api.deepseek.com/responses`。
- DeepSeek 文档主接口是 `POST /chat/completions`。
- SSE parser 不识别 `chat.completion.chunk`。
- 工具、reasoning、JSON output、模型目录形状都不匹配。

也不推荐恢复旧 `wire_api = "chat"` 名义而不做严格适配。当前历史和
工具面已经是 Responses 风格，直接复用旧 chat 分支容易遗漏
reasoning_content
和 hosted tool 降级规则。

## 首版验收标准

首版 DeepSeek 接入至少应满足：

- 可以使用 `deepseek-v4-pro` 完成单轮文本回复。
- 可以完成多轮对话，并正确拼接历史。
- 可以完成一个基础 function tool call 和 tool result follow-up。
- 思考模式下 tool call 后，后续请求完整回传 `reasoning_content`。
- 流式文本、流式 reasoning、流式 tool arguments 都能转换为内部事件。
- `web_search`、`image_generation`、namespace hosted tools 被禁用。
- `GET /models` 不阻塞主流程；可用静态 catalog。
- JSON output 降级行为有测试覆盖，并明确不能保证 JSON Schema strict。
- cache hit/miss usage 能进入 token usage 或至少不会造成解析失败。

## 建议测试矩阵

- 单轮非工具文本：验证 `content` 到 `AgentMessage`。
- 多轮普通对话：验证历史 `messages[]` 顺序。
- 流式文本：验证 `delta.content` 到 `OutputTextDelta`。
- 流式 reasoning：验证 `delta.reasoning_content` 到 raw reasoning event。
- function call：验证 `tool_calls` 到 `FunctionCall`。
- tool result follow-up：验证 `role: tool` + `tool_call_id`。
- thinking + tool：验证后续请求保留 `reasoning_content`。
- JSON output：验证 `response_format` 和 prompt 注入。
- missing `[DONE]` 或无 completed chunk：验证错误路径。
- DeepSeek 400：验证 invalid request 能映射到用户可理解错误。

## 结论

DeepSeek API 可接入，但工作性质是协议适配，不是 provider 配置
补充。
首版应明确收窄能力：支持文本、流式、基础 function tools、
reasoning content、JSON object 输出和静态模型 catalog；禁用搜索、
图片生成、
namespace/custom hosted tools 和 WebSocket。strict schema 仅在用户显式
配置官方 beta `base_url` 时启用；动态模型目录和更完整的 usage 统计
仍作为后续增强。
