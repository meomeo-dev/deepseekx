---
name: we-publish
description: Use when preparing, validating, or executing npm publication for
  the DeepSeekX @meomeo-dev/deepseekx package after release gates pass.
---

# we-publish

用于 DeepSeekX npm 发布（npm publication）。目标是确认
`@meomeo-dev/deepseekx` 的包元数据、staged tarball、registry 状态、
认证状态和发布后验证都可解释、可复现。

除非用户明确要求，不自动执行 `npm publish`。

## 当前仓库事实

- npm CLI 包源：`codex-cli/package.json`。
- 当前包名（package name）：`@meomeo-dev/deepseekx`。
- CLI bin：`deepseekx -> bin/deepseekx.js`。
- staging 脚本：`codex-cli/scripts/build_npm_package.py`。
- npm latest 必须通过 `npm view @meomeo-dev/deepseekx version` 实时查询。
- npm registry 当前登录用户必须用 `npm whoami` 检查。
- 根 `package.json` 是 private maintenance package，不得作为发布包。
- 公开仓库安全扫描属于 `$we-release` 和 `$we-public-sync` 范围。

## 适用范围

- 准备 npm 发布或 dry-run 发布。
- 检查 package metadata 是否适合公开 registry。
- 检查 staged tarball 是否只包含预期 runtime 文件。
- 检查版本号、changelog、license、repository、bin 和 engines。
- 执行用户明确授权后的 `npm publish`。
- 发布后核验 npm registry 和临时安装后的 CLI 行为。

## 非目标

- 不替代 `$we-release` 的版本、tag 和公开仓库安全检查流程。
- 不自动推送 git remote。
- 不自动创建 GitHub release，除非用户明确要求。
- 不发布根 private maintenance package。
- 不把 `_tasks/`、`_workflows/`、`.env`、`docs/notes/` 或本地 cache
  纳入 npm 包。
- `.agents/`、`.codex/`、`.deepseekx/` 可以存在于公开仓库，但不是
  `@meomeo-dev/deepseekx` npm 包默认内容。

## 安全边界

- 不打印 npm token、`.npmrc` auth 内容、API key 或私有凭据。
- 读取 `.npmrc` 时只报告是否存在 auth-like entry，不回显值。
- npm publish 前必须确认 git 工作区状态和 staged 内容。
- 如果用户没有明确说“发布”或“执行 npm publish”，只给发布命令。
- 若 registry、auth、2FA、网络或权限检查失败，停止并报告阻塞项。

## 前置检查

1. 查看工作区：`git status --short --branch`。
2. 查看包元数据：
   `node -p "require('./codex-cli/package.json')"`。
3. 查看 registry：
   `npm view @meomeo-dev/deepseekx name version dist-tags --json`。
4. 查看登录用户：`npm whoami`，失败时不要继续发布。
5. 检查 `.npmrc` 是否含 auth-like entry，但不要打印具体值。
6. 确认 `codex-cli/package.json`：
   - `name` 是 `@meomeo-dev/deepseekx`；
   - `license` 与目标发布策略一致；
   - `repository` 指向公开可访问地址；
   - `bin.deepseekx` 指向 `bin/deepseekx.js`；
   - `files` 白名单覆盖必要 runtime 文件。

## 版本和记录

1. 对比 npm latest 和 `codex-cli/package.json` 版本。
2. 如果本地版本不高于 registry latest，先回到 `$we-release` 更新版本。
3. 确认 CHANGELOG 或 release notes 已记录用户可见变化。
4. 版本变更必须独立、可审查，避免混入无关重构。

## Tarball 检查

发布前必须使用 staging 脚本创建要发布的包：

```bash
version="$(node -p "require('./codex-cli/package.json').version")"
tmp="$(mktemp -d)"
tarball="/tmp/deepseekx-$version.tgz"
python3 codex-cli/scripts/build_npm_package.py \
  --package deepseekx \
  --release-version "$version" \
  --staging-dir "$tmp" \
  --pack-output "$tarball"
npm pack --dry-run --json "$tmp"
```

确认：

- tarball 文件数和大小合理。
- 包内包含 `bin/deepseekx.js`、README、package.json。
- 包内不包含私有目录、任务目录、`.env`、cache 或凭据文件。
- optional dependencies 指向 `@meomeo-dev/deepseekx-*` 平台包版本。

完整平台发布应优先使用 `$we-deepseekx-nightly-artifacts target=all` 产出的
`deepseekx-npm-platform-staging`。该 artifact 应包含：

- `deepseekx-npm-linux-x64-<version>.tgz`
- `deepseekx-npm-linux-arm64-<version>.tgz`
- `deepseekx-npm-darwin-x64-<version>.tgz`
- `deepseekx-npm-darwin-arm64-<version>.tgz`
- `deepseekx-npm-win32-x64-<version>.tgz`
- `deepseekx-npm-win32-arm64-<version>.tgz`
- `deepseekx-npm-<version>.tgz`

发布顺序必须是 6 个平台 tarball 先发布，root wrapper tarball 最后发布。

## 临时安装验证

在临时目录安装本地 tarball，并验证 CLI：

```bash
install_root="$(mktemp -d)"
npm install --prefix "$install_root" "$tarball"
"$install_root/node_modules/.bin/deepseekx" --help
"$install_root/node_modules/.bin/deepseekx" --version
```

如果本地 tarball 没有 native payload，记录缺失平台 optional dependency
是预期 staging 限制，不能把该检查当成完整 runtime 验证。平台 runtime
验证使用 `$we-deepseekx-nightly-artifacts`。

## 发布执行

只有用户明确授权后执行。建议在 staging 目录发布，而不是仓库根目录：

```bash
npm publish "$tarball" --access public
```

执行前再次确认：

- 本地版本高于 npm latest。
- 发布访问级别与意图一致。
- 当前包名是 `@meomeo-dev/deepseekx`。
- 工作区没有未解释的 staged 或 dirty 发布文件。
- 用户已接受 npm 2FA 或 registry auth 的交互要求。

## 发布后验证

发布完成后运行：

```bash
npm view @meomeo-dev/deepseekx version dist-tags license repository --json
npm view @meomeo-dev/deepseekx dist.tarball dist.fileCount dist.unpackedSize --json
```

必要时在新临时目录安装 registry 版本：

```bash
tmp="$(mktemp -d)"
npm install --prefix "$tmp" @meomeo-dev/deepseekx@latest
"$tmp/node_modules/.bin/deepseekx" --help
```

确认 registry 版本、dist-tag、license、repository 和 CLI 输出符合预期。

## Git 处理

- 发布准备变更可以提交；实际发布命令不必单独提交。
- 提交前运行 `git diff --cached --name-only`。
- 只 stage 发布相关文件。
- 不 stage `.env`、token、tarball、cache、临时安装目录或无关变更。
- npm publish 和 registry 验证全部完成后，使用 `$we-release-cleanup`。

## 最终答复

报告：

- 包名、本地版本、registry latest。
- 是否执行了 `npm publish`。
- staging 目录、tarball 路径和 tarball 检查结论。
- 临时安装验证结论。
- 发布后 registry 验证结论。
- 提交哈希，如果有提交。
- 未处理或保留的无关 dirty files。
- 是否建议继续执行 `$we-release-cleanup`。
