#!/usr/bin/env bash
set -euo pipefail

target_branch="${1:-deepseekx/main}"
upstream_ref="${2:-}"
expected_origin="https://github.com/meomeo-dev/deepseekx.git"
expected_upstream="https://github.com/openai/codex.git"

echo "== branch sync preflight =="
echo "target_branch=${target_branch}"
if [[ -z "${upstream_ref}" ]]; then
  echo "upstream_ref=missing"
  echo "ERROR: pass an explicit Codex version tag or commit SHA"
  echo "example: $0 deepseekx/main rust-v0.131.0"
  exit 2
fi
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
  echo "missing local ref: ${upstream_ref}"
fi
echo

echo "== upstream remote candidate =="
if git ls-remote --exit-code --tags upstream "${upstream_ref}" >/dev/null 2>&1; then
  echo "found upstream tag: ${upstream_ref}"
elif git ls-remote --exit-code --heads upstream "${upstream_ref}" >/dev/null 2>&1; then
  echo "found upstream branch: ${upstream_ref}"
elif [[ "${upstream_ref}" =~ ^[0-9a-fA-F]{7,40}$ ]]; then
  echo "commit SHA candidate; verify with git fetch upstream ${upstream_ref}"
else
  echo "not found as upstream tag or branch"
fi
echo

echo "== ahead behind =="
if git rev-parse --verify --quiet "${upstream_ref}^{commit}" >/dev/null \
  && git show-ref --verify --quiet "refs/heads/${target_branch}"; then
  git rev-list --left-right --count "${target_branch}...${upstream_ref}"
  echo "left=target-only commits, right=version-ref-only commits"
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
