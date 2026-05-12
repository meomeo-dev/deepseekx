# DeepSeek API Integration Work Packages

## Purpose

本目录将 DeepSeek API 接入拆分为可连续恢复的单项工作包。
执行时一次只推进一个 package。若发生上下文压缩，先阅读
本 README 和
`2026-05-12-deepseek-api-integration-work-breakdown.yaml`，再继续第一个
未完成 package。

## Source Of Truth

- `_workplan/2026-05-12-deepseek-api-integration-roadmap.md`
- `_workplan/2026-05-12-deepseek-api-integration-work-breakdown.yaml`
- `docs/deepseek-api/integration/openai-interface-analysis.md`
- `docs/deepseek-api/integration/deepseek-integration-assessment.md`

## Execution Order

1. `00-wire-api-contract`
2. `01-chat-endpoint-types`
3. `02-request-adapter`
4. `03-stream-adapter`
5. `04-model-client-routing`
6. `05-deepseek-provider-catalog`
7. `06-integration-tests`

## Dependency Graph

- `00-wire-api-contract` has no package dependency.
- `01-chat-endpoint-types` depends on `00-wire-api-contract`.
- `02-request-adapter` depends on `01-chat-endpoint-types`.
- `03-stream-adapter` depends on `01-chat-endpoint-types`.
- `04-model-client-routing` depends on `02-request-adapter` and
  `03-stream-adapter`.
- `05-deepseek-provider-catalog` depends on `04-model-client-routing`.
- `06-integration-tests` depends on all prior packages.

## Global Quality Gates

- 行宽检查：`awk 'length($0)>88{print FILENAME ":" FNR ":" $0}' ...`
- Rust 修改后：在 `codex-rs` 运行 `just fmt`。
- 每个 touched crate 运行最小测试。
- 不把 DeepSeek 不支持的 search 或 hosted tool 暴露给 provider。
- 每个 package 的 Completion Evidence 必须更新。

## Review Loop

每个 package 完成后执行：

1. 审计：确认只改 package 声明范围内的文件。
2. 评估：运行该 package 要求的最小质量门禁。
3. 优化：修复发现的问题。
4. 记录：更新 package Completion Evidence。

## Status

- `00-wire-api-contract`: completed
- `01-chat-endpoint-types`: completed
- `02-request-adapter`: completed
- `03-stream-adapter`: completed
- `04-model-client-routing`: completed
- `05-deepseek-provider-catalog`: completed
- `06-integration-tests`: completed
