# DeepSeekX 用户感知面改造范围

## 范围

本文记录将下游产品感知从 Codex 调整为 DeepSeekX 的改造边界。
目标是让用户在安装、运行、配置、TUI、CLI、server 模式和 SDK 入口
感知到 DeepSeekX，同时尽量不改动核心执行内核和上游协议命名。

本文是集成决策文档，不是实现计划。后续代码改造应以最小补丁
集实现，避免全仓库字符串替换。

## 当前实现状态

当前分支已经按隔离优先策略完成首轮用户感知面改造：

- 主 CLI binary、npm 包入口和安装脚本只发布 `deepseekx`。
- 源码构建入口 `cargo run -p codex-cli --bin deepseekx -- --version`
  可运行，并输出 `DeepSeekX <version>`。
- DeepSeekX 不提供 `codex` alias、shim、软链接或 npm `bin` fallback。
- 若 DeepSeekX binary 被误以 `codex` 或 `codex.exe` 作为 argv0 启动，
  程序会拒绝运行并提示使用 `deepseekx`。
- 配置根使用 `DEEPSEEKX_HOME`，默认目录为 `~/.deepseekx`。
- DeepSeekX 不读取 `CODEX_HOME` 或 `~/.codex` 作为配置根。
- 项目局部配置目录使用 `.deepseekx`。
- TUI 启动、输入框、状态、approval 和常用错误文案展示
  DeepSeekX。
- TUI app-server client id 使用 `deepseekx-tui`，IDE IPC 使用
  `deepseekx-ipc`。
- SDK 只寻找 `deepseekx` binary，并在继承环境时丢弃原版 Codex 的
  `CODEX_*` 变量。
- `deepseekx login` 和 `deepseekx logout` 当前隐藏并拒绝执行。
  DeepSeekX 还没有独立交互登录（interactive login）服务；用户应通过
  `~/.deepseekx/config.toml` 或环境变量配置 DeepSeek API 凭据。
- `deepseekx app` 当前隐藏并拒绝执行。源码树缺少 DeepSeekX
  Desktop/App 发布路径时，不打开或安装 OpenAI Codex Desktop。
- `deepseekx cloud` 不暴露 OpenAI-hosted Codex Cloud 任务服务。
  该子命令仅保留禁用占位 help，不列出 Codex Cloud 子命令。

以下残留是有意保留的内部或协议边界：

- Rust crate、Cargo package、Bazel target 和 `codex-rs` 目录名。
- app-server v1/v2 wire 字段和 schema 类型，例如 `codexHome`、
  `dotCodexFolder`、`codexErrorInfo` 和 `CodexErrorInfo`。
- 生成 SDK 中来自 v2 schema 的历史 wire 名称。
- snapshot 文件名和测试 helper 中的 `codex_tui__...`。
- OpenAI/ChatGPT 认证 URL 中的历史服务路径，例如 `/codex/device`。
- `OPENAI_API_KEY` 仍可作为 OpenAI provider 或 ChatGPT 兼容认证输入，
  但 DeepSeekX 默认 API key 环境变量是 `DEEPSEEK_API_KEY`。
- 内部常量名如 `CODEX_API_KEY_ENV_VAR` 可保留；其运行时值已经指向
  `DEEPSEEK_API_KEY`，不代表读取原版 `CODEX_API_KEY`。

发布前仍有一个已知阻塞：`sdk/python/uv.lock` 仍引用
`openai-codex-cli-bin`。这是因为 `deepseekx-cli-bin` 尚未发布，不能
手工伪造 lockfile。发布 Python SDK 前必须先发布或提供可解析的
DeepSeekX runtime wheel。当前 `just fmt` 的 Rust formatting 阶段可执行，
但随后会在 Python SDK 的 `uv` 依赖解析阶段因该 runtime wheel 缺失失败。

因此，当前结论是：源码构建和本地 Rust binary 路径已经可以通过
`deepseekx` 运行；npm/Python 分发路径还需要完成 DeepSeekX runtime
包发布或提供可解析的开发源。

## 核心决策

DeepSeekX 改造应采用外壳优先（shell-first）的策略：

- 用户看到、输入、配置和安装的入口应改为 DeepSeekX。
- 内部 crate 名、Rust 模块名、核心类型名和已有 wire schema 默认
  保留。
