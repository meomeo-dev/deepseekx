# 当前 OpenAI 接口接入面分析

## 范围

本文分析当前仓库中模型服务的 OpenAI 接入面。重点覆盖 provider
配置、
请求构造、流式响应解析、工具规格、模型目录和能力开关。
结论基于本地源码，不包含对 DeepSeek 的代码改造。

## 总体判断

当前主链路是 OpenAI Responses API（Responses API），而不是 Chat
Completions API。`WireApi` 只有 `Responses` 一个有效枚举值；
配置中的 `wire_api = "chat"` 会在反序列化阶段被拒绝。

这意味着把某个 provider 的 `base_url` 指向兼容
`/chat/completions` 的服务，并不能让 Codex 主推理链路工作。当前
请求会发送到 `POST /responses`，流解析也只识别 Responses 事件名。

## Provider 配置边界

`ModelProviderInfo` 是 provider 的序列化配置边界。它支持：

- `base_url`：provider 的基础 URL。
- `env_key` 与 `experimental_bearer_token`：鉴权来源。
- `auth`：命令式 bearer token 来源。
- `http_headers` 与 `env_http_headers`：额外请求头。
- `query_params`：追加到基础 URL 的查询参数。
- `request_max_retries` 与 `stream_*`：请求重试和流式超时控制。
- `supports_websockets`：是否允许 Responses WebSocket transport。
- `requires_openai_auth`：是否走 OpenAI/ChatGPT 登录体验。

代码位置：

- `codex-rs/model-provider-info/src/lib.rs:48`
- `codex-rs/model-provider-info/src/lib.rs:80`
- `codex-rs/model-provider-info/src/lib.rs:326`

Provider 运行时抽象是 `ModelProvider`。默认实现
`ConfiguredModelProvider` 只把 `ModelProviderInfo` 转成 API client 配置；
它不做协议转换。默认 provider capabilities 全部开启：
`namespace_tools`、`image_generation`、`web_search`。

代码位置：

- `codex-rs/model-provider/src/provider.rs:26`
- `codex-rs/model-provider/src/provider.rs:79`
- `codex-rs/model-provider/src/provider.rs:227`

因此第三方 provider 若不支持某类 hosted tool，需要有 provider 专用
能力实现或配置化关闭能力，否则上层仍可能暴露不兼容工具。

## 请求构造

核心请求结构是 `ResponsesApiRequest`，字段包括：

- `model`
- `instructions`
- `input`
- `tools`
- `tool_choice`
- `parallel_tool_calls`
- `reasoning`
- `store`
- `stream`
- `include`
- `service_tier`
- `prompt_cache_key`
- `text`
- `client_metadata`

代码位置：

- `codex-rs/codex-api/src/common.rs:169`
- `codex-rs/core/src/client.rs:710`

`ModelClient::build_responses_request` 从 `Prompt` 与 `ModelInfo` 生成
Responses 请求。当前固定行为包括：

- `tool_choice` 固定为 `"auto"`。
- `stream` 固定为 `true`。
- 只在模型支持 reasoning summaries 时生成 `reasoning`。
- reasoning 开启时加入 `include = ["reasoning.encrypted_content"]`。
- `prompt_cache_key` 固定使用 thread id。
- output schema 走 Responses API 的 `text.format`。

代码位置：

- `codex-rs/core/src/client.rs:691`
- `codex-rs/core/src/client.rs:721`
- `codex-rs/core/src/client.rs:739`
- `codex-rs/core/src/client.rs:747`

HTTP transport 发送到 `responses` path，并设置
`Accept: text/event-stream`：

- `codex-rs/codex-api/src/endpoint/responses.rs:70`
- `codex-rs/codex-api/src/endpoint/responses.rs:102`
- `codex-rs/codex-api/src/endpoint/responses.rs:129`

WebSocket transport 也使用 Responses 协议。`ModelClientSession::stream`
按 `WireApi::Responses` 分支调用 WebSocket 或 HTTP Responses。当前没有
Chat Completions 分支。

代码位置：

- `codex-rs/core/src/client.rs:1195`
- `codex-rs/core/src/client.rs:1558`
- `codex-rs/core/src/client.rs:1575`

## 流式响应解析

`codex-api` 把 provider SSE 转成内部 `ResponseEvent`。当前事件名均为
Responses API 事件，例如：

- `response.created`
- `response.output_item.added`
- `response.output_item.done`
- `response.output_text.delta`
- `response.custom_tool_call_input.delta`
- `response.reasoning_summary_text.delta`
- `response.reasoning_text.delta`
- `response.completed`
- `response.failed`
- `response.incomplete`

代码位置：

