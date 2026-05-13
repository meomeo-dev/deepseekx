---
name: we:deepseek-cache-bench
description: Run a Docker-isolated Codex app-server benchmark that dynamically
  supervises deepseek-v4-pro while it builds a production-grade runnable
  10,000+ line dashboard, then preserves source, logs, stats, report HTML, and
  run commands under this skill's data/<bench-case-id>/ directory.
---

# DeepSeek Cache Benchmark

Use this skill for a reproducible DeepSeek prompt-cache benchmark. The
benchmark is not a fixed prompt replay. Codex must supervise DeepSeek turn by
turn, inspect the artifact after each turn, then write the next prompt based on
the current code quality, test failures, and remaining product gaps.

## Non-Negotiable Standard

- Run inside Docker. Mount the project checkout read-only at `/src`.
- Use `codex app-server` in server mode inside the container.
- Use `modelProvider = "deepseek"` and `model = "deepseek-v4-pro"`.
- Keep `DEEPSEEK_API_KEY` only in container env or env-file. Never print it.
- The dashboard must be written by DeepSeek through app-server turns.
- Target at least 10,000 meaningful first-party lines.
- The final artifact must be production-standard and complete enough to run.
- Do not use generated filler, duplicated boilerplate, or a prebuilt local
  generator to satisfy line count.
- Every run gets a new benchmark case ID and a new output directory:
  `data/<bench-case-id>/`.
- Preserve the complete runnable project, experiment logs, stats, HTML report,
  validation log, prompts, and start command for the case.
- Token usage reports must use the full current turn cost, not only the final
  model request in the turn.
- Reports must show the configured think effort and observed
  `modelContextWindow`.

## Definitions

`bench-case-id`:

- Use `YYYYMMDD-HHMMSS-<short-topic>` unless the user gives an ID.
- Example: `20260513-101530-dashboard-cache`.

First-party line count:

- Count text files in the produced project.
- Exclude `node_modules`, `.git`, `dist`, `build`, `coverage`, lockfiles, and
  binary image files.
- Use `scripts/check_dashboard.py --min-lines 10000` for the final gate.

Complete runnable project:

- Has a `package.json` with `dev`, `start`, or `preview`.
- Starts a browser-accessible service inside Docker on the chosen port.
- Has deterministic validation/test commands recorded in `validation-latest.log`.
- Includes all source and fixture files needed to run without host mutation.

Token usage:

- `thread/tokenUsage/updated` exposes `tokenUsage.last` and `tokenUsage.total`.
- `last` is one model request. A single turn can make many model requests.
- `total` is cumulative for the live thread session and may include prior turns.
- Per-turn cost is `sum(tokenUsage.last)` for events whose `turnId` matches the
  current `turn/start` response.
- Reports must preserve `finalRequestUsage` and `cumulativeUsage`, but cache
  hit rate must be computed from the per-turn summed `usage`.
- Persist `reasoningEffort` from `turn/start.effort`.
- Persist `modelContextWindow` from `thread/tokenUsage/updated`.

## Required Case Layout

After every completed benchmark, archive this layout under the skill:

```text
.codex/skills/we/deepseek-cache-bench/data/<bench-case-id>/
├── manifest.json
├── RUN_COMMAND.txt
├── project/
│   └── ... complete runnable dashboard project ...
└── experiment/
    ├── state.json
    ├── report.md
    ├── report.html
    ├── validation-latest.log
    ├── prompt-01.md
    ├── prompt-02.md
    ├── jsonrpc-turn-1.log
    └── stderr-turn-1.log
```

`manifest.json` must name the model, provider, thread ID, preview port, line
count, think effort, model context window, source paths, and start command.
`RUN_COMMAND.txt` must be directly usable from inside `project/`.

## Files

- `scripts/run_guided_app_server_turn.py`: run one dynamic app-server turn,
  resume the same thread from `state.json`, and archive the prompt used.
  It records summed per-turn usage plus final-request and cumulative usage.
- `scripts/check_dashboard.py`: line count and runnable entry checks.
- `scripts/generate_report_deck.py`: build `report.html` from `state.json`
  and `validation-latest.log`.
- `scripts/archive_benchmark_case.py`: copy project and experiment output into
  `data/<bench-case-id>/`.
- `templates/Dockerfile`: benchmark image with Rust, Python, Node, npm.
- `templates/docker-run.sh`: build image and start the sandbox container.
- `templates/config.toml`: minimal DeepSeek Codex config.
- `data/dashboard_task_prompts.json`: legacy fixed prompt pack. Do not use it
  for the supervised benchmark unless the user explicitly asks for fixed
  replay.

## Dynamic Supervision Loop

1. Create a new case ID and isolated container paths:
   `/bench/<case-id>/workspace`, `/bench/<case-id>/codex-home`,
   `/bench/<case-id>/experiment`.
2. Copy `templates/config.toml` to the case `codex-home/config.toml`.
3. Copy the skill scripts into `/bench/skill/scripts` if the container does
   not already have the current versions.