- DeepSeekX 不应提供 `codex` 命令别名或读取原版 Codex 用户目录。
  用户可能同时安装 OpenAI Codex，两个产品必须命令和配置隔离。
- 新增 DeepSeekX 命名应集中在边界层，不向核心业务层扩散。

该策略把 downstream 品牌层和 upstream 内核层分开。后续同步上游时，
冲突主要集中在 CLI、TUI、打包和配置入口，核心模型执行、
工具路由、线程状态、协议转换和测试夹具不应承担换皮成本。

## 必须改造的用户可见面

### CLI 命令与帮助文案

应提供 `deepseekx` 作为主命令，并让帮助文本展示 DeepSeekX。

当前关键位置包括：

- `codex-rs/cli/Cargo.toml` 的 `[[bin]] name = "codex"`。
- `codex-rs/cli/src/main.rs` 的 clap `bin_name = "codex"`。
- `codex-rs/exec/src/cli.rs` 的 `codex exec` usage。
- `codex-rs/cli/src/mcp_cmd.rs` 的 `codex mcp` usage 和提示。
- `codex-rs/cli/src/login.rs` 的登录提示命令。
- `codex-rs/exec/src/event_processor_with_human_output.rs` 的
  `OpenAI Codex v...` 启动摘要。

推荐做法：

- 新增 `deepseekx` 主 binary 或安装入口。
- 不安装 `codex` binary、软链接、shim 或 npm `bin` alias。
- 用户帮助文本默认展示 `deepseekx`。
- DeepSeekX 发行物不应抢占用户 PATH 中的原版 `codex`。

不建议直接重命名 `codex-cli` crate 或所有 `codex_*` Rust crate。

### TUI 品牌和交互文案

TUI 是最强用户感知面，应优先改造。

当前关键位置包括：

- `codex-rs/tui/src/history_cell.rs` 的 `OpenAI Codex` session header。
- `codex-rs/tui/src/status/card.rs` 的 `OpenAI Codex` status card。
- `codex-rs/tui/src/bottom_pane/mod.rs` 的
  `Ask Codex to do anything` placeholder。
- `codex-rs/tui/src/bottom_pane/chat_composer.rs` 及 history search 中
  重复出现的 placeholder 测试数据。
- `codex-rs/tui/src/bottom_pane/approval_overlay.rs` 的
  `tell Codex what to do differently`。
- `codex-rs/tui/src/keymap_setup/debug.rs` 的 key inspection 文案。
- `codex-rs/tui/src/tooltips.rs` 的 Codex App 推广文案。

推荐做法：

- 引入集中式 product label，例如 `DeepSeekX`。
- 新 UI 文案从集中常量取值。
- 只更新用户实际可见文案和对应 snapshot。
- 不修改内部事件名、测试 helper 变量或 `CodexStatus` 这类类型名。

TUI 改动必须更新 `insta` snapshot。该类改动会触发较多快照变更，
应单独成一个 PR 或提交。

### 配置目录和环境变量

用户配置面必须支持 DeepSeekX 命名，并与原版 Codex 配置隔离。

当前默认配置根由 `codex-rs/utils/home-dir/src/lib.rs` 决定：

- 环境变量：`CODEX_HOME`。
- 默认目录：`~/.codex`。
- 配置文件：`config.toml`。

相关配置文档和 schema 仍描述：

- `~/.codex/config.toml`。
- `~/.codex/history.jsonl`。
- `$CODEX_HOME/log`。
- `$CODEX_HOME/themes`。

推荐做法：

- 新增 `DEEPSEEKX_HOME`，默认目录为 `~/.deepseekx`。
- 不读取 `CODEX_HOME` 作为 DeepSeekX 配置根。
- 不 fallback 到 `~/.codex`。
- 若检测到 `CODEX_HOME` 或 `~/.codex`，最多给出迁移提示，
  不自动读取。
- 不应静默复制 secrets；auth 和 token 迁移必须由用户显式执行。

配置键本身不应批量改名。`model_provider`、`profiles`、
`model_providers`、`wire_api` 等键不是品牌名，应保持稳定。

### Auth 和 API Key

DeepSeekX 的默认模型路径应偏向 DeepSeek API，不应要求用户理解
OpenAI auth 前置条件。

需要检查和改造的面：

- `OPENAI_API_KEY` 登录提示。
- `CODEX_API_KEY` 兼容变量。
- `DEEPSEEK_API_KEY` provider 凭据。
- ChatGPT 登录、device auth、access token 的默认入口。
- 登录状态和 onboarding 中关于 OpenAI、ChatGPT、Codex plan 的描述。

