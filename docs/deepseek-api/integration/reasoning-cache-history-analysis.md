# DeepSeek 推理、缓存与历史拼接分析

## 范围

本文分析 DeepSeek Chat Completions 接入当前 Codex OpenAI provider
接入面的差异，重点覆盖：

- 上下文缓存（context cache）。
- 思考模式（thinking mode）与非思考模式（non-thinking mode）。
- 多轮对话历史拼接（history stitching）。
- 是否开启思考模式与是否有工具调用的四种组合。
- `reasoning_content` 在后续请求中的保留、丢弃与重放规则。

来源包括 DeepSeek API 快照和当前本地代码：

- `docs/deepseek-api/snapshots/thinking_mode.md`
- `docs/deepseek-api/snapshots/multi_round_chat.md`
- `docs/deepseek-api/snapshots/tool_calls.md`
- `docs/deepseek-api/snapshots/kv_cache.md`
- `docs/deepseek-api/snapshots/create_chat_completion.md`
- `codex-rs/core/src/client.rs`
- `codex-rs/core/src/chat_completions.rs`
- `codex-rs/codex-api/src/sse/chat_completions.rs`
- `codex-rs/protocol/src/models.rs`
- `codex-rs/core/src/session/turn.rs`
- `codex-rs/core/src/context_manager/history.rs`

## DeepSeek 文档结论

DeepSeek `/chat/completions` 是无状态接口。每次请求必须由客户端把
此前所有对话历史拼成 `messages[]` 后发送。

思考模式默认开启。请求可通过：

```json
{"thinking": {"type": "enabled"}}
```

或：

```json
{"thinking": {"type": "disabled"}}
```

控制思考模式。思考强度通过 `reasoning_effort` 控制，文档只声明
`high` 与 `max`。兼容映射为：

- `low`、`medium` 映射为 `high`。
- `xhigh` 映射为 `max`。

思考模式下，模型返回的推理内容位于 assistant message 的
`reasoning_content` 字段，与 `content` 同级。

DeepSeek 对 `reasoning_content` 的上下文规则是接入关键：

- 两个 `user` 消息之间，如果模型没有工具调用，中间 assistant 的
  `reasoning_content` 后续可不回传。即使回传，也会被 API 忽略。
- 两个 `user` 消息之间，如果模型进行了工具调用，中间 assistant 的
  `reasoning_content` 后续必须完整回传。否则 API 可能返回 400。

这里的“进行了工具调用”是用户交互轮次（user turn）级别的
性质。
DeepSeek 示例会把该轮中每个 assistant message 原样 append 到
`messages[]`，包括带 `tool_calls` 的 assistant message，也包括工具
结果后的最终 assistant message。

## 当前 OpenAI Responses 机制

当前 OpenAI 主链路使用 Responses API。Codex 把会话历史表示为线性的
`ResponseItem` 列表，然后构造 `ResponsesApiRequest`。

Responses 请求中的关键字段包括：

- `instructions`：来自 `Prompt.base_instructions.text`。
- `input`：来自 `Prompt.get_formatted_input()`。
- `tools`：来自 `create_tools_json_for_responses_api()`。
- `reasoning`：模型支持 reasoning summaries 时设置。
- `include`：有 `reasoning` 时包含 `reasoning.encrypted_content`。
- `prompt_cache_key`：当前固定为 thread id。

OpenAI 的 reasoning 历史重放依赖 `encrypted_content`。客户端通过
`include = ["reasoning.encrypted_content"]` 要求服务端返回可在后续
请求中使用的加密推理表示。客户端不需要理解 raw chain-of-thought
与 tool call 的用户轮次级绑定关系。

OpenAI 的缓存语义也不同。Codex 会在 Responses 请求上设置
`prompt_cache_key = thread_id`。Responses WebSocket 路径还可在同一
连接上通过 `previous_response_id` 与增量 `input` 续接此前响应。

这些能力不是 DeepSeek Chat Completions 的等价能力。

## DeepSeek Chat Adapter 现状

当前 Chat Completions adapter 将 Codex 历史转换成 DeepSeek
`messages[]`：

- `base_instructions.text` 转为 `system` message。
- user message 转为 `role: user`。
- assistant message 转为 `role: assistant` + `content`。
- `FunctionCall` 转为 assistant `tool_calls`。
- `FunctionCallOutput` 转为 `role: tool`。
- freeform `apply_patch` 映射为名为 `apply_patch` 的 function tool。

流式 parser 将 DeepSeek SSE 转换成内部 `ResponseEvent`：

- `delta.reasoning_content` 转为 `ReasoningContentDelta`。
- 累积后的 reasoning 转为 `ResponseItem::Reasoning`。
- `delta.content` 转为 `OutputTextDelta` 与 assistant message。
- `delta.tool_calls` 转为 `FunctionCall` 或 `CustomToolCall`。
- usage 的 `prompt_cache_hit_tokens` 映射到 `cached_input_tokens`。

