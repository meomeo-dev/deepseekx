# 04 ModelClient 路由接入

## Metadata

- id: `04-model-client-routing`
- status: `completed`
- source: `2026-05-12-deepseek-api-integration-work-breakdown.yaml`
- depends_on: `02-request-adapter`, `03-stream-adapter`
- owner: Codex

## Objective

在 `ModelClientSession::stream` 中按 wire API 路由到 Chat Completions
HTTP streaming path。

## Functional Scope

In scope:

- 新增 chat stream 分支。
- 复用 auth、provider、headers、telemetry 的合理部分。
- 关闭 Chat Completions 路径的 WebSocket。
- 连接 adapter、endpoint 和 stream mapper。

Out of scope:

- DeepSeek provider 内置注册。
- 动态模型目录转换。

## Non-Functional Requirements

- Responses 路径行为不变。
- Chat 路径错误映射清晰。
- 不复制大段 retry/auth 逻辑，优先抽取边界内复用。

## Quality Standards

- core client tests 覆盖 chat route path。
- Responses 现有测试保持通过。
- telemetry endpoint 名称不误报为 `/responses`。

## Subplan

1. 读取 current client setup 和 stream path。
2. 添加 chat stream 方法。
3. 在 `stream` match 中接入新 wire API。
4. 添加路由测试。
5. 运行 package 质量门禁。

## Audit-Evaluate-Optimize Loop

- Audit：确认只有 wire API 分支影响 Chat path。
- Evaluate：运行相关 core/codex-api 测试。
- Optimize：减少重复逻辑。

## Definition Of Done

- 新 wire API 会请求 `/chat/completions`。
- Responses provider 仍请求 `/responses`。
- WebSocket 不用于 Chat Completions。

## Completion Evidence

- Package `04-model-client-routing` completed.
- Files changed:
  - `codex-rs/core/src/client.rs`
  - `codex-rs/core/src/chat_completions.rs`
  - `codex-rs/core/tests/common/responses.rs`
  - `codex-rs/core/tests/suite/client.rs`
- Quality gates:
  - `just fmt`
  - `cargo test -p codex-api`
  - `cargo test -p codex-core \
    chat_completions_wire_api_uses_chat_completions_route`
  - `cargo test -p codex-core chat_completions`
  - `just fix -p codex-core`
  - `git diff --check`
  - 新增行宽检查无超过 88 字符的新增行。
- Outcome:
  - `WireApi::ChatCompletions` 通过 HTTP 请求 `/chat/completions`。
  - 路由连接 `build_chat_completions_request`、`ChatCompletionsClient`
    和 Chat SSE stream adapter。
  - Chat 路径不走 Responses WebSocket。
  - Chat telemetry endpoint 使用 `/chat/completions`，不误报为
    `/responses`。
  - Chat 路径只携带 session/thread 与 turn metadata headers，避免
    复用 Responses/WebSocket 专用 headers。

## Risks

- 复用 Responses headers 时可能携带 OpenAI 专用 header，需要筛选。
