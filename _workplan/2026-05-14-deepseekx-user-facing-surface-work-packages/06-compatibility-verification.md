# 06 兼容验收和回归验证

## Metadata

- id: `06-compatibility-verification`
- status: `planned`
- source: `2026-05-14-deepseekx-user-facing-surface-work-breakdown.yaml`
- depends_on: all prior packages
- owner: DeepSeekX

## Objective

建立 DeepSeekX 新入口和 Codex legacy 入口的最终验收矩阵，确认
用户感知面已切换且兼容边界仍可运行。

## Functional Scope

In scope:

- `deepseekx --help`、`codex --help` 和 exec smoke 验证。
- TUI snapshot、配置 home、默认 provider 和 API key 提示验证。
- app-server 启动、SDK binary lookup 和 legacy wire schema 验证。
- packaging artifact 名称和 alias 验证。

Out of scope:

- 真实发布到 npm、PyPI 或 GitHub release。
- 签名、notarization 和正式发版验收。
- 上游 Codex 版本同步。

## Non-Functional Requirements

- 验收矩阵必须覆盖新入口和 legacy 入口。
- 失败项必须记录为阻塞、延期或有意保留。
- 验证命令不得泄露 API key、token 或本地 secret。

## Quality Standards

- 运行各 package 声明的最终最小检查。
- 运行 `git diff --check`。
- 文档和证据行宽遵守 88 字符限制。
- Completion Evidence 记录文件、命令和结果。

## Subplan

1. 汇总前六个 package 的验收项。
2. 运行 CLI、TUI、配置、provider、SDK 和 packaging smoke 检查。
3. 对 legacy `codex` 入口和 `CODEX_HOME` 兼容路径做回归验证。
4. 标记仍保留 Codex 内部命名的有意边界。
5. 更新 Completion Evidence 和最终风险记录。

## Audit-Evaluate-Optimize Loop

- Audit：确认验收矩阵覆盖所有用户可见面。
- Evaluate：执行 smoke 检查并审查失败项。
- Optimize：把失败项路由回对应 package 或记录延期理由。

## Definition Of Done

- DeepSeekX 新入口通过验收矩阵。
- Codex legacy 入口仍可作为兼容路径运行。
- 保留 Codex 内部命名的边界与集成文档一致。
- 所有质量门禁通过，或有明确阻塞记录。

## Completion Evidence

- Package `06-compatibility-verification` not started.