推荐做法：

- DeepSeekX 默认 provider 为 `deepseek`。
- 默认凭据环境变量为 `DEEPSEEK_API_KEY`。
- OpenAI / ChatGPT 认证代码可以作为内部兼容 provider 能力保留，但不应
  暴露为 DeepSeekX 默认 CLI 登录入口。
- 在 DeepSeekX 交互登录服务明确设计前，`deepseekx login`、
  `deepseekx logout`、ChatGPT browser login、device auth 和 access
  token login 均应隐藏并拒绝执行。
- `OPENAI_API_KEY` 和 `CODEX_API_KEY` 只作为兼容或 OpenAI provider
  场景说明。

不建议删除 OpenAI auth 代码。它仍是上游能力和兼容 provider 的
一部分。

### 模型与 Provider 默认值

用户启动 DeepSeekX 后，默认模型和模型列表应符合 DeepSeekX 预期。

已有集成结论是：

- 内置 provider ID 为 `deepseek`。
- 默认 base URL 为 `https://api.deepseek.com`。
- 默认 env key 为 `DEEPSEEK_API_KEY`。
- DeepSeek runtime 由 provider ID `deepseek` / `deepseek-*` 识别。
- `/model` 只展示 active provider 的 catalog。

推荐做法：

- DeepSeekX build 的默认 `model_provider` 使用 `deepseek`。
- 默认模型使用 DeepSeek 官方推荐的可用模型，例如
  `deepseek-v4-pro` 或项目当前 catalog 的默认项。
- `/model` 不展示 OpenAI 模型，除非用户切换到 OpenAI provider。
- 保留用户显式配置 OpenAI provider 的能力。

这部分不应通过改 `provider.name` 字符串实现。机器语义仍应基于
provider ID 和 runtime capability。

### 安装包、发布物和包名

安装和发行是用户第一感知面，必须独立 DeepSeekX 化。

当前关键位置包括：

- `codex-cli/package.json` 的 `"name": "@openai/codex"`。
- `codex-cli/package.json` 的 `"bin": { "codex": "bin/codex.js" }`。
- `codex-cli/bin/codex.js` 的 optional dependency 包名。
- `codex-cli/scripts/build_npm_package.py` 的 npm 包矩阵。
- `sdk/python-runtime/pyproject.toml` 的 `openai-codex-cli-bin`。
- `sdk/python/src/openai_codex` 的 Python public package。
- `.github/workflows/deepseekx-nightly-artifacts.yml` 的 artifact 命名。
- README、install docs 和 release scripts 中的安装命令。

推荐做法：

- 下游包名使用 `deepseekx` 或组织域名下的包，例如
  `@meomeo-dev/deepseekx`。
- 平台包使用 `deepseekx-darwin-arm64` 等前缀。
- 产物内主可执行文件为 `deepseekx`。
- 产物内主可执行文件仅为 `deepseekx`。
- 不附带 `codex` alias，避免覆盖或遮蔽原版 OpenAI Codex。
- Python SDK 若发布，应采用独立包名，如 `deepseekx` 或
  `deepseekx-sdk`，而不是改写 `openai_codex` 内部后直接复用名称。

包名改造会影响 release workflow、SDK 测试、包元数据和文档，
应单独做。

### Server 模式与 SDK

App Server wire protocol 是外部集成面，但其中许多名称已经是
稳定协议。

应改造的用户感知面：

- 启动命令中的 `codex app-server`。
- app-server 客户端 `client_info.name` 和 `title` 默认值。
- SDK README、examples、package name。
- SDK 默认寻找的 CLI binary。
- 用户可见错误和启动文案。

应保留的协议面：

- JSON-RPC method 名，如 `turn/start`、`thread/read`。
- v2 payload 字段名，如 `codexErrorInfo`。
- schema 类型名 `CodexErrorInfo`。
- 已发布 TypeScript schema 文件结构。
- `x-codex-*` header，除非发布新的 v3 协议或明确兼容别名。

推荐做法：

- v2 协议保持 Codex 命名，避免破坏客户端兼容。
- DeepSeekX SDK 在包装层隐藏这些历史名称。
- DeepSeekX SDK 只寻找 `deepseekx` binary，不 fallback 到 `codex`。
- 若必须新增 DeepSeekX header，先双写 `x-codex-*` 与
  `x-deepseekx-*`，再观察兼容性。
