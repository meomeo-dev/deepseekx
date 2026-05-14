# 02 默认 Provider 和认证提示

## Metadata

- id: `02-default-provider-auth`
- status: `completed`
- source: `2026-05-14-deepseekx-user-facing-surface-work-breakdown.yaml`
- depends_on: `00-cli-launcher-help`
- owner: DeepSeekX

## Objective

让 DeepSeekX 默认模型调用路径面向 DeepSeek API，并把默认凭据提示
调整为 `DEEPSEEK_API_KEY`，同时保留 OpenAI provider 和 ChatGPT 登录
兼容能力。

## Functional Scope

In scope:

- DeepSeekX build 默认 `model_provider`。
- 默认模型和 active provider 模型列表行为。
- API key 帮助文本、login 示例和 onboarding 文案。
- OpenAI provider 作为显式配置路径继续可用。

Out of scope:

- 删除 OpenAI auth、ChatGPT login 或 legacy env 兼容。
- 配置目录迁移。
- DeepSeek strict schema beta 默认开启。

## Non-Functional Requirements

- provider 机器语义仍基于 provider ID 和 runtime capability。
- 不通过 provider display name 字符串判断 DeepSeek 行为。
- 默认值变化必须可被配置覆盖。

## Quality Standards

- Rust 修改后在 `codex-rs` 运行 `just fmt`。
- 涉及 config schema 时运行 `just write-config-schema`。
- 运行 provider、config 或 core 相关最小测试。
- 新增行遵守 88 字符限制。

## Subplan

1. 定位默认 provider、默认模型和 auth 提示来源。
2. 设计 DeepSeekX build 默认值与 upstream 默认值的边界。
3. 调整 DeepSeekX 默认 provider 和 `DEEPSEEK_API_KEY` 提示。
4. 保留 OpenAI provider 显式配置和 legacy env 兼容。
5. 运行 package 质量门禁并记录证据。

## Audit-Evaluate-Optimize Loop

- Audit：确认没有删除 OpenAI provider 兼容代码。
- Evaluate：验证默认 provider、模型列表和 API key 提示。
- Optimize：修复默认值覆盖和 provider 识别边界问题。

## Definition Of Done

- 未配置 provider 时，DeepSeekX 默认走 DeepSeek provider。
- 默认凭据说明使用 `DEEPSEEK_API_KEY`。
- 用户显式配置 OpenAI provider 时仍可走 OpenAI 路径。
- 相关测试和格式检查通过，或记录阻塞原因。

## Completion Evidence

- Completed in current branch.
- Evidence files:
  - `codex-rs/core/src/config/mod.rs`
  - `codex-rs/config/src/config_toml.rs`
  - `codex-rs/login/src/auth/manager.rs`
  - `codex-rs/model-provider/src/models_endpoint.rs`
  - `codex-rs/models-manager/src/manager.rs`
- Focused checks passed earlier:
  - `cargo test -p codex-login`
  - `cargo test -p codex-model-provider`
  - `cargo test -p codex-models-manager     refresh_available_models_skips_network_without_chatgpt_auth`
