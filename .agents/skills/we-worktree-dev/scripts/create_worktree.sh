#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat >&2 <<'USAGE'
usage: create_worktree.sh <slug> <agent>

Creates ../deepseekx-wt/<slug>-<agent> on branch
worktree/<slug>/<agent> from origin/deepseekx/main by default.

Environment:
  WE_WORKTREE_ROOT   override worktree parent directory
  WE_WORKTREE_BASE   override base ref, e.g. HEAD or feature/foo
  WE_FEATURE_MAIN    override base branch, default deepseekx/main
  WE_FEATURE_ORIGIN  override remote, default origin
USAGE
}

slug="${1:-}"
agent="${2:-}"
main_branch="${WE_FEATURE_MAIN:-deepseekx/main}"
origin_name="${WE_FEATURE_ORIGIN:-origin}"
worktree_root="${WE_WORKTREE_ROOT:-../deepseekx-wt}"
base_ref="${WE_WORKTREE_BASE:-${origin_name}/${main_branch}}"

if [[ -z "$slug" || -z "$agent" ]]; then
  usage
  exit 2
fi

if [[ ! "$slug" =~ ^[a-z0-9]+(-[a-z0-9]+)*$ ]]; then
  echo "slug must be lowercase kebab-case" >&2
  exit 2
fi

if [[ ! "$agent" =~ ^[a-z0-9]+(-[a-z0-9]+)*$ ]]; then
  echo "agent must be lowercase kebab-case" >&2
  exit 2
fi

branch="worktree/${slug}/${agent}"
path="${worktree_root}/${slug}-${agent}"

if [[ -e "$path" ]]; then
  echo "worktree path already exists: $path" >&2
  exit 1
fi

if git show-ref --verify --quiet "refs/heads/${branch}"; then
  echo "branch already exists: $branch" >&2
  exit 1
fi

if ! git rev-parse --verify --quiet "${base_ref}^{commit}" >/dev/null; then
  echo "missing base ref: ${base_ref}" >&2
  exit 1
fi

mkdir -p "$worktree_root"
git worktree add -b "$branch" "$path" "$base_ref"

cat <<EOF
worktree_path=$path
branch=$branch
base=$base_ref
EOF
