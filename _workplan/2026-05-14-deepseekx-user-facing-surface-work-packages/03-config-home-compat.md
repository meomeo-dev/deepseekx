# 03 配置 Home 兼容层

## Metadata

- id: `03-config-home-compat`
- status: `planned`
- source: `2026-05-14-deepseekx-user-facing-surface-work-breakdown.yaml`
- depends_on: `02-default-provider-auth`
- owner: DeepSeekX

## Objective

支持 `DEEPSEEKX_HOME` 和 `~/.deepseekx` 作为 DeepSeekX 配置根目录，同时
兼容 `CODEX_HOME` 和 `~/.codex`，避免静默复制、移动或删除用户
secret。

## Functional Scope

In scope:

- 配置根目录解析优先级。
- legacy Codex 路径兼容读取。
- 首次运行迁移提示或诊断信息。
- 配置 schema、帮助文本和用户可见错误提示。

Out of scope:

- 自动复制 token、keyring、secret 或 auth 文件。
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
2. 定义 `DEEPSEEKX_HOME`、`CODEX_HOME` 和默认目录优先级。
3. 实现 DeepSeekX home 解析与 legacy 兼容读取。
4. 添加迁移提示或诊断，不静默迁移 secret。
5. 更新 schema、测试和 Completion Evidence。

## Audit-Evaluate-Optimize Loop

- Audit：确认未复制或删除 secret、auth 和 legacy 目录。
- Evaluate：覆盖新 env、legacy env、新默认目录和 legacy 默认目录。
- Optimize：修复路径优先级、错误提示和 schema drift。

## Definition Of Done

- `DEEPSEEKX_HOME` 优先于 legacy Codex home。
- 默认配置目录为 `~/.deepseekx`。
- legacy `CODEX_HOME` 和 `~/.codex` 仍可兼容使用。
- 不发生 secret 静默迁移。
- 相关测试和 schema 检查通过，或记录阻塞原因。

## Completion Evidence

- Package `03-config-home-compat` not started.
