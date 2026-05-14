# DeepSeekX 用户感知面 Roadmap

## Goal

将用户安装、启动、配置、TUI、server 模式和 SDK 包装层中的主产品
感知调整为 DeepSeekX，同时保留 Codex 内核、协议和兼容入口，
降低后续与上游 Codex 版本对齐时的冲突成本。

## Source Documents

- `docs/deepseek-api/integration/deepseekx-user-facing-surface.md`
- `docs/deepseek-api/integration/README.md`
- `_workplan/specs/workplan-artifact-boundary.content.spec.yaml`
- `_workplan/specs/workplan-roadmap.content.meta_spec.yaml`
- `_workplan/specs/workplan-work-breakdown.content.meta_spec.yaml`
- `_workplan/specs/workplan-work-package.content.meta_spec.yaml`

## Current Implementation

当前下游代码已经具备 DeepSeek provider 和 Chat Completions 适配能力，但
多数用户入口仍沿用 Codex 命名。CLI 主命令、帮助文案、TUI 文案、
配置目录、认证提示、npm 包名、Python 包名和 app-server SDK 包装层中
仍有 OpenAI Codex 或 Codex 感知。

已有集成决策要求采用外壳优先策略。内部 Rust crate、核心类型、
app-server v2 wire schema、测试夹具和上游协议名默认保留 Codex 命名。
用户可见入口、配置、安装包和 SDK 包装层逐步 DeepSeekX 化。

## Target Capability

用户从零安装并运行 DeepSeekX 时，默认感知应是 DeepSeekX：

- 主命令、帮助文本和安装产物使用 DeepSeekX。
- TUI 首页、输入框、状态卡和启动摘要展示 DeepSeekX。
- 默认 provider、模型和凭据提示面向 DeepSeek API。
- 配置目录优先使用 `DEEPSEEKX_HOME` 和 `~/.deepseekx`。
- 旧 `codex` 命令、`CODEX_HOME` 和 `~/.codex` 保持兼容路径。
- app-server v2 wire schema 不改名，由 SDK 包装层隐藏历史命名。

## Roadmap Phases

1. 建立 CLI 外壳：新增或调整 `deepseekx` launcher、帮助文案和 exec
   人类可读输出，同时保留 `codex` 兼容入口。
2. 改造 TUI 用户文案：集中产品 label，更新标题、placeholder、
   状态卡、approval 文案和必要 snapshot。
3. 调整默认 provider 与认证提示：DeepSeekX build 默认使用 DeepSeek
   provider，并把默认凭据说明切到 `DEEPSEEK_API_KEY`。
4. 增加配置 home 兼容层：支持 `DEEPSEEKX_HOME`、`~/.deepseekx` 和
   legacy Codex 路径读取，不静默迁移 secret。
5. 改造打包产物：npm、平台包、nightly artifact、安装脚本和主 binary
   命名使用 DeepSeekX，保留 `codex` alias。
6. 建立 SDK 和 app-server 包装层：SDK 默认寻找 `deepseekx` binary，
   文档和 examples 使用 DeepSeekX，v2 wire schema 保持兼容。
7. 做兼容验收：覆盖新入口、legacy 入口、配置路径、默认 provider、
   app-server 启动和 release artifact 命名。

## Quality Gates

- 新增和修改文档遵守 88 字符行宽。
- 每个阶段只修改一个主要用户感知面。
- Rust 修改后在 `codex-rs` 运行 `just fmt`。
- TUI 文案改动必须运行 `cargo test -p codex-tui` 并审查 snapshot。
- 配置 schema 改动必须运行 `just write-config-schema`。
- app-server 协议形状改动必须运行 `just write-app-server-schema`。
- 打包和 SDK 改动必须运行对应 package 的最小构建或测试。
- 不执行全仓库 `codex -> deepseekx` 字符串替换。

## Risks

- TUI snapshot、CLI help 和安装包命名会产生较大 diff，混在一个
  提交中会降低 review 质量。
- 配置目录迁移可能涉及 token、history、sessions、plugins、skills 和
  themes，必须避免静默复制或删除用户数据。
- 包名和 SDK import 名是公开 API，改造会影响安装、测试和发布
  流水线。
- app-server v2 wire schema 若直接改名，会破坏已发布客户端兼容。

## Residual Risks

首轮完成后，内部 crate、测试 helper、telemetry key 和 v2 schema 中
仍会保留 Codex 命名。这是上游对齐成本控制的一部分，不应视为
用户感知面未完成，除非这些名称直接暴露给最终用户。
