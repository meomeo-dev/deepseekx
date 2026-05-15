# DeepSeekX npm 平台包打包记录

## 范围

本文记录 DeepSeekX npm 发布中平台包（platform package）的当前打包
边界。核心结论是：native binary 必须先在对应平台的 CI 机器上编译，
npm tarball 只负责封装已经产出的 native 文件，不在用户安装时编译。

本文只记录现有仓库事实和推荐产线边界，不代表已经完成自动发布流程。

## 当前包形状

npm CLI 入口包来自 `codex-cli/package.json`，目标包名是
`@meomeo-dev/deepseekx`，命令入口是 `deepseekx -> bin/deepseekx.js`。

平台包矩阵定义在 `codex-cli/scripts/build_npm_package.py`：

| 逻辑平台包 | target triple | OS | CPU |
| --- | --- | --- | --- |
| `deepseekx-linux-x64` | `x86_64-unknown-linux-musl` | `linux` | `x64` |
| `deepseekx-linux-arm64` | `aarch64-unknown-linux-musl` | `linux` | `arm64` |
| `deepseekx-darwin-x64` | `x86_64-apple-darwin` | `darwin` | `x64` |
| `deepseekx-darwin-arm64` | `aarch64-apple-darwin` | `darwin` | `arm64` |
| `deepseekx-win32-x64` | `x86_64-pc-windows-msvc` | `win32` | `x64` |
| `deepseekx-win32-arm64` | `aarch64-pc-windows-msvc` | `win32` | `arm64` |

这些逻辑平台包用于构建 optional dependency alias。实际发布到 npm
registry 的包名仍是 `@meomeo-dev/deepseekx`，但每个平台使用唯一的
平台后缀版本，例如：

```text
@meomeo-dev/deepseekx@0.131.0-deepseekx.1-darwin-arm64
```

root wrapper 版本，例如
`@meomeo-dev/deepseekx@0.131.0-deepseekx.1`，通过
`optionalDependencies` 使用 npm alias 指向这些平台后缀版本。这样 npm
安装时会按 `os` 和 `cpu` 选择当前平台可安装的 native payload。

## 打包责任边界

`codex-cli/scripts/build_npm_package.py` 负责 staging 和 `npm pack`：

- root 包只封装 JavaScript launcher、`bin/rg` manifest、README 和
  `package.json`。
- 平台包必须传入 `--vendor-src`。
- `--vendor-src` 需要已经包含对应 target 的 native 文件。
- 脚本会把 native 文件复制到 staged package 的 `vendor/` 下。
- 脚本不会跨平台编译 native binary。

平台包需要的 native component 当前为：

| 平台 | native component |
| --- | --- |
| Linux | `bwrap`, `deepseekx`, `rg` |
| macOS | `deepseekx`, `rg` |
| Windows | `deepseekx`, `rg`, `codex-windows-sandbox-setup`, `codex-command-runner` |

因此发布顺序必须是：

1. 在 CI runner 上按目标平台编译 native binary。
2. 收集 native binary 到统一 vendor root。
3. 调用 `build_npm_package.py --package deepseekx-<platform>` 生成平台
   tarball。
4. 先发布所有平台后缀版本。
5. 最后发布 root wrapper 版本。

root wrapper 不能先发布。它一旦进入 npm registry，用户安装时会立即解析
optional dependencies；如果平台后缀版本尚未存在，安装会失败或缺少
native payload。

## 现有 workflow 状态

`.github/workflows/deepseekx-nightly-artifacts.yml` 是手动触发的 unsigned
artifact workflow。它当前用于验证和分发可下载 artifact：

- Linux x64：`ubuntu-24.04`
- Linux arm64：`ubuntu-24.04-arm`
- macOS x64：`macos-15-intel`
- macOS arm64：`macos-latest`
- Windows x64：`windows-latest`
- Windows arm64：`windows-11-arm`

该 workflow 的单平台目标仍只产出 native artifact。`target=all` 会在
Linux、macOS 和 Windows 六个平台 job 全部成功后，追加生成 npm
platform staging artifact：

