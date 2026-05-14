---
name: we-deepseek-cache-bench
description: Use when planning or running DeepSeek app-server/cache runtime
  benchmarks or live E2E checks for DeepSeekX provider behavior.
---

# we-deepseek-cache-bench

用于 DeepSeek runtime 实测（runtime benchmark / live E2E），尤其是
DeepSeek Chat Completions、KV cache、tool calls、thinking
`reasoning_content` 回放和 app-server 集成验证。

## 范围

- 规划或运行 DeepSeek provider live E2E。
- 复核 `docs/deepseek-api` 中记录的协议不变量。
- 用 Docker 或隔离目录运行 app-server/cache benchmark。
- 归档 prompts、logs、usage、report 和可复现命令。
- 检查 DeepSeek 官方 API 文档快照是否相对仓库内容发生 drift。

## 非目标

- 不默认运行真实 DeepSeek API；需要用户确认网络、费用和 API key 边界。
- 不打印 `DEEPSEEK_API_KEY`、`.env`、token 或凭据内容。
- 不把 benchmark 输出混入 release package。
- 不替代普通 unit tests；代码变更仍按 `$we-feature-dev` 检查。

## 必守不变量

- DeepSeek provider 使用 Chat Completions wire API。
- 请求不得伪造 OpenAI Responses `prompt_cache_key`。
- tool call 历史必须保留 matching `tool_call_id`。
- thinking + tool 轮次必须回放对应 `reasoning_content`。
- web search、image generation 和 Responses namespace hosted tools
  不应暴露给 DeepSeek runtime。
- cache hit/miss usage 应能进入统计或报告。

## 建议流程

1. 明确要验证的是 unit path、live API path 还是 app-server path。
2. 阅读相关设计文档：
   - `docs/deepseek-api/integration/deepseek-chat-cache-tool-audit.md`
   - `docs/deepseek-api/integration/reasoning-cache-history-analysis.md`
   - `docs/deepseek-api/integration/deepseek-json-output-repair-design.md`
3. 检查工作区，确认不会提交 `.env`、logs、cache 或 benchmark 输出。
4. 如需真实 API，要求用户确认费用和凭据提供方式。
5. 运行最小 live E2E 或 app-server benchmark。
6. 把结果归档到本技能 `data/<case-id>/` 或用户指定路径。
7. 输出结论：通过、失败、不可判定和下一步修复建议。

## DeepSeek API Drift Check

只读 drift check 使用临时目录重新抓取 DeepSeek 官方文档，然后与仓库
快照比较。该检查只向公开文档 URL 发起 GET，不上传源码，不修改
`docs/deepseek-api/snapshots/`。

```bash
.agents/skills/we-deepseek-cache-bench/scripts/check_deepseek_api_drift.sh
```

输出包含：

- 临时抓取目录。
- 每个 snapshot 的 diff 摘要。
- `drift=none`、`drift=detected` 或 `drift=check_failed`。

如发现 drift，不要自动更新 snapshots。先阅读 diff，判断是否需要
更新 `docs/deepseek-api`、协议适配或测试。

## Benchmark Scripts

迁移后的 helper scripts 位于：

```text
.agents/skills/we-deepseek-cache-bench/scripts/
```

主要入口：

- `run_guided_app_server_turn.py`：运行单轮动态监督 app-server turn。
- `run_app_server_cache_benchmark.py`：运行 legacy fixed prompt pack。
- `check_dashboard.py`：检查 first-party line count 和 runnable scripts。
- `generate_report_deck.py`：从 `state.json` 生成 HTML 报告。
- `archive_benchmark_case.py`：把 project 和 experiment 归档进 `data/`。
- `check_deepseek_api_drift.sh`：只读检查 DeepSeek API 文档 drift。

新命令应优先使用 `--deepseekx-bin` 和 `--deepseekx-home`。脚本保留
`--codex-bin` 和 `--codex-home` 作为历史别名，避免旧归档命令失效。

## Docker Benchmark

真实 benchmark 默认在 Docker 中执行。模板位于：

```text
.agents/skills/we-deepseek-cache-bench/templates/
```

启动隔离容器：

```bash
.agents/skills/we-deepseek-cache-bench/templates/docker-run.sh \
  deepseekx-cache-bench "$(pwd)" 5173
```

容器使用 `DEEPSEEK_API_KEY.env` 注入凭据。该文件不得提交，不得在输出中
回显内容。

## Dynamic Turn Command

容器内单轮命令示例：

```bash
python3 /bench/skill/scripts/run_guided_app_server_turn.py \
  --deepseekx-bin /bench/target/debug/deepseekx \
  --workspace /bench/<case-id>/workspace \
  --deepseekx-home /bench/<case-id>/deepseekx-home \
  --report-dir /bench/<case-id>/experiment \
  --prompt-file /bench/<case-id>/experiment/next-prompt.md \
  --turn-name <short-turn-name> \
  --preview-port 5173 \
  --effort high
```

第一轮加 `--new-thread`。后续轮次复用 `state.json` 中的 thread。

## 归档规则

每个 benchmark 使用独立 case id：

```text
YYYYMMDD-HHMMSS-<short-topic>
```

建议布局：

```text
.agents/skills/we-deepseek-cache-bench/data/<case-id>/
├── manifest.json
├── RUN_COMMAND.txt
├── project/
└── experiment/
```

不要归档 secrets、`.env`、token、full auth headers、private cache 或
不必要的大型 build 目录。

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
    for i, line in enumerate(path.read_text(errors='ignore').splitlines(), 1):
        if len(line) > 88:
            print(f'{path}:{i}:{len(line)}')
PY
```

`data/` 下的 benchmark 归档是历史运行记录，允许包含 HTML、JSON、
日志和生成项目中的长行；验证时只检查技能说明、scripts 和 templates。

## Final Response

报告：

- case id 和验证目标。
- 是否使用真实 DeepSeek API。
- 运行命令和结果。
- cache/tool/reasoning/app-server 结论。
- 归档路径。
- 未解决风险和下一步建议。
