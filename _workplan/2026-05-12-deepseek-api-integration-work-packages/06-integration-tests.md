# 06 集成测试与证据

## Metadata

- id: `06-integration-tests`
- status: `completed`
- source: `2026-05-12-deepseek-api-integration-work-breakdown.yaml`
- depends_on: all prior packages
- owner: Codex

## Objective

覆盖 DeepSeek 首版验收矩阵，并记录最终完成证据。

## Functional Scope

In scope:

- 单轮文本。
- 多轮历史。
- 流式文本。
- 流式 reasoning。
- function tool call 和 tool result follow-up。
- JSON output 降级。
- cache usage 映射。
- 不支持能力禁用。

Out of scope:

- 真实 DeepSeek 网络调用。
- 完整 workspace 长跑测试，除非用户另行确认。

## Non-Functional Requirements

- 测试使用本地 mock server 或 fixture。
- 不需要真实 API key。
- 测试命名表达行为，不只检查实现细节。

## Quality Standards

- touched crate 最小测试通过。
- `just fmt` 已运行。
- 行宽检查通过。
- Completion Evidence 列出文件和命令结果。

## Subplan

1. 汇总已添加测试覆盖。
2. 补缺失验收场景。
3. 运行最小测试集合。
4. 更新全部 work package 状态与证据。
5. 输出最终集成状态。

## Audit-Evaluate-Optimize Loop

- Audit：确认测试覆盖首版验收矩阵。
- Evaluate：运行最小测试和行宽检查。
- Optimize：修复失败和缺口。

## Definition Of Done

- 首版验收矩阵均有测试或明确残余风险。
- 所有 work package Completion Evidence 更新。
- 最终状态可从 workplan 恢复理解。

## Completion Evidence

Coverage matrix:

- 单轮文本：`chat_completions_wire_api_uses_chat_completions_route`
  验证 Chat Completions 路由、文本响应和 `[DONE]` 完成事件。
- 多轮历史与 tool result follow-up：
  `deepseek_provider_replays_reasoning_tool_history` 验证第二轮请求
  包含 assistant tool call 与 `role = "tool"` 消息。
- 流式文本与 reasoning：
  `maps_content_reasoning_usage_and_done` 覆盖 `delta.content`、
  `delta.reasoning_content`、usage 和 completed 映射。
- function tool call：
  `maps_fragmented_tool_call_arguments` 覆盖分片 tool arguments 汇总。
- reasoning content 回传：
  `preserves_reasoning_content_for_tool_call_history` 和
  `deepseek_provider_replays_reasoning_tool_history` 覆盖 tool call 历史。
- JSON output 降级：
  `builds_basic_chat_request_with_json_output` 验证 `json_object`。
- cache usage 映射：
  `maps_content_reasoning_usage_and_done` 验证 cache hit tokens 映射。
- 不支持能力禁用：
  DeepSeek provider 与 catalog 测试覆盖 search、image generation、
  namespace tools 和 image modality 不暴露。

Commands:

- `just fmt`
- `just write-config-schema`
- `cargo test -p codex-api chat_completions`
- `cargo test -p codex-core chat_completions`
- `cargo test -p codex-core deepseek_provider_replays_reasoning_tool_history`
- `cargo test -p codex-core config::schema::tests::config_schema_matches_fixture`
- `cargo test -p codex-model-provider-info`
- `cargo test -p codex-model-provider deepseek`
- `cargo test -p codex-model-provider`
- `just fix -p codex-model-provider`
- `just fix -p codex-core`
- `git diff --check`
- 新增行宽检查：
  `git diff -U0 | awk '/^\+/ && !/^\+\+\+/ { if (length($0)-1 > 88) print }'`

Notes:

- 未运行完整 workspace 长跑测试。该项超出本 package 范围，
  需要用户确认。
- 未做真实 DeepSeek 网络调用；全部验收使用本地 mock server
  或 fixture。

## Risks

- 若改动触及 core shared path，测试时间可能较长。
