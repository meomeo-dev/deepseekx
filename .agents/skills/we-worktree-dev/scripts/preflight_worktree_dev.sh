#!/usr/bin/env bash
set -euo pipefail

main_branch="${WE_FEATURE_MAIN:-deepseekx/main}"
origin_name="${WE_FEATURE_ORIGIN:-origin}"
worktree_root="${WE_WORKTREE_ROOT:-../deepseekx-wt}"

section() {
  printf '\n== %s ==\n' "$1"
}

section "main worktree"
pwd
git status --short --branch

section "remotes"
git remote -v

section "existing worktrees"
git worktree list --porcelain

section "target worktree root"
printf 'path=%s\n' "$worktree_root"
if [[ -e "$worktree_root" ]]; then
  if [[ -d "$worktree_root" ]]; then
    echo "state=directory exists"
    find "$worktree_root" -maxdepth 1 -mindepth 1 -type d -print | sort
  else
    echo "state=exists but is not a directory"
  fi
else
  echo "state=missing"
fi

section "main relation"
if git show-ref --verify --quiet "refs/remotes/${origin_name}/${main_branch}"; then
  git rev-list --left-right --count \
    "${origin_name}/${main_branch}...HEAD" |
    awk '{ print "behind=" $1 " ahead=" $2 }'
else
  echo "missing refs/remotes/${origin_name}/${main_branch}"
fi

section "tracked dirty files"
tracked_dirty="$(
  git status --porcelain=v1 |
    awk '$1 !~ /^\\?\\?/ { print substr($0, 4) }'
)"
if [[ -z "$tracked_dirty" ]]; then
  echo "none"
else
  printf '%s\n' "$tracked_dirty"
fi

section "untracked files"
untracked="$(
  git status --porcelain=v1 |
    awk '$1 == "??" { print substr($0, 4) }'
)"
if [[ -z "$untracked" ]]; then
  echo "none"
else
  printf '%s\n' "$untracked"
fi

section "secret-like untracked paths"
secret_like="$(
  printf '%s\n' "$untracked" |
    grep -E '(^|/)(\\.env|.*\\.env|.*key.*|.*token.*|.*secret.*|.*credential.*)' \
      || true
)"
if [[ -z "$secret_like" ]]; then
  echo "none"
else
  printf '%s\n' "$secret_like"
fi
