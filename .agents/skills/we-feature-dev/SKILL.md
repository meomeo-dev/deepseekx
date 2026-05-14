---
name: we-feature-dev
description: Use when starting or continuing DeepSeekX feature development
  from deepseekx/main with branch preflight, scoped checks, and PR hygiene.
---

# we-feature-dev

用于 DeepSeekX 日常功能开发（feature development）、修复、重构、
文档和项目本地 workflow 变更。目标是在 LLM 会话无状态时，仍然先
管好分支、工作区、远端和提交边界。

## 范围

- 从 `deepseekx/main` 创建或继续 `deepseekx/<slug>` 分支。
- 普通开发最终面向 `deepseekx/main` 收口。
- 支持 DeepSeek 协议适配、DeepSeekX 外壳、Rust/TUI/CLI/package、
  docs 和 WE skill 变更。
- 需求边界不清时，先使用 `$we-requirement-intake`。
- 高风险或复杂方案改动前，先使用 `$we-design-note`。
- 不同步上游 OpenAI Codex 版本；版本同步使用 `$we-deepseek-branch-sync`。
- 不做 npm 发布；发布准备使用 `$we-release`，registry 发布使用
  `$we-publish`。

## 分支模型

- 私有工作区：`/Users/jin/projects/deepseekx`。
- `origin` 必须指向 `https://github.com/meomeo-dev/deepseekx.git`。
- `upstream` 应指向 `https://github.com/openai/codex.git`。
- 下游主干（downstream trunk）：`deepseekx/main`。
- 普通开发分支：`deepseekx/<slug>`。
- 上游同步分支：`deepseekx/sync/<version>`，不在本技能内维护。
- `origin/main` 和 `upstream/main` 是上游主线语义，不是本仓库开发主干。
- 公开仓库 `/Users/jin/projects/deepseekx-public` 不在本技能中修改。

## 硬入口门禁

开始读代码实现或编辑文件前，先运行：

```bash
.agents/skills/we-feature-dev/scripts/preflight_feature_dev.sh
```

检查并向用户说明：

- 当前分支。
- `origin`、`upstream` 是否符合预期。
- tracked dirty files、untracked files 和 secret-like untracked paths。
- 当前分支相对 `origin/deepseekx/main` 的 ahead/behind。
- 本地 `deepseekx/main` 相对当前分支的关系。
- 根维护包和 `codex-cli` 发布包关键事实。

如果只有安全的 skill 草稿或用户已明确的工作文件未跟踪，可以继续，
但必须说明不会误 stage 无关文件。

## 分支规则

- 不在 `deepseekx/main` 上直接做普通 feature 开发。
- 如果当前在 `deepseekx/main`，先创建 `deepseekx/<slug>`。
- 如果当前在 `deepseekx/<slug>`，preflight 通过后继续。
- 如果当前在 `deepseekx/sync/*`，停止并切到 `$we-deepseek-branch-sync`。
- 如果当前在 `main`、`origin/main` 派生分支或非 `deepseekx/*` 分支，
  停止并说明分支语义风险。
- 有 tracked dirty files 时，不切换分支，除非用户明确批准。
- 不自动 stash、reset、clean、drop、force push 或覆盖用户工作。
- slug 使用小写 kebab-case，来自需求核心名词。

从下游主干创建分支：

```bash
git switch deepseekx/main
git pull --ff-only origin deepseekx/main
git switch -c deepseekx/<slug>
```

如果当前 feature 分支已经适合当前需求，继续使用，不重复建分支。

## 单人 GitHub Flow

默认流程：

1. 从干净且最新的 `deepseekx/main` 创建 `deepseekx/<slug>`。
2. 在 feature 分支完成一个清晰需求单元。
3. 运行相关检查并提交。
4. 用户要求收口时，按风险选择本地合并或 PR。

低风险个人任务可以本地收口：

```bash
git switch deepseekx/main
git merge --ff-only deepseekx/<slug>
```

如果本地 `deepseekx/main` 落后远端，先执行：

```bash
git pull --ff-only origin deepseekx/main
```

PR 只在用户明确要求审查记录、远端 CI、发布前协作确认，或需要 GitHub
合并记录时创建。单人日常开发不强制 PR。

## Professional Mode

以下任一条件成立时，使用 professional mode：

- 用户明确要求专业流程、PR、review、团队协作或展示给他人。
- 改动影响公开 CLI 行为、npm 包内容、CI、release、tag 或公开仓库。
- 改动风险高，直接合并到 `deepseekx/main` 会难以解释或回滚。

professional mode 规则：

1. 先用 `$we-branch-protection` 检查 `deepseekx/main` 远端硬门禁。
2. feature 分支必须推送到 `origin deepseekx/<slug>`。
3. 必须创建 PR，base 是 `deepseekx/main`。
4. PR 描述包含范围、风险、检查命令和跳过项。
5. PR CI 必须通过；需要平台 artifact 时使用
   `$we-deepseekx-nightly-artifacts`。
6. 不做本地直接合并，除非用户明确回到 solo mode。

## 检查策略

Rust 变更遵守仓库 `AGENTS.md`：

```bash
cd codex-rs
just fmt
cargo test -p <crate>
just fix -p <crate>
```

TUI 用户可见输出变化必须运行相关 `insta` snapshot 测试并接受快照。

包入口或 npm staging 变化优先运行：

```bash
python3 codex-cli/scripts/build_npm_package.py \
  --package deepseekx \
  --version 0.0.0-dev \
  --staging-dir /tmp/deepseekx-npm-stage
node /tmp/deepseekx-npm-stage/bin/deepseekx.js --help
```

只改 WE skill 时，运行相关 skill 的脚本语法和行长检查。

live API tests 默认不跑。只有用户要求，或改动影响 DeepSeek provider
runtime 且需要真实上游验证时，运行相关 live test，并说明网络风险。

## 提交卫生

提交前运行：

```bash
git status --short
git diff --cached --name-only
```

确认：

- 没有 `.env`、key、token、credential、cache、tarball 或临时目录。
- 没有 `_tasks/`、`_workflows/` 私有工作流被误纳入公开发布路径。
- 没有无关用户改动被 stage。
- generated files 是有意产物。
- npm 发布包以 `codex-cli/package.json` 和 staging 脚本输出为准。

## PR 指引

PR base 使用 `deepseekx/main`，head 使用当前 `deepseekx/<slug>`：

```bash
git push -u origin deepseekx/<slug>
gh pr create --base deepseekx/main --head deepseekx/<slug>
```

PR 描述包含：

- 改动范围。
- 关键行为变化。
- 检查命令和结果。
- 跳过的检查及原因。
- 是否影响 npm 包内容、发布流程、DeepSeek runtime 或公开镜像。

## 最终答复

报告：

- 当前分支。
- preflight 是否通过。
- 是否新建或继续 feature 分支。
- 变更文件。
- 检查命令和结果。
- commit hash，如果已提交。
- push 或 PR URL，如果已创建。
- 保留的 dirty 或 untracked files。
