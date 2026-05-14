# 04 打包产物和发布命名

## Metadata

- id: `04-packaging-artifacts`
- status: `planned`
- source: `2026-05-14-deepseekx-user-facing-surface-work-breakdown.yaml`
- depends_on: `00-cli-launcher-help`
- owner: DeepSeekX

## Objective

让 npm 包、平台包、nightly artifacts、安装脚本和主可执行文件使用
DeepSeekX 命名，并保留 `codex` alias 作为兼容入口。

## Functional Scope

In scope:

- npm 主包和 optional platform package 命名。
- `bin` 字段、平台 binary 选择和安装脚本。
- nightly artifacts、workflow artifact 和压缩包命名。
- macOS、Windows 和 universal artifact 名称策略。

Out of scope:

- 正式签名、notarization、release tag 和发布公告。
- SDK import 名改造。
- CLI 帮助文本和 TUI 文案。

## Non-Functional Requirements

- 平台包矩阵必须保持可追踪，不能丢失 legacy alias。
- workflow 必须支持单平台重跑和全量手动触发。
- 包名变化需要清楚隔离，避免影响上游同步补丁面。

## Quality Standards

- package metadata 变更后运行对应 npm 或脚本最小检查。
- workflow YAML 需要通过语法和 diff 检查。
- 六平台 artifact 命名必须可从 workflow 输出中审查。
- 新增行遵守 88 字符限制。

## Subplan

1. 定位 npm package、platform package、binary wrapper 和 workflow 命名。
2. 设计 DeepSeekX 包名、平台包名和 legacy alias 策略。
3. 调整 build scripts、package metadata 和 artifact 名称。
4. 验证单平台 nightly 构建命令和全量手动触发路径。
5. 记录未执行真实发布的边界。

## Audit-Evaluate-Optimize Loop

- Audit：确认未触发真实发布、tag 或签名流程。
- Evaluate：检查 package metadata、workflow 语法和 artifact 名称。
- Optimize：修复平台矩阵、alias 和安装脚本问题。

## Definition Of Done

- DeepSeekX 安装产物和 nightly artifacts 使用 DeepSeekX 命名。
- 平台包仍能解析到正确 binary。
- `codex` alias 兼容入口被保留或明确记录。
- package 和 workflow 检查通过，或记录阻塞原因。

## Completion Evidence

- Package `04-packaging-artifacts` not started.