4. Write a first prompt to `/bench/<case-id>/experiment/next-prompt.md`.
   The first prompt must ask for a real runnable dashboard foundation, not
   10,000 lines in one pass.
5. Run exactly one turn with `run_guided_app_server_turn.py`.
6. Inspect the produced project before writing the next prompt:
   - file tree and module boundaries
   - app entry point and package scripts
   - line count and top files
   - tests, validation scripts, and browser entry
   - whether new code is meaningful or filler
7. Write the next prompt to fix the highest-priority issue or add one coherent
   product slice.
8. Repeat until the artifact is 10,000+ lines, runnable, and fully validated.
9. Run final validation, generate `report.html`, start the preview service,
   and archive the case to this skill's `data/<bench-case-id>/` directory.

Do not batch several future prompts at once. Each turn prompt must be based on
the previous turn's actual output.

## One-Turn Command

Run this from inside the container. Use a fresh `--prompt-file` for each turn.

```bash
python3 /bench/skill/scripts/run_guided_app_server_turn.py \
  --codex-bin /bench/target/debug/codex \
  --workspace /bench/<case-id>/workspace \
  --codex-home /bench/<case-id>/codex-home \
  --report-dir /bench/<case-id>/experiment \
  --prompt-file /bench/<case-id>/experiment/next-prompt.md \
  --turn-name <short-turn-name> \
  --preview-port 5173 \
  --effort high
```

For the first turn only, add `--new-thread`. Do not use `--new-thread` after
`state.json` has turn reports.

## Prompt Rules

Each prompt should:

- Ask for one product slice or one quality repair.
- Require commands to be run at the end.
- Prohibit filler, repeated data, repeated comments, and generated padding.
- Preserve existing working behavior and tests.
- Ask DeepSeek to report changed files, validation result, and current line
  count.

Preferred sequence:

- Start with foundation and runnable app shell.
- Add state, fixtures, domain logic, and tests.
- Add one workflow slice per turn.
- Insert quality repair turns whenever inspection finds structural issues.
- Finish with production readiness: validation, preview, docs, run command,
  and reportable test output.

## Final Validation

Run validation from the produced project and tee it to the experiment log.
Adapt command names to the actual `package.json`, but include all available
test scripts.

```bash
cd /bench/<case-id>/workspace
{
  date -u +"validationUtc=%Y-%m-%dT%H:%M:%SZ"
  node --check src/app.js 2>/dev/null || true
  npm run validate
  npm test
  npm run test-cs 2>/dev/null || true
  npm run test-html 2>/dev/null || true
  npm run test-command 2>/dev/null || true
  npm run test-module 2>/dev/null || true
  npm run test-billing 2>/dev/null || true
  npm run test-forecasting 2>/dev/null || true
  npm run test-usage 2>/dev/null || true
} > /bench/<case-id>/experiment/validation-latest.log 2>&1
```

The final gate must also pass:

```bash
python3 /bench/skill/scripts/check_dashboard.py \
  --workspace /bench/<case-id>/workspace \
  --min-lines 10000
```

## Report And Preview

Generate the HTML deck:

```bash
python3 /bench/skill/scripts/generate_report_deck.py \
  --state /bench/<case-id>/experiment/state.json \
  --validation-log /bench/<case-id>/experiment/validation-latest.log \
  --output /bench/<case-id>/experiment/report.html \
  --title "DeepSeek 缓存命中基准测试" \
  --subtitle "动态监督、真实 dashboard 开发、10,000+ 行可运行产物。"
```

The deck must display model, provider, thread ID, think effort, context
window, request count, per-turn input/cached/miss tokens, and validation
summary.

Start preview from the produced project. Record the exact command in
`RUN_COMMAND.txt`.

```bash
cd /bench/<case-id>/workspace
nohup npm run preview -- --host 0.0.0.0 --port 5173 \
  > /bench/<case-id>/preview.log 2>&1 &
```

If the project uses a different script, use the actual working command and
write that command to `RUN_COMMAND.txt`.

## Archive Command

After preview and validation pass, archive the complete case into the skill.
Run from the host checkout:

```bash
python3 .codex/skills/we/deepseek-cache-bench/scripts/archive_benchmark_case.py \
  --case-id <case-id> \
  --workspace /path/or/container/export/of/workspace \
  --report-dir /path/or/container/export/of/experiment \
  --output-root .codex/skills/we/deepseek-cache-bench/data \
  --preview-port 5173 \
  --start-command "npm run preview -- --host 0.0.0.0 --port 5173"
```

When paths are only inside Docker, first `docker cp` the case workspace and
experiment directory to a temporary host path, then archive from that temp
path. Do not archive secrets or `DEEPSEEK_API_KEY`.

## Final Response

Keep the final response short and include:

- `bench-case-id`
- container name and preview URL
- archived case directory
- line count and file count
- validation summary
- think effort and model context window
- cache table or weighted hit rate
- exact run command for the archived project
