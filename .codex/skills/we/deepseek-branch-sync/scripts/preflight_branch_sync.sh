#!/usr/bin/env bash
set -euo pipefail

target_branch="${1:-deepseekx/main}"
upstream_ref="${2:-upstream/main}"
expected_origin="https://github.com/meomeo-dev/deepseekx.git"
expected_upstream="https://github.com/openai/codex.git"

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

echo "== remote expectation =="
origin_url="$(git remote get-url origin 2>/dev/null || true)"
upstream_url="$(git remote get-url upstream 2>/dev/null || true)"
echo "origin=${origin_url:-missing}"
echo "upstream=${upstream_url:-missing}"
if [[ "${origin_url}" != "${expected_origin}" ]]; then
  echo "WARN: origin does not match ${expected_origin}"
fi
if [[ "${upstream_url}" != "${expected_upstream}" ]]; then
  echo "WARN: upstream does not match ${expected_upstream}"
fi
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
git status --porcelain=v1 \
  | while IFS= read -r line; do
      status="${line:0:2}"
      if [[ "${status}" == "??" ]]; then
        echo "${line:3}"
      fi
    done \
  | grep -E '(^|/)([^/]*\.env|.*KEY.*|.*TOKEN.*)$' \
  || true
