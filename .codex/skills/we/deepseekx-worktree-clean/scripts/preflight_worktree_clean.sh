#!/usr/bin/env bash
set -euo pipefail

require_clean=false
if [[ "${1:-}" == "--require-clean" ]]; then
  require_clean=true
fi

main_branch="${DEEPSEEKX_MAIN_BRANCH:-deepseekx/main}"
status_file="$(mktemp "${TMPDIR:-/tmp}/deepseekx-status.XXXXXX")"
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

git status --porcelain=v1 >"${status_file}"

echo "== worktree clean preflight =="
echo "main_branch=${main_branch}"
echo "require_clean=${require_clean}"
echo

echo "== current branch =="
current_branch="$(git branch --show-current)"
echo "${current_branch:-DETACHED}"
if [[ -z "${current_branch}" ]]; then
  echo "ERROR: detached HEAD; stop before starting a new workflow."
fi
echo

echo "== status =="
git status --short --branch
echo

echo "== upstream tracking =="
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

echo "== current branch vs deepseekx/main =="
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

echo "== staged paths =="
if git diff --cached --quiet; then
  echo "none"
else
  git diff --cached --name-status
fi
echo

echo "== unstaged tracked paths =="
if git diff --quiet; then
  echo "none"
else
  git diff --name-status
fi
echo

echo "== untracked paths =="
if grep -q '^?? ' "${status_file}"; then
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
has_secret_untracked=false
while IFS= read -r line; do
  if [[ "${line:0:2}" == "??" ]]; then
    path="${line:3}"
    if is_secret_like "${path}"; then
      has_secret_untracked=true
      echo "${path}"
      if git check-ignore -q -- "${path}"; then
        git check-ignore -v -- "${path}" || true
      else
        echo "not ignored; consider .gitignore or .git/info/exclude"
      fi
    fi
  fi
done <"${status_file}"
if [[ "${has_secret_untracked}" == "false" ]]; then
  echo "none"
fi
echo

echo "== ignored secret-like paths =="
has_ignored_secret=false
while IFS= read -r path; do
  case "${path}" in
    codex-rs/target/*|target/*|node_modules/*|.git/*)
      continue
      ;;
  esac
  if is_secret_like "${path}"; then
    has_ignored_secret=true
    echo "${path}"
  fi
done < <(git ls-files --others --ignored --exclude-standard \
  DEEPSEEK_API_KEY.env '*.env' '.env*' '*KEY*' '*TOKEN*' '*SECRET*' \
  '*credential*' '*.pem' '*.p12')
if [[ "${has_ignored_secret}" == "false" ]]; then
  echo "none"
fi
echo

echo "== route recommendation =="
clean=true
has_staged=false
has_unstaged=false
has_untracked=false
if ! git diff --cached --quiet; then
  clean=false
  has_staged=true
fi
if ! git diff --quiet; then
  clean=false
  has_unstaged=true
fi
if grep -q '^?? ' "${status_file}"; then
  clean=false
  has_untracked=true
fi

echo "clean=${clean}"
if [[ "${has_staged}" == "true" ]]; then
  echo "action=review staged paths and commit or unstage intentionally"
fi
if [[ "${has_unstaged}" == "true" ]]; then
  echo "action=review tracked diff before switching workflows"
fi
if [[ "${has_untracked}" == "true" ]]; then
  echo "action=classify untracked paths as source, generated, or secret"
fi
if [[ "${has_secret_untracked}" == "true" ]]; then
  echo "action=do not stage secret-like paths; maintain ignore rules"
fi

if [[ "${require_clean}" == "true" && "${clean}" != "true" ]]; then
  echo "ERROR: worktree is not clean; use we:deepseekx-worktree-clean first."
  exit 3
fi