当前 adapter 把线性历史按 user message 切分为用户轮次，并判断每个
segment 是否包含受支持的 tool call。该实现已覆盖 DeepSeek 的
用户轮次级规则：

- 无工具轮次的 reasoning 不会回填到 assistant final message。
- 有工具轮次中，tool-call assistant message 会带回对应
  `reasoning_content`。
- 有工具轮次中，最终 assistant message 也会带回对应
  `reasoning_content`。
- user message 会切断上一轮 pending reasoning，避免泄漏到下一轮。

## 四种历史拼接场景

### 非思考模式且无工具调用

请求应设置：

```json
{"thinking": {"type": "disabled"}}
```

历史拼接只需要普通消息：

- `system`
- `user`
- `assistant.content`
- 下一轮 `user`

不应出现 `reasoning_content`。DeepSeek 缓存命中只依赖请求前缀是否
完整复用，不依赖客户端传入 cache key。

Codex 对应的 OpenAI Responses 情况是没有 `reasoning` 字段，也不会
请求 `reasoning.encrypted_content`。

### 非思考模式且有工具调用

请求仍应设置：

```json
{"thinking": {"type": "disabled"}}
```

历史拼接需要 Chat Completions 工具形状：

- `user`
- `assistant.tool_calls`
- `tool`
- `assistant.content`
- 下一轮 `user`

不需要 `reasoning_content`。工具调用的关键约束是 `tool_call_id`
必须与 assistant `tool_calls[].id` 完整对应。

OpenAI Responses 中，这一形态对应：

- `FunctionCall` 或 `CustomToolCall`
- `FunctionCallOutput` 或 `CustomToolCallOutput`

DeepSeek adapter 必须把这些 item 转为 Chat Completions assistant
`tool_calls` 和 `role: tool` 消息。`apply_patch` 不能关闭，必须通过
function tool 兼容映射保持 Codex 层工具行为一致。

### 思考模式且无工具调用

请求应设置：

```json
{"thinking": {"type": "enabled"}}
```

模型会返回 `reasoning_content` 与最终 `content`。后续请求只需要把
assistant `content` 放回历史。`reasoning_content` 可丢弃；即使发送
也会被 DeepSeek 忽略。

Codex 内部可以继续把 streaming raw reasoning 显示给用户界面，但在
构造 DeepSeek 下一轮 `messages[]` 时，不能让该 reasoning 泄漏到
后续无关 assistant tool-call message。

当前 adapter 对无工具轮次的 assistant final message 不回填
`reasoning_content`，这符合 DeepSeek 要求。按 user message 切分
segment 后，上一轮 pending reasoning 不会泄漏到下一轮工具调用。

### 思考模式且有工具调用

请求应设置：

```json
{"thinking": {"type": "enabled"}}
```

一轮用户交互中可能出现多个模型子请求：

- assistant 返回 `reasoning_content` 与 `tool_calls`。
- 客户端执行工具并追加 `role: tool`。
- assistant 可能再次返回 `reasoning_content` 与 `tool_calls`。
- 最后 assistant 返回 `reasoning_content` 与最终 `content`。

DeepSeek 文档要求该用户轮次产生的 `reasoning_content` 在后续所有
用户交互轮次中完整回传。安全规则应是：

- 每个 assistant tool-call message 必须带回自己的
  `reasoning_content`。
- 同一用户轮次发生过工具调用时，最终 assistant content message
  也应带回自己的 `reasoning_content`。
- 后续所有请求，包括 tool follow-up 和下一轮用户请求，都必须保留
  这些 assistant message 的 `reasoning_content`。

OpenAI Responses 不需要客户端实现这条规则。OpenAI 路径通过
`Reasoning.encrypted_content` 和 Responses item 历史让服务端恢复
推理上下文。

DeepSeek 路径必须在 Chat adapter 层显式维护这条关联。

## 缓存机制差异

OpenAI Responses：

- Codex 发送 `prompt_cache_key = thread_id`。
- Responses HTTP 每次仍发送完整 `input`。
- Responses WebSocket 可复用连接，并在可证明增量时发送
  `previous_response_id` 与新增 `input`。
- `X-Reasoning-Included` 可影响 Codex 的 token usage 估算。

DeepSeek Chat Completions：

- 文档未提供客户端 `prompt_cache_key`。
- 上下文硬盘缓存默认开启。
- 命中规则基于请求前缀是否完整匹配已落盘的缓存前缀单元。
- usage 返回 `prompt_cache_hit_tokens` 和
  `prompt_cache_miss_tokens`。

接入策略：

