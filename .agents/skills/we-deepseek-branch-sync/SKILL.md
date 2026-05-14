---
name: we-deepseek-branch-sync
description: Use when synchronizing deepseekx/main with an explicit upstream
  openai/codex release tag or commit through a version-aligned sync branch.
---

# we-deepseek-branch-sync

用于维护 DeepSeekX 下游主干（downstream trunk）与上游 OpenAI Codex
版本的同步。目标是版本对齐（version-aligned sync），不是追随任意
`upstream/main` 最新提交。

## 分支模型

- `origin`：`https://github.com/meomeo-dev/deepseekx.git`。
- `upstream`：`https://github.com/openai/codex.git`。
- 下游主干：`deepseekx/main`。
- 同步分支：`deepseekx/sync/<version>`。
- 普通功能分支：`deepseekx/<slug>`。
- 推荐从明确上游 release tag 或 commit 同步，例如 `rust-v0.131.0`。
- 不静默使用 `upstream/main` 作为同步源。
- 不在 sync 分支上开发普通 DeepSeekX feature。

## 安全规则

- 不使用 `git reset --hard`、`git checkout --`、`git clean` 或 force push。
- 不在 dirty worktree 上切分支或合并，除非用户明确批准。
- 不 stash、drop、删除分支或推送 tag，除非用户明确要求。
- 出现冲突时先报告 conflicted files；只有用户要求解决时才继续。
- 合并、push、PR、tag 和清理 sync 分支都需要用户确认。

## Preflight

执行任何 fetch、merge 或 branch 操作前运行：

```bash
.agents/skills/we-deepseek-branch-sync/scripts/preflight_branch_sync.sh \
  deepseekx/main rust-v0.131.0
```

检查：

- 当前分支和 dirty 状态。
- `origin` 和 `upstream` 是否匹配预期。
- 目标下游主干是否存在。
- 指定 upstream ref 是否本地存在或能在 upstream 找到。
- target 与 upstream ref 的 ahead/behind 和 merge base。
- secret-like untracked paths。

## 同步流程

用户明确指定 upstream ref 后：

```bash
version=rust-v0.131.0
sync_branch=deepseekx/sync/$version

git fetch origin deepseekx/main
git fetch upstream tag "$version"
git switch -c "$sync_branch" origin/deepseekx/main
git merge --no-ff "$version"
```

如果使用 commit SHA：

```bash
upstream_ref=<sha>
sync_branch=deepseekx/sync/${upstream_ref:0:12}

git fetch origin deepseekx/main
git fetch upstream "$upstream_ref"
git switch -c "$sync_branch" origin/deepseekx/main
git merge --no-ff "$upstream_ref"
```

合并后按触达范围运行测试。Rust 变更遵守 `codex-rs` 的 `just fmt`、
focused `cargo test -p <crate>` 和 `just fix -p <crate>` 规则。

## 集成回 deepseekx/main

同步分支通过检查后，由用户选择：

- 本地合并到 `deepseekx/main`。
- 推送 sync 分支并创建 PR，base 为 `deepseekx/main`。

PR 路径：

```bash
git push -u origin deepseekx/sync/<version>
gh pr create --base deepseekx/main --head deepseekx/sync/<version>
```

本地合并路径：

```bash
git switch deepseekx/main
git merge --no-ff deepseekx/sync/<version>
```

## Final Response

报告：

- upstream ref 和 sync branch。
- preflight 结果。
- merge 是否完成、是否有冲突。
- 运行过的检查命令和结果。
- 是否 push、PR、合并或 tag。
- 需要用户确认的下一步。
- 保留的 dirty 或 untracked files。