- 不应在 v2 中重命名 `codexErrorInfo`，否则会破坏生成 SDK。

## 可以暂缓或保留 Codex 的面

以下命名不直接影响普通用户感知，建议保留：

- Rust crate 名，如 `codex-core`、`codex-tui`、`codex-app-server`。
- Rust module、trait、struct、enum 中的 Codex 名称。
- 测试 fixture、mock、helper 中的 `test.codex`。
- Bazel target 和 Cargo workspace package 名。
- 内部 telemetry metric 名。
- app-server v1/v2 schema 中已经发布的类型名和字段名。
- `AGENTS.md` 中上游项目开发约束对 `codex-rs` 的描述。
- 上游 README、CLA、SECURITY 等保留型文档，除非 DeepSeekX 要公开发布
  独立项目主页。

这些面大量参与上游 diff。为了减少同步冲突，不应为了换皮而
改动。

## 高风险区域

### 全仓库字符串替换

禁止执行 `codex -> deepseekx` 的全仓库替换。它会破坏：

- crate dependency 名。
- Rust module path。
- app-server wire schema。
- generated SDK。
- snapshot fixture。
- 上游 patch 对齐。

### 配置目录迁移

`~/.codex` 到 `~/.deepseekx` 的迁移涉及 auth、history、sessions、
plugins、skills、themes、managed config、sandbox helper 和 keyring。
DeepSeekX 默认不读原目录；迁移必须是显式动作。

迁移必须满足：

- 不复制 secret，除非用户确认。
- 不删除 legacy 目录。
- 可回滚。
- 日志中不打印 token。
- migration 结果可诊断。

### SDK 包名

Python 的 `openai_codex` 和 npm 的 `@openai/codex` 是公开 API 名。
改名会连带测试、examples、runtime package、artifact workflow 和用户
import 方式。应作为单独 release 任务处理。

## 分阶段建议

第一阶段：低风险感知面。

- 新增 `deepseekx` binary 或 launcher。
- TUI title、status card、placeholder 改为 DeepSeekX。
- `codex exec` 人类可读输出改为 DeepSeekX。
- CLI help 中主命令展示 `deepseekx`。
- 默认 provider 改为 DeepSeek。
- 更新 DeepSeekX 专用 README 或安装说明。

第二阶段：配置隔离层。

- 增加 `DEEPSEEKX_HOME`。
- 默认使用 `~/.deepseekx`。
- 不读取 `CODEX_HOME` 和 `~/.codex`。
- 增加显式迁移提示，不静默读取或移动 secret。
- 更新 schema 文档和用户可见错误提示。

第三阶段：打包和发布。

- npm 包名、平台包名、binary 名改为 DeepSeekX。
- nightly artifact 名改为 DeepSeekX。
- macOS/Windows 安装包名改为 DeepSeekX。
- 不发布 `codex` alias。

第四阶段：SDK 包装。

- 发布 DeepSeekX SDK 包装层。
- 默认寻找 `deepseekx` binary。
- 保持 app-server v2 wire schema 兼容。
- SDK 文档和 examples 使用 DeepSeekX 命名。

## 验收标准

一个用户从零安装并运行 DeepSeekX 时，应满足：

- 安装命令、包名、binary 名是 DeepSeekX。
- `deepseekx --help` 不把主产品描述为 OpenAI Codex。
- TUI 首页和输入框显示 DeepSeekX。
- 默认模型 provider 是 DeepSeek。
- 默认凭据说明使用 `DEEPSEEK_API_KEY`。
- 配置路径优先使用 `DEEPSEEKX_HOME` 或 `~/.deepseekx`。
- 不安装或劫持 `codex` 命令。
- 不读取 `CODEX_HOME` 或 `~/.codex` 作为 DeepSeekX 配置。
- app-server v2 客户端不因内部 Codex wire 名称保留而破坏。

## 后续实现边界

后续实现应按小提交拆分：

- `deepseekx` CLI launcher 和帮助文本。
- TUI 品牌文案和 snapshot。
- DeepSeek 默认 provider。
- 配置 home 兼容层。
- release package 命名。
- SDK 包装层。

每个提交只改一个用户可见面。不要把 TUI snapshot、配置迁移和
打包命名混在同一个提交里。
