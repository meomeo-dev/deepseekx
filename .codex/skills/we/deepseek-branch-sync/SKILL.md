---
name: we:deepseek-branch-sync
description: Safely synchronize a long-lived DeepSeek integration branch with
  an upstream openai/codex version ref using version-aligned sync branches,
  preflight checks, non-destructive merge defaults, and explicit verification.
---

# DeepSeek Branch Sync

Use this skill when maintaining the DeepSeek downstream trunk
`deepseekx/main` and aligning it with a specific upstream `openai/codex`
version. The goal is version-aligned downstream integration, not tracking
arbitrary upstream mainline head.

## Remote And Branch Model

- `origin`: fork remote, `https://github.com/meomeo-dev/deepseekx.git`.
- `upstream`: source remote, `https://github.com/openai/codex.git`.
- `upstream/main`: upstream OpenAI Codex mainline, used only to discover or
  inspect candidates.
- `rust-v<version>`: preferred upstream Codex Rust release tag.
- `deepseekx/main`: long-lived DeepSeek downstream trunk.
- `deepseekx/sync/<version>`: short-lived version sync branch.
- `deepseekx/<feature>`: short-lived downstream feature branch.
- Prefer merge from a concrete upstream release tag or commit into
  `deepseekx/sync/<version>`, then integrate that branch into
  `deepseekx/main`.
- Do not use this skill for ordinary feature development. Use
  `$we:deepseekx-feature-dev` for feature work.
- Do not rebase a shared DeepSeek branch unless the user explicitly requests
  history rewrite and accepts the risk.
- Use `$we:deepseekx-github-flow` for push, PR, merge-to-main, tag, and
  branch cleanup confirmation after the sync branch is ready.

## Role Contract

- 用户是发起者（user as initiator）。
- AI/LLM 是执行者（LLM as executor）。
- 用户选择要同步的 upstream version ref、集成方式、是否推送、是否合并、
  是否创建 downstream tag。
- 执行者负责预检、创建 sync 分支、合并 upstream ref、解决冲突和验证。
- 用户只说“看下”“分析”“是否需要”时，默认不要合并、推送或打 tag。

## Version Alignment Policy

- Default source is an upstream release tag, for example `rust-v0.131.0`.
- If no suitable release tag exists, use an explicit upstream commit SHA.
- Do not silently use `upstream/main` as the sync source.
- Record the chosen upstream ref in the sync branch name and merge message.
- Branch name format:
  `deepseekx/sync/rust-v0.131.0` or
  `deepseekx/sync/<short-sha>`.
- Create sync branches from `origin/deepseekx/main`, not from stale local
  `deepseekx/main`, unless the user explicitly says the local trunk is the
  source of truth.
- Keep sync branches temporary. Delete them after they are integrated and the
  user confirms cleanup.

## Branch Timeline Model

Use this model when explaining sync work to the user:

```text
time --->

upstream/openai-codex:
  U0 ---- U1 ---- U2 ---- U3 ---- U4
                  |             |
                  |             rust-v0.132.0
                  rust-v0.131.0

origin/deepseekx:
  deepseekx/main:
  D0 ---- D1 ---- D2 ---------------- M131 ---- F3 ---- M132
          |                           /                 /
          |                          /                 /
  feature branches:                 /                 /
    F1 ---- F2 --------------------'                 /
                                                     /
  sync branches:                                    /
    deepseekx/sync/rust-v0.131.0:  S131 -----------'
    deepseekx/sync/rust-v0.132.0:                S132
```

Meanings:

- `U*`: upstream OpenAI Codex commits.
- `rust-v*`: chosen upstream version tags.
- `D*`: DeepSeekX downstream trunk commits.
- `F*`: DeepSeekX feature commits.
- `S*`: temporary version sync branches.
- `M*`: merge commits that integrate a sync branch into `deepseekx/main`.

Downstream features and upstream version syncs should meet only through
`deepseekx/main`. Do not develop features directly on a sync branch.

