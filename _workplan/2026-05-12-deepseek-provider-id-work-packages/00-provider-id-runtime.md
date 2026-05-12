# 00 Provider ID runtime 识别

## Metadata

- id: `00-provider-id-runtime`
- status: `completed`
- source: `2026-05-12-deepseek-provider-id-work-breakdown.yaml`
- depends_on: none
- owner: Codex

## Objective

使用 `deepseek` 和 `deepseek-*` provider ID 识别 DeepSeek runtime，使
自定义 provider 能以自己的展示名承载 DeepSeek API，同时走 DeepSeek
能力收窄和静态模型目录。

## Functional Scope

In scope:

- 不新增公开 `model_api_provider` 配置键。
- `provider.name` 不再作为 DeepSeek 机器判断。
- DeepSeek runtime 识别改为使用 provider ID 命名空间。
- 配置、provider 和最小 `/model` 目录行为测试。
- config schema 更新。
- server 模式真实 DeepSeek smoke test。

Out of scope:

- `/model` 跨 provider 切换或混合展示模型。
- DeepSeek `/models` 动态补全完整 `ModelInfo`。
- strict schema beta 默认启用。

## Non-Functional Requirements

- `provider.name` 只作为展示名。
- 非 `deepseek-*` 自定义 provider 保持默认 provider 行为。
- `wire_api` 只表达协议，不隐式收窄 provider capabilities。
- 所有新增和修改文档行宽不超过 88 字符。

## Quality Standards

- `cargo test -p codex-model-provider-info` 通过。
- `cargo test -p codex-model-provider deepseek` 通过。
- `cargo test -p codex-core deepseek_prefixed_custom_provider` 通过。
- `cargo test -p codex-core chat_completions` 通过。
- `just write-config-schema` 已运行并提交 schema 更新。
- `just fmt` 已运行。
- 相关 crate 的 `just fix -p` 已运行。
- server 模式真实 DeepSeek smoke test 成功。

## Subplan

1. 移除 `model_api_provider` 公开字段和 schema 残留。
2. 新增基于 provider ID 的 runtime factory。
3. 将核心路径改为传递 active provider ID。
4. 补 provider 与配置层测试。
5. 更新 schema、文档和 Completion Evidence。
6. 使用 server 模式配置 `deepseek-*` provider，完成真实请求验证。

## Audit-Evaluate-Optimize Loop

- 复评结论：不新增 `model_api_provider` 或同类公开配置键。
- 设计依据：`amazon-bedrock` 已通过保留 provider ID 承载特殊 runtime
  行为；DeepSeek 可复用同一模式。
- 优化方向：`deepseek` 和 `deepseek-*` 是 DeepSeek runtime 的机器
  边界，`provider.name` 仅用于展示。
- 约束：`wire_api` 只表达协议形状，不能隐式收窄 provider capabilities
  或选择 DeepSeek 静态 catalog。

## Definition Of Done

- 自定义 provider 可用 `model_provider = "deepseek-vendor"` 和
  `name = "Vendor A"` 触发 DeepSeek runtime。
- `/model` 在该 provider 下展示 DeepSeek 静态 catalog。
- 非 `deepseek-*` 自定义 Chat Completions provider 不自动获得
  DeepSeek capabilities。
- server 模式真实 DeepSeek 请求跑通。

## Completion Evidence

- 设计复评：不新增 `model_api_provider`，特殊 runtime 行为复用
  provider ID 命名空间。
- 代码路径：`create_model_provider_for_id` 使用 `deepseek` 和
  `deepseek-*` 选择 DeepSeek runtime。
- 配置路径：`ModelClient`、turn context、app-server 配置能力读取等
  调用点传递 active `model_provider_id`。
- schema：已运行 `just write-config-schema` 并更新
  `codex-rs/core/config.schema.json`。
- 格式化：已运行 `just fmt`。
- 修复检查已通过：`just fix -p codex-model-provider-info`。
- 修复检查已通过：`just fix -p codex-model-provider`。
- 修复检查已通过：`just fix -p codex-config`。
- 修复检查已通过：`just fix -p codex-core`。
- 修复检查已通过：`just fix -p codex-app-server`。
- 修复检查已通过：`just fix -p codex-tui`。
- 修复检查已通过：`just fix -p codex-memories-write`。
- 定向测试已通过：
  `cargo test -p codex-model-provider deepseek -- --nocapture`。
- 定向测试已通过：
  `cargo test -p codex-core deepseek_prefixed_custom_provider -- --nocapture`。
- 定向测试已通过：
  `cargo test -p codex-model-provider-info -- --nocapture`。
- 定向测试已通过：
  `cargo test -p codex-config \
  model_provider_proto_roundtrips_chat_completions_wire_api -- --nocapture`。
- server 模式 smoke test 已通过：
  `codex-app-server-test-client --codex-bin target/debug/codex send-message-v2`
  使用 `model_provider = "deepseek-smoke"`、`model = "deepseek-v4-flash"`、
  `wire_api = "chat_completions"`。
- server 模式结果：`thread/start` 返回 `modelProvider = "deepseek-smoke"`，
  `reasoningEffort = "none"`；`turn/completed` 状态为 `completed`。
- server 模式模型回复：`deepseek server smoke ok`。
- DeepSeek 模型别名已支持：`deepseek-v4-flash[1m]` 与同类模型名
  使用 1,000,000 token 元数据，并在 Chat Completions 请求中剥离
  `[1m]` 后缀。
- DeepSeek 静态 catalog 默认窗口为 384,000 token，最大窗口为
  1,000,000 token。
- `model_context_window` 优先于 `[1m]` 别名；运行态继续应用 95%
  有效窗口比例。
- 别名定向测试已通过：
  `cargo test -p codex-models-manager one_m -- --nocapture`。
- 真实 DeepSeek `[1m]` smoke test 已通过：配置
  `model = "deepseek-v4-flash[1m]"` 后返回 `deepseek alias 1m ok`，
  `thread/tokenUsage/updated` 中 `modelContextWindow = 950000`。
