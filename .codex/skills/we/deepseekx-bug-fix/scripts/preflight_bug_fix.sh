#!/usr/bin/env bash
set -euo pipefail

expected_origin="https://github.com/meomeo-dev/deepseekx.git"
expected_upstream="https://github.com/openai/codex.git"
main_branch="deepseekx/main"
clean_script=".codex/skills/we/deepseekx-worktree-clean/scripts"
clean_script="${clean_script}/preflight_worktree_clean.sh"

echo "== bug fix preflight =="
echo "main_branch=${main_branch}"
echo

echo "== clean worktree gate =="
if ! "${clean_script}" --require-clean; then
  echo "ERROR: route to we:deepseekx-worktree-clean before bug fixing."
  exit 3
fi
echo

echo "== current branch =="
current_branch="$(git branch --show-current)"
echo "${current_branch:-DETACHED}"
if [[ -z "${current_branch}" ]]; then
  echo "ERROR: detached HEAD; stop before bug fixing."
fi
if [[ "${current_branch}" == "${main_branch}" ]]; then
  echo "WARN: create deepseekx/fix-<bug-slug> before editing."
fi
if [[ "${current_branch}" == deepseekx/sync/* ]]; then
  echo "ERROR: do not fix bugs on a sync branch."
fi
if [[ "${current_branch}" == "deepseekx/nightly" ]]; then
  echo "ERROR: do not fix bugs on the nightly build branch."
fi
if [[ "${current_branch}" != deepseekx/* ]]; then
  echo "WARN: branch is not under deepseekx/*."
fi
echo

echo "== remote expectation =="
origin_url="$(git remote get-url origin 2>/dev/null || true)"
upstream_url="$(git remote get-url upstream 2>/dev/null || true)"
echo "origin=${origin_url:-missing}"
echo "upstream=${upstream_url:-missing}"
if [[ "${origin_url}" != "${expected_origin}" ]]; then
  echo "ERROR: origin does not match ${expected_origin}"
fi
if [[ "${upstream_url}" != "${expected_upstream}" ]]; then
  echo "ERROR: upstream does not match ${expected_upstream}"
fi
echo

echo "== local main =="
if git show-ref --verify --quiet "refs/heads/${main_branch}"; then
  git rev-parse --short "${main_branch}"
else
  echo "missing local branch: ${main_branch}"
fi
echo

echo "== current vs origin/deepseekx/main =="
if git rev-parse --verify --quiet "origin/${main_branch}^{commit}" \
  >/dev/null; then
  git rev-list --left-right --count "HEAD...origin/${main_branch}"
  echo "left=current-only commits, right=remote-main-only commits"
else
  echo "skipped"
fi
