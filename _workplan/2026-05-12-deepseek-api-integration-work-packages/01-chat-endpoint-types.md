# 01 Chat Completions endpoint 类型

## Metadata

- id: `01-chat-endpoint-types`
- status: `completed`
- source: `2026-05-12-deepseek-api-integration-work-breakdown.yaml`
- depends_on: `00-wire-api-contract`
- owner: Codex

## Objective

在 `codex-api` 中定义 DeepSeek 所需的 Chat Completions 请求、响应、SSE
chunk 和 endpoint client。

## Functional Scope

In scope:

- `POST /chat/completions` HTTP streaming client。
- 请求字段：messages、tools、tool_choice、thinking、reasoning_effort、
  response_format、stream、stream_options。
- 响应字段：choices、delta、message、tool_calls、usage。

Out of scope:

- 从 `Prompt` 生成请求。
- 把 chunk 转成完整 turn 事件。

## Non-Functional Requirements

- 类型只覆盖首版必要字段。
- 未知字段允许 provider 扩展，不应导致解析失败。
- endpoint path 不影响 Responses client。

## Quality Standards

- `cargo test -p codex-api` 中新增测试通过。
- 不引入 DeepSeek SDK 依赖。
- 结构体字段命名清晰，serde wire 名称准确。

## Subplan

1. 定位 `codex-api` endpoint module 组织方式。
2. 新增 chat completions 类型。
3. 新增 endpoint client。
4. 添加请求 URL 和基础序列化测试。
5. 运行 package 质量门禁。

## Audit-Evaluate-Optimize Loop

- Audit：确认 endpoint 与类型没有侵入 Responses parser。
- Evaluate：运行 `cargo test -p codex-api`。
- Optimize：收窄字段和可见性。

## Definition Of Done

- 可以构造 `POST /chat/completions` streaming request。
- Chat 类型能解析 DeepSeek 示例 chunk 的核心字段。
- 相关测试通过或记录阻塞原因。

## Completion Evidence

- Package `01-chat-endpoint-types` completed.
- Files changed:
  - `codex-rs/codex-api/src/endpoint/chat_completions.rs`
  - `codex-rs/codex-api/src/endpoint/mod.rs`
  - `codex-rs/codex-api/src/lib.rs`
  - `codex-rs/codex-api/tests/clients.rs`
- Quality gates:
  - `just fmt`
  - `cargo test -p codex-api`
  - `git diff --check`
- Outcome:
  - `ChatCompletionsClient` can construct a streamed
    `POST /chat/completions` request.
  - Request types cover messages, tools, tool choice, thinking,
    `reasoning_effort`, JSON object output, and usage stream options.
  - Response and chunk types parse DeepSeek text, reasoning, tool call,
    usage, cache token, and reasoning-token fields.
  - Responses endpoint and parser are unchanged.

## Risks

- DeepSeek chunk 与 OpenAI Chat chunk 细节可能存在 provider 差异。
