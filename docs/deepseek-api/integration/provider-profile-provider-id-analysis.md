# Provider、Profile 与 Provider ID 分析

## 范围

本文分析 `config.toml` 中 provider 与 profile 的关系，以及 `/model`
模型切换列表的来源。目标是判断当前配置是否能支持用户通过
`profile + provider` 接入不同厂商托管的 DeepSeek 模型推理服务，并确认
是否需要新增公开配置元语。

## 配置解析结论

`config.toml` 具备三层模型选择入口：

- 顶层 `model` 与 `model_provider` 设置默认模型和默认 provider。
- 顶层 `model_providers` 注册额外 provider。
- `profiles.<name>` 可以覆盖 `model`、`model_provider`、reasoning
  配置和 `model_catalog_json`。

最终 provider 选择顺序是：

1. 运行时 override 中的 `model_provider`。
2. 当前 profile 的 `model_provider`。
3. 顶层 `model_provider`。
4. 默认 `openai`。

这意味着 profile 已经是 provider 选择边界。用户可以通过不同 profile
绑定不同 provider：

```toml
profile = "deepseek-official"

[profiles.deepseek-official]
model_provider = "deepseek"
model = "deepseek-v4-pro"

[profiles.deepseek-vendor-a]
model_provider = "deepseek-vendor-a"
model = "deepseek-v4-pro[1m]"

[model_providers.deepseek-vendor-a]
name = "Vendor A"
base_url = "https://vendor.example/v1"
env_key = "VENDOR_DEEPSEEK_API_KEY"
wire_api = "chat_completions"
```

上述配置应依赖 `deepseek-vendor-a` 这个 provider ID 触发 DeepSeek
runtime。`name` 是展示名，不能作为机器判断条件。

DeepSeek 模型名支持 Codex 侧上下文窗口别名。用户把模型名写成
`deepseek-v4-flash[1m]` 或 `deepseek-v4-pro[1m]` 时，Codex 使用
1,000,000 token 的模型上下文窗口，但发给 DeepSeek API 的模型名仍是
去掉后缀后的 `deepseek-v4-flash` 或 `deepseek-v4-pro`。
该别名也可用于厂商提供的其他 DeepSeek 模型 ID，前提是服务端
真实支持对应上下文窗口。Codex 只负责解析后缀和设置本地模型元
数据，不替服务端扩展模型能力。

上下文窗口优先级如下：

1. 顶层 `model_context_window` 最高，显式覆盖所有模型元数据。
2. 模型名 `[1m]` 后缀次之，表示 1,000,000 token。
3. DeepSeek 静态 catalog 默认使用 384,000 token，最大为
   1,000,000 token。

运行态 `modelContextWindow` 会继续应用 catalog 中的有效窗口比例。当前
DeepSeek catalog 使用 95%，因此 1M 别名在运行事件中表现为
950,000 token 的有效窗口。

示例：

```toml
model_provider = "deepseek-vendor-a"
model = "deepseek-v4-flash[1m]"
model_reasoning_effort = "none"

[model_providers.deepseek-vendor-a]
name = "Vendor A"
base_url = "https://vendor.example/v1"
env_key = "VENDOR_DEEPSEEK_API_KEY"
wire_api = "chat_completions"
```

若希望显式覆盖窗口，使用：

```toml
model_provider = "deepseek-vendor-a"
model = "deepseek-v4-flash[1m]"
model_context_window = 384000
```

此时实际窗口按 `model_context_window = 384000` 计算。

`model_providers.deepseek` 是保留内置 ID，用户不能覆盖它。内置 DeepSeek
provider 只能通过顶层 `deepseek_base_url` 改写 base URL，因此无法用同一
内置 ID 表达多个厂商。多厂商接入必须使用自定义 provider ID，例如
`deepseek-vendor-a`、`deepseek-vendor-b`。

## DeepSeek Provider 边界

内置 `deepseek` provider 的关键配置是：

- `name = "DeepSeek"`。
- `base_url = "https://api.deepseek.com"`。
- `env_key = "DEEPSEEK_API_KEY"`。
- `wire_api = "chat_completions"`。
- `requires_openai_auth = false`。
- `supports_websockets = false`。

DeepSeek runtime 负责两件与 provider 名称无关的语义能力：

- 关闭 `namespace_tools`、`image_generation`、`web_search`。
- 使用 DeepSeek 静态模型目录，默认展示 `deepseek-v4-pro` 和
  `deepseek-v4-flash`。

因此机器语义边界应是 provider ID。内置 `deepseek` 和自定义
`deepseek-*` provider 都应走 DeepSeek runtime；其他 provider 不应因为
展示名包含 DeepSeek 而改变 runtime。

## `/model` 切换逻辑

`/model` 只切换当前 provider catalog 内的模型，不切换 provider。

