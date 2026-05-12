# DeepSeek API Integration Roadmap

## Goal

将 DeepSeek OpenAI Chat Completions API 接入 Codex 当前模型调用链路。
实现范围以文本、流式、基础 function tools、reasoning content 和静态
模型目录为首版目标。DeepSeek 暂缺搜索工具，因此首版必须禁用
搜索、
图片生成、Responses namespace hosted tools、custom hosted tools 和
WebSocket。

## Source Documents

- `docs/deepseek-api/integration/openai-interface-analysis.md`
- `docs/deepseek-api/integration/deepseek-integration-assessment.md`
- `docs/deepseek-api/snapshots/create_chat_completion.md`
- `docs/deepseek-api/snapshots/thinking_mode.md`
- `docs/deepseek-api/snapshots/tool_calls.md`
- `docs/deepseek-api/snapshots/json_mode.md`
- `docs/deepseek-api/snapshots/kv_cache.md`
- `docs/deepseek-api/snapshots/list_models.md`

## Current Implementation

当前 Codex 主链路只支持 OpenAI Responses API。`WireApi` 只有
`Responses`。模型请求发送到 `POST /responses`，SSE parser 只处理
`response.*` 事件。工具规格、模型目录和 reasoning 历史也按 Responses
形状组织。

## Target Capability

新增一个受限 Chat Completions wire API 路径，使 DeepSeek provider 可以
使用 `POST /chat/completions`。该路径应复用现有 turn loop 和工具执行
runtime，但在 API 边界转换请求、流式事件、reasoning content、usage 和
工具调用。

## Roadmap Phases

1. 声明协议边界：扩展 `WireApi`，为 Chat Completions 路径建立显式
   分支，不恢复无约束旧 chat 行为。
2. 建立 Chat Completions endpoint：增加请求、响应、SSE chunk 和 client
   类型，先支持 DeepSeek 所需字段。
3. 建立请求适配：把 `Prompt`、Responses 历史和工具规格转换为
   `messages[]`、`tools`、`tool_choice`、`thinking` 和 JSON output。
4. 建立响应适配：把 DeepSeek chunk 和完整 tool calls 转成内部
   `ResponseEvent`。
5. 接入 model client：在 `ModelClientSession::stream` 中按 wire API
   路由到 Chat Completions，并禁用 WebSocket。
6. 收窄 DeepSeek provider 能力：关闭不支持的 hosted tools，并提供静态
   model catalog 路径。
7. 补测试与证据：覆盖文本、流式、tool calls、reasoning content、
   JSON output、usage 和禁用能力。

## Quality Gates

- 新增文件和修改文件遵守 88 字符行宽。
- Rust 修改后在 `codex-rs` 运行 `just fmt`。
- 针对修改 crate 运行最小测试，例如 `cargo test -p codex-api`。
- 若修改 core、protocol 或 common crate，先运行相关 crate 测试。
- 不向外部搜索发送源码、私有路径、密钥或实现细节。
- 每个工作包完成时更新其 Completion Evidence。

## Risks

- DeepSeek `reasoning_content` 在 tool call 后必须跨轮回传，历史压缩或
  分叉可能丢失该字段。
- Chat Completions 的 function tools 不能覆盖 Responses namespace、
  custom、web search 和 image generation 工具。
- DeepSeek `/models` 返回信息不足以直接构造 Codex `ModelInfo`。
- JSON Output 不等同于 Responses `text.format` JSON Schema strict。

## Residual Risks

首版完成后仍可能缺少 strict schema beta、动态模型目录、完整 logprobs
和非文本多模态能力。这些能力不进入首版完成定义。
