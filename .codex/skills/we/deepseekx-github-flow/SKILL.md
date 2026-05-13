---
name: we:deepseekx-github-flow
description: Use when deciding or executing DeepSeekX commit, push, PR,
  merge, branch cleanup, or self-review steps under a user-initiated
  GitHub Flow contract.
---

# DeepSeekX GitHub Flow

## 适用范围

用于 DeepSeekX 的 GitHub Flow（GitHub 工作流）收口动作：

- 提交（commit）。
- 推送（push）。
- 创建或更新 PR（pull request）。
- 自我审查（self-review）。
- 合并到 `deepseekx/main`。
- 删除已合并分支。
- 判断当前分支是否可以进入下一步。

不要用该技能实现功能、修 bug、同步上游版本或触发 nightly。它只负责
任务收尾、分支集成和角色边界。

## 角色契约

- 发起者是用户（user）。
- 执行者是 AI/LLM。
- 用户决定任务目标、是否进入提交、是否推送、是否开 PR、是否合并、
  是否删分支、是否触发 CI 或构建。
- 执行者可以运行只读检查、总结状态、建议下一步，并在用户明确请求后
  执行对应 git 或 `gh` 命令。
- 合并到 `deepseekx/main`、推送 `deepseekx/main`、创建 tag、删分支、
  触发付费 CI，均需要用户明确确认。
- 用户只说“看下”“检查”“是否需要”时，默认是咨询，不是执行指令。

## 分支模型

- `deepseekx/main`：稳定下游主干，等于已同步 Codex 版本加 DeepSeekX
  自有补丁。
- `deepseekx/<feature-slug>`：普通功能分支。
- `deepseekx/fix-<bug-slug>`：错误修复分支。
- `deepseekx/sync/<version>`：上游版本同步分支。
- `deepseekx/nightly`：手动 nightly artifact 构建分支。

普通功能和 bug 修复不直接在 `deepseekx/main` 上开发。同步上游必须先走
`deepseekx/sync/<version>`，再决定 PR 或本地合并到 `deepseekx/main`。

## 硬入口门禁

先运行只读预检：

```bash
.codex/skills/we/deepseekx-github-flow/scripts/preflight_github_flow.sh
```

如要判断特定动作：

```bash
.codex/skills/we/deepseekx-github-flow/scripts/preflight_github_flow.sh \
  --intent commit
```

可用 intent：

```text
status
commit
push
pr
merge
cleanup
```

若预检显示 dirty、untracked、secret-like 文件或分支关系不明，先使用
`$we:deepseekx-worktree-clean`。整理干净后再回到本技能。

## 动作门槛

提交（commit）的门槛：

- 当前 diff 只属于一个逻辑闭环（coherent change）。
- 已运行与改动范围匹配的格式化、测试或静态检查。
- 暂存区只包含本任务文件。
- 没有 `.env`、key、token、secret、证书或本地凭据。
- commit message 能说明目的，而不是只描述机械动作。

推送（push）的门槛：

- 本地提交已经完成。
- 当前分支不是 `deepseekx/main`，除非用户明确要求推送主干。
- tracking branch 明确，或用户确认创建远端分支。
- 没有未提交的相关改动。

PR 的门槛：

- 分支任务达到可审查状态。
- base 是 `deepseekx/main`，不是 `upstream/main`。
- PR 描述包含变更范围、验证命令、风险和未做事项。
- 高风险同步、release/nightly 相关变更优先使用 PR。

合并（merge）的门槛：

- 用户明确要求或确认合并。
- CI 已通过，或用户确认采用本地 self-review 代替。
- 没有未解决冲突或未处理 review comment。
- 分支没有混入无关任务。
- 合并后 `deepseekx/main` 仍应可运行、可继续开发。

删除分支的门槛：

- 分支已合入 `deepseekx/main` 或用户确认不再需要。
- 工作区干净。
- 不删除当前所在分支。
- 远端分支删除需要用户明确确认。

## 推荐流程

1. 运行 `preflight_github_flow.sh`。
2. 若工作区不干净，路由到 `$we:deepseekx-worktree-clean`。
3. 若需要提交，检查 diff、运行验证、暂存目标文件并提交。
4. 若需要 PR，推送分支并创建 PR。
5. 若用户选择本地 self-review，先展示 diff 摘要和验证结果。
6. 用户确认后，才合并到 `deepseekx/main`。
7. 合并后再次运行状态检查。
8. 用户确认后，才删除本地或远端已合并分支。

## 自动化边界

适合自动化：

- 只读预检。
- 格式化、测试、lint、secret scan。
- PR body 模板和检查结果汇总。
- 在用户确认后的 push、PR 创建、merge、branch cleanup。

不自动化：

- 判断任务是否真正完成。
- 把未知本地改动自动提交。
- 合并范围不清的分支。
- 未经用户确认推送主干、创建 tag、删远端分支或触发付费 CI。

## 常用命令

提交前：

```bash
git status --short --branch
git diff --cached --name-only
git diff --stat
```

创建 PR：

```bash
git push -u origin <current-branch>
gh pr create --base deepseekx/main --head <current-branch>
```

本地合并前：

```bash
git switch deepseekx/main
git merge --no-ff <current-branch>
```

删除已合并本地分支：

```bash
git branch -d <current-branch>
```

## 最终回复

汇报：

- 当前分支和 tracking 状态。
- 工作区是否干净。
- 当前 intent 的结论。
- 已执行的 commit、push、PR、merge 或 cleanup。
- 需要用户确认的下一步。
- 剩余 dirty 或 untracked 文件。