- `codex-rs/codex-api/src/common.rs:72`
- `codex-rs/codex-api/src/sse/responses.rs:299`
- `codex-rs/codex-api/src/sse/responses.rs:392`

内部 turn loop 只消费这些 `ResponseEvent`，再映射成 UI 和会话历史
事件。
例如文本增量来自 `OutputTextDelta`，工具参数增量来自
`ToolCallInputDelta`，reasoning 内容来自 `ReasoningContentDelta` 或
`ReasoningSummaryDelta`。

代码位置：

- `codex-rs/core/src/session/turn.rs:1987`
- `codex-rs/core/src/session/turn.rs:2140`
- `codex-rs/core/src/session/turn.rs:2185`
- `codex-rs/core/src/session/turn.rs:2210`

## 会话历史形状

内部会话历史使用 Responses 风格的 `ResponseItem` 与
`ResponseInputItem`。其中包含：

- user/assistant message。
- reasoning item，含 summary、content、encrypted content。
- function call 与 function call output。
- custom tool call 与 custom tool call output。
- tool search output。
- web search call。
- image generation call。

代码位置：

- `codex-rs/protocol/src/models.rs:659`
- `codex-rs/protocol/src/models.rs:741`

该形状和 Chat Completions 的 `messages[]` 不等价。Chat Completions
需要把历史压平成 `role/content/tool_calls/tool_call_id` 消息列表；当前
Responses 历史还包含 namespace、custom、tool search、web search、
image generation、reasoning encrypted content 等 Responses 专用项。

## 工具接入面

工具规格由 `ToolSpec` 直接序列化为 Responses API tools。支持类型
包括：

- `function`
- `namespace`
- `tool_search`
- `local_shell`
- `image_generation`
- `web_search`
- `custom`

代码位置：

- `codex-rs/tools/src/tool_spec.rs:13`
- `codex-rs/tools/src/tool_spec.rs:97`

MCP 和动态工具先转成 Responses 风格 function 或 namespace。上层
`ToolsConfig` 会按 provider capabilities 关闭部分能力，但默认 provider
capabilities 是全开启。

代码位置：

- `codex-rs/tools/src/responses_api.rs:43`
- `codex-rs/tools/src/responses_api.rs:122`
- `codex-rs/core/src/session/turn_context.rs:196`
- `codex-rs/tools/src/tool_config.rs:275`

## 模型目录

默认模型管理器是 OpenAI-compatible `/models` 客户端。但响应体不是
普通 OpenAI `/models` 形状。当前 `ModelsClient` 期望服务端返回
`ModelsResponse { models: Vec<ModelInfo> }`，并且请求会追加
`client_version` query parameter。

代码位置：

- `codex-rs/codex-api/src/endpoint/models.rs:31`
- `codex-rs/codex-api/src/endpoint/models.rs:40`
- `codex-rs/protocol/src/openai_models.rs:436`

若配置提供 `model_catalog_json`，模型管理器可使用静态
`ModelsResponse`，绕过 provider `/models` 返回形状差异。

代码位置：

- `codex-rs/models-manager/src/config.rs:11`
- `codex-rs/model-provider/src/provider.rs:227`

## 与 DeepSeek 的直接不兼容点

当前接入面和 DeepSeek 文档中的 `/chat/completions` 存在这些直接差异：

- endpoint：当前发送 `POST /responses`，DeepSeek 文档是
  `POST /chat/completions`。
- request body：当前是 Responses 的 `instructions/input/tools/text`；
  DeepSeek 是 Chat Completions 的 `messages/tools/response_format`。
- streaming：当前解析 `response.*` SSE 事件；DeepSeek 文档展示
  `chat.completion.chunk` 数据块和 `data: [DONE]`。
- reasoning：当前使用 Responses `reasoning` 与 reasoning item；
  DeepSeek 使用 `thinking`、`reasoning_effort` 和
  `reasoning_content`。
- tool calls：当前支持 Responses 的 namespace、custom、hosted tools；
  DeepSeek 文档只描述 Chat Completions function tool calls。
- model list：当前期望 `{"models":[ModelInfo...]}`；DeepSeek 返回
  `{"object":"list","data":[{"id":...}]}`。
- search：当前可能暴露 `web_search`；用户已指出 DeepSeek 暂缺搜索
  工具。

## 初步结论

DeepSeek 不能通过单纯新增 provider 配置接入当前主推理链路。可复用
部分主要是鉴权、base URL、HTTP transport、模型目录静态配置、turn
loop 和工具执行 runtime。需要新增协议适配层，把 Codex 内部 Responses
风格请求/事件和 DeepSeek Chat Completions 请求/事件互相转换。
