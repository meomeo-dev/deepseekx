#!/usr/bin/env bash
set -euo pipefail

private_repo="${WE_PRIVATE_REPO:-__WE_PRIVATE_REPO_SLUG__}"
public_repo="${WE_PUBLIC_REPO:-__WE_PUBLIC_REPO_SLUG__}"
branch="${WE_BRANCH_PROTECTION_BRANCH:-main}"
target="${WE_BRANCH_PROTECTION_TARGET:-both}"

section() {
  printf '\n== %s ==\n' "$1"
}

repo_enabled() {
  local repo_kind="$1"
  [[ "$target" == "both" || "$target" == "$repo_kind" ]]
}

section "local remote"
git remote -v || true

section "gh auth"
if ! command -v gh >/dev/null 2>&1; then
  echo "gh=missing"
  exit 0
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "gh_auth=unavailable"
  exit 0
fi
echo "gh_auth=ok"

check_repo() {
  local label="$1"
  local repo="$2"
  local api_error

  section "$label branch protection"
  echo "repo=$repo"
  echo "branch=$branch"

  local protection_output
  api_error="$(mktemp)"
  if protection_output="$(gh api "repos/${repo}/branches/${branch}/protection" \
    --jq '{
      required_status_checks,
      enforce_admins,
      required_pull_request_reviews,
      restrictions,
      required_linear_history,
      allow_force_pushes,
      allow_deletions
    }' 2>"$api_error")"; then
    printf '%s\n' "$protection_output"
  else
    echo "protection=missing_or_unavailable"
    printf 'api_error=%s\n' "$(sed -n '1p' "$api_error")"
  fi
  rm -f "$api_error"

  section "$label recent workflows"
  gh api "repos/${repo}/actions/workflows" \
    --jq '.workflows[] | {name, path, state}' 2>/dev/null ||
    echo "workflows=unavailable"
}

if repo_enabled private; then
  check_repo "private" "$private_repo"
fi

if repo_enabled public; then
  check_repo "public" "$public_repo"
fi
