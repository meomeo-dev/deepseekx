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

- macOS x64：`macos-15-intel`
- macOS arm64：`macos-latest`
- Windows x64：`windows-latest`
- Windows arm64：`windows-11-arm`

该 workflow 当前不等于 npm platform package 产线：

- 不覆盖 Linux x64 和 Linux arm64。
- 输出的是 `.dmg`、`.tar.gz`、`.zip` 和校验文件。
- 不直接生成 npm platform tarball。
- 不执行 `npm publish`。

`.github/workflows/rust-release.yml` 保留了上游 Codex release 产线形状，
包含 release artifact、npm tarball staging 和 `publish-npm` job。但该
workflow 仍带有上游语义和 release 触发规则，当前不应作为 DeepSeekX
手动 npm 发布的直接依赖。

## 推荐下一步

发布 DeepSeekX npm 前，应新增或改造一个专用的 npm platform staging
workflow。该 workflow 应：

- 支持手动触发，不挂到普通 `push` 或 `pull_request`。
- 构建 Linux、macOS 和 Windows 的 x64/arm64 native binary。
- 将 native binary 组装成 `--vendor-src` 可读取的目录结构。
- 调用 `scripts/stage_npm_packages.py --package deepseekx` 或直接调用
  `build_npm_package.py` 生成全部 npm tarball。
- 上传 6 个平台 tarball 和 1 个 root wrapper tarball 作为 workflow
  artifacts。
- 不自动执行 `npm publish`，由发布人检查 tarball 后手动发布。

推荐先跑单平台目标验证，例如 macOS arm64 或 Windows x64；确认 artifact
形状稳定后，再运行全平台构建。

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

