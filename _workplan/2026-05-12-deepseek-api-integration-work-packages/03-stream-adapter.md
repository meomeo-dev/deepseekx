# 03 DeepSeek 流式响应适配

## Metadata

- id: `03-stream-adapter`
- status: `completed`
- source: `2026-05-12-deepseek-api-integration-work-breakdown.yaml`
- depends_on: `01-chat-endpoint-types`
- owner: Codex

## Objective

把 DeepSeek `chat.completion.chunk` SSE 转成内部 `ResponseEvent`，使现有
turn loop 可以消费。

## Functional Scope

In scope:

- `delta.content` 到 `OutputTextDelta`。
- `delta.reasoning_content` 到 `ReasoningContentDelta`。
- tool call arguments 增量到 `ToolCallInputDelta`。
- 完整 message、reasoning 和 tool call item done。
- usage 到 `TokenUsage`。
- `[DONE]` 到 `Completed`。

Out of scope:

- 请求 adapter。
- provider 注册。
- WebSocket。

## Non-Functional Requirements

- 流结束前必须生成可消费的 completed 事件或明确错误。
- parser 对未知 chunk 字段保持兼容。
- tool call argument 拼接必须稳定。

## Quality Standards

- 使用 DeepSeek 文档样例建立 parser 测试。
- 覆盖 reasoning、content、tool call、usage 和 `[DONE]`。
- 错误路径不会静默成功。

## Subplan

1. 设计 chunk 聚合状态。
2. 实现 SSE parser。
3. 实现 tool call 聚合。
4. 实现 usage 映射。
5. 运行 package 质量门禁。

## Audit-Evaluate-Optimize Loop

- Audit：确认 parser 不影响 Responses parser。
- Evaluate：运行 `cargo test -p codex-api`。
- Optimize：补异常流测试。

## Definition Of Done

- DeepSeek chunk 可转成内部文本、reasoning 和 tool 事件。
- `[DONE]` 能生成 `Completed`。
- usage 不导致解析失败。

## Completion Evidence

- Package `03-stream-adapter` completed.
- Files changed:
  - `codex-rs/codex-api/src/sse/chat_completions.rs`
  - `codex-rs/codex-api/src/sse/mod.rs`
  - `codex-rs/codex-api/src/lib.rs`
- Quality gates:
  - `just fmt`
  - `cargo test -p codex-api`
  - 新增行宽检查无超过 88 字符的新增行。
- Outcome:
  - 新增 DeepSeek Chat Completions SSE stream adapter。
  - `delta.content` 转成 `OutputTextDelta`，并补齐 message
    `OutputItemAdded` 与 `OutputItemDone` 生命周期事件。
  - `delta.reasoning_content` 转成 `ReasoningContentDelta`，并补齐
    reasoning item 生命周期事件。
  - tool call argument 分片稳定拼接，并输出 `ToolCallInputDelta`。
  - usage 映射到 `TokenUsage`，包含 prompt cache hit 和 reasoning token。
  - `data: [DONE]` 生成 `Completed`；缺失 `[DONE]` 返回明确 stream 错误。
  - SSE error payload 返回明确 stream 错误。

## Risks

- DeepSeek tool call arguments 可能分片到多个 chunk，需要聚合。
