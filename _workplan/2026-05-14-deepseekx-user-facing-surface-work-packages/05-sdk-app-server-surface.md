# 05 SDK 与 App Server 用户感知

## Metadata

- id: `05-sdk-app-server-surface`
- status: `completed`
- source: `2026-05-14-deepseekx-user-facing-surface-work-breakdown.yaml`
- depends_on: `00-cli-launcher-help`
- owner: DeepSeekX

## Objective

在 SDK 包装层和 app-server 启动入口展示 DeepSeekX，同时保持 app-server
v2 JSON-RPC method、payload 字段、schema 类型和兼容 header 不改名。

## Functional Scope

In scope:

- SDK package surface、README、examples 和默认 binary lookup。
- app-server 启动命令、`client_info.name` 和 `title` 默认值。
- 用户可见错误和启动提示。
- 如需新增 header，应与 legacy `x-codex-*` 双写。

Out of scope:

- app-server v2 method 名、payload 字段和 schema 类型改名。
- `codexErrorInfo` 等已发布 wire 字段改名。
- Python 或 TypeScript 内部生成类型系统性重命名。

## Non-Functional Requirements

- v2 协议兼容性优先于品牌纯度。
- DeepSeekX SDK 应隐藏历史 Codex wire 名称，而不是破坏协议。
- binary lookup 只允许 `deepseekx`，不能回退 legacy `codex`。

## Quality Standards

- app-server 协议形状改动必须运行 schema 生成和协议测试。
- SDK 改动必须运行对应 package 的最小测试或构建。
- 手动验证 app-server 启动命令和 SDK binary lookup。
- 新增行遵守 88 字符限制。

## Subplan

1. 定位 SDK 包装层、examples、binary lookup 和 app-server 启动入口。
2. 设计 DeepSeekX SDK 表面与 v2 wire schema 兼容边界。
3. 调整用户可见文案、默认 `client_info` 和 lookup 顺序。
4. 如需新增 header，采用 DeepSeekX 与 legacy wire header 双写。
5. 运行 package 质量门禁并记录证据。

## Audit-Evaluate-Optimize Loop

- Audit：确认未重命名 v2 wire schema 和 JSON-RPC method。
- Evaluate：运行 SDK 和 app-server 相关最小检查。
- Optimize：修复 binary lookup、示例和兼容 header 问题。

## Definition Of Done

- SDK 面向用户的包表面和 examples 使用 DeepSeekX。
- app-server 启动入口和默认 client info 展示 DeepSeekX。
- SDK 不会拉起用户已安装的原版 `codex`。
- v2 wire schema 兼容性不被破坏。
- 相关测试和构建检查通过，或记录阻塞原因。

## Completion Evidence

- Completed in current branch.
- Evidence files:
  - `sdk/typescript/src/exec.ts`
  - `sdk/typescript/package.json`
  - `sdk/typescript/samples/*`
  - `sdk/python/src/deepseekx/*`
  - `sdk/python-runtime/src/deepseekx_cli_bin/__init__.py`
  - `sdk/python/scripts/update_sdk_artifacts.py`
  - `codex-rs/app-server/src/request_processors/initialize_processor.rs`
  - `codex-rs/app-server/README.md`
- TypeScript SDK drops inherited `CODEX_*` environment variables by default and
  only resolves `deepseekx` from `@meomeo/deepseekx` optional dependencies.
- Python SDK uses `deepseekx` and `deepseekx-cli-bin`; user examples use
  `DeepSeekX`, `deepseekx`, and `deepseek-v4-pro`.
- App-server docs use `deepseekx app-server` and describe `codexHome` as a
  legacy v2 wire field interpreted as `DEEPSEEKX_HOME` in DeepSeekX builds.
- Focused check passed earlier: `cargo test -p codex-app-server
  external_agent_config`.
