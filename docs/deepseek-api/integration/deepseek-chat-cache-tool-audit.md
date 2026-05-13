# DeepSeek 多轮、缓存与工具调用审计

## 范围

本文记录 2026-05-13 对 DeepSeek Chat Completions 接入的实现审计。
审计目标是确认以下能力是否符合 DeepSeek 官方建议：

- 多轮对话（multi-round chat）。
- 上下文硬盘缓存（KV cache）。
- 工具调用（tool calls），含思考模式下的 `reasoning_content` 回放。

依据文件：

- `docs/deepseek-api/snapshots/multi_round_chat.md`
- `docs/deepseek-api/snapshots/kv_cache.md`
- `docs/deepseek-api/snapshots/tool_calls.md`
- `docs/deepseek-api/snapshots/thinking_mode.md`
- `docs/deepseek-api/snapshots/create_chat_completion.md`
- `codex-rs/core/src/chat_completions.rs`
- `codex-rs/codex-api/src/sse/chat_completions.rs`
- `codex-rs/core/tests/suite/client.rs`
- `codex-rs/model-provider/src/deepseek/mod.rs`
- `codex-rs/model-provider/src/deepseek/catalog.rs`

## 结论

当前实现整体符合 DeepSeek 官方对多轮对话、KV cache 和基础工具
调用的建议。

已确认的实现状态：

- DeepSeek provider 使用 `wire_api = "chat_completions"`，请求发送到
  `POST /chat/completions`。
- 每次 Chat Completions 请求显式发送 `messages[]`，而不是依赖
  Responses 的 `prompt_cache_key` 或 `previous_response_id`。
- `stream_options.include_usage = true`，可接收流式末尾的 usage 块。
- `prompt_cache_hit_tokens` 映射到 Codex `cached_input_tokens`。
- `FunctionCall` 映射为 assistant `tool_calls`。
- `FunctionCallOutput` 映射为 `role: tool` 和 `tool_call_id`。
- 思考模式工具轮次会在后续请求中回放对应 `reasoning_content`。
- DeepSeek provider 禁用 `web_search`、`image_generation` 和
  namespace tools。
- DeepSeek 模型目录使用静态 catalog，默认模型为
  `deepseek-v4-pro` 和 `deepseek-v4-flash`。

仍需保留的边界：

- DeepSeek 不提供客户端 `prompt_cache_key`，不能伪造等价能力。
- KV cache 命中是服务端尽力而为能力，客户端只能保持稳定前缀。
- strict tool schema 是 beta 能力，只由官方 beta `base_url` 显式启用。
- 历史压缩、截断、恢复、分叉必须保持工具轮次与
  `reasoning_content` 的完整绑定。

## 多轮对话

官方建议是：DeepSeek `/chat/completions` 是无状态接口，客户端每次
请求都必须把此前对话历史拼入 `messages[]`。

当前实现符合该规则。`build_chat_completions_request()` 会从
`Prompt.get_formatted_input()` 构造完整 Chat Completions `messages[]`：

- `base_instructions.text` 转为首条 `system` message。
- user message 转为 `role: user`。
- assistant message 转为 `role: assistant`。
- tool output 转为 `role: tool`。
- compaction 与无 Chat 等价的内部 item 不直接暴露给 DeepSeek。

该策略满足多轮对话要求，也为 DeepSeek KV cache 保持稳定前缀。
实际可用历史仍受 Codex 自身压缩和截断策略约束；压缩后的历史必须
继续保持 Chat Completions 消息合法性。

## KV Cache

官方建议是：DeepSeek 上下文硬盘缓存默认开启，用户无需改代码。
缓存命中取决于后续请求是否完整匹配已落盘的缓存前缀单元。
返回 usage 中包含：

- `prompt_cache_hit_tokens`
- `prompt_cache_miss_tokens`

当前实现符合该规则：

- Chat Completions 路径没有发送 Responses 专用的 `prompt_cache_key`。
- 每次请求继续发送完整 `messages[]`，保持服务端前缀匹配机会。
- 流式请求设置 `stream_options.include_usage = true`。
- SSE parser 将 `prompt_cache_hit_tokens` 映射为
  `TokenUsage.cached_input_tokens`。
- `prompt_tokens` 继续作为 `TokenUsage.input_tokens` 使用。

关键决策：DeepSeek KV cache 只作为服务端能力使用。Codex 不新增
DeepSeek 专用 cache key，也不把 OpenAI Responses 的缓存语义映射到
DeepSeek。

## Tool Calls

