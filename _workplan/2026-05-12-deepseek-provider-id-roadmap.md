# DeepSeek Provider ID Roadmap

## Goal

复用 provider ID 作为 DeepSeek runtime 的机器边界，使用户可以通过
`profile + provider` 接入不同厂商托管的 DeepSeek 模型推理服务，并保持
`/model` 只展示当前 active provider 的模型目录。

## Source Documents

- `docs/deepseek-api/integration/provider-profile-provider-id-analysis.md`
- `docs/deepseek-api/integration/deepseek-integration-assessment.md`
- `docs/deepseek-api/integration/README.md`
- `_workplan/specs/workplan-roadmap.content.meta_spec.yaml`
- `_workplan/specs/workplan-work-breakdown.content.meta_spec.yaml`
- `_workplan/specs/workplan-work-package.content.meta_spec.yaml`

## Current Implementation

`ConfigToml` 已支持 `profiles.<name>.model_provider` 和自定义
`model_providers.<id>`。当前 DeepSeek runtime 通过
`provider.name == "DeepSeek"` 识别，这把服务厂商展示名和 API 适配行为
绑定在一起。

`/model` 从 app-server `model/list` 获取 active provider 的模型目录。
模型选择只持久化 `model` 和 reasoning effort，不修改 `model_provider`。

## Target Capability

用户可以配置：

```toml
[profiles.deepseek-vendor-a]
model_provider = "deepseek-vendor-a"
model = "deepseek-v4-pro"

[model_providers.deepseek-vendor-a]
name = "Vendor A"
base_url = "https://vendor.example/v1"
env_key = "VENDOR_DEEPSEEK_API_KEY"
wire_api = "chat_completions"
```

该 provider 应走 DeepSeek runtime，关闭不支持的 provider capabilities，
并展示 DeepSeek 静态模型目录。`name` 只用于 UI 和状态展示。

## Roadmap Phases

1. 将 DeepSeek runtime 识别改为基于 provider ID。
2. 保留内置 `deepseek` provider，并允许 `deepseek-*` 自定义 ID。
3. 确认 `provider.name` 只用于展示。
4. 覆盖配置、provider runtime 和 `/model` 目录行为测试。
5. 更新 schema 和集成文档。
6. 使用 server 模式实跑 `deepseek-*` 自定义 provider 配置。

## Quality Gates

- `cargo test -p codex-model-provider-info`
- `cargo test -p codex-model-provider deepseek`
- `cargo test -p codex-core deepseek_prefixed_custom_provider`
- `cargo test -p codex-core chat_completions`
- `just write-config-schema`
- `just fmt`
- `just fix -p codex-model-provider-info`
- `just fix -p codex-model-provider`
- `just fix -p codex-core`
- server 模式真实 DeepSeek smoke test 成功。

## Risks

- 真实 DeepSeek 验证依赖本机有效 `DEEPSEEK_API_KEY`。
- 如果自定义 DeepSeek provider 不使用 `deepseek-*` ID，请求协议可走
  Chat Completions，但 provider capabilities 不会自动收窄。
