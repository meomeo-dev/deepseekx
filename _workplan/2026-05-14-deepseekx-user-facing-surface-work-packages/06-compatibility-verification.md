# 06 兼容验收和回归验证

## Metadata

- id: `06-compatibility-verification`
- status: `completed`
- source: `2026-05-14-deepseekx-user-facing-surface-work-breakdown.yaml`
- depends_on: all prior packages
- owner: DeepSeekX

## Objective

建立 DeepSeekX 新入口和原版 OpenAI Codex 并存隔离的最终验收矩阵，
确认用户感知面已切换且不会抢占或读取原版 Codex 环境。

## Functional Scope

In scope:

- `deepseekx --help` 和 exec smoke 验证。
- 发行物不包含 `codex` 用户入口验证。
- TUI snapshot、配置 home、默认 provider 和 API key 提示验证。
- app-server 启动、SDK binary lookup 和 legacy wire schema 验证。
- packaging artifact 名称和 alias 验证。

Out of scope:

- 真实发布到 npm、PyPI 或 GitHub release。
- 签名、notarization 和正式发版验收。
- 上游 Codex 版本同步。

## Non-Functional Requirements

- 验收矩阵必须覆盖 DeepSeekX 入口和原版 Codex 隔离。
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
3. 验证 `codex` 入口不由 DeepSeekX 提供，`CODEX_HOME` 不被读取。
4. 标记仍保留 Codex 内部命名的有意边界。
5. 更新 Completion Evidence 和最终风险记录。

## Audit-Evaluate-Optimize Loop

- Audit：确认验收矩阵覆盖所有用户可见面。
- Evaluate：执行 smoke 检查并审查失败项。
- Optimize：把失败项路由回对应 package 或记录延期理由。

## Definition Of Done

- DeepSeekX 新入口通过验收矩阵。
- DeepSeekX 不安装 `codex`，不读取 `CODEX_HOME` 或 `~/.codex`。
- 保留 Codex 内部命名的边界与集成文档一致。
- 所有质量门禁通过，或有明确阻塞记录。

## Completion Evidence

- Completed in current branch.
- Verification commands run:
  - precise runtime entrypoint scan for `codex` binary fallbacks.
  - precise `CODEX_*` environment scan.
  - `python3 -m py_compile sdk/python/scripts/update_sdk_artifacts.py`.
  - `just write-app-server-schema`.
  - `git diff --check -- . ':(exclude)*.snap'` passed earlier.
- Entry-point scan only found historical checklist text in the integration doc.
- `CODEX_*` scan only found TypeScript SDK drop-list/tests and internal
  compatibility constants whose runtime values now point to DeepSeekX env vars.
- CLI argv0 guard rejects accidental `codex` / `codex.exe` invocation and tells
  the user to run `deepseekx`.
- Local source-built entrypoint was audited with
  `cargo run -p codex-cli --bin deepseekx -- --version`; it runs and reports
  `DeepSeekX <version>`.
- Disabled `deepseekx cloud --help` no longer exposes Codex Cloud task
  subcommands.
- `deepseekx login`, `deepseekx logout`, and `deepseekx app` are hidden from
  root help and are disabled placeholders. They do not expose ChatGPT login,
  device auth, access token login, Codex Cloud, or Codex Desktop behavior.
- Focused checks passed:
  - `cargo test -p codex-cli rejects_legacy_codex_argv0_names`
  - `cargo test -p codex-cli --bin deepseekx root_version_uses_deepseekx_product_name`
  - `cargo test -p codex-cli --bin deepseekx cloud_help_is_disabled_without_codex_cloud_subcommands`
  - `cargo test -p codex-cli --bin deepseekx root_help_hides_unsupported_deepseekx_services`
  - `cargo test -p codex-cli --bin deepseekx unsupported_deepseekx_service_help_is_disabled`
  - `cargo test -p codex-mcp mcp_init_error_display_prompts_for_login_when_auth_required`
- Full `git diff --check` still reports expected terminal snapshot trailing
  spaces in five TUI `.snap` files unless `.snap` files are excluded.
- `git diff --check -- . ':(exclude)*.snap'` currently passes.
- `find codex-rs -name '*.snap.new' -print` currently finds no pending
  snapshot files.
- `deepseekx app` is hidden/blocked because this repo does not contain a
  DeepSeekX Desktop/App release path; it does not open or install OpenAI Codex
  Desktop.
- `deepseekx cloud` is hidden/blocked and does not connect to OpenAI-hosted
  Codex Cloud task services.
- Known release blocker: `sdk/python/uv.lock` still references
  `openai-codex-cli-bin` until `deepseekx-cli-bin` is published or provided as
  a resolvable development source.
- Known local tooling blocker: `just fmt` reaches Python SDK `uv` dependency
  resolution and fails until `deepseekx-cli-bin==0.131.0a4` is resolvable.
