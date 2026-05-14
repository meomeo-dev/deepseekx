# DeepSeek API 集成研究

## 文件说明

- `openai-interface-analysis.md`：分析当前 Codex 中 OpenAI/Responses
  接入面，包括 provider、请求、流式响应、工具和模型目录边界。
- `deepseek-integration-assessment.md`：基于 DeepSeek 文档评估接入
  可行性、风险、推荐方案和首版验收标准。
- `reasoning-cache-history-analysis.md`：分析 DeepSeek 与 OpenAI 在
  reasoning、缓存、多轮历史和工具调用拼接上的差异。
- `deepseek-chat-cache-tool-audit.md`：记录当前实现是否符合 DeepSeek
  多轮对话、KV cache 和 tool calls 官方建议。
- `deepseek-json-output-repair-design.md`：记录 DeepSeek JSON Output
  通过本地校验门和虚拟文件 patch repair 模拟 strict 的方案。
- `provider-profile-provider-id-analysis.md`：分析 `profile + provider`
  配置形状、`/model` 列表来源，以及 DeepSeek provider ID 命名空间。
- `deepseekx-user-facing-surface.md`：记录 DeepSeekX 换皮的用户感知面、
  兼容边界、内部命名保留策略和分阶段实施顺序。
- `deepseekx-mlflow-observability.md`：记录如何用本地 MLflow +
  OpenTelemetry 作为 DeepSeekX 可观测性服务，并说明与 rollout trace
  一起诊断提示词 `messages[]` 的边界。

## 相关快照

DeepSeek 官方文档快照位于 `docs/deepseek-api/snapshots/`。快照由
`docs/deepseek-api/fetch_deepseek_docs.mjs` 生成，并记录来源于
`docs/deepseek-api/sources.yaml`。

## 结论摘要

当前 Codex 主链路是 OpenAI Responses API。DeepSeek 文档主接口是
OpenAI Chat Completions 格式的 `/chat/completions`。DeepSeek 接入需要
新增协议适配层，不能仅通过 provider `base_url` 配置完成。

Chat Completions 适配器必须把 `apply_patch` 做成兼容映射。OpenAI
Responses 和 DeepSeek Chat Completions 在 Codex 层的可用工具行为应
保持一致，不能通过关闭 `apply_patch` 规避 provider 差异。
MCP namespace 工具在 DeepSeek 路径下应降级为普通 function tools，
例如 `mcp__context7__query_docs`，避免用户配置的 MCP server 因
Responses namespace wire shape 不兼容而不可见。

`profile + provider` 是多厂商 DeepSeek 接入的正确形状。`/model`
只展示当前 active provider 的模型目录，不负责切换 provider。
DeepSeek runtime 应基于 `deepseek` / `deepseek-*` provider ID
命名空间识别，把 API 适配行为与服务厂商展示名分离。

DeepSeekX 品牌改造应优先作用于用户入口、TUI、配置、安装包和 SDK
包装层。内部 crate、核心类型、app-server v2 wire schema 和测试夹具
默认保留 Codex 命名，以减少后续同步上游代码的冲突面。
