---
name: we-release
description: Use when preparing a DeepSeekX release from codex-cli package
  metadata, public mirror checks, and user-confirmed release gates.
---

# we-release

用于 DeepSeekX 发布准备（release preparation）。本技能维护版本、
CHANGELOG、staged npm package、公开镜像检查、tag 策略和发布命令。
实际 `npm publish` 使用 `$we-publish`，不要在用户未明确授权时发布。

进入本技能前，如果用户是在问“能不能发、发什么版本、是否需要平台
artifact 或 GitHub Release”，先使用 `$we-release-readiness`。

## 仓库事实

- 下游主干：`deepseekx/main`。
- 私有仓库：`/Users/jin/projects/deepseekx`。
- 公开镜像：`/Users/jin/projects/deepseekx-public`。
- GitHub owner：`meomeo-dev`。
- npm CLI 包源：`codex-cli/package.json`。
- npm CLI 包名：`@meomeo-dev/deepseekx`。
- CLI bin：`deepseekx`。
- 包 staging 脚本：`codex-cli/scripts/build_npm_package.py`。
- 根 `package.json` 是 private maintenance package，不是发布包。

## Boundaries

- 私有仓库承载开发、内部工作流、研究记录和本地 skill。
- 公开仓库是清洗导出（sanitized export），使用独立 git 历史。
- 私有和公开 GitHub slug 都是 `meomeo-dev/deepseekx` 时，不能只靠
  slug 判断身份；必须同时检查本地路径、分支、禁止目录和 remote。
- `_tasks/`、`_workflows/`、`.deep-research/`、`.env`、cache、凭据或
  私有配置不得进入公开仓库或 npm 包。
- `.agents/`、`.codex/`、`.deepseekx/` 可以同步到公开仓库，但默认不
  纳入 npm 包；同步前必须通过凭据、私有路径和内部任务扫描。
- npm registry 发布、post-check 和 registry 安装验证属于
  `$we-publish`。
- 公开仓库清洗同步、泄漏扫描和 metadata 验证属于 `$we-public-sync`。
- 上游 OpenAI Codex 版本同步属于 `$we-deepseek-branch-sync`。
- 手动平台产物构建属于 `$we-deepseekx-nightly-artifacts`。

## Release Readiness Gate

开始维护版本号前，应确认：

- 目标版本高于 `npm view @meomeo-dev/deepseekx version`。
- `codex-cli/package.json` version 是本轮 CLI package version source。
- `CHANGELOG.md` 有或将新增对应版本条目。
- 是否需要 platform artifact 已由 `$we-release-readiness` 或用户确认。
- GitHub Release 页面是否需要创建已明确。
- 公开仓库镜像是否需要同步已明确；需要时必须使用 `$we-public-sync`。
- 工作区没有未解释 dirty、staged、tarball、cache、`.env` 或凭据风险。

如果这些问题尚未判断，先停下并切回 `$we-release-readiness`。

## Artifact Policy

默认权威发布物是 npm package：

```text
@meomeo-dev/deepseekx
```

发布准备使用 staging 脚本，而不是根 `npm pack`：

```bash
version="$(node -p "require('./codex-cli/package.json').version")"
tmp="$(mktemp -d)"
python3 codex-cli/scripts/build_npm_package.py \
  --package deepseekx \
  --release-version "$version" \
  --staging-dir "$tmp" \
  --pack-output "/tmp/deepseekx-$version.tgz"
node "$tmp/bin/deepseekx.js" --help
node "$tmp/bin/deepseekx.js" --version
```

不要把 CI platform artifact 当成 npm release 附件，除非用户明确要求
GitHub Release 页面，并且 artifact 来自已确认的 nightly workflow。

## Version And Tag Policy

- 版本号使用 SemVer，并写入 `codex-cli/package.json`。
- 若 SDK 或平台包版本需要同步，必须在本轮 release plan 中明确说明。
- tag 使用 `v<semver>`，例如 `v0.7.1`。
- tag message 使用 `@meomeo-dev/deepseekx v<semver>`。
- tag 应指向已通过发布门禁的 release commit。
- 不要在 dirty worktree、版本不一致、changelog 缺失、CI 或 staging
  检查失败时创建 tag。
- 私有仓库和公开仓库使用独立历史时，最终答复必须说明两个 tag
  分别属于哪个仓库。

创建 tag 前检查：

```bash
version="$(node -p "require('./codex-cli/package.json').version")"
test "v$version" = "<expected-tag>"
git status --short --branch
git tag --list "v$version"
```

创建 annotated tag：

```bash
git tag -a "v$version" -m "@meomeo-dev/deepseekx v$version"
```

推送 tag、创建 GitHub Release、同步公开仓库都需要用户明确确认。

## Workflow

1. 检查私有工作区：`git status --short --branch`。
2. 确认当前分支面向 `deepseekx/main` 收口。
3. 更新 `codex-cli/package.json` version，必要时更新
   `CHANGELOG.md`、README 或安装说明。
4. 运行 secret 和私有路径检查，确认发布包和公开镜像不包含私有内容。
5. 使用 `build_npm_package.py --package deepseekx` staging npm package。
6. 运行 `node <staging>/bin/deepseekx.js --help` 和 `--version`。
7. 如影响平台二进制或 installer，使用 `$we-deepseekx-nightly-artifacts`
   做用户确认后的平台验证。
8. 使用 `$we-public-sync` 检查公开镜像身份和泄漏风险。
9. 用户明确要求同步时，按 `$we-public-sync` 的排除规则同步公开仓库。
10. 同步后再次使用 `$we-public-sync` 检查泄漏和 package metadata。
11. 所有检查通过后，只提交 release 相关文件。
12. 用户确认后创建 tag、推送或创建 GitHub Release。
13. 给出 registry 发布命令，或在用户明确要求时切换到 `$we-publish`。
14. 发布、tag 或 GitHub Release 完成后，使用 `$we-release-cleanup`。

## Validation Notes

- Rust 改动遵守 `codex-rs` 的 `just fmt`、focused `cargo test` 和
  `just fix -p <crate>` 规则。
- TUI 用户可见输出变化必须更新 `insta` snapshots。
- npm CLI package staging 以 `codex-cli/scripts/build_npm_package.py`
  为准，不以根 `package.json` 为准。
- live API tests 默认不属于发布门禁。只有用户要求，或本次改动影响
  DeepSeek provider runtime 时，运行相关 live test。

## Final Response

报告：

- `@meomeo-dev/deepseekx` 版本、npm latest 和目标 tag。
- 修改过的 release 文件。
- staging 目录、tarball 路径、sha256 和 CLI smoke 结果。
- `$we-public-sync` 结论。
- 是否运行 nightly artifact 或普通 CI。
- 是否创建 tag、GitHub Release 或执行 npm publish。
- 下一步是否应使用 `$we-publish` 或 `$we-release-cleanup`。