- Chat adapter 不应伪造 `prompt_cache_key` 等价能力。
- 每次 DeepSeek 请求应显式发送所需 `messages[]`。
- 应保持稳定、完整的历史前缀，以便服务端 KV cache 命中。
- token usage 可把 `prompt_cache_hit_tokens` 映射为
  `cached_input_tokens`。

## 当前关键风险

### 非思考模式开关

DeepSeek 的非思考模式需要 `thinking.type = "disabled"`。

当前 adapter 的 `chat_thinking()` 在模型支持 reasoning summaries 时
总是发送 `thinking.type = "enabled"`。DeepSeek 静态 catalog 又把
默认 reasoning level 设为 `high`，因此默认行为是思考模式。

如果 Codex 配置显式选择无 reasoning，adapter 需要有明确规则把该
意图映射为 `thinking.type = "disabled"`，否则“非思考模式”不会可靠
生效。

### reasoning_content 关联范围

当前 adapter 已按 user message 切分历史，并先识别两个 user message
之间是否发生工具调用，再决定哪些 assistant message 携带
`reasoning_content`。

维护规则：

- 将历史按 `user` message 切分为用户轮次。
- 对每个用户轮次判断是否包含 tool call。
- tool call assistant message 总是回填其前置 reasoning。
- 有工具调用的用户轮次中，assistant final message 也回填其前置
  reasoning。
- 无工具调用的用户轮次中，assistant final message 丢弃 reasoning。
- 每个 reasoning 只绑定到同轮下一个 assistant item，不能跨轮泄漏。

### 持久化与恢复

`ResponseItem::Reasoning.content` 中的 `ReasoningText` 会被 serde
序列化保留，可作为 DeepSeek 后续 Chat 请求的 raw
`reasoning_content` 来源。

DeepSeek 的 `reasoning_content` 是后续 Chat 请求必须显式回传的原文。
因此恢复、分叉或 rollout 重放时必须继续保留该字段与对应 assistant
message 的绑定。若未来出于隐私或压缩策略丢弃 raw reasoning，则不能
保留缺失 reasoning 的工具轮次。

### 压缩与截断

当前 history normalization 会保证 tool call 与 tool output 成对，并会
截断工具输出。但 DeepSeek 额外要求 reasoning 与发生工具调用的
assistant messages 成对保留。

如果 compaction、rollback、fork 或 token 截断保留了 tool call，却
移除了对应 `reasoning_content`，DeepSeek 后续请求可能 400。

需要新增 invariant：

- DeepSeek thinking + tool 历史不能只保留 tool call。
- 若无法保留完整 reasoning，则必须移除整段 tool 轮次或转为
  安全摘要。
- 任何发送给 DeepSeek 的 `messages[]` 都不得包含半缺失的 tool
  reasoning 历史。

## 建议测试矩阵

请求构造测试：

- 非思考无工具：发送 `thinking.disabled`，无 `reasoning_content`。
- 非思考有工具：发送 `thinking.disabled`，tool history 正确配对。
- 思考无工具：历史中有 `Reasoning`，下一轮 message 不带
  `reasoning_content`。
- 思考有工具：tool-call assistant 与 final assistant 都带对应
  `reasoning_content`。
- 无工具 reasoning 后接下一轮非思考 tool call：不能携带旧
  `reasoning_content`。

流式解析测试：

- `delta.reasoning_content` 先于 `delta.content`。
- `delta.reasoning_content` 先于 `delta.tool_calls`。
- 多个 tool call chunk 聚合后仍保持 reasoning 绑定。
- `prompt_cache_hit_tokens` 映射为 `cached_input_tokens`。

恢复与压缩测试：

- DeepSeek thinking + tool 历史写入 rollout 后恢复不丢
  `reasoning_content`，或明确拒绝发送不完整历史。
- compaction 后不存在缺 reasoning 的 DeepSeek tool-call history。
- fork thread 后的首个 DeepSeek 请求保持合法 `messages[]`。

## 结论

DeepSeek 与 OpenAI 在 Codex 层应呈现一致的 provider 行为，但二者的
wire protocol 和 reasoning 历史语义不同。OpenAI Responses 依赖
`encrypted_content`、`prompt_cache_key` 和可选 `previous_response_id`。
DeepSeek Chat Completions 依赖客户端完整重放 `messages[]`，并在思考
模式工具轮次中要求完整回传 raw `reasoning_content`。

因此 DeepSeek adapter 的核心工作不是简单字段转换，而是建立
历史重放不变量：工具行为保持一致，缓存不伪造等价能力，
thinking 开关可控，
并且所有 DeepSeek thinking + tool 历史在请求、恢复、压缩和分叉中都
保持 `reasoning_content` 与 assistant message 的完整绑定。
