---
name: we-deepseek-cache-bench
description: Use when running DeepSeekX LLM request cache-hit benchmarks by
  guiding one long-lived app-server thread through a real multi-turn web app
  build and measuring cached input tokens.
---

# we-deepseek-cache-bench

用于 DeepSeekX LLM 请求缓存命中率基准测试（LLM request cache-hit
benchmark）。目标不是测试仓库代码本身，而是让同一个 DeepSeekX
app-server thread 通过多轮真实开发构建一个完整可运行的网页全栈项目，
再统计每轮 LLM 请求的 `inputTokens`、`cachedInputTokens`、miss tokens、
request count、context window 和 cache hit rate。

## 范围

- 运行 DeepSeekX + DeepSeek provider 的 live app-server cache benchmark。
- 使用单个长生命周期 thread，逐轮观察 DeepSeek 请求缓存命中率。
- 每轮只执行一次 `run_guided_app_server_turn.py`。
- 主控 Agent 根据上一轮产物、日志和 `state.json` 动态写下一轮
  `experiment/next-prompt.md`。
- 构建一个真实、完整、可运行、可由用户打开体验的网页全栈项目。
- 归档 prompts、JSON-RPC logs、usage、source、report 和可复现命令。
- 可选只读预检：检查 DeepSeek 官方 API 文档快照是否发生 drift。

## 非目标

- 不替代 DeepSeekX 仓库的 unit tests、Rust tests、CI 或 release gates。
- 不把 benchmark 当作代码正确性测试；项目内测试只是产物验收手段。
- 不用固定 prompt pack 跑新 benchmark。
- 不用脚本批量生成模板源码、填充行数或制造假项目。
- 不默认运行真实 DeepSeek API；需要用户确认网络、费用和 API key 边界。
- 不打印 `DEEPSEEK_API_KEY`、`.env`、token 或凭据内容。
- 不把 benchmark 输出混入 npm package 或 release artifact。

## 核心不变量

- DeepSeek provider 使用 Chat Completions wire API。
- 请求不得伪造 OpenAI Responses `prompt_cache_key`。
- benchmark 指标来自 app-server `thread/tokenUsage/updated` 事件。
- 缓存命中率按 `cachedInputTokens / inputTokens` 计算。
- 第一轮使用 `--new-thread`；后续轮次复用 `state.json` 中的 thread。
- 每轮 prompt 文件路径固定为：
  `/bench/<case-id>/experiment/next-prompt.md`。
- `next-prompt.md` 必须由主控 Agent 在读完上一轮结果后动态重写。
- 每一轮都要像真实产品开发一样规划、实现、运行、修复和验收。
- 不允许要求模型运行脚本来批量生成模板代码或无意义 filler code。
- 最终项目 first-party source 总行数必须大于 10,000 行。
- 最终项目必须能在容器中通过端口打开，用户能体验页面。

## 推荐 Case Layout

每个 benchmark 使用独立 case id：

```text
YYYYMMDD-HHMMSS-<short-topic>
```

容器内推荐布局：

```text
/bench/<case-id>/
├── workspace/
├── deepseekx-home/
└── experiment/
    ├── next-prompt.md
    ├── state.json
    ├── report.md
    ├── jsonrpc-turn-01.log
    └── stderr-turn-01.log
```

归档到技能目录时使用：

```text
.agents/skills/we-deepseek-cache-bench/data/<case-id>/
├── manifest.json
├── RUN_COMMAND.txt
├── project/
└── experiment/
```

不要归档 secrets、`.env`、token、full auth headers、private cache 或
不必要的大型 build 目录。

## Docker Benchmark

真实 benchmark 默认在 Docker 中执行。模板位于：

```text
.agents/skills/we-deepseek-cache-bench/templates/
```

启动隔离容器：

```bash
.agents/skills/we-deepseek-cache-bench/templates/docker-run.sh \
  deepseekx-cache-bench DEEPSEEK_API_KEY.env 5173
```

容器使用 `DEEPSEEK_API_KEY.env` 注入凭据。该文件不得提交，不得在输出中
回显内容。

第二个参数也可以是包含 `DEEPSEEK_API_KEY.env` 的目录，用于兼容旧调用；
脚本只读取该目录下的凭据文件，不会挂载整个目录。

Docker 容器内必须安装并使用已发布的同平台 npm 包：

```bash
npm install -g @meomeo-dev/deepseekx@latest \
  --registry https://registry.npmjs.org
command -v deepseekx
deepseekx --version
```

原因：容器是 Linux 环境，本机 `codex-rs/target/debug/deepseekx` 或
`target/release/deepseekx` 可能是 macOS binary，不能挂进容器当作
benchmark runtime。不要把 repo build artifact 当作 Docker 默认入口。

在容器中运行脚本时，只有本 benchmark 技能目录会只读挂载到 `/skill`。
不要把整个仓库挂进容器；DeepSeekX runtime 必须来自容器内 npm 包。

```text
/skill/scripts/
```

## Dynamic Turn Loop

推荐路径是动态监督循环（guided dynamic loop），不是固定 prompt pack。

