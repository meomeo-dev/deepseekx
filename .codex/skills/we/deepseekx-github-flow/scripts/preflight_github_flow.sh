#!/usr/bin/env bash
set -euo pipefail

intent="status"
if [[ "${1:-}" == "--intent" ]]; then
  intent="${2:-status}"
fi

main_branch="${DEEPSEEKX_MAIN_BRANCH:-deepseekx/main}"
remote_main="origin/${main_branch}"
status_file="$(mktemp "${TMPDIR:-/tmp}/deepseekx-github-flow.XXXXXX")"
trap 'rm -f "${status_file}"' EXIT

is_secret_like() {
  local path="$1"
  local matched=1
  shopt -s nocasematch
  if [[ "${path}" =~ (^|/)([^/]*\.env|.*key.*|.*token.*|.*secret.*) ]]; then
    matched=0
  elif [[ "${path}" =~ (^|/)(.*credential.*|.*\.pem|.*\.p12)$ ]]; then
    matched=0
  fi
  shopt -u nocasematch
  return "${matched}"
}

branch_kind() {
  local branch="$1"
  if [[ -z "${branch}" ]]; then
    echo "detached"
  elif [[ "${branch}" == "${main_branch}" ]]; then
    echo "main"
  elif [[ "${branch}" == deepseekx/sync/* ]]; then
    echo "sync"
  elif [[ "${branch}" == deepseekx/fix-* ]]; then
    echo "fix"
  elif [[ "${branch}" == deepseekx/nightly ]]; then
    echo "nightly"
  elif [[ "${branch}" == deepseekx/* ]]; then
    echo "feature"
  else
    echo "foreign"
  fi
}

git status --porcelain=v1 >"${status_file}"

current_branch="$(git branch --show-current)"
kind="$(branch_kind "${current_branch}")"

has_staged=false
has_unstaged=false
has_untracked=false
has_secret_untracked=false

if ! git diff --cached --quiet; then
  has_staged=true
fi
if ! git diff --quiet; then
  has_unstaged=true
fi
if grep -q '^?? ' "${status_file}"; then
  has_untracked=true
fi
while IFS= read -r line; do
  if [[ "${line:0:2}" == "??" ]]; then
    path="${line:3}"
    if is_secret_like "${path}"; then
      has_secret_untracked=true
    fi
  fi
done <"${status_file}"

clean=true
if [[ "${has_staged}" == "true" || "${has_unstaged}" == "true" \
  || "${has_untracked}" == "true" ]]; then
  clean=false
fi

echo "== deepseekx github flow preflight =="
echo "intent=${intent}"
echo "main_branch=${main_branch}"
echo "remote_main=${remote_main}"
echo

echo "== current branch =="
echo "${current_branch:-DETACHED}"
echo "branch_kind=${kind}"
echo

echo "== status =="
git status --short --branch
echo

echo "== tracking =="
tracking_ref="$(git rev-parse --abbrev-ref --symbolic-full-name '@{u}' \
  2>/dev/null || true)"
if [[ -n "${tracking_ref}" ]]; then
  echo "tracking=${tracking_ref}"
  git rev-list --left-right --count "HEAD...${tracking_ref}"
  echo "left=current-only commits, right=tracking-only commits"
else
  echo "tracking=missing"
fi
echo

echo "== current vs deepseekx/main =="
if [[ -n "${current_branch}" && "${current_branch}" != "${main_branch}" ]] \
  && git show-ref --verify --quiet "refs/heads/${main_branch}"; then
  git rev-list --left-right --count "HEAD...${main_branch}"
  echo "left=current-only commits, right=main-only commits"
  if git merge-base --is-ancestor HEAD "${main_branch}"; then
    echo "merged_into_main=yes"
  elif git merge-base --is-ancestor "${main_branch}" HEAD; then
    echo "current_has_unmerged_commits=yes"
  else
    echo "diverged_from_main=yes"
  fi
else
  echo "skipped"
fi
echo

echo "== main vs origin =="
if git show-ref --verify --quiet "refs/heads/${main_branch}" \
  && git rev-parse --verify --quiet "${remote_main}^{commit}" >/dev/null; then
  git rev-list --left-right --count "${main_branch}...${remote_main}"
  echo "left=local-main-only commits, right=origin-main-only commits"
else
  echo "skipped"
fi
echo

echo "== staged paths =="
if [[ "${has_staged}" == "true" ]]; then
  git diff --cached --name-status
else
  echo "none"
fi
echo

echo "== unstaged tracked paths =="
if [[ "${has_unstaged}" == "true" ]]; then
  git diff --name-status
else
  echo "none"
fi
echo

echo "== untracked paths =="
if [[ "${has_untracked}" == "true" ]]; then
  while IFS= read -r line; do
    if [[ "${line:0:2}" == "??" ]]; then
      echo "${line:3}"
    fi
  done <"${status_file}"
else
  echo "none"
fi
echo

echo "== untracked secret-like paths =="
if [[ "${has_secret_untracked}" == "true" ]]; then
  while IFS= read -r line; do
    if [[ "${line:0:2}" == "??" ]]; then
      path="${line:3}"
      if is_secret_like "${path}"; then
        echo "${path}"
      fi
    fi
  done <"${status_file}"
else
  echo "none"
fi
echo

echo "== readiness =="
echo "clean=${clean}"
echo "has_staged=${has_staged}"
echo "has_unstaged=${has_unstaged}"
echo "has_untracked=${has_untracked}"
echo "has_secret_untracked=${has_secret_untracked}"

case "${intent}" in
  status)
    echo "recommendation=inspect state and choose the next intent"
    ;;
  commit)
    if [[ "${has_secret_untracked}" == "true" ]]; then
      echo "recommendation=route-to-worktree-clean"
    elif [[ "${has_staged}" == "true" ]]; then
      echo "recommendation=review staged diff, checks, then commit"
    else
      echo "recommendation=stage intended files only before commit"
    fi
    ;;
  push)
    if [[ "${clean}" != "true" ]]; then
      echo "recommendation=commit or clean worktree before push"
    elif [[ "${kind}" == "main" ]]; then
      echo "recommendation=push-main-needs-user-confirmation"
    else
      echo "recommendation=push branch only after user confirms"
    fi
    ;;
  pr)
    if [[ "${clean}" != "true" ]]; then
      echo "recommendation=commit or clean worktree before PR"
    elif [[ "${kind}" == "main" || "${kind}" == "foreign" ]]; then
      echo "recommendation=not a normal DeepSeekX PR branch"
    else
      echo "recommendation=create PR into deepseekx/main after confirmation"
    fi
    ;;
  merge)
    if [[ "${clean}" != "true" ]]; then
      echo "recommendation=clean worktree before merge"
    else
      echo "recommendation=merge-needs-user-confirmation"
    fi
    ;;
  cleanup)
    if [[ "${clean}" != "true" ]]; then
      echo "recommendation=clean worktree before branch cleanup"
    else
      echo "recommendation=delete branch only after user confirmation"
    fi
    ;;
  *)
    echo "recommendation=unknown intent: ${intent}"
    exit 2
    ;;
esac
