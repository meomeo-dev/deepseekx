---
name: we:deepseekx-worktree-clean
description: Inspect and clean DeepSeekX branch and worktree state before
  upstream sync, bug fixes, or feature development, including merge readiness,
  staged changes, untracked files, and gitignore hygiene.
---

# DeepSeekX Worktree Clean

## 适用范围

用于开始高风险或新任务前整理当前仓库状态：

- 同步上游版本（upstream version sync）前。
- 修复错误（bug fix）前。
- 开发新功能（feature development）前。
- 切换分支、合并当前分支、或准备提交前。

该技能负责把工作区整理到可判断、可继续的状态。不要用它实现功能、
修复业务错误，或同步上游代码。

需要提交、推送、PR、合并或删除分支时，整理完成后路由到
`$we:deepseekx-github-flow`。

## 角色契约

- 用户是发起者（user as initiator）。
- AI/LLM 是执行者（LLM as executor）。
- 用户决定未知文件归属、是否提交、是否合并、是否删除分支。
- 执行者负责只读检查、分类建议、维护 ignore 规则和安全整理。
- 用户只说“看下”“是否需要”“检查状态”时，默认只做诊断。

## 硬性边界

- 不运行 `git reset --hard`、`git checkout --`、`git clean`。
- 不自动 stash、drop、删除文件、切换脏分支或 force push。
- 不暂存 `.env`、key、token、secret、证书或本地凭据。
- 不把未知文件当成可删除垃圾。无法判断时先问用户。
- 只在用户确认后提交、合并、删除分支或修改本地 exclude。

## 预检

先运行只读预检：

```bash
.codex/skills/we/deepseekx-worktree-clean/scripts/preflight_worktree_clean.sh
```

如果其它技能需要强制清洁门禁，使用：

```bash
.codex/skills/we/deepseekx-worktree-clean/scripts/preflight_worktree_clean.sh \
  --require-clean
```

检查输出：

- 当前分支。
- 当前分支是否有未合入 `deepseekx/main` 的提交。
- 当前分支与 upstream tracking branch 的 ahead/behind。
- staged、unstaged、untracked 文件。
- 未忽略的 secret-like 文件。
- 已被 ignore 的 secret-like 文件。
- 是否需要维护 `.gitignore` 或 `.git/info/exclude`。

## 路由规则

- `clean=true`：可以回到原技能继续。
- 有 staged 或 unstaged tracked 文件：先判断是否属于当前任务。
- 有当前任务改动：运行必要检查，然后暂存并提交。
- 有用户改动或不明改动：停止并询问，不要替用户归类。
- 有未跟踪源码、测试、文档：判断是否应纳入提交。
- 有未跟踪生成物：加入 `.gitignore` 或 `.git/info/exclude`。
- 有未跟踪密钥：维护 ignore 规则，不要暂存。
- 当前分支有未合入 `deepseekx/main` 的提交：先决定合并、PR、
  保留分支，或继续在该分支工作；需要集成时路由到
  `$we:deepseekx-github-flow`。
- 当前分支已经合入且工作区干净：可在用户确认后删除已合并分支。

## Gitignore 决策

优先使用项目级 `.gitignore`：

- 所有人都不应提交的密钥文件模式。
- 构建产物、缓存、日志、临时目录。
- 工具稳定生成且不需要 review 的文件。

优先使用 `.git/info/exclude`：

- 只属于当前开发者机器的路径。
- 一次性实验目录。
- 不应影响团队或 CI 的个人配置。

不要忽略正常源码、测试、文档、fixtures、锁文件或 schema 文件，除非
项目已有明确规则。

## 整理流程

1. 运行预检并阅读全部分类。
2. 若当前分支有待合并提交，先用 `$we:deepseekx-github-flow` 判断。
3. 若 tracked 文件脏，检查 diff，确认属于当前任务后再提交。
4. 若 untracked 文件是源码、测试或文档，确认意图后再纳入提交。
5. 若 untracked 文件是密钥或生成物，维护 ignore 规则。
6. 重新运行 `git status --short --branch`。
7. 工作区干净后，再回到原来的同步、修复或功能开发技能。

## 最终回复

汇报：

- 当前分支。
- 是否 clean。
- 当前分支是否需要合并或 PR。
- 已提交、已忽略、仍需用户判断的文件。
- 是否修改 `.gitignore` 或 `.git/info/exclude`。
- 是否需要转入 `$we:deepseekx-github-flow`。
- 剩余 dirty 或 untracked 文件。
