# 01 TUI 品牌文案和 Snapshot

## Metadata

- id: `01-tui-branding-snapshots`
- status: `completed`
- source: `2026-05-14-deepseekx-user-facing-surface-work-breakdown.yaml`
- depends_on: `00-cli-launcher-help`
- owner: DeepSeekX

## Objective

让 TUI 首页、输入框、状态卡、approval overlay 和常用提示文案展示
DeepSeekX，并更新对应 snapshot。

## Functional Scope

In scope:

- TUI session header、status card 和输入 placeholder。
- approval overlay、debug key inspection 和 tooltip 中的产品名。
- 相关 `insta` snapshot 更新。
- 新 UI 文案从集中 product label 或等价边界层取值。

Out of scope:

- CLI launcher 和 help 文案。
- 配置目录、provider 默认值和认证提示。
- 内部 TUI 类型、事件名和测试 helper 系统性重命名。

## Non-Functional Requirements

- 不为了换皮重命名 `CodexStatus` 等内部类型。
- snapshot 变更必须可 review，避免混入非 TUI 改动。
- UI 文案应短、稳定，并符合现有 TUI 风格。

## Quality Standards

- Rust 修改后在 `codex-rs` 运行 `just fmt`。
- 运行 `cargo test -p codex-tui`。
- 审查并接受有意的 `insta` snapshot。
- 新增行遵守 88 字符限制。

## Subplan

1. 定位 TUI 中直接暴露给用户的 Codex 文案。
2. 引入或复用产品 label 常量。
3. 更新 TUI 文案和相关测试输入。
4. 运行 `cargo test -p codex-tui` 生成 snapshot。
5. 审查 snapshot diff，只接受预期品牌变化。

## Audit-Evaluate-Optimize Loop

- Audit：确认未做内部类型重命名或协议改名。
- Evaluate：运行 TUI 测试并审查 snapshot。
- Optimize：收窄文案 diff，避免无关快照变化。

## Definition Of Done

- TUI 常见入口把主产品展示为 DeepSeekX。
- 有意的 snapshot 已审查并接受。
- `cargo test -p codex-tui` 通过，或记录阻塞原因。

## Completion Evidence

- Completed in current branch.
- Evidence files:
  - `codex-rs/tui/src/history_cell.rs`
  - `codex-rs/tui/src/status/card.rs`
  - `codex-rs/tui/src/bottom_pane/mod.rs`
  - `codex-rs/tui/src/bottom_pane/chat_composer.rs`
  - `codex-rs/tui/src/bottom_pane/approval_overlay.rs`
  - `codex-rs/tui/src/ide_context/ipc.rs`
  - `codex-rs/tui/src/pets/catalog.rs`
  - `codex-rs/tui/src/pets/picker.rs`
  - TUI snapshot files under `codex-rs/tui/src/**/snapshots`.
- `INSTA_UPDATE=always CARGO_BUILD_JOBS=4 cargo test -p codex-tui` passed:
  2497 lib tests passed, 1 ignored; integration tests passed with 4 ignored.