## Hard Safety Rules

- Never run `git reset --hard`, `git checkout --`, or destructive cleanups.
- Never force push.
- Never include secrets such as `DEEPSEEK_API_KEY.env`.
- Do not stash or drop user changes unless the user explicitly asks.
- Do not switch branches with a dirty worktree unless dirty paths are known
  and harmless, or the user has approved.
- If conflicts occur, stop after reporting conflicted files unless the user
  asked to resolve them.
- Prefer `git fetch upstream tag <version>` plus a merge into
  `deepseekx/sync/<version>`.
- Do not merge upstream code directly into `deepseekx/main` unless the user
  has explicitly chosen direct local integration.

## Clean Worktree Gate

Before fetching, merging, or analyzing an upstream version sync, require a
clean worktree:

```bash
.codex/skills/we/deepseekx-worktree-clean/scripts/preflight_worktree_clean.sh \
  --require-clean
```

If this fails, stop the sync workflow and use `$we:deepseekx-worktree-clean`.
After the worktree is clean, restart this skill from the beginning.

## Preflight

Run the read-only preflight script before any sync operation:

```bash
.codex/skills/we/deepseek-branch-sync/scripts/preflight_branch_sync.sh \
  deepseekx/main rust-v0.131.0
```

Review:

- current branch
- dirty tracked files
- untracked files
- ahead/behind counts
- merge-base with the selected upstream version ref
- whether the target branch exists locally
- whether `origin` and `upstream` match the expected repositories

If `DEEPSEEK_API_KEY.env` or other secret-like files are present, leave them
untracked and mention that they were intentionally not touched.

## Safe Version Sync Procedure

Use this when the user asks to align DeepSeekX with a Codex version.

```bash
version=rust-v0.131.0
sync_branch=deepseekx/sync/$version

git fetch origin deepseekx/main
git fetch upstream tag "$version"
git switch -c "$sync_branch" origin/deepseekx/main
git merge --no-ff "$version"
```

If using a commit SHA instead of a tag:

```bash
upstream_ref=<sha>
sync_branch=deepseekx/sync/${upstream_ref:0:12}

git fetch origin deepseekx/main
git fetch upstream "$upstream_ref"
git switch -c "$sync_branch" origin/deepseekx/main
git merge --no-ff "$upstream_ref"
```

If `origin/deepseekx/main` does not exist, stop and ask. Do not recreate shared
branch topology implicitly.

## Integrating The Sync Branch

After checks pass, choose one path explicitly with the user.

Solo developer default:

- Direct local merge into `deepseekx/main` is acceptable when the user wants
  speed and accepts local review discipline.
- Still keep a sync branch first, because it provides a rollback point and a
  clear place to resolve conflicts.
- Push `deepseekx/main` only after checks pass and the user confirms.
- Run `$we:deepseekx-github-flow` with merge intent before merge-to-main:

```bash
.codex/skills/we/deepseekx-github-flow/scripts/preflight_github_flow.sh \
  --intent merge
```

GitHub Flow option:

- Push `deepseekx/sync/<version>` and open a PR into `deepseekx/main`.
- Use PR when CI must run before trunk changes, when release artifacts are
  involved, or when the user wants a reviewable audit trail.
- For a solo developer, PR is recommended for high-risk upstream version jumps,
  but not mandatory for small or already locally verified syncs.

Direct local integration:

```bash
git switch deepseekx/main
git merge --no-ff deepseekx/sync/rust-v0.131.0
```

PR integration:

```bash
git push -u origin deepseekx/sync/rust-v0.131.0
gh pr create --base deepseekx/main --head deepseekx/sync/rust-v0.131.0
```

Push, PR creation, direct local merge, downstream tag creation, and cleanup of
`deepseekx/sync/<version>` all need user confirmation through the GitHub Flow
role contract.

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
Merge upstream rust-v0.131.0 into deepseekx sync branch
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
- push, PR, tag, merge, or cleanup action waiting for user confirmation
- remaining untracked or dirty files
