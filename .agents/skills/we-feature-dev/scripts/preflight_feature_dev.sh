#!/usr/bin/env bash
set -euo pipefail

main_branch="${WE_FEATURE_MAIN:-deepseekx/main}"
origin_name="${WE_FEATURE_ORIGIN:-origin}"
expected_origin="${WE_PRIVATE_REMOTE_URL:-https://github.com/meomeo-dev/deepseekx.git}"
expected_upstream="${WE_UPSTREAM_REMOTE_URL:-https://github.com/openai/codex.git}"
expected_github_repo="${WE_PRIVATE_REPO_SLUG:-meomeo-dev/deepseekx}"

section() {
  printf '\n== %s ==\n' "$1"
}

remote_matches() {
  local actual="$1"
  local expected="$2"
  [[ "$actual" == "$expected" || "$actual" == "${expected%.git}" ]]
}

section "branch"
current_branch="$(git branch --show-current 2>/dev/null || true)"
if [[ -z "$current_branch" ]]; then
  echo "current_branch: detached HEAD"
else
  echo "current_branch: $current_branch"
fi
echo "downstream_main: $main_branch"

section "remotes"
git remote -v

origin_url="$(git remote get-url "$origin_name" 2>/dev/null || true)"
if [[ -z "$origin_url" ]]; then
  echo "origin_check: missing remote '$origin_name'"
elif remote_matches "$origin_url" "$expected_origin"; then
  echo "origin_check: ok"
else
  echo "origin_check: unexpected origin url"
fi

upstream_url="$(git remote get-url upstream 2>/dev/null || true)"
if [[ -z "$upstream_url" ]]; then
  echo "upstream_check: missing remote 'upstream'"
elif remote_matches "$upstream_url" "$expected_upstream"; then
  echo "upstream_check: ok"
else
  echo "upstream_check: unexpected upstream url"
fi

section "gh default repo"
if command -v gh >/dev/null 2>&1; then
  gh_default="$(gh repo set-default --view 2>/dev/null || true)"
  if [[ "$gh_default" == "$expected_github_repo" ]]; then
    echo "gh_default_repo: ok ($gh_default)"
  elif [[ -z "$gh_default" ]]; then
    echo "gh_default_repo: unset"
    echo "fix: gh repo set-default $expected_github_repo"
  else
    echo "gh_default_repo: unexpected ($gh_default)"
    echo "expected: $expected_github_repo"
  fi
else
  echo "gh_default_repo: gh not installed"
fi

section "worktree"
git status --short

section "tracked dirty files"
tracked_dirty="$(
  git status --porcelain=v1 |
    awk '$1 != "??" { print substr($0, 4) }'
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
    grep -Ei '(^|/)(\.env|.*\.env|.*key.*|.*token.*|.*secret.*|.*credential.*)' \
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

section "local downstream main relation"
if git show-ref --verify --quiet "refs/heads/${main_branch}"; then
  git rev-list --left-right --count "${main_branch}...HEAD" |
    awk '{ print "behind=" $1 " ahead=" $2 }'
else
  echo "missing local ${main_branch}"
fi

section "upstream visibility"
if git show-ref --verify --quiet refs/remotes/upstream/main; then
  git rev-list --left-right --count "upstream/main...HEAD" |
    awk '{ print "behind_upstream_main=" $1 " ahead_upstream_main=" $2 }'
else
  echo "missing refs/remotes/upstream/main"
fi

section "package facts"
node - <<'NODE'
const fs = require('node:fs');

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, 'utf8'));
}

const root = readJson('package.json');
const cli = readJson('codex-cli/package.json');
console.log(`root_name=${root.name ?? ''}`);
console.log(`root_private=${root.private ?? ''}`);
console.log(`cli_name=${cli.name ?? ''}`);
console.log(`cli_version=${cli.version ?? ''}`);
console.log(`cli_license=${cli.license ?? ''}`);
console.log(`cli_bin=${Object.keys(cli.bin ?? {}).join(',')}`);
console.log(`cli_repository=${cli.repository?.url ?? ''}`);
NODE
