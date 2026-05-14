# 03 配置 Home 隔离层

## Metadata

- id: `03-config-home-isolation`
- status: `completed`
- source: `2026-05-14-deepseekx-user-facing-surface-work-breakdown.yaml`
- depends_on: `02-default-provider-auth`
- owner: DeepSeekX

## Objective

支持 `DEEPSEEKX_HOME` 和 `~/.deepseekx` 作为 DeepSeekX 配置根目录。
不读取 `CODEX_HOME` 或 `~/.codex`，避免污染用户原版 OpenAI Codex
配置和 secret。

## Functional Scope

In scope:

- 配置根目录解析优先级。
- 检测原版 Codex 路径时的显式迁移提示或诊断信息。
- 配置 schema、帮助文本和用户可见错误提示。

Out of scope:

- 自动复制 token、keyring、secret 或 auth 文件。
- 读取 `CODEX_HOME` 或 legacy `~/.codex`。
- 删除、重命名或清空 legacy `~/.codex`。
- plugins、skills 和 sessions 的复杂迁移工具。

## Non-Functional Requirements

- 不在日志中输出 token、API key 或 secret 路径内容。
- 路径解析必须可诊断、可测试、可回滚。
- 兼容优先级必须明确，避免同时存在多个目录时行为含糊。

## Quality Standards

- Rust 修改后在 `codex-rs` 运行 `just fmt`。
- 修改 config 类型时运行 `just write-config-schema`。
- 运行 home-dir、config 或 core 相关最小测试。
- 新增行遵守 88 字符限制。

## Subplan

1. 定位 `CODEX_HOME`、`~/.codex` 和配置路径解析逻辑。
2. 定义 `DEEPSEEKX_HOME` 和 `~/.deepseekx` 的隔离优先级。
3. 移除 DeepSeekX 对 `CODEX_HOME` 和 `~/.codex` 的读取路径。
4. 添加迁移提示或诊断，不静默迁移 secret。
5. 更新 schema、测试和 Completion Evidence。

## Audit-Evaluate-Optimize Loop

- Audit：确认未复制或删除 secret、auth 和原版 Codex 目录。
- Evaluate：覆盖新 env、新默认目录和原版 Codex 隔离。
- Optimize：修复路径优先级、错误提示和 schema drift。

## Definition Of Done

- `DEEPSEEKX_HOME` 是 DeepSeekX 唯一 home 环境变量。
- 默认配置目录为 `~/.deepseekx`。
- `CODEX_HOME` 和 `~/.codex` 不会被 DeepSeekX 读取。
- 不发生 secret 静默迁移。
- 相关测试和 schema 检查通过，或记录阻塞原因。

## Completion Evidence

- Completed in current branch.
- Evidence files:
  - `codex-rs/utils/home-dir/src/lib.rs`
  - `codex-rs/config/src/loader/mod.rs`
  - `codex-rs/core/config.schema.json`
  - `codex-rs/app-server-protocol/src/protocol/v2/config.rs`
  - generated app-server schema fixtures.
- `DEEPSEEKX_HOME` is the home environment variable and default home is
  `~/.deepseekx`.
- Project-local config uses `.deepseekx`; v2 keeps `dotCodexFolder` as a wire
  field name while descriptions now say `.deepseekx/`.
- `just write-config-schema` was run earlier for config schema drift.
- `just write-app-server-schema` passed after the app-server protocol
  description update.