官方建议是：工具以 OpenAI Chat Completions function tool 形式暴露。
模型返回 assistant `tool_calls` 后，客户端执行工具，并追加
`role: tool`、`tool_call_id` 和工具输出，然后继续请求。

当前实现符合基础工具调用路径：

- `ToolSpec::Function` 转为 Chat Completions `type: function` tool。
- tool choice 使用 `auto`。
- 流式 `delta.tool_calls` 会聚合 fragmented arguments。
- 完成后生成内部 `ResponseItem::FunctionCall`。
- 工具输出历史回放为 `role: tool`。
- 端到端测试确认第二次请求会回放 assistant `tool_calls` 与
  对应 `role: tool` 消息。

DeepSeek 只支持 function tools。当前实现拒绝或禁用无直接等价的能力：

- namespace tools
- hosted web search
- hosted image generation
- tool search
- 非 `apply_patch` 的 freeform custom tools

`apply_patch` 是 Codex provider parity invariant。DeepSeek 路径把它
桥接为名为 `apply_patch` 的 function tool，参数对象使用 `input`
字段承载原始 patch 文本；返回时再还原为内部 `CustomToolCall`。
普通 DeepSeek `base_url` 下该映射发送 `strict: false`。用户显式配置
`base_url = "https://api.deepseek.com/beta"` 后，该映射发送
`strict: true`。

## 思考模式工具轮次

官方建议是：如果两个 user 消息之间发生过工具调用，该轮产生的
assistant `reasoning_content` 后续必须完整回传，否则 DeepSeek 可能
返回 400。

当前实现已经按用户轮次切分历史，并识别每段 user turn 是否包含
受支持的工具调用：

- 无工具轮次不会把 assistant `reasoning_content` 回填给 DeepSeek。
- 有工具轮次会把 pending reasoning 绑定到后续 assistant tool-call
  message。
- 有工具轮次中的 final assistant message 也会保留对应
  `reasoning_content`。
- user message 会切断上一轮 pending reasoning，避免泄漏到下一轮。

已有测试覆盖：

- `preserves_reasoning_content_for_tool_call_history`
- `drops_reasoning_content_for_non_tool_history`
- `preserves_final_answer_reasoning_for_tool_turn_history`
- `deepseek_provider_replays_reasoning_tool_history`

关键决策：DeepSeek thinking + tool 历史必须以 assistant message 为
单位保留 raw `reasoning_content`。如果未来压缩、截断或恢复逻辑无法
保留完整绑定，应移除整段工具轮次或转为受控摘要，不能发送半缺失
的 tool-call history。

## Strict Schema 边界

DeepSeek strict tool schema 是 beta 能力，官方要求使用 beta
`base_url`，且 schema 必须满足更严格限制，例如 object 所有属性
required，并且 `additionalProperties: false`。

集成决策是不新增配置、不动态切换 API URL。只有当用户显式配置：

```toml
base_url = "https://api.deepseek.com/beta"
```

Chat adapter 才启用 strict tools。普通 `https://api.deepseek.com`
或 `/v1` 不启用 strict；代理域名即使 path 为 `/beta` 也不推断为
DeepSeek beta。

启用 strict tools 时，adapter 会把发送给 DeepSeek 的 function
schema 递归规范化为 strict 兼容形态：每个 object 的所有属性列入
`required`，并设置 `additionalProperties: false`。该规范化只影响
DeepSeek beta Chat Completions 请求，不修改 Codex 内部工具定义。

`apply_patch` 兼容映射使用封闭对象 schema，以便模型稳定输出
`input` 字段。该行为属于 provider parity 的兼容层；是否发送
`strict: true` 仍由用户配置的官方 beta `base_url` 决定。

## 维护不变量

后续修改 DeepSeek 接入时必须保护以下不变量：

- `deepseek` 与 `deepseek-*` provider ID 使用 DeepSeek runtime。
- DeepSeek runtime 使用 `chat_completions` wire API。
- Chat Completions 请求不得包含 `prompt_cache_key`。
- 不新增 strict 配置项，也不自动把普通 URL 改写为 beta URL。
- 只有官方 `https://api.deepseek.com/beta` 启用 strict tools。
- 每次 DeepSeek 请求都发送合法、完整、稳定的 `messages[]` 前缀。
- assistant `tool_calls[].id` 必须与后续 `role: tool.tool_call_id`
  一致。
- 有工具调用的 thinking user turn 必须回放对应
  `reasoning_content`。
- 无工具 thinking turn 的 `reasoning_content` 不应泄漏到后续工具轮次。
- KV cache usage 的 hit tokens 应继续进入 `cached_input_tokens`。
- DeepSeek provider 不暴露 web search、image generation 或 namespace
  hosted tools。
