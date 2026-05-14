# 05 SDK 与 App Server 用户感知

## Metadata

- id: `05-sdk-app-server-surface`
- status: `planned`
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
- binary lookup 应优先 `deepseekx`，并可回退 legacy `codex`。

## Quality Standards

- app-server 协议形状改动必须运行 schema 生成和协议测试。
- SDK 改动必须运行对应 package 的最小测试或构建。
- 手动验证 app-server 启动命令和 SDK binary lookup。
- 新增行遵守 88 字符限制。

## Subplan

1. 定位 SDK 包装层、examples、binary lookup 和 app-server 启动入口。
2. 设计 DeepSeekX SDK 表面与 v2 wire schema 兼容边界。
3. 调整用户可见文案、默认 `client_info` 和 lookup 顺序。
4. 如需新增 header，采用 DeepSeekX 与 legacy Codex 双写。
5. 运行 package 质量门禁并记录证据。

## Audit-Evaluate-Optimize Loop

- Audit：确认未重命名 v2 wire schema 和 JSON-RPC method。
- Evaluate：运行 SDK 和 app-server 相关最小检查。
- Optimize：修复 binary lookup、示例和兼容 header 问题。

## Definition Of Done

- SDK 面向用户的包表面和 examples 使用 DeepSeekX。
- app-server 启动入口和默认 client info 展示 DeepSeekX。
- v2 wire schema 兼容性不被破坏。
- 相关测试和构建检查通过，或记录阻塞原因。

## Completion Evidence

- Package `05-sdk-app-server-surface` not started.
