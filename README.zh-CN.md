# DeepSeekX

DeepSeekX 是 OpenAI Codex CLI 的 DeepSeek 下游适配版本
（downstream adaptation）。它保留本地终端编码代理（local terminal
coding agent）工作流，同时默认使用 DeepSeek 相关的 provider、model、
打包和用户界面行为。

上游 OpenAI Codex README 已保留为 [CODEX_README.md](CODEX_README.md)，
便于后续同步 upstream 时降低根 README 冲突。

## 安装

通过 npm 安装：

```shell
npm install -g @meomeo-dev/deepseekx@0.131.0-deepseekx.1
```

启动：

```shell
deepseekx
```

一次性运行可使用 npx：

```shell
npx @meomeo-dev/deepseekx@0.131.0-deepseekx.1
```

当前不提供 Homebrew 发布渠道。GitHub Releases 用于发布说明
（release notes）和可选 tarball 下载。

## 快速开始

设置 DeepSeek API key 后启动：

```shell
export DEEPSEEK_API_KEY="sk-..."
deepseekx
```

DeepSeekX 使用独立用户目录，不默认读取原 OpenAI Codex 用户目录。

## 配置

用户级配置（user config）位于 `DEEPSEEKX_HOME/config.toml`。如果没有设置
`DEEPSEEKX_HOME`，默认目录是 `~/.deepseekx`，即：

```text
~/.deepseekx/config.toml
```

项目级配置（project config）位于项目根目录的：

```text
.deepseekx/config.toml
```

项目级配置适合存放仓库专属的 model、sandbox、approval、MCP、provider 或
profile 设置，避免污染全局用户默认值。

配置优先级（configuration precedence）：

```text
command-line overrides -> project .deepseekx/config.toml ->
user DEEPSEEKX_HOME/config.toml -> built-in defaults
```

### 用户级配置

创建 `~/.deepseekx/config.toml`：

```toml
model_provider = "deepseek"
model = "deepseek-v4-pro"
approval_policy = "on-request"
sandbox_mode = "workspace-write"

[model_providers.deepseek]
name = "DeepSeek"
base_url = "https://api.deepseek.com"
env_key = "DEEPSEEK_API_KEY"
wire_api = "chat"
requires_openai_auth = false
```

如需使用 DeepSeek 兼容供应商（custom provider），建议 provider id 保持在
`deepseek-*` 命名空间：

```toml
model_provider = "deepseek-vendor-a"
model = "deepseek-v4-flash"

[model_providers.deepseek-vendor-a]
name = "Vendor A DeepSeek"
base_url = "https://vendor.example/v1"
env_key = "VENDOR_DEEPSEEK_API_KEY"
wire_api = "chat"
requires_openai_auth = false
```

### 项目级配置

在仓库根目录创建 `.deepseekx/config.toml`：

```toml
model = "deepseek-v4-flash"
approval_policy = "on-request"
sandbox_mode = "workspace-write"

[profiles.pro]
model_provider = "deepseek"
model = "deepseek-v4-pro"
approval_policy = "on-request"
sandbox_mode = "workspace-write"

[profiles.flash]
model_provider = "deepseek"
model = "deepseek-v4-flash"
approval_policy = "on-request"
sandbox_mode = "workspace-write"
```

使用 profile：

```shell
deepseekx --profile pro
```

## 模型

DeepSeekX 当前暴露：

- `deepseek-v4-pro`
- `deepseek-v4-flash`

DeepSeek 模型 metadata、base instructions 和 personality templates 由
DeepSeek provider catalog 维护，不在运行时读取 OpenAI model catalog。

## 与 OpenAI Codex 的差异

- CLI 命令是 `deepseekx`。
- npm 包是 `@meomeo-dev/deepseekx`。
- 用户配置目录默认是 `~/.deepseekx`。
- 项目配置目录默认是 `.deepseekx/config.toml`。
- DeepSeek 鉴权使用 `DEEPSEEK_API_KEY`。
- OpenAI login、IDE/app 等未适配命令会隐藏或禁用。
- 部分上游 Codex 功能需要完成 DeepSeekX 适配后才会开放。

## 发布渠道

- npm 是主要安装渠道。
- GitHub Releases 提供发布说明和可选 tarball。
- 当前不支持 Homebrew。

## License

本仓库使用 [Apache-2.0 License](LICENSE)。

DeepSeekX 是 OpenAI Codex 的下游 fork。原上游 README 见
[CODEX_README.md](CODEX_README.md)。
