# DeepSeekX 用户感知面 Work Packages

## Purpose

本目录将 DeepSeekX 用户感知面和原版 Codex 隔离改造拆分为
可独立审查的工作包。
执行时一次只推进一个 package。发生上下文压缩后，先阅读本
README、work breakdown 和目标 package，再继续执行。

## Source Of Truth

- `_workplan/2026-05-14-deepseekx-user-facing-surface-roadmap.md`
- `_workplan/2026-05-14-deepseekx-user-facing-surface-work-breakdown.yaml`
- `docs/deepseek-api/integration/deepseekx-user-facing-surface.md`
- `docs/deepseek-api/integration/README.md`

## Execution Order

1. `00-cli-launcher-help`
2. `01-tui-branding-snapshots`
3. `02-default-provider-auth`
4. `03-config-home-isolation`
5. `04-packaging-artifacts`
6. `05-sdk-app-server-surface`
7. `06-compatibility-verification`

## Dependency Graph

- `00-cli-launcher-help` has no package dependency.
- `01-tui-branding-snapshots` depends on `00-cli-launcher-help`.
- `02-default-provider-auth` depends on `00-cli-launcher-help`.
- `03-config-home-isolation` depends on `02-default-provider-auth`.
- `04-packaging-artifacts` depends on `00-cli-launcher-help`.
- `05-sdk-app-server-surface` depends on `00-cli-launcher-help`.
- `06-compatibility-verification` depends on all prior packages.

## Global Quality Gates

- 行宽检查：`awk 'length($0)>88{print FILENAME ":" FNR ":" $0}' ...`
- 文档和代码变更必须通过 `git diff --check`。
- Rust 修改后在 `codex-rs` 运行 `just fmt`。
- TUI 文案改动必须运行 `cargo test -p codex-tui`。
- 配置 schema 改动必须运行 `just write-config-schema`。
- app-server 协议形状改动必须运行 schema 生成和协议测试。
- 每个 package 的 Completion Evidence 必须更新。

## Review Loop

每个 package 完成后执行：

1. 审计：确认只改 package 声明范围内的文件。
2. 评估：运行该 package 要求的最小质量门禁。
3. 优化：修复发现的问题，避免扩大到下一个感知面。
4. 记录：更新 package Completion Evidence。

## Status

- `00-cli-launcher-help`: completed
- `01-tui-branding-snapshots`: completed
- `02-default-provider-auth`: completed
- `03-config-home-isolation`: completed
- `04-packaging-artifacts`: completed
- `05-sdk-app-server-surface`: completed
- `06-compatibility-verification`: completed
