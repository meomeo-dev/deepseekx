---
name: we:we-skill-maker
description: Create or maintain project-local WE skills under
  .codex/skills/we/<short_name>/ with concise SKILL.md instructions, optional
  scripts/templates/data folders, project safety checks, and commit hygiene.
---

# WE Skill Maker

Use this skill when the user asks to create, update, or standardize a
project-local skill in `.codex/skills/we/<short_name>/`.

## Scope

This is a project meta-skill. It creates and maintains skills for repeated
project workflows. It does not install global skills and does not publish
plugins.

## Naming

- Use a short lowercase kebab-case name.
- Prefer names that describe the repeated operation:
  `deepseek-cache-bench`, `deepseek-branch-sync`,
  `deepseekx-feature-dev`.
- Avoid vague names such as `helper`, `tool`, `workflow`, or `misc`.
- Directory must be `.codex/skills/we/<short_name>/`.
- Frontmatter `name` must be `we:<short_name>`.
- Invoke WE skills with `$we:<short_name>` after Codex reloads skills.

## Required Shape

Every WE skill needs:

```text
.codex/skills/we/<short_name>/
└── SKILL.md
```

Optional folders:

```text
scripts/     deterministic helpers or validators
templates/   reusable config or file templates
data/        test cases, archived runs, examples, or fixtures
references/  detailed docs loaded only when needed
```

Do not add README, changelog, or broad tutorial files unless the user
explicitly asks. Put operational instructions in `SKILL.md`.

## SKILL.md Rules

- Start with YAML frontmatter containing `name` and `description`.
- Description must say when to use the skill.
- Keep instructions concise and action-oriented.
- Include invariants, workflow, validation, and final response requirements.
- Record dangerous operations and explicit non-goals.
- Mention scripts by relative path and explain when to run them.
- Do not include chat framing or generation notes.
- Use Chinese-first prose when writing project-facing docs.
- Keep lines at or under 88 characters.

## Safety Rules

- Do not include secrets, tokens, `.env` files, or private credentials.
- Do not encode irreversible git commands into helper scripts.
- Helper scripts should default to read-only unless mutation is the point.
- For branch, Docker, network, or filesystem operations, include preflight
  checks and stop conditions.
- For development workflows, branch and remote state must be checked by a
  preflight script. Do not rely on LLM memory.
- Keep high-risk upstream sync, ordinary feature development, and release
  operations in separate skills when they repeat often.
- If a workflow can destroy work, require explicit user confirmation in the
  skill text instead of automating it.

## Creation Procedure

1. Inspect existing WE skills for naming and structure.
2. Choose `<short_name>` and create its directory.
3. Write `SKILL.md` first.
4. Add `scripts/`, `templates/`, `data/`, or `references/` only when they
   materially improve repeatability.
5. Add a read-only preflight script for branch, Docker, network, or filesystem
   workflows.
6. Prefer small scripts over long pasted shell snippets.
7. Validate the skill files.
8. Stage only the new or changed skill directory.
9. Commit when the user asks, leaving unrelated files untouched.

## Scaffold Helper

Use the helper to create a minimal directory and `SKILL.md` draft:

```bash
.codex/skills/we/we-skill-maker/scripts/scaffold_we_skill.sh \
  <short_name> "One sentence description"
```

After scaffolding, edit `SKILL.md` manually. The helper intentionally creates
only a conservative draft.

## Validation

Run these before finalizing:

```bash
python3 - <<'PY'
from pathlib import Path
root = Path('.codex/skills/we/<short_name>')
for path in root.rglob('*'):
    if not path.is_file():
        continue
    text = path.read_text(errors='ignore')
    for i, line in enumerate(text.splitlines(), 1):
        if len(line) > 88:
            print(f'{path}:{i}:{len(line)}')
PY
```

For scripts:

```bash
bash -n .codex/skills/we/<short_name>/scripts/*.sh
python3 -m py_compile .codex/skills/we/<short_name>/scripts/*.py
```

Use only the relevant command when a script type exists.

## Commit Hygiene

Before committing:

```bash
git status --short
git diff --cached --name-only
```

Ensure the staged paths are limited to:

```text
.codex/skills/we/<short_name>/
```

Never stage `.env`, key files, scratch research directories, or unrelated
worktree changes.

## Final Response

Report:

- skill name
- path
- scripts or templates added
- validation commands run
- commit hash, if committed
- unrelated dirty files left untouched