1. 创建 case 目录、空 workspace 和隔离 `deepseekx-home`。
2. 主控 Agent 写第一轮 `experiment/next-prompt.md`。
3. 第一轮运行 `run_guided_app_server_turn.py --new-thread`。
4. 读取 `experiment/state.json`、`report.md`、JSON-RPC log 和项目文件。
5. 主控 Agent 判断当前缺口：产品切片、架构、数据、交互、运行错误、
   验收脚本、端口预览或行数不足。
6. 主控 Agent 覆盖写入新的 `experiment/next-prompt.md`。
7. 不带 `--new-thread` 再跑下一轮。
8. 重复直到满足停止条件。

单轮命令示例：

```bash
skill=/skill
python3 "$skill/scripts/run_guided_app_server_turn.py" \
  --deepseekx-bin "$(command -v deepseekx)" \
  --workspace /bench/<case-id>/workspace \
  --deepseekx-home /bench/<case-id>/deepseekx-home \
  --report-dir /bench/<case-id>/experiment \
  --prompt-file /bench/<case-id>/experiment/next-prompt.md \
  --turn-name <short-turn-name> \
  --preview-port 5173 \
  --effort high
```

第一轮加 `--new-thread`。后续轮次必须复用同一个 report dir 和 workspace。
如果 `command -v deepseekx` 为空，先安装 npm package，不要回退到本机
debug binary。

## Prompt Writing Rules

每个 `next-prompt.md` 必须基于上一轮实际状态编写：

- 引用上一轮已完成内容、失败命令、缺失文件或运行状态。
- 指定下一轮要完成的真实产品功能或修复范围。
- 要求模型自己阅读当前项目并继续设计，不假设固定模板结构。
- 要求运行必要的本地验证和启动命令。
- 要求报告行数、运行方式、预览 URL 和剩余风险。
- 可以要求新增测试或验证脚本，但这些只是项目验收手段。

禁止写入：

- 预先固定的多轮 prompt 队列。
- “生成 N 个模块以凑够行数”之类 filler 指令。
- 用脚本批量写模板源码的指令。
- 跳过真实运行、只产出静态文件的指令。

## 项目验收条件

正式 benchmark 停止前必须同时满足：

- 最后一轮 `turnReports[-1].status` 为成功状态。
- `state.json` 中每轮都有 token usage 或明确说明缺失原因。
- `lineCount.lineCount > 10000`，且统计排除 `node_modules`、`dist`、
  `build`、`coverage`、lockfiles 和二进制资源。
- 项目有可运行入口，例如 `npm run dev`、`npm start` 或 `npm run preview`。
- 服务绑定到 `0.0.0.0:<preview-port>`。
- 用户可以通过宿主机端口打开网页并体验主要功能。
- 页面不是占位 demo；应包含多个 coherent product domains、数据流、
  交互、错误状态和基本验收脚本。
- `report.md` 或 HTML report 包含逐轮 cache hit rate、input、cached、
  miss、request count、context window 和耗时。

## Benchmark Scripts

主要入口：

- `run_guided_app_server_turn.py`：推荐入口。执行一轮动态监督 turn，
  复用同一个 app-server thread，并更新 `state.json` 和 `report.md`。
- `check_dashboard.py`：验收辅助。检查 first-party line count 和 runnable
  package scripts，不代表 DeepSeekX 仓库测试。
- `generate_report_deck.py`：从 `state.json` 生成 HTML 报告。
- `archive_benchmark_case.py`：把 project 和 experiment 归档进 `data/`。
- `check_deepseek_api_drift.sh`：可选只读预检，检查 DeepSeek API 文档
  drift。

Legacy only：

- `run_app_server_cache_benchmark.py`：历史 fixed prompt pack runner。
  新 benchmark 不使用它。
- `data/dashboard_task_prompts.json`：历史 prompt pack 示例，只能作为
  归档参考，不能作为新 benchmark 的执行计划。

新命令应优先使用 `--deepseekx-bin` 和 `--deepseekx-home`。脚本保留
`--codex-bin` 和 `--codex-home` 作为历史别名，避免旧归档命令失效。

## Validation

维护本技能后运行：

```bash
bash -n .agents/skills/we-deepseek-cache-bench/scripts/*.sh
python3 -m py_compile .agents/skills/we-deepseek-cache-bench/scripts/*.py
python3 - <<'PY'
from pathlib import Path
root = Path('.agents/skills/we-deepseek-cache-bench')
for path in root.rglob('*'):
    if not path.is_file():
        continue
    if 'data' in path.relative_to(root).parts:
        continue
    if '__pycache__' in path.relative_to(root).parts:
        continue
    for i, line in enumerate(path.read_text(errors='ignore').splitlines(), 1):
        if len(line) > 88:
            print(f'{path}:{i}:{len(line)}')
PY
```

`data/` 下的 benchmark 归档是历史运行记录，允许包含 HTML、JSON、日志
和生成项目中的长行；验证时只检查技能说明、scripts 和 templates。

## Final Response

报告：

- case id 和 benchmark 目标。
- 是否使用真实 DeepSeek API。
- 每轮 turn name、prompt 来源、状态和 cache hit rate。
- input、cached、miss、request count 和 context window 汇总。
- 最终项目行数、启动命令、端口和用户可访问 URL。
- 归档路径。
- 未解决风险和下一轮建议。
