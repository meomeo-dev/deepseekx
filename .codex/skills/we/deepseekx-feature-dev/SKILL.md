---
name: we:deepseekx-feature-dev
description: Develop DeepSeek downstream features from deepseekx/main with
  branch preflight, safe feature branches, focused checks, and PR-ready commit
  hygiene.
---

# DeepSeekX Feature Development

Use this skill when the user asks to implement a normal DeepSeekX downstream
feature, fix, refactor, or project-local workflow change. This skill protects
daily development from branch confusion in a stateless LLM session.

## Scope

- Develop from `deepseekx/main` into `deepseekx/<feature-slug>`.
- Prepare changes for PR back into `deepseekx/main`.
- Do not synchronize upstream OpenAI mainline here. Use
  `$we:deepseek-branch-sync` for `upstream/main -> deepseekx/main`.
- Do not publish releases or tags here.

## Required Branch Model

- `origin`: `https://github.com/meomeo-dev/deepseekx.git`.
- `upstream`: `https://github.com/openai/codex.git`.
- `deepseekx/main`: downstream integration trunk.
- `deepseekx/<feature-slug>`: feature branch for ordinary development.

## Hard Entry Gate

Before reading code for implementation or editing files, run:

```bash
.codex/skills/we/deepseekx-feature-dev/scripts/preflight_feature_dev.sh
```

Review:

- current branch
- remote URLs
- tracked dirty files
- untracked files
- secret-like untracked paths
- relation to `origin/deepseekx/main`
- relation between `deepseekx/main` and `upstream/main`

If only `DEEPSEEK_API_KEY.env` is untracked, continue but state that it will
not be staged or committed.

## Branch Rules

- Never implement ordinary feature work directly on `deepseekx/main`.
- If currently on `deepseekx/main`, create a feature branch first.
- If currently on `deepseekx/<feature-slug>`, continue only after preflight.
- If currently on `feature/deepseek-api-integration`, stop and migrate first.
- If currently on any non-`deepseekx/*` branch, stop and explain the risk.
- Do not switch branches with tracked dirty files unless the user approves.
- Do not stash, drop, reset, clean, or force push user work.

Create a feature branch from `deepseekx/main`:

```bash
git switch deepseekx/main
git switch -c deepseekx/<feature-slug>
```

Use a concise lowercase kebab-case slug tied to the request.

## Development Workflow

1. Run preflight and decide whether a feature branch is required.
2. Inspect relevant code, tests, and `AGENTS.md` rules before editing.
3. Make scoped changes that follow existing project patterns.
4. Run focused checks for the touched area.
5. Stage only intended files.
6. Commit with a concise message when the user asks or the task requires it.
7. Push with `git push -u origin deepseekx/<feature-slug>` when PR work is
   requested.

## Validation

For Rust changes under `codex-rs`, follow project `AGENTS.md`:

- run `just fmt` from `codex-rs`
- run focused `cargo test -p <crate>`
- run `just fix -p <crate>` before finalizing substantial Rust changes

For skill-only changes:

```bash
target=.codex/skills/we/<short_name>
bash -n "$target"/scripts/*.sh
python3 - <<'PY'
from pathlib import Path
root = Path('.codex/skills/we/<short_name>')
for path in root.rglob('*'):
    if not path.is_file():
        continue
    for i, line in enumerate(path.read_text(errors='ignore').splitlines(), 1):
        if len(line) > 88:
            print(f'{path}:{i}:{len(line)}')
PY
```

Use narrower commands when only one skill changed.

## Commit Hygiene

Before every commit:

```bash
git status --short
git diff --cached --name-only
```

Confirm:

- no `.env`, key, token, credential, or scratch research files are staged
- no unrelated user changes are staged
- generated files are intentional
- `DEEPSEEK_API_KEY.env` remains untracked if present

## PR Guidance

When creating a PR, base it on `deepseekx/main`, not `upstream/main`.

```bash
gh pr create --base deepseekx/main --head deepseekx/<feature-slug>
```

Include changed areas, checks run, and any skipped checks with reasons.

## Final Response

Report:

- current branch
- whether preflight passed
- files changed
- checks run
- commit hash, if committed
- push or PR URL, if created
- remaining dirty or untracked files
