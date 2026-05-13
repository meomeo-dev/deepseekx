---
name: we:deepseekx-bug-fix
description: Diagnose and fix DeepSeekX bugs from a clean worktree with
  dedicated fix branches, reproducible failures, focused tests, and commit
  hygiene before merging back to deepseekx/main.
---

# DeepSeekX Bug Fix

## 适用范围

用于修复已经存在的错误（bug）、回归（regression）、测试失败、CI 失败、
崩溃、行为不符合预期，或用户明确说“修复错误”。

不要用该技能做普通新功能开发；新功能使用 `$we:deepseekx-feature-dev`。
不要用该技能同步上游；版本同步使用 `$we:deepseek-branch-sync`。

## 硬入口门禁

修复前必须先确认工作区干净：

```bash
.codex/skills/we/deepseekx-worktree-clean/scripts/preflight_worktree_clean.sh \
  --require-clean
```

如果门禁失败，停止当前修复流程，改用 `$we:deepseekx-worktree-clean`。
整理干净后，再重新开始本技能。

然后运行 bug fix 预检：

```bash
.codex/skills/we/deepseekx-bug-fix/scripts/preflight_bug_fix.sh
```

## 分支规则

- 独立 bug fix 使用 `deepseekx/fix-<bug-slug>`。
- 如果当前在 `deepseekx/main`，先创建 fix 分支。
- 如果当前在相关 feature 分支，只在用户确认该修复属于该分支时继续。
- 不在 `deepseekx/sync/*` 或 `deepseekx/nightly` 上修 bug。
- 不混入无关重构、新功能或上游同步。
- 不切换脏分支，不 stash/drop/reset/clean 用户改动。

创建分支：

```bash
git switch deepseekx/main
git switch -c deepseekx/fix-<bug-slug>
```

## 修复流程

1. 记录可复现现象：命令、日志、输入、期望行为和实际行为。
2. 找到最小相关代码路径，不扩大改动范围。
3. 能写失败测试时，先补失败测试或回归测试。
4. 实施最小修复，保留现有行为边界。
5. 运行针对 touched area 的最小有效检查。
6. 如果涉及 Rust，遵守项目 `AGENTS.md` 的 fmt、test、fix 顺序。
7. 提交前确认暂存区没有 secrets、scratch 文件或无关用户改动。

## 验证

优先运行能证明 bug 已修复的最小命令。常见顺序：

```bash
git status --short
cargo test -p <crate> <test-name>
cargo test -p <crate>
```

如果改了 `codex-rs` Rust 代码，完成后运行：

```bash
cd codex-rs
just fmt
just fix -p <crate>
```

不要为了小 bug 默认跑全量测试。只有改动 common、core、protocol 等共享
面较大时，才建议全量测试，并先向用户说明成本。

## 提交卫生

提交前运行：

```bash
git status --short
git diff --cached --name-only
```

确认：

- 只暂存 bug fix 相关文件。
- 没有 `.env`、key、token、secret、证书或本地凭据。
- 测试、fixture、schema 或 snapshot 的变更是有意的。
- `DEEPSEEK_API_KEY.env` 等密钥文件被 ignore 或保持未暂存。

## 最终回复

汇报：

- 当前分支。
- bug 现象和根因。
- 修复文件。
- 测试或检查结果。
- commit hash，如果已提交。
- 剩余 dirty 或 untracked 文件。
