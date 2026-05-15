---
name: we-ci-maintenance
description: Use when creating, changing, debugging, or operating GitHub
  Actions CI for deepseekx with platform-specific runs and cost control.
---

# we-ci-maintenance

用于本仓库 GitHub Actions CI 的创建、维护、调试和远端运行
（remote run）控制。重点是分平台验证（platform-specific
validation）、发布预检（release preflight）和免费额度成本控制
（cost control）。

## 范围

- 维护 `.github/workflows/*.yml`。
- 调试 Linux 或 Windows CI 失败。
- 手动触发或查看 GitHub Actions run、job 和 artifact。
- 调整 release preflight、package verify、artifact 上传策略。
- 记录 CI 成本策略，避免已通过平台被无意义重跑。

## 非目标

- 不执行 npm publish；发布使用 `$we-publish`。
- 不做私有/公开双仓库同步；公开镜像使用 `$we-release`。
- 不替代普通功能开发分支门禁；开始前仍先执行 `$we-feature-dev`
  的 preflight。

## 硬规则

- 默认先本地复现和验证，再消耗远端 GitHub Actions 分钟数。
- Windows 验证只在需要 Windows 行为、路径、shell 或打包兼容性时运行。
- 已通过的平台不要因为调试另一个平台而重跑，除非用户明确要求全量验证。
- workflow 必须支持 `workflow_dispatch` 按平台选择目标。
- push 和 pull request 的默认 CI 应保持低成本，优先只跑 Linux 快速门禁。
- 深度平台产物构建不属于普通 CI；使用 `$we-deepseekx-nightly-artifacts`。
- 需要全平台验证时，说明原因并优先选择手动 `target=all`。

## Windows 必跑条件

满足任一条件时，必须说明需要 Windows，并优先只触发
`workflow_dispatch target=windows`：

- 改动 shell、路径、文件分隔符、换行、权限或可执行脚本。
- 改动 `package.json` scripts、bin 入口、打包、安装或 tarball 验证。
- 改动 CLI 启动、子进程、文件读写、临时目录或缓存路径。
- 改动 GitHub Actions、artifact、npm pack 或 release preflight。
- 本轮要发布，且用户要求证明 Windows 可运行。

仅文档、CHANGELOG、WE skill 文本或不影响 runtime 的类型调整，
可以跳过 Windows，但最终答复必须写明跳过原因。

## 当前 CI 策略

- `.github/workflows/ci.yml` 当前在 `push` 到 `deepseekx/main` 和 PR 时运行
  维护门禁，并 staging `@meomeo-dev/deepseekx` npm 根包。
- `deepseekx-nightly-artifacts.yml` 是手动 artifact workflow，触发和调试
  使用 `$we-deepseekx-nightly-artifacts`。
- 如果 workflow 仍监听 `main` 而目标是 `deepseekx/main`，先把事件分支
  策略作为本轮 CI 维护问题处理，不要假设远端会自动保护下游主干。

## 工作流程

1. 运行 feature-dev preflight，确认分支、remote 和工作区安全。
2. 阅读目标 workflow 和相关 npm scripts。
3. 判断改动是结构变更、运行策略变更，还是单平台兼容修复。
4. 根据 Windows 必跑条件决定 `linux`、`windows` 或 `all`。
5. 优先本地运行相关检查；只在本地无法覆盖时触发远端平台。
6. 远端调试时，只触发受影响平台。
7. 汇报 run URL、目标平台、结论和是否还需要全量验证。

## 常用命令

查看 workflow：

```bash
gh workflow list
gh run list --workflow CI --limit 10
```

只跑 Windows：

```bash
gh workflow run deepseekx-nightly-artifacts.yml \
  --ref <branch-or-sha> \
  -f target=win-x64 \
  -f confirm_run=RUN_NIGHTLY \
  -f artifact_retention_days=7
```

只跑 Linux：

```bash
gh workflow run ci --ref <branch-or-sha>
```

必要时全量跑：

```bash
gh workflow run deepseekx-nightly-artifacts.yml \
  --ref <branch-or-sha> \
  -f target=all \
  -f confirm_run=RUN_NIGHTLY \
  -f artifact_retention_days=7
```

查看 run：

```bash
gh run view <run-id> --json status,conclusion,event,displayTitle,url,jobs
gh run view <run-id> --log-failed
```

下载 artifact：

```bash
gh run download <run-id> --dir tmp/ci-artifacts
```

## 本地验证

修改 workflow 后至少运行：

```bash
node --input-type=module -e "import { readFileSync } from 'node:fs'; \
import { parse } from 'yaml'; \
parse(readFileSync('.github/workflows/ci.yml', 'utf8')); \
parse(readFileSync('.github/workflows/deepseekx-nightly-artifacts.yml', 'utf8')); \
console.log('workflow yaml parsed')"
```

按改动范围补充：

```bash
python3 codex-cli/scripts/build_npm_package.py \
  --package deepseekx \
  --version 0.0.0-dev \
  --staging-dir /tmp/deepseekx-npm-stage
```

发布门禁或打包行为变化时运行：

```bash
npm run release:preflight
```

## 提交前检查

```bash
git status --short
git diff --cached --name-only
```

确认没有 stage `.env`、token、tarball、artifact、`tmp/` 或无关文件。

## 最终答复

报告：

- 当前分支和 preflight 结果。
- CI 归属技能和路径。
- workflow 的平台触发策略。
- 本地检查命令和结果。
- 远端 run URL、目标平台和 job 结果。
- commit hash、push 状态，以及保留的 dirty 或 untracked files。
