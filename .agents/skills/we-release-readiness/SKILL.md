---
name: we-release-readiness
description: Use before DeepSeekX release preparation to decide whether the
  codex-cli npm package is ready for release work.
---

# we-release-readiness

用于 DeepSeekX 发布候选检查（release readiness）。目标是在进入
`$we-release` 前，判断本轮是否可以开始发布准备，以及需要哪些平台
验证、公开镜像检查、tag、GitHub Release 页面和用户确认。

默认只读检查和决策建议。除非用户明确要求，不修改版本号、不改
CHANGELOG、不创建 tag、不推送、不发布 npm、不创建 GitHub Release。

## 仓库事实

- 下游主干：`deepseekx/main`。
- 私有工作区：`/Users/jin/projects/deepseekx`。
- 公开镜像工作区：`/Users/jin/projects/deepseekx-public`。
- GitHub owner：`meomeo-dev`。
- npm CLI 包源：`codex-cli/package.json`。
- npm CLI 包名：`@meomeo-dev/deepseekx`。
- CLI bin：`deepseekx`。
- 根 `package.json` 是 private maintenance package，不是发布包。

## 范围

- 判断是否可以从当前状态进入 `$we-release`。
- 确认目标版本、变更类型和 SemVer 方向。
- 确认 `codex-cli/package.json`、CHANGELOG、README、公开 metadata 风险。
- 决定是否需要普通 CI、nightly artifact 或全平台验证。
- 确认 GitHub Release 页面和附件是否需要创建。
- 判断是否需要 `$we-public-sync` 检查公开镜像。
- 给出进入 `$we-release` 前的阻塞项和下一步。

## 非目标

- 不维护版本号；版本更新由 `$we-release` 执行。
- 不创建 tag；tag 创建和推送由 `$we-release` 执行。
- 不执行 npm publish；registry 发布由 `$we-publish` 执行。
- 不调试 CI 失败；CI 调试由 `$we-ci-maintenance` 执行。
- 不执行公开仓库同步；公开镜像检查和同步由 `$we-public-sync` 执行。

## 只读检查

发布候选检查时优先读取：

```bash
git status --short --branch
node -p "require('./codex-cli/package.json').version"
npm view @meomeo-dev/deepseekx version dist-tags --json
git tag --list "v*"
```

可按需要补充 staging 检查：

```bash
tmp="$(mktemp -d)"
python3 codex-cli/scripts/build_npm_package.py \
  --package deepseekx \
  --version "$(node -p "require('./codex-cli/package.json').version")" \
  --staging-dir "$tmp"
node "$tmp/bin/deepseekx.js" --help
```

如果只是判断发布计划，不必先消耗远端 CI 分钟数。

## Readiness Checklist

进入 `$we-release` 前应明确：

- 目标版本是否高于 npm latest。
- SemVer 类型：patch、minor、major 或 prerelease。
- `codex-cli/package.json` 是否是唯一 npm CLI version source。
- `CHANGELOG.md` 是否需要新增本版本条目。
- 本轮改动是否影响 CLI 行为、平台二进制、打包流程或公开文档。
- 是否需要 `$we-deepseekx-nightly-artifacts` 验证平台产物。
- 是否需要 GitHub Release 页面。
- 是否涉及公开仓库同步；涉及时必须进入 `$we-public-sync`。
- 发布附件是否只需要 npm tarball 和可选 checksum。
- 是否有 dirty、untracked tarball、cache、`.env` 或凭据风险。

## Release Candidate Result

输出以下结论之一：

- Ready：可以进入 `$we-release`。
- Ready with conditions：满足列出的检查或用户确认后进入 `$we-release`。
- Blocked：存在版本、dirty state、CI、包内容、凭据或公开镜像阻塞。
- Not a release：当前请求应回到 `$we-feature-dev` 或其他技能。

## Final Response

报告：

- `@meomeo-dev/deepseekx` 本地版本、npm latest 和建议目标版本。
- readiness 结论。
- 是否需要 `$we-deepseekx-nightly-artifacts` 或普通 CI。
- 是否需要 `$we-public-sync`。
- 是否需要 GitHub Release 页面和附件。
- 进入 `$we-release` 前的阻塞项。
- 下一步建议使用的 WE skill。