流程如下：

1. TUI slash dispatch 收到 `SlashCommand::Model`。
2. `ChatWidget::open_model_popup()` 从 `self.model_catalog` 读取模型。
3. `self.model_catalog` 来自 TUI 启动时的 app-server `model/list`。
4. app-server `model/list` 调用 `ThreadManager::list_models()`。
5. `ThreadManager` 使用启动时由 active provider 构建的 `ModelsManager`。
6. 用户选择后，TUI 发送 `UpdateModel`、`UpdateReasoningEffort` 和
   `PersistModelSelection`。
7. `PersistModelSelection` 只把 `model` 与 reasoning effort 写入当前
   active profile；不会修改 `model_provider`。

因此 `/model` 的模型列表始终由当前 active provider 决定。用户不能在
OpenAI provider 的 `/model` 列表里看到 DeepSeek 模型，也不能在 DeepSeek
provider 的 `/model` 列表里看到 OpenAI 模型，除非当前 provider 的
`model_catalog_json` 显式提供了混合目录。

## OpenAI 模型展示条件

`/model` 展示 OpenAI 模型的条件是 active provider 的 `ModelsManager`
返回 OpenAI/Codex 模型目录。

典型情况包括：

- active provider 是内置 `openai`。
- active provider 是默认 `ConfiguredModelProvider`，且没有
  `model_catalog_json`，模型管理器使用 bundled OpenAI/Codex catalog。
- active provider 通过 Codex backend 或 command auth 刷新到 OpenAI/Codex
  形状的 `ModelsResponse`。

展示前还会经过两层过滤：

- 非 ChatGPT auth 模式只保留 `supported_in_api = true` 的模型。
- picker 只展示 `show_in_picker = true` 的模型。

## DeepSeek 模型展示条件

`/model` 展示 DeepSeek 模型的条件是 active provider 的 `ModelsManager`
返回 DeepSeek catalog。

当前能触发该结果的情况包括：

- active provider 是内置 `deepseek`。
- active provider ID 使用 `deepseek-*` 命名空间，从而被识别为
  DeepSeek runtime。
- 自定义 provider 通过 `model_catalog_json` 提供 DeepSeek `ModelInfo`
  catalog。

第三种只影响模型目录，不会自动收窄 provider capabilities。若 provider
没有被识别为 DeepSeek runtime，`web_search`、`image_generation` 和
namespace tools 仍可能按默认 provider 能力暴露。

## 是否需要新增 API Provider 元语

不需要新增 `model_api_provider` 配置键。特殊 runtime 行为可复用
provider ID 作为机器语义边界。

错误方案会让 `name = "DeepSeek"` 同时承担三种语义：

- UI 展示名。
- provider 厂商标识。
- DeepSeek API 适配行为选择条件。

这会阻塞多厂商 DeepSeek 接入。正确模型应区分以下概念：

| 字段 | 语义 |
| --- | --- |
| `model_provider_id` | 用户配置和 profile 引用的 provider key。 |
| `provider.name` | UI 展示的服务厂商名。 |
| `wire_api` | 请求协议，如 `responses` 或 `chat_completions`。 |
| `model` | 具体模型 ID，如 `deepseek-v4-pro`。 |

目标配置应允许这样表达：

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

DeepSeek runtime 应基于 provider ID 命名空间识别：

- `deepseek`：内置官方 DeepSeek provider。
- `deepseek-*`：自定义 DeepSeek API provider。

`provider.name` 继续只负责状态页、日志和 UI 展示。

## 建议实现边界

首选基于 provider ID 选择 provider-specific runtime，不新增公开配置键。
这与 `amazon-bedrock` 使用保留 provider ID 承载特殊 AWS 配置和 runtime
行为的方式一致。

该字段应影响：

- runtime provider 选择。
- provider capability 上界。
- 默认静态 model catalog。
- `/model` picker 的 active provider catalog。
- 后续 DeepSeek `/models` adapter 对 `owned_by` 的映射。

它不应影响：

- provider base URL。
- provider auth 方式。
- profile 选择规则。
- `/model` 的持久化范围。

若未来一个 provider 同时托管多个接口形状，可再重新评估更细粒度
元语。当前多厂商 DeepSeek 目标只需要 provider ID 命名空间。

## 结论

`profile + provider` 是正确接入形状。配置解析已支持用 profile
选择不同 provider；DeepSeek runtime 应基于 `deepseek` 或
`deepseek-*` provider ID 识别。

为支持多个厂商托管的 DeepSeek 模型，应使用 `deepseek-*` 自定义
provider ID。`/model` 不需要跨 provider 展示混合模型；它应继续展示
当前 active provider 的模型目录。用户通过切换 profile 选择 provider，
再用 `/model` 在该 provider 的模型目录内切换具体模型。
