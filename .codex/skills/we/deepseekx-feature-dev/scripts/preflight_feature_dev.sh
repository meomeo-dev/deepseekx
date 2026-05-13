#!/usr/bin/env bash
set -euo pipefail

expected_origin="https://github.com/meomeo-dev/deepseekx.git"
expected_upstream="https://github.com/openai/codex.git"
main_branch="deepseekx/main"
main_remote="origin/deepseekx/main"
upstream_ref="upstream/main"
clean_script=".codex/skills/we/deepseekx-worktree-clean/scripts"
clean_script="${clean_script}/preflight_worktree_clean.sh"

echo "== feature development preflight =="
echo "main_branch=${main_branch}"
echo "main_remote=${main_remote}"
echo "upstream_ref=${upstream_ref}"
echo

echo "== clean worktree gate =="
if ! "${clean_script}" --require-clean; then
  echo "ERROR: route to we:deepseekx-worktree-clean before feature work."
  exit 3
fi
echo

echo "== current branch =="
current_branch="$(git branch --show-current)"
echo "${current_branch:-DETACHED}"
if [[ -z "${current_branch}" ]]; then
  echo "ERROR: detached HEAD; stop before development."
fi
if [[ "${current_branch}" == "feature/deepseek-api-integration" ]]; then
  echo "ERROR: old DeepSeek branch; migrate to deepseekx/main first."
fi
if [[ "${current_branch}" != deepseekx/* ]]; then
  echo "WARN: branch is not under deepseekx/*."
fi
if [[ "${current_branch}" == "${main_branch}" ]]; then
  echo "WARN: do not implement feature work directly on ${main_branch}."
fi
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
  echo "ERROR: origin does not match ${expected_origin}"
fi
if [[ "${upstream_url}" != "${expected_upstream}" ]]; then
  echo "ERROR: upstream does not match ${expected_upstream}"
fi
echo

echo "== worktree status =="
git status --short
echo

echo "== tracked dirty paths =="
git status --porcelain=v1 | while IFS= read -r line; do
  status="${line:0:2}"
  if [[ "${status}" != "??" ]]; then
    echo "${line}"
  fi
done
echo

echo "== untracked paths =="
git status --porcelain=v1 | while IFS= read -r line; do
  status="${line:0:2}"
  if [[ "${status}" == "??" ]]; then
    echo "${line:3}"
  fi
done
echo

echo "== secret-like untracked paths =="
git status --porcelain=v1 \
  | while IFS= read -r line; do
      status="${line:0:2}"
      if [[ "${status}" == "??" ]]; then
        echo "${line:3}"
      fi
    done \
  | grep -E '(^|/)([^/]*\.env|.*KEY.*|.*TOKEN.*|.*SECRET.*)$' \
  || true
echo

echo "== local main =="
if git show-ref --verify --quiet "refs/heads/${main_branch}"; then
  git rev-parse --short "${main_branch}"
else
  echo "missing local branch: ${main_branch}"
fi
echo

echo "== remote main =="
if git rev-parse --verify --quiet "${main_remote}^{commit}" >/dev/null; then
  git rev-parse --short "${main_remote}"
else
  echo "missing remote ref: ${main_remote}"
fi
echo

echo "== current vs origin/deepseekx/main =="
if git rev-parse --verify --quiet "${main_remote}^{commit}" >/dev/null; then
  git rev-list --left-right --count "HEAD...${main_remote}"
  echo "left=current-only commits, right=remote-main-only commits"
else
  echo "skipped"
fi
echo

echo "== deepseekx/main vs upstream/main drift visibility =="
if git rev-parse --verify --quiet "${upstream_ref}^{commit}" >/dev/null \
  && git show-ref --verify --quiet "refs/heads/${main_branch}"; then
  git rev-list --left-right --count "${main_branch}...${upstream_ref}"
  echo "left=deepseekx-main-only, right=upstream-main-only"
  echo "note=feature branches still start from deepseekx/main"
else
  echo "skipped"
fi
