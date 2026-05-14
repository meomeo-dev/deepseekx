# 00 CLI Launcher 和帮助文案

## Metadata

- id: `00-cli-launcher-help`
- status: `planned`
- source: `2026-05-14-deepseekx-user-facing-surface-work-breakdown.yaml`
- depends_on: none
- owner: DeepSeekX

## Objective

提供 `deepseekx` 主命令，使 CLI 帮助、usage、登录提示和 exec
人类可读输出默认展示 DeepSeekX，同时保留 `codex` 兼容入口。

## Functional Scope

In scope:

- 新增或调整 `deepseekx` binary、launcher 或安装别名。
- 调整 clap `bin_name`、usage、帮助文本和登录提示。
- 调整 `codex exec` 人类可读启动摘要中的产品名。
- 保留 `codex` 作为兼容命令或 alias。

Out of scope:

- TUI snapshot 和 UI 文案。
- npm、平台包和 nightly artifact 命名。
- Rust crate 或 workspace package 系统性重命名。

## Non-Functional Requirements

- 不破坏现有 `codex` 命令脚本兼容。
- 产品名应集中到边界层常量或等价机制。
- 变更必须局限于 CLI 外壳和用户可见输出。

## Quality Standards

- Rust 修改后在 `codex-rs` 运行 `just fmt`。
- 运行 CLI 或 exec 相关最小测试。
- 手动或测试验证 `deepseekx --help` 和 `codex --help`。
- 新增行遵守 88 字符限制。

## Subplan

1. 定位 CLI binary、launcher、clap bin name 和 help 文案来源。
2. 设计 `deepseekx` 主入口与 `codex` 兼容入口的共存方式。
3. 调整 CLI 帮助、login 提示和 exec 启动摘要。
4. 增加或更新相关测试。
5. 运行 package 质量门禁并记录证据。

## Audit-Evaluate-Optimize Loop

- Audit：确认未触及 TUI、打包和配置 home 兼容层。
- Evaluate：运行 CLI 相关测试和 help 手动验证。
- Optimize：修复帮助文本、alias 行为或测试失败。

## Definition Of Done

- `deepseekx --help` 把主产品展示为 DeepSeekX。
- `codex --help` 仍可作为 legacy 入口工作。
- exec 人类可读输出不再把 DeepSeekX build 主产品描述为 OpenAI Codex。
- 相关测试和格式检查通过，或记录阻塞原因。

## Completion Evidence

- Package `00-cli-launcher-help` not started.
