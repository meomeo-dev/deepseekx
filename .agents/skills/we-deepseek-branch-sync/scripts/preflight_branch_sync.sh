#!/usr/bin/env bash
set -euo pipefail

target_branch="${1:-deepseekx/main}"
upstream_ref="${2:-}"
expected_origin="${WE_PRIVATE_REMOTE_URL:-https://github.com/meomeo-dev/deepseekx.git}"
expected_upstream="${WE_UPSTREAM_REMOTE_URL:-https://github.com/openai/codex.git}"

section() {
  printf '\n== %s ==\n' "$1"
}

remote_matches() {
  local actual="$1"
  local expected="$2"
  [[ "$actual" == "$expected" || "$actual" == "${expected%.git}" ]]
}

section "branch sync preflight"
echo "target_branch=$target_branch"
if [[ -z "$upstream_ref" ]]; then
  echo "upstream_ref=missing"
  echo "ERROR: pass an explicit Codex version tag or commit SHA"
  echo "example: $0 deepseekx/main rust-v0.131.0"
  exit 2
fi
echo "upstream_ref=$upstream_ref"

section "current branch"
git branch --show-current

section "worktree status"
git status --short

section "remotes"
git remote -v

section "remote expectation"
origin_url="$(git remote get-url origin 2>/dev/null || true)"
upstream_url="$(git remote get-url upstream 2>/dev/null || true)"
echo "origin=${origin_url:-missing}"
echo "upstream=${upstream_url:-missing}"
if remote_matches "$origin_url" "$expected_origin"; then
  echo "origin_check=ok"
else
  echo "origin_check=unexpected"
fi
if remote_matches "$upstream_url" "$expected_upstream"; then
  echo "upstream_check=ok"
else
  echo "upstream_check=unexpected"
fi

section "target branch"
if git show-ref --verify --quiet "refs/heads/${target_branch}"; then
  git rev-parse --short "$target_branch"
else
  echo "missing local branch: $target_branch"
fi

section "upstream ref"
if git rev-parse --verify --quiet "${upstream_ref}^{commit}" >/dev/null; then
  git rev-parse --short "$upstream_ref"
else
  echo "missing local ref: $upstream_ref"
fi

section "upstream remote candidate"
if git ls-remote --exit-code --tags upstream "$upstream_ref" >/dev/null 2>&1; then
  echo "found upstream tag: $upstream_ref"
elif git ls-remote --exit-code --heads upstream "$upstream_ref" >/dev/null 2>&1; then
  echo "found upstream branch: $upstream_ref"
elif [[ "$upstream_ref" =~ ^[0-9a-fA-F]{7,40}$ ]]; then
  echo "commit SHA candidate; verify with git fetch upstream $upstream_ref"
else
  echo "not found as upstream tag or branch"
fi

section "ahead behind"
if git rev-parse --verify --quiet "${upstream_ref}^{commit}" >/dev/null \
  && git show-ref --verify --quiet "refs/heads/${target_branch}"; then
  git rev-list --left-right --count "${target_branch}...${upstream_ref}"
  echo "left=target-only commits, right=version-ref-only commits"
else
  echo "skipped"
fi

section "merge base"
if git rev-parse --verify --quiet "${upstream_ref}^{commit}" >/dev/null \
  && git show-ref --verify --quiet "refs/heads/${target_branch}"; then
  git merge-base "$target_branch" "$upstream_ref" | cut -c1-12
else
  echo "skipped"
fi

section "secret-like untracked paths"
git status --porcelain=v1 |
  while IFS= read -r line; do
    status="${line:0:2}"
    if [[ "$status" == "??" ]]; then
      echo "${line:3}"
    fi
  done |
  grep -Ei '(^|/)([^/]*\.env|.*key.*|.*token.*|.*secret.*|.*credential.*)' ||
  true
