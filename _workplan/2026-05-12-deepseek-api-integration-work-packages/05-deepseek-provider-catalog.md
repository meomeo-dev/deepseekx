# 05 DeepSeek provider 与模型目录

## Metadata

- id: `05-deepseek-provider-catalog`
- status: `completed`
- source: `2026-05-12-deepseek-api-integration-work-breakdown.yaml`
- depends_on: `04-model-client-routing`
- owner: Codex

## Objective

提供 DeepSeek provider 能力边界和模型目录方案，使用户能配置并选择
DeepSeek 模型。

## Functional Scope

In scope:

- DeepSeek provider 能力收窄：禁用 search、image generation、
  namespace hosted tools 和 WebSocket。
- 静态 `ModelInfo` 或 model catalog 示例。
- 文档或配置说明。

Out of scope:

- DeepSeek `/models` 动态补全完整 `ModelInfo`。
- 自动迁移用户配置。

## Non-Functional Requirements

- 不把 DeepSeek 暂缺搜索工具暴露给模型。
- 模型默认 reasoning effort 映射到 DeepSeek 支持值。
- 说明 API key env var。

## Quality Standards

- provider capability 测试覆盖禁用能力。
- model catalog 能被配置加载。
- 示例配置不包含密钥。

## Subplan

1. 设计 DeepSeek provider 注册或配置路径。
2. 实现能力收窄。
3. 增加静态模型目录元数据。
4. 添加配置加载测试。
5. 运行 package 质量门禁。

## Audit-Evaluate-Optimize Loop

- Audit：确认 search 和 image generation 不会暴露。
- Evaluate：运行 provider、config 或 model manager 测试。
- Optimize：收窄默认能力。

## Definition Of Done

- DeepSeek provider 能使用新 chat wire API。
- DeepSeek 模型可通过静态 catalog 解析。
- 不支持能力默认关闭。

## Completion Evidence

- `model-provider-info` 内置 `deepseek` provider：
  `base_url = "https://api.deepseek.com"`、
  `env_key = "DEEPSEEK_API_KEY"`、
  `wire_api = "chat_completions"`、`supports_websockets = false`。
- `model-provider` 新增 DeepSeek runtime provider，关闭
  `namespace_tools`、`image_generation`、`web_search`。
- `model-provider` 新增 DeepSeek 静态 catalog，包含
  `deepseek-v4-pro` 与 `deepseek-v4-flash`，仅声明文本输入。
- 已运行 `just fmt`。
- 已运行 `cargo test -p codex-model-provider-info`。
- 已运行 `cargo test -p codex-model-provider deepseek`。
- 已运行 `cargo test -p codex-model-provider`。
- 已运行 `just fix -p codex-model-provider`。
- 已运行 `git diff --check` 覆盖本 package 修改文件。
- 已运行新增行宽检查，未发现超过 88 字符的新增行。

## Risks

- 内置 provider 与用户自定义 provider 的边界需要避免配置冲突。