- 6 个平台 tarball。
- 1 个 root wrapper tarball。
- artifact 名称：`deepseekx-npm-platform-staging`。
- 不执行 `npm publish`。

`.github/workflows/rust-release.yml` 保留了上游 Codex release 产线形状，
包含 release artifact、npm tarball staging 和 `publish-npm` job。但该
workflow 仍带有上游语义和 release 触发规则，当前不应作为 DeepSeekX
手动 npm 发布的直接依赖。

## 推荐发布前流程

发布 DeepSeekX npm 前，正常流程是在目标 release ref 上直接运行一次
`target=all`。该目标会构建六个平台，并在全部成功后生成最终 npm
platform staging artifact。

单平台目标用于调试和降低失败面，不是常规发布前置步骤。适用场景包括：

- workflow 或平台构建逻辑刚改动。
- 某个平台已知失败，需要验证修复。
- 新增平台、runner 或 native component。

不要常规先把所有单平台目标都跑一遍，再运行 `target=all`；这会重复消耗
GitHub Actions runner minutes。若 `target=all` 因 runner、网络或依赖下载
失败，优先只重跑失败 job。若失败原因是代码或 workflow，需要 push 新
commit 后重新触发 workflow。

`target=all` 成功后，从 workflow artifact 下载
`deepseekx-npm-platform-staging`，检查其中 6 个平台 tarball 和 1 个 root
wrapper tarball。发布人确认包内容后，手动执行 npm publish；workflow
不会自动发布到 registry。

## Nightly artifact 到 npm tarball

`codex-cli/scripts/install_native_deps.py` 同时支持两种 artifact 布局：

- 上游 release 风格的 `.zst` 文件，例如
  `x86_64-unknown-linux-musl/deepseekx-x86_64-unknown-linux-musl.zst`。
- DeepSeekX nightly 风格的目录 artifact，例如
  `deepseekx-linux-x64/deepseekx-linux-x64/bin/deepseekx`。

workflow 内部使用已下载 artifact 时，可以直接传 `--artifacts-dir`：

```bash
./scripts/stage_npm_packages.py \
  --release-version 0.131.0-deepseekx.1 \
  --package deepseekx \
  --artifacts-dir artifacts \
  --output-dir dist/npm
```

如果从一个已完成的 GitHub Actions run 复用 artifact，可以传
`--workflow-url`，脚本会先调用 `gh run download`：

```bash
./scripts/stage_npm_packages.py \
  --release-version 0.131.0-deepseekx.1 \
  --package deepseekx \
  --workflow-url https://github.com/meomeo-dev/deepseekx/actions/runs/<run-id> \
  --output-dir dist/npm
```

## 手动 staging 命令形状

root wrapper 示例：

```bash
python3 codex-cli/scripts/build_npm_package.py \
  --package deepseekx \
  --release-version 0.131.0-deepseekx.1 \
  --staging-dir /tmp/deepseekx-npm-stage \
  --pack-output /tmp/deepseekx-0.131.0-deepseekx.1.tgz
```

平台包示例：

```bash
python3 codex-cli/scripts/build_npm_package.py \
  --package deepseekx-darwin-arm64 \
  --release-version 0.131.0-deepseekx.1 \
  --vendor-src /tmp/deepseekx-native-vendor \
  --staging-dir /tmp/deepseekx-darwin-arm64-stage \
  --pack-output /tmp/deepseekx-0.131.0-deepseekx.1-darwin-arm64.tgz
```

`/tmp/deepseekx-native-vendor` 必须来自对应 CI 构建产物。不能用本机
artifact 伪装其他平台的 native payload。

## 验收标准

可发布的 npm platform staging 产物应满足：

- root wrapper tarball 不包含私有目录、任务目录、cache、`.env` 或凭据。
- 每个平台 tarball 的 `package.json` 包含正确的 `os` 和 `cpu`。
- 每个平台 tarball 的 `vendor/` 包含该平台所需 native component。
- root wrapper 的 `optionalDependencies` 指向同版本的平台后缀版本。
- 平台后缀版本先于 root wrapper 发布。
- 发布前可以在临时目录检查 tarball 内容和 package metadata。
