---
name: deepseek-branch-sync
description: Safely synchronize a long-lived DeepSeek integration branch with
  the latest main branch using GitHub Flow style guardrails, preflight checks,
  non-destructive merge defaults, and explicit verification before commits or
  pushes.
---

# DeepSeek Branch Sync

Use this skill when maintaining a long-lived DeepSeek integration branch that
needs the latest `main` changes. The goal is safe synchronization, not speed.

## Branch Model

- `main`: local mirror of upstream mainline.
- `feature/deepseek-api-integration` or `deepseek`: long-lived DeepSeek line.
- Short task branches may branch from the DeepSeek line when useful.
- Prefer merge from `origin/main` into the DeepSeek line.
- Do not rebase a shared DeepSeek branch unless the user explicitly requests
  history rewrite and accepts the risk.

## Hard Safety Rules

- Never run `git reset --hard`, `git checkout --`, or destructive cleanups.
- Never force push.
- Never include secrets such as `DEEPSEEK_API_KEY.env`.
- Do not stash or drop user changes unless the user explicitly asks.
- Do not switch branches with a dirty worktree unless dirty paths are known
  and harmless, or the user has approved.
- If conflicts occur, stop after reporting conflicted files unless the user
  asked to resolve them.
- Prefer `git fetch origin` plus `git merge origin/main` while on the
  DeepSeek branch.

## Preflight

Run the read-only preflight script before any sync operation:

```bash
.codex/skills/we/deepseek-branch-sync/scripts/preflight_branch_sync.sh \
  feature/deepseek-api-integration origin/main
```

Review:

- current branch
- dirty tracked files
- untracked files
- ahead/behind counts
- merge-base with `origin/main`
- whether the target branch exists locally

If `DEEPSEEK_API_KEY.env` or other secret-like files are present, leave them
untracked and mention that they were intentionally not touched.

## Safe Sync Procedure

Use this when the user asks to bring the DeepSeek branch up to date.

```bash
git fetch origin
git switch feature/deepseek-api-integration
git merge --no-ff origin/main
```

If the branch does not exist locally:

```bash
git fetch origin
git switch -c feature/deepseek-api-integration origin/main
```

Only use a shorter `deepseek` branch name if the user confirms renaming or
creating it. Renaming a shared branch changes collaboration habits, so do not
do it implicitly.

## Conflict Handling

On conflict:

1. Run `git status --short`.
2. List conflicted files with `git diff --name-only --diff-filter=U`.
3. Inspect conflicts before editing.
4. Resolve with minimal changes that preserve both mainline and DeepSeek work.
5. Run focused checks for touched areas.
6. Commit the merge only after conflicts and checks are resolved.

Do not use `git merge --abort` unless the user asks or the merge is clearly
not recoverable. If aborting is proposed, explain the reason first.

## Post-Merge Checks

After a clean merge:

- Run `git status --short`.
- Run focused tests for changed areas.
- For Rust changes under `codex-rs`, follow project `AGENTS.md`:
  `just fmt`, focused `cargo test -p ...`, and scoped `just fix -p ...`
  when Rust code changed.
- If only skill docs or archived benchmark artifacts changed, use static
  checks such as Python syntax, JSON validation, and line length checks.

## Commit Guidance

Commit only the intended merge or sync changes.

Recommended merge commit message:

```text
Merge origin/main into DeepSeek integration branch
```

If only creating the skill or documentation, use a normal feature commit.

## Final Response

Report:

- current branch
- fetched upstream ref
- merge result or reason it was not run
- conflicts, if any
- tests/checks run
- commit hash, if a commit was created
- remaining untracked or dirty files
