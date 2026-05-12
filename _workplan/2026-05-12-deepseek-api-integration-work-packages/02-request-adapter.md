# 02 Responses 到 Chat 请求适配

## Metadata

- id: `02-request-adapter`
- status: `completed`
- source: `2026-05-12-deepseek-api-integration-work-breakdown.yaml`
- depends_on: `01-chat-endpoint-types`
- owner: Codex

## Objective

把 Codex 内部 `Prompt`、Responses 历史和工具规格转换为 DeepSeek Chat
Completions 请求。

## Functional Scope

In scope:

- `instructions` 到 `system` message。
- user、assistant、function call output 到 `messages[]`。
- 基础 function tools 转换。
- `thinking` 与 `reasoning_effort` 转换。
- output schema 到 JSON object 降级。

Out of scope:

- SSE chunk 解析。
- DeepSeek provider 注册。
- strict schema beta 默认启用。

## Non-Functional Requirements

- 对无等价 Responses item 明确拒绝或受控忽略。
- 不丢失 tool call 后需要回传的 `reasoning_content`。
- 不暴露 DeepSeek 暂不支持的 search 和 hosted tools。

## Quality Standards

- 请求转换单元测试覆盖多轮、tool result、JSON output。
- 错误路径有可理解信息。
- 代码不新增一次性 helper。

## Subplan

1. 设计 adapter 输入输出边界。
2. 实现 messages 转换。
3. 实现 tools 转换和禁用检查。
4. 实现 reasoning 与 JSON output 转换。
5. 运行 package 质量门禁。

## Audit-Evaluate-Optimize Loop

- Audit：确认转换逻辑集中在 adapter。
- Evaluate：运行相关 crate 测试。
- Optimize：补齐 edge case 测试。

## Definition Of Done

- 基础对话请求能生成 DeepSeek chat body。
- 基础 function tool 请求能生成 DeepSeek tools。
- 不支持工具会被禁用或返回明确错误。

## Completion Evidence

- Package `02-request-adapter` completed.
- Files changed:
  - `codex-rs/core/src/chat_completions.rs`
  - `codex-rs/core/src/lib.rs`
- Quality gates:
  - `just fmt`
  - `cargo test -p codex-core chat_completions`
  - `just fix -p codex-core`
  - `git diff --check`
- Outcome:
  - `Prompt` and Responses history convert into `ChatCompletionsRequest`.
  - Base instructions become a leading `system` message.
  - user, assistant, function call, and tool output items convert to
    `messages[]`.
  - Function tool specs convert to Chat Completions `tools`.
  - `thinking`, `reasoning_effort`, JSON object mode, and usage stream
    options are set for DeepSeek.
  - Reasoning content preceding a tool call is preserved on the assistant
    tool-call message.
  - Hosted search, image generation, custom, namespace, and freeform tools
    return explicit unsupported-operation errors.

## Risks

- Responses 历史中 reasoning item 和 assistant message 的关联需要谨慎。
