#!/usr/bin/env bash
set -euo pipefail

target_branch="${1:-feature/deepseek-api-integration}"
upstream_ref="${2:-origin/main}"

echo "== branch sync preflight =="
echo "target_branch=${target_branch}"
echo "upstream_ref=${upstream_ref}"
echo

echo "== current branch =="
git branch --show-current
echo

echo "== remotes =="
git remote -v
echo

echo "== worktree status =="
git status --short
echo

echo "== target branch =="
if git show-ref --verify --quiet "refs/heads/${target_branch}"; then
  git rev-parse --short "${target_branch}"
else
  echo "missing local branch: ${target_branch}"
fi
echo

echo "== upstream ref =="
if git rev-parse --verify --quiet "${upstream_ref}^{commit}" >/dev/null; then
  git rev-parse --short "${upstream_ref}"
else
  echo "missing upstream ref: ${upstream_ref}"
fi
echo

echo "== ahead behind =="
if git rev-parse --verify --quiet "${upstream_ref}^{commit}" >/dev/null \
  && git show-ref --verify --quiet "refs/heads/${target_branch}"; then
  git rev-list --left-right --count "${target_branch}...${upstream_ref}"
  echo "left=target-only commits, right=upstream-only commits"
else
  echo "skipped"
fi
echo

echo "== merge base =="
if git rev-parse --verify --quiet "${upstream_ref}^{commit}" >/dev/null \
  && git show-ref --verify --quiet "refs/heads/${target_branch}"; then
  git merge-base "${target_branch}" "${upstream_ref}" | cut -c1-12
else
  echo "skipped"
fi
echo

echo "== secret-like untracked paths =="
git status --short \
  | awk '/^\\?\\?/ {print $2}' \
  | grep -E '(^|/)([^/]*\\.env|.*KEY.*|.*TOKEN.*)$' \
  || true
