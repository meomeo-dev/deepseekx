#!/usr/bin/env bash
set -euo pipefail

main_branch="${WE_FEATURE_MAIN:-main}"
origin_name="${WE_FEATURE_ORIGIN:-origin}"
default_origin_suffix="__WE_PRIVATE_REMOTE_HINT__"
expected_origin_suffix="${WE_PRIVATE_REMOTE_SUFFIX:-$default_origin_suffix}"

section() {
  printf '\n== %s ==\n' "$1"
}

section "branch"
current_branch="$(git branch --show-current 2>/dev/null || true)"
if [[ -z "$current_branch" ]]; then
  echo "current_branch: detached HEAD"
else
  echo "current_branch: $current_branch"
fi

section "remotes"
git remote -v

origin_url="$(git remote get-url "$origin_name" 2>/dev/null || true)"
if [[ -z "$origin_url" ]]; then
  echo "origin_check: missing remote '$origin_name'"
elif [[ "$origin_url" == *"$expected_origin_suffix" ]]; then
  echo "origin_check: ok"
else
  echo "origin_check: unexpected origin url"
fi

section "worktree"
git status --short

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

section "relation to ${origin_name}/${main_branch}"
if git show-ref --verify --quiet "refs/remotes/${origin_name}/${main_branch}"; then
  git rev-list --left-right --count \
    "${origin_name}/${main_branch}...HEAD" |
    awk '{ print "behind=" $1 " ahead=" $2 }'
else
  echo "missing refs/remotes/${origin_name}/${main_branch}"
fi

section "local main relation"
if git show-ref --verify --quiet "refs/heads/${main_branch}"; then
  git rev-list --left-right --count "${main_branch}...HEAD" |
    awk '{ print "behind=" $1 " ahead=" $2 }'
else
  echo "missing local ${main_branch}"
fi

section "npm package"
node - <<'NODE'
const fs = require('node:fs')
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))
console.log(`name=${pkg.name}`)
console.log(`version=${pkg.version}`)
console.log(`private=${pkg.private}`)
console.log(`license=${pkg.license}`)
console.log(`publish_access=${pkg.publishConfig?.access ?? ''}`)
console.log(`repository=${pkg.repository?.url ?? ''}`)
NODE
