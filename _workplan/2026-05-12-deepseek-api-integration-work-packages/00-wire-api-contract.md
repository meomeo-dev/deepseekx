# 00 Wire API 协议边界

## Metadata

- id: `00-wire-api-contract`
- status: `completed`
- source: `2026-05-12-deepseek-api-integration-work-breakdown.yaml`
- depends_on: none
- owner: Codex

## Objective

新增受限 Chat Completions wire API 表达，为 DeepSeek adapter 建立显式
协议边界。

## Functional Scope

In scope:

- 扩展 `WireApi`，使配置可以声明 Chat Completions 路径。
- 保留旧 `wire_api = "chat"` 的明确错误或迁移提示。
- 更新相关单元测试。

Out of scope:

- HTTP endpoint client。
- 请求和响应转换。
- DeepSeek provider 内置注册。

## Non-Functional Requirements

- 不恢复未约束的旧 chat 行为。
- 错误消息必须指导用户使用新的受限配置名。
- 修改保持局部化。

## Quality Standards

- `codex-rs/model-provider-info` 测试通过。
- `just fmt` 在 Rust 修改后运行。
- 新增行遵守 88 字符限制。

## Subplan

1. 读取 `WireApi` 现有测试。
2. 设计新 wire API 配置字符串。
3. 修改枚举、Display 与 Deserialize。
4. 更新测试覆盖新值和旧值错误。
5. 运行 package 质量门禁。

## Audit-Evaluate-Optimize Loop

- Audit：确认只触及 wire API contract 相关文件。
- Evaluate：运行 `cargo test -p codex-model-provider-info`。
- Optimize：修复格式、测试和错误文案问题。

## Definition Of Done

- 新 wire API 能从 TOML 反序列化。
- `wire_api = "chat"` 仍不会静默启用旧路径。
- 相关测试通过或记录阻塞原因。

## Completion Evidence

- Package `00-wire-api-contract` completed.
- Files changed:
  - `codex-rs/model-provider-info/src/lib.rs`
  - `codex-rs/model-provider-info/src/model_provider_info_tests.rs`
  - `codex-rs/config/src/thread_config/remote.rs`
  - `codex-rs/config/src/thread_config/proto/codex.thread_config.v1.proto`
  - `codex-rs/config/src/thread_config/proto/codex.thread_config.v1.rs`
  - `codex-rs/core/src/client.rs`
  - `codex-rs/core/config.schema.json`
- Quality gates:
  - `just fmt`
  - `just write-config-schema`
  - `cargo test -p codex-model-provider-info`
  - `cargo test -p codex-config`
    `thread_config::remote::tests::`
    `model_provider_proto_roundtrips_chat_completions_wire_api`
  - `cargo test -p codex-core`
    `config::schema::tests::config_schema_matches_fixture`
  - `git diff --check`
- Outcome:
  - `wire_api = "chat_completions"` deserializes to
    `WireApi::ChatCompletions`.
  - `wire_api = "chat"` still returns the removed-chat migration error.
  - Remote thread config proto can round-trip the new wire API value.
  - Model client reports an explicit unsupported operation until later
    packages wire the Chat Completions stream path.

## Risks

- 配置字符串若选择不清晰，后续 adapter 可能被误认为通用
  OpenAI chat。
